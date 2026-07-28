use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};
use zip::write::SimpleFileOptions;

use super::manifest::{BuildOutput, BuildOutputType, BuildTarget};
use super::path_safety::{metadata_is_link_like, resolve_relative_path};
use super::types::ApplicationPublishError;

const MAX_ARCHIVE_ENTRIES: usize = 50_000;
const MAX_SOURCE_BYTES: u64 = 8 * 1024 * 1024 * 1024;
const MAX_ARTIFACT_BYTES: u64 = 8 * 1024 * 1024 * 1024;

#[derive(Debug)]
struct ArchiveEntry {
    path: PathBuf,
    name: String,
    size: u64,
    is_directory: bool,
}

#[derive(Debug)]
pub(crate) struct PackagedArtifact {
    pub(crate) path: PathBuf,
    pub(crate) package_id: String,
    pub(crate) output_type: String,
    pub(crate) file_name: String,
    pub(crate) content_type: String,
    pub(crate) byte_length: u64,
    pub(crate) sha256: String,
}

fn packaging_error(message: &str) -> ApplicationPublishError {
    ApplicationPublishError::new("APPLICATION_PUBLISH_PACKAGE_FAILED", message)
}

fn portable_archive_name(path: &Path) -> Result<String, ApplicationPublishError> {
    let mut segments = Vec::new();
    for component in path.components() {
        let value = component
            .as_os_str()
            .to_str()
            .filter(|value| !value.is_empty())
            .ok_or_else(|| {
                packaging_error("An output path cannot be represented in an archive.")
            })?;
        if value == "." || value == ".." || value.contains('/') || value.contains('\\') {
            return Err(packaging_error("An output path is unsafe for archiving."));
        }
        segments.push(value);
    }
    Ok(segments.join("/"))
}

fn inspect_regular_file(path: &Path) -> Result<u64, ApplicationPublishError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|_| packaging_error("A declared build output could not be inspected."))?;
    if metadata_is_link_like(&metadata) || !metadata.is_file() {
        return Err(packaging_error(
            "A declared file output is not a safe regular file.",
        ));
    }
    if metadata.len() > MAX_SOURCE_BYTES {
        return Err(packaging_error(
            "A declared build output exceeds the size limit.",
        ));
    }
    Ok(metadata.len())
}

fn collect_directory_entries(
    source_root: &Path,
) -> Result<Vec<ArchiveEntry>, ApplicationPublishError> {
    let canonical_root = source_root
        .canonicalize()
        .map_err(|_| packaging_error("A declared directory output could not be resolved."))?;
    let mut entries = Vec::new();
    let mut pending = vec![canonical_root.clone()];
    let mut total_bytes = 0u64;
    while let Some(directory) = pending.pop() {
        let mut children = fs::read_dir(&directory)
            .map_err(|_| packaging_error("A declared directory output could not be read."))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|_| packaging_error("A declared directory output could not be read."))?;
        children.sort_by_key(|entry| entry.file_name());
        for entry in children.into_iter().rev() {
            if entries.len() >= MAX_ARCHIVE_ENTRIES {
                return Err(packaging_error(
                    "A declared directory output exceeds the archive entry limit.",
                ));
            }
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path)
                .map_err(|_| packaging_error("A build output entry could not be inspected."))?;
            if metadata_is_link_like(&metadata) {
                return Err(ApplicationPublishError::new(
                    "APPLICATION_PUBLISH_LINK_REJECTED",
                    "Links and filesystem reparse points are not allowed in build outputs.",
                ));
            }
            let canonical = path
                .canonicalize()
                .map_err(|_| packaging_error("A build output entry could not be resolved."))?;
            if !canonical.starts_with(&canonical_root) {
                return Err(packaging_error(
                    "A build output entry escapes its declared output directory.",
                ));
            }
            let relative = canonical
                .strip_prefix(&canonical_root)
                .map_err(|_| packaging_error("A build output entry is outside its root."))?;
            let name = portable_archive_name(relative)?;
            if metadata.is_dir() {
                entries.push(ArchiveEntry {
                    path: canonical.clone(),
                    name,
                    size: 0,
                    is_directory: true,
                });
                pending.push(canonical);
            } else if metadata.is_file() {
                total_bytes = total_bytes.checked_add(metadata.len()).ok_or_else(|| {
                    packaging_error("The declared outputs exceed the aggregate size limit.")
                })?;
                if total_bytes > MAX_SOURCE_BYTES {
                    return Err(packaging_error(
                        "The declared outputs exceed the aggregate size limit.",
                    ));
                }
                entries.push(ArchiveEntry {
                    path: canonical,
                    name,
                    size: metadata.len(),
                    is_directory: false,
                });
            } else {
                return Err(packaging_error(
                    "A build output contains an unsupported filesystem entry.",
                ));
            }
        }
    }
    entries.sort_by(|left, right| left.name.cmp(&right.name));
    Ok(entries)
}

