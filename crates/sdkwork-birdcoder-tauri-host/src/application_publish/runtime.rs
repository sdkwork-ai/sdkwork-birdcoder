use std::fs::{self, File};
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::time::Instant;

use tokio::io::{AsyncRead, AsyncReadExt};
use tokio::process::Command;
use tokio::time::{timeout, Duration};
use uuid::Uuid;

use super::discovery::inspect_selected_application;
use super::manifest::{read_application_manifest, target_snapshot, BuildTarget};
use super::packaging::package_target_outputs;
use super::path_safety::{metadata_is_link_like, resolve_application_root, resolve_relative_path};
use super::state::{ApplicationPublishState, PublishPlan, PLAN_TTL};
use super::types::{
    ApplicationPublishArtifactDiscardSnapshot, ApplicationPublishArtifactSnapshot,
    ApplicationPublishBuildSnapshot, ApplicationPublishDiagnostic, ApplicationPublishError,
    ApplicationPublishPreflightSnapshot,
};

const BUILD_TIMEOUT: Duration = Duration::from_secs(30 * 60);
const MAX_LOG_BYTES: usize = 128 * 1024;
const MAX_ARTIFACT_RANGE_BYTES: u32 = 8 * 1024 * 1024;

fn setup_required(message: &str) -> ApplicationPublishError {
    ApplicationPublishError::new("APPLICATION_PUBLISH_SETUP_REQUIRED", message)
}

fn resolve_build_working_directory(
    application_root: &Path,
    target: &BuildTarget,
) -> Result<PathBuf, ApplicationPublishError> {
    let Some(cwd) = target.cwd.as_deref() else {
        return Ok(application_root.to_path_buf());
    };
    let directory = resolve_application_root(application_root, cwd)?;
    if !directory.is_dir() {
        return Err(setup_required(
            "The manifest build target cwd must resolve to an existing directory.",
        ));
    }
    Ok(directory)
}

fn validate_declared_outputs(
    application_root: &Path,
    target: &BuildTarget,
) -> Result<(), ApplicationPublishError> {
    for output in &target.outputs {
        let path = resolve_relative_path(application_root, &output.path, false)?;
        if path.exists() {
            let metadata = fs::symlink_metadata(&path).map_err(|_| {
                setup_required("A declared build output could not be inspected safely.")
            })?;
            if metadata_is_link_like(&metadata) {
                return Err(ApplicationPublishError::new(
                    "APPLICATION_PUBLISH_LINK_REJECTED",
                    "Links and filesystem reparse points are not allowed in publish outputs.",
                ));
            }
            let type_matches = match output.output_type {
                super::manifest::BuildOutputType::File => metadata.is_file(),
                super::manifest::BuildOutputType::Directory => metadata.is_dir(),
            };
            if !type_matches {
                return Err(setup_required(
                    "A declared build output does not match its manifest type.",
                ));
            }
        }
    }
    Ok(())
}

