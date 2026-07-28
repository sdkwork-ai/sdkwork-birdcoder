use crate::application_publish::{
    build_and_package_application, discard_artifact, discover_applications, preflight_application,
    read_artifact_range, ApplicationPublishArtifactDiscardSnapshot,
    ApplicationPublishBuildSnapshot, ApplicationPublishDiscoverySnapshot, ApplicationPublishError,
    ApplicationPublishPreflightSnapshot, ApplicationPublishState,
};

use super::filesystem_commands::resolve_root_directory_path;

fn invalid_root() -> ApplicationPublishError {
    ApplicationPublishError::new(
        "APPLICATION_PUBLISH_ROOT_UNAVAILABLE",
        "The selected project root is not authorized for local publishing.",
    )
}

pub fn application_publish_discover(
    root_path: String,
) -> Result<ApplicationPublishDiscoverySnapshot, ApplicationPublishError> {
    let project_root = resolve_root_directory_path(&root_path).map_err(|_| invalid_root())?;
    Ok(discover_applications(&project_root))
}

pub fn application_publish_preflight(
    state: tauri::State<'_, ApplicationPublishState>,
    root_path: String,
    application_relative_path: String,
    target_id: String,
) -> Result<ApplicationPublishPreflightSnapshot, ApplicationPublishError> {
    let project_root = resolve_root_directory_path(&root_path).map_err(|_| invalid_root())?;
    preflight_application(
        state.inner(),
        project_root,
        &application_relative_path,
        &target_id,
    )
}

pub async fn application_publish_build_package(
    state: tauri::State<'_, ApplicationPublishState>,
    plan_id: String,
) -> Result<ApplicationPublishBuildSnapshot, ApplicationPublishError> {
    build_and_package_application(state.inner(), &plan_id).await
}

pub fn application_publish_read_artifact_range(
    state: tauri::State<'_, ApplicationPublishState>,
    artifact_id: String,
    offset: u64,
    length: u32,
) -> Result<Vec<u8>, ApplicationPublishError> {
    read_artifact_range(state.inner(), &artifact_id, offset, length)
}

pub fn application_publish_artifact_discard(
    state: tauri::State<'_, ApplicationPublishState>,
    artifact_id: String,
) -> Result<ApplicationPublishArtifactDiscardSnapshot, ApplicationPublishError> {
    discard_artifact(state.inner(), &artifact_id)
}
