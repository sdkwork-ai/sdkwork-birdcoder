use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateChatMessageRequest {
    pub role: String,

    pub content: String,
}