pub(crate) fn preflight_application(
    state: &ApplicationPublishState,
    project_root: PathBuf,
    application_relative_path: &str,
    target_id: &str,
) -> Result<ApplicationPublishPreflightSnapshot, ApplicationPublishError> {
    let target_id = target_id.trim();
    if target_id.is_empty() || target_id.len() > 128 {
        return Err(setup_required("A valid manifest target id is required."));
    }
    let application_root =
        resolve_application_root(&project_root, application_relative_path.trim())?;
    let manifest = read_application_manifest(&application_root)
        .map_err(|_| setup_required("The application manifest could not be validated."))?
        .ok_or_else(|| setup_required("sdkwork.app.config.json is required before publishing."))?;
    if !manifest.issues.is_empty() {
        return Err(setup_required(
            "The application manifest is incomplete and requires setup.",
        ));
    }
    let target = manifest
        .find_ready_target(target_id)
        .cloned()
        .ok_or_else(|| setup_required("The selected manifest publish target is not ready."))?;
    resolve_build_working_directory(&application_root, &target)?;
    validate_declared_outputs(&application_root, &target)?;
    let application = inspect_selected_application(&project_root, &application_root)
        .ok_or_else(|| setup_required("The selected directory is not a supported application."))?;
    let target_snapshot = manifest
        .targets
        .iter()
        .find(|candidate| candidate.snapshot.id == target.id)
        .map(|candidate| candidate.snapshot.clone())
        .unwrap_or_else(|| target_snapshot(&target));
    let plan_id = Uuid::new_v4().to_string();
    state.insert_plan(PublishPlan {
        plan_id: plan_id.clone(),
        project_root,
        application_root,
        application_relative_path: application.relative_path.clone(),
        manifest_digest: manifest.digest.clone(),
        target,
        created_at: Instant::now(),
    })?;
    Ok(ApplicationPublishPreflightSnapshot {
        plan_id,
        application_id: application.application_id,
        app_key: application.app_key,
        application_name: application.name,
        application_relative_path: application.relative_path,
        application_kind: application.kind,
        framework: application.framework,
        manifest_digest: manifest.digest,
        target: target_snapshot,
        expires_in_seconds: PLAN_TTL.as_secs(),
    })
}

/// Builds a structured process for a manifest build command. The command was
/// validated by `is_safe_manifest_command` (no shell operators or quote
/// characters), so it is executed as an argument vector directly instead of
/// being concatenated into `cmd /C` or `sh -c`: this keeps renderer-controlled
/// manifest content from escalating to arbitrary shell execution.
///
/// On Windows a `.cmd`/`.bat` script cannot be spawned directly as a process
/// (the OS requires `cmd.exe` to interpret it), so scripts with those exact
/// extensions are launched through `cmd /c` with the script path passed as a
/// single argument; every other command stays fully structured.
fn build_structured_command(command: &str, working_directory: &Path) -> Result<Command, String> {
    let mut tokens = command.split_whitespace();
    let executable = tokens.next().ok_or_else(|| "manifest command is empty".to_owned())?;
    let remaining_args = tokens.collect::<Vec<_>>();
    #[cfg(windows)]
    {
        let lowered = executable.to_ascii_lowercase();
        if lowered.ends_with(".cmd") || lowered.ends_with(".bat") {
            let mut process = Command::new("cmd.exe");
            // `/D /C` with the script as a single quoted-free argument: the
            // script path was already validated to contain no shell
            // characters, so no additional escaping is needed.
            process
                .args(["/D", "/C"])
                .arg(executable)
                .args(remaining_args)
                .current_dir(working_directory);
            return Ok(process);
        }
    }
    let mut process = Command::new(executable);
    process.args(remaining_args).current_dir(working_directory);
    Ok(process)
}

async fn read_bounded<R>(mut reader: R) -> (Vec<u8>, bool)
where
    R: AsyncRead + Unpin,
{
    let mut retained = Vec::new();
    let mut buffer = vec![0u8; 8 * 1024];
    let mut truncated = false;
    loop {
        let Ok(count) = reader.read(&mut buffer).await else {
            break;
        };
        if count == 0 {
            break;
        }
        if retained.len() + count > MAX_LOG_BYTES {
            truncated = true;
            let overflow = retained.len() + count - MAX_LOG_BYTES;
            if overflow >= retained.len() {
                retained.clear();
                let keep_from = count.saturating_sub(MAX_LOG_BYTES);
                retained.extend_from_slice(&buffer[keep_from..count]);
            } else {
                retained.drain(..overflow);
                retained.extend_from_slice(&buffer[..count]);
            }
        } else {
            retained.extend_from_slice(&buffer[..count]);
        }
    }
    (retained, truncated)
}

fn sanitize_log(raw: &[u8]) -> String {
    let text = String::from_utf8_lossy(raw);
    let mut result = String::new();
    for line in text.lines() {
        let lower = line.to_ascii_lowercase();
        if [
            "authorization",
            "bearer ",
            "credential",
            "password",
            "passwd",
            "private key",
            "private_key",
            "secret",
            "token",
            "api-key",
            "api_key",
            "apikey",
        ]
        .iter()
        .any(|needle| lower.contains(needle))
        {
            result.push_str("[redacted]\n");
            continue;
        }
        result.extend(
            line.chars()
                .filter(|character| !character.is_control() || *character == '\t'),
        );
        result.push('\n');
    }
    result.trim_end().to_string()
}

