use sqlx::{AnyPool, Row};
use time::OffsetDateTime;

use sdkwork_birdcoder_chat_service::context::ChatContext;
use sdkwork_birdcoder_chat_service::domain::models::{
    ChatConversationPayload, ChatListQuery, ChatMessagePayload,
};
use sdkwork_birdcoder_chat_service::service::chat_service::ChatRepository;
use sdkwork_birdcoder_errors::require_scoped_tenant_id;
use sdkwork_birdcoder_sqlx_repository_pool::dialect::{IS_NOT_DELETED, SET_SOFT_DELETED};

#[derive(Clone)]
pub struct SqliteChatRepository {
    pool: AnyPool,
}

impl SqliteChatRepository {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }

    fn require_tenant_id(tenant_id: &str) -> Result<i64, String> {
        require_scoped_tenant_id(tenant_id)
            .map_err(|_| "a valid tenant scope is required".to_owned())
    }

    fn now_iso() -> String {
        OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
    }

    fn map_conversation_row(row: &sqlx::any::AnyRow) -> Result<ChatConversationPayload, sqlx::Error> {
        Ok(ChatConversationPayload {
            id: row.try_get("id")?,
            title: row.try_get("title")?,
            owner_user_id: row.try_get("owner_user_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }

    fn map_message_row(row: &sqlx::any::AnyRow) -> Result<ChatMessagePayload, sqlx::Error> {
        Ok(ChatMessagePayload {
            id: row.try_get("id")?,
            conversation_id: row.try_get("conversation_id")?,
            role: row.try_get("role")?,
            content: row.try_get("content")?,
            created_at: row.try_get("created_at")?,
        })
    }
}

#[async_trait::async_trait]
impl ChatRepository for SqliteChatRepository {
    async fn list_conversations(
        &self,
        ctx: &ChatContext,
        query: &ChatListQuery,
    ) -> Result<(Vec<ChatConversationPayload>, i64), String> {
        let tenant_id = Self::require_tenant_id(&ctx.tenant_id)?;
        let count_row = sqlx::query(
            "SELECT COUNT(*) AS total FROM chat_conversation \
             WHERE tenant_id = ?1 AND owner_user_id = ?2 AND {IS_NOT_DELETED}",
        )
        .bind(tenant_id)
        .bind(&ctx.user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        let total: i64 = count_row.try_get("total").map_err(|e| e.to_string())?;

        let rows = sqlx::query(
            "SELECT id, title, owner_user_id, created_at, updated_at \
             FROM chat_conversation \
             WHERE tenant_id = ?1 AND owner_user_id = ?2 AND {IS_NOT_DELETED} \
             ORDER BY updated_at DESC LIMIT ?3 OFFSET ?4",
        )
        .bind(tenant_id)
        .bind(&ctx.user_id)
        .bind(query.limit)
        .bind(query.offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let items = rows
            .iter()
            .map(Self::map_conversation_row)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok((items, total))
    }

    async fn create_conversation(
        &self,
        ctx: &ChatContext,
        conversation: &ChatConversationPayload,
    ) -> Result<ChatConversationPayload, String> {
        let tenant_id = Self::require_tenant_id(&ctx.tenant_id)?;
        sqlx::query(
            "INSERT INTO chat_conversation (id, tenant_id, owner_user_id, title, created_at, updated_at, is_deleted) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
        )
        .bind(&conversation.id)
        .bind(tenant_id)
        .bind(&conversation.owner_user_id)
        .bind(&conversation.title)
        .bind(&conversation.created_at)
        .bind(&conversation.updated_at)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        Ok(conversation.clone())
    }

    async fn find_conversation(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
    ) -> Result<Option<ChatConversationPayload>, String> {
        let tenant_id = Self::require_tenant_id(&ctx.tenant_id)?;
        let row = sqlx::query(
            "SELECT id, title, owner_user_id, created_at, updated_at \
             FROM chat_conversation \
             WHERE id = ?1 AND tenant_id = ?2 AND {IS_NOT_DELETED}",
        )
        .bind(conversation_id)
        .bind(tenant_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        row.as_ref()
            .map(Self::map_conversation_row)
            .transpose()
            .map_err(|e| e.to_string())
    }

    async fn delete_conversation(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
    ) -> Result<(), String> {
        let tenant_id = Self::require_tenant_id(&ctx.tenant_id)?;
        let now = Self::now_iso();
        let result = sqlx::query(
            "UPDATE chat_conversation SET {SET_SOFT_DELETED}, updated_at = ?1 \
             WHERE id = ?2 AND tenant_id = ?3 AND owner_user_id = ?4 AND {IS_NOT_DELETED}",
        )
        .bind(now)
        .bind(conversation_id)
        .bind(tenant_id)
        .bind(&ctx.user_id)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        if result.rows_affected() == 0 {
            return Err(format!("conversation {conversation_id} not found"));
        }
        Ok(())
    }

    async fn list_messages(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
        query: &ChatListQuery,
    ) -> Result<(Vec<ChatMessagePayload>, i64), String> {
        let tenant_id = Self::require_tenant_id(&ctx.tenant_id)?;
        let count_row = sqlx::query(
            "SELECT COUNT(*) AS total FROM chat_message \
             WHERE conversation_id = ?1 AND tenant_id = ?2 AND {IS_NOT_DELETED}",
        )
        .bind(conversation_id)
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| e.to_string())?;
        let total: i64 = count_row.try_get("total").map_err(|e| e.to_string())?;

        let rows = sqlx::query(
            "SELECT id, conversation_id, role, content, created_at \
             FROM chat_message \
             WHERE conversation_id = ?1 AND tenant_id = ?2 AND {IS_NOT_DELETED} \
             ORDER BY created_at ASC LIMIT ?3 OFFSET ?4",
        )
        .bind(conversation_id)
        .bind(tenant_id)
        .bind(query.limit)
        .bind(query.offset)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let items = rows
            .iter()
            .map(Self::map_message_row)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok((items, total))
    }

    async fn create_message(
        &self,
        ctx: &ChatContext,
        conversation_id: &str,
        message: &ChatMessagePayload,
    ) -> Result<ChatMessagePayload, String> {
        let tenant_id = Self::require_tenant_id(&ctx.tenant_id)?;
        sqlx::query(
            "INSERT INTO chat_message (id, tenant_id, conversation_id, role, content, created_at, is_deleted) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0)",
        )
        .bind(&message.id)
        .bind(tenant_id)
        .bind(conversation_id)
        .bind(&message.role)
        .bind(&message.content)
        .bind(&message.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        let now = Self::now_iso();
        sqlx::query(
            "UPDATE chat_conversation SET updated_at = ?1 \
             WHERE id = ?2 AND tenant_id = ?3 AND {IS_NOT_DELETED}",
        )
        .bind(now)
        .bind(conversation_id)
        .bind(tenant_id)
        .execute(&self.pool)
        .await
        .map_err(|e| e.to_string())?;

        Ok(message.clone())
    }
}
