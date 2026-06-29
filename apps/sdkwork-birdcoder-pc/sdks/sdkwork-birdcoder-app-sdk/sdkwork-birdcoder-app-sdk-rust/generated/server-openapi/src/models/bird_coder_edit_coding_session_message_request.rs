use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderEditCodingSessionMessageRequest {
    pub content: String,
}
