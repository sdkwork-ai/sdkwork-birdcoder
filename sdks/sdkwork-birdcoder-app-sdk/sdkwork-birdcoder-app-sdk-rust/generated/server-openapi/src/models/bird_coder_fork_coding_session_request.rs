use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderForkCodingSessionRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
}
