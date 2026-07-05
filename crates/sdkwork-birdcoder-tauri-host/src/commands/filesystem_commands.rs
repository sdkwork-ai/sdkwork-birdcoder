use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::UNIX_EPOCH;

const USER_HOME_CONFIG_RELATIVE_ROOT: &str = ".sdkwork/birdcoder";

/// Error type for filesystem path safety violations. Follows
/// sdkwork-specs/SECURITY_SPEC.md sandbox principles: paths that escape the
/// workspace root or traverse through symlinks must be rejected.
#[derive(Debug)]
pub enum FilesystemError {
    /// A resolved path escapes the allowed workspace root (path traversal).
    PathTraversal(String),
    /// A symlink was encountered on the mutation path and blocked for safety.
    SymlinkDetected(String),
}

impl std::fmt::Display for FilesystemError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FilesystemError::PathTraversal(path) => write!(
                f,
                "path traversal detected: resolved target escapes the workspace root: {path}"
            ),
            FilesystemError::SymlinkDetected(path) => write!(
                f,
                "symlink detected within the workspace path and blocked for safety: {path}"
            ),
        }
    }
}

impl std::error::Error for FilesystemError {}

static ALLOWED_FS_ROOTS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();

pub fn register_allowed_fs_root(path: PathBuf) -> Result<(), String> {
    let canonical = path.canonicalize().map_err(|error| {
        format!(
            "failed to canonicalize filesystem root {}: {error}",
            path.display()
        )
    })?;
    ALLOWED_FS_ROOTS
        .get_or_init(|| Mutex::new(HashSet::new()))
        .lock()
        .map_err(|_| "filesystem root registry lock poisoned".to_string())?
        .insert(canonical);
    Ok(())
}