async fn execute_manifest_command(
    target: &BuildTarget,
    working_directory: &Path,
) -> Result<ApplicationPublishDiagnostic, ApplicationPublishError> {
    let mut process = build_structured_command(&target.command, working_directory).map_err(|_| {
        ApplicationPublishError::new(
            "APPLICATION_PUBLISH_BUILD_START_FAILED",
            "The manifest build command could not be started.",
        )
    })?;
    process
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    let mut child = process.spawn().map_err(|_| {
        ApplicationPublishError::new(
            "APPLICATION_PUBLISH_BUILD_START_FAILED",
            "The manifest build command could not be started.",
        )
    })?;
    let stdout = child.stdout.take().ok_or_else(|| {
        ApplicationPublishError::new(
            "APPLICATION_PUBLISH_BUILD_START_FAILED",
            "The manifest build command output could not be captured.",
        )
    })?;
    let stderr = child.stderr.take().ok_or_else(|| {
        ApplicationPublishError::new(
            "APPLICATION_PUBLISH_BUILD_START_FAILED",
            "The manifest build command output could not be captured.",
        )
    })?;
    let stdout_task = tokio::spawn(read_bounded(stdout));
    let stderr_task = tokio::spawn(read_bounded(stderr));
    let status = match timeout(BUILD_TIMEOUT, child.wait()).await {
        Ok(Ok(status)) => status,
        Ok(Err(_)) => {
            let _ = child.kill().await;
            return Err(ApplicationPublishError::new(
                "APPLICATION_PUBLISH_BUILD_FAILED",
                "The manifest build command could not be completed.",
            ));
        }
        Err(_) => {
            let _ = child.kill().await;
            let _ = child.wait().await;
            let (stdout, stdout_truncated) = stdout_task.await.unwrap_or_default();
            let (stderr, stderr_truncated) = stderr_task.await.unwrap_or_default();
            return Err(ApplicationPublishError::with_diagnostic(
                "APPLICATION_PUBLISH_BUILD_TIMEOUT",
                "The manifest build command exceeded the 30 minute limit.",
                ApplicationPublishDiagnostic {
                    exit_code: None,
                    stdout: sanitize_log(&stdout),
                    stderr: sanitize_log(&stderr),
                    truncated: stdout_truncated || stderr_truncated,
                },
            ));
        }
    };
    let (stdout, stdout_truncated) = stdout_task.await.unwrap_or_default();
    let (stderr, stderr_truncated) = stderr_task.await.unwrap_or_default();
    let diagnostic = ApplicationPublishDiagnostic {
        exit_code: status.code(),
        stdout: sanitize_log(&stdout),
        stderr: sanitize_log(&stderr),
        truncated: stdout_truncated || stderr_truncated,
    };
    if !status.success() {
        return Err(ApplicationPublishError::with_diagnostic(
            "APPLICATION_PUBLISH_BUILD_FAILED",
            "The manifest build command failed.",
            diagnostic,
        ));
    }
    Ok(diagnostic)
}

