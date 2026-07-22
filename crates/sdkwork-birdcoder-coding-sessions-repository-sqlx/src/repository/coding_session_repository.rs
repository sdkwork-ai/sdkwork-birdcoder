use std::collections::BTreeMap;

use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::commands::{
    AppendCodingSessionRealtimeEventInput, CodingSessionInteractionKind, CreateCodingSessionInput,
    CreateCodingSessionTurnInput, EditCodingSessionMessageInput, ForkCodingSessionInput,
    SubmitApprovalDecisionInput, SubmitUserQuestionAnswerInput, UpdateCodingSessionInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::models::{
    ClaimCodingSessionOperationInput, CodingSessionDiscoveryScope, CodingSessionListQuery,
    CompleteCodingSessionOperationInput, DiscoveredNativeSessionInput,
    DurableCodingSessionOperation, EnqueueCodingSessionOperationInput,
    FailCodingSessionOperationInput, NativeSessionHistoryReconciliationInput,
    RenewCodingSessionOperationLeaseInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    ApprovalDecisionPayload, ClaimedCodingSessionInteraction, CodingSessionArtifactPayload,
    CodingSessionCheckpointPayload, CodingSessionEventPayload, CodingSessionListPage,
    CodingSessionPayload, CodingSessionReplayPage, CodingSessionTurnPayload,
    DeleteCodingSessionMessagePayload, EditCodingSessionMessagePayload,
    FinalizedProjectionTurnExecution, OperationPayload, PersistedCodingSessionMutation,
    PersistedProjectionTurnExecution, ResolvedCodingSessionInteraction, UserQuestionAnswerPayload,
};
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use sdkwork_birdcoder_sqlx_repository_pool::dialect::{
    numbered_placeholders, IS_NOT_DELETED, SET_SOFT_DELETED,
};
use sdkwork_utils_rust::is_blank;
use sqlx::{AnyPool, Row, Transaction};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::db::columns;
use crate::db::rows::*;
use crate::error::{map_sqlx_error, RepositoryError};
use crate::mapper::row_mapper;
use crate::repository::native_session_history;
use crate::repository::row_projection;
use crate::repository::session_history_copy;
use crate::repository::sqlx_helpers::{
    append_session_owner_scope_sql, ensure_session_in_tenant_scope,
    ensure_session_in_tenant_scope_in_transaction, ensure_workspace_in_tenant_scope,
    session_owner_scope, SessionOwnerScope,
};

#[derive(Clone)]
pub struct SqliteCodingSessionRepository {
    pool: AnyPool,
}

struct ResolvedStoredCodingSessionInteraction {
    resolution: ResolvedCodingSessionInteraction,
    source_event_version: i64,
    source_payload: BTreeMap<String, serde_json::Value>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum DiscoverySessionUpdateDisposition {
    Accepted,
    Stale,
}

#[derive(Clone, Copy)]
struct CodingSessionEventStreamScope<'a> {
    owner: SessionOwnerScope,
    session_id: &'a str,
}

impl<'a> CodingSessionEventStreamScope<'a> {
    fn new(owner: SessionOwnerScope, session_id: &'a str) -> Self {
        Self { owner, session_id }
    }
}

const INTERACTION_CLAIM_LEASE_SECONDS: i64 = 120;
const INTERNAL_INTERACTION_CLAIM_PAYLOAD_FIELDS: &[&str] = &[
    "claimId",
    "claimedAt",
    "claimExpiresAt",
    "releasedClaimId",
    "releasedAt",
    "settledClaimId",
];
const MUTABLE_INTERACTION_STATE_PAYLOAD_FIELDS: &[&str] = &[
    "answer",
    "answeredAt",
    "decision",
    "decisionReason",
    "decidedAt",
    "optionId",
    "optionLabel",
    "rejected",
    "settledAt",
    "status",
];

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

    fn timestamp_expression(is_postgres: bool) -> &'static str {
        if is_postgres {
            "CAST(? AS TIMESTAMPTZ)"
        } else {
            "?"
        }
    }

    fn json_expression(is_postgres: bool) -> &'static str {
        if is_postgres {
            "CAST(? AS JSONB)"
        } else {
            "?"
        }
    }

    fn boolean_literal(value: bool) -> &'static str {
        if value {
            "TRUE"
        } else {
            "FALSE"
        }
    }

    fn transaction_is_postgres(tx: &mut Transaction<'_, sqlx::Any>) -> bool {
        tx.as_mut()
            .backend_name()
            .eq_ignore_ascii_case("PostgreSQL")
    }

    async fn find_discovered_session_id_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        owner_scope: SessionOwnerScope,
        session: &DiscoveredNativeSessionInput,
    ) -> Result<Option<String>, CodingSessionError> {
        let sql = numbered_placeholders(&format!(
            "SELECT {} FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? \
             AND {IS_NOT_DELETED} LIMIT 1",
            columns::session::ID,
            columns::session::TABLE,
            columns::session::TENANT_ID,
            columns::session::USER_ID,
            columns::session::ENGINE_ID,
            columns::session::NATIVE_SESSION_ID,
        ));
        map_sqlx_error(
            sqlx::query_scalar::<sqlx::Any, String>(&sql)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .bind(&session.engine_id)
                .bind(&session.native_session_id)
                .fetch_optional(&mut **tx)
                .await,
        )
    }

    async fn resolve_discovered_session_id_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        is_postgres: bool,
        owner_scope: SessionOwnerScope,
        scope: &CodingSessionDiscoveryScope,
        session: &DiscoveredNativeSessionInput,
    ) -> Result<String, CodingSessionError> {
        if let Some(session_id) =
            Self::find_discovered_session_id_on_executor(tx, owner_scope, session).await?
        {
            return Ok(session_id);
        }

        let session_id = Uuid::new_v4().to_string();
        let timestamp_expression = Self::timestamp_expression(is_postgres);
        let sql = numbered_placeholders(&format!(
            "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
             VALUES (?, NULL, {timestamp_expression}, {timestamp_expression}, 0, FALSE, ?, ?, ?, ?, ?, ?, ?, 'provider', ?, ?, ?, ?, ?) \
             ON CONFLICT DO NOTHING",
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
            columns::session::RUNTIME_LOCATION_ID,
            columns::session::TITLE,
            columns::session::STATUS,
            columns::session::ENTRY_SURFACE,
            columns::session::HOST_MODE,
            columns::session::ENGINE_ID,
            columns::session::MODEL_ID,
            columns::session::NATIVE_SESSION_ID,
            columns::session::SORT_TIMESTAMP,
        ));
        let result = sqlx::query(&sql)
            .bind(&session_id)
            .bind(&session.created_at)
            .bind(&session.updated_at)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(&scope.workspace_id)
            .bind(&scope.project_id)
            .bind(&scope.runtime_location_id)
            .bind(&session.title)
            .bind(&session.status)
            .bind(&session.host_mode)
            .bind(&session.engine_id)
            .bind(&session.model_id)
            .bind(&session.native_session_id)
            .bind(session.sort_timestamp)
            .execute(&mut **tx)
            .await
            .map_err(|error| RepositoryError::Insert(error.to_string()))?;
        if result.rows_affected() == 1 {
            return Ok(session_id);
        }

        Self::find_discovered_session_id_on_executor(tx, owner_scope, session)
            .await?
            .ok_or_else(|| {
                CodingSessionError::Conflict(format!(
                    "native session {} for engine {} could not be materialized",
                    session.native_session_id, session.engine_id
                ))
            })
    }

    async fn update_discovered_session_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        is_postgres: bool,
        owner_scope: SessionOwnerScope,
        scope: &CodingSessionDiscoveryScope,
        session_id: &str,
        session: &DiscoveredNativeSessionInput,
    ) -> Result<DiscoverySessionUpdateDisposition, CodingSessionError> {
        let lock_sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = {} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::session::TABLE,
            columns::session::VERSION,
            columns::session::VERSION,
            columns::session::ID,
            columns::session::TENANT_ID,
            columns::session::USER_ID,
            columns::session::ENGINE_ID,
            columns::session::NATIVE_SESSION_ID,
        ));
        let locked = sqlx::query(&lock_sql)
            .bind(session_id)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(&session.engine_id)
            .bind(&session.native_session_id)
            .execute(&mut **tx)
            .await
            .map_err(|error| RepositoryError::Update(error.to_string()))?;
        if locked.rows_affected() != 1 {
            return Err(CodingSessionError::Conflict(format!(
                "native session {} for engine {} changed during materialization",
                session.native_session_id, session.engine_id
            )));
        }

        let projection = row_projection::session(is_postgres, "");
        let current_sql = numbered_placeholders(&format!(
            "SELECT {projection} FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::session::TABLE,
            columns::session::ID,
            columns::session::TENANT_ID,
            columns::session::USER_ID,
        ));
        let current = map_sqlx_error(
            sqlx::query(&current_sql)
                .bind(session_id)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .fetch_one(&mut **tx)
                .await,
        )?;
        let current = map_sqlx_error(SessionRow::from_row(&current))?;
        if discovered_session_snapshot_is_stale(&current, session) {
            return Ok(DiscoverySessionUpdateDisposition::Stale);
        }
        let effective_updated_at =
            later_storage_timestamp(current.updated_at.as_str(), session.updated_at.as_str());
        let effective_last_turn_at = later_optional_storage_timestamp(
            current.last_turn_at.as_deref(),
            session.last_turn_at.as_deref(),
        );
        if discovered_session_row_matches(
            &current,
            scope,
            session,
            effective_updated_at.as_str(),
            effective_last_turn_at.as_deref(),
        )? {
            return Ok(DiscoverySessionUpdateDisposition::Accepted);
        }

        let attributes = &session.native_attributes;
        let native_metadata_json = serde_json::to_string(&attributes.metadata)
            .map_err(|error| RepositoryError::Update(error.to_string()))?;
        let timestamp_expression = Self::timestamp_expression(is_postgres);
        let json_expression = Self::json_expression(is_postgres);
        let native_is_ephemeral = Self::boolean_literal(attributes.is_ephemeral);
        let native_is_sidechain = Self::boolean_literal(attributes.is_sidechain);
        let sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = ?, {} = ?, {} = ?, {} = ?, {} = ?, {} = ?, {} = ?, \
             {} = {timestamp_expression}, {} = {timestamp_expression}, {} = {timestamp_expression}, \
             {} = ?, {} = ?, {} = ?, {} = ?, {} = ?, {} = ?, {} = ?, {} = ?, {} = ?, \
             {} = ?, {} = ?, {} = ?, {} = ?, {} = ?, {} = ?, {} = {native_is_ephemeral}, \
             {} = {native_is_sidechain}, {} = ?, {} = {json_expression}, {} = ?, \
             {} = {timestamp_expression}, {} = {} + 1 \
             WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::session::TABLE,
            columns::session::WORKSPACE_ID,
            columns::session::PROJECT_ID,
            columns::session::RUNTIME_LOCATION_ID,
            columns::session::TITLE,
            columns::session::STATUS,
            columns::session::HOST_MODE,
            columns::session::MODEL_ID,
            columns::session::CREATED_AT,
            columns::session::UPDATED_AT,
            columns::session::LAST_TURN_AT,
            columns::session::NATIVE_SESSION_TREE_ID,
            columns::session::NATIVE_PARENT_SESSION_ID,
            columns::session::NATIVE_FORKED_FROM_SESSION_ID,
            columns::session::NATIVE_TITLE,
            columns::session::NATIVE_PREVIEW,
            columns::session::NATIVE_SOURCE,
            columns::session::PROVIDER_VERSION,
            columns::session::MODEL_PROVIDER,
            columns::session::NATIVE_PROJECT_ID,
            columns::session::NATIVE_CWD,
            columns::session::NATIVE_GIT_BRANCH,
            columns::session::NATIVE_GIT_COMMIT,
            columns::session::NATIVE_GIT_REPOSITORY_URL,
            columns::session::NATIVE_AGENT_NAME,
            columns::session::NATIVE_AGENT_ROLE,
            columns::session::NATIVE_IS_EPHEMERAL,
            columns::session::NATIVE_IS_SIDECHAIN,
            columns::session::NATIVE_SCHEMA_VERSION,
            columns::session::NATIVE_METADATA_JSON,
            columns::session::SORT_TIMESTAMP,
            columns::session::TRANSCRIPT_UPDATED_AT,
            columns::session::VERSION,
            columns::session::VERSION,
            columns::session::ID,
            columns::session::TENANT_ID,
            columns::session::USER_ID,
            columns::session::ENGINE_ID,
            columns::session::NATIVE_SESSION_ID,
        ));
        let result = sqlx::query(&sql)
            .bind(&scope.workspace_id)
            .bind(&scope.project_id)
            .bind(&scope.runtime_location_id)
            .bind(&session.title)
            .bind(&session.status)
            .bind(&session.host_mode)
            .bind(&session.model_id)
            .bind(&session.created_at)
            .bind(&effective_updated_at)
            .bind(&effective_last_turn_at)
            .bind(&attributes.session_tree_id)
            .bind(&attributes.parent_session_id)
            .bind(&attributes.forked_from_session_id)
            .bind(&attributes.title)
            .bind(&attributes.preview)
            .bind(&attributes.source)
            .bind(&attributes.provider_version)
            .bind(&attributes.model_provider)
            .bind(&attributes.project_id)
            .bind(&attributes.cwd)
            .bind(&attributes.git_branch)
            .bind(&attributes.git_commit)
            .bind(&attributes.git_repository_url)
            .bind(&attributes.agent_name)
            .bind(&attributes.agent_role)
            .bind(attributes.schema_version)
            .bind(&native_metadata_json)
            .bind(session.sort_timestamp)
            .bind(&session.transcript_updated_at)
            .bind(session_id)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(&session.engine_id)
            .bind(&session.native_session_id)
            .execute(&mut **tx)
            .await
            .map_err(|error| RepositoryError::Update(error.to_string()))?;
        if result.rows_affected() != 1 {
            return Err(CodingSessionError::Conflict(format!(
                "native session {} for engine {} changed during materialization",
                session.native_session_id, session.engine_id
            )));
        }
        Ok(DiscoverySessionUpdateDisposition::Accepted)
    }

    async fn sync_discovered_runtime_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        is_postgres: bool,
        owner_scope: SessionOwnerScope,
        session_id: &str,
        session: &DiscoveredNativeSessionInput,
    ) -> Result<(), CodingSessionError> {
        let runtime_id = format!("{session_id}:native-discovery-runtime");
        let timestamp_expression = Self::timestamp_expression(is_postgres);
        let json_expression = Self::json_expression(is_postgres);
        let empty_json = "{}";
        let state_sql = numbered_placeholders(&format!(
            "SELECT {}, {}, {}, {}, {}, {}, CASE WHEN {} THEN 1 ELSE 0 END AS deleted_flag, {}, {}, {} \
             FROM {} WHERE {} = ?",
            columns::runtime::TENANT_ID,
            columns::runtime::USER_ID,
            columns::runtime::CODING_SESSION_ID,
            columns::runtime::ENGINE_ID,
            columns::runtime::MODEL_ID,
            columns::runtime::HOST_MODE,
            columns::runtime::IS_DELETED,
            columns::runtime::STATUS,
            columns::runtime::TRANSPORT_KIND,
            columns::runtime::NATIVE_SESSION_ID,
            columns::runtime::TABLE,
            columns::runtime::ID,
        ));
        if let Some(row) = map_sqlx_error(
            sqlx::query(&state_sql)
                .bind(&runtime_id)
                .fetch_optional(&mut **tx)
                .await,
        )? {
            let tenant_id = map_sqlx_error(row.try_get::<i64, _>(columns::runtime::TENANT_ID))?;
            let user_id = map_sqlx_error(row.try_get::<i64, _>(columns::runtime::USER_ID))?;
            let coding_session_id =
                map_sqlx_error(row.try_get::<String, _>(columns::runtime::CODING_SESSION_ID))?;
            let engine_id = map_sqlx_error(row.try_get::<String, _>(columns::runtime::ENGINE_ID))?;
            let native_session_id = map_sqlx_error(
                row.try_get::<Option<String>, _>(columns::runtime::NATIVE_SESSION_ID),
            )?;
            if tenant_id != owner_scope.tenant_id
                || user_id != owner_scope.user_id
                || coding_session_id != session_id
                || engine_id != session.engine_id
                || native_session_id.as_deref() != Some(session.native_session_id.as_str())
            {
                return Err(CodingSessionError::Conflict(format!(
                    "native runtime binding for session {session_id} belongs to another provider identity"
                )));
            }
            let model_id = map_sqlx_error(row.try_get::<String, _>(columns::runtime::MODEL_ID))?;
            let host_mode = map_sqlx_error(row.try_get::<String, _>(columns::runtime::HOST_MODE))?;
            let status = map_sqlx_error(row.try_get::<String, _>(columns::runtime::STATUS))?;
            let transport_kind =
                map_sqlx_error(row.try_get::<String, _>(columns::runtime::TRANSPORT_KIND))?;
            let deleted_flag = map_sqlx_error(row.try_get::<i64, _>("deleted_flag"))?;
            if deleted_flag == 0
                && model_id == session.model_id
                && host_mode == session.host_mode
                && status == session.status
                && transport_kind == "provider-native"
            {
                return Ok(());
            }
        }
        let update_sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = {} + 1, {} = FALSE, {} = ?, \
             {} = ?, {} = ?, {} = ?, {} = 'provider-native', {} = ? \
             WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ?",
            columns::runtime::TABLE,
            columns::runtime::VERSION,
            columns::runtime::VERSION,
            columns::runtime::IS_DELETED,
            columns::runtime::ENGINE_ID,
            columns::runtime::MODEL_ID,
            columns::runtime::HOST_MODE,
            columns::runtime::STATUS,
            columns::runtime::TRANSPORT_KIND,
            columns::runtime::NATIVE_SESSION_ID,
            columns::runtime::ID,
            columns::runtime::CODING_SESSION_ID,
            columns::runtime::TENANT_ID,
            columns::runtime::USER_ID,
            columns::runtime::ENGINE_ID,
            columns::runtime::NATIVE_SESSION_ID,
        ));
        let result = sqlx::query(&update_sql)
            .bind(&session.engine_id)
            .bind(&session.model_id)
            .bind(&session.host_mode)
            .bind(&session.status)
            .bind(&session.native_session_id)
            .bind(&runtime_id)
            .bind(session_id)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(&session.engine_id)
            .bind(&session.native_session_id)
            .execute(&mut **tx)
            .await
            .map_err(|error| RepositoryError::Update(error.to_string()))?;
        if result.rows_affected() == 1 {
            return Ok(());
        }

        let insert_sql = numbered_placeholders(&format!(
            "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
             VALUES (?, NULL, {timestamp_expression}, {timestamp_expression}, 0, FALSE, ?, ?, ?, ?, ?, ?, ?, \
                     'provider-native', ?, NULL, {json_expression}, {json_expression})",
            columns::runtime::TABLE,
            columns::runtime::ID,
            columns::runtime::UUID,
            columns::runtime::CREATED_AT,
            columns::runtime::UPDATED_AT,
            columns::runtime::VERSION,
            columns::runtime::IS_DELETED,
            columns::runtime::TENANT_ID,
            columns::runtime::USER_ID,
            columns::runtime::CODING_SESSION_ID,
            columns::runtime::ENGINE_ID,
            columns::runtime::MODEL_ID,
            columns::runtime::HOST_MODE,
            columns::runtime::STATUS,
            columns::runtime::TRANSPORT_KIND,
            columns::runtime::NATIVE_SESSION_ID,
            columns::runtime::NATIVE_TURN_CONTAINER_ID,
            columns::runtime::CAPABILITY_SNAPSHOT_JSON,
            columns::runtime::METADATA_JSON,
        ));
        sqlx::query(&insert_sql)
            .bind(&runtime_id)
            .bind(&session.created_at)
            .bind(&session.updated_at)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(session_id)
            .bind(&session.engine_id)
            .bind(&session.model_id)
            .bind(&session.host_mode)
            .bind(&session.status)
            .bind(&session.native_session_id)
            .bind(empty_json)
            .bind(empty_json)
            .execute(&mut **tx)
            .await
            .map_err(|error| RepositoryError::Insert(error.to_string()))?;
        Ok(())
    }

    fn append_session_list_filters(sql: &mut String, query: &CodingSessionListQuery) {
        if query.engine_id.is_some() {
            sql.push_str(&format!(" AND s.{} = ?", columns::session::ENGINE_ID));
        }
        if query.project_id.is_some() {
            sql.push_str(&format!(" AND s.{} = ?", columns::session::PROJECT_ID));
        }
        if query.runtime_location_id.is_some() {
            sql.push_str(&format!(
                " AND s.{} = ?",
                columns::session::RUNTIME_LOCATION_ID
            ));
        }
        if query.workspace_id.is_some() {
            sql.push_str(&format!(" AND s.{} = ?", columns::session::WORKSPACE_ID));
        }
    }

    fn build_session_list_select_sql(
        filter_sql: &str,
        has_limit: bool,
        has_offset: bool,
        is_postgres: bool,
    ) -> String {
        let runtime_is_not_deleted =
            sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("r");
        let session_projection = row_projection::session(is_postgres, "s");
        let mut select_sql = format!(
            "WITH session_page AS MATERIALIZED (\
                 SELECT {session_projection} FROM ai_coding_session s"
        );
        select_sql.push_str(filter_sql);
        select_sql.push_str(" ORDER BY s.sort_timestamp DESC, s.id ASC");
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
             ORDER BY s.sort_timestamp DESC, s.id ASC",
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
        let projection = row_projection::message(self.is_postgres().await?, "");

        let sql = numbered_placeholders(&format!(
            "SELECT {projection} FROM {} WHERE {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::message::TABLE,
            columns::message::ID,
            columns::message::CODING_SESSION_ID,
        ));
        let row = map_sqlx_error(
            sqlx::query(&sql)
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
        owner_scope: SessionOwnerScope,
        session_id: &str,
    ) -> Result<usize, CodingSessionError> {
        let sql = numbered_placeholders(&format!(
            "SELECT COALESCE(MAX({}), 0) FROM {} \
                 WHERE {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::event::SEQUENCE_NO,
            columns::event::TABLE,
            columns::event::TENANT_ID,
            columns::event::USER_ID,
            columns::event::CODING_SESSION_ID,
        ));
        let max_sequence = map_sqlx_error(
            sqlx::query_scalar::<sqlx::Any, i64>(&sql)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .bind(session_id)
                .fetch_one(&mut **tx)
                .await,
        )?;

        let next_sequence = max_sequence
            .checked_add(1)
            .filter(|sequence| *sequence <= i64::from(i32::MAX))
            .ok_or_else(|| {
                CodingSessionError::Conflict(format!(
                    "event sequence space is exhausted for session {session_id}"
                ))
            })?;

        usize::try_from(next_sequence).map_err(|_| {
            CodingSessionError::Internal(format!(
                "event sequence cannot be represented for session {session_id}"
            ))
        })
    }

    /// Inserts a coding session event within an existing database transaction.
    /// The sequence number is allocated inside the same transaction to
    /// guarantee atomicity.
    async fn insert_coding_session_event_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        stream_scope: CodingSessionEventStreamScope<'_>,
        turn_id: Option<String>,
        runtime_id: Option<String>,
        kind: &str,
        payload: BTreeMap<String, serde_json::Value>,
        created_at: &str,
    ) -> Result<CodingSessionEventPayload, CodingSessionError> {
        let CodingSessionEventStreamScope {
            owner: owner_scope,
            session_id,
        } = stream_scope;
        let event_id = Uuid::new_v4().to_string();
        let sequence = Self::next_event_sequence_on_executor(tx, owner_scope, session_id).await?;
        let payload_json = serde_json::to_string(&payload)
            .map_err(|error| RepositoryError::Insert(error.to_string()))?;
        let is_postgres = Self::transaction_is_postgres(tx);
        let timestamp_expression = Self::timestamp_expression(is_postgres);
        let json_expression = Self::json_expression(is_postgres);

        let sql = numbered_placeholders(&format!(
            "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
             VALUES (?, {timestamp_expression}, {timestamp_expression}, ?, FALSE, ?, ?, ?, ?, ?, ?, ?, {json_expression})",
            columns::event::TABLE,
            columns::event::ID,
            columns::event::CREATED_AT,
            columns::event::UPDATED_AT,
            columns::event::VERSION,
            columns::event::IS_DELETED,
            columns::event::TENANT_ID,
            columns::event::USER_ID,
            columns::event::CODING_SESSION_ID,
            columns::event::TURN_ID,
            columns::event::RUNTIME_ID,
            columns::event::EVENT_KIND,
            columns::event::SEQUENCE_NO,
            columns::event::PAYLOAD_JSON,
        ));
        sqlx::query(&sql)
            .bind(&event_id)
            .bind(created_at)
            .bind(created_at)
            .bind(0i64)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(session_id)
            .bind(&turn_id)
            .bind(&runtime_id)
            .bind(kind)
            .bind(sequence as i64)
            .bind(&payload_json)
            .execute(&mut **tx)
            .await
            .map_err(|error: sqlx::Error| RepositoryError::Insert(error.to_string()))?;

        Ok(CodingSessionEventPayload {
            id: event_id,
            coding_session_id: session_id.to_owned(),
            turn_id,
            runtime_id,
            kind: kind.to_owned(),
            sequence,
            payload,
            created_at: created_at.to_owned(),
        })
    }

    /// Updates transcript freshness and acquires a session-scoped write lock
    /// before allocating an event sequence. This makes `MAX(sequence_no) + 1`
    /// safe for concurrent writers on both SQLite and PostgreSQL.
    async fn touch_session_transcript_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        owner_scope: SessionOwnerScope,
        session_id: &str,
        updated_at: &str,
        refresh_sort_timestamp: bool,
    ) -> Result<(), CodingSessionError> {
        let sort_assignment = if refresh_sort_timestamp {
            format!(", {} = ?", columns::session::SORT_TIMESTAMP)
        } else {
            String::new()
        };

        let timestamp_expression = Self::timestamp_expression(Self::transaction_is_postgres(tx));
        let sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = {timestamp_expression}, {} = {timestamp_expression}, {} = {} + 1{sort_assignment} \
             WHERE {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED} \
             AND EXISTS (SELECT 1 FROM studio_workspace w \
                 WHERE CAST(w.id AS TEXT) = {}.{} AND w.tenant_id = ? AND w.{IS_NOT_DELETED})",
            columns::session::TABLE,
            columns::session::TRANSCRIPT_UPDATED_AT,
            columns::session::UPDATED_AT,
            columns::session::VERSION,
            columns::session::VERSION,
            columns::session::ID,
            columns::session::TENANT_ID,
            columns::session::USER_ID,
            columns::session::TABLE,
            columns::session::WORKSPACE_ID,
        ));
        let mut query = sqlx::query(&sql).bind(updated_at).bind(updated_at);
        if refresh_sort_timestamp {
            query = query.bind(Self::sort_timestamp_now());
        }
        let result = query
            .bind(session_id)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(owner_scope.tenant_id)
            .execute(&mut **tx)
            .await
            .map_err(|error: sqlx::Error| RepositoryError::Update(error.to_string()))?;
        if result.rows_affected() != 1 {
            return Err(
                RepositoryError::NotFound(format!("session {session_id} not found")).into(),
            );
        }

        Ok(())
    }

    async fn load_realtime_event_turn_runtime_id_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        owner_scope: SessionOwnerScope,
        session_id: &str,
        turn_id: &str,
    ) -> Result<String, CodingSessionError> {
        let sql = numbered_placeholders(&format!(
            "SELECT {} FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::turn::RUNTIME_ID,
            columns::turn::TABLE,
            columns::turn::ID,
            columns::turn::CODING_SESSION_ID,
            columns::turn::TENANT_ID,
            columns::turn::USER_ID,
        ));
        map_sqlx_error(
            sqlx::query_scalar::<sqlx::Any, String>(&sql)
                .bind(turn_id)
                .bind(session_id)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .fetch_optional(&mut **tx)
                .await,
        )?
        .ok_or_else(|| RepositoryError::NotFound(format!("turn {turn_id} not found")).into())
    }

    async fn ensure_realtime_event_turn_in_scope_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        owner_scope: SessionOwnerScope,
        session_id: &str,
        turn_id: &str,
        runtime_id: Option<&str>,
    ) -> Result<(), CodingSessionError> {
        let persisted_runtime_id = Self::load_realtime_event_turn_runtime_id_on_executor(
            tx,
            owner_scope,
            session_id,
            turn_id,
        )
        .await?;

        if let Some(runtime_id) = runtime_id {
            if runtime_id != persisted_runtime_id {
                return Err(CodingSessionError::Conflict(format!(
                    "runtime {runtime_id} does not belong to turn {turn_id}"
                )));
            }
        }

        Ok(())
    }

    /// Resolves the internal provider-neutral interaction identifier from the
    /// durable event used by the public mutation path. The query deliberately
    /// scopes by the event primary key and ownership columns; payload JSON is
    /// parsed only after the canonical event has been selected.
    async fn resolve_durable_interaction_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        is_postgres: bool,
        owner_scope: SessionOwnerScope,
        session_id: &str,
        interaction_event_id: &str,
        interaction_kind: CodingSessionInteractionKind,
        require_unsettled: bool,
    ) -> Result<ResolvedStoredCodingSessionInteraction, CodingSessionError> {
        let interaction_event_id = normalize_optional_realtime_event_reference(
            Some(interaction_event_id),
            "interaction_event_id",
        )?
        .ok_or_else(|| {
            CodingSessionError::InvalidInput("interaction_event_id is required".to_owned())
        })?;

        let projection = row_projection::event(is_postgres, "");
        let sql = numbered_placeholders(&format!(
            "SELECT {projection} FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? \
                 AND {} = ? AND {IS_NOT_DELETED}",
            columns::event::TABLE,
            columns::event::ID,
            columns::event::CODING_SESSION_ID,
            columns::event::TENANT_ID,
            columns::event::USER_ID,
            columns::event::EVENT_KIND,
        ));
        let row = map_sqlx_error(
            sqlx::query(&sql)
                .bind(&interaction_event_id)
                .bind(session_id)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .bind(interaction_kind.source_event_kind())
                .fetch_optional(&mut **tx)
                .await,
        )?
        .ok_or_else(|| {
            RepositoryError::NotFound(format!(
                "{} interaction event {interaction_event_id} not found",
                interaction_kind.source_event_kind()
            ))
        })?;

        let event = map_sqlx_error(EventRow::from_row(&row))?;
        let turn_id = require_stored_interaction_reference(
            &event.id,
            event.turn_id.as_deref(),
            columns::event::TURN_ID,
        )?;
        let runtime_id = require_stored_interaction_reference(
            &event.id,
            event.runtime_id.as_deref(),
            columns::event::RUNTIME_ID,
        )?;
        Self::ensure_realtime_event_turn_in_scope_on_executor(
            tx,
            owner_scope,
            session_id,
            &turn_id,
            Some(&runtime_id),
        )
        .await?;

        let source_payload =
            serde_json::from_str::<BTreeMap<String, serde_json::Value>>(&event.payload_json)
                .map_err(|error| {
                    CodingSessionError::Conflict(format!(
                        "interaction event {} has malformed canonical payload: {error}",
                        event.id
                    ))
                })?;
        let interaction_id = require_canonical_interaction_payload_string(
            &source_payload,
            &event.id,
            "interactionId",
        )?;
        let payload_kind = require_canonical_interaction_payload_string(
            &source_payload,
            &event.id,
            "interactionKind",
        )?;
        if payload_kind != interaction_kind.payload_kind() {
            return Err(CodingSessionError::Conflict(format!(
                "interaction event {} has interactionKind {payload_kind:?}; expected {:?}",
                event.id,
                interaction_kind.payload_kind(),
            )));
        }
        if require_unsettled && source_payload.contains_key("settledAt") {
            return Err(CodingSessionError::Conflict(format!(
                "interaction event {} is already settled",
                event.id
            )));
        }

        Ok(ResolvedStoredCodingSessionInteraction {
            resolution: ResolvedCodingSessionInteraction {
                event_id: event.id,
                coding_session_id: event.coding_session_id,
                turn_id,
                runtime_id,
                interaction_id,
                interaction_kind,
            },
            source_event_version: event.version,
            source_payload,
        })
    }

    /// Marks a canonical interaction source event as settled while retaining
    /// the normalized interaction fields. The optimistic version predicate
    /// makes a second decision/answer fail instead of allocating another
    /// durable `operation.updated` event.
    async fn update_durable_interaction_source_event_on_executor(
        tx: &mut Transaction<'_, sqlx::Any>,
        owner_scope: SessionOwnerScope,
        source: &ResolvedStoredCodingSessionInteraction,
        payload: &BTreeMap<String, serde_json::Value>,
        updated_at: &str,
    ) -> Result<(), CodingSessionError> {
        ensure_interaction_payload_evolution_is_valid(source, payload)?;
        let payload_json = serde_json::to_string(payload)
            .map_err(|error| RepositoryError::Update(error.to_string()))?;
        let is_postgres = Self::transaction_is_postgres(tx);
        let json_expression = Self::json_expression(is_postgres);
        let timestamp_expression = Self::timestamp_expression(is_postgres);
        let sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = {json_expression}, {} = {timestamp_expression}, {} = {} + 1 \
             WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? \
             AND {} = ? AND {IS_NOT_DELETED}",
            columns::event::TABLE,
            columns::event::PAYLOAD_JSON,
            columns::event::UPDATED_AT,
            columns::event::VERSION,
            columns::event::VERSION,
            columns::event::ID,
            columns::event::CODING_SESSION_ID,
            columns::event::TENANT_ID,
            columns::event::USER_ID,
            columns::event::EVENT_KIND,
            columns::event::VERSION,
        ));
        let result = sqlx::query(&sql)
            .bind(&payload_json)
            .bind(updated_at)
            .bind(&source.resolution.event_id)
            .bind(&source.resolution.coding_session_id)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(source.resolution.interaction_kind.source_event_kind())
            .bind(source.source_event_version)
            .execute(&mut **tx)
            .await
            .map_err(|error: sqlx::Error| RepositoryError::Update(error.to_string()))?;

        if result.rows_affected() != 1 {
            return Err(CodingSessionError::Conflict(format!(
                "interaction event {} was already settled or changed",
                source.resolution.event_id
            )));
        }

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

