use serde::Deserialize;

use sdkwork_birdcoder_chat_service::domain::models::{
    ChatListQuery, CreateChatConversationCommand, CreateChatMessageCommand,
};
use sdkwork_birdcoder_project_service::pagination::clamp_list_page_size;

pub(crate) fn normalize_chat_list_pagination(
    offset: Option<i64>,
    limit: Option<i64>,
) -> (usize, usize) {
    let offset_usize = offset.map(|value| value.max(0) as usize);
    let limit_usize = limit.map(|value| value.max(0) as usize);
    clamp_list_page_size(offset_usize, limit_usize)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatListQueryParams {
    pub offset: Option<i64>,
    pub limit: Option<i64>,
}

impl ChatListQueryParams {
    pub fn normalized_pagination(&self) -> (usize, usize) {
        normalize_chat_list_pagination(self.offset, self.limit)
    }
}

impl From<ChatListQueryParams> for ChatListQuery {
    fn from(value: ChatListQueryParams) -> Self {
        let (offset, limit) = value.normalized_pagination();
        Self {
            offset: i64::try_from(offset).unwrap_or(0),
            limit: i64::try_from(limit).unwrap_or(20),
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