fn verify_plan_manifest(plan: &PublishPlan) -> Result<BuildTarget, ApplicationPublishError> {
    let application_root =
        resolve_application_root(&plan.project_root, &plan.application_relative_path)?;
    if application_root != plan.application_root {
        return Err(ApplicationPublishError::new(
            "APPLICATION_PUBLISH_MANIFEST_CHANGED",
            "The application root changed after preflight. Run preflight again.",
        ));
    }
    let manifest = read_application_manifest(&application_root)
        .map_err(|_| {
            ApplicationPublishError::new(
                "APPLICATION_PUBLISH_MANIFEST_CHANGED",
                "The application manifest changed after preflight. Run preflight again.",
            )
        })?
        .ok_or_else(|| {
            ApplicationPublishError::new(
                "APPLICATION_PUBLISH_MANIFEST_CHANGED",
                "The application manifest changed after preflight. Run preflight again.",
            )
        })?;
    if manifest.digest != plan.manifest_digest {
        return Err(ApplicationPublishError::new(
            "APPLICATION_PUBLISH_MANIFEST_CHANGED",
            "The application manifest changed after preflight. Run preflight again.",
        ));
    }
    let target = manifest
        .find_ready_target(&plan.target.id)
        .filter(|target| *target == &plan.target)
        .cloned()
        .ok_or_else(|| {
            ApplicationPublishError::new(
                "APPLICATION_PUBLISH_MANIFEST_CHANGED",
                "The publish target changed after preflight. Run preflight again.",
            )
        })?;
    resolve_build_working_directory(&application_root, &target)?;
    validate_declared_outputs(&application_root, &target)?;
    Ok(target)
}

pub(crate) async fn build_and_package_application(
    state: &ApplicationPublishState,
    plan_id: &str,
) -> Result<ApplicationPublishBuildSnapshot, ApplicationPublishError> {
    let plan = state.plan(plan_id.trim())?;
    let target = verify_plan_manifest(&plan)?;
    let working_directory = resolve_build_working_directory(&plan.application_root, &target)?;
    let diagnostic = execute_manifest_command(&target, &working_directory).await?;
    let staging_directory = state.create_build_staging_directory()?;
    let application_root = plan.application_root.clone();
    let packaging_target = target.clone();
    let packaging_staging_directory = staging_directory.clone();
    let packaging_task = tokio::task::spawn_blocking(move || {
        package_target_outputs(
            &application_root,
            &packaging_staging_directory,
            &packaging_target,
        )
    })
    .await;
    let packaged = match packaging_task {
        Ok(packaged) => packaged,
        Err(_) => {
            state.remove_build_staging_directory(&staging_directory);
            return Err(ApplicationPublishError::new(
                "APPLICATION_PUBLISH_PACKAGE_FAILED",
                "The local packaging task stopped unexpectedly.",
            ));
        }
    };
    let packaged = match packaged {
        Ok(packaged) => packaged,
        Err(error) => {
            state.remove_build_staging_directory(&staging_directory);
            return Err(error);
        }
    };

    let mut registered_ids: Vec<String> = Vec::new();
    let mut artifacts = Vec::new();
    for artifact in packaged {
        let artifact_id = match state.register_artifact(artifact.path, artifact.byte_length) {
            Ok(artifact_id) => artifact_id,
            Err(error) => {
                for registered_id in registered_ids {
                    let _ = state.discard_artifact(&registered_id);
                }
                state.remove_build_staging_directory(&staging_directory);
                return Err(error);
            }
        };
        registered_ids.push(artifact_id.clone());
        artifacts.push(ApplicationPublishArtifactSnapshot {
            artifact_id,
            package_id: artifact.package_id,
            output_type: artifact.output_type,
            file_name: artifact.file_name,
            content_type: artifact.content_type,
            byte_length: artifact.byte_length,
            sha256: artifact.sha256,
        });
    }
    Ok(ApplicationPublishBuildSnapshot {
        plan_id: plan.plan_id,
        artifacts,
        diagnostic,
    })
}