fn normalize_realtime_event_kind(value: &str) -> Result<String, CodingSessionError> {
    if is_blank(Some(value)) {
        return Err(CodingSessionError::InvalidInput(
            "event kind is required".into(),
        ));
    }
    Ok(value.trim().to_owned())
}

/// Public event projection never exposes the repository-only lease fields.
/// Event identity, owner scope, sequence, kind, and canonical interaction
/// fields remain immutable; interaction status annotations are the only
/// source-payload fields allowed to evolve under an optimistic version check.
fn project_public_coding_session_event(
    mut event: CodingSessionEventPayload,
) -> CodingSessionEventPayload {
    for field in INTERNAL_INTERACTION_CLAIM_PAYLOAD_FIELDS {
        event.payload.remove(*field);
    }
    event
}

fn is_internal_interaction_claim_field(field: &str) -> bool {
    INTERNAL_INTERACTION_CLAIM_PAYLOAD_FIELDS.contains(&field)
}

fn is_mutable_interaction_state_field(field: &str) -> bool {
    MUTABLE_INTERACTION_STATE_PAYLOAD_FIELDS.contains(&field)
}

fn ensure_interaction_payload_evolution_is_valid(
    source: &ResolvedStoredCodingSessionInteraction,
    updated_payload: &BTreeMap<String, serde_json::Value>,
) -> Result<(), CodingSessionError> {
    for (field, source_value) in &source.source_payload {
        if !is_internal_interaction_claim_field(field)
            && !is_mutable_interaction_state_field(field)
            && updated_payload.get(field) != Some(source_value)
        {
            return Err(CodingSessionError::Conflict(format!(
                "interaction event {} attempted to change immutable payload field {field}",
                source.resolution.event_id
            )));
        }
    }
    for field in updated_payload.keys() {
        if !source.source_payload.contains_key(field)
            && !is_internal_interaction_claim_field(field)
            && !is_mutable_interaction_state_field(field)
        {
            return Err(CodingSessionError::Conflict(format!(
                "interaction event {} attempted to add immutable payload field {field}",
                source.resolution.event_id
            )));
        }
    }

    Ok(())
}

