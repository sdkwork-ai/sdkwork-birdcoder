use std::collections::BTreeMap;

use sqlx::{AnyPool, Row};
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::commands::{
    CreateCodingSessionInput, CreateCodingSessionTurnInput, EditCodingSessionMessageInput,
    ForkCodingSessionInput, SubmitApprovalDecisionInput, SubmitUserQuestionAnswerInput,
    UpdateCodingSessionInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionListQuery;
use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    ApprovalDecisionPayload, CodingSessionArtifactPayload, CodingSessionCheckpointPayload,
    CodingSessionEventPayload, CodingSessionListPage, CodingSessionPayload, CodingSessionTurnPayload,
    DeleteCodingSessionMessagePayload, EditCodingSessionMessagePayload,
    FinalizedProjectionTurnExecution, OperationPayload, UserQuestionAnswerPayload,
};
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::db::columns;
use crate::db::rows::*;
use crate::error::{map_sqlx_error, RepositoryError};
use crate::mapper::row_mapper;
use crate::repository::sqlx_helpers::{
    append_session_tenant_scope_sql, ensure_session_in_tenant_scope, ensure_workspace_in_tenant_scope,
};

#[derive(Clone)]
pub struct SqliteCodingSessionRepository {
    pool: AnyPool,
}

impl SqliteCodingSessionRepository {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }

    fn now_iso() -> String {
        OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
    }

    fn append_session_list_filters(sql: &mut String, query: &CodingSessionListQuery) {
        if query.engine_id.is_some() {
            sql.push_str(&format!(" AND s.{} = ?", columns::session::ENGINE_ID));
        }
        if query.project_id.is_some() {
            sql.push_str(&format!(" AND s.{} = ?", columns::session::PROJECT_ID));
        }
        if query.workspace_id.is_some() {
            sql.push_str(&format!(" AND s.{} = ?", columns::session::WORKSPACE_ID));
        }
    }

    async fn load_message_row(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        message_id: &str,
    ) -> Result<MessageRow, CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let row = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = ? AND {} = 0",
                columns::message::TABLE,
                columns::message::ID,
                columns::message::CODING_SESSION_ID,
                columns::message::IS_DELETED,
            ))
            .bind(message_id)
            .bind(session_id)
            .fetch_optional(&self.pool)
            .await,
        )?
        .ok_or_else(|| {
            RepositoryError::NotFound(format!("message {message_id} not found"))
        })?;

        Ok(map_sqlx_error(MessageRow::from_row(&row))?)
    }

    async fn next_event_sequence(&self, session_id: &str) -> Result<usize, CodingSessionError> {
        let max_sequence = map_sqlx_error(
            sqlx::query_scalar::<_, i64>(&format!(
                "SELECT COALESCE(MAX({}), 0) FROM {} WHERE {} = ? AND {} = 0",
                columns::event::SEQUENCE_NO,
                columns::event::TABLE,
                columns::event::CODING_SESSION_ID,
                columns::event::IS_DELETED,
            ))
            .bind(session_id)
            .fetch_one(&self.pool)
            .await,
        )?;

        Ok((max_sequence + 1) as usize)
    }

    async fn insert_coding_session_event(
        &self,
        session_id: &str,
        turn_id: Option<String>,
        runtime_id: Option<String>,
        kind: &str,
        payload: BTreeMap<String, serde_json::Value>,
    ) -> Result<(), CodingSessionError> {
        let event_id = Uuid::new_v4().to_string();
        let now = Self::now_iso();
        let sequence = self.next_event_sequence(session_id).await?;
        let payload_json = serde_json::to_string(&payload)
            .map_err(|error| RepositoryError::Insert(error.to_string()))?;

        sqlx::query(&format!(
            "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            columns::event::TABLE,
            columns::event::ID,
            columns::event::CREATED_AT,
            columns::event::UPDATED_AT,
            columns::event::VERSION,
            columns::event::IS_DELETED,
            columns::event::CODING_SESSION_ID,
            columns::event::TURN_ID,
            columns::event::RUNTIME_ID,
            columns::event::EVENT_KIND,
            columns::event::SEQUENCE_NO,
            columns::event::PAYLOAD_JSON,
        ))
        .bind(&event_id)
        .bind(&now)
        .bind(&now)
        .bind(0i64)
        .bind(0i64)
        .bind(session_id)
        .bind(&turn_id)
        .bind(&runtime_id)
        .bind(kind)
        .bind(sequence as i64)
        .bind(&payload_json)
        .execute(&self.pool)
        .await
        .map_err(|error| RepositoryError::Insert(error.to_string()))?;

        Ok(())
    }

    async fn touch_session_transcript(&self, session_id: &str) -> Result<(), CodingSessionError> {
        let now = Self::now_iso();

        sqlx::query(&format!(
            "UPDATE {} SET {} = ?, {} = ?, {} = {} + 1 WHERE {} = ? AND {} = 0",
            columns::session::TABLE,
            columns::session::TRANSCRIPT_UPDATED_AT,
            columns::session::UPDATED_AT,
            columns::session::VERSION,
            columns::session::VERSION,
            columns::session::ID,
            columns::session::IS_DELETED,
        ))
        .bind(&now)
        .bind(&now)
        .bind(session_id)
        .execute(&self.pool)
        .await
        .map_err(|error| RepositoryError::Update(error.to_string()))?;

        Ok(())
    }
}