pub(crate) fn read_artifact_range(
    state: &ApplicationPublishState,
    artifact_id: &str,
    offset: u64,
    length: u32,
) -> Result<Vec<u8>, ApplicationPublishError> {
    if length == 0 || length > MAX_ARTIFACT_RANGE_BYTES {
        return Err(ApplicationPublishError::new(
            "APPLICATION_PUBLISH_RANGE_INVALID",
            "Artifact range length must be between 1 byte and 8 MiB.",
        ));
    }
    let artifact = state.artifact(artifact_id.trim())?;
    if offset > artifact.byte_length {
        return Err(ApplicationPublishError::new(
            "APPLICATION_PUBLISH_RANGE_INVALID",
            "Artifact range offset exceeds the artifact length.",
        ));
    }
    let metadata = fs::symlink_metadata(&artifact.path).map_err(|_| {
        ApplicationPublishError::new(
            "APPLICATION_PUBLISH_ARTIFACT_NOT_FOUND",
            "The staged artifact is unavailable or has expired.",
        )
    })?;
    if metadata_is_link_like(&metadata)
        || !metadata.is_file()
        || metadata.len() != artifact.byte_length
    {
        return Err(ApplicationPublishError::new(
            "APPLICATION_PUBLISH_ARTIFACT_CHANGED",
            "The staged artifact changed and can no longer be read.",
        ));
    }
    let read_length = u64::from(length).min(artifact.byte_length - offset) as usize;
    let mut file = File::open(&artifact.path).map_err(|_| {
        ApplicationPublishError::new(
            "APPLICATION_PUBLISH_ARTIFACT_NOT_FOUND",
            "The staged artifact is unavailable or has expired.",
        )
    })?;
    file.seek(SeekFrom::Start(offset)).map_err(|_| {
        ApplicationPublishError::new(
            "APPLICATION_PUBLISH_ARTIFACT_READ_FAILED",
            "The staged artifact range could not be read.",
        )
    })?;
    let mut bytes = vec![0u8; read_length];
    file.read_exact(&mut bytes).map_err(|_| {
        ApplicationPublishError::new(
            "APPLICATION_PUBLISH_ARTIFACT_READ_FAILED",
            "The staged artifact range could not be read.",
        )
    })?;
    Ok(bytes)
}

pub(crate) fn discard_artifact(
    state: &ApplicationPublishState,
    artifact_id: &str,
) -> Result<ApplicationPublishArtifactDiscardSnapshot, ApplicationPublishError> {
    let artifact_id = artifact_id.trim().to_string();
    let discarded = state.discard_artifact(&artifact_id)?;
    Ok(ApplicationPublishArtifactDiscardSnapshot {
        artifact_id,
        discarded,
    })
}

#[cfg(test)]
mod tests {
    use std::fs;

    use sha2::{Digest, Sha256};

    use super::*;

