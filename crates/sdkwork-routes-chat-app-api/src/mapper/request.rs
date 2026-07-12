use serde::Deserialize;

use sdkwork_birdcoder_chat_service::domain::models::{
    CreateChatConversationCommand, CreateChatMessageCommand,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChatConversationBody {
    pub title: Option<String>,
}

impl From<CreateChatConversationBody> for CreateChatConversationCommand {
    fn from(value: CreateChatConversationBody) -> Self {
        Self { title: value.title }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChatMessageBody {
    pub role: String,
    pub content: String,
}

impl From<CreateChatMessageBody> for CreateChatMessageCommand {
    fn from(value: CreateChatMessageBody) -> Self {
        Self {
            role: value.role,
            content: value.content,
        }
    }
}
