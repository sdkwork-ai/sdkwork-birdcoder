use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderNativeSessionSummary {
    pub id: String,

    #[serde(rename = "workspaceId")]
    pub workspace_id: String,

    #[serde(rename = "projectId")]
    pub project_id: String,

    pub title: String,

    pub status: String,

    #[serde(rename = "hostMode")]
    pub host_mode: String,

    #[serde(rename = "engineId")]
    pub engine_id: String,

    #[serde(rename = "modelId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model_id: Option<String>,

    #[serde(rename = "nativeSessionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_session_id: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,

    #[serde(rename = "lastTurnAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_turn_at: Option<String>,

    /// Normalized activity timestamp in epoch milliseconds used for sorting.
    #[serde(rename = "sortTimestamp")]
    pub sort_timestamp: String,

    /// Most recent transcript mutation timestamp, when available.
    #[serde(rename = "transcriptUpdatedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcript_updated_at: Option<String>,

    pub kind: String,

    #[serde(rename = "nativeCwd")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_cwd: Option<String>,
}