fn event_sequence_to_i64(sequence: usize, field: &str) -> Result<i64, CodingSessionError> {
    i64::try_from(sequence).map_err(|_| {
        CodingSessionError::InvalidInput(format!("{field} is outside the durable event range"))
    })
}

fn event_sequence_to_usize(sequence: i64, field: &str) -> Result<usize, CodingSessionError> {
    usize::try_from(sequence).map_err(|_| {
        CodingSessionError::Internal(format!("stored {field} is outside the supported range"))
    })
}

fn normalize_optional_realtime_event_reference(
    value: Option<&str>,
    field: &str,
) -> Result<Option<String>, CodingSessionError> {
    let Some(value) = value else {
        return Ok(None);
    };
    if is_blank(Some(value)) {
        return Err(CodingSessionError::InvalidInput(format!(
            "{field} must not be blank when supplied"
        )));
    }
    Ok(Some(value.trim().to_owned()))
}

fn require_stored_interaction_reference(
    event_id: &str,
    value: Option<&str>,
    field: &str,
) -> Result<String, CodingSessionError> {
    let Some(value) = value else {
        return Err(CodingSessionError::Conflict(format!(
            "interaction event {event_id} has no {field}"
        )));
    };
    if is_blank(Some(value)) {
        return Err(CodingSessionError::Conflict(format!(
            "interaction event {event_id} has a blank {field}"
        )));
    }
    Ok(value.trim().to_owned())
}

fn require_canonical_interaction_payload_string(
    payload: &BTreeMap<String, serde_json::Value>,
    event_id: &str,
    field: &str,
) -> Result<String, CodingSessionError> {
    let Some(value) = payload.get(field).and_then(serde_json::Value::as_str) else {
        return Err(CodingSessionError::Conflict(format!(
            "interaction event {event_id} is missing string payload field {field}"
        )));
    };
    if is_blank(Some(value)) {
        return Err(CodingSessionError::Conflict(format!(
            "interaction event {event_id} has a blank payload field {field}"
        )));
    }
    Ok(value.trim().to_owned())
}

fn active_interaction_claim_id(
    payload: &BTreeMap<String, serde_json::Value>,
    event_id: &str,
) -> Result<Option<String>, CodingSessionError> {
    let claim_fields_present = ["claimId", "claimedAt", "claimExpiresAt"]
        .iter()
        .any(|field| payload.contains_key(*field));
    let Some(claim_id) = payload.get("claimId") else {
        if claim_fields_present {
            return Err(CodingSessionError::Conflict(format!(
                "interaction event {event_id} has an incomplete claim record"
            )));
        }
        return Ok(None);
    };
    let Some(claim_id) = claim_id.as_str() else {
        return Err(CodingSessionError::Conflict(format!(
            "interaction event {event_id} has a non-string claimId"
        )));
    };
    if is_blank(Some(claim_id)) {
        return Err(CodingSessionError::Conflict(format!(
            "interaction event {event_id} has a blank claimId"
        )));
    }
    let claimed_at = require_canonical_interaction_payload_string(payload, event_id, "claimedAt")?;
    let claim_expires_at =
        require_canonical_interaction_payload_string(payload, event_id, "claimExpiresAt")?;
    let parse_claim_instant = |value: &str, field: &str| {
        OffsetDateTime::parse(
            value,
            &time::format_description::well_known::Iso8601::DEFAULT,
        )
        .map_err(|error| {
            CodingSessionError::Conflict(format!(
                "interaction event {event_id} has an invalid {field}: {error}"
            ))
        })
    };
    let claimed_at = parse_claim_instant(&claimed_at, "claimedAt")?;
    let expires_at = parse_claim_instant(&claim_expires_at, "claimExpiresAt")?;
    if expires_at <= claimed_at {
        return Err(CodingSessionError::Conflict(format!(
            "interaction event {event_id} has a non-positive claim lease"
        )));
    }
    if expires_at > OffsetDateTime::now_utc() {
        return Ok(Some(claim_id.trim().to_owned()));
    }

    Ok(None)
}

fn require_owned_interaction_claim(
    payload: &BTreeMap<String, serde_json::Value>,
    event_id: &str,
    claim_id: &str,
) -> Result<String, CodingSessionError> {
    if is_blank(Some(claim_id)) {
        return Err(CodingSessionError::InvalidInput(
            "interaction_claim_id is required".to_owned(),
        ));
    }
    let expected_claim_id = claim_id.trim();
    let active_claim_id = active_interaction_claim_id(payload, event_id)?.ok_or_else(|| {
        CodingSessionError::Conflict(format!(
            "interaction event {event_id} claim has expired or was released"
        ))
    })?;
    if active_claim_id != expected_claim_id {
        return Err(CodingSessionError::Conflict(format!(
            "interaction event {event_id} is claimed by another request"
        )));
    }
    Ok(expected_claim_id.to_owned())
}

