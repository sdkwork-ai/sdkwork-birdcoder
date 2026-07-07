use uuid::Uuid;

use crate::context::ChatContext;
use crate::domain::models::{
    ChatConversationPayload, ChatListQuery, ChatMessagePayload, CreateChatConversationCommand,
    CreateChatMessageCommand,
};
use crate::error::ChatError;
use sdkwork_utils_rust::{is_blank, trim as trim_string};

const DEFAULT_CONVERSATION_TITLE: &str = "New chat";
const DEFAULT_LIST_LIMIT: i64 = 20;
const MAX_LIST_LIMIT: i64 = 200;

const ALLOWED_MESSAGE_ROLES: [&str; 3] = ["user", "assistant", "system"];

#[async_trait::async_trait]
pub trait ChatRepository: Send + Sync {
    async fn list_conversations(
        &self,
        ctx: &ChatContext,
        query: &ChatListQuery,
    ) -> Result<(Vec<ChatConversationPayload>, i64), String>;

    async fn create_conversation(
        &self,
        ctx: &ChatContext,
        conversation: &ChatConversationPayload,
    ) -> Result<ChatConversationPayload, String>;

    async fn find_conversation(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
    ) -> Result<Option<ChatConversationPayload>, String>;

    async fn delete_conversation(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
    ) -> Result<(), String>;

    async fn list_messages(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
        query: &ChatListQuery,
    ) -> Result<(Vec<ChatMessagePayload>, i64), String>;

    async fn create_message(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
        message: &ChatMessagePayload,
    ) -> Result<ChatMessagePayload, String>;
}

#[derive(Clone)]
pub struct ChatService<R: ChatRepository> {
    repository: R,
}

impl<R: ChatRepository> ChatService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn list_conversations(
        &self,
        ctx: &ChatContext,
        query: ChatListQuery,
    ) -> Result<(Vec<ChatConversationPayload>, i64), ChatError> {
        let normalized = normalize_list_query(query);
        self.repository
            .list_conversations(ctx, &normalized)
            .await
            .map_err(ChatError::Repository)
    }

    pub async fn create_conversation(
        &self,
        ctx: &ChatContext,
        command: CreateChatConversationCommand,
    ) -> Result<ChatConversationPayload, ChatError> {
        let title = normalize_title(command.title.as_deref());
        let now = now_iso();
        let conversation = ChatConversationPayload {
            id: Uuid::new_v4().to_string(),
            title,
            owner_user_id: ctx.user_id.clone(),
            created_at: now.clone(),
            updated_at: now,
        };
        self.repository
            .create_conversation(ctx, &conversation)
            .await
            .map_err(ChatError::Repository)
    }

    pub async fn get_conversation(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
    ) -> Result<ChatConversationPayload, ChatError> {
        let normalized_id = normalize_required(conversation_id)
            .ok_or_else(|| ChatError::InvalidInput("conversationId is required.".to_string()))?;
        self.repository
            .find_conversation(ctx, &normalized_id)
            .await
            .map_err(ChatError::Repository)?
            .ok_or_else(|| {
                ChatError::NotFound(format!("Conversation \"{normalized_id}\" was not found."))
            })
    }

    pub async fn delete_conversation(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
    ) -> Result<(), ChatError> {
        let normalized_id = normalize_required(conversation_id)
            .ok_or_else(|| ChatError::InvalidInput("conversationId is required.".to_string()))?;
        self.ensure_conversation_access(ctx, &normalized_id)
            .await?;
        self.repository
            .delete_conversation(ctx, &normalized_id)
            .await
            .map_err(ChatError::Repository)
    }

    pub async fn list_messages(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
        query: ChatListQuery,
    ) -> Result<(Vec<ChatMessagePayload>, i64), ChatError> {
        let normalized_id = normalize_required(conversation_id)
            .ok_or_else(|| ChatError::InvalidInput("conversationId is required.".to_string()))?;
        self.ensure_conversation_access(ctx, &normalized_id)
            .await?;
        let normalized = normalize_list_query(query);
        self.repository
            .list_messages(ctx, &normalized_id, &normalized)
            .await
            .map_err(ChatError::Repository)
    }

    pub async fn create_message(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
        command: CreateChatMessageCommand,
    ) -> Result<ChatMessagePayload, ChatError> {
        let normalized_id = normalize_required(conversation_id)
            .ok_or_else(|| ChatError::InvalidInput("conversationId is required.".to_string()))?;
        self.ensure_conversation_access(ctx, &normalized_id)
            .await?;
        let role = normalize_message_role(&command.role)?;
        let content = normalize_required(&command.content)
            .ok_or_else(|| ChatError::InvalidInput("content is required.".to_string()))?;
        let message = ChatMessagePayload {
            id: Uuid::new_v4().to_string(),
            conversation_id: normalized_id,
            role,
            content,
            created_at: now_iso(),
        };
        self.repository
            .create_message(ctx, &message.conversation_id, &message)
            .await
            .map_err(ChatError::Repository)
    }

    async fn ensure_conversation_access(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
    ) -> Result<ChatConversationPayload, ChatError> {
        let conversation = self.get_conversation(ctx, conversation_id).await?;
        if conversation.owner_user_id != ctx.user_id {
            return Err(ChatError::Forbidden(
                "Conversation is not owned by the current user.".to_string(),
            ));
        }
        Ok(conversation)
    }
}