#[async_trait::async_trait]
impl CodingSessionRepository for SqliteCodingSessionRepository {
    async fn list_sessions(
        &self,
        ctx: &CodingSessionContext,
        query: &CodingSessionListQuery,
    ) -> Result<CodingSessionListPage, CodingSessionError> {
        let mut filter_sql = String::from(" WHERE s.is_deleted = 0");
        let tenant_id = append_session_tenant_scope_sql(ctx, "s", &mut filter_sql)?;
        Self::append_session_list_filters(&mut filter_sql, query);

        let count_sql = format!("SELECT COUNT(*) AS total FROM ai_coding_session s{filter_sql}");
        let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
        if let Some(ref engine_id) = query.engine_id {
            count_query = count_query.bind(engine_id);
        }
        if let Some(ref project_id) = query.project_id {
            count_query = count_query.bind(project_id);
        }
        if let Some(ref workspace_id) = query.workspace_id {
            count_query = count_query.bind(workspace_id);
        }
        count_query = count_query.bind(tenant_id);
        let total = map_sqlx_error(count_query.fetch_one(&self.pool).await)? as usize;

        let mut select_sql = String::from(
            "SELECT s.*, r.status AS runtime_status FROM ai_coding_session s \
             LEFT JOIN (SELECT coding_session_id, status FROM ai_coding_session_runtime \
             WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 1) r \
             ON r.coding_session_id = s.id",
        );
        select_sql.push_str(&filter_sql);
        select_sql.push_str(" ORDER BY s.sort_timestamp DESC");

        if let Some(limit) = query.limit {
            select_sql.push_str(&format!(" LIMIT {limit}"));
        }
        if let Some(offset) = query.offset {
            select_sql.push_str(&format!(" OFFSET {offset}"));
        }

        let mut list_query = sqlx::query(&select_sql);
        if let Some(ref engine_id) = query.engine_id {
            list_query = list_query.bind(engine_id);
        }
        if let Some(ref project_id) = query.project_id {
            list_query = list_query.bind(project_id);
        }
        if let Some(ref workspace_id) = query.workspace_id {
            list_query = list_query.bind(workspace_id);
        }
        list_query = list_query.bind(tenant_id);
        let rows = map_sqlx_error(list_query.fetch_all(&self.pool).await)?;

        let mut items = Vec::new();
        for row in rows {
            let session = map_sqlx_error(SessionRow::from_row(&row))?;
            let runtime_status: Option<String> = None;
            items.push(row_mapper::session_row_to_payload(session, runtime_status));
        }

        Ok(CodingSessionListPage { items, total })
    }

