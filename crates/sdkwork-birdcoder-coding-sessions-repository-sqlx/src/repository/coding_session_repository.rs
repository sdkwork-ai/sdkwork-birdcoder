use std::collections::BTreeMap;

use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::commands::{
    CreateCodingSessionInput, CreateCodingSessionTurnInput, EditCodingSessionMessageInput,
    ForkCodingSessionInput, SubmitApprovalDecisionInput, SubmitUserQuestionAnswerInput,
    UpdateCodingSessionInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionListQuery;
use sdkwork_birdcoder_coding_sessions_service::domain::models::{
    ClaimCodingSessionOperationInput, CompleteCodingSessionOperationInput,
    DurableCodingSessionOperation, EnqueueCodingSessionOperationInput,
    FailCodingSessionOperationInput, RenewCodingSessionOperationLeaseInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    ApprovalDecisionPayload, CodingSessionArtifactPayload, CodingSessionCheckpointPayload,
    CodingSessionEventPayload, CodingSessionListPage, CodingSessionPayload,
    CodingSessionTurnPayload, DeleteCodingSessionMessagePayload, EditCodingSessionMessagePayload,
    FinalizedProjectionTurnExecution, OperationPayload, UserQuestionAnswerPayload,
};
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use sdkwork_birdcoder_sqlx_repository_pool::dialect::IS_NOT_DELETED;
use sqlx::{AnyPool, Row, Transaction};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::db::columns;
use crate::db::rows::*;
use crate::error::{map_sqlx_error, RepositoryError};
use crate::mapper::row_mapper;
use crate::repository::session_history_copy;
use crate::repository::sqlx_helpers::{
    append_session_owner_scope_sql, ensure_session_in_tenant_scope,
    ensure_session_in_tenant_scope_in_transaction, ensure_workspace_in_tenant_scope,
    parse_scoped_tenant_id, session_owner_scope,
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

    fn sort_timestamp_now() -> i64 {
        (OffsetDateTime::now_utc().unix_timestamp_nanos() / 1_000_000) as i64
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

    fn build_session_list_select_sql(
        filter_sql: &str,
        has_limit: bool,
        has_offset: bool,
    ) -> String {
        let runtime_is_not_deleted =
            sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("r");
        let mut select_sql = String::from(
            "WITH session_page AS MATERIALIZED (\
                 SELECT s.* FROM ai_coding_session s",
        );
        select_sql.push_str(filter_sql);
        select_sql.push_str(" ORDER BY s.sort_timestamp DESC, s.id DESC");
        if has_limit {
            select_sql.push_str(" LIMIT ?");
        }
        if has_offset {
            select_sql.push_str(" OFFSET ?");
        }
        select_sql.push_str(&format!(
            ") SELECT s.*, (\
                 SELECT r.status FROM ai_coding_session_runtime r \
                 WHERE r.coding_session_id = s.id AND {runtime_is_not_deleted} \
                 ORDER BY r.created_at DESC, r.id DESC LIMIT 1\
             ) AS runtime_status FROM session_page s \
             ORDER BY s.sort_timestamp DESC, s.id DESC",
        ));
        select_sql
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
        .ok_or_else(|| RepositoryError::NotFound(format!("message {message_id} not found")))?;

        map_sqlx_error(MessageRow::from_row(&row))
    }

    /// Allocates the next event sequence number within an existing database
    /// transaction to prevent race conditions where two concurrent requests
    /// could obtain the same sequence number.
    async fn next_event_sequence_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        session_id: &str,
    ) -> Result<usize, CodingSessionError> {
        let max_sequence = map_sqlx_error(
            sqlx::query_scalar::<sqlx::Any, i64>(&format!(
                "SELECT COALESCE(MAX({}), 0) FROM {} WHERE {} = ? AND {} = 0",
                columns::event::SEQUENCE_NO,
                columns::event::TABLE,
                columns::event::CODING_SESSION_ID,
                columns::event::IS_DELETED,
            ))
            .bind(session_id)
            .fetch_one(&mut **tx)
            .await,
        )?;

        Ok((max_sequence + 1) as usize)
    }

    /// Inserts a coding session event within an existing database transaction.
    /// The sequence number is allocated inside the same transaction to
    /// guarantee atomicity.
    async fn insert_coding_session_event_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        session_id: &str,
        turn_id: Option<String>,
        runtime_id: Option<String>,
        kind: &str,
        payload: BTreeMap<String, serde_json::Value>,
    ) -> Result<(), CodingSessionError> {
        let event_id = Uuid::new_v4().to_string();
        let now = Self::now_iso();
        let sequence = Self::next_event_sequence_on_executor(tx, session_id).await?;
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
        .execute(&mut **tx)
        .await
        .map_err(|error: sqlx::Error| RepositoryError::Insert(error.to_string()))?;

        Ok(())
    }

    /// Updates transcript timestamps within an existing database transaction.
    async fn touch_session_transcript_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        session_id: &str,
    ) -> Result<(), CodingSessionError> {
        let now = Self::now_iso();
        let sort_timestamp = Self::sort_timestamp_now();

        sqlx::query(&format!(
            "UPDATE {} SET {} = ?, {} = ?, {} = ?, {} = {} + 1 WHERE {} = ? AND {} = 0",
            columns::session::TABLE,
            columns::session::TRANSCRIPT_UPDATED_AT,
            columns::session::UPDATED_AT,
            columns::session::SORT_TIMESTAMP,
            columns::session::VERSION,
            columns::session::VERSION,
            columns::session::ID,
            columns::session::IS_DELETED,
        ))
        .bind(&now)
        .bind(&now)
        .bind(sort_timestamp)
        .bind(session_id)
        .execute(&mut **tx)
        .await
        .map_err(|error: sqlx::Error| RepositoryError::Update(error.to_string()))?;

        Ok(())
    }

    async fn is_postgres(&self) -> Result<bool, CodingSessionError> {
        let connection = self
            .pool
            .acquire()
            .await
            .map_err(|error| RepositoryError::Connection(error.to_string()))?;
        Ok(connection.backend_name().eq_ignore_ascii_case("PostgreSQL"))
    }
}

fn normalize_operation_instant(value: &str, field: &str) -> Result<String, CodingSessionError> {
    let parsed = time::OffsetDateTime::parse(
        value.trim(),
        &time::format_description::well_known::Iso8601::DEFAULT,
    )
    .map_err(|error| {
        CodingSessionError::InvalidInput(format!("{field} must be ISO-8601: {error}"))
    })?;
    let format = time::format_description::parse_borrowed::<2>(
        "[year]-[month]-[day]T[hour]:[minute]:[second].[subsecond digits:9]Z",
    )
    .map_err(|error| CodingSessionError::Internal(format!("invalid instant format: {error}")))?;
    parsed
        .to_offset(time::UtcOffset::UTC)
        .format(&format)
        .map_err(|error| {
            CodingSessionError::InvalidInput(format!("{field} cannot be formatted: {error}"))
        })
}

fn require_operation_text(value: &str, field: &str) -> Result<String, CodingSessionError> {
    let value = value.trim();
    if value.is_empty() {
        return Err(CodingSessionError::InvalidInput(format!(
            "{field} is required"
        )));
    }
    Ok(value.to_owned())
}

fn durable_operation_select_columns(alias: &str) -> String {
    format!(
        "{alias}.id AS id, {alias}.tenant_id AS tenant_id, {alias}.user_id AS user_id, \
         {alias}.coding_session_id AS coding_session_id, {alias}.turn_id AS turn_id, \
         {alias}.status AS status, {alias}.request_payload_json AS request_payload_json, \
         {alias}.request_fingerprint AS request_fingerprint, {alias}.idempotency_key AS idempotency_key, \
         {alias}.available_at AS available_at, {alias}.attempt AS attempt, \
         {alias}.max_attempt AS max_attempt, {alias}.lease_owner AS lease_owner, \
         {alias}.lease_expires_at AS lease_expires_at, {alias}.fencing_token AS fencing_token, \
         {alias}.runner_id AS runner_id, {alias}.started_at AS started_at, \
         {alias}.completed_at AS completed_at, {alias}.problem_json AS problem_json"
    )
}

fn durable_operation_return_columns() -> &'static str {
    "id AS id, tenant_id AS tenant_id, user_id AS user_id, \
     coding_session_id AS coding_session_id, turn_id AS turn_id, status AS status, \
     request_payload_json AS request_payload_json, request_fingerprint AS request_fingerprint, \
     idempotency_key AS idempotency_key, available_at AS available_at, attempt AS attempt, \
     max_attempt AS max_attempt, lease_owner AS lease_owner, lease_expires_at AS lease_expires_at, \
     fencing_token AS fencing_token, runner_id AS runner_id, started_at AS started_at, \
     completed_at AS completed_at, problem_json AS problem_json"
}