/// Fail-closed filesystem root validation.
///
/// Follows SECURITY_SPEC.md sandbox principles: when the root registry is not
/// initialized or is empty, access is denied rather than granted. This prevents
/// a race condition where filesystem commands could execute before
/// `register_allowed_fs_root` has been called during startup.
fn is_allowed_fs_root(path: &Path) -> bool {
    let Ok(canonical) = path.canonicalize() else {
        return false;
    };
    let Some(registry) = ALLOWED_FS_ROOTS.get() else {
        return false;
    };
    let Ok(roots) = registry.lock() else {
        return false;
    };
    if roots.is_empty() {
        return false;
    }
    roots
        .iter()
        .any(|allowed| canonical == *allowed || canonical.starts_with(allowed))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemNode {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<FileSystemNode>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemSnapshotResponse {
    pub root_virtual_path: String,
    pub tree: FileSystemNode,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemDirectoryListingResponse {
    pub root_virtual_path: String,
    pub directory: FileSystemNode,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemFileRevisionProbeResponse {
    pub revision: Option<String>,
    pub missing: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

fn build_virtual_child_path(parent_path: &str, name: &str) -> String {
    if parent_path == "/" {
        format!("/{name}")
    } else {
        format!("{parent_path}/{name}")
    }
}

fn sort_file_system_nodes(nodes: &mut [FileSystemNode]) {
    nodes.sort_by(|left, right| {
        if left.kind != right.kind {
            return if left.kind == "directory" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }
        left.name.cmp(&right.name)
    });
}

fn build_directory_entry_node(
    entry_name: String,
    entry_type: &fs::FileType,
    entry_virtual_path: &str,
) -> Option<FileSystemNode> {
    if entry_type.is_dir() {
        return Some(FileSystemNode {
            name: entry_name,
            kind: "directory".to_string(),
            path: entry_virtual_path.to_string(),
            children: None,
        });
    }
    if entry_type.is_file() {
        return Some(FileSystemNode {
            name: entry_name,
            kind: "file".to_string(),
            path: entry_virtual_path.to_string(),
            children: None,
        });
    }
    None
}

fn resolve_root_directory_path(root_path: &str) -> Result<PathBuf, String> {
    let normalized_root_path = root_path.trim();
    if normalized_root_path.is_empty() {
        return Err("root path must not be empty".to_string());
    }
    let root_directory = PathBuf::from(normalized_root_path);
    if !root_directory.exists() {
        return Err(format!(
            "mounted root directory does not exist: {}",
            root_directory.display()
        ));
    }
    if !root_directory.is_dir() {
        return Err(format!(
            "mounted root path must be a directory: {}",
            root_directory.display()
        ));
    }
    let canonical_root = root_directory
        .canonicalize()
        .map_err(|error| format!("failed to canonicalize mounted root path: {error}"))?;
    if !is_allowed_fs_root(&canonical_root) {
        return Err(format!(
            "mounted root path is not registered for desktop filesystem access: {}",
            canonical_root.display()
        ));
    }
    Ok(canonical_root)
}

fn resolve_root_directory_name(root_directory: &Path) -> String {
    root_directory
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.to_string())
        .unwrap_or_else(|| "mounted-folder".to_string())
}

fn normalize_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let trimmed_relative_path = relative_path.trim();
    if trimmed_relative_path.is_empty() {
        return Err("relative path must not be empty".to_string());
    }
    let mut normalized_path = PathBuf::new();
    for component in Path::new(trimmed_relative_path).components() {
        match component {
            Component::CurDir => {}
            Component::Normal(value) => normalized_path.push(value),
            Component::ParentDir => {
                return Err("relative path must not traverse outside the mounted root".to_string())
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("relative path must stay relative to the mounted root".to_string())
            }
        }
    }
    if normalized_path.as_os_str().is_empty() {
        return Err("relative path must not be empty".to_string());
    }
    Ok(normalized_path)
}

fn build_virtual_path_from_relative(root_virtual_path: &str, relative_path: &Path) -> String {
    let normalized_root_virtual_path =
        if root_virtual_path.ends_with('/') && root_virtual_path.len() > 1 {
            &root_virtual_path[..root_virtual_path.len() - 1]
        } else {
            root_virtual_path
        };
    let mut virtual_path = normalized_root_virtual_path.to_string();
    for component in relative_path.components() {
        if let Component::Normal(value) = component {
            virtual_path.push('/');
            virtual_path.push_str(&value.to_string_lossy());
        }
    }
    virtual_path
}

fn resolve_scoped_path(root_path: &str, relative_path: &str) -> Result<PathBuf, String> {
    let root_directory = resolve_root_directory_path(root_path)?;
    let normalized_relative_path = normalize_relative_path(relative_path)?;
    Ok(root_directory.join(normalized_relative_path))
}

/// Validates that a target path stays within the allowed workspace root and
/// does not traverse through symlinks. Uses `symlink_metadata` to detect
/// symlinks on the target and `canonicalize` to resolve the real path before
/// confirming containment within `root_canonical`.
///
/// Runs inside `spawn_blocking`, so `std::fs` is used as the sync equivalent
/// of `tokio::fs::canonicalize` / `tokio::fs::symlink_metadata`.
fn validate_mutation_path(
    root_canonical: &Path,
    target_path: &Path,
) -> Result<PathBuf, FilesystemError> {
    // Reject if the target path itself is a symlink.
    if let Ok(metadata) = fs::symlink_metadata(target_path) {
        if metadata.file_type().is_symlink() {
            return Err(FilesystemError::SymlinkDetected(
                target_path.display().to_string(),
            ));
        }
    }

    // Canonicalize the target to resolve any symlinks in parent directories.
    // If the target does not exist yet (e.g. a new file), canonicalize the
    // parent directory and reattach the file name.
    let canonical_target = match target_path.canonicalize() {
        Ok(canonical) => canonical,
        Err(_) => {
            let parent = target_path.parent().ok_or_else(|| {
                FilesystemError::PathTraversal(target_path.display().to_string())
            })?;
            let canonical_parent = parent.canonicalize().map_err(|_| {
                FilesystemError::PathTraversal(target_path.display().to_string())
            })?;
            let file_name = target_path.file_name().ok_or_else(|| {
                FilesystemError::PathTraversal(target_path.display().to_string())
            })?;
            canonical_parent.join(file_name)
        }
    };

    // Ensure the canonical target is still within the workspace root.
    if !canonical_target.starts_with(root_canonical) {
        return Err(FilesystemError::PathTraversal(
            target_path.display().to_string(),
        ));
    }

    Ok(canonical_target)
}

/// Resolves a scoped path and applies symlink / path-traversal validation
/// for mutating operations (write, delete, rename).
fn resolve_and_validate_mutation_path(
    root_path: &str,
    relative_path: &str,
) -> Result<PathBuf, String> {
    let root_directory = resolve_root_directory_path(root_path)?;
    let normalized_relative_path = normalize_relative_path(relative_path)?;
    let target_path = root_directory.join(&normalized_relative_path);
    validate_mutation_path(&root_directory, &target_path).map_err(|error| error.to_string())
}

fn resolve_user_home_config_path(relative_path: &str) -> Result<PathBuf, String> {
    let normalized_relative_path = normalize_relative_path(relative_path)?;
    if !normalized_relative_path.starts_with(USER_HOME_CONFIG_RELATIVE_ROOT) {
        return Err(format!(
            "user home config path must stay under {USER_HOME_CONFIG_RELATIVE_ROOT}"
        ));
    }
    if normalized_relative_path == Path::new(USER_HOME_CONFIG_RELATIVE_ROOT) {
        return Err(format!(
            "user home config path must target a file under {USER_HOME_CONFIG_RELATIVE_ROOT}"
        ));
    }
    let home_directory = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .ok_or_else(|| "failed to resolve user home directory".to_string())?;
    Ok(home_directory.join(normalized_relative_path))
}

fn build_directory_listing(
    directory_path: &Path,
    virtual_path: &str,
) -> Result<FileSystemNode, String> {
    let mut children = Vec::new();
    let entries = fs::read_dir(directory_path).map_err(|error| {
        format!(
            "failed to enumerate directory '{}': {error}",
            directory_path.display()
        )
    })?;
    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "failed to inspect directory entry '{}': {error}",
                directory_path.display()
            )
        })?;
        let entry_name = entry.file_name().to_string_lossy().to_string();
        let entry_type = entry.file_type().map_err(|error| {
            format!(
                "failed to inspect entry type '{}': {error}",
                entry.path().display()
            )
        })?;
        let child_virtual_path = build_virtual_child_path(virtual_path, &entry_name);
        if let Some(child) =
            build_directory_entry_node(entry_name, &entry_type, &child_virtual_path)
        {
            children.push(child);
        }
    }
    sort_file_system_nodes(&mut children);
    Ok(FileSystemNode {
        name: resolve_root_directory_name(directory_path),
        kind: "directory".to_string(),
        path: virtual_path.to_string(),
        children: Some(children),
    })
}

