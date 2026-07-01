use serde::Deserialize;

use sdkwork_birdcoder_chat_service::domain::models::{
    ChatListQuery, CreateChatConversationCommand, CreateChatMessageCommand,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatListQueryParams {
    pub offset: Option<i64>,
    pub limit: Option<i64>,
}

impl From<ChatListQueryParams> for ChatListQuery {
    fn from(value: ChatListQueryParams) -> Self {
        Self {
            offset: value.offset.unwrap_or(0),
            limit: value.limit.unwrap_or(50),
        }
    }
}

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