    fn build_command() -> &'static str {
        if cfg!(windows) {
            "build-fixture.cmd"
        } else {
            "./build-fixture.sh"
        }
    }

    fn unselected_build_command() -> &'static str {
        if cfg!(windows) {
            "not-selected.cmd"
        } else {
            "./not-selected.sh"
        }
    }

    fn write_manifest(root: &Path, command: &str) {
        // The publish command contract rejects shell operators in manifest
        // commands, so the fixture scripts carry the shell-level work
        // (redirection) and the manifest references the scripts as plain
        // executable tokens.
        let script_body = if cfg!(windows) {
            "@echo off\r\necho fixture>artifact.bin\r\n"
        } else {
            "#!/bin/sh\nprintf fixture > artifact.bin\n"
        };
        fs::write(root.join(if cfg!(windows) { "build-fixture.cmd" } else { "build-fixture.sh" }), script_body)
            .expect("publish fixture build script");
        fs::write(
            root.join(if cfg!(windows) { "not-selected.cmd" } else { "not-selected.sh" }),
            if cfg!(windows) { "@echo off\r\necho unexpected>not-selected.bin\r\n" } else { "#!/bin/sh\nprintf unexpected > not-selected.bin\n" },
        )
        .expect("publish fixture not-selected script");
        fs::write(
            root.join("sdkwork.app.config.json"),
            serde_json::json!({
                "schemaVersion": 3,
                "kind": "sdkwork.app",
                "app": {"key": "fixture", "name": "Fixture", "appType": "APP_REACT"},
                "runtime": {"framework": "react"},
                "devApp": {"build": {"targets": [
                    {
                        "id": "web-production",
                        "label": "Production web",
                        "command": command,
                        "cwd": ".",
                        "packageId": "web-package",
                        "outputs": [{
                            "path": "artifact.bin",
                            "type": "file",
                            "fileName": "artifact.bin"
                        }]
                    },
                    {
                        "id": "not-selected",
                        "command": unselected_build_command(),
                        "packageId": "not-selected-package",
                        "outputs": [{
                            "path": "not-selected.bin",
                            "type": "file",
                            "fileName": "not-selected.bin"
                        }]
                    }
                ]}}
            })
            .to_string(),
        )
        .expect("publish manifest fixture");
    }

    #[tokio::test]
    async fn build_uses_opaque_plan_and_streams_staged_artifact_ranges() {
        let root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-publish-runtime-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("runtime fixture root");
        write_manifest(&root, build_command());
        let canonical_root = root.canonicalize().expect("canonical fixture root");
        let state = ApplicationPublishState::new().expect("publish state");
        let preflight = preflight_application(&state, canonical_root, ".", "web-production")
            .expect("publish preflight");
        assert_eq!(preflight.app_key.as_deref(), Some("fixture"));
        assert_eq!(preflight.target.label, "Production web");
        assert_eq!(preflight.target.command.as_deref(), Some(build_command()));
        assert_eq!(preflight.target.cwd.as_deref(), Some("."));
        let serialized = serde_json::to_value(&preflight).expect("serialized preflight snapshot");
        assert_eq!(
            serialized.get("appKey").and_then(serde_json::Value::as_str),
            Some("fixture")
        );
        assert!(serialized.get("app_key").is_none());
        let build = build_and_package_application(&state, &preflight.plan_id)
            .await
            .expect("build and package");
        assert!(!root.join("not-selected.bin").exists());
        assert_eq!(build.artifacts.len(), 1);
        let artifact = &build.artifacts[0];
        let staged_bytes = read_artifact_range(
            &state,
            &artifact.artifact_id,
            0,
            u32::try_from(artifact.byte_length).expect("small fixture artifact"),
        )
        .expect("complete artifact range");
        assert_eq!(
            artifact.sha256,
            format!("sha256:{}", hex::encode(Sha256::digest(&staged_bytes)))
        );
        let bytes =
            read_artifact_range(&state, &artifact.artifact_id, 0, 4).expect("artifact range");
        assert_eq!(&bytes, b"fixt");
        assert!(
            discard_artifact(&state, &artifact.artifact_id)
                .expect("discard artifact")
                .discarded
        );
        let error = read_artifact_range(&state, &artifact.artifact_id, 0, 1)
            .expect_err("discarded artifact must be unavailable");
        assert_eq!(error.code, "APPLICATION_PUBLISH_ARTIFACT_NOT_FOUND");
        assert!(
            !discard_artifact(&state, &artifact.artifact_id)
                .expect("idempotent artifact discard")
                .discarded
        );
        let _ = fs::remove_dir_all(root);
    }

    #[tokio::test]
    async fn build_rejects_manifest_changes_after_preflight() {
        let root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-publish-digest-{}",
            Uuid::new_v4()
        ));
        fs::create_dir_all(&root).expect("runtime fixture root");
        write_manifest(&root, build_command());
        let canonical_root = root.canonicalize().expect("canonical fixture root");
        let state = ApplicationPublishState::new().expect("publish state");
        let preflight = preflight_application(&state, canonical_root, ".", "web-production")
            .expect("publish preflight");
        write_manifest(&root, "another-command");
        let error = build_and_package_application(&state, &preflight.plan_id)
            .await
            .expect_err("manifest change must fail");
        assert_eq!(error.code, "APPLICATION_PUBLISH_MANIFEST_CHANGED");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn build_diagnostics_redact_common_credential_shapes() {
        let sanitized = sanitize_log(
            b"build started\nACCESS_TOKEN: fixture-token\napi-key=fixture-key\nAuthorization: Bearer fixture\ncredential=fixture\ncompleted\n",
        );
        assert_eq!(
            sanitized,
            "build started\n[redacted]\n[redacted]\n[redacted]\n[redacted]\ncompleted"
        );
        assert!(!sanitized.contains("fixture-token"));
        assert!(!sanitized.contains("fixture-key"));
    }
}
