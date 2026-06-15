use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionArtifact {
    pub id: String,

    #[serde(rename = "codingSessionId")]
    pub coding_session_id: String,

    #[serde(rename = "turnId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,

    pub kind: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    pub title: String,

    #[serde(rename = "blobRef")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blob_ref: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<std::collections::HashMap<String, serde_json::Value>>,

    #[serde(rename = "createdAt")]
    pub created_at: String,
}