/// Maximum recursion depth for directory snapshots. Prevents stack overflow
/// from deeply nested directories or symlink loops.
const MAX_DIRECTORY_SNAPSHOT_DEPTH: usize = 10;

fn build_directory_snapshot(
    directory_path: &Path,
    virtual_path: &str,
    depth: usize,
) -> Result<FileSystemNode, String> {
    let mut children = Vec::new();
    let entries = fs::read_dir(directory_path).map_err(|error| {
        format!(
            "failed to enumerate directory '{}': {error}",
            directory_path.display()
        )
    })?;
    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "failed to inspect directory entry '{}': {error}",
                directory_path.display()
            )
        })?;
        let entry_path = entry.path();
        let entry_name = entry.file_name().to_string_lossy().to_string();
        let entry_type = entry.file_type().map_err(|error| {
            format!(
                "failed to inspect entry type '{}': {error}",
                entry_path.display()
            )
        })?;
        let child_virtual_path = build_virtual_child_path(virtual_path, &entry_name);
        if entry_type.is_dir() {
            // Stop recursing when the maximum depth is reached. The directory
            // node is included with `children: None` to signal truncation.
            if depth + 1 < MAX_DIRECTORY_SNAPSHOT_DEPTH {
                children.push(build_directory_snapshot(
                    &entry_path,
                    &child_virtual_path,
                    depth + 1,
                )?);
            } else {
                children.push(FileSystemNode {
                    name: entry_name,
                    kind: "directory".to_string(),
                    path: child_virtual_path,
                    children: None,
                });
            }
        } else if entry_type.is_file() {
            children.push(FileSystemNode {
                name: entry_name,
                kind: "file".to_string(),
                path: child_virtual_path,
                children: None,
            });
        }
    }
    sort_file_system_nodes(&mut children);
    Ok(FileSystemNode {
        name: resolve_root_directory_name(directory_path),
        kind: "directory".to_string(),
        path: virtual_path.to_string(),
        children: Some(children),
    })
}

