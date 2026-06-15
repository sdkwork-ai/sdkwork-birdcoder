use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionCheckpoint {
    pub id: String,

    #[serde(rename = "codingSessionId")]
    pub coding_session_id: String,

    #[serde(rename = "runtimeId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime_id: Option<String>,

    #[serde(rename = "checkpointKind")]
    pub checkpoint_kind: String,

    pub resumable: bool,

    pub state: std::collections::HashMap<String, serde_json::Value>,

    #[serde(rename = "createdAt")]
    pub created_at: String,
}
