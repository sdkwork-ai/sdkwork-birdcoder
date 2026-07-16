use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderNativeSessionAttributes};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionSummary {
    pub id: String,

    #[serde(rename = "workspaceId")]
    pub workspace_id: String,

    #[serde(rename = "projectId")]
    pub project_id: String,

    /// Verified runtime-location identifier bound when the coding session was created. Legacy sessions may omit this field and cannot execute or trigger native-session discovery.
    #[serde(rename = "runtimeLocationId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime_location_id: Option<String>,

    pub title: String,

    pub status: String,

    #[serde(rename = "hostMode")]
    pub host_mode: String,

    #[serde(rename = "engineId")]
    pub engine_id: String,

    #[serde(rename = "modelId")]
    pub model_id: String,

    #[serde(rename = "nativeSessionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_session_id: Option<String>,

    #[serde(rename = "nativeAttributes")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_attributes: Option<BirdCoderNativeSessionAttributes>,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,

    #[serde(rename = "lastTurnAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_turn_at: Option<String>,

    /// Normalized activity timestamp in epoch milliseconds used for sorting.
    #[serde(rename = "sortTimestamp")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort_timestamp: Option<String>,

    /// Most recent transcript mutation timestamp, when available.
    #[serde(rename = "transcriptUpdatedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcript_updated_at: Option<String>,
}