fn read_mounted_file_to_string(
    file_path: &Path,
    max_bytes: Option<usize>,
) -> Result<String, String> {
    use std::io::Read;
    if let Some(max_bytes) = max_bytes.filter(|value| *value > 0) {
        let file = fs::File::open(file_path).map_err(|error| {
            format!(
                "failed to open mounted file '{}': {error}",
                file_path.display()
            )
        })?;
        let mut buffer = Vec::with_capacity(max_bytes.min(64 * 1024));
        file.take(max_bytes as u64)
            .read_to_end(&mut buffer)
            .map_err(|error| {
                format!(
                    "failed to read mounted file prefix '{}': {error}",
                    file_path.display()
                )
            })?;
        return Ok(String::from_utf8_lossy(&buffer).into_owned());
    }
    fs::read_to_string(file_path).map_err(|error| {
        format!(
            "failed to read mounted file '{}': {error}",
            file_path.display()
        )
    })
}

fn build_entry_revision(metadata: &fs::Metadata) -> Result<String, String> {
    let modified_nanos = metadata
        .modified()
        .map_err(|error| format!("failed to inspect mounted file modified time: {error}"))?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("mounted file modified time is before unix epoch: {error}"))?
        .as_nanos();
    Ok(format!("{}:{}", modified_nanos, metadata.len()))
}

#[tauri::command]
pub async fn fs_snapshot_folder(
    root_path: String,
) -> Result<FileSystemSnapshotResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root_directory = resolve_root_directory_path(&root_path)?;
        let root_virtual_path = format!("/{}", resolve_root_directory_name(&root_directory));
        let tree = build_directory_snapshot(&root_directory, &root_virtual_path, 0)?;
        Ok(FileSystemSnapshotResponse {
            root_virtual_path,
            tree,
        })
    })
    .await
    .map_err(|error| format!("failed to join folder snapshot task: {error}"))?
}

#[tauri::command]
pub async fn fs_list_directory(
    root_path: String,
    relative_path: Option<String>,
) -> Result<FileSystemDirectoryListingResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root_directory = resolve_root_directory_path(&root_path)?;
        let root_virtual_path = format!("/{}", resolve_root_directory_name(&root_directory));
        let target_relative_path = relative_path
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(normalize_relative_path)
            .transpose()?;
        let target_directory = if let Some(ref normalized_relative_path) = target_relative_path {
            root_directory.join(normalized_relative_path)
        } else {
            root_directory.clone()
        };
        if !target_directory.exists() {
            return Err(format!(
                "mounted directory does not exist: {}",
                target_directory.display()
            ));
        }
        if !target_directory.is_dir() {
            return Err(format!(
                "mounted path must be a directory: {}",
                target_directory.display()
            ));
        }
        let directory_virtual_path =
            if let Some(ref normalized_relative_path) = target_relative_path {
                build_virtual_path_from_relative(&root_virtual_path, normalized_relative_path)
            } else {
                root_virtual_path.clone()
            };
        let directory = build_directory_listing(&target_directory, &directory_virtual_path)?;
        Ok(FileSystemDirectoryListingResponse {
            root_virtual_path,
            directory,
        })
    })
    .await
    .map_err(|error| format!("failed to join directory listing task: {error}"))?
}

#[tauri::command]
pub async fn fs_read_file(
    root_path: String,
    relative_path: String,
    max_bytes: Option<usize>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_scoped_path(&root_path, &relative_path)?;
        read_mounted_file_to_string(&file_path, max_bytes)
    })
    .await
    .map_err(|error| format!("failed to join mounted file read task: {error}"))?
}

