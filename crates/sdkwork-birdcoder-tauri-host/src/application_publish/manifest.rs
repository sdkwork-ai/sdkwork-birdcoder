use std::collections::HashSet;
use std::fs;
use std::path::Path;

use serde_json::Value;
use sha2::{Digest, Sha256};

use super::types::{ApplicationPublishOutputSnapshot, ApplicationPublishTargetSnapshot};

pub(crate) const APPLICATION_MANIFEST_FILE_NAME: &str = "sdkwork.app.config.json";
const MAX_MANIFEST_BYTES: u64 = 2 * 1024 * 1024;
const MAX_COMMAND_BYTES: usize = 8 * 1024;
const MAX_TARGET_OUTPUTS: usize = 32;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum BuildOutputType {
    File,
    Directory,
}

impl BuildOutputType {
    pub(crate) fn as_str(&self) -> &'static str {
        match self {
            Self::File => "file",
            Self::Directory => "directory",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BuildOutput {
    pub(crate) path: String,
    pub(crate) output_type: BuildOutputType,
    pub(crate) archive: Option<String>,
    pub(crate) file_name: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BuildTarget {
    pub(crate) id: String,
    pub(crate) label: String,
    pub(crate) command: String,
    pub(crate) cwd: Option<String>,
    pub(crate) package_id: String,
    pub(crate) platform: Option<String>,
    pub(crate) runtime_target: Option<String>,
    pub(crate) outputs: Vec<BuildOutput>,
}

#[derive(Debug, Clone)]
pub(crate) struct BuildTargetCandidate {
    pub(crate) target: Option<BuildTarget>,
    pub(crate) snapshot: ApplicationPublishTargetSnapshot,
}

#[derive(Debug, Clone)]
pub(crate) struct ApplicationManifest {
    pub(crate) digest: String,
    pub(crate) app_key: Option<String>,
    pub(crate) name: Option<String>,
    pub(crate) app_type: Option<String>,
    pub(crate) framework: Option<String>,
    pub(crate) targets: Vec<BuildTargetCandidate>,
    pub(crate) issues: Vec<String>,
}

impl ApplicationManifest {
    pub(crate) fn find_ready_target(&self, target_id: &str) -> Option<&BuildTarget> {
        self.targets.iter().find_map(|candidate| {
            candidate
                .target
                .as_ref()
                .filter(|target| target.id == target_id)
        })
    }
}

fn read_non_empty_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

/// Whether a manifest build command is safe to execute with a structured
/// argument vector (never through a shell). The command must be a plain
/// executable plus space-separated arguments: no shell operators, pipes,
/// redirection, command substitution, environment assignment, or quote
/// characters that a `sh -c` / `cmd /C` layer would interpret. This keeps a
/// renderer-controlled `sdkwork.app.config.json` from escalating to arbitrary
/// shell execution.
fn is_safe_manifest_command(value: &str) -> bool {
    if value.trim() != value || value.is_empty() {
        return false;
    }
    let mut tokens = value.split_whitespace();
    let executable = tokens.next().unwrap_or_default();
    // The executable itself must not look like an option or a shell word.
    if executable.starts_with('-') {
        return false;
    }
    for token in std::iter::once(executable).chain(tokens) {
        if token
            .bytes()
            .any(|byte| !(byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'/' | b'\\' | b':' | b'=' | b'@' | b'+' | b',')))
        {
            return false;
        }
    }
    true
}

fn is_stable_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 128
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
}

fn is_application_key(value: &str) -> bool {
    is_stable_identifier(value)
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        && !value.starts_with('-')
        && !value.ends_with('-')
        && !value.contains("--")
}

fn is_safe_file_name(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 255
        && value != "."
        && value != ".."
        && super::path_safety::is_portable_component(value)
}

fn parse_output(
    value: &Value,
    target_index: usize,
    output_index: usize,
) -> (
    Option<BuildOutput>,
    ApplicationPublishOutputSnapshot,
    Vec<String>,
) {
    let mut issues = Vec::new();
    let Some(output) = value.as_object() else {
        issues.push(format!(
            "Target {} output {} must be a typed object.",
            target_index + 1,
            output_index + 1
        ));
        return (
            None,
            ApplicationPublishOutputSnapshot {
                path: String::new(),
                output_type: "invalid".to_string(),
                archive: None,
                file_name: String::new(),
            },
            issues,
        );
    };

    let path = read_non_empty_string(output.get("path"));
    if path.is_none() {
        issues.push(format!(
            "Target {} output {} requires a relative path.",
            target_index + 1,
            output_index + 1
        ));
    } else if path
        .as_deref()
        .is_some_and(|path| super::path_safety::normalize_relative_path(path, false).is_err())
    {
        issues.push(format!(
            "Target {} output {} path must stay within the application root.",
            target_index + 1,
            output_index + 1
        ));
    }
    let output_type_value = read_non_empty_string(output.get("type"));
    let output_type = match output_type_value.as_deref() {
        Some("file") => Some(BuildOutputType::File),
        Some("directory") => Some(BuildOutputType::Directory),
        _ => {
            issues.push(format!(
                "Target {} output {} type must be file or directory.",
                target_index + 1,
                output_index + 1
            ));
            None
        }
    };
    let archive = read_non_empty_string(output.get("archive"));
    if matches!(output_type, Some(BuildOutputType::Directory)) && archive.as_deref() != Some("zip")
    {
        issues.push(format!(
            "Target {} output {} must explicitly use archive zip for a directory.",
            target_index + 1,
            output_index + 1
        ));
    }
    if archive.as_deref().is_some_and(|value| value != "zip") {
        issues.push(format!(
            "Target {} output {} uses an unsupported archive format.",
            target_index + 1,
            output_index + 1
        ));
    }
    let file_name = read_non_empty_string(output.get("fileName"));
    if !file_name.as_deref().is_some_and(is_safe_file_name) {
        issues.push(format!(
            "Target {} output {} requires a safe fileName.",
            target_index + 1,
            output_index + 1
        ));
    } else if archive.as_deref() == Some("zip")
        && !file_name
            .as_deref()
            .is_some_and(|value| value.to_ascii_lowercase().ends_with(".zip"))
    {
        issues.push(format!(
            "Target {} output {} ZIP archive fileName must end with .zip.",
            target_index + 1,
            output_index + 1
        ));
    }

    let snapshot = ApplicationPublishOutputSnapshot {
        path: path.clone().unwrap_or_default(),
        output_type: output_type_value.unwrap_or_else(|| "invalid".to_string()),
        archive: archive.clone(),
        file_name: file_name.clone().unwrap_or_default(),
    };
    let parsed = if issues.is_empty() {
        Some(BuildOutput {
            path: path.expect("validated output path"),
            output_type: output_type.expect("validated output type"),
            archive,
            file_name: file_name.expect("validated output file name"),
        })
    } else {
        None
    };
    (parsed, snapshot, issues)
}

fn parse_target(value: &Value, index: usize) -> BuildTargetCandidate {
    let mut issues = Vec::new();
    let Some(target) = value.as_object() else {
        issues.push(format!("Target {} must be an object.", index + 1));
        return BuildTargetCandidate {
            target: None,
            snapshot: ApplicationPublishTargetSnapshot {
                id: format!("invalid-target-{}", index + 1),
                label: format!("Target {}", index + 1),
                command: None,
                cwd: None,
                package_id: None,
                platform: None,
                runtime_target: None,
                outputs: Vec::new(),
                ready: false,
                issues,
            },
        };
    };

    let id = read_non_empty_string(target.get("id"));
    if !id.as_deref().is_some_and(is_stable_identifier) {
        issues.push(format!("Target {} requires a stable id.", index + 1));
    }
    let command = read_non_empty_string(target.get("command"));
    if !command.as_deref().is_some_and(|value| {
        value.len() <= MAX_COMMAND_BYTES
            && !value.contains('\0')
            && !value.contains('\r')
            && !value.contains('\n')
            && is_safe_manifest_command(value)
    }) {
        issues.push(format!(
            "Target {} requires an explicit command.",
            index + 1
        ));
    }
    let cwd = match target.get("cwd") {
        None | Some(Value::Null) => None,
        Some(value) => match read_non_empty_string(Some(value)) {
            Some(value) if super::path_safety::normalize_relative_path(&value, true).is_ok() => {
                Some(value)
            }
            None => {
                issues.push(format!("Target {} cwd must be a relative path.", index + 1));
                None
            }
            Some(_) => {
                issues.push(format!(
                    "Target {} cwd must stay within the application root.",
                    index + 1
                ));
                None
            }
        },
    };
    let package_id = read_non_empty_string(target.get("packageId"));
    if !package_id.as_deref().is_some_and(is_stable_identifier) {
        issues.push(format!("Target {} requires a packageId.", index + 1));
    }

    let mut outputs = Vec::new();
    let mut output_snapshots = Vec::new();
    match target.get("outputs").and_then(Value::as_array) {
        Some(values) if !values.is_empty() => {
            if values.len() > MAX_TARGET_OUTPUTS {
                issues.push(format!(
                    "Target {} exceeds the {} output limit.",
                    index + 1,
                    MAX_TARGET_OUTPUTS
                ));
            }
            for (output_index, value) in values.iter().take(MAX_TARGET_OUTPUTS).enumerate() {
                let (output, snapshot, output_issues) = parse_output(value, index, output_index);
                if let Some(output) = output {
                    outputs.push(output);
                }
                output_snapshots.push(snapshot);
                issues.extend(output_issues);
            }
        }
        _ => issues.push(format!(
            "Target {} requires at least one typed output.",
            index + 1
        )),
    }
    let mut file_names = HashSet::new();
    if outputs
        .iter()
        .any(|output| !file_names.insert(output.file_name.to_ascii_lowercase()))
    {
        issues.push(format!(
            "Target {} output fileName values must be unique.",
            index + 1
        ));
    }

    let platform = read_non_empty_string(target.get("platform"));
    let runtime_target = read_non_empty_string(target.get("runtimeTarget"));
    let label = read_non_empty_string(target.get("label"))
        .or_else(|| read_non_empty_string(target.get("name")))
        .or_else(|| id.clone())
        .unwrap_or_else(|| format!("Target {}", index + 1));
    let snapshot = ApplicationPublishTargetSnapshot {
        id: id
            .clone()
            .unwrap_or_else(|| format!("invalid-target-{}", index + 1)),
        label,
        command: command.clone(),
        cwd: cwd.clone(),
        package_id: package_id.clone(),
        platform: platform.clone(),
        runtime_target: runtime_target.clone(),
        outputs: output_snapshots,
        ready: issues.is_empty(),
        issues: issues.clone(),
    };
    let parsed = if issues.is_empty() {
        Some(BuildTarget {
            id: id.expect("validated target id"),
            label: snapshot.label.clone(),
            command: command.expect("validated target command"),
            cwd,
            package_id: package_id.expect("validated target package id"),
            platform,
            runtime_target,
            outputs,
        })
    } else {
        None
    };
    BuildTargetCandidate {
        target: parsed,
        snapshot,
    }
}

pub(crate) fn read_application_manifest(
    app_root: &Path,
) -> Result<Option<ApplicationManifest>, String> {
    let manifest_path = app_root.join(APPLICATION_MANIFEST_FILE_NAME);
    if !manifest_path.exists() {
        return Ok(None);
    }
    let metadata = fs::symlink_metadata(&manifest_path)
        .map_err(|_| "application manifest could not be inspected".to_string())?;
    if super::path_safety::metadata_is_link_like(&metadata) || !metadata.is_file() {
        return Err("application manifest must be a regular file".to_string());
    }
    if metadata.len() > MAX_MANIFEST_BYTES {
        return Err("application manifest exceeds the size limit".to_string());
    }
    let raw = fs::read(&manifest_path)
        .map_err(|_| "application manifest could not be read".to_string())?;
    let value = serde_json::from_slice::<Value>(&raw)
        .map_err(|_| "application manifest is not valid JSON".to_string())?;
    let digest = format!("sha256:{}", hex::encode(Sha256::digest(&raw)));
    let mut issues = Vec::new();
    if value.get("schemaVersion").and_then(Value::as_u64) != Some(3) {
        issues.push("Manifest schemaVersion must be 3.".to_string());
    }
    if read_non_empty_string(value.get("kind")).as_deref() != Some("sdkwork.app") {
        issues.push("Manifest kind must be sdkwork.app.".to_string());
    }

    let app = value.get("app");
    let app_key = read_non_empty_string(app.and_then(|value| value.get("key")));
    if !app_key.as_deref().is_some_and(is_application_key) {
        issues.push("Manifest app.key must be an immutable lower kebab-case key.".to_string());
    }
    let name = read_non_empty_string(app.and_then(|value| value.get("displayName")))
        .or_else(|| read_non_empty_string(app.and_then(|value| value.get("name"))))
        .or_else(|| read_non_empty_string(app.and_then(|value| value.get("key"))));
    let app_type = read_non_empty_string(app.and_then(|value| value.get("appType")));
    let framework = read_non_empty_string(
        value
            .get("runtime")
            .and_then(|runtime| runtime.get("framework")),
    )
    .or_else(|| {
        read_non_empty_string(
            value
                .get("publish")
                .and_then(|publish| publish.get("config"))
                .and_then(|config| config.get("framework")),
        )
    });

    let mut targets = Vec::new();
    match value
        .get("devApp")
        .and_then(|dev_app| dev_app.get("build"))
        .and_then(|build| build.get("targets"))
        .and_then(Value::as_array)
    {
        Some(values) if !values.is_empty() => {
            targets.extend(
                values
                    .iter()
                    .enumerate()
                    .map(|(index, value)| parse_target(value, index)),
            );
        }
        _ => issues.push("Manifest requires devApp.build.targets[].".to_string()),
    }
    let mut target_ids = HashSet::new();
    let mut duplicate_target_ids = HashSet::new();
    for candidate in &targets {
        if !target_ids.insert(candidate.snapshot.id.clone()) {
            duplicate_target_ids.insert(candidate.snapshot.id.clone());
        }
    }
    for candidate in &mut targets {
        if duplicate_target_ids.contains(&candidate.snapshot.id) {
            candidate.snapshot.ready = false;
            candidate
                .snapshot
                .issues
                .push("Target id values must be unique.".to_string());
            candidate.target = None;
        }
    }

    Ok(Some(ApplicationManifest {
        digest,
        app_key,
        name,
        app_type,
        framework,
        targets,
        issues,
    }))
}

pub(crate) fn target_snapshot(target: &BuildTarget) -> ApplicationPublishTargetSnapshot {
    ApplicationPublishTargetSnapshot {
        id: target.id.clone(),
        label: target.label.clone(),
        command: Some(target.command.clone()),
        cwd: target.cwd.clone(),
        package_id: Some(target.package_id.clone()),
        platform: target.platform.clone(),
        runtime_target: target.runtime_target.clone(),
        outputs: target
            .outputs
            .iter()
            .map(|output| ApplicationPublishOutputSnapshot {
                path: output.path.clone(),
                output_type: output.output_type.as_str().to_string(),
                archive: output.archive.clone(),
                file_name: output.file_name.clone(),
            })
            .collect(),
        ready: true,
        issues: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use std::fs;

    use uuid::Uuid;

    use super::*;

    fn fixture_root() -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-publish-manifest-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("manifest fixture root");
        root
    }

    #[test]
    fn application_key_requires_lower_kebab_case() {
        assert!(is_application_key("fixture-web-2"));
        for invalid in [
            "FixtureWeb",
            "fixture_web",
            "-fixture",
            "fixture-",
            "fixture--web",
        ] {
            assert!(
                !is_application_key(invalid),
                "unexpected valid key {invalid}"
            );
        }
    }

    #[test]
    fn artifact_file_names_are_portable_and_match_zip_content() {
        assert!(is_safe_file_name("birdcoder-web.zip"));
        for invalid in [
            "CON",
            "nul.zip",
            "app?.zip",
            "app:release.zip",
            "trailing.",
            "trailing ",
        ] {
            assert!(
                !is_safe_file_name(invalid),
                "unexpected safe file name {invalid}"
            );
        }

        let (_, _, issues) = parse_output(
            &serde_json::json!({
                "path": "dist",
                "type": "directory",
                "archive": "zip",
                "fileName": "application.apk"
            }),
            0,
            0,
        );
        assert!(issues.iter().any(|issue| issue.contains("end with .zip")));

        let candidate = parse_target(
            &serde_json::json!({
                "id": "web",
                "command": "build",
                "packageId": "web",
                "outputs": [
                    {"path": "dist-a", "type": "directory", "archive": "zip", "fileName": "Web.zip"},
                    {"path": "dist-b", "type": "directory", "archive": "zip", "fileName": "web.zip"}
                ]
            }),
            0,
        );
        assert!(candidate.target.is_none());
        assert!(candidate
            .snapshot
            .issues
            .iter()
            .any(|issue| issue.contains("fileName values must be unique")));
    }

    #[test]
    fn unsafe_target_paths_are_never_publish_ready() {
        let candidate = parse_target(
            &serde_json::json!({
                "id": "web",
                "command": "build\nsecond-command",
                "cwd": "../outside",
                "packageId": "web",
                "outputs": [{
                    "path": "../dist",
                    "type": "directory",
                    "archive": "zip",
                    "fileName": "web.zip"
                }]
            }),
            0,
        );
        assert!(candidate.target.is_none());
        assert!(!candidate.snapshot.ready);
        assert!(candidate
            .snapshot
            .issues
            .iter()
            .any(|issue| issue.contains("application root")));
    }

    #[test]
    fn typed_target_is_ready_and_legacy_output_requires_setup() {
        let root = fixture_root();
        fs::write(
            root.join(APPLICATION_MANIFEST_FILE_NAME),
            r#"{
              "schemaVersion":3,
              "kind":"sdkwork.app",
              "app":{"key":"fixture","name":"Fixture","appType":"APP_REACT"},
              "runtime":{"framework":"react"},
              "devApp":{"build":{"targets":[
                {"id":"web-production","label":"Production web","command":"pnpm build","cwd":".","packageId":"web-zip","outputs":[{"path":"dist","type":"directory","archive":"zip","fileName":"web.zip"}]},
                {"id":"legacy","command":"pnpm build","outputs":["dist"]}
              ]}}
            }"#,
        )
        .expect("manifest fixture");

        let manifest = read_application_manifest(&root)
            .expect("manifest parse")
            .expect("manifest exists");
        assert!(manifest.issues.is_empty());
        assert_eq!(manifest.app_key.as_deref(), Some("fixture"));
        assert!(manifest.find_ready_target("web-production").is_some());
        assert_eq!(manifest.targets[0].snapshot.label, "Production web");
        assert_eq!(
            manifest.targets[0].snapshot.command.as_deref(),
            Some("pnpm build")
        );
        assert_eq!(manifest.targets[0].snapshot.cwd.as_deref(), Some("."));
        assert!(manifest.find_ready_target("legacy").is_none());
        assert!(!manifest.targets[1].snapshot.ready);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn manifest_without_v3_schema_requires_setup() {
        let root = fixture_root();
        fs::write(
            root.join(APPLICATION_MANIFEST_FILE_NAME),
            r#"{"kind":"sdkwork.app","app":{"key":"fixture"},"devApp":{"build":{"targets":[{"id":"web","command":"build","packageId":"web","outputs":[{"path":"dist","type":"directory","archive":"zip","fileName":"web.zip"}]}]}}}"#,
        )
        .expect("manifest fixture");

        let manifest = read_application_manifest(&root)
            .expect("manifest parse")
            .expect("manifest exists");
        assert!(manifest
            .issues
            .iter()
            .any(|issue| issue.contains("schemaVersion")));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn directory_output_requires_explicit_zip_archive() {
        let root = fixture_root();
        fs::write(
            root.join(APPLICATION_MANIFEST_FILE_NAME),
            r#"{"schemaVersion":3,"kind":"sdkwork.app","app":{"key":"fixture"},"devApp":{"build":{"targets":[{"id":"web","command":"build","packageId":"web","outputs":[{"path":"dist","type":"directory","fileName":"web.zip"}]}]}}}"#,
        )
        .expect("manifest fixture");
        let manifest = read_application_manifest(&root)
            .expect("manifest parse")
            .expect("manifest exists");
        assert!(!manifest.targets[0].snapshot.ready);
        assert!(manifest.targets[0]
            .snapshot
            .issues
            .iter()
            .any(|issue| issue.contains("archive zip")));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn duplicate_target_ids_invalidate_every_ambiguous_target() {
        let root = fixture_root();
        fs::write(
            root.join(APPLICATION_MANIFEST_FILE_NAME),
            r#"{
              "schemaVersion":3,
              "kind":"sdkwork.app",
              "app":{"key":"fixture"},
              "devApp":{"build":{"targets":[
                {"id":"web","command":"build-a","packageId":"web-a","outputs":[{"path":"dist-a","type":"directory","archive":"zip","fileName":"a.zip"}]},
                {"id":"web","command":"build-b","packageId":"web-b","outputs":[{"path":"dist-b","type":"directory","archive":"zip","fileName":"b.zip"}]}
              ]}}
            }"#,
        )
        .expect("manifest fixture");

        let manifest = read_application_manifest(&root)
            .expect("manifest parse")
            .expect("manifest exists");
        assert!(manifest.find_ready_target("web").is_none());
        assert!(manifest
            .targets
            .iter()
            .all(|candidate| !candidate.snapshot.ready && candidate.target.is_none()));
        assert!(manifest.targets.iter().all(|candidate| candidate
            .snapshot
            .issues
            .iter()
            .any(|issue| issue.contains("unique"))));

        let _ = fs::remove_dir_all(root);
    }
}
