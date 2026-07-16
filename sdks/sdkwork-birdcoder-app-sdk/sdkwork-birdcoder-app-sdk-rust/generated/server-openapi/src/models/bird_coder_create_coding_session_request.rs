use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateCodingSessionRequest {
    #[serde(rename = "workspaceId")]
    pub workspace_id: String,

    #[serde(rename = "projectId")]
    pub project_id: String,

    /// Verified project runtime-location identifier required for coding-session execution.
    #[serde(rename = "runtimeLocationId")]
    pub runtime_location_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    #[serde(rename = "hostMode")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub host_mode: Option<String>,

    #[serde(rename = "engineId")]
    pub engine_id: String,

    #[serde(rename = "modelId")]
    pub model_id: String,
}