#[tauri::command]
pub async fn fs_get_file_revision(
    root_path: String,
    relative_path: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_scoped_path(&root_path, &relative_path)?;
        let metadata = fs::metadata(&file_path).map_err(|error| {
            format!(
                "failed to inspect mounted file '{}': {error}",
                file_path.display()
            )
        })?;
        if !metadata.is_file() {
            return Err(format!(
                "mounted path must be a file: {}",
                file_path.display()
            ));
        }
        build_entry_revision(&metadata)
    })
    .await
    .map_err(|error| format!("failed to join mounted file revision task: {error}"))?
}

#[tauri::command]
pub async fn fs_get_file_revisions(
    root_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<FileSystemFileRevisionProbeResponse>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut probes = Vec::with_capacity(relative_paths.len());
        for relative_path in relative_paths {
            let file_path = match resolve_scoped_path(&root_path, &relative_path) {
                Ok(file_path) => file_path,
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(error),
                    });
                    continue;
                }
            };
            let metadata = match fs::metadata(&file_path) {
                Ok(metadata) => metadata,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: true,
                        error: None,
                    });
                    continue;
                }
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(format!(
                            "failed to inspect mounted file '{}': {error}",
                            file_path.display()
                        )),
                    });
                    continue;
                }
            };
            if !metadata.is_file() {
                probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(format!(
                        "mounted path must be a file: {}",
                        file_path.display()
                    )),
                });
                continue;
            }
            match build_entry_revision(&metadata) {
                Ok(revision) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: Some(revision),
                    missing: false,
                    error: None,
                }),
                Err(error) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(error),
                }),
            }
        }
        Ok(probes)
    })
    .await
    .map_err(|error| format!("failed to join mounted file revisions task: {error}"))?
}

#[tauri::command]
pub async fn fs_get_directory_revisions(
    root_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<FileSystemFileRevisionProbeResponse>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut probes = Vec::with_capacity(relative_paths.len());
        for relative_path in relative_paths {
            let directory_path = match resolve_scoped_path(&root_path, &relative_path) {
                Ok(path) => path,
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(error),
                    });
                    continue;
                }
            };
            let metadata = match fs::metadata(&directory_path) {
                Ok(metadata) => metadata,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: true,
                        error: None,
                    });
                    continue;
                }
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(format!(
                            "failed to inspect mounted directory '{}': {error}",
                            directory_path.display()
                        )),
                    });
                    continue;
                }
            };
            if !metadata.is_dir() {
                probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(format!(
                        "mounted path must be a directory: {}",
                        directory_path.display()
                    )),
                });
                continue;
            }
            match build_entry_revision(&metadata) {
                Ok(revision) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: Some(revision),
                    missing: false,
                    error: None,
                }),
                Err(error) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(error),
                }),
            }
        }
        Ok(probes)
    })
    .await
    .map_err(|error| format!("failed to join mounted directory revisions task: {error}"))?
}

#[tauri::command]
pub async fn fs_write_file(
    root_path: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_and_validate_mutation_path(&root_path, &relative_path)?;
        fs::write(&file_path, content).map_err(|error| {
            format!(
                "failed to write mounted file '{}': {error}",
                file_path.display()
            )
        })
    })
    .await
    .map_err(|error| format!("failed to join mounted file write task: {error}"))?
}

#[tauri::command]
pub async fn fs_create_file(
    root_path: String,
    relative_path: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_scoped_path(&root_path, &relative_path)?;
        if file_path.exists() {
            if file_path.is_file() {
                return Ok(());
            }
            return Err(format!(
                "cannot create file because a directory already exists at '{}'",
                file_path.display()
            ));
        }
        let parent_directory = file_path.parent().ok_or_else(|| {
            format!(
                "cannot create mounted file without a parent directory: {}",
                file_path.display()
            )
        })?;
        if !parent_directory.exists() {
            return Err(format!(
                "parent directory does not exist for mounted file '{}'",
                file_path.display()
            ));
        }
        fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(false)
            .open(&file_path)
            .map_err(|error| {
                format!(
                    "failed to create mounted file '{}': {error}",
                    file_path.display()
                )
            })?;
        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted file create task: {error}"))?
}