fn zip_entries(
    entries: &[ArchiveEntry],
    destination: &Path,
) -> Result<(), ApplicationPublishError> {
    let file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(destination)
        .map_err(|_| packaging_error("The staged archive could not be created."))?;
    let mut writer = zip::ZipWriter::new(file);
    let directory_options = SimpleFileOptions::default().unix_permissions(0o755);
    let mut buffer = vec![0u8; 64 * 1024];
    for entry in entries {
        if entry.is_directory {
            if !entry.name.is_empty() {
                writer
                    .add_directory(
                        format!("{}/", entry.name.trim_end_matches('/')),
                        directory_options,
                    )
                    .map_err(|_| {
                        packaging_error("A directory could not be added to the archive.")
                    })?;
            }
            continue;
        }
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o644)
            .large_file(entry.size > u32::MAX as u64);
        writer
            .start_file(&entry.name, options)
            .map_err(|_| packaging_error("A file could not be added to the archive."))?;
        let mut source = File::open(&entry.path)
            .map_err(|_| packaging_error("A build output file could not be opened."))?;
        loop {
            let count = source
                .read(&mut buffer)
                .map_err(|_| packaging_error("A build output file could not be read."))?;
            if count == 0 {
                break;
            }
            writer
                .write_all(&buffer[..count])
                .map_err(|_| packaging_error("A build output file could not be archived."))?;
        }
    }
    writer
        .finish()
        .map_err(|_| packaging_error("The staged archive could not be finalized."))?;
    Ok(())
}

fn zip_directory(source: &Path, destination: &Path) -> Result<(), ApplicationPublishError> {
    let metadata = fs::symlink_metadata(source)
        .map_err(|_| packaging_error("A declared directory output is missing."))?;
    if metadata_is_link_like(&metadata) || !metadata.is_dir() {
        return Err(packaging_error(
            "A declared directory output is not a safe directory.",
        ));
    }
    let entries = collect_directory_entries(source)?;
    zip_entries(&entries, destination)
}

fn zip_file(source: &Path, destination: &Path) -> Result<(), ApplicationPublishError> {
    let size = inspect_regular_file(source)?;
    let name = source
        .file_name()
        .map(PathBuf::from)
        .ok_or_else(|| packaging_error("A declared file output has no file name."))?;
    zip_entries(
        &[ArchiveEntry {
            path: source.to_path_buf(),
            name: portable_archive_name(&name)?,
            size,
            is_directory: false,
        }],
        destination,
    )
}

fn copy_file(source: &Path, destination: &Path) -> Result<(), ApplicationPublishError> {
    inspect_regular_file(source)?;
    let mut input = File::open(source)
        .map_err(|_| packaging_error("A declared file output could not be opened."))?;
    let mut output = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(destination)
        .map_err(|_| packaging_error("A staged artifact could not be created."))?;
    std::io::copy(&mut input, &mut output)
        .map_err(|_| packaging_error("A declared file output could not be staged."))?;
    output
        .sync_all()
        .map_err(|_| packaging_error("A staged artifact could not be finalized."))?;
    Ok(())
}

