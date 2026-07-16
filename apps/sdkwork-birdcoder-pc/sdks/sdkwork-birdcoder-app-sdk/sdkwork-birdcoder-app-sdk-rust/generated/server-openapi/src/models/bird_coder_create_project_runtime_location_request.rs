use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateProjectRuntimeLocationRequest {
    #[serde(rename = "runtimeTargetId")]
    pub runtime_target_id: String,

    #[serde(rename = "runtimeTargetKind")]
    pub runtime_target_kind: String,

    #[serde(rename = "locationKind")]
    pub location_kind: String,

    #[serde(rename = "pathFlavor")]
    pub path_flavor: String,

    /// Opaque, path-free target locator. Do not provide a relative or absolute filesystem path.
    #[serde(rename = "rootLocator")]
    pub root_locator: String,

    /// Write-only absolute path for encrypted-at-rest registration. It is never returned.
    #[serde(rename = "absolutePath")]
    pub absolute_path: String,

    /// Safe display label for the registered location.
    #[serde(rename = "displayName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
}