#[tauri::command]
pub async fn fs_create_directory(
    root_path: String,
    relative_path: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory_path = resolve_scoped_path(&root_path, &relative_path)?;
        if directory_path.exists() {
            if directory_path.is_dir() {
                return Ok(());
            }
            return Err(format!(
                "cannot create directory because a file already exists at '{}'",
                directory_path.display()
            ));
        }
        let parent_directory = directory_path.parent().ok_or_else(|| {
            format!(
                "cannot create mounted directory without a parent directory: {}",
                directory_path.display()
            )
        })?;
        if !parent_directory.exists() {
            return Err(format!(
                "parent directory does not exist for mounted directory '{}'",
                directory_path.display()
            ));
        }
        fs::create_dir(&directory_path).map_err(|error| {
            format!(
                "failed to create mounted directory '{}': {error}",
                directory_path.display()
            )
        })?;
        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted directory create task: {error}"))?
}

#[tauri::command]
pub async fn fs_delete_entry(
    root_path: String,
    relative_path: String,
    recursive: bool,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry_path = resolve_and_validate_mutation_path(&root_path, &relative_path)?;
        let metadata = fs::metadata(&entry_path).map_err(|error| {
            format!(
                "failed to inspect mounted entry '{}': {error}",
                entry_path.display()
            )
        })?;
        if metadata.is_dir() {
            if recursive {
                fs::remove_dir_all(&entry_path).map_err(|error| {
                    format!(
                        "failed to delete mounted directory '{}': {error}",
                        entry_path.display()
                    )
                })?;
            } else {
                fs::remove_dir(&entry_path).map_err(|error| {
                    format!(
                        "failed to delete mounted directory '{}': {error}",
                        entry_path.display()
                    )
                })?;
            }
        } else {
            fs::remove_file(&entry_path).map_err(|error| {
                format!(
                    "failed to delete mounted file '{}': {error}",
                    entry_path.display()
                )
            })?;
        }
        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted entry delete task: {error}"))?
}

#[tauri::command]
pub async fn fs_rename_entry(
    root_path: String,
    old_relative_path: String,
    new_relative_path: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let old_path = resolve_and_validate_mutation_path(&root_path, &old_relative_path)?;
        let new_path = resolve_and_validate_mutation_path(&root_path, &new_relative_path)?;
        let new_parent_directory = new_path.parent().ok_or_else(|| {
            format!(
                "cannot rename mounted entry without a destination parent directory: {}",
                new_path.display()
            )
        })?;
        if !new_parent_directory.exists() {
            return Err(format!(
                "destination parent directory does not exist for mounted entry '{}'",
                new_path.display()
            ));
        }
        fs::rename(&old_path, &new_path).map_err(|error| {
            format!(
                "failed to rename mounted entry '{}' to '{}': {error}",
                old_path.display(),
                new_path.display()
            )
        })?;
        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted entry rename task: {error}"))?
}

#[tauri::command]
pub async fn user_home_config_read(
    relative_path: String,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = resolve_user_home_config_path(&relative_path)?;
        if !path.exists() {
            return Ok(None);
        }
        if !path.is_file() {
            return Err(format!(
                "user home config path is not a file: {}",
                path.display()
            ));
        }
        fs::read_to_string(&path).map(Some).map_err(|error| {
            format!(
                "failed to read user home config {}: {error}",
                path.display()
            )
        })
    })
    .await
    .map_err(|error| format!("failed to join user home config read task: {error}"))?
}

#[tauri::command]
pub async fn user_home_config_write(
    relative_path: String,
    content: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = resolve_user_home_config_path(&relative_path)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "failed to create user home config directory {}: {error}",
                    parent.display()
                )
            })?;
        }
        fs::write(&path, content).map_err(|error| {
            format!(
                "failed to write user home config {}: {error}",
                path.display()
            )
        })
    })
    .await
    .map_err(|error| format!("failed to join user home config write task: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn user_home_config_path_is_scoped_to_birdcoder_config_root() {
        let resolved_path = resolve_user_home_config_path(
            ".sdkwork/birdcoder/code-engine-models.json",
        )
        .expect("canonical code-engine model config path should be allowed");

        assert!(resolved_path.ends_with(".sdkwork/birdcoder/code-engine-models.json"));
        assert!(resolve_user_home_config_path(".ssh/config").is_err());
    }
}
