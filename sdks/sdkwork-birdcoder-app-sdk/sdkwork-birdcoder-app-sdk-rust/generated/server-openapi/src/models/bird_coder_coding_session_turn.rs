use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionTurn {
    pub id: String,

    #[serde(rename = "codingSessionId")]
    pub coding_session_id: String,

    #[serde(rename = "runtimeId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime_id: Option<String>,

    #[serde(rename = "requestKind")]
    pub request_kind: String,

    pub status: String,

    #[serde(rename = "inputSummary")]
    pub input_summary: String,

    #[serde(rename = "startedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,

    #[serde(rename = "completedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
}
