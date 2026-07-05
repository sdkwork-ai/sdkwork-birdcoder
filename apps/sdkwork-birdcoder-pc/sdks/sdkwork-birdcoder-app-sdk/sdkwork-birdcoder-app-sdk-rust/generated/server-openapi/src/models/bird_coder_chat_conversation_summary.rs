use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderChatConversationSummary {
    pub id: String,

    pub title: String,

    #[serde(rename = "ownerUserId")]
    pub owner_user_id: String,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}