    async fn get_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0",
            columns::session::TABLE,
            columns::session::ID,
            columns::session::IS_DELETED,
        );
        let tenant_id = append_session_tenant_scope_sql(ctx, columns::session::TABLE, &mut sql)?;

        let row = map_sqlx_error(
            sqlx::query(&sql)
                .bind(session_id)
                .bind(tenant_id)
                .fetch_optional(&self.pool)
                .await,
        )?
            .ok_or_else(|| RepositoryError::NotFound(format!("session {session_id} not found")))?;

        let session = map_sqlx_error(SessionRow::from_row(&row))?;

        let runtime_status = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT {} FROM {} WHERE {} = ? AND {} = 0 ORDER BY {} DESC LIMIT 1",
                columns::runtime::STATUS,
                columns::runtime::TABLE,
                columns::runtime::CODING_SESSION_ID,
                columns::runtime::IS_DELETED,
                columns::runtime::CREATED_AT,
            ))
            .bind(session_id)
            .fetch_optional(&self.pool)
            .await,
        )?
        .and_then(|row| row.try_get::<String, _>(0).ok());

        Ok(row_mapper::session_row_to_payload(session, runtime_status))
    }

    async fn create_session(
        &self,
        ctx: &CodingSessionContext,
        input: &CreateCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let now = Self::now_iso();
        let id = Uuid::new_v4().to_string();
        let workspace_id = input.workspace_id.clone();
        let project_id = input.project_id.clone();
        let title = input.title.clone();
        let host_mode = input.host_mode.clone();
        let engine_id = input.engine_id.clone();
        let model_id = input.model_id.clone();
        let sort_timestamp = OffsetDateTime::now_utc().unix_timestamp();

        ensure_workspace_in_tenant_scope(&self.pool, ctx, &workspace_id)
            .await
            .map_err(CodingSessionError::from)?;

        sqlx::query(&format!(
            "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            columns::session::TABLE,
            columns::session::ID,
            columns::session::UUID,
            columns::session::CREATED_AT,
            columns::session::UPDATED_AT,
            columns::session::VERSION,
            columns::session::IS_DELETED,
            columns::session::WORKSPACE_ID,
            columns::session::PROJECT_ID,
            columns::session::TITLE,
            columns::session::STATUS,
            columns::session::ENTRY_SURFACE,
            columns::session::HOST_MODE,
            columns::session::ENGINE_ID,
            columns::session::MODEL_ID,
            columns::session::SORT_TIMESTAMP,
        ))
        .bind(&id)
        .bind(None::<String>)
        .bind(&now)
        .bind(&now)
        .bind(0i64)
        .bind(0i64)
        .bind(&workspace_id)
        .bind(&project_id)
        .bind(&title)
        .bind("active")
        .bind("unknown")
        .bind(&host_mode)
        .bind(&engine_id)
        .bind(&model_id)
        .bind(sort_timestamp)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::Insert(e.to_string()))?;

        Ok(CodingSessionPayload {
            id,
            workspace_id,
            project_id,
            title,
            status: "active".to_string(),
            host_mode,
            engine_id,
            model_id,
            native_session_id: None,
            created_at: now.clone(),
            updated_at: now,
            last_turn_at: None,
            runtime_status: None,
            sort_timestamp,
            transcript_updated_at: None,
        })
    }

    async fn update_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        input: &UpdateCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let now = Self::now_iso();

        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let mut sets = Vec::new();
        if input.title.is_some() {
            sets.push(format!("{} = ?", columns::session::TITLE));
        }
        if input.status.is_some() {
            sets.push(format!("{} = ?", columns::session::STATUS));
        }
        if input.host_mode.is_some() {
            sets.push(format!("{} = ?", columns::session::HOST_MODE));
        }
        if input.engine_id.is_some() {
            sets.push(format!("{} = ?", columns::session::ENGINE_ID));
        }
        if input.model_id.is_some() {
            sets.push(format!("{} = ?", columns::session::MODEL_ID));
        }
        sets.push(format!("{} = ?", columns::session::UPDATED_AT));
        sets.push(format!(
            "{} = {} + 1",
            columns::session::VERSION, columns::session::VERSION
        ));

        let sql = format!(
            "UPDATE {} SET {} WHERE {} = ? AND {} = 0",
            columns::session::TABLE,
            sets.join(", "),
            columns::session::ID,
            columns::session::IS_DELETED,
        );

        let mut q = sqlx::query(&sql);
        if let Some(ref title) = input.title {
            q = q.bind(title);
        }
        if let Some(ref status) = input.status {
            q = q.bind(status);
        }
        if let Some(ref host_mode) = input.host_mode {
            q = q.bind(host_mode);
        }
        if let Some(ref engine_id) = input.engine_id {
            q = q.bind(engine_id);
        }
        if let Some(ref model_id) = input.model_id {
            q = q.bind(model_id);
        }
        q = q.bind(&now).bind(session_id);

        let result = q
            .execute(&self.pool)
            .await
            .map_err(|e| RepositoryError::Update(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!("session {session_id} not found")).into());
        }

        let row = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ?",
                columns::session::TABLE,
                columns::session::ID,
            ))
            .bind(session_id)
            .fetch_one(&self.pool)
            .await,
        )?;

        Ok(row_mapper::session_row_to_payload(
            map_sqlx_error(SessionRow::from_row(&row))?,
            None,
        ))
    }

    async fn delete_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<(), CodingSessionError> {
        let now = Self::now_iso();

        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let result = sqlx::query(&format!(
            "UPDATE {} SET {} = 1, {} = ?, {} = {} + 1 WHERE {} = ? AND {} = 0",
            columns::session::TABLE,
            columns::session::IS_DELETED,
            columns::session::UPDATED_AT,
            columns::session::VERSION,
            columns::session::VERSION,
            columns::session::ID,
            columns::session::IS_DELETED,
        ))
        .bind(&now)
        .bind(session_id)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::Delete(e.to_string()))?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!("session {session_id} not found")).into());
        }
        Ok(())
    }

    async fn fork_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        input: &ForkCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let row = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = 0",
                columns::session::TABLE,
                columns::session::ID,
                columns::session::IS_DELETED,
            ))
            .bind(session_id)
            .fetch_optional(&self.pool)
            .await,
        )?
        .ok_or_else(|| RepositoryError::NotFound(format!("session {session_id} not found")))?;

        let original = map_sqlx_error(SessionRow::from_row(&row))?;
        let now = Self::now_iso();
        let new_id = Uuid::new_v4().to_string();
        let title = input
            .title
            .clone()
            .unwrap_or_else(|| format!("{} (fork)", original.title));
        let sort_timestamp = OffsetDateTime::now_utc().unix_timestamp();

        sqlx::query(&format!(
            "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            columns::session::TABLE,
            columns::session::ID,
            columns::session::UUID,
            columns::session::CREATED_AT,
            columns::session::UPDATED_AT,
            columns::session::VERSION,
            columns::session::IS_DELETED,
            columns::session::WORKSPACE_ID,
            columns::session::PROJECT_ID,
            columns::session::TITLE,
            columns::session::STATUS,
            columns::session::ENTRY_SURFACE,
            columns::session::HOST_MODE,
            columns::session::ENGINE_ID,
            columns::session::MODEL_ID,
            columns::session::SORT_TIMESTAMP,
        ))
        .bind(&new_id)
        .bind(None::<String>)
        .bind(&now)
        .bind(&now)
        .bind(0i64)
        .bind(0i64)
        .bind(&original.workspace_id)
        .bind(&original.project_id)
        .bind(&title)
        .bind("active")
        .bind(&original.entry_surface)
        .bind(&original.host_mode)
        .bind(&original.engine_id)
        .bind(&original.model_id)
        .bind(sort_timestamp)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::Insert(e.to_string()))?;

        Ok(CodingSessionPayload {
            id: new_id,
            workspace_id: original.workspace_id,
            project_id: original.project_id,
            title,
            status: "active".to_string(),
            host_mode: original.host_mode,
            engine_id: original.engine_id,
            model_id: original.model_id,
            native_session_id: None,
            created_at: now.clone(),
            updated_at: now,
            last_turn_at: None,
            runtime_status: None,
            sort_timestamp,
            transcript_updated_at: None,
        })
    }

    async fn copy_session_history(
        &self,
        ctx: &CodingSessionContext,
        source_session_id: &str,
        target_session_id: &str,
    ) -> Result<usize, CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, source_session_id).await?;
        ensure_session_in_tenant_scope(&self.pool, ctx, target_session_id).await?;

        let now = Self::now_iso();
        let mut total_copied: usize = 0;

        // Copy messages
        let source_messages = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = 0 ORDER BY {} ASC",
                columns::message::TABLE,
                columns::message::CODING_SESSION_ID,
                columns::message::IS_DELETED,
                columns::message::CREATED_AT,
            ))
            .bind(source_session_id)
            .fetch_all(&self.pool)
            .await,
        )?;

        for row in &source_messages {
            let new_id = Uuid::new_v4().to_string();
            let original_id: String = row
                .try_get(columns::message::ID)
                .unwrap_or_default();
            let turn_id: Option<String> = row.try_get(columns::message::TURN_ID).ok().flatten();
            let role: String = row.try_get(columns::message::ROLE).unwrap_or_default();
            let content: String = row.try_get(columns::message::CONTENT).unwrap_or_default();
            let metadata_json: String =
                row.try_get(columns::message::METADATA_JSON).unwrap_or_default();
            let timestamp_ms: Option<i64> =
                row.try_get(columns::message::TIMESTAMP_MS).ok().flatten();
            let name: Option<String> = row.try_get(columns::message::NAME).ok().flatten();
            let tool_calls_json: Option<String> =
                row.try_get(columns::message::TOOL_CALLS_JSON).ok().flatten();
            let tool_call_id: Option<String> =
                row.try_get(columns::message::TOOL_CALL_ID).ok().flatten();
            let file_changes_json: Option<String> =
                row.try_get(columns::message::FILE_CHANGES_JSON).ok().flatten();
            let commands_json: Option<String> =
                row.try_get(columns::message::COMMANDS_JSON).ok().flatten();
            let task_progress_json: Option<String> =
                row.try_get(columns::message::TASK_PROGRESS_JSON).ok().flatten();

            map_sqlx_error(
                sqlx::query(&format!(
                    "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                     VALUES (?, NULL, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    columns::message::TABLE,
                    columns::message::ID,
                    columns::message::UUID,
                    columns::message::CREATED_AT,
                    columns::message::UPDATED_AT,
                    columns::message::VERSION,
                    columns::message::IS_DELETED,
                    columns::message::CODING_SESSION_ID,
                    columns::message::TURN_ID,
                    columns::message::ROLE,
                    columns::message::CONTENT,
                    columns::message::METADATA_JSON,
                    columns::message::TIMESTAMP_MS,
                    columns::message::NAME,
                    columns::message::TOOL_CALLS_JSON,
                    columns::message::TOOL_CALL_ID,
                    columns::message::FILE_CHANGES_JSON,
                    columns::message::COMMANDS_JSON,
                    columns::message::TASK_PROGRESS_JSON,
                ))
                .bind(&new_id)
                .bind(&now)
                .bind(&now)
                .bind(target_session_id)
                .bind(&turn_id)
                .bind(&role)
                .bind(&content)
                .bind(&metadata_json)
                .bind(timestamp_ms)
                .bind(&name)
                .bind(&tool_calls_json)
                .bind(&tool_call_id)
                .bind(&file_changes_json)
                .bind(&commands_json)
                .bind(&task_progress_json)
                .execute(&self.pool)
                .await,
            )?;
            total_copied += 1;
            let _ = original_id;
        }

        // Copy turns
        let source_turns = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = 0 ORDER BY {} ASC",
                columns::turn::TABLE,
                columns::turn::CODING_SESSION_ID,
                columns::turn::IS_DELETED,
                columns::turn::CREATED_AT,
            ))
            .bind(source_session_id)
            .fetch_all(&self.pool)
            .await,
        )?;

        for row in &source_turns {
            let new_id = Uuid::new_v4().to_string();
            let runtime_id: Option<String> =
                row.try_get(columns::turn::RUNTIME_ID).ok().flatten();
            let request_kind: String =
                row.try_get(columns::turn::REQUEST_KIND).unwrap_or_default();
            let status: String = row.try_get(columns::turn::STATUS).unwrap_or_default();
            let input_summary: String =
                row.try_get(columns::turn::INPUT_SUMMARY).unwrap_or_default();
            let started_at: Option<String> =
                row.try_get(columns::turn::STARTED_AT).ok().flatten();
            let completed_at: Option<String> =
                row.try_get(columns::turn::COMPLETED_AT).ok().flatten();

            map_sqlx_error(
                sqlx::query(&format!(
                    "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                     VALUES (?, NULL, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)",
                    columns::turn::TABLE,
                    columns::turn::ID,
                    columns::turn::UUID,
                    columns::turn::CREATED_AT,
                    columns::turn::UPDATED_AT,
                    columns::turn::VERSION,
                    columns::turn::IS_DELETED,
                    columns::turn::CODING_SESSION_ID,
                    columns::turn::RUNTIME_ID,
                    columns::turn::REQUEST_KIND,
                    columns::turn::STATUS,
                    columns::turn::INPUT_SUMMARY,
                    columns::turn::STARTED_AT,
                    columns::turn::COMPLETED_AT,
                ))
                .bind(&new_id)
                .bind(&now)
                .bind(&now)
                .bind(target_session_id)
                .bind(&runtime_id)
                .bind(&request_kind)
                .bind(&status)
                .bind(&input_summary)
                .bind(&started_at)
                .bind(&completed_at)
                .execute(&self.pool)
                .await,
            )?;
            total_copied += 1;
        }

        // Copy events
        let source_events = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = 0 ORDER BY {} ASC",
                columns::event::TABLE,
                columns::event::CODING_SESSION_ID,
                columns::event::IS_DELETED,
                columns::event::SEQUENCE_NO,
            ))
            .bind(source_session_id)
            .fetch_all(&self.pool)
            .await,
        )?;

        for row in &source_events {
            let new_id = Uuid::new_v4().to_string();
            let turn_id: Option<String> = row.try_get(columns::event::TURN_ID).ok().flatten();
            let runtime_id: Option<String> =
                row.try_get(columns::event::RUNTIME_ID).ok().flatten();
            let event_kind: String = row.try_get(columns::event::EVENT_KIND).unwrap_or_default();
            let sequence_no: i32 = row.try_get(columns::event::SEQUENCE_NO).unwrap_or(0);
            let payload_json: String =
                row.try_get(columns::event::PAYLOAD_JSON).unwrap_or_default();

            map_sqlx_error(
                sqlx::query(&format!(
                    "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                     VALUES (?, NULL, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)",
                    columns::event::TABLE,
                    columns::event::ID,
                    columns::event::UUID,
                    columns::event::CREATED_AT,
                    columns::event::UPDATED_AT,
                    columns::event::VERSION,
                    columns::event::IS_DELETED,
                    columns::event::CODING_SESSION_ID,
                    columns::event::TURN_ID,
                    columns::event::RUNTIME_ID,
                    columns::event::EVENT_KIND,
                    columns::event::SEQUENCE_NO,
                    columns::event::PAYLOAD_JSON,
                ))
                .bind(&new_id)
                .bind(&now)
                .bind(&now)
                .bind(target_session_id)
                .bind(&turn_id)
                .bind(&runtime_id)
                .bind(&event_kind)
                .bind(sequence_no)
                .bind(&payload_json)
                .execute(&self.pool)
                .await,
            )?;
            total_copied += 1;
        }

        // Copy artifacts
        let source_artifacts = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = 0 ORDER BY {} ASC",
                columns::artifact::TABLE,
                columns::artifact::CODING_SESSION_ID,
                columns::artifact::IS_DELETED,
                columns::artifact::CREATED_AT,
            ))
            .bind(source_session_id)
            .fetch_all(&self.pool)
            .await,
        )?;

        for row in &source_artifacts {
            let new_id = Uuid::new_v4().to_string();
            let turn_id: Option<String> =
                row.try_get(columns::artifact::TURN_ID).ok().flatten();
            let artifact_kind: String =
                row.try_get(columns::artifact::ARTIFACT_KIND).unwrap_or_default();
            let title: String = row.try_get(columns::artifact::TITLE).unwrap_or_default();
            let blob_ref: Option<String> =
                row.try_get(columns::artifact::BLOB_REF).ok().flatten();
            let metadata_json: String =
                row.try_get(columns::artifact::METADATA_JSON).unwrap_or_default();

            map_sqlx_error(
                sqlx::query(&format!(
                    "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                     VALUES (?, NULL, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)",
                    columns::artifact::TABLE,
                    columns::artifact::ID,
                    columns::artifact::UUID,
                    columns::artifact::CREATED_AT,
                    columns::artifact::UPDATED_AT,
                    columns::artifact::VERSION,
                    columns::artifact::IS_DELETED,
                    columns::artifact::CODING_SESSION_ID,
                    columns::artifact::TURN_ID,
                    columns::artifact::ARTIFACT_KIND,
                    columns::artifact::TITLE,
                    columns::artifact::BLOB_REF,
                    columns::artifact::METADATA_JSON,
                ))
                .bind(&new_id)
                .bind(&now)
                .bind(&now)
                .bind(target_session_id)
                .bind(&turn_id)
                .bind(&artifact_kind)
                .bind(&title)
                .bind(&blob_ref)
                .bind(&metadata_json)
                .execute(&self.pool)
                .await,
            )?;
            total_copied += 1;
        }

        Ok(total_copied)
    }

    async fn list_turns(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionTurnPayload>, CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let rows = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = 0 ORDER BY {} ASC",
                columns::turn::TABLE,
                columns::turn::CODING_SESSION_ID,
                columns::turn::IS_DELETED,
                columns::turn::CREATED_AT,
            ))
            .bind(session_id)
            .fetch_all(&self.pool)
            .await,
        )?;

        rows.iter()
            .map(|row| {
                Ok(row_mapper::turn_row_to_payload(map_sqlx_error(TurnRow::from_row(row))?))
            })
            .collect()
    }

    async fn get_turn(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        turn_id: &str,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let row = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = ? AND {} = 0",
                columns::turn::TABLE,
                columns::turn::ID,
                columns::turn::CODING_SESSION_ID,
                columns::turn::IS_DELETED,
            ))
            .bind(turn_id)
            .bind(session_id)
            .fetch_optional(&self.pool)
            .await,
        )?
        .ok_or_else(|| RepositoryError::NotFound(format!("turn {turn_id} not found")))?;

        Ok(row_mapper::turn_row_to_payload(map_sqlx_error(TurnRow::from_row(&row))?))
    }

    async fn create_turn(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        input: &CreateCodingSessionTurnInput,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError> {
        let now = Self::now_iso();
        let turn_id = Uuid::new_v4().to_string();
        let runtime_id = input
            .runtime_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let request_kind = input.request_kind.clone();
        let input_summary = input.input_summary.clone();

        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        sqlx::query(&format!(
            "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            columns::turn::TABLE,
            columns::turn::ID,
            columns::turn::CREATED_AT,
            columns::turn::UPDATED_AT,
            columns::turn::VERSION,
            columns::turn::IS_DELETED,
            columns::turn::CODING_SESSION_ID,
            columns::turn::RUNTIME_ID,
            columns::turn::REQUEST_KIND,
            columns::turn::STATUS,
            columns::turn::INPUT_SUMMARY,
        ))
        .bind(&turn_id)
        .bind(&now)
        .bind(&now)
        .bind(0i64)
        .bind(0i64)
        .bind(session_id)
        .bind(&runtime_id)
        .bind(&request_kind)
        .bind("pending")
        .bind(&input_summary)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::Insert(e.to_string()))?;

        sqlx::query(&format!(
            "UPDATE {} SET {} = ?, {} = ? WHERE {} = ?",
            columns::session::TABLE,
            columns::session::LAST_TURN_AT,
            columns::session::UPDATED_AT,
            columns::session::ID,
        ))
        .bind(&now)
        .bind(&now)
        .bind(session_id)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::Insert(e.to_string()))?;

        Ok(CodingSessionTurnPayload {
            id: turn_id,
            coding_session_id: session_id.to_string(),
            runtime_id: Some(runtime_id),
            request_kind,
            status: "pending".to_string(),
            input_summary,
            started_at: None,
            completed_at: None,
        })
    }

    async fn edit_message(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        message_id: &str,
        input: &EditCodingSessionMessageInput,
    ) -> Result<EditCodingSessionMessagePayload, CodingSessionError> {
        let message = self.load_message_row(ctx, session_id, message_id).await?;
        let content = input.content.clone();
        let now = Self::now_iso();

        sqlx::query(&format!(
            "UPDATE {} SET {} = ?, {} = ?, {} = {} + 1 WHERE {} = ? AND {} = ? AND {} = 0",
            columns::message::TABLE,
            columns::message::CONTENT,
            columns::message::UPDATED_AT,
            columns::message::VERSION,
            columns::message::VERSION,
            columns::message::ID,
            columns::message::CODING_SESSION_ID,
            columns::message::IS_DELETED,
        ))
        .bind(&content)
        .bind(&now)
        .bind(message_id)
        .bind(session_id)
        .execute(&self.pool)
        .await
        .map_err(|error| RepositoryError::Update(error.to_string()))?;

        let mut payload = BTreeMap::new();
        payload.insert(
            "editedMessageId".to_string(),
            serde_json::Value::String(message_id.to_string()),
        );
        payload.insert(
            "content".to_string(),
            serde_json::Value::String(content.clone()),
        );
        payload.insert(
            "role".to_string(),
            serde_json::Value::String(message.role.clone()),
        );

        self.insert_coding_session_event(
            session_id,
            message.turn_id.clone(),
            None,
            "message.edited",
            payload,
        )
        .await?;
        self.touch_session_transcript(session_id).await?;

        Ok(EditCodingSessionMessagePayload {
            id: message_id.to_string(),
            coding_session_id: session_id.to_string(),
            content,
        })
    }

    async fn delete_message(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        message_id: &str,
    ) -> Result<DeleteCodingSessionMessagePayload, CodingSessionError> {
        let message = self.load_message_row(ctx, session_id, message_id).await?;
        let now = Self::now_iso();

        sqlx::query(&format!(
            "UPDATE {} SET {} = 1, {} = ?, {} = {} + 1 WHERE {} = ? AND {} = ? AND {} = 0",
            columns::message::TABLE,
            columns::message::IS_DELETED,
            columns::message::UPDATED_AT,
            columns::message::VERSION,
            columns::message::VERSION,
            columns::message::ID,
            columns::message::CODING_SESSION_ID,
            columns::message::IS_DELETED,
        ))
        .bind(&now)
        .bind(message_id)
        .bind(session_id)
        .execute(&self.pool)
        .await
        .map_err(|error| RepositoryError::Update(error.to_string()))?;

        let mut payload = BTreeMap::new();
        payload.insert(
            "deletedMessageId".to_string(),
            serde_json::Value::String(message_id.to_string()),
        );
        payload.insert(
            "role".to_string(),
            serde_json::Value::String(message.role.clone()),
        );

        self.insert_coding_session_event(
            session_id,
            message.turn_id.clone(),
            None,
            "message.deleted",
            payload,
        )
        .await?;
        self.touch_session_transcript(session_id).await?;

        Ok(DeleteCodingSessionMessagePayload {
            id: message_id.to_string(),
            coding_session_id: session_id.to_string(),
        })
    }

    async fn list_events(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionEventPayload>, CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let rows = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = 0 ORDER BY {} ASC",
                columns::event::TABLE,
                columns::event::CODING_SESSION_ID,
                columns::event::IS_DELETED,
                columns::event::SEQUENCE_NO,
            ))
            .bind(session_id)
            .fetch_all(&self.pool)
            .await,
        )?;

        rows.iter()
            .map(|row| {
                Ok(row_mapper::event_row_to_payload(map_sqlx_error(EventRow::from_row(row))?))
            })
            .collect()
    }

    async fn list_artifacts(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionArtifactPayload>, CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let rows = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = 0 ORDER BY {} ASC",
                columns::artifact::TABLE,
                columns::artifact::CODING_SESSION_ID,
                columns::artifact::IS_DELETED,
                columns::artifact::CREATED_AT,
            ))
            .bind(session_id)
            .fetch_all(&self.pool)
            .await,
        )?;

        rows.iter()
            .map(|row| {
                Ok(row_mapper::artifact_row_to_payload(map_sqlx_error(ArtifactRow::from_row(
                    row,
                ))?))
            })
            .collect()
    }

    async fn list_checkpoints(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionCheckpointPayload>, CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let rows = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = 0 ORDER BY {} ASC",
                columns::checkpoint::TABLE,
                columns::checkpoint::CODING_SESSION_ID,
                columns::checkpoint::IS_DELETED,
                columns::checkpoint::CREATED_AT,
            ))
            .bind(session_id)
            .fetch_all(&self.pool)
            .await,
        )?;

        rows.iter()
            .map(|row| {
                Ok(row_mapper::checkpoint_row_to_payload(map_sqlx_error(
                    CheckpointRow::from_row(row),
                )?))
            })
            .collect()
    }

    async fn submit_approval_decision(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        checkpoint_id: &str,
        input: &SubmitApprovalDecisionInput,
    ) -> Result<ApprovalDecisionPayload, CodingSessionError> {
        let decision = input.decision.clone();
        let reason = input.reason.clone();

        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let row = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = ? AND {} = 0",
                columns::checkpoint::TABLE,
                columns::checkpoint::ID,
                columns::checkpoint::CODING_SESSION_ID,
                columns::checkpoint::IS_DELETED,
            ))
            .bind(checkpoint_id)
            .bind(session_id)
            .fetch_optional(&self.pool)
            .await,
        )?
        .ok_or_else(|| {
            RepositoryError::NotFound(format!("checkpoint {checkpoint_id} not found"))
        })?;

        let checkpoint = map_sqlx_error(CheckpointRow::from_row(&row))?;
        let runtime_id = checkpoint.runtime_id.clone();
        let mut state: BTreeMap<String, serde_json::Value> =
            serde_json::from_str(&checkpoint.state_json).unwrap_or_default();

        let approval_id = Uuid::new_v4().to_string();
        let now = Self::now_iso();

        let mut approvals: Vec<serde_json::Value> = state
            .get("approvals")
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .unwrap_or_default();

        approvals.push(serde_json::json!({
            "approvalId": approval_id,
            "decision": decision,
            "reason": reason,
            "decidedAt": now,
        }));

        state.insert(
            "approvals".to_string(),
            serde_json::to_value(&approvals).unwrap_or_default(),
        );

        let new_state_json = serde_json::to_string(&state).unwrap_or_else(|_| "{}".to_string());
        sqlx::query(&format!(
            "UPDATE {} SET {} = ?, {} = ?, {} = {} + 1 WHERE {} = ?",
            columns::checkpoint::TABLE,
            columns::checkpoint::STATE_JSON,
            columns::checkpoint::UPDATED_AT,
            columns::checkpoint::VERSION,
            columns::checkpoint::VERSION,
            columns::checkpoint::ID,
        ))
        .bind(&new_state_json)
        .bind(&now)
        .bind(checkpoint_id)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::Update(e.to_string()))?;

        Ok(ApprovalDecisionPayload {
            approval_id,
            checkpoint_id: checkpoint_id.to_string(),
            coding_session_id: session_id.to_string(),
            runtime_id,
            turn_id: None,
            operation_id: None,
            decision,
            reason,
            decided_at: now,
            runtime_status: "approved".to_string(),
            operation_status: "approved".to_string(),
        })
    }

    async fn submit_user_question_answer(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        question_id: &str,
        input: &SubmitUserQuestionAnswerInput,
    ) -> Result<UserQuestionAnswerPayload, CodingSessionError> {
        let answer = input.answer.clone();
        let option_id = input.option_id.clone();
        let option_label = input.option_label.clone();
        let rejected = input.rejected;

        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let row = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = ? AND {} = 0",
                columns::event::TABLE,
                columns::event::CODING_SESSION_ID,
                columns::event::ID,
                columns::event::IS_DELETED,
            ))
            .bind(session_id)
            .bind(question_id)
            .fetch_optional(&self.pool)
            .await,
        )?
        .ok_or_else(|| {
            RepositoryError::NotFound(format!("question event {question_id} not found"))
        })?;

        let event = map_sqlx_error(EventRow::from_row(&row))?;
        let runtime_id = event.runtime_id.clone();
        let turn_id = event.turn_id.clone();
        let mut payload: BTreeMap<String, serde_json::Value> =
            serde_json::from_str(&event.payload_json).unwrap_or_default();

        let now = Self::now_iso();
        if let Some(a) = &answer {
            payload.insert("answer".to_string(), serde_json::Value::String(a.clone()));
        }
        if let Some(oid) = &option_id {
            payload.insert("optionId".to_string(), serde_json::Value::String(oid.clone()));
        }
        if let Some(ol) = &option_label {
            payload.insert(
                "optionLabel".to_string(),
                serde_json::Value::String(ol.clone()),
            );
        }
        payload.insert("rejected".to_string(), serde_json::Value::Bool(rejected));
        payload.insert("answeredAt".to_string(), serde_json::Value::String(now.clone()));

        let new_payload_json = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
        sqlx::query(&format!(
            "UPDATE {} SET {} = ?, {} = ?, {} = {} + 1 WHERE {} = ?",
            columns::event::TABLE,
            columns::event::PAYLOAD_JSON,
            columns::event::UPDATED_AT,
            columns::event::VERSION,
            columns::event::VERSION,
            columns::event::ID,
        ))
        .bind(&new_payload_json)
        .bind(&now)
        .bind(question_id)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::Update(e.to_string()))?;

        Ok(UserQuestionAnswerPayload {
            question_id: question_id.to_string(),
            coding_session_id: session_id.to_string(),
            answer,
            answered_at: now,
            option_id,
            option_label,
            rejected,
            runtime_id,
            runtime_status: "answered".to_string(),
            turn_id,
        })
    }

    async fn get_operation(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        operation_id: &str,
    ) -> Result<OperationPayload, CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let row = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = ? AND {} = 0",
                columns::operation::TABLE,
                columns::operation::ID,
                columns::operation::CODING_SESSION_ID,
                columns::operation::IS_DELETED,
            ))
            .bind(operation_id)
            .bind(session_id)
            .fetch_optional(&self.pool)
            .await,
        )?
        .ok_or_else(|| {
            RepositoryError::NotFound(format!("operation {operation_id} not found"))
        })?;

        Ok(row_mapper::operation_row_to_payload(map_sqlx_error(
            OperationRow::from_row(&row),
        )?))
    }

    async fn finalize_turn_execution(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        finalized: &FinalizedProjectionTurnExecution,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError> {
        let turn = finalized.turn.clone();
        let turn_id = turn.id.clone();
        let now = Self::now_iso();

        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let started_at = turn.started_at.clone().unwrap_or_else(|| now.clone());
        let completed_at = turn.completed_at.clone().unwrap_or_else(|| now.clone());

        sqlx::query(&format!(
            "UPDATE {} SET {} = ?, {} = ?, {} = ?, {} = ?, {} = {} + 1 \
             WHERE {} = ? AND {} = ? AND {} = 0",
            columns::turn::TABLE,
            columns::turn::STATUS,
            columns::turn::STARTED_AT,
            columns::turn::COMPLETED_AT,
            columns::turn::UPDATED_AT,
            columns::turn::VERSION,
            columns::turn::VERSION,
            columns::turn::ID,
            columns::turn::CODING_SESSION_ID,
            columns::turn::IS_DELETED,
        ))
        .bind(&turn.status)
        .bind(&started_at)
        .bind(&completed_at)
        .bind(&now)
        .bind(&turn_id)
        .bind(session_id)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::Update(e.to_string()))?;

        for event in &finalized.events {
            let payload_json = serde_json::to_string(&event.payload)
                .map_err(|e| RepositoryError::Insert(e.to_string()))?;
            sqlx::query(&format!(
                "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                columns::event::TABLE,
                columns::event::ID,
                columns::event::CREATED_AT,
                columns::event::UPDATED_AT,
                columns::event::VERSION,
                columns::event::IS_DELETED,
                columns::event::CODING_SESSION_ID,
                columns::event::TURN_ID,
                columns::event::RUNTIME_ID,
                columns::event::EVENT_KIND,
                columns::event::SEQUENCE_NO,
                columns::event::PAYLOAD_JSON,
            ))
            .bind(&event.id)
            .bind(&event.created_at)
            .bind(&event.created_at)
            .bind(0i64)
            .bind(0i64)
            .bind(session_id)
            .bind(&event.turn_id)
            .bind(&event.runtime_id)
            .bind(&event.kind)
            .bind(event.sequence as i64)
            .bind(&payload_json)
            .execute(&self.pool)
            .await
            .map_err(|e| RepositoryError::Insert(e.to_string()))?;
        }

        Ok(turn)
    }

    async fn mark_turn_failed(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        turn_id: &str,
    ) -> Result<(), CodingSessionError> {
        let now = Self::now_iso();

        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        sqlx::query(&format!(
            "UPDATE {} SET {} = 'failed', {} = ?, {} = {} + 1 \
             WHERE {} = ? AND {} = ? AND {} = 0",
            columns::turn::TABLE,
            columns::turn::STATUS,
            columns::turn::UPDATED_AT,
            columns::turn::VERSION,
            columns::turn::VERSION,
            columns::turn::ID,
            columns::turn::CODING_SESSION_ID,
            columns::turn::IS_DELETED,
        ))
        .bind(&now)
        .bind(turn_id)
        .bind(session_id)
        .execute(&self.pool)
        .await
        .map_err(|e| RepositoryError::Update(e.to_string()))?;

        Ok(())
    }
}