fn hash_artifact(path: &Path) -> Result<(u64, String), ApplicationPublishError> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|_| packaging_error("A staged artifact could not be inspected."))?;
    if metadata_is_link_like(&metadata) || !metadata.is_file() {
        return Err(packaging_error("A staged artifact is not a regular file."));
    }
    if metadata.len() > MAX_ARTIFACT_BYTES {
        return Err(packaging_error("A staged artifact exceeds the size limit."));
    }
    let mut file =
        File::open(path).map_err(|_| packaging_error("A staged artifact could not be opened."))?;
    let mut hasher = Sha256::new();
    let mut buffer = vec![0u8; 64 * 1024];
    loop {
        let count = file
            .read(&mut buffer)
            .map_err(|_| packaging_error("A staged artifact could not be hashed."))?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
    }
    Ok((
        metadata.len(),
        format!("sha256:{}", hex::encode(hasher.finalize())),
    ))
}

fn content_type(file_name: &str) -> &'static str {
    match Path::new(file_name)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "zip" => "application/zip",
        "apk" => "application/vnd.android.package-archive",
        "aab" => "application/octet-stream",
        "ipa" => "application/octet-stream",
        "wasm" => "application/wasm",
        "json" => "application/json",
        "html" => "text/html",
        _ => "application/octet-stream",
    }
}

fn package_output(
    application_root: &Path,
    staging_directory: &Path,
    target: &BuildTarget,
    output: &BuildOutput,
) -> Result<PackagedArtifact, ApplicationPublishError> {
    let source = resolve_relative_path(application_root, &output.path, true)?;
    let destination = staging_directory.join(&output.file_name);
    match (&output.output_type, output.archive.as_deref()) {
        (BuildOutputType::Directory, Some("zip")) => zip_directory(&source, &destination)?,
        (BuildOutputType::File, Some("zip")) => zip_file(&source, &destination)?,
        (BuildOutputType::File, None) => copy_file(&source, &destination)?,
        _ => {
            return Err(packaging_error(
                "The declared output packaging mode is unsupported.",
            ));
        }
    }
    let (byte_length, sha256) = hash_artifact(&destination)?;
    Ok(PackagedArtifact {
        path: destination,
        package_id: target.package_id.clone(),
        output_type: output.output_type.as_str().to_string(),
        file_name: output.file_name.clone(),
        content_type: content_type(&output.file_name).to_string(),
        byte_length,
        sha256,
    })
}

pub(crate) fn package_target_outputs(
    application_root: &Path,
    staging_directory: &Path,
    target: &BuildTarget,
) -> Result<Vec<PackagedArtifact>, ApplicationPublishError> {
    target
        .outputs
        .iter()
        .map(|output| package_output(application_root, staging_directory, target, output))
        .collect()
}

#[cfg(test)]
mod tests {
    use std::fs;

    use uuid::Uuid;

    use super::*;

    #[test]
    fn directory_output_is_archived_and_hashed() {
        let root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-publish-package-{}",
            Uuid::new_v4()
        ));
        let application = root.join("application");
        let staging = root.join("staging");
        fs::create_dir_all(application.join("dist/assets")).expect("output fixture");
        fs::create_dir_all(&staging).expect("staging fixture");
        fs::write(application.join("dist/index.html"), "fixture").expect("fixture file");
        fs::write(application.join("dist/assets/app.js"), "fixture").expect("fixture asset");
        let target = BuildTarget {
            id: "web".to_string(),
            label: "Web".to_string(),
            command: "build".to_string(),
            cwd: None,
            package_id: "web-zip".to_string(),
            platform: None,
            runtime_target: None,
            outputs: vec![BuildOutput {
                path: "dist".to_string(),
                output_type: BuildOutputType::Directory,
                archive: Some("zip".to_string()),
                file_name: "web.zip".to_string(),
            }],
        };
        let artifacts = package_target_outputs(
            &application.canonicalize().expect("application root"),
            &staging,
            &target,
        )
        .expect("package output");
        assert_eq!(artifacts.len(), 1);
        assert!(artifacts[0].byte_length > 0);
        assert!(artifacts[0].sha256.starts_with("sha256:"));
        let file = File::open(&artifacts[0].path).expect("archive file");
        let mut archive = zip::ZipArchive::new(file).expect("zip archive");
        assert!(archive.by_name("index.html").is_ok());
        assert!(archive.by_name("assets/app.js").is_ok());
        let _ = fs::remove_dir_all(root);
    }
}
