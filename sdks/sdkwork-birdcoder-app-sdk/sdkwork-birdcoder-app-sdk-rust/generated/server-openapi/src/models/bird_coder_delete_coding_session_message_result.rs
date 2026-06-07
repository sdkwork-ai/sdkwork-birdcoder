use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderDeleteCodingSessionMessageResult {
    pub id: String,

    #[serde(rename = "codingSessionId")]
    pub coding_session_id: String,
}