fn durable_operation_from_row(
    row: DurableOperationRow,
) -> Result<DurableCodingSessionOperation, CodingSessionError> {
    let request_payload = serde_json::from_str(&row.request_payload_json).map_err(|error| {
        RepositoryError::Mapping(format!("invalid operation request payload: {error}"))
    })?;
    let problem = row
        .problem_json
        .as_deref()
        .map(serde_json::from_str)
        .transpose()
        .map_err(|error| RepositoryError::Mapping(format!("invalid operation problem: {error}")))?;
    Ok(DurableCodingSessionOperation {
        id: row.id,
        tenant_id: row.tenant_id,
        user_id: row.user_id,
        coding_session_id: row.coding_session_id,
        turn_id: row.turn_id,
        status: row.status,
        request_payload,
        request_fingerprint: row.request_fingerprint,
        idempotency_key: row.idempotency_key,
        available_at: row.available_at,
        attempt: row.attempt,
        max_attempt: row.max_attempt,
        lease_owner: row.lease_owner,
        lease_expires_at: row.lease_expires_at,
        fencing_token: row.fencing_token,
        runner_id: row.runner_id,
        started_at: row.started_at,
        completed_at: row.completed_at,
        problem,
    })
}

fn resolve_project_root_path(
    config_data: Option<&str>,
    site_path: Option<&str>,
) -> Result<Option<String>, RepositoryError> {
    if let Some(config_data) = config_data.map(str::trim).filter(|value| !value.is_empty()) {
        let config: serde_json::Value = serde_json::from_str(config_data).map_err(|error| {
            RepositoryError::Query(format!("invalid project config_data: {error}"))
        })?;
        if let Some(root_path) = config
            .get("rootPath")
            .or_else(|| config.get("root_path"))
            .and_then(serde_json::Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            return Ok(Some(root_path.to_owned()));
        }
    }

    Ok(site_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned))
}

#[async_trait::async_trait]
impl CodingSessionRepository for SqliteCodingSessionRepository {
    async fn list_sessions(
        &self,
        ctx: &CodingSessionContext,
        query: &CodingSessionListQuery,
    ) -> Result<CodingSessionListPage, CodingSessionError> {
        let mut filter_sql = format!(
            " WHERE {}",
            sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("s")
        );
        Self::append_session_list_filters(&mut filter_sql, query);
        let owner_scope = append_session_owner_scope_sql(ctx, "s", &mut filter_sql)?;

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
        count_query = count_query
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id);
        let total = map_sqlx_error(count_query.fetch_one(&self.pool).await)? as usize;

        // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL as bind
        // parameters instead of string interpolation. Although `usize` cannot
        // produce SQL injection here, parameterized binding is required for
        // plan-cache stability and to keep a single code pattern across all
        // paginated repositories. The route layer has already strictly
        // validated page/page_size and projected both values into this query.
        let limit_value = query.page_size.map(|value| value as i64);
        let offset_value = query.offset.map(|value| value as i64);
        let select_sql = Self::build_session_list_select_sql(
            &filter_sql,
            limit_value.is_some(),
            offset_value.is_some(),
        );

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
        list_query = list_query
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id);
        if let Some(limit) = limit_value {
            list_query = list_query.bind(limit);
        }
        if let Some(offset) = offset_value {
            list_query = list_query.bind(offset);
        }
        let rows = map_sqlx_error(list_query.fetch_all(&self.pool).await)?;

        let mut items = Vec::new();
        for row in rows {
            let session = map_sqlx_error(SessionRow::from_row(&row))?;
            let runtime_status =
                map_sqlx_error(row.try_get::<Option<String>, _>("runtime_status"))?;
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
            "SELECT * FROM {} WHERE {} = ? AND {IS_NOT_DELETED}",
            columns::session::TABLE,
            columns::session::ID,
        );
        let owner_scope = append_session_owner_scope_sql(ctx, columns::session::TABLE, &mut sql)?;

        let row = map_sqlx_error(
            sqlx::query(&sql)
                .bind(session_id)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
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

    async fn resolve_project_working_directory(
        &self,
        ctx: &CodingSessionContext,
        project_id: &str,
    ) -> Result<Option<String>, CodingSessionError> {
        let project_id = project_id.trim();
        if project_id.is_empty() {
            return Ok(None);
        }
        let tenant_id = parse_scoped_tenant_id(ctx)?;
        let project_is_not_deleted =
            sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("p");
        let sql = sdkwork_birdcoder_sqlx_repository_pool::dialect::any_sql(&format!(
            "SELECT p.site_path, pc.config_data \
             FROM studio_project p \
             LEFT JOIN studio_project_content pc ON pc.project_id = p.id \
             WHERE CAST(p.id AS TEXT) = ?1 AND p.tenant_id = ?2 AND {project_is_not_deleted} \
             ORDER BY pc.updated_at DESC LIMIT 1"
        ));
        let row = sqlx::query(&sql)
            .bind(project_id)
            .bind(tenant_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|error| RepositoryError::Query(error.to_string()))?;
        let Some(row) = row else {
            return Ok(None);
        };

        let site_path = map_sqlx_error(row.try_get::<Option<String>, _>("site_path"))?;
        let config_data = map_sqlx_error(row.try_get::<Option<String>, _>("config_data"))?;
        resolve_project_root_path(config_data.as_deref(), site_path.as_deref())
            .map_err(CodingSessionError::from)
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
        let sort_timestamp = Self::sort_timestamp_now();
        let owner_scope = session_owner_scope(ctx)?;

        ensure_workspace_in_tenant_scope(&self.pool, ctx, &workspace_id)
            .await
            .map_err(CodingSessionError::from)?;

        sqlx::query(&format!(
            "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            columns::session::TABLE,
            columns::session::ID,
            columns::session::UUID,
            columns::session::CREATED_AT,
            columns::session::UPDATED_AT,
            columns::session::VERSION,
            columns::session::IS_DELETED,
            columns::session::TENANT_ID,
            columns::session::USER_ID,
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
        .bind(owner_scope.tenant_id)
        .bind(owner_scope.user_id)
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
            columns::session::VERSION,
            columns::session::VERSION
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
            return Err(
                RepositoryError::NotFound(format!("session {session_id} not found")).into(),
            );
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
            return Err(
                RepositoryError::NotFound(format!("session {session_id} not found")).into(),
            );
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
        let owner_scope = session_owner_scope(ctx)?;

        let row = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {IS_NOT_DELETED}",
                columns::session::TABLE,
                columns::session::ID,
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
        let sort_timestamp = Self::sort_timestamp_now();

        let mut tx = map_sqlx_error(self.pool.begin().await)?;

        map_sqlx_error(
            sqlx::query(&format!(
                "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                columns::session::TABLE,
                columns::session::ID,
                columns::session::UUID,
                columns::session::CREATED_AT,
                columns::session::UPDATED_AT,
                columns::session::VERSION,
                columns::session::IS_DELETED,
                columns::session::TENANT_ID,
                columns::session::USER_ID,
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
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(&original.workspace_id)
            .bind(&original.project_id)
            .bind(&title)
            .bind("active")
            .bind(&original.entry_surface)
            .bind(&original.host_mode)
            .bind(&original.engine_id)
            .bind(&original.model_id)
            .bind(sort_timestamp)
            .execute(&mut *tx)
            .await,
        )?;

        let payload = CodingSessionPayload {
            id: new_id.clone(),
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
        };

        if let Err(error) = session_history_copy::copy_session_history_in_transaction(
            &mut tx, ctx, session_id, &new_id,
        )
        .await
        {
            let _ = tx.rollback().await;
            return Err(error);
        }
        map_sqlx_error(tx.commit().await)?;

        Ok(payload)
    }

    async fn copy_session_history(
        &self,
        ctx: &CodingSessionContext,
        source_session_id: &str,
        target_session_id: &str,
    ) -> Result<usize, CodingSessionError> {
        session_history_copy::copy_session_history_on_pool(
            &self.pool,
            ctx,
            source_session_id,
            target_session_id,
        )
        .await
    }

    async fn list_turns(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionTurnPayload>, usize), CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        // PAGINATION_SPEC.md §2: push LIMIT/OFFSET to SQL, never unbounded collect.
        let total: i64 = map_sqlx_error(
            sqlx::query_scalar(&format!(
                "SELECT COUNT(*) FROM {} WHERE {} = ? AND {IS_NOT_DELETED}",
                columns::turn::TABLE,
                columns::turn::CODING_SESSION_ID,
            ))
            .bind(session_id)
            .fetch_one(&self.pool)
            .await,
        )?;

        let rows = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {IS_NOT_DELETED} ORDER BY {} ASC LIMIT ? OFFSET ?",
                columns::turn::TABLE,
                columns::turn::CODING_SESSION_ID,
                columns::turn::CREATED_AT,
            ))
            .bind(session_id)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await,
        )?;

        let items = rows
            .iter()
            .map(|row| {
                Ok(row_mapper::turn_row_to_payload(map_sqlx_error(
                    TurnRow::from_row(row),
                )?))
            })
            .collect::<Result<Vec<_>, CodingSessionError>>()?;

        Ok((items, total as usize))
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

        Ok(row_mapper::turn_row_to_payload(map_sqlx_error(
            TurnRow::from_row(&row),
        )?))
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
        let operation_id = format!("{turn_id}:operation");
        let owner_scope = session_owner_scope(ctx)?;

        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let mut tx = map_sqlx_error(self.pool.begin().await)?;

        map_sqlx_error(
            sqlx::query(&format!(
                "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                columns::turn::TABLE,
                columns::turn::ID,
                columns::turn::CREATED_AT,
                columns::turn::UPDATED_AT,
                columns::turn::VERSION,
                columns::turn::IS_DELETED,
                columns::turn::TENANT_ID,
                columns::turn::USER_ID,
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
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(session_id)
            .bind(&runtime_id)
            .bind(&request_kind)
            .bind("queued")
            .bind(&input_summary)
            .execute(&mut *tx)
            .await,
        )?;

        map_sqlx_error(
            sqlx::query(&format!(
                "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                columns::operation::TABLE,
                columns::operation::ID,
                columns::operation::CREATED_AT,
                columns::operation::UPDATED_AT,
                columns::operation::VERSION,
                columns::operation::IS_DELETED,
                columns::operation::TENANT_ID,
                columns::operation::USER_ID,
                columns::operation::CODING_SESSION_ID,
                columns::operation::TURN_ID,
                columns::operation::STATUS,
                columns::operation::STREAM_URL,
                columns::operation::STREAM_KIND,
                columns::operation::ARTIFACT_REFS_JSON,
            ))
            .bind(&operation_id)
            .bind(&now)
            .bind(&now)
            .bind(0i64)
            .bind(0i64)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(session_id)
            .bind(&turn_id)
            .bind("queued")
            .bind("")
            .bind("none")
            .bind("[]")
            .execute(&mut *tx)
            .await,
        )?;

        let sort_timestamp = Self::sort_timestamp_now();
        map_sqlx_error(
            sqlx::query(&format!(
                "UPDATE {} SET {} = ?, {} = ?, {} = ? WHERE {} = ?",
                columns::session::TABLE,
                columns::session::LAST_TURN_AT,
                columns::session::UPDATED_AT,
                columns::session::SORT_TIMESTAMP,
                columns::session::ID,
            ))
            .bind(&now)
            .bind(&now)
            .bind(sort_timestamp)
            .bind(session_id)
            .execute(&mut *tx)
            .await,
        )?;

        map_sqlx_error(tx.commit().await)?;

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

        let mut tx = map_sqlx_error(self.pool.begin().await)?;

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
        .execute(&mut *tx)
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

        Self::insert_coding_session_event_on_executor(
            &mut tx,
            session_id,
            message.turn_id.clone(),
            None,
            "message.edited",
            payload,
        )
        .await?;
        Self::touch_session_transcript_on_executor(&mut tx, session_id).await?;

        map_sqlx_error(tx.commit().await)?;

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

        let mut tx = map_sqlx_error(self.pool.begin().await)?;

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
        .execute(&mut *tx)
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

        Self::insert_coding_session_event_on_executor(
            &mut tx,
            session_id,
            message.turn_id.clone(),
            None,
            "message.deleted",
            payload,
        )
        .await?;
        Self::touch_session_transcript_on_executor(&mut tx, session_id).await?;

        map_sqlx_error(tx.commit().await)?;

        Ok(DeleteCodingSessionMessagePayload {
            id: message_id.to_string(),
            coding_session_id: session_id.to_string(),
        })
    }

    async fn list_events(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionEventPayload>, usize), CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let where_sql = format!(
            " WHERE {} = ? AND {}",
            columns::event::CODING_SESSION_ID,
            IS_NOT_DELETED,
        );
        let total = map_sqlx_error(
            sqlx::query_scalar::<_, i64>(&format!(
                "SELECT COUNT(*) AS total FROM {}{}",
                columns::event::TABLE,
                where_sql
            ))
            .bind(session_id)
            .fetch_one(&self.pool)
            .await,
        )? as usize;

        let rows = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {}{} ORDER BY {} ASC LIMIT ? OFFSET ?",
                columns::event::TABLE,
                where_sql,
                columns::event::SEQUENCE_NO,
            ))
            .bind(session_id)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await,
        )?;

        let items = rows
            .iter()
            .map(|row| {
                Ok(row_mapper::event_row_to_payload(map_sqlx_error(
                    EventRow::from_row(row),
                )?))
            })
            .collect::<Result<Vec<_>, CodingSessionError>>()?;

        Ok((items, total))
    }

    async fn list_artifacts(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionArtifactPayload>, usize), CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let where_sql = format!(
            " WHERE {} = ? AND {}",
            columns::artifact::CODING_SESSION_ID,
            IS_NOT_DELETED,
        );
        let total = map_sqlx_error(
            sqlx::query_scalar::<_, i64>(&format!(
                "SELECT COUNT(*) AS total FROM {}{}",
                columns::artifact::TABLE,
                where_sql
            ))
            .bind(session_id)
            .fetch_one(&self.pool)
            .await,
        )? as usize;

        let rows = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {}{} ORDER BY {} ASC LIMIT ? OFFSET ?",
                columns::artifact::TABLE,
                where_sql,
                columns::artifact::CREATED_AT,
            ))
            .bind(session_id)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await,
        )?;

        let items = rows
            .iter()
            .map(|row| {
                Ok(row_mapper::artifact_row_to_payload(map_sqlx_error(
                    ArtifactRow::from_row(row),
                )?))
            })
            .collect::<Result<Vec<_>, CodingSessionError>>()?;

        Ok((items, total))
    }

    async fn list_checkpoints(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionCheckpointPayload>, usize), CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let where_sql = format!(
            " WHERE {} = ? AND {}",
            columns::checkpoint::CODING_SESSION_ID,
            IS_NOT_DELETED,
        );
        let total = map_sqlx_error(
            sqlx::query_scalar::<_, i64>(&format!(
                "SELECT COUNT(*) AS total FROM {}{}",
                columns::checkpoint::TABLE,
                where_sql
            ))
            .bind(session_id)
            .fetch_one(&self.pool)
            .await,
        )? as usize;

        let rows = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT * FROM {}{} ORDER BY {} ASC LIMIT ? OFFSET ?",
                columns::checkpoint::TABLE,
                where_sql,
                columns::checkpoint::CREATED_AT,
            ))
            .bind(session_id)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await,
        )?;

        let items = rows
            .iter()
            .map(|row| {
                Ok(row_mapper::checkpoint_row_to_payload(map_sqlx_error(
                    CheckpointRow::from_row(row),
                )?))
            })
            .collect::<Result<Vec<_>, CodingSessionError>>()?;

        Ok((items, total))
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

        let mut tx = map_sqlx_error(self.pool.begin().await)?;

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
            .fetch_optional(&mut *tx)
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
        .execute(&mut *tx)
        .await
        .map_err(|e| RepositoryError::Update(e.to_string()))?;

        map_sqlx_error(tx.commit().await)?;

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

        let mut tx = map_sqlx_error(self.pool.begin().await)?;

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
            .fetch_optional(&mut *tx)
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
            payload.insert(
                "optionId".to_string(),
                serde_json::Value::String(oid.clone()),
            );
        }
        if let Some(ol) = &option_label {
            payload.insert(
                "optionLabel".to_string(),
                serde_json::Value::String(ol.clone()),
            );
        }
        payload.insert("rejected".to_string(), serde_json::Value::Bool(rejected));
        payload.insert(
            "answeredAt".to_string(),
            serde_json::Value::String(now.clone()),
        );

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
        .execute(&mut *tx)
        .await
        .map_err(|e| RepositoryError::Update(e.to_string()))?;

        map_sqlx_error(tx.commit().await)?;

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
        .ok_or_else(|| RepositoryError::NotFound(format!("operation {operation_id} not found")))?;

        Ok(row_mapper::operation_row_to_payload(map_sqlx_error(
            OperationRow::from_row(&row),
        )?))
    }

    async fn get_durable_operation(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        operation_id: &str,
    ) -> Result<DurableCodingSessionOperation, CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;
        let scope = session_owner_scope(ctx)?;
        let row = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT {} FROM {} o  WHERE o.id = ? AND o.coding_session_id = ? AND o.tenant_id = ?  AND o.user_id = ? AND {}",
                durable_operation_select_columns("o"),
                columns::operation::TABLE,
                sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("o"),
            ))
            .bind(operation_id)
            .bind(session_id)
            .bind(scope.tenant_id)
            .bind(scope.user_id)
            .fetch_optional(&self.pool)
            .await,
        )?
        .ok_or_else(|| RepositoryError::NotFound(format!("operation {operation_id} not found")))?;
        durable_operation_from_row(map_sqlx_error(DurableOperationRow::from_row(&row))?)
    }

    async fn enqueue_operation(
        &self,
        ctx: &CodingSessionContext,
        input: &EnqueueCodingSessionOperationInput,
    ) -> Result<DurableCodingSessionOperation, CodingSessionError> {
        let operation_id = require_operation_text(&input.operation_id, "operation_id")?;
        let session_id = require_operation_text(&input.coding_session_id, "coding_session_id")?;
        let turn_id = require_operation_text(&input.turn_id, "turn_id")?;
        let fingerprint =
            require_operation_text(&input.request_fingerprint, "request_fingerprint")?;
        let idempotency_key = require_operation_text(&input.idempotency_key, "idempotency_key")?;
        let available_at = normalize_operation_instant(&input.available_at, "available_at")?;
        if input.max_attempt < 1 || input.max_attempt > 1000 {
            return Err(CodingSessionError::InvalidInput(
                "max_attempt must be between 1 and 1000".into(),
            ));
        }
        if input.request_payload.is_null() {
            return Err(CodingSessionError::InvalidInput(
                "request_payload must not be null".into(),
            ));
        }
        let payload_json = serde_json::to_string(&input.request_payload)
            .map_err(|error| RepositoryError::Mapping(error.to_string()))?;
        let scope = session_owner_scope(ctx)?;
        ensure_session_in_tenant_scope(&self.pool, ctx, &session_id).await?;
        let is_postgres = self.is_postgres().await?;
        let now = normalize_operation_instant(&Self::now_iso(), "created_at")?;
        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        ensure_session_in_tenant_scope_in_transaction(&mut tx, ctx, &session_id).await?;
        if is_postgres {
            map_sqlx_error(
                sqlx::query("SELECT id FROM ai_coding_session WHERE id = ? AND tenant_id = ? AND user_id = ? FOR UPDATE")
                    .bind(&session_id)
                    .bind(scope.tenant_id)
                    .bind(scope.user_id)
                    .fetch_optional(&mut *tx)
                    .await,
            )?;
        }

        let existing_by_key = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT {} FROM {} o WHERE o.tenant_id = ? AND o.user_id = ?  AND o.coding_session_id = ? AND o.idempotency_key = ? AND {}",
                durable_operation_select_columns("o"),
                columns::operation::TABLE,
                sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("o"),
            ))
            .bind(scope.tenant_id)
            .bind(scope.user_id)
            .bind(&session_id)
            .bind(&idempotency_key)
            .fetch_optional(&mut *tx)
            .await,
        )?;
        if let Some(row) = existing_by_key {
            let operation =
                durable_operation_from_row(map_sqlx_error(DurableOperationRow::from_row(&row))?)?;
            if operation.request_fingerprint != fingerprint {
                return Err(CodingSessionError::Conflict(format!(
                    "idempotency key {idempotency_key} has a different request fingerprint"
                )));
            }
            map_sqlx_error(tx.commit().await)?;
            return Ok(operation);
        }

        let existing_by_id = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT {} FROM {} o WHERE o.id = ? AND {}",
                durable_operation_select_columns("o"),
                columns::operation::TABLE,
                sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("o"),
            ))
            .bind(&operation_id)
            .fetch_optional(&mut *tx)
            .await,
        )?;
        if let Some(row) = existing_by_id {
            let operation =
                durable_operation_from_row(map_sqlx_error(DurableOperationRow::from_row(&row))?)?;
            if operation.idempotency_key.as_deref() == Some(idempotency_key.as_str()) {
                if operation.request_fingerprint != fingerprint {
                    return Err(CodingSessionError::Conflict(format!(
                        "operation {operation_id} has a different request fingerprint"
                    )));
                }
                map_sqlx_error(tx.commit().await)?;
                return Ok(operation);
            }
            if operation.idempotency_key.is_some()
                || !matches!(operation.status.as_str(), "running" | "queued")
                || operation.lease_owner.is_some()
                || operation.fencing_token != 0
            {
                return Err(CodingSessionError::Conflict(format!(
                    "operation {operation_id} is already reserved"
                )));
            }
            map_sqlx_error(
                sqlx::query(
                    "UPDATE ai_coding_session_operation SET status = 'queued',  request_payload_json = ?, request_fingerprint = ?, idempotency_key = ?,  available_at = ?, attempt = 0, max_attempt = ?, lease_owner = NULL,  lease_expires_at = NULL, runner_id = NULL, started_at = NULL,  completed_at = NULL, problem_json = NULL, updated_at = ?, version = version + 1  WHERE id = ? AND tenant_id = ? AND user_id = ? AND is_deleted IS NOT TRUE",
                )
                .bind(&payload_json)
                .bind(&fingerprint)
                .bind(&idempotency_key)
                .bind(&available_at)
                .bind(input.max_attempt)
                .bind(&now)
                .bind(&operation_id)
                .bind(scope.tenant_id)
                .bind(scope.user_id)
                .execute(&mut *tx)
                .await,
            )?;
        } else {
            let created_expr = if is_postgres {
                "CAST(? AS TIMESTAMPTZ)"
            } else {
                "?"
            };
            let insert_sql = format!(
                "INSERT INTO ai_coding_session_operation  (id, created_at, updated_at, version, is_deleted, tenant_id, organization_id, user_id,  coding_session_id, turn_id, status, stream_url, stream_kind, artifact_refs_json,  request_payload_json, request_fingerprint, idempotency_key, available_at, attempt,  max_attempt, lease_owner, lease_expires_at, fencing_token, runner_id, started_at,  completed_at, problem_json)  VALUES (?, {created_expr}, {created_expr}, 0, FALSE, ?, 0, ?, ?, ?, 'queued', '', 'none', '[]',  ?, ?, ?, ?, 0, ?, NULL, NULL, 0, NULL, NULL, NULL, NULL)  ON CONFLICT DO NOTHING",
            );
            map_sqlx_error(
                sqlx::query(&insert_sql)
                    .bind(&operation_id)
                    .bind(&now)
                    .bind(&now)
                    .bind(scope.tenant_id)
                    .bind(scope.user_id)
                    .bind(&session_id)
                    .bind(&turn_id)
                    .bind(&payload_json)
                    .bind(&fingerprint)
                    .bind(&idempotency_key)
                    .bind(&available_at)
                    .bind(input.max_attempt)
                    .execute(&mut *tx)
                    .await,
            )?;
        }

        let operation_row = map_sqlx_error(
            sqlx::query(&format!(
                "SELECT {} FROM {} o WHERE o.tenant_id = ? AND o.user_id = ?  AND o.coding_session_id = ? AND o.idempotency_key = ? AND {}",
                durable_operation_select_columns("o"),
                columns::operation::TABLE,
                sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("o"),
            ))
            .bind(scope.tenant_id)
            .bind(scope.user_id)
            .bind(&session_id)
            .bind(&idempotency_key)
            .fetch_one(&mut *tx)
            .await,
        )?;
        let operation = durable_operation_from_row(map_sqlx_error(
            DurableOperationRow::from_row(&operation_row),
        )?)?;
        if operation.request_fingerprint != fingerprint {
            return Err(CodingSessionError::Conflict(format!(
                "idempotency key {idempotency_key} has a different request fingerprint"
            )));
        }
        map_sqlx_error(
            sqlx::query(
                "UPDATE ai_coding_session_turn SET status = 'queued', updated_at = ?, version = version + 1  WHERE id = ? AND coding_session_id = ? AND tenant_id = ? AND user_id = ? AND is_deleted IS NOT TRUE",
            )
            .bind(&now)
            .bind(&operation.turn_id)
            .bind(&operation.coding_session_id)
            .bind(scope.tenant_id)
            .bind(scope.user_id)
            .execute(&mut *tx)
            .await,
        )?;
        map_sqlx_error(tx.commit().await)?;
        Ok(operation)
    }

    async fn claim_operation(
        &self,
        input: &ClaimCodingSessionOperationInput,
    ) -> Result<Option<DurableCodingSessionOperation>, CodingSessionError> {
        let lease_owner = require_operation_text(&input.lease_owner, "lease_owner")?;
        let runner_id = require_operation_text(&input.runner_id, "runner_id")?;
        let claimed_at = normalize_operation_instant(&input.claimed_at, "claimed_at")?;
        let lease_expires_at =
            normalize_operation_instant(&input.lease_expires_at, "lease_expires_at")?;
        if lease_expires_at <= claimed_at {
            return Err(CodingSessionError::InvalidInput(
                "lease_expires_at must be later than claimed_at".into(),
            ));
        }
        let is_postgres = self.is_postgres().await?;
        let available_c = if is_postgres {
            "CAST(c.available_at AS TIMESTAMPTZ) <= CAST(? AS TIMESTAMPTZ)"
        } else {
            "c.available_at <= ?"
        };
        let lease_c = if is_postgres {
            "CAST(c.lease_expires_at AS TIMESTAMPTZ) <= CAST(? AS TIMESTAMPTZ)"
        } else {
            "c.lease_expires_at <= ?"
        };
        let available_outer = if is_postgres {
            "CAST(ai_coding_session_operation.available_at AS TIMESTAMPTZ) <= CAST(? AS TIMESTAMPTZ)"
        } else {
            "ai_coding_session_operation.available_at <= ?"
        };
        let lease_outer = if is_postgres {
            "CAST(ai_coding_session_operation.lease_expires_at AS TIMESTAMPTZ) <= CAST(? AS TIMESTAMPTZ)"
        } else {
            "ai_coding_session_operation.lease_expires_at <= ?"
        };
        let updated_value = if is_postgres {
            "CAST(? AS TIMESTAMPTZ)"
        } else {
            "?"
        };
        let lock_suffix = if is_postgres {
            " FOR UPDATE SKIP LOCKED"
        } else {
            ""
        };
        let sql = format!(
            "WITH candidate AS ( SELECT c.id FROM ai_coding_session_operation c  WHERE c.is_deleted IS NOT TRUE AND c.attempt < c.max_attempt AND ( (c.status = 'queued' AND {available_c} AND NOT EXISTS ( SELECT 1 FROM ai_coding_session_operation active  WHERE active.tenant_id = c.tenant_id AND active.user_id = c.user_id  AND active.status = 'running' AND active.is_deleted IS NOT TRUE )) OR  (c.status = 'running' AND c.lease_expires_at IS NOT NULL AND {lease_c}) )  ORDER BY CASE WHEN c.status = 'running' THEN 0 ELSE 1 END,  c.available_at, c.created_at, c.id  LIMIT 1{lock_suffix} )  UPDATE ai_coding_session_operation SET  status = 'running', attempt = attempt + 1, lease_owner = ?,  lease_expires_at = ?, fencing_token = fencing_token + 1, runner_id = ?,  started_at = COALESCE(started_at, ?), completed_at = NULL, problem_json = NULL,  updated_at = {updated_value}, version = version + 1  WHERE id = (SELECT id FROM candidate) AND is_deleted IS NOT TRUE  AND attempt < max_attempt AND ( (status = 'queued' AND {available_outer} AND NOT EXISTS ( SELECT 1 FROM ai_coding_session_operation active  WHERE active.tenant_id = ai_coding_session_operation.tenant_id  AND active.user_id = ai_coding_session_operation.user_id  AND active.status = 'running' AND active.is_deleted IS NOT TRUE )) OR  (status = 'running' AND lease_expires_at IS NOT NULL AND {lease_outer}) )  RETURNING {}",
            durable_operation_return_columns(),
        );
        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        let row = map_sqlx_error(
            sqlx::query(&sql)
                .bind(&claimed_at)
                .bind(&claimed_at)
                .bind(&lease_owner)
                .bind(&lease_expires_at)
                .bind(&runner_id)
                .bind(&claimed_at)
                .bind(&claimed_at)
                .bind(&claimed_at)
                .bind(&claimed_at)
                .fetch_optional(&mut *tx)
                .await,
        )?;
        let Some(row) = row else {
            map_sqlx_error(tx.commit().await)?;
            return Ok(None);
        };
        let operation =
            durable_operation_from_row(map_sqlx_error(DurableOperationRow::from_row(&row))?)?;
        let turn_result = map_sqlx_error(
            sqlx::query(&format!(
                "UPDATE ai_coding_session_turn SET status = 'running', updated_at = {updated_value},  version = version + 1 WHERE id = ? AND coding_session_id = ? AND tenant_id = ?  AND user_id = ? AND is_deleted IS NOT TRUE"
            ))
            .bind(&claimed_at)
            .bind(&operation.turn_id)
            .bind(&operation.coding_session_id)
            .bind(operation.tenant_id)
            .bind(operation.user_id)
            .execute(&mut *tx)
            .await,
        )?;
        if turn_result.rows_affected() != 1 {
            return Err(CodingSessionError::Conflict(format!(
                "turn {} cannot be claimed with operation {}",
                operation.turn_id, operation.id
            )));
        }
        map_sqlx_error(tx.commit().await)?;
        Ok(Some(operation))
    }

    async fn renew_operation_lease(
        &self,
        input: &RenewCodingSessionOperationLeaseInput,
    ) -> Result<DurableCodingSessionOperation, CodingSessionError> {
        let operation_id = require_operation_text(&input.operation_id, "operation_id")?;
        let lease_owner = require_operation_text(&input.lease_owner, "lease_owner")?;
        if input.fencing_token < 1 {
            return Err(CodingSessionError::InvalidInput(
                "fencing_token must be positive".into(),
            ));
        }
        let renewed_at = normalize_operation_instant(&input.renewed_at, "renewed_at")?;
        let lease_expires_at =
            normalize_operation_instant(&input.lease_expires_at, "lease_expires_at")?;
        if lease_expires_at <= renewed_at {
            return Err(CodingSessionError::InvalidInput(
                "lease_expires_at must be later than renewed_at".into(),
            ));
        }
        let is_postgres = self.is_postgres().await?;
        let updated_value = if is_postgres {
            "CAST(? AS TIMESTAMPTZ)"
        } else {
            "?"
        };
        let expiry_predicate = if is_postgres {
            "CAST(lease_expires_at AS TIMESTAMPTZ) > CAST(? AS TIMESTAMPTZ)"
        } else {
            "lease_expires_at > ?"
        };
        let sql = format!(
            "UPDATE ai_coding_session_operation SET lease_expires_at = ?,  updated_at = {updated_value}, version = version + 1  WHERE id = ? AND status = 'running' AND lease_owner = ? AND fencing_token = ?  AND lease_expires_at IS NOT NULL AND {expiry_predicate}  RETURNING {}",
            durable_operation_return_columns(),
        );
        let row = map_sqlx_error(
            sqlx::query(&sql)
                .bind(&lease_expires_at)
                .bind(&renewed_at)
                .bind(&operation_id)
                .bind(&lease_owner)
                .bind(input.fencing_token)
                .bind(&renewed_at)
                .fetch_optional(&self.pool)
                .await,
        )?
        .ok_or_else(|| {
            CodingSessionError::Conflict(format!(
                "operation {operation_id} lease is stale or owned by another worker"
            ))
        })?;
        durable_operation_from_row(map_sqlx_error(DurableOperationRow::from_row(&row))?)
    }

    async fn complete_operation(
        &self,
        input: &CompleteCodingSessionOperationInput,
    ) -> Result<DurableCodingSessionOperation, CodingSessionError> {
        let operation_id = require_operation_text(&input.operation_id, "operation_id")?;
        let lease_owner = require_operation_text(&input.lease_owner, "lease_owner")?;
        if input.fencing_token < 1 {
            return Err(CodingSessionError::InvalidInput(
                "fencing_token must be positive".into(),
            ));
        }
        let completed_at = normalize_operation_instant(&input.completed_at, "completed_at")?;
        if input.finalized.turn.status != "completed" {
            return Err(CodingSessionError::InvalidInput(
                "finalized turn status must be completed".into(),
            ));
        }
        let is_postgres = self.is_postgres().await?;
        let updated_value = if is_postgres {
            "CAST(? AS TIMESTAMPTZ)"
        } else {
            "?"
        };
        let expiry_predicate = if is_postgres {
            "CAST(lease_expires_at AS TIMESTAMPTZ) > CAST(? AS TIMESTAMPTZ)"
        } else {
            "lease_expires_at > ?"
        };
        let operation_sql = format!(
            "UPDATE ai_coding_session_operation SET status = 'succeeded', completed_at = ?,  lease_owner = NULL, lease_expires_at = NULL, updated_at = {updated_value},  version = version + 1  WHERE id = ? AND status = 'running' AND lease_owner = ? AND fencing_token = ?  AND lease_expires_at IS NOT NULL AND {expiry_predicate}  RETURNING {}",
            durable_operation_return_columns(),
        );
        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        let row = map_sqlx_error(
            sqlx::query(&operation_sql)
                .bind(&completed_at)
                .bind(&completed_at)
                .bind(&operation_id)
                .bind(&lease_owner)
                .bind(input.fencing_token)
                .bind(&completed_at)
                .fetch_optional(&mut *tx)
                .await,
        )?
        .ok_or_else(|| {
            CodingSessionError::Conflict(format!(
                "operation {operation_id} completion fence is stale"
            ))
        })?;
        let operation =
            durable_operation_from_row(map_sqlx_error(DurableOperationRow::from_row(&row))?)?;
        if input.finalized.turn.id != operation.turn_id
            || input.finalized.turn.coding_session_id != operation.coding_session_id
        {
            return Err(CodingSessionError::Conflict(
                "finalized turn does not match the claimed operation".into(),
            ));
        }

        if let Some(native_session_id) = input
            .finalized
            .native_session_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            let result = map_sqlx_error(
                sqlx::query(&format!(
                    "UPDATE ai_coding_session SET native_session_id = ?, updated_at = {updated_value},  version = version + 1 WHERE id = ? AND tenant_id = ? AND user_id = ?  AND is_deleted IS NOT TRUE"
                ))
                .bind(native_session_id)
                .bind(&completed_at)
                .bind(&operation.coding_session_id)
                .bind(operation.tenant_id)
                .bind(operation.user_id)
                .execute(&mut *tx)
                .await,
            )?;
            if result.rows_affected() != 1 {
                return Err(CodingSessionError::Conflict(
                    "claimed operation owner no longer owns the session".into(),
                ));
            }
        }

        let started_at = input
            .finalized
            .turn
            .started_at
            .as_deref()
            .map(|value| normalize_operation_instant(value, "turn.started_at"))
            .transpose()?
            .or_else(|| operation.started_at.clone())
            .unwrap_or_else(|| completed_at.clone());
        let turn_result = map_sqlx_error(
            sqlx::query(&format!(
                "UPDATE ai_coding_session_turn SET status = 'completed', started_at = ?,  completed_at = ?, updated_at = {updated_value}, version = version + 1  WHERE id = ? AND coding_session_id = ? AND tenant_id = ? AND user_id = ?  AND is_deleted IS NOT TRUE"
            ))
            .bind(&started_at)
            .bind(&completed_at)
            .bind(&completed_at)
            .bind(&operation.turn_id)
            .bind(&operation.coding_session_id)
            .bind(operation.tenant_id)
            .bind(operation.user_id)
            .execute(&mut *tx)
            .await,
        )?;
        if turn_result.rows_affected() != 1 {
            return Err(CodingSessionError::Conflict(
                "claimed operation turn no longer exists".into(),
            ));
        }

        let event_time_value = if is_postgres {
            "CAST(? AS TIMESTAMPTZ)"
        } else {
            "?"
        };
        for event in &input.finalized.events {
            if event.coding_session_id != operation.coding_session_id
                || event.turn_id.as_deref() != Some(operation.turn_id.as_str())
            {
                return Err(CodingSessionError::Conflict(
                    "finalized event does not belong to the claimed operation".into(),
                ));
            }
            let created_at = normalize_operation_instant(&event.created_at, "event.created_at")?;
            let payload_json = serde_json::to_string(&event.payload)
                .map_err(|error| RepositoryError::Insert(error.to_string()))?;
            let insert_event_sql = format!(
                "INSERT INTO ai_coding_session_event  (id, tenant_id, user_id, created_at, updated_at, version, is_deleted,  coding_session_id, turn_id, runtime_id, event_kind, sequence_no, payload_json)  VALUES (?, ?, ?, {event_time_value}, {event_time_value}, 0, FALSE, ?, ?, ?, ?, ?, ?)"
            );
            map_sqlx_error(
                sqlx::query(&insert_event_sql)
                    .bind(&event.id)
                    .bind(operation.tenant_id)
                    .bind(operation.user_id)
                    .bind(&created_at)
                    .bind(&created_at)
                    .bind(&operation.coding_session_id)
                    .bind(&event.turn_id)
                    .bind(&event.runtime_id)
                    .bind(&event.kind)
                    .bind(event.sequence as i64)
                    .bind(&payload_json)
                    .execute(&mut *tx)
                    .await,
            )?;
        }
        map_sqlx_error(tx.commit().await)?;
        Ok(operation)
    }

    async fn fail_operation(
        &self,
        input: &FailCodingSessionOperationInput,
    ) -> Result<DurableCodingSessionOperation, CodingSessionError> {
        let operation_id = require_operation_text(&input.operation_id, "operation_id")?;
        let lease_owner = require_operation_text(&input.lease_owner, "lease_owner")?;
        if input.fencing_token < 1 {
            return Err(CodingSessionError::InvalidInput(
                "fencing_token must be positive".into(),
            ));
        }
        let failed_at = normalize_operation_instant(&input.failed_at, "failed_at")?;
        let retry_at = input
            .retry_at
            .as_deref()
            .map(|value| normalize_operation_instant(value, "retry_at"))
            .transpose()?;
        if let Some(retry_at) = retry_at.as_deref() {
            if retry_at <= failed_at.as_str() {
                return Err(CodingSessionError::InvalidInput(
                    "retry_at must be later than failed_at".into(),
                ));
            }
        }
        let problem_json = serde_json::to_string(&input.problem)
            .map_err(|error| RepositoryError::Mapping(error.to_string()))?;
        let is_postgres = self.is_postgres().await?;
        let updated_value = if is_postgres {
            "CAST(? AS TIMESTAMPTZ)"
        } else {
            "?"
        };
        let expiry_predicate = if is_postgres {
            "CAST(lease_expires_at AS TIMESTAMPTZ) > CAST(? AS TIMESTAMPTZ)"
        } else {
            "lease_expires_at > ?"
        };
        let operation_sql = if retry_at.is_some() {
            format!(
                "UPDATE ai_coding_session_operation SET  status = CASE WHEN attempt < max_attempt THEN 'queued' ELSE 'failed' END,  available_at = CASE WHEN attempt < max_attempt THEN ? ELSE available_at END,  completed_at = CASE WHEN attempt < max_attempt THEN NULL ELSE ? END,  problem_json = ?, lease_owner = NULL, lease_expires_at = NULL,  updated_at = {updated_value}, version = version + 1  WHERE id = ? AND status = 'running' AND lease_owner = ? AND fencing_token = ?  AND lease_expires_at IS NOT NULL AND {expiry_predicate}  RETURNING {}",
                durable_operation_return_columns(),
            )
        } else {
            format!(
                "UPDATE ai_coding_session_operation SET status = 'failed', completed_at = ?,  problem_json = ?, lease_owner = NULL, lease_expires_at = NULL,  updated_at = {updated_value}, version = version + 1  WHERE id = ? AND status = 'running' AND lease_owner = ? AND fencing_token = ?  AND lease_expires_at IS NOT NULL AND {expiry_predicate}  RETURNING {}",
                durable_operation_return_columns(),
            )
        };
        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        let mut operation_query = sqlx::query(&operation_sql);
        if let Some(retry_at) = retry_at.as_deref() {
            operation_query = operation_query
                .bind(retry_at)
                .bind(&failed_at)
                .bind(&problem_json)
                .bind(&failed_at);
        } else {
            operation_query = operation_query
                .bind(&failed_at)
                .bind(&problem_json)
                .bind(&failed_at);
        }
        operation_query = operation_query
            .bind(&operation_id)
            .bind(&lease_owner)
            .bind(input.fencing_token)
            .bind(&failed_at);
        let row =
            map_sqlx_error(operation_query.fetch_optional(&mut *tx).await)?.ok_or_else(|| {
                CodingSessionError::Conflict(format!(
                    "operation {operation_id} failure fence is stale"
                ))
            })?;
        let operation =
            durable_operation_from_row(map_sqlx_error(DurableOperationRow::from_row(&row))?)?;
        let terminal = operation.status == "failed";
        let turn_status = if terminal { "failed" } else { "queued" };
        let turn_completed_at = if terminal {
            Some(failed_at.clone())
        } else {
            None
        };
        let turn_result = map_sqlx_error(
            sqlx::query(&format!(
                "UPDATE ai_coding_session_turn SET status = ?, started_at = ?, completed_at = ?,  updated_at = {updated_value}, version = version + 1  WHERE id = ? AND coding_session_id = ? AND tenant_id = ? AND user_id = ?  AND is_deleted IS NOT TRUE"
            ))
            .bind(turn_status)
            .bind(Option::<String>::None)
            .bind(turn_completed_at.as_deref())
            .bind(&failed_at)
            .bind(&operation.turn_id)
            .bind(&operation.coding_session_id)
            .bind(operation.tenant_id)
            .bind(operation.user_id)
            .execute(&mut *tx)
            .await,
        )?;
        if turn_result.rows_affected() != 1 {
            return Err(CodingSessionError::Conflict(
                "claimed operation turn no longer exists".into(),
            ));
        }

        if terminal {
            let runtime_id = map_sqlx_error(
                sqlx::query_scalar::<_, Option<String>>(
                    "SELECT runtime_id FROM ai_coding_session_turn  WHERE id = ? AND coding_session_id = ? AND tenant_id = ? AND user_id = ?",
                )
                .bind(&operation.turn_id)
                .bind(&operation.coding_session_id)
                .bind(operation.tenant_id)
                .bind(operation.user_id)
                .fetch_optional(&mut *tx)
                .await,
            )?
            .flatten();
            let max_sequence = map_sqlx_error(
                sqlx::query_scalar::<_, i64>(
                    "SELECT COALESCE(MAX(sequence_no), 0) FROM ai_coding_session_event  WHERE coding_session_id = ? AND tenant_id = ? AND user_id = ?  AND is_deleted IS NOT TRUE",
                )
                .bind(&operation.coding_session_id)
                .bind(operation.tenant_id)
                .bind(operation.user_id)
                .fetch_one(&mut *tx)
                .await,
            )?;
            let payload_json = serde_json::json!({
                "operationId": operation.id,
                "runtimeStatus": "failed",
                "status": "failed",
                "problem": input.problem,
            })
            .to_string();
            let event_time_value = if is_postgres {
                "CAST(? AS TIMESTAMPTZ)"
            } else {
                "?"
            };
            let event_id = Uuid::new_v4().to_string();
            let event_sql = format!(
                "INSERT INTO ai_coding_session_event  (id, tenant_id, user_id, created_at, updated_at, version, is_deleted,  coding_session_id, turn_id, runtime_id, event_kind, sequence_no, payload_json)  VALUES (?, ?, ?, {event_time_value}, {event_time_value}, 0, FALSE, ?, ?, ?,  'turn.failed', ?, ?)"
            );
            map_sqlx_error(
                sqlx::query(&event_sql)
                    .bind(event_id)
                    .bind(operation.tenant_id)
                    .bind(operation.user_id)
                    .bind(&failed_at)
                    .bind(&failed_at)
                    .bind(&operation.coding_session_id)
                    .bind(&operation.turn_id)
                    .bind(runtime_id)
                    .bind(max_sequence + 1)
                    .bind(payload_json)
                    .execute(&mut *tx)
                    .await,
            )?;
        }

        map_sqlx_error(tx.commit().await)?;
        Ok(operation)
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

        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        ensure_session_in_tenant_scope_in_transaction(&mut tx, ctx, session_id).await?;

        let started_at = turn.started_at.clone().unwrap_or_else(|| now.clone());
        let completed_at = turn.completed_at.clone().unwrap_or_else(|| now.clone());

        let native_session_id = finalized
            .native_session_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if let Some(native_session_id) = native_session_id {
            sqlx::query(&format!(
                "UPDATE {} SET {} = ?, {} = ?, {} = ?, {} = {} + 1 \
                 WHERE {} = ? AND {} = 0",
                columns::session::TABLE,
                columns::session::NATIVE_SESSION_ID,
                columns::session::TRANSCRIPT_UPDATED_AT,
                columns::session::UPDATED_AT,
                columns::session::VERSION,
                columns::session::VERSION,
                columns::session::ID,
                columns::session::IS_DELETED,
            ))
            .bind(native_session_id)
            .bind(&now)
            .bind(&now)
            .bind(session_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| RepositoryError::Update(e.to_string()))?;
        } else {
            sqlx::query(&format!(
                "UPDATE {} SET {} = ?, {} = ?, {} = {} + 1 \
                 WHERE {} = ? AND {} = 0",
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
            .execute(&mut *tx)
            .await
            .map_err(|e| RepositoryError::Update(e.to_string()))?;
        }

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
        .execute(&mut *tx)
        .await
        .map_err(|e| RepositoryError::Update(e.to_string()))?;

        let operation_result = sqlx::query(&format!(
            "UPDATE {} SET {} = 'succeeded', {} = ?, {} = {} + 1 \
             WHERE {} = ? AND {} = ? AND {} = 0",
            columns::operation::TABLE,
            columns::operation::STATUS,
            columns::operation::UPDATED_AT,
            columns::operation::VERSION,
            columns::operation::VERSION,
            columns::operation::CODING_SESSION_ID,
            columns::operation::TURN_ID,
            columns::operation::IS_DELETED,
        ))
        .bind(&now)
        .bind(session_id)
        .bind(&turn_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| RepositoryError::Update(e.to_string()))?;
        if operation_result.rows_affected() != 1 {
            return Err(RepositoryError::Update(format!(
                "operation for turn {turn_id} was not found"
            ))
            .into());
        }

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
            .execute(&mut *tx)
            .await
            .map_err(|e| RepositoryError::Insert(e.to_string()))?;
        }

        map_sqlx_error(tx.commit().await)?;

        Ok(turn)
    }

    async fn mark_turn_failed(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        turn_id: &str,
    ) -> Result<(), CodingSessionError> {
        let now = Self::now_iso();

        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        ensure_session_in_tenant_scope_in_transaction(&mut tx, ctx, session_id).await?;

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
        .execute(&mut *tx)
        .await
        .map_err(|e| RepositoryError::Update(e.to_string()))?;

        let operation_result = sqlx::query(&format!(
            "UPDATE {} SET {} = 'failed', {} = ?, {} = {} + 1 \
             WHERE {} = ? AND {} = ? AND {} = 0",
            columns::operation::TABLE,
            columns::operation::STATUS,
            columns::operation::UPDATED_AT,
            columns::operation::VERSION,
            columns::operation::VERSION,
            columns::operation::CODING_SESSION_ID,
            columns::operation::TURN_ID,
            columns::operation::IS_DELETED,
        ))
        .bind(&now)
        .bind(session_id)
        .bind(turn_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| RepositoryError::Update(e.to_string()))?;
        if operation_result.rows_affected() != 1 {
            return Err(RepositoryError::Update(format!(
                "operation for turn {turn_id} was not found"
            ))
            .into());
        }

        map_sqlx_error(tx.commit().await)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
    use sdkwork_birdcoder_coding_sessions_service::domain::commands::CreateCodingSessionTurnInput;
    use sdkwork_birdcoder_coding_sessions_service::domain::results::{
        CodingSessionTurnPayload, FinalizedProjectionTurnExecution,
    };
    use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
    use sqlx::{any::AnyPoolOptions, Row as _};

    use super::SqliteCodingSessionRepository;
    use crate::db::schema::PROVIDER_AUTHORITY_SCHEMA;
    use crate::repository::sqlx_helpers::append_session_owner_scope_sql;

    #[tokio::test]
    async fn session_list_query_materializes_page_before_runtime_lookup() {
        sqlx::any::install_default_drivers();
        let pool = AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("open session-list query-plan database");

        for statement in [
            "CREATE TABLE studio_workspace (\
                 id INTEGER PRIMARY KEY, \
                 tenant_id INTEGER NOT NULL, \
                 is_deleted INTEGER NOT NULL DEFAULT 0\
             )",
            "CREATE TABLE ai_coding_session (\
                 id TEXT PRIMARY KEY, \
                 is_deleted INTEGER NOT NULL DEFAULT 0, \
                 user_id INTEGER NOT NULL, \
                 workspace_id TEXT NOT NULL, \
                 sort_timestamp INTEGER NULL\
             )",
            "CREATE TABLE ai_coding_session_runtime (\
                 id TEXT PRIMARY KEY, \
                 coding_session_id TEXT NOT NULL, \
                 status TEXT NOT NULL, \
                 created_at TEXT NOT NULL, \
                 is_deleted INTEGER NOT NULL DEFAULT 0\
             )",
        ] {
            sqlx::query(statement)
                .execute(&pool)
                .await
                .expect("create session-list query-plan table");
        }

        let context = CodingSessionContext {
            tenant_id: "7".to_owned(),
            user_id: "42".to_owned(),
            session_id: "query-plan-session".to_owned(),
        };
        let mut filter_sql = format!(
            " WHERE {}",
            sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("s")
        );
        let owner_scope = append_session_owner_scope_sql(&context, "s", &mut filter_sql)
            .expect("append owner scope");
        let sql =
            SqliteCodingSessionRepository::build_session_list_select_sql(&filter_sql, true, true);

        let plan_rows = sqlx::query(&format!("EXPLAIN QUERY PLAN {sql}"))
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(1_i64)
            .bind(0_i64)
            .fetch_all(&pool)
            .await
            .expect("explain actual session-list query");
        let plan = plan_rows
            .iter()
            .map(|row| row.try_get::<String, _>("detail").expect("plan detail"))
            .collect::<Vec<_>>();

        assert!(
            plan.iter()
                .any(|detail| detail.contains("MATERIALIZE session_page")),
            "runtime lookup must be downstream of a materialized page; sql={sql}; plan={plan:?}",
        );
        assert_eq!(
            sql.matches("ORDER BY s.sort_timestamp DESC, s.id DESC")
                .count(),
            2,
            "inner and outer page order must both be deterministic; sql={sql}",
        );
    }

    #[tokio::test]
    async fn finalize_turn_persists_native_session_for_the_next_turn() {
        sqlx::any::install_default_drivers();
        let pool = AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("open native-session finalize database");
        sqlx::raw_sql(PROVIDER_AUTHORITY_SCHEMA)
            .execute(&pool)
            .await
            .expect("create provider authority schema");

        sqlx::query(
            "INSERT INTO studio_workspace \
             (id, tenant_id, created_at, updated_at, name, owner_id, status) \
             VALUES (101, 7, '2026-07-11T00:00:00Z', '2026-07-11T00:00:00Z', \
                     'Turn workspace', 42, 'active')",
        )
        .execute(&pool)
        .await
        .expect("seed scoped workspace");
        sqlx::query(
            "INSERT INTO ai_coding_session \
             (id, tenant_id, user_id, created_at, updated_at, workspace_id, project_id, title, status, \
              entry_surface, host_mode, engine_id, model_id) \
             VALUES ('session-1', 7, 42, '2026-07-11T00:00:00Z', '2026-07-11T00:00:00Z', \
                     '101', 'project-1', 'Turn session', 'active', 'pc', 'standalone', \
                     'codex', 'gpt-5-codex')",
        )
        .execute(&pool)
        .await
        .expect("seed coding session");
        let repository = SqliteCodingSessionRepository::new(pool.clone());
        let context = CodingSessionContext {
            tenant_id: "7".to_owned(),
            user_id: "42".to_owned(),
            session_id: "request-session".to_owned(),
        };
        let created_turn = repository
            .create_turn(
                &context,
                "session-1",
                &CreateCodingSessionTurnInput {
                    runtime_id: Some("runtime-1".to_owned()),
                    engine_id: Some("codex".to_owned()),
                    model_id: Some("gpt-5-codex".to_owned()),
                    request_kind: "user_message".to_owned(),
                    input_summary: "first turn".to_owned(),
                    stream: false,
                    ide_context: None,
                    options: None,
                },
            )
            .await
            .expect("create coding turn and durable operation");
        let operation_id = format!("{}:operation", created_turn.id);
        let activity_after_turn_creation =
            sqlx::query("SELECT last_turn_at, sort_timestamp FROM ai_coding_session WHERE id = ?")
                .bind("session-1")
                .fetch_one(&pool)
                .await
                .expect("load session activity after turn creation");
        let sort_timestamp_after_turn_creation = activity_after_turn_creation
            .try_get::<i64, _>("sort_timestamp")
            .expect("turn creation sort timestamp");
        assert!(
            sort_timestamp_after_turn_creation >= 1_000_000_000_000,
            "turn creation must persist a millisecond session sort timestamp",
        );
        assert!(
            activity_after_turn_creation
                .try_get::<Option<String>, _>("last_turn_at")
                .expect("turn creation last_turn_at")
                .is_some(),
            "turn creation must update last_turn_at",
        );
        let running_operation = repository
            .get_operation(&context, "session-1", &operation_id)
            .await
            .expect("load running operation");
        assert_eq!(running_operation.status, "queued");
        let persisted_owner =
            sqlx::query("SELECT tenant_id, user_id FROM ai_coding_session_operation WHERE id = ?")
                .bind(&operation_id)
                .fetch_one(&pool)
                .await
                .expect("load operation owner");
        assert_eq!(
            persisted_owner
                .try_get::<i64, _>("tenant_id")
                .expect("operation tenant"),
            7
        );
        assert_eq!(
            persisted_owner
                .try_get::<i64, _>("user_id")
                .expect("operation user"),
            42
        );

        repository
            .finalize_turn_execution(
                &context,
                "session-1",
                &FinalizedProjectionTurnExecution {
                    turn: CodingSessionTurnPayload {
                        status: "completed".to_owned(),
                        started_at: Some("2026-07-11T00:00:01Z".to_owned()),
                        completed_at: Some("2026-07-11T00:00:02Z".to_owned()),
                        ..created_turn
                    },
                    events: Vec::new(),
                    native_session_id: Some("provider-session-1".to_owned()),
                },
            )
            .await
            .expect("finalize coding turn");
        let activity_after_turn_completion = sqlx::query(
            "SELECT native_session_id, sort_timestamp, transcript_updated_at, updated_at \
             FROM ai_coding_session WHERE id = ?",
        )
        .bind("session-1")
        .fetch_one(&pool)
        .await
        .expect("load session activity after turn completion");
        assert_eq!(
            activity_after_turn_completion
                .try_get::<i64, _>("sort_timestamp")
                .expect("turn completion sort timestamp"),
            sort_timestamp_after_turn_creation,
            "turn completion must refresh transcript freshness without sorting the session twice",
        );
        let transcript_updated_at = activity_after_turn_completion
            .try_get::<Option<String>, _>("transcript_updated_at")
            .expect("turn completion transcript_updated_at");
        assert!(transcript_updated_at.is_some());
        assert_eq!(
            transcript_updated_at,
            activity_after_turn_completion
                .try_get::<Option<String>, _>("updated_at")
                .expect("turn completion updated_at"),
            "turn completion must commit transcript freshness and session updated_at together",
        );
        let succeeded_operation = repository
            .get_operation(&context, "session-1", &operation_id)
            .await
            .expect("load succeeded operation");
        assert_eq!(succeeded_operation.status, "succeeded");

        let turn_without_native_session = repository
            .create_turn(
                &context,
                "session-1",
                &CreateCodingSessionTurnInput {
                    runtime_id: Some("runtime-without-native".to_owned()),
                    engine_id: Some("codex".to_owned()),
                    model_id: Some("gpt-5-codex".to_owned()),
                    request_kind: "user_message".to_owned(),
                    input_summary: "turn without native session result".to_owned(),
                    stream: false,
                    ide_context: None,
                    options: None,
                },
            )
            .await
            .expect("create turn without native session result");
        let activity_before_completion_without_native =
            sqlx::query("SELECT sort_timestamp FROM ai_coding_session WHERE id = ?")
                .bind("session-1")
                .fetch_one(&pool)
                .await
                .expect("load activity before completion without native session");
        let sort_timestamp_before_completion_without_native =
            activity_before_completion_without_native
                .try_get::<i64, _>("sort_timestamp")
                .expect("sort timestamp before completion without native session");

        repository
            .finalize_turn_execution(
                &context,
                "session-1",
                &FinalizedProjectionTurnExecution {
                    turn: CodingSessionTurnPayload {
                        status: "completed".to_owned(),
                        started_at: Some("2026-07-11T00:00:03Z".to_owned()),
                        completed_at: Some("2026-07-11T00:00:04Z".to_owned()),
                        ..turn_without_native_session
                    },
                    events: Vec::new(),
                    native_session_id: None,
                },
            )
            .await
            .expect("finalize turn without native session result");
        let activity_after_completion_without_native = sqlx::query(
            "SELECT sort_timestamp, transcript_updated_at FROM ai_coding_session WHERE id = ?",
        )
        .bind("session-1")
        .fetch_one(&pool)
        .await
        .expect("load activity after completion without native session");
        assert_eq!(
            activity_after_completion_without_native
                .try_get::<i64, _>("sort_timestamp")
                .expect("sort timestamp after completion without native session"),
            sort_timestamp_before_completion_without_native,
            "turn completion without a native session id must not sort the session twice",
        );
        assert!(
            activity_after_completion_without_native
                .try_get::<Option<String>, _>("transcript_updated_at")
                .expect("transcript timestamp after completion without native session")
                .is_some(),
            "turn completion without a native session id must still refresh transcript freshness",
        );

        let failed_turn = repository
            .create_turn(
                &context,
                "session-1",
                &CreateCodingSessionTurnInput {
                    runtime_id: Some("runtime-2".to_owned()),
                    engine_id: Some("codex".to_owned()),
                    model_id: Some("gpt-5-codex".to_owned()),
                    request_kind: "user_message".to_owned(),
                    input_summary: "failed turn".to_owned(),
                    stream: false,
                    ide_context: None,
                    options: None,
                },
            )
            .await
            .expect("create operation that will fail");
        repository
            .mark_turn_failed(&context, "session-1", &failed_turn.id)
            .await
            .expect("mark turn and operation failed");
        let failed_operation = repository
            .get_operation(
                &context,
                "session-1",
                &format!("{}:operation", failed_turn.id),
            )
            .await
            .expect("load failed operation");
        assert_eq!(failed_operation.status, "failed");

        let resumed_session = repository
            .get_session(&context, "session-1")
            .await
            .expect("load session for the next turn");
        assert_eq!(
            resumed_session.native_session_id.as_deref(),
            Some("provider-session-1")
        );

        let other_user = CodingSessionContext {
            user_id: "43".to_owned(),
            ..context
        };
        assert!(
            repository
                .get_session(&other_user, "session-1")
                .await
                .is_err(),
            "a different user in the same tenant must not read the coding session",
        );
        assert!(
            repository
                .get_operation(&other_user, "session-1", &operation_id)
                .await
                .is_err(),
            "a different user in the same tenant must not read the operation",
        );
    }

    #[tokio::test]
    async fn project_working_directory_uses_scoped_project_config_root() {
        sqlx::any::install_default_drivers();
        let pool = AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("open project root database");
        sqlx::raw_sql(PROVIDER_AUTHORITY_SCHEMA)
            .execute(&pool)
            .await
            .expect("create provider authority schema");

        sqlx::query(
            "INSERT INTO studio_project (\
                 id, uuid, created_at, updated_at, tenant_id, organization_id, data_scope, \
                 name, title, code, type, site_path, status, is_deleted, is_template\
             ) VALUES (201, 'project-201', '2026-07-11T00:00:00Z', \
                       '2026-07-11T00:00:00Z', 7, 0, 1, 'Project', 'Project', \
                       'project', 1, 'D:/fallback-project', 2, 0, 0)",
        )
        .execute(&pool)
        .await
        .expect("seed scoped project");
        sqlx::query(
            "INSERT INTO studio_project_content (\
                 id, uuid, created_at, updated_at, tenant_id, organization_id, data_scope, \
                 project_id, project_uuid, config_data, content_version\
             ) VALUES (202, 'project-content-202', '2026-07-11T00:00:00Z', \
                       '2026-07-11T00:00:00Z', 7, 0, 1, 201, 'project-201', \
                       '{\"rootPath\":\"D:/authorized/project-201\"}', '1.0')",
        )
        .execute(&pool)
        .await
        .expect("seed project root config");

        let repository = SqliteCodingSessionRepository::new(pool);
        let context = CodingSessionContext {
            tenant_id: "7".to_owned(),
            user_id: "42".to_owned(),
            session_id: "request-session".to_owned(),
        };
        let root = repository
            .resolve_project_working_directory(&context, "201")
            .await
            .expect("resolve project root");
        assert_eq!(root.as_deref(), Some("D:/authorized/project-201"));

        let other_tenant = CodingSessionContext {
            tenant_id: "8".to_owned(),
            ..context
        };
        assert_eq!(
            repository
                .resolve_project_working_directory(&other_tenant, "201")
                .await
                .expect("hide another tenant project"),
            None
        );
    }
}