fn normalize_list_query(query: ChatListQuery) -> ChatListQuery {
    let offset = query.offset.max(0);
    let limit = if query.limit <= 0 {
        DEFAULT_LIST_LIMIT
    } else {
        query.limit.min(MAX_LIST_LIMIT)
    };
    ChatListQuery { offset, limit }
}

fn normalize_required(value: &str) -> Option<String> {
    if is_blank(Some(value)) {
        None
    } else {
        Some(trim_string(value))
    }
}

fn normalize_title(title: Option<&str>) -> String {
    title
        .and_then(normalize_required)
        .unwrap_or_else(|| DEFAULT_CONVERSATION_TITLE.to_string())
}

fn normalize_message_role(role: &str) -> Result<String, ChatError> {
    let normalized = trim_string(role);
    if ALLOWED_MESSAGE_ROLES.contains(&normalized.as_str()) {
        Ok(normalized)
    } else {
        Err(ChatError::InvalidInput(
            "role must be one of user, assistant, or system.".to_string(),
        ))
    }
}

fn now_iso() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Iso8601::DEFAULT)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ChatError;
    use std::collections::HashMap;
    use tokio::sync::Mutex;

    struct MemoryChatRepository {
        conversations: Mutex<HashMap<String, ChatConversationPayload>>,
        messages: Mutex<HashMap<String, Vec<ChatMessagePayload>>>,
    }

    impl MemoryChatRepository {
        fn new() -> Self {
            Self {
                conversations: Mutex::new(HashMap::new()),
                messages: Mutex::new(HashMap::new()),
            }
        }
    }

    #[async_trait::async_trait]
    impl ChatRepository for MemoryChatRepository {
        async fn list_conversations(
            &self,
            _ctx: &ChatContext,
            query: &ChatListQuery,
        ) -> Result<(Vec<ChatConversationPayload>, i64), String> {
            let conversations = self.conversations.lock().await;
            let mut items: Vec<_> = conversations.values().cloned().collect();
            items.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));
            let total = items.len() as i64;
            let start = usize::try_from(query.offset).unwrap_or(0);
            let end = start.saturating_add(usize::try_from(query.limit).unwrap_or(50));
            Ok((items.into_iter().skip(start).take(end.saturating_sub(start)).collect(), total))
        }

        async fn create_conversation(
            &self,
            _ctx: &ChatContext,
            conversation: &ChatConversationPayload,
        ) -> Result<ChatConversationPayload, String> {
            self.conversations
                .lock()
                .await
                .insert(conversation.id.clone(), conversation.clone());
            Ok(conversation.clone())
        }

        async fn find_conversation(
            &self,
            _ctx: &ChatContext,
            conversation_id: &str,
        ) -> Result<Option<ChatConversationPayload>, String> {
            Ok(self
                .conversations
                .lock()
                .await
                .get(conversation_id)
                .cloned())
        }

        async fn delete_conversation(
            &self,
            _ctx: &ChatContext,
            conversation_id: &str,
        ) -> Result<(), String> {
            self.conversations.lock().await.remove(conversation_id);
            self.messages.lock().await.remove(conversation_id);
            Ok(())
        }

        async fn list_messages(
            &self,
            _ctx: &ChatContext,
            conversation_id: &str,
            query: &ChatListQuery,
        ) -> Result<(Vec<ChatMessagePayload>, i64), String> {
            let messages = self.messages.lock().await;
            let items = messages.get(conversation_id).cloned().unwrap_or_default();
            let total = items.len() as i64;
            let start = usize::try_from(query.offset).unwrap_or(0);
            let end = start.saturating_add(usize::try_from(query.limit).unwrap_or(50));
            Ok((items.into_iter().skip(start).take(end.saturating_sub(start)).collect(), total))
        }

        async fn create_message(
            &self,
            _ctx: &ChatContext,
            conversation_id: &str,
            message: &ChatMessagePayload,
        ) -> Result<ChatMessagePayload, String> {
            self.messages
                .lock()
                .await
                .entry(conversation_id.to_string())
                .or_default()
                .push(message.clone());
            Ok(message.clone())
        }
    }

    fn owner_context() -> ChatContext {
        ChatContext {
            tenant_id: "100001".to_string(),
            user_id: "user-owner".to_string(),
        }
    }

    fn other_context() -> ChatContext {
        ChatContext {
            tenant_id: "100001".to_string(),
            user_id: "user-other".to_string(),
        }
    }

    #[tokio::test]
    async fn create_conversation_uses_default_title_when_blank() {
        let service = ChatService::new(MemoryChatRepository::new());
        let conversation = service
            .create_conversation(&owner_context(), CreateChatConversationCommand { title: None })
            .await
            .expect("conversation should be created");
        assert_eq!(conversation.title, DEFAULT_CONVERSATION_TITLE);
        assert_eq!(conversation.owner_user_id, "user-owner");
    }

    #[tokio::test]
    async fn create_message_rejects_invalid_role() {
        let service = ChatService::new(MemoryChatRepository::new());
        let conversation = service
            .create_conversation(&owner_context(), CreateChatConversationCommand { title: None })
            .await
            .expect("conversation should be created");
        let error = service
            .create_message(
                &owner_context(),
                &conversation.id,
                CreateChatMessageCommand {
                    role: "tool".to_string(),
                    content: "hello".to_string(),
                },
            )
            .await
            .expect_err("invalid role should be rejected");
        assert!(matches!(error, ChatError::InvalidInput(_)));
    }

    #[tokio::test]
    async fn create_message_forbids_non_owner_access() {
        let service = ChatService::new(MemoryChatRepository::new());
        let conversation = service
            .create_conversation(&owner_context(), CreateChatConversationCommand { title: None })
            .await
            .expect("conversation should be created");
        let error = service
            .create_message(
                &other_context(),
                &conversation.id,
                CreateChatMessageCommand {
                    role: "user".to_string(),
                    content: "hello".to_string(),
                },
            )
            .await
            .expect_err("foreign owner should be forbidden");
        assert!(matches!(error, ChatError::Forbidden(_)));
    }

    #[tokio::test]
    async fn normalize_list_query_caps_limit() {
        let normalized = normalize_list_query(ChatListQuery {
            offset: -5,
            limit: 500,
        });
        assert_eq!(normalized.offset, 0);
        assert_eq!(normalized.limit, MAX_LIST_LIMIT);
    }
}