fn interaction_claim_expires_at() -> Result<String, CodingSessionError> {
    (OffsetDateTime::now_utc() + time::Duration::seconds(INTERACTION_CLAIM_LEASE_SECONDS))
        .format(&time::format_description::well_known::Iso8601::DEFAULT)
        .map_err(|error| {
            CodingSessionError::Internal(format!("cannot format claim expiry: {error}"))
        })
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

fn discovered_session_snapshot_is_stale(
    current: &SessionRow,
    incoming: &DiscoveredNativeSessionInput,
) -> bool {
    if current
        .sort_timestamp
        .is_some_and(|sort_timestamp| incoming.sort_timestamp < sort_timestamp)
    {
        return true;
    }

    let current_revision = current
        .transcript_updated_at
        .as_deref()
        .unwrap_or(current.updated_at.as_str());
    let incoming_revision = incoming
        .transcript_updated_at
        .as_deref()
        .unwrap_or(incoming.updated_at.as_str());
    parse_storage_timestamp(incoming_revision)
        .zip(parse_storage_timestamp(current_revision))
        .is_some_and(|(incoming_revision, current_revision)| incoming_revision < current_revision)
}

fn discovered_session_row_matches(
    current: &SessionRow,
    scope: &CodingSessionDiscoveryScope,
    incoming: &DiscoveredNativeSessionInput,
    expected_updated_at: &str,
    expected_last_turn_at: Option<&str>,
) -> Result<bool, CodingSessionError> {
    let attributes = &incoming.native_attributes;
    let stored_metadata = serde_json::from_str::<serde_json::Value>(
        current.native_metadata_json.as_str(),
    )
    .map_err(|error| {
        CodingSessionError::Conflict(format!(
            "stored native session metadata is malformed: {error}"
        ))
    })?;
    let incoming_metadata = serde_json::to_value(&attributes.metadata)
        .map_err(|error| RepositoryError::Mapping(error.to_string()))?;
    Ok(current.is_deleted == 0
        && current.workspace_id == scope.workspace_id
        && current.project_id == scope.project_id
        && current.runtime_location_id.as_deref() == Some(scope.runtime_location_id.as_str())
        && current.title == incoming.title
        && current.status == incoming.status
        && current.entry_surface == "provider"
        && current.host_mode == incoming.host_mode
        && current.engine_id == incoming.engine_id
        && current.model_id == incoming.model_id
        && current.native_session_id.as_deref() == Some(incoming.native_session_id.as_str())
        && storage_timestamps_equal(&current.created_at, &incoming.created_at)
        && storage_timestamps_equal(&current.updated_at, expected_updated_at)
        && optional_storage_timestamps_equal(
            current.last_turn_at.as_deref(),
            expected_last_turn_at,
        )
        && current.native_session_tree_id == attributes.session_tree_id
        && current.native_parent_session_id == attributes.parent_session_id
        && current.native_forked_from_session_id == attributes.forked_from_session_id
        && current.native_title == attributes.title
        && current.native_preview == attributes.preview
        && current.native_source == attributes.source
        && current.provider_version == attributes.provider_version
        && current.model_provider == attributes.model_provider
        && current.native_project_id == attributes.project_id
        && current.native_cwd == attributes.cwd
        && current.native_git_branch == attributes.git_branch
        && current.native_git_commit == attributes.git_commit
        && current.native_git_repository_url == attributes.git_repository_url
        && current.native_agent_name == attributes.agent_name
        && current.native_agent_role == attributes.agent_role
        && (current.native_is_ephemeral != 0) == attributes.is_ephemeral
        && (current.native_is_sidechain != 0) == attributes.is_sidechain
        && current.native_schema_version == attributes.schema_version
        && stored_metadata == incoming_metadata
        && current.sort_timestamp == Some(incoming.sort_timestamp)
        && optional_storage_timestamps_equal(
            current.transcript_updated_at.as_deref(),
            incoming.transcript_updated_at.as_deref(),
        ))
}

fn optional_storage_timestamps_equal(left: Option<&str>, right: Option<&str>) -> bool {
    match (left, right) {
        (Some(left), Some(right)) => storage_timestamps_equal(left, right),
        (None, None) => true,
        _ => false,
    }
}

fn storage_timestamps_equal(left: &str, right: &str) -> bool {
    parse_storage_timestamp(left)
        .zip(parse_storage_timestamp(right))
        .map(|(left, right)| left == right)
        .unwrap_or_else(|| left == right)
}

fn later_storage_timestamp(left: &str, right: &str) -> String {
    match (
        parse_storage_timestamp(left),
        parse_storage_timestamp(right),
    ) {
        (Some(left_timestamp), Some(right_timestamp)) if left_timestamp > right_timestamp => {
            left.to_owned()
        }
        _ => right.to_owned(),
    }
}

fn later_optional_storage_timestamp(left: Option<&str>, right: Option<&str>) -> Option<String> {
    match (left, right) {
        (Some(left), Some(right)) => Some(later_storage_timestamp(left, right)),
        (Some(left), None) => Some(left.to_owned()),
        (None, Some(right)) => Some(right.to_owned()),
        (None, None) => None,
    }
}

fn parse_storage_timestamp(value: &str) -> Option<OffsetDateTime> {
    OffsetDateTime::parse(
        value.trim(),
        &time::format_description::well_known::Iso8601::DEFAULT,
    )
    .ok()
}

#[async_trait::async_trait]
impl CodingSessionRepository for SqliteCodingSessionRepository {
    async fn upsert_discovered_native_sessions(
        &self,
        ctx: &CodingSessionContext,
        scope: &CodingSessionDiscoveryScope,
        sessions: &[DiscoveredNativeSessionInput],
    ) -> Result<(), CodingSessionError> {
        if sessions.is_empty() {
            return Ok(());
        }
        if is_blank(Some(scope.workspace_id.as_str()))
            || is_blank(Some(scope.project_id.as_str()))
            || is_blank(Some(scope.runtime_location_id.as_str()))
        {
            return Err(CodingSessionError::InvalidInput(
                "workspace_id, project_id, and runtime_location_id are required for native session discovery"
                    .to_owned(),
            ));
        }
        for session in sessions {
            if is_blank(Some(session.engine_id.as_str()))
                || is_blank(Some(session.native_session_id.as_str()))
            {
                return Err(CodingSessionError::InvalidInput(
                    "engine_id and native_session_id are required for native session discovery"
                        .to_owned(),
                ));
            }
        }

        ensure_workspace_in_tenant_scope(&self.pool, ctx, &scope.workspace_id).await?;
        let owner_scope = session_owner_scope(ctx)?;
        let is_postgres = self.is_postgres().await?;
        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        for session in sessions {
            let session_id = Self::resolve_discovered_session_id_on_executor(
                &mut tx,
                is_postgres,
                owner_scope,
                scope,
                session,
            )
            .await?;
            let disposition = Self::update_discovered_session_on_executor(
                &mut tx,
                is_postgres,
                owner_scope,
                scope,
                &session_id,
                session,
            )
            .await?;
            if disposition == DiscoverySessionUpdateDisposition::Accepted {
                Self::sync_discovered_runtime_on_executor(
                    &mut tx,
                    is_postgres,
                    owner_scope,
                    &session_id,
                    session,
                )
                .await?;
            }
        }
        map_sqlx_error(tx.commit().await)?;
        Ok(())
    }

    async fn native_session_history_refresh_required(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        engine_id: &str,
        native_session_id: &str,
        source_revision: &str,
    ) -> Result<bool, CodingSessionError> {
        native_session_history::refresh_required(
            &self.pool,
            self.is_postgres().await?,
            session_owner_scope(ctx)?,
            session_id,
            engine_id,
            native_session_id,
            source_revision,
        )
        .await
    }

    async fn reconcile_native_session_history(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        input: &NativeSessionHistoryReconciliationInput,
    ) -> Result<(), CodingSessionError> {
        native_session_history::reconcile(
            &self.pool,
            self.is_postgres().await?,
            session_owner_scope(ctx)?,
            session_id,
            input,
        )
        .await
    }

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

        let count_sql = numbered_placeholders(&format!(
            "SELECT COUNT(*) AS total FROM ai_coding_session s{filter_sql}"
        ));
        let mut count_query = sqlx::query_scalar::<_, i64>(&count_sql);
        if let Some(ref engine_id) = query.engine_id {
            count_query = count_query.bind(engine_id);
        }
        if let Some(ref project_id) = query.project_id {
            count_query = count_query.bind(project_id);
        }
        if let Some(ref runtime_location_id) = query.runtime_location_id {
            count_query = count_query.bind(runtime_location_id);
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
        let is_postgres = self.is_postgres().await?;
        let select_sql = numbered_placeholders(&Self::build_session_list_select_sql(
            &filter_sql,
            limit_value.is_some(),
            offset_value.is_some(),
            is_postgres,
        ));

        let mut list_query = sqlx::query(&select_sql);
        if let Some(ref engine_id) = query.engine_id {
            list_query = list_query.bind(engine_id);
        }
        if let Some(ref project_id) = query.project_id {
            list_query = list_query.bind(project_id);
        }
        if let Some(ref runtime_location_id) = query.runtime_location_id {
            list_query = list_query.bind(runtime_location_id);
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
        let projection = row_projection::session(self.is_postgres().await?, "");
        let mut sql = format!(
            "SELECT {projection} FROM {} WHERE {} = ? AND {IS_NOT_DELETED}",
            columns::session::TABLE,
            columns::session::ID,
        );
        let owner_scope = append_session_owner_scope_sql(ctx, columns::session::TABLE, &mut sql)?;

        let sql = numbered_placeholders(&sql);
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

        let runtime_sql = numbered_placeholders(&format!(
            "SELECT {} FROM {} WHERE {} = ? AND {IS_NOT_DELETED} ORDER BY {} DESC LIMIT 1",
            columns::runtime::STATUS,
            columns::runtime::TABLE,
            columns::runtime::CODING_SESSION_ID,
            columns::runtime::CREATED_AT,
        ));
        let runtime_status = map_sqlx_error(
            sqlx::query(&runtime_sql)
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
        let runtime_location_id = input.runtime_location_id.clone();
        let title = input.title.clone();
        let host_mode = input.host_mode.clone();
        let engine_id = input.engine_id.clone();
        let model_id = input.model_id.clone();
        let sort_timestamp = Self::sort_timestamp_now();
        let owner_scope = session_owner_scope(ctx)?;
        let timestamp_expression = Self::timestamp_expression(self.is_postgres().await?);

        ensure_workspace_in_tenant_scope(&self.pool, ctx, &workspace_id)
            .await
            .map_err(CodingSessionError::from)?;

        let sql = numbered_placeholders(&format!(
            "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
             VALUES (?, NULL, {timestamp_expression}, {timestamp_expression}, 0, FALSE, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
            columns::session::RUNTIME_LOCATION_ID,
            columns::session::TITLE,
            columns::session::STATUS,
            columns::session::ENTRY_SURFACE,
            columns::session::HOST_MODE,
            columns::session::ENGINE_ID,
            columns::session::MODEL_ID,
            columns::session::SORT_TIMESTAMP,
        ));
        sqlx::query(&sql)
            .bind(&id)
            .bind(&now)
            .bind(&now)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(&workspace_id)
            .bind(&project_id)
            .bind(&runtime_location_id)
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
            runtime_location_id: Some(runtime_location_id),
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
            native_attributes: Default::default(),
        })
    }

    async fn update_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        input: &UpdateCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let now = Self::now_iso();
        let timestamp_expression = Self::timestamp_expression(self.is_postgres().await?);

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
        sets.push(format!(
            "{} = {timestamp_expression}",
            columns::session::UPDATED_AT
        ));
        sets.push(format!(
            "{} = {} + 1",
            columns::session::VERSION,
            columns::session::VERSION
        ));

        let sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} WHERE {} = ? AND {IS_NOT_DELETED}",
            columns::session::TABLE,
            sets.join(", "),
            columns::session::ID,
        ));

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

        let projection = row_projection::session(self.is_postgres().await?, "");
        let select_sql = numbered_placeholders(&format!(
            "SELECT {projection} FROM {} WHERE {} = ?",
            columns::session::TABLE,
            columns::session::ID,
        ));
        let row = map_sqlx_error(
            sqlx::query(&select_sql)
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
        let timestamp_expression = Self::timestamp_expression(self.is_postgres().await?);

        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let sql = numbered_placeholders(&format!(
            "UPDATE {} SET {SET_SOFT_DELETED}, {} = {timestamp_expression}, {} = {} + 1 WHERE {} = ? AND {IS_NOT_DELETED}",
            columns::session::TABLE,
            columns::session::UPDATED_AT,
            columns::session::VERSION,
            columns::session::VERSION,
            columns::session::ID,
        ));
        let result = sqlx::query(&sql)
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
        let is_postgres = self.is_postgres().await?;
        let projection = row_projection::session(is_postgres, "");

        let select_sql = numbered_placeholders(&format!(
            "SELECT {projection} FROM {} WHERE {} = ? AND {IS_NOT_DELETED}",
            columns::session::TABLE,
            columns::session::ID,
        ));
        let row = map_sqlx_error(
            sqlx::query(&select_sql)
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
        let timestamp_expression = Self::timestamp_expression(is_postgres);

        let insert_sql = numbered_placeholders(&format!(
            "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                 VALUES (?, NULL, {timestamp_expression}, {timestamp_expression}, 0, FALSE, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
                columns::session::RUNTIME_LOCATION_ID,
                columns::session::TITLE,
                columns::session::STATUS,
                columns::session::ENTRY_SURFACE,
                columns::session::HOST_MODE,
                columns::session::ENGINE_ID,
                columns::session::MODEL_ID,
                columns::session::SORT_TIMESTAMP,
            ));
        map_sqlx_error(
            sqlx::query(&insert_sql)
                .bind(&new_id)
                .bind(&now)
                .bind(&now)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .bind(&original.workspace_id)
                .bind(&original.project_id)
                .bind(&original.runtime_location_id)
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
            runtime_location_id: original.runtime_location_id,
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
            native_attributes: Default::default(),
        };

        if let Err(error) = session_history_copy::copy_session_history_in_transaction(
            &mut tx,
            is_postgres,
            ctx,
            session_id,
            &new_id,
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
        let projection = row_projection::turn(self.is_postgres().await?, "");

        // PAGINATION_SPEC.md §2: push LIMIT/OFFSET to SQL, never unbounded collect.
        let count_sql = numbered_placeholders(&format!(
            "SELECT COUNT(*) FROM {} WHERE {} = ? AND {IS_NOT_DELETED}",
            columns::turn::TABLE,
            columns::turn::CODING_SESSION_ID,
        ));
        let total: i64 = map_sqlx_error(
            sqlx::query_scalar(&count_sql)
                .bind(session_id)
                .fetch_one(&self.pool)
                .await,
        )?;

        let list_sql = numbered_placeholders(&format!(
                "SELECT {projection} FROM {} WHERE {} = ? AND {IS_NOT_DELETED} ORDER BY {} ASC LIMIT ? OFFSET ?",
                columns::turn::TABLE,
                columns::turn::CODING_SESSION_ID,
                columns::turn::CREATED_AT,
            ));
        let rows = map_sqlx_error(
            sqlx::query(&list_sql)
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
        let projection = row_projection::turn(self.is_postgres().await?, "");

        let sql = numbered_placeholders(&format!(
            "SELECT {projection} FROM {} WHERE {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::turn::TABLE,
            columns::turn::ID,
            columns::turn::CODING_SESSION_ID,
        ));
        let row = map_sqlx_error(
            sqlx::query(&sql)
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
        let is_postgres = self.is_postgres().await?;
        let timestamp_expression = Self::timestamp_expression(is_postgres);
        let json_expression = Self::json_expression(is_postgres);

        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;

        let mut tx = map_sqlx_error(self.pool.begin().await)?;

        let turn_insert_sql = numbered_placeholders(&format!(
                "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                 VALUES (?, {timestamp_expression}, {timestamp_expression}, 0, FALSE, ?, ?, ?, ?, ?, ?, ?)",
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
            ));
        map_sqlx_error(
            sqlx::query(&turn_insert_sql)
                .bind(&turn_id)
                .bind(&now)
                .bind(&now)
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

        let operation_insert_sql = numbered_placeholders(&format!(
                "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                 VALUES (?, {timestamp_expression}, {timestamp_expression}, 0, FALSE, ?, ?, ?, ?, ?, ?, ?, {json_expression})",
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
            ));
        map_sqlx_error(
            sqlx::query(&operation_insert_sql)
                .bind(&operation_id)
                .bind(&now)
                .bind(&now)
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
        let session_update_sql = numbered_placeholders(&format!(
                "UPDATE {} SET {} = {timestamp_expression}, {} = {timestamp_expression}, {} = ? WHERE {} = ?",
                columns::session::TABLE,
                columns::session::LAST_TURN_AT,
                columns::session::UPDATED_AT,
                columns::session::SORT_TIMESTAMP,
                columns::session::ID,
            ));
        map_sqlx_error(
            sqlx::query(&session_update_sql)
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
        let owner_scope = session_owner_scope(ctx)?;
        let timestamp_expression = Self::timestamp_expression(self.is_postgres().await?);

        let mut tx = map_sqlx_error(self.pool.begin().await)?;

        let sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = ?, {} = {timestamp_expression}, {} = {} + 1 WHERE {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::message::TABLE,
            columns::message::CONTENT,
            columns::message::UPDATED_AT,
            columns::message::VERSION,
            columns::message::VERSION,
            columns::message::ID,
            columns::message::CODING_SESSION_ID,
        ));
        sqlx::query(&sql)
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

        Self::touch_session_transcript_on_executor(&mut tx, owner_scope, session_id, &now, true)
            .await?;
        let _ = Self::insert_coding_session_event_on_executor(
            &mut tx,
            CodingSessionEventStreamScope::new(owner_scope, session_id),
            message.turn_id.clone(),
            None,
            "message.edited",
            payload,
            &now,
        )
        .await?;

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
        let owner_scope = session_owner_scope(ctx)?;

        let mut tx = map_sqlx_error(self.pool.begin().await)?;

        let sql = numbered_placeholders(&format!(
            "UPDATE {} SET {SET_SOFT_DELETED}, {} = ?, {} = {} + 1 WHERE {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::message::TABLE,
            columns::message::UPDATED_AT,
            columns::message::VERSION,
            columns::message::VERSION,
            columns::message::ID,
            columns::message::CODING_SESSION_ID,
        ));
        sqlx::query(&sql)
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

        Self::touch_session_transcript_on_executor(&mut tx, owner_scope, session_id, &now, true)
            .await?;
        let _ = Self::insert_coding_session_event_on_executor(
            &mut tx,
            CodingSessionEventStreamScope::new(owner_scope, session_id),
            message.turn_id.clone(),
            None,
            "message.deleted",
            payload,
            &now,
        )
        .await?;

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
        let owner_scope = session_owner_scope(ctx)?;
        let projection = row_projection::event(self.is_postgres().await?, "");

        let where_sql = format!(
            " WHERE {} = ? AND {} = ? AND {} = ? AND {}",
            columns::event::TENANT_ID,
            columns::event::USER_ID,
            columns::event::CODING_SESSION_ID,
            IS_NOT_DELETED,
        );
        let count_sql = numbered_placeholders(&format!(
            "SELECT COUNT(*) AS total FROM {}{}",
            columns::event::TABLE,
            where_sql
        ));
        let total = map_sqlx_error(
            sqlx::query_scalar::<_, i64>(&count_sql)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .bind(session_id)
                .fetch_one(&self.pool)
                .await,
        )? as usize;

        let list_sql = numbered_placeholders(&format!(
            "SELECT {projection} FROM {}{} ORDER BY {} ASC LIMIT ? OFFSET ?",
            columns::event::TABLE,
            where_sql,
            columns::event::SEQUENCE_NO,
        ));
        let rows = map_sqlx_error(
            sqlx::query(&list_sql)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .bind(session_id)
                .bind(limit as i64)
                .bind(offset as i64)
                .fetch_all(&self.pool)
                .await,
        )?;

        let items = rows
            .iter()
            .map(|row| {
                Ok(project_public_coding_session_event(
                    row_mapper::event_row_to_payload(map_sqlx_error(EventRow::from_row(row))?),
                ))
            })
            .collect::<Result<Vec<_>, CodingSessionError>>()?;

        Ok((items, total))
    }

    async fn replay_events(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        after_sequence: Option<usize>,
        high_watermark: Option<usize>,
        limit: usize,
    ) -> Result<CodingSessionReplayPage, CodingSessionError> {
        if !(1..=200).contains(&limit) {
            return Err(CodingSessionError::InvalidInput(
                "replay page size must be between 1 and 200".to_owned(),
            ));
        }
        let after_sequence = after_sequence
            .map(|sequence| event_sequence_to_i64(sequence, "after_sequence"))
            .transpose()?;
        let high_watermark = high_watermark
            .map(|sequence| event_sequence_to_i64(sequence, "high_watermark"))
            .transpose()?;
        let owner_scope = session_owner_scope(ctx)?;
        let projection = row_projection::event(self.is_postgres().await?, "");
        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        ensure_session_in_tenant_scope_in_transaction(&mut tx, ctx, session_id).await?;

        let replay_high_watermark = match high_watermark {
            Some(high_watermark) => Some(high_watermark),
            None => {
                let high_watermark_sql = numbered_placeholders(&format!(
                    "SELECT MAX({}) FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
                    columns::event::SEQUENCE_NO,
                    columns::event::TABLE,
                    columns::event::TENANT_ID,
                    columns::event::USER_ID,
                    columns::event::CODING_SESSION_ID,
                ));
                map_sqlx_error(
                    sqlx::query_scalar::<_, Option<i64>>(&high_watermark_sql)
                        .bind(owner_scope.tenant_id)
                        .bind(owner_scope.user_id)
                        .bind(session_id)
                        .fetch_one(&mut *tx)
                        .await,
                )?
            }
        };
        if let Some(after_sequence) = after_sequence {
            if replay_high_watermark
                .map(|high| after_sequence > high)
                .unwrap_or(after_sequence != 0)
            {
                return Err(CodingSessionError::InvalidInput(
                    "replay cursor is ahead of the durable stream".to_owned(),
                ));
            }
        }
        let Some(replay_high_watermark) = replay_high_watermark else {
            map_sqlx_error(tx.commit().await)?;
            return Ok(CodingSessionReplayPage {
                events: Vec::new(),
                high_watermark: None,
                has_more: false,
            });
        };

        let mut sql = format!(
            "SELECT {projection} FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED} \
             AND {} <= ?",
            columns::event::TABLE,
            columns::event::TENANT_ID,
            columns::event::USER_ID,
            columns::event::CODING_SESSION_ID,
            columns::event::SEQUENCE_NO,
        );
        if after_sequence.is_some() {
            sql.push_str(&format!(" AND {} > ?", columns::event::SEQUENCE_NO));
        }
        sql.push_str(&format!(
            " ORDER BY {} ASC LIMIT ?",
            columns::event::SEQUENCE_NO,
        ));
        let sql = numbered_placeholders(&sql);
        let mut query = sqlx::query(&sql)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .bind(session_id)
            .bind(replay_high_watermark);
        if let Some(after_sequence) = after_sequence {
            query = query.bind(after_sequence);
        }
        let fetch_limit = limit.checked_add(1).ok_or_else(|| {
            CodingSessionError::InvalidInput(
                "replay page size is outside the supported range".into(),
            )
        })?;
        let mut rows = map_sqlx_error(
            query
                .bind(event_sequence_to_i64(fetch_limit, "replay page size")?)
                .fetch_all(&mut *tx)
                .await,
        )?;
        let has_more = rows.len() > limit;
        if has_more {
            rows.pop();
        }
        let events = rows
            .iter()
            .map(|row| {
                Ok(project_public_coding_session_event(
                    row_mapper::event_row_to_payload(map_sqlx_error(EventRow::from_row(row))?),
                ))
            })
            .collect::<Result<Vec<_>, CodingSessionError>>()?;
        map_sqlx_error(tx.commit().await)?;

        Ok(CodingSessionReplayPage {
            events,
            high_watermark: Some(event_sequence_to_usize(
                replay_high_watermark,
                "event sequence",
            )?),
            has_more,
        })
    }

    async fn append_realtime_event(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        input: &AppendCodingSessionRealtimeEventInput,
    ) -> Result<CodingSessionEventPayload, CodingSessionError> {
        let kind = normalize_realtime_event_kind(&input.kind)?;
        let turn_id =
            normalize_optional_realtime_event_reference(input.turn_id.as_deref(), "turn_id")?;
        let runtime_id =
            normalize_optional_realtime_event_reference(input.runtime_id.as_deref(), "runtime_id")?;
        let owner_scope = session_owner_scope(ctx)?;
        let now = Self::now_iso();

        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        // This scoped update acquires the per-session write lock before the
        // sequence read, so concurrent writers cannot allocate the same value.
        Self::touch_session_transcript_on_executor(&mut tx, owner_scope, session_id, &now, false)
            .await?;

        if let Some(turn_id) = turn_id.as_deref() {
            Self::ensure_realtime_event_turn_in_scope_on_executor(
                &mut tx,
                owner_scope,
                session_id,
                turn_id,
                runtime_id.as_deref(),
            )
            .await?;
        }

        let event = Self::insert_coding_session_event_on_executor(
            &mut tx,
            CodingSessionEventStreamScope::new(owner_scope, session_id),
            turn_id,
            runtime_id,
            &kind,
            input.payload.clone(),
            &now,
        )
        .await?;

        map_sqlx_error(tx.commit().await)?;
        Ok(event)
    }

    async fn list_artifacts(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionArtifactPayload>, usize), CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;
        let projection = row_projection::artifact(self.is_postgres().await?, "");

        let where_sql = format!(
            " WHERE {} = ? AND {}",
            columns::artifact::CODING_SESSION_ID,
            IS_NOT_DELETED,
        );
        let count_sql = numbered_placeholders(&format!(
            "SELECT COUNT(*) AS total FROM {}{}",
            columns::artifact::TABLE,
            where_sql
        ));
        let total = map_sqlx_error(
            sqlx::query_scalar::<_, i64>(&count_sql)
                .bind(session_id)
                .fetch_one(&self.pool)
                .await,
        )? as usize;

        let list_sql = numbered_placeholders(&format!(
            "SELECT {projection} FROM {}{} ORDER BY {} ASC LIMIT ? OFFSET ?",
            columns::artifact::TABLE,
            where_sql,
            columns::artifact::CREATED_AT,
        ));
        let rows = map_sqlx_error(
            sqlx::query(&list_sql)
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
        let projection = row_projection::checkpoint(self.is_postgres().await?, "");

        let where_sql = format!(
            " WHERE {} = ? AND {}",
            columns::checkpoint::CODING_SESSION_ID,
            IS_NOT_DELETED,
        );
        let count_sql = numbered_placeholders(&format!(
            "SELECT COUNT(*) AS total FROM {}{}",
            columns::checkpoint::TABLE,
            where_sql
        ));
        let total = map_sqlx_error(
            sqlx::query_scalar::<_, i64>(&count_sql)
                .bind(session_id)
                .fetch_one(&self.pool)
                .await,
        )? as usize;

        let list_sql = numbered_placeholders(&format!(
            "SELECT {projection} FROM {}{} ORDER BY {} ASC LIMIT ? OFFSET ?",
            columns::checkpoint::TABLE,
            where_sql,
            columns::checkpoint::CREATED_AT,
        ));
        let rows = map_sqlx_error(
            sqlx::query(&list_sql)
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

    async fn resolve_durable_interaction(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        interaction_event_id: &str,
        interaction_kind: CodingSessionInteractionKind,
    ) -> Result<ResolvedCodingSessionInteraction, CodingSessionError> {
        let session_id =
            normalize_optional_realtime_event_reference(Some(session_id), "session_id")?
                .ok_or_else(|| {
                    CodingSessionError::InvalidInput("session_id is required".to_owned())
                })?;
        let owner_scope = session_owner_scope(ctx)?;
        let is_postgres = self.is_postgres().await?;
        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        ensure_session_in_tenant_scope_in_transaction(&mut tx, ctx, &session_id).await?;
        let resolved = Self::resolve_durable_interaction_on_executor(
            &mut tx,
            is_postgres,
            owner_scope,
            &session_id,
            interaction_event_id,
            interaction_kind,
            true,
        )
        .await?;
        map_sqlx_error(tx.commit().await)?;

        Ok(resolved.resolution)
    }

    async fn claim_durable_interaction(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        interaction_event_id: &str,
        interaction_kind: CodingSessionInteractionKind,
    ) -> Result<ClaimedCodingSessionInteraction, CodingSessionError> {
        let session_id =
            normalize_optional_realtime_event_reference(Some(session_id), "session_id")?
                .ok_or_else(|| {
                    CodingSessionError::InvalidInput("session_id is required".to_owned())
                })?;
        let owner_scope = session_owner_scope(ctx)?;
        let now = Self::now_iso();
        let claim_expires_at = interaction_claim_expires_at()?;
        let is_postgres = self.is_postgres().await?;
        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        Self::touch_session_transcript_on_executor(&mut tx, owner_scope, &session_id, &now, false)
            .await?;
        let resolved = Self::resolve_durable_interaction_on_executor(
            &mut tx,
            is_postgres,
            owner_scope,
            &session_id,
            interaction_event_id,
            interaction_kind,
            true,
        )
        .await?;
        if active_interaction_claim_id(&resolved.source_payload, &resolved.resolution.event_id)?
            .is_some()
        {
            return Err(CodingSessionError::Conflict(format!(
                "interaction event {} is already being processed",
                resolved.resolution.event_id
            )));
        }

        let claim_id = Uuid::new_v4().to_string();
        let mut source_payload = resolved.source_payload.clone();
        source_payload.insert(
            "claimId".to_owned(),
            serde_json::Value::String(claim_id.clone()),
        );
        source_payload.insert(
            "claimedAt".to_owned(),
            serde_json::Value::String(now.clone()),
        );
        source_payload.insert(
            "claimExpiresAt".to_owned(),
            serde_json::Value::String(claim_expires_at),
        );
        Self::update_durable_interaction_source_event_on_executor(
            &mut tx,
            owner_scope,
            &resolved,
            &source_payload,
            &now,
        )
        .await?;
        map_sqlx_error(tx.commit().await)?;

        Ok(ClaimedCodingSessionInteraction {
            interaction: resolved.resolution,
            claim_id,
        })
    }

    async fn release_durable_interaction_claim(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        interaction_event_id: &str,
        interaction_kind: CodingSessionInteractionKind,
        claim_id: &str,
    ) -> Result<(), CodingSessionError> {
        let session_id =
            normalize_optional_realtime_event_reference(Some(session_id), "session_id")?
                .ok_or_else(|| {
                    CodingSessionError::InvalidInput("session_id is required".to_owned())
                })?;
        let claim_id = normalize_optional_realtime_event_reference(Some(claim_id), "claim_id")?
            .ok_or_else(|| CodingSessionError::InvalidInput("claim_id is required".to_owned()))?;
        let owner_scope = session_owner_scope(ctx)?;
        let now = Self::now_iso();
        let is_postgres = self.is_postgres().await?;
        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        ensure_session_in_tenant_scope_in_transaction(&mut tx, ctx, &session_id).await?;
        let resolved = Self::resolve_durable_interaction_on_executor(
            &mut tx,
            is_postgres,
            owner_scope,
            &session_id,
            interaction_event_id,
            interaction_kind,
            false,
        )
        .await?;
        if resolved.source_payload.contains_key("settledAt")
            || resolved
                .source_payload
                .get("claimId")
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                != Some(claim_id.as_str())
        {
            map_sqlx_error(tx.commit().await)?;
            return Ok(());
        }

        let mut source_payload = resolved.source_payload.clone();
        source_payload.remove("claimId");
        source_payload.remove("claimedAt");
        source_payload.remove("claimExpiresAt");
        source_payload.insert(
            "releasedClaimId".to_owned(),
            serde_json::Value::String(claim_id),
        );
        source_payload.insert(
            "releasedAt".to_owned(),
            serde_json::Value::String(now.clone()),
        );

        match Self::update_durable_interaction_source_event_on_executor(
            &mut tx,
            owner_scope,
            &resolved,
            &source_payload,
            &now,
        )
        .await
        {
            Ok(()) => map_sqlx_error(tx.commit().await)?,
            Err(CodingSessionError::Conflict(_)) => {
                // A different claimant or finalizer won the version race. Its
                // state must be left intact, so this release becomes a no-op.
                map_sqlx_error(tx.rollback().await)?;
            }
            Err(error) => return Err(error),
        }

        Ok(())
    }

    async fn submit_approval_decision(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        interaction_event_id: &str,
        interaction_claim_id: &str,
        input: &SubmitApprovalDecisionInput,
    ) -> Result<PersistedCodingSessionMutation<ApprovalDecisionPayload>, CodingSessionError> {
        let decision = input.decision.clone();
        let reason = input.reason.clone();
        let owner_scope = session_owner_scope(ctx)?;
        let now = Self::now_iso();
        let is_postgres = self.is_postgres().await?;

        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        Self::touch_session_transcript_on_executor(&mut tx, owner_scope, session_id, &now, false)
            .await?;

        let resolved = Self::resolve_durable_interaction_on_executor(
            &mut tx,
            is_postgres,
            owner_scope,
            session_id,
            interaction_event_id,
            CodingSessionInteractionKind::Approval,
            true,
        )
        .await?;
        let claim_id = require_owned_interaction_claim(
            &resolved.source_payload,
            &resolved.resolution.event_id,
            interaction_claim_id,
        )?;

        let checkpoint_projection = row_projection::checkpoint(is_postgres, "");
        let checkpoint_sql = numbered_placeholders(&format!(
                "SELECT {checkpoint_projection} FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
                columns::checkpoint::TABLE,
                columns::checkpoint::ID,
                columns::checkpoint::CODING_SESSION_ID,
                columns::checkpoint::TENANT_ID,
                columns::checkpoint::USER_ID,
            ));
        let row = map_sqlx_error(
            sqlx::query(&checkpoint_sql)
                .bind(&resolved.resolution.interaction_id)
                .bind(session_id)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .fetch_optional(&mut *tx)
                .await,
        )?
        .ok_or_else(|| {
            RepositoryError::NotFound(format!(
                "approval checkpoint for interaction {} not found",
                resolved.resolution.event_id
            ))
        })?;
        let checkpoint = map_sqlx_error(CheckpointRow::from_row(&row))?;
        if checkpoint.checkpoint_kind != "approval" {
            return Err(CodingSessionError::Conflict(format!(
                "interaction event {} resolved a non-approval checkpoint",
                resolved.resolution.event_id
            )));
        }
        if checkpoint.runtime_id.as_deref() != Some(resolved.resolution.runtime_id.as_str()) {
            return Err(CodingSessionError::Conflict(format!(
                "approval checkpoint for interaction {} has a different runtime",
                resolved.resolution.event_id
            )));
        }
        let mut state: BTreeMap<String, serde_json::Value> =
            serde_json::from_str(&checkpoint.state_json).map_err(|error| {
                CodingSessionError::Conflict(format!(
                    "approval checkpoint for interaction {} has malformed state: {error}",
                    resolved.resolution.event_id
                ))
            })?;
        let mut approvals: Vec<serde_json::Value> = match state.get("approvals") {
            Some(approvals) => serde_json::from_value(approvals.clone()).map_err(|error| {
                CodingSessionError::Conflict(format!(
                    "approval checkpoint for interaction {} has malformed approvals: {error}",
                    resolved.resolution.event_id
                ))
            })?,
            None => Vec::new(),
        };
        if approvals.iter().any(|approval| {
            approval
                .get("interactionId")
                .and_then(serde_json::Value::as_str)
                == Some(resolved.resolution.interaction_id.as_str())
        }) {
            return Err(CodingSessionError::Conflict(format!(
                "approval interaction {} is already settled",
                resolved.resolution.event_id
            )));
        }
        approvals.push(serde_json::json!({
            "approvalId": resolved.resolution.event_id.clone(),
            "interactionId": resolved.resolution.interaction_id.clone(),
            "decision": decision.clone(),
            "reason": reason.clone(),
            "decidedAt": now.clone(),
        }));
        state.insert(
            "approvals".to_owned(),
            serde_json::to_value(&approvals)
                .map_err(|error| RepositoryError::Update(error.to_string()))?,
        );
        let state_json = serde_json::to_string(&state)
            .map_err(|error| RepositoryError::Update(error.to_string()))?;
        let checkpoint_update_sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = ?, {} = ?, {} = {} + 1 \
             WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::checkpoint::TABLE,
            columns::checkpoint::STATE_JSON,
            columns::checkpoint::UPDATED_AT,
            columns::checkpoint::VERSION,
            columns::checkpoint::VERSION,
            columns::checkpoint::VERSION,
            columns::checkpoint::ID,
            columns::checkpoint::CODING_SESSION_ID,
            columns::checkpoint::TENANT_ID,
            columns::checkpoint::USER_ID,
        ));
        let checkpoint_update = sqlx::query(&checkpoint_update_sql)
            .bind(&state_json)
            .bind(&now)
            .bind(checkpoint.version)
            .bind(&resolved.resolution.interaction_id)
            .bind(session_id)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .execute(&mut *tx)
            .await
            .map_err(|error: sqlx::Error| RepositoryError::Update(error.to_string()))?;
        if checkpoint_update.rows_affected() != 1 {
            return Err(CodingSessionError::Conflict(format!(
                "approval interaction {} was already settled or changed",
                resolved.resolution.event_id
            )));
        }

        let mut source_payload = resolved.source_payload.clone();
        source_payload.remove("claimId");
        source_payload.remove("claimedAt");
        source_payload.remove("claimExpiresAt");
        source_payload.insert(
            "decision".to_owned(),
            serde_json::Value::String(decision.clone()),
        );
        if let Some(reason) = &reason {
            source_payload.insert(
                "decisionReason".to_owned(),
                serde_json::Value::String(reason.clone()),
            );
        }
        source_payload.insert(
            "decidedAt".to_owned(),
            serde_json::Value::String(now.clone()),
        );
        source_payload.insert(
            "settledAt".to_owned(),
            serde_json::Value::String(now.clone()),
        );
        source_payload.insert(
            "status".to_owned(),
            serde_json::Value::String(decision.clone()),
        );
        source_payload.insert(
            "settledClaimId".to_owned(),
            serde_json::Value::String(claim_id),
        );
        Self::update_durable_interaction_source_event_on_executor(
            &mut tx,
            owner_scope,
            &resolved,
            &source_payload,
            &now,
        )
        .await?;

        let payload = ApprovalDecisionPayload {
            approval_id: resolved.resolution.event_id.clone(),
            checkpoint_id: resolved.resolution.event_id.clone(),
            coding_session_id: session_id.to_string(),
            runtime_id: Some(resolved.resolution.runtime_id.clone()),
            turn_id: Some(resolved.resolution.turn_id.clone()),
            operation_id: None,
            decision: decision.clone(),
            reason: reason.clone(),
            decided_at: now.clone(),
            runtime_status: decision.clone(),
            operation_status: decision,
        };
        let mut event_payload = BTreeMap::new();
        event_payload.insert(
            "interactionId".to_owned(),
            serde_json::Value::String(resolved.resolution.interaction_id.clone()),
        );
        event_payload.insert(
            "interactionKind".to_owned(),
            serde_json::Value::String(
                resolved
                    .resolution
                    .interaction_kind
                    .payload_kind()
                    .to_owned(),
            ),
        );
        event_payload.insert(
            "interactionEventId".to_owned(),
            serde_json::Value::String(resolved.resolution.event_id.clone()),
        );
        event_payload.insert(
            "approvalId".to_owned(),
            serde_json::Value::String(payload.approval_id.clone()),
        );
        event_payload.insert(
            "checkpointId".to_owned(),
            serde_json::Value::String(payload.checkpoint_id.clone()),
        );
        event_payload.insert(
            "status".to_owned(),
            serde_json::Value::String(payload.operation_status.clone()),
        );
        event_payload.insert(
            "runtimeStatus".to_owned(),
            serde_json::Value::String(payload.runtime_status.clone()),
        );
        let event = Self::insert_coding_session_event_on_executor(
            &mut tx,
            CodingSessionEventStreamScope::new(owner_scope, session_id),
            Some(resolved.resolution.turn_id.clone()),
            Some(resolved.resolution.runtime_id.clone()),
            "operation.updated",
            event_payload,
            &now,
        )
        .await?;

        map_sqlx_error(tx.commit().await)?;

        Ok(PersistedCodingSessionMutation { payload, event })
    }

    async fn submit_user_question_answer(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        question_id: &str,
        interaction_claim_id: &str,
        input: &SubmitUserQuestionAnswerInput,
    ) -> Result<PersistedCodingSessionMutation<UserQuestionAnswerPayload>, CodingSessionError> {
        let answer = input.answer.clone();
        let option_id = input.option_id.clone();
        let option_label = input.option_label.clone();
        let rejected = input.rejected;
        let owner_scope = session_owner_scope(ctx)?;
        let now = Self::now_iso();
        let is_postgres = self.is_postgres().await?;

        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        Self::touch_session_transcript_on_executor(&mut tx, owner_scope, session_id, &now, false)
            .await?;

        let resolved = Self::resolve_durable_interaction_on_executor(
            &mut tx,
            is_postgres,
            owner_scope,
            session_id,
            question_id,
            CodingSessionInteractionKind::UserQuestion,
            true,
        )
        .await?;
        let claim_id = require_owned_interaction_claim(
            &resolved.source_payload,
            &resolved.resolution.event_id,
            interaction_claim_id,
        )?;

        let status = if rejected { "rejected" } else { "answered" }.to_owned();
        let mut source_payload = resolved.source_payload.clone();
        source_payload.remove("claimId");
        source_payload.remove("claimedAt");
        source_payload.remove("claimExpiresAt");
        if let Some(answer) = &answer {
            source_payload.insert(
                "answer".to_owned(),
                serde_json::Value::String(answer.clone()),
            );
        }
        if let Some(option_id) = &option_id {
            source_payload.insert(
                "optionId".to_owned(),
                serde_json::Value::String(option_id.clone()),
            );
        }
        if let Some(option_label) = &option_label {
            source_payload.insert(
                "optionLabel".to_owned(),
                serde_json::Value::String(option_label.clone()),
            );
        }
        source_payload.insert("rejected".to_owned(), serde_json::Value::Bool(rejected));
        source_payload.insert(
            "answeredAt".to_owned(),
            serde_json::Value::String(now.clone()),
        );
        source_payload.insert(
            "settledAt".to_owned(),
            serde_json::Value::String(now.clone()),
        );
        source_payload.insert(
            "status".to_owned(),
            serde_json::Value::String(status.clone()),
        );
        source_payload.insert(
            "settledClaimId".to_owned(),
            serde_json::Value::String(claim_id),
        );
        Self::update_durable_interaction_source_event_on_executor(
            &mut tx,
            owner_scope,
            &resolved,
            &source_payload,
            &now,
        )
        .await?;

        let payload = UserQuestionAnswerPayload {
            question_id: resolved.resolution.event_id.clone(),
            coding_session_id: session_id.to_string(),
            answer: answer.clone(),
            answered_at: now.clone(),
            option_id: option_id.clone(),
            option_label: option_label.clone(),
            rejected,
            runtime_id: Some(resolved.resolution.runtime_id.clone()),
            runtime_status: status.clone(),
            turn_id: Some(resolved.resolution.turn_id.clone()),
        };
        let mut event_payload = BTreeMap::new();
        event_payload.insert(
            "interactionId".to_owned(),
            serde_json::Value::String(resolved.resolution.interaction_id.clone()),
        );
        event_payload.insert(
            "interactionKind".to_owned(),
            serde_json::Value::String(
                resolved
                    .resolution
                    .interaction_kind
                    .payload_kind()
                    .to_owned(),
            ),
        );
        event_payload.insert(
            "interactionEventId".to_owned(),
            serde_json::Value::String(resolved.resolution.event_id.clone()),
        );
        event_payload.insert(
            "questionId".to_owned(),
            serde_json::Value::String(payload.question_id.clone()),
        );
        event_payload.insert("status".to_owned(), serde_json::Value::String(status));
        event_payload.insert(
            "rejected".to_owned(),
            serde_json::Value::Bool(payload.rejected),
        );
        event_payload.insert(
            "runtimeStatus".to_owned(),
            serde_json::Value::String(payload.runtime_status.clone()),
        );
        let persisted_event = Self::insert_coding_session_event_on_executor(
            &mut tx,
            CodingSessionEventStreamScope::new(owner_scope, session_id),
            Some(resolved.resolution.turn_id.clone()),
            Some(resolved.resolution.runtime_id.clone()),
            "operation.updated",
            event_payload,
            &now,
        )
        .await?;

        map_sqlx_error(tx.commit().await)?;

        Ok(PersistedCodingSessionMutation {
            payload,
            event: persisted_event,
        })
    }

    async fn get_operation(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        operation_id: &str,
    ) -> Result<OperationPayload, CodingSessionError> {
        ensure_session_in_tenant_scope(&self.pool, ctx, session_id).await?;
        let projection = row_projection::operation(self.is_postgres().await?, "");

        let sql = numbered_placeholders(&format!(
            "SELECT {projection} FROM {} WHERE {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::operation::TABLE,
            columns::operation::ID,
            columns::operation::CODING_SESSION_ID,
        ));
        let row = map_sqlx_error(
            sqlx::query(&sql)
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
        let sql = numbered_placeholders(&format!(
                "SELECT {} FROM {} o  WHERE o.id = ? AND o.coding_session_id = ? AND o.tenant_id = ?  AND o.user_id = ? AND {}",
                durable_operation_select_columns("o"),
                columns::operation::TABLE,
                sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("o"),
            ));
        let row = map_sqlx_error(
            sqlx::query(&sql)
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
            let lock_sql = numbered_placeholders(
                "SELECT id FROM ai_coding_session WHERE id = ? AND tenant_id = ? AND user_id = ? FOR UPDATE",
            );
            map_sqlx_error(
                sqlx::query(&lock_sql)
                    .bind(&session_id)
                    .bind(scope.tenant_id)
                    .bind(scope.user_id)
                    .fetch_optional(&mut *tx)
                    .await,
            )?;
        }

        let existing_by_key_sql = numbered_placeholders(&format!(
                "SELECT {} FROM {} o WHERE o.tenant_id = ? AND o.user_id = ?  AND o.coding_session_id = ? AND o.idempotency_key = ? AND {}",
                durable_operation_select_columns("o"),
                columns::operation::TABLE,
                sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("o"),
            ));
        let existing_by_key = map_sqlx_error(
            sqlx::query(&existing_by_key_sql)
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

        let existing_by_id_sql = numbered_placeholders(&format!(
            "SELECT {} FROM {} o WHERE o.id = ? AND {}",
            durable_operation_select_columns("o"),
            columns::operation::TABLE,
            sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("o"),
        ));
        let existing_by_id = map_sqlx_error(
            sqlx::query(&existing_by_id_sql)
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
            let update_sql = numbered_placeholders(
                "UPDATE ai_coding_session_operation SET status = 'queued',  request_payload_json = ?, request_fingerprint = ?, idempotency_key = ?,  available_at = ?, attempt = 0, max_attempt = ?, lease_owner = NULL,  lease_expires_at = NULL, runner_id = NULL, started_at = NULL,  completed_at = NULL, problem_json = NULL, updated_at = ?, version = version + 1  WHERE id = ? AND tenant_id = ? AND user_id = ? AND is_deleted IS NOT TRUE",
            );
            map_sqlx_error(
                sqlx::query(&update_sql)
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
            let insert_sql = numbered_placeholders(&format!(
                "INSERT INTO ai_coding_session_operation  (id, created_at, updated_at, version, is_deleted, tenant_id, organization_id, user_id,  coding_session_id, turn_id, status, stream_url, stream_kind, artifact_refs_json,  request_payload_json, request_fingerprint, idempotency_key, available_at, attempt,  max_attempt, lease_owner, lease_expires_at, fencing_token, runner_id, started_at,  completed_at, problem_json)  VALUES (?, {created_expr}, {created_expr}, 0, FALSE, ?, 0, ?, ?, ?, 'queued', '', 'none', '[]',  ?, ?, ?, ?, 0, ?, NULL, NULL, 0, NULL, NULL, NULL, NULL)  ON CONFLICT DO NOTHING",
            ));
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

        let operation_select_sql = numbered_placeholders(&format!(
                "SELECT {} FROM {} o WHERE o.tenant_id = ? AND o.user_id = ?  AND o.coding_session_id = ? AND o.idempotency_key = ? AND {}",
                durable_operation_select_columns("o"),
                columns::operation::TABLE,
                sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("o"),
            ));
        let operation_row = map_sqlx_error(
            sqlx::query(&operation_select_sql)
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
        let turn_update_sql = numbered_placeholders(
            "UPDATE ai_coding_session_turn SET status = 'queued', updated_at = ?, version = version + 1  WHERE id = ? AND coding_session_id = ? AND tenant_id = ? AND user_id = ? AND is_deleted IS NOT TRUE",
        );
        map_sqlx_error(
            sqlx::query(&turn_update_sql)
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
        let sql = numbered_placeholders(&format!(
            "WITH candidate AS ( SELECT c.id FROM ai_coding_session_operation c  WHERE c.is_deleted IS NOT TRUE AND c.attempt < c.max_attempt AND ( (c.status = 'queued' AND {available_c} AND NOT EXISTS ( SELECT 1 FROM ai_coding_session_operation active  WHERE active.tenant_id = c.tenant_id AND active.user_id = c.user_id  AND active.status = 'running' AND active.is_deleted IS NOT TRUE )) OR  (c.status = 'running' AND c.lease_expires_at IS NOT NULL AND {lease_c}) )  ORDER BY CASE WHEN c.status = 'running' THEN 0 ELSE 1 END,  c.available_at, c.created_at, c.id  LIMIT 1{lock_suffix} )  UPDATE ai_coding_session_operation SET  status = 'running', attempt = attempt + 1, lease_owner = ?,  lease_expires_at = ?, fencing_token = fencing_token + 1, runner_id = ?,  started_at = COALESCE(started_at, ?), completed_at = NULL, problem_json = NULL,  updated_at = {updated_value}, version = version + 1  WHERE id = (SELECT id FROM candidate) AND is_deleted IS NOT TRUE  AND attempt < max_attempt AND ( (status = 'queued' AND {available_outer} AND NOT EXISTS ( SELECT 1 FROM ai_coding_session_operation active  WHERE active.tenant_id = ai_coding_session_operation.tenant_id  AND active.user_id = ai_coding_session_operation.user_id  AND active.status = 'running' AND active.is_deleted IS NOT TRUE )) OR  (status = 'running' AND lease_expires_at IS NOT NULL AND {lease_outer}) )  RETURNING {}",
            durable_operation_return_columns(),
        ));
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
        let turn_update_sql = numbered_placeholders(&format!(
                "UPDATE ai_coding_session_turn SET status = 'running', updated_at = {updated_value},  version = version + 1 WHERE id = ? AND coding_session_id = ? AND tenant_id = ?  AND user_id = ? AND is_deleted IS NOT TRUE"
            ));
        let turn_result = map_sqlx_error(
            sqlx::query(&turn_update_sql)
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
        let sql = numbered_placeholders(&format!(
            "UPDATE ai_coding_session_operation SET lease_expires_at = ?,  updated_at = {updated_value}, version = version + 1  WHERE id = ? AND status = 'running' AND lease_owner = ? AND fencing_token = ?  AND lease_expires_at IS NOT NULL AND {expiry_predicate}  RETURNING {}",
            durable_operation_return_columns(),
        ));
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
        let operation_sql = numbered_placeholders(&format!(
            "UPDATE ai_coding_session_operation SET status = 'succeeded', completed_at = ?,  lease_owner = NULL, lease_expires_at = NULL, updated_at = {updated_value},  version = version + 1  WHERE id = ? AND status = 'running' AND lease_owner = ? AND fencing_token = ?  AND lease_expires_at IS NOT NULL AND {expiry_predicate}  RETURNING {}",
            durable_operation_return_columns(),
        ));
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
        let owner_scope = SessionOwnerScope {
            tenant_id: operation.tenant_id,
            user_id: operation.user_id,
        };
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
            let session_update_sql = numbered_placeholders(&format!(
                    "UPDATE ai_coding_session SET native_session_id = ?, transcript_updated_at = {updated_value}, updated_at = {updated_value},  version = version + 1 WHERE id = ? AND tenant_id = ? AND user_id = ?  AND is_deleted IS NOT TRUE AND (native_session_id IS NULL OR native_session_id = ?)"
                ));
            let result = map_sqlx_error(
                sqlx::query(&session_update_sql)
                    .bind(native_session_id)
                    .bind(&completed_at)
                    .bind(&completed_at)
                    .bind(&operation.coding_session_id)
                    .bind(operation.tenant_id)
                    .bind(operation.user_id)
                    .bind(native_session_id)
                    .execute(&mut *tx)
                    .await,
            )?;
            if result.rows_affected() != 1 {
                return Err(CodingSessionError::Conflict(
                    "claimed operation owner no longer owns the session or attempted to replace its provider-native session binding".into(),
                ));
            }
        } else {
            Self::touch_session_transcript_on_executor(
                &mut tx,
                owner_scope,
                &operation.coding_session_id,
                &completed_at,
                false,
            )
            .await?;
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
        let turn_update_sql = numbered_placeholders(&format!(
                "UPDATE ai_coding_session_turn SET status = 'completed', started_at = ?,  completed_at = ?, updated_at = {updated_value}, version = version + 1  WHERE id = ? AND coding_session_id = ? AND tenant_id = ? AND user_id = ?  AND is_deleted IS NOT TRUE"
            ));
        let turn_result = map_sqlx_error(
            sqlx::query(&turn_update_sql)
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

        for event in &input.finalized.events {
            if event.coding_session_id != operation.coding_session_id
                || event.turn_id.as_deref() != Some(operation.turn_id.as_str())
            {
                return Err(CodingSessionError::Conflict(
                    "finalized event does not belong to the claimed operation".into(),
                ));
            }
            let kind = normalize_realtime_event_kind(&event.kind)?;
            let runtime_id = normalize_optional_realtime_event_reference(
                event.runtime_id.as_deref(),
                "runtime_id",
            )?;
            Self::ensure_realtime_event_turn_in_scope_on_executor(
                &mut tx,
                owner_scope,
                &operation.coding_session_id,
                &operation.turn_id,
                runtime_id.as_deref(),
            )
            .await?;
            let _ = Self::insert_coding_session_event_on_executor(
                &mut tx,
                CodingSessionEventStreamScope::new(owner_scope, &operation.coding_session_id),
                Some(operation.turn_id.clone()),
                runtime_id,
                &kind,
                event.payload.clone(),
                &completed_at,
            )
            .await?;
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
        let operation_sql = numbered_placeholders(&if retry_at.is_some() {
            format!(
                "UPDATE ai_coding_session_operation SET  status = CASE WHEN attempt < max_attempt THEN 'queued' ELSE 'failed' END,  available_at = CASE WHEN attempt < max_attempt THEN ? ELSE available_at END,  completed_at = CASE WHEN attempt < max_attempt THEN NULL ELSE ? END,  problem_json = ?, lease_owner = NULL, lease_expires_at = NULL,  updated_at = {updated_value}, version = version + 1  WHERE id = ? AND status = 'running' AND lease_owner = ? AND fencing_token = ?  AND lease_expires_at IS NOT NULL AND {expiry_predicate}  RETURNING {}",
                durable_operation_return_columns(),
            )
        } else {
            format!(
                "UPDATE ai_coding_session_operation SET status = 'failed', completed_at = ?,  problem_json = ?, lease_owner = NULL, lease_expires_at = NULL,  updated_at = {updated_value}, version = version + 1  WHERE id = ? AND status = 'running' AND lease_owner = ? AND fencing_token = ?  AND lease_expires_at IS NOT NULL AND {expiry_predicate}  RETURNING {}",
                durable_operation_return_columns(),
            )
        });
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
        let owner_scope = SessionOwnerScope {
            tenant_id: operation.tenant_id,
            user_id: operation.user_id,
        };
        let terminal = operation.status == "failed";
        let turn_status = if terminal { "failed" } else { "queued" };
        let turn_completed_at = if terminal {
            Some(failed_at.clone())
        } else {
            None
        };
        let turn_update_sql = numbered_placeholders(&format!(
                "UPDATE ai_coding_session_turn SET status = ?, started_at = ?, completed_at = ?,  updated_at = {updated_value}, version = version + 1  WHERE id = ? AND coding_session_id = ? AND tenant_id = ? AND user_id = ?  AND is_deleted IS NOT TRUE"
            ));
        let turn_result = map_sqlx_error(
            sqlx::query(&turn_update_sql)
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
            Self::touch_session_transcript_on_executor(
                &mut tx,
                owner_scope,
                &operation.coding_session_id,
                &failed_at,
                false,
            )
            .await?;
            let runtime_sql = numbered_placeholders(
                "SELECT runtime_id FROM ai_coding_session_turn  WHERE id = ? AND coding_session_id = ? AND tenant_id = ? AND user_id = ?",
            );
            let runtime_id = map_sqlx_error(
                sqlx::query_scalar::<_, Option<String>>(&runtime_sql)
                    .bind(&operation.turn_id)
                    .bind(&operation.coding_session_id)
                    .bind(operation.tenant_id)
                    .bind(operation.user_id)
                    .fetch_optional(&mut *tx)
                    .await,
            )?
            .flatten();
            let mut payload = BTreeMap::new();
            payload.insert(
                "operationId".to_owned(),
                serde_json::Value::String(operation.id.clone()),
            );
            payload.insert(
                "runtimeStatus".to_owned(),
                serde_json::Value::String("failed".to_owned()),
            );
            payload.insert(
                "status".to_owned(),
                serde_json::Value::String("failed".to_owned()),
            );
            payload.insert("problem".to_owned(), input.problem.clone());
            let _ = Self::insert_coding_session_event_on_executor(
                &mut tx,
                CodingSessionEventStreamScope::new(owner_scope, &operation.coding_session_id),
                Some(operation.turn_id.clone()),
                runtime_id,
                "turn.failed",
                payload,
                &failed_at,
            )
            .await?;
        }

        map_sqlx_error(tx.commit().await)?;
        Ok(operation)
    }

    async fn finalize_turn_execution(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        finalized: &FinalizedProjectionTurnExecution,
    ) -> Result<PersistedProjectionTurnExecution, CodingSessionError> {
        let turn = finalized.turn.clone();
        let turn_id = turn.id.clone();
        let now = Self::now_iso();
        let owner_scope = session_owner_scope(ctx)?;

        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        ensure_session_in_tenant_scope_in_transaction(&mut tx, ctx, session_id).await?;
        let native_session_select_sql = numbered_placeholders(&format!(
            "SELECT {} FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::session::NATIVE_SESSION_ID,
            columns::session::TABLE,
            columns::session::ID,
            columns::session::TENANT_ID,
            columns::session::USER_ID,
        ));
        let existing_native_session_id = map_sqlx_error(
            sqlx::query_scalar::<sqlx::Any, Option<String>>(&native_session_select_sql)
                .bind(session_id)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .fetch_optional(&mut *tx)
                .await,
        )?
        .flatten();

        let started_at = turn.started_at.clone().unwrap_or_else(|| now.clone());
        let completed_at = turn.completed_at.clone().unwrap_or_else(|| now.clone());

        let native_session_id = finalized
            .native_session_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty());
        let persisted_native_session_id = native_session_id
            .map(str::to_owned)
            .or(existing_native_session_id);
        if let Some(native_session_id) = native_session_id {
            let session_update_sql = numbered_placeholders(&format!(
                "UPDATE {} SET {} = ?, {} = ?, {} = ?, {} = {} + 1 \
                 WHERE {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED} AND ({} IS NULL OR {} = ?)",
                columns::session::TABLE,
                columns::session::NATIVE_SESSION_ID,
                columns::session::TRANSCRIPT_UPDATED_AT,
                columns::session::UPDATED_AT,
                columns::session::VERSION,
                columns::session::VERSION,
                columns::session::ID,
                columns::session::TENANT_ID,
                columns::session::USER_ID,
                columns::session::NATIVE_SESSION_ID,
                columns::session::NATIVE_SESSION_ID,
            ));
            let result = sqlx::query(&session_update_sql)
                .bind(native_session_id)
                .bind(&now)
                .bind(&now)
                .bind(session_id)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .bind(native_session_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| RepositoryError::Update(e.to_string()))?;
            if result.rows_affected() != 1 {
                return Err(CodingSessionError::Conflict(
                    "provider-native session binding is immutable once established".into(),
                ));
            }
        } else {
            let session_update_sql = numbered_placeholders(&format!(
                "UPDATE {} SET {} = ?, {} = ?, {} = {} + 1 \
                 WHERE {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
                columns::session::TABLE,
                columns::session::TRANSCRIPT_UPDATED_AT,
                columns::session::UPDATED_AT,
                columns::session::VERSION,
                columns::session::VERSION,
                columns::session::ID,
                columns::session::TENANT_ID,
                columns::session::USER_ID,
            ));
            let result = sqlx::query(&session_update_sql)
                .bind(&now)
                .bind(&now)
                .bind(session_id)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .execute(&mut *tx)
                .await
                .map_err(|e| RepositoryError::Update(e.to_string()))?;
            if result.rows_affected() != 1 {
                return Err(
                    RepositoryError::NotFound(format!("session {session_id} not found")).into(),
                );
            }
        }

        let turn_update_sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = ?, {} = ?, {} = ?, {} = ?, {} = {} + 1 \
             WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::turn::TABLE,
            columns::turn::STATUS,
            columns::turn::STARTED_AT,
            columns::turn::COMPLETED_AT,
            columns::turn::UPDATED_AT,
            columns::turn::VERSION,
            columns::turn::VERSION,
            columns::turn::ID,
            columns::turn::CODING_SESSION_ID,
            columns::turn::TENANT_ID,
            columns::turn::USER_ID,
        ));
        let turn_result = sqlx::query(&turn_update_sql)
            .bind(&turn.status)
            .bind(&started_at)
            .bind(&completed_at)
            .bind(&now)
            .bind(&turn_id)
            .bind(session_id)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| RepositoryError::Update(e.to_string()))?;
        if turn_result.rows_affected() != 1 {
            return Err(CodingSessionError::Conflict(
                "completed turn no longer exists in the current session scope".into(),
            ));
        }

        let operation_update_sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = 'succeeded', {} = ?, {} = {} + 1 \
             WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
            columns::operation::TABLE,
            columns::operation::STATUS,
            columns::operation::UPDATED_AT,
            columns::operation::VERSION,
            columns::operation::VERSION,
            columns::operation::CODING_SESSION_ID,
            columns::operation::TURN_ID,
            columns::operation::TENANT_ID,
            columns::operation::USER_ID,
        ));
        let operation_result = sqlx::query(&operation_update_sql)
            .bind(&now)
            .bind(session_id)
            .bind(&turn_id)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| RepositoryError::Update(e.to_string()))?;
        if operation_result.rows_affected() != 1 {
            return Err(RepositoryError::Update(format!(
                "operation for turn {turn_id} was not found"
            ))
            .into());
        }

        let mut persisted_events = Vec::with_capacity(finalized.events.len());
        for event in &finalized.events {
            if event.coding_session_id != session_id
                || event.turn_id.as_deref() != Some(turn_id.as_str())
            {
                return Err(CodingSessionError::Conflict(
                    "finalized event does not belong to the completed turn".into(),
                ));
            }
            let kind = normalize_realtime_event_kind(&event.kind)?;
            let runtime_id = normalize_optional_realtime_event_reference(
                event.runtime_id.as_deref(),
                "runtime_id",
            )?;
            Self::ensure_realtime_event_turn_in_scope_on_executor(
                &mut tx,
                owner_scope,
                session_id,
                &turn_id,
                runtime_id.as_deref(),
            )
            .await?;
            // Event ids, sequence numbers, and timestamps from the provider
            // projection are intentionally discarded. They are durable-store
            // concerns and must not collide with streamed events.
            persisted_events.push(
                Self::insert_coding_session_event_on_executor(
                    &mut tx,
                    CodingSessionEventStreamScope::new(owner_scope, session_id),
                    Some(turn_id.clone()),
                    runtime_id,
                    &kind,
                    event.payload.clone(),
                    &now,
                )
                .await?,
            );
        }

        map_sqlx_error(tx.commit().await)?;

        Ok(PersistedProjectionTurnExecution {
            turn: CodingSessionTurnPayload {
                started_at: Some(started_at),
                completed_at: Some(completed_at),
                ..turn
            },
            events: persisted_events,
            native_session_id: persisted_native_session_id,
        })
    }

    async fn mark_turn_failed(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        turn_id: &str,
    ) -> Result<Option<CodingSessionEventPayload>, CodingSessionError> {
        let now = Self::now_iso();
        let owner_scope = session_owner_scope(ctx)?;

        let mut tx = map_sqlx_error(self.pool.begin().await)?;
        ensure_session_in_tenant_scope_in_transaction(&mut tx, ctx, session_id).await?;
        Self::touch_session_transcript_on_executor(&mut tx, owner_scope, session_id, &now, false)
            .await?;
        let runtime_id = Self::load_realtime_event_turn_runtime_id_on_executor(
            &mut tx,
            owner_scope,
            session_id,
            turn_id,
        )
        .await?;

        let operation_select_sql = numbered_placeholders(&format!(
                "SELECT {}, {} FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED}",
                columns::operation::ID,
                columns::operation::STATUS,
                columns::operation::TABLE,
                columns::operation::CODING_SESSION_ID,
                columns::operation::TURN_ID,
                columns::operation::TENANT_ID,
                columns::operation::USER_ID,
            ));
        let operation_row = map_sqlx_error(
            sqlx::query(&operation_select_sql)
                .bind(session_id)
                .bind(turn_id)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .fetch_optional(&mut *tx)
                .await,
        )?
        .ok_or_else(|| {
            RepositoryError::NotFound(format!("operation for turn {turn_id} was not found"))
        })?;
        let operation_id: String = map_sqlx_error(operation_row.try_get(columns::operation::ID))?;
        let operation_status: String =
            map_sqlx_error(operation_row.try_get(columns::operation::STATUS))?;
        if operation_status == "succeeded" {
            return Err(CodingSessionError::Conflict(format!(
                "succeeded operation {operation_id} cannot transition to failed"
            )));
        }

        let persisted_event_sql = numbered_placeholders(&format!(
                "SELECT 1 FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = 'turn.failed' AND {IS_NOT_DELETED} LIMIT 1",
                columns::event::TABLE,
                columns::event::CODING_SESSION_ID,
                columns::event::TURN_ID,
                columns::event::TENANT_ID,
                columns::event::USER_ID,
                columns::event::EVENT_KIND,
            ));
        let already_persisted = map_sqlx_error(
            sqlx::query_scalar::<sqlx::Any, i64>(&persisted_event_sql)
                .bind(session_id)
                .bind(turn_id)
                .bind(owner_scope.tenant_id)
                .bind(owner_scope.user_id)
                .fetch_optional(&mut *tx)
                .await,
        )?
        .is_some();
        if already_persisted {
            map_sqlx_error(tx.commit().await)?;
            return Ok(None);
        }

        let turn_update_sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = 'failed', {} = ?, {} = ?, {} = {} + 1 \
             WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED} AND {} <> 'succeeded'",
            columns::turn::TABLE,
            columns::turn::STATUS,
            columns::turn::COMPLETED_AT,
            columns::turn::UPDATED_AT,
            columns::turn::VERSION,
            columns::turn::VERSION,
            columns::turn::ID,
            columns::turn::CODING_SESSION_ID,
            columns::turn::TENANT_ID,
            columns::turn::USER_ID,
            columns::turn::STATUS,
        ));
        let turn_result = sqlx::query(&turn_update_sql)
            .bind(&now)
            .bind(&now)
            .bind(turn_id)
            .bind(session_id)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| RepositoryError::Update(e.to_string()))?;
        if turn_result.rows_affected() != 1 {
            return Err(CodingSessionError::Conflict(format!(
                "turn {turn_id} cannot transition to failed"
            )));
        }

        let operation_update_sql = numbered_placeholders(&format!(
            "UPDATE {} SET {} = 'failed', {} = ?, {} = NULL, {} = NULL, {} = ?, {} = {} + 1 \
             WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {IS_NOT_DELETED} AND {} <> 'succeeded'",
            columns::operation::TABLE,
            columns::operation::STATUS,
            columns::operation::COMPLETED_AT,
            columns::operation::LEASE_OWNER,
            columns::operation::LEASE_EXPIRES_AT,
            columns::operation::UPDATED_AT,
            columns::operation::VERSION,
            columns::operation::VERSION,
            columns::operation::CODING_SESSION_ID,
            columns::operation::TURN_ID,
            columns::operation::TENANT_ID,
            columns::operation::USER_ID,
            columns::operation::STATUS,
        ));
        let operation_result = sqlx::query(&operation_update_sql)
            .bind(&now)
            .bind(&now)
            .bind(session_id)
            .bind(turn_id)
            .bind(owner_scope.tenant_id)
            .bind(owner_scope.user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| RepositoryError::Update(e.to_string()))?;
        if operation_result.rows_affected() != 1 {
            return Err(RepositoryError::Update(format!(
                "operation for turn {turn_id} was not found"
            ))
            .into());
        }

        let mut payload = BTreeMap::new();
        payload.insert(
            "operationId".to_owned(),
            serde_json::Value::String(operation_id),
        );
        payload.insert(
            "runtimeStatus".to_owned(),
            serde_json::Value::String("failed".to_owned()),
        );
        payload.insert(
            "status".to_owned(),
            serde_json::Value::String("failed".to_owned()),
        );
        let event = Self::insert_coding_session_event_on_executor(
            &mut tx,
            CodingSessionEventStreamScope::new(owner_scope, session_id),
            Some(turn_id.to_owned()),
            Some(runtime_id),
            "turn.failed",
            payload,
            &now,
        )
        .await?;

        map_sqlx_error(tx.commit().await)?;

        Ok(Some(event))
    }
}

#[cfg(test)]
mod tests {
    use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
    use sdkwork_birdcoder_coding_sessions_service::domain::commands::CreateCodingSessionTurnInput;
    use sdkwork_birdcoder_coding_sessions_service::domain::results::{
        CodingSessionTurnPayload, FinalizedProjectionTurnExecution,
    };
    use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
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
            organization_id: "0".to_owned(),
            user_id: "42".to_owned(),
            session_id: "query-plan-session".to_owned(),
        };
        let mut filter_sql = format!(
            " WHERE {}",
            sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted("s")
        );
        let owner_scope = append_session_owner_scope_sql(&context, "s", &mut filter_sql)
            .expect("append owner scope");
        let sql = SqliteCodingSessionRepository::build_session_list_select_sql(
            &filter_sql,
            true,
            true,
            false,
        );

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
            sql.matches("ORDER BY s.sort_timestamp DESC, s.id ASC")
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
             (id, tenant_id, user_id, created_at, updated_at, workspace_id, project_id, runtime_location_id, title, status, \
              entry_surface, host_mode, engine_id, model_id) \
             VALUES ('session-1', 7, 42, '2026-07-11T00:00:00Z', '2026-07-11T00:00:00Z', \
                     '101', 'project-1', 'runtime-location-1', 'Turn session', 'active', 'pc', 'standalone', \
                     'codex', 'gpt-5-codex')",
        )
        .execute(&pool)
        .await
        .expect("seed coding session");
        let repository = SqliteCodingSessionRepository::new(pool.clone());
        let context = CodingSessionContext {
            tenant_id: "7".to_owned(),
            organization_id: "0".to_owned(),
            user_id: "42".to_owned(),
            session_id: "request-session".to_owned(),
        };
        let created_turn = repository
            .create_turn(
                &context,
                "session-1",
                &CreateCodingSessionTurnInput {
                    runtime_id: Some("runtime-1".to_owned()),
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

        let completion_without_native_session = repository
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
        assert_eq!(
            completion_without_native_session
                .native_session_id
                .as_deref(),
            Some("provider-session-1"),
            "the persisted completion must expose the existing immutable native-session binding",
        );
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
                    request_kind: "user_message".to_owned(),
                    input_summary: "failed turn".to_owned(),
                    stream: false,
                    ide_context: None,
                    options: None,
                },
            )
            .await
            .expect("create operation that will fail");
        let failed_event = repository
            .mark_turn_failed(&context, "session-1", &failed_turn.id)
            .await
            .expect("mark turn and operation failed")
            .expect("persist the first canonical failure event");
        let failed_operation = repository
            .get_operation(
                &context,
                "session-1",
                &format!("{}:operation", failed_turn.id),
            )
            .await
            .expect("load failed operation");
        assert_eq!(failed_operation.status, "failed");
        assert_eq!(failed_event.kind, "turn.failed");
        assert_eq!(
            failed_event.turn_id.as_deref(),
            Some(failed_turn.id.as_str())
        );
        assert_eq!(failed_event.runtime_id, failed_turn.runtime_id);
        assert!(
            repository
                .mark_turn_failed(&context, "session-1", &failed_turn.id)
                .await
                .expect("repeat failure must be idempotent")
                .is_none(),
            "a repeated failure must not allocate or publish a second terminal event",
        );
        let failure_event_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM ai_coding_session_event \
             WHERE coding_session_id = ? AND turn_id = ? AND event_kind = 'turn.failed'",
        )
        .bind("session-1")
        .bind(&failed_turn.id)
        .fetch_one(&pool)
        .await
        .expect("count canonical failure events");
        assert_eq!(failure_event_count, 1);

        let resumed_session = repository
            .get_session(&context, "session-1")
            .await
            .expect("load session for the next turn");
        assert_eq!(
            resumed_session.native_session_id.as_deref(),
            Some("provider-session-1")
        );

        let conflicting_native_session_turn = repository
            .create_turn(
                &context,
                "session-1",
                &CreateCodingSessionTurnInput {
                    runtime_id: Some("runtime-conflicting-native-session".to_owned()),
                    request_kind: "user_message".to_owned(),
                    input_summary: "must not replace the native session".to_owned(),
                    stream: false,
                    ide_context: None,
                    options: None,
                },
            )
            .await
            .expect("create turn with an established native session");
        let conflict = repository
            .finalize_turn_execution(
                &context,
                "session-1",
                &FinalizedProjectionTurnExecution {
                    turn: CodingSessionTurnPayload {
                        status: "completed".to_owned(),
                        started_at: Some("2026-07-11T00:00:05Z".to_owned()),
                        completed_at: Some("2026-07-11T00:00:06Z".to_owned()),
                        ..conflicting_native_session_turn
                    },
                    events: Vec::new(),
                    native_session_id: Some("provider-session-2".to_owned()),
                },
            )
            .await
            .expect_err("a completed turn must not replace an established native session");
        assert!(matches!(conflict, CodingSessionError::Conflict(_)));
        let native_session_after_conflict = sqlx::query_scalar::<_, Option<String>>(
            "SELECT native_session_id FROM ai_coding_session WHERE id = ?",
        )
        .bind("session-1")
        .fetch_one(&pool)
        .await
        .expect("read native session after rejected replacement");
        assert_eq!(
            native_session_after_conflict.as_deref(),
            Some("provider-session-1"),
            "a rejected provider-native session replacement must leave the original binding intact",
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
}
