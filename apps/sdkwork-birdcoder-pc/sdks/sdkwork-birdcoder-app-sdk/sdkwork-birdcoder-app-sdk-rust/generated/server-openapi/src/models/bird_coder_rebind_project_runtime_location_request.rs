use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderRebindProjectRuntimeLocationRequest {
    #[serde(rename = "pathFlavor")]
    pub path_flavor: String,

    /// Opaque, path-free target locator. Do not provide a relative or absolute filesystem path.
    #[serde(rename = "rootLocator")]
    pub root_locator: String,

    /// Write-only replacement absolute path for encrypted-at-rest registration. It is never returned.
    #[serde(rename = "absolutePath")]
    pub absolute_path: String,

    /// Safe display label for the rebound location.
    #[serde(rename = "displayName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub display_name: Option<String>,
}
