use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectRuntimeLocation {
    pub id: String,

    pub uuid: String,

    #[serde(rename = "projectId")]
    pub project_id: String,

    #[serde(rename = "runtimeTargetId")]
    pub runtime_target_id: String,

    #[serde(rename = "runtimeTargetKind")]
    pub runtime_target_kind: String,

    #[serde(rename = "locationKind")]
    pub location_kind: String,

    #[serde(rename = "pathFlavor")]
    pub path_flavor: String,

    /// Safe display label for this location.
    #[serde(rename = "displayName")]
    pub display_name: String,

    #[serde(rename = "terminalAvailable")]
    pub terminal_available: bool,

    #[serde(rename = "gitAvailable")]
    pub git_available: bool,

    #[serde(rename = "buildAvailable")]
    pub build_available: bool,

    #[serde(rename = "filesystemAvailable")]
    pub filesystem_available: bool,

    #[serde(rename = "healthStatus")]
    pub health_status: String,

    #[serde(rename = "lastVerifiedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_verified_at: Option<String>,

    #[serde(rename = "lastSeenAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<String>,

    /// Optimistic concurrency version used with the If-Match request header.
    pub version: String,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}
