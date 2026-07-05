use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderChatMessageSummary {
    pub id: String,

    #[serde(rename = "conversationId")]
    pub conversation_id: String,

    pub role: String,

    pub content: String,

    #[serde(rename = "createdAt")]
    pub created_at: String,
}
