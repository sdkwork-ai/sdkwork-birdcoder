use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionEvent {
    pub id: String,

    #[serde(rename = "codingSessionId")]
    pub coding_session_id: String,

    #[serde(rename = "turnId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,

    #[serde(rename = "runtimeId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime_id: Option<String>,

    pub kind: String,

    /// Event sequence number serialized as an exact decimal string.
    pub sequence: String,

    pub payload: std::collections::HashMap<String, serde_json::Value>,

    #[serde(rename = "createdAt")]
    pub created_at: String,
}
