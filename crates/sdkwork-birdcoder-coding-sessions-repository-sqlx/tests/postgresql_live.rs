use std::collections::BTreeMap;
use std::env;
use std::error::Error;
use std::io;

use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::commands::{
    AppendCodingSessionRealtimeEventInput, CreateCodingSessionInput, CreateCodingSessionTurnInput,
    EditCodingSessionMessageInput, ForkCodingSessionInput, UpdateCodingSessionInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::models::{
    CodingSessionDiscoveryScope, CodingSessionListQuery, DiscoveredNativeSessionInput,
    NativeSessionHistoryReconciliationInput, ReconciledCodingSessionEventInput,
    ReconciledCodingSessionMessageInput,
};
use sdkwork_birdcoder_coding_sessions_service::native_session_types::NativeSessionAttributesPayload;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use sdkwork_birdcoder_sqlx_repository_pool::dialect::numbered_placeholders;
use sqlx::{any::AnyPoolOptions, AnyPool};
use uuid::Uuid;

const POSTGRES_SCHEMA: &str = include_str!("../../../database/ddl/generated/postgres_schema.sql");
type LiveTestResult<T = ()> = Result<T, Box<dyn Error + Send + Sync>>;

fn postgres_dsn() -> Option<String> {
    [
        "BIRDCODER_POSTGRESQL_DSN",
        "SDKWORK_BIRDCODER_DATABASE_URL",
        "DATABASE_URL",
    ]
    .into_iter()
    .find_map(|name| env::var(name).ok().filter(|value| !value.trim().is_empty()))
}

fn live_test_error(message: impl Into<String>) -> Box<dyn Error + Send + Sync> {
    Box::new(io::Error::other(message.into()))
}

fn require_live(condition: bool, message: impl Into<String>) -> LiveTestResult {
    if condition {
        Ok(())
    } else {
        Err(live_test_error(message))
    }
}

fn discovered_native_session(
    engine_id: &str,
    native_session_id: &str,
    title: &str,
    sort_timestamp: i64,
    metadata_revision: i64,
) -> DiscoveredNativeSessionInput {
    let mut metadata = BTreeMap::new();
    metadata.insert(
        "revision".to_owned(),
        serde_json::Value::Number(metadata_revision.into()),
    );
    DiscoveredNativeSessionInput {
        title: title.to_owned(),
        status: "active".to_owned(),
        host_mode: "server".to_owned(),
        engine_id: engine_id.to_owned(),
        model_id: "provider-model-v1".to_owned(),
        native_session_id: native_session_id.to_owned(),
        created_at: "2026-07-14T02:00:00Z".to_owned(),
        updated_at: "2026-07-14T03:00:00Z".to_owned(),
        last_turn_at: Some("2026-07-14T02:59:00Z".to_owned()),
        sort_timestamp,
        transcript_updated_at: Some("2026-07-14T03:00:00Z".to_owned()),
        native_attributes: NativeSessionAttributesPayload {
            session_tree_id: Some(format!("tree-{native_session_id}")),
            title: Some(title.to_owned()),
            preview: Some(format!("preview-{metadata_revision}")),
            source: Some("postgres-provider-history".to_owned()),
            provider_version: Some(format!("{metadata_revision}.0.0")),
            model_provider: Some("provider".to_owned()),
            cwd: Some("C:/private/postgres-provider".to_owned()),
            is_sidechain: metadata_revision > 1,
            metadata,
            ..NativeSessionAttributesPayload::default()
        },
    }
}

fn postgresql_history_input(
    native_session_id: &str,
    source_revision: &str,
    records: &[(&str, &str)],
) -> NativeSessionHistoryReconciliationInput {
    let messages = records
        .iter()
        .enumerate()
        .map(
            |(index, (id, content))| ReconciledCodingSessionMessageInput {
                id: format!("provider-history:message:{id}"),
                turn_id: Some(format!("postgres-provider-turn-{id}")),
                role: "assistant".to_owned(),
                content: (*content).to_owned(),
                metadata: BTreeMap::new(),
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                commands: None,
                task_progress: None,
                created_at: format!("2026-07-14T04:{index:02}:00Z"),
            },
        )
        .collect::<Vec<_>>();
    let events = messages
        .iter()
        .map(|message| {
            let mut payload = BTreeMap::new();
            payload.insert("messageId".to_owned(), message.id.clone().into());
            payload.insert("role".to_owned(), message.role.clone().into());
            payload.insert("content".to_owned(), message.content.clone().into());
            ReconciledCodingSessionEventInput {
                id: message
                    .id
                    .replacen("provider-history:message:", "provider-history:event:", 1),
                message_id: message.id.clone(),
                turn_id: message.turn_id.clone(),
                kind: "message.completed".to_owned(),
                payload,
                created_at: message.created_at.clone(),
            }
        })
        .collect();
    NativeSessionHistoryReconciliationInput {
        engine_id: "codex".to_owned(),
        native_session_id: native_session_id.to_owned(),
        refresh_revision: source_revision.to_owned(),
        source_revision: source_revision.to_owned(),
        messages,
        events,
    }
}

async fn set_search_path(pool: &AnyPool, schema: &str) -> LiveTestResult {
    sqlx::query(&format!("SET search_path TO \"{schema}\""))
        .execute(pool)
        .await?;
    Ok(())
}

async fn exercise_postgresql_repository(dsn: &str, schema: &str) -> LiveTestResult {
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect(dsn)
        .await?;
    set_search_path(&pool, schema).await?;
    sqlx::raw_sql(POSTGRES_SCHEMA).execute(&pool).await?;

    let event_sequence_index: String = sqlx::query_scalar(
        "SELECT indexdef FROM pg_indexes \
         WHERE schemaname = current_schema() \
           AND tablename = 'ai_coding_session_event' \
           AND indexname = 'uk_ai_coding_session_event_scope_sequence'",
    )
    .fetch_one(&pool)
    .await?;
    require_live(
        event_sequence_index.contains("UNIQUE INDEX uk_ai_coding_session_event_scope_sequence"),
        "PostgreSQL event sequence index must remain unique",
    )?;
    require_live(
        event_sequence_index.contains("(tenant_id, user_id, coding_session_id, sequence_no)"),
        "PostgreSQL event sequence index must retain its tenant/user/session scope",
    )?;
    require_live(
        event_sequence_index.contains("WHERE (is_deleted IS NOT TRUE)"),
        "PostgreSQL event sequence index must ignore soft-deleted rows",
    )?;

    let workspace_insert_sql = numbered_placeholders(
        "INSERT INTO studio_workspace \
         (id, uuid, created_at, updated_at, tenant_id, organization_id, name, title, code, type, owner_id, status, is_deleted) \
         VALUES (?, ?::uuid, ?::timestamptz, ?::timestamptz, ?, 0, ?, ?, ?, 'team', ?, ?, FALSE)",
    );
    for (id, tenant_id, code) in [
        (101_i64, 7_i64, "postgresql-smoke-primary"),
        (102_i64, 7_i64, "postgresql-smoke-secondary"),
        (201_i64, 8_i64, "postgresql-smoke-other-tenant"),
    ] {
        sqlx::query(&workspace_insert_sql)
            .bind(id)
            .bind(Uuid::new_v4().to_string())
            .bind("2026-07-14T00:00:00Z")
            .bind("2026-07-14T00:00:00Z")
            .bind(tenant_id)
            .bind(code)
            .bind(code)
            .bind(code)
            .bind(42_i64)
            .bind("active")
            .execute(&pool)
            .await?;
    }

    let session_insert_sql = numbered_placeholders(
        "INSERT INTO ai_coding_session \
         (id, tenant_id, organization_id, user_id, created_at, updated_at, workspace_id, project_id, runtime_location_id, title, status, entry_surface, host_mode, engine_id, model_id, sort_timestamp) \
         VALUES (?, ?, 0, ?, ?::timestamptz, ?::timestamptz, ?, ?, ?, ?, 'active', 'pc', 'server', ?, 'gpt-5', ?)",
    );
    for (
        id,
        tenant_id,
        user_id,
        workspace_id,
        project_id,
        runtime_location_id,
        engine_id,
        sort_timestamp,
    ) in [
        (
            "postgres-session-match-newest",
            7_i64,
            42_i64,
            "101",
            "project-smoke",
            "runtime-location-smoke",
            "codex",
            200_i64,
        ),
        (
            "postgres-session-match-offset",
            7,
            42,
            "101",
            "project-smoke",
            "runtime-location-smoke",
            "codex",
            100,
        ),
        (
            "postgres-session-engine-miss",
            7,
            42,
            "101",
            "project-smoke",
            "runtime-location-smoke",
            "claude-code",
            900,
        ),
        (
            "postgres-session-project-miss",
            7,
            42,
            "101",
            "project-other",
            "runtime-location-smoke",
            "codex",
            800,
        ),
        (
            "postgres-session-runtime-miss",
            7,
            42,
            "101",
            "project-smoke",
            "runtime-location-other",
            "codex",
            700,
        ),
        (
            "postgres-session-workspace-miss",
            7,
            42,
            "102",
            "project-smoke",
            "runtime-location-smoke",
            "codex",
            600,
        ),
        (
            "postgres-session-other-tenant",
            8,
            42,
            "201",
            "project-smoke",
            "runtime-location-smoke",
            "codex",
            500,
        ),
        (
            "postgres-session-other-user",
            7,
            99,
            "101",
            "project-smoke",
            "runtime-location-smoke",
            "codex",
            400,
        ),
    ] {
        sqlx::query(&session_insert_sql)
            .bind(id)
            .bind(tenant_id)
            .bind(user_id)
            .bind("2026-07-14T00:00:00Z")
            .bind("2026-07-14T00:00:00Z")
            .bind(workspace_id)
            .bind(project_id)
            .bind(runtime_location_id)
            .bind(id)
            .bind(engine_id)
            .bind(sort_timestamp)
            .execute(&pool)
            .await?;
    }

    let repository = SqliteCodingSessionRepository::new(pool.clone());
    let context = CodingSessionContext {
        tenant_id: "7".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "42".to_owned(),
        session_id: "postgres-live-smoke".to_owned(),
    };
    let native_scope = CodingSessionDiscoveryScope {
        workspace_id: "101".to_owned(),
        project_id: "project-native-materialization".to_owned(),
        runtime_location_id: "runtime-native-materialization".to_owned(),
    };
    let initial_native = discovered_native_session(
        "codex",
        "postgres-native-codex-1",
        "PostgreSQL native initial",
        300,
        1,
    );
    repository
        .upsert_discovered_native_sessions(
            &context,
            &native_scope,
            std::slice::from_ref(&initial_native),
        )
        .await?;
    let initial_native_page = repository
        .list_sessions(
            &context,
            &CodingSessionListQuery {
                engine_id: Some("codex".to_owned()),
                project_id: Some(native_scope.project_id.clone()),
                runtime_location_id: Some(native_scope.runtime_location_id.clone()),
                workspace_id: Some(native_scope.workspace_id.clone()),
                page_size: Some(20),
                offset: Some(0),
            },
        )
        .await?;
    require_live(
        initial_native_page.total == 1 && initial_native_page.items.len() == 1,
        "first PostgreSQL native discovery must create one durable session",
    )?;
    let native_logical_id = initial_native_page.items[0].id.clone();
    require_live(
        Uuid::parse_str(&native_logical_id).is_ok(),
        "PostgreSQL native discovery must allocate a BirdCoder logical UUID",
    )?;

    let mut updated_native = discovered_native_session(
        "codex",
        "postgres-native-codex-1",
        "PostgreSQL native updated",
        400,
        2,
    );
    updated_native.status = "completed".to_owned();
    updated_native.model_id = "provider-model-v2".to_owned();
    updated_native.updated_at = "2026-07-14T04:00:00Z".to_owned();
    updated_native.transcript_updated_at = Some("2026-07-14T04:00:00Z".to_owned());
    let second_native = discovered_native_session(
        "claude-code",
        "postgres-native-claude-1",
        "PostgreSQL Claude native",
        350,
        1,
    );
    let complete_native_snapshot = [updated_native.clone(), second_native.clone()];
    repository
        .upsert_discovered_native_sessions(&context, &native_scope, &complete_native_snapshot)
        .await?;
    repository
        .upsert_discovered_native_sessions(&context, &native_scope, &complete_native_snapshot)
        .await?;

    let native_first_page = repository
        .list_sessions(
            &context,
            &CodingSessionListQuery {
                engine_id: None,
                project_id: Some(native_scope.project_id.clone()),
                runtime_location_id: Some(native_scope.runtime_location_id.clone()),
                workspace_id: Some(native_scope.workspace_id.clone()),
                page_size: Some(1),
                offset: Some(0),
            },
        )
        .await?;
    let native_second_page = repository
        .list_sessions(
            &context,
            &CodingSessionListQuery {
                engine_id: None,
                project_id: Some(native_scope.project_id.clone()),
                runtime_location_id: Some(native_scope.runtime_location_id.clone()),
                workspace_id: Some(native_scope.workspace_id.clone()),
                page_size: Some(1),
                offset: Some(1),
            },
        )
        .await?;
    require_live(
        native_first_page.total == 2
            && native_second_page.total == 2
            && native_first_page.items.len() == 1
            && native_second_page.items.len() == 1,
        "repeated PostgreSQL native discovery must retain the real two-session pagination total",
    )?;
    require_live(
        native_first_page.items[0].id == native_logical_id
            && native_first_page.items[0].title == "PostgreSQL native updated"
            && native_first_page.items[0].runtime_status.as_deref() == Some("completed")
            && native_first_page.items[0]
                .native_attributes
                .metadata
                .get("revision")
                .and_then(serde_json::Value::as_i64)
                == Some(2),
        "PostgreSQL repeat discovery must preserve the logical id and update native metadata/runtime",
    )?;
    let native_identity_count_sql = numbered_placeholders(
        "SELECT COUNT(*) FROM ai_coding_session WHERE tenant_id = ? AND user_id = ? \
         AND engine_id = ? AND native_session_id = ? AND is_deleted IS NOT TRUE",
    );
    let native_identity_count: i64 = sqlx::query_scalar(&native_identity_count_sql)
        .bind(7_i64)
        .bind(42_i64)
        .bind("codex")
        .bind("postgres-native-codex-1")
        .fetch_one(&pool)
        .await?;
    require_live(
        native_identity_count == 1,
        "PostgreSQL unique provider identity must not create duplicate durable sessions",
    )?;
    let native_runtime_count_sql = numbered_placeholders(
        "SELECT COUNT(*) FROM ai_coding_session_runtime WHERE coding_session_id = ? \
         AND is_deleted IS NOT TRUE",
    );
    let native_runtime_count: i64 = sqlx::query_scalar(&native_runtime_count_sql)
        .bind(&native_logical_id)
        .fetch_one(&pool)
        .await?;
    require_live(
        native_runtime_count == 1,
        "PostgreSQL repeat discovery must synchronize one deterministic runtime row",
    )?;
    let session_version_before_noop: i64 = sqlx::query_scalar(&numbered_placeholders(
        "SELECT version FROM ai_coding_session WHERE id = ?",
    ))
    .bind(&native_logical_id)
    .fetch_one(&pool)
    .await?;
    let runtime_version_before_noop: i64 = sqlx::query_scalar(&numbered_placeholders(
        "SELECT version FROM ai_coding_session_runtime WHERE coding_session_id = ?",
    ))
    .bind(&native_logical_id)
    .fetch_one(&pool)
    .await?;
    repository
        .upsert_discovered_native_sessions(&context, &native_scope, &complete_native_snapshot)
        .await?;
    let session_version_after_noop: i64 = sqlx::query_scalar(&numbered_placeholders(
        "SELECT version FROM ai_coding_session WHERE id = ?",
    ))
    .bind(&native_logical_id)
    .fetch_one(&pool)
    .await?;
    let runtime_version_after_noop: i64 = sqlx::query_scalar(&numbered_placeholders(
        "SELECT version FROM ai_coding_session_runtime WHERE coding_session_id = ?",
    ))
    .bind(&native_logical_id)
    .fetch_one(&pool)
    .await?;
    require_live(
        (session_version_before_noop, runtime_version_before_noop)
            == (session_version_after_noop, runtime_version_after_noop),
        "identical PostgreSQL provider summaries must not bump durable versions",
    )?;
    let mut stale_native = initial_native.clone();
    stale_native.title = "stale PostgreSQL provider title".to_owned();
    stale_native.sort_timestamp = 1;
    repository
        .upsert_discovered_native_sessions(&context, &native_scope, &[stale_native])
        .await?;
    let title_after_stale: String = sqlx::query_scalar(&numbered_placeholders(
        "SELECT title FROM ai_coding_session WHERE id = ?",
    ))
    .bind(&native_logical_id)
    .fetch_one(&pool)
    .await?;
    require_live(
        title_after_stale == "PostgreSQL native updated",
        "older PostgreSQL provider summaries must not regress durable fields",
    )?;

    let first_history = postgresql_history_input(
        "postgres-native-codex-1",
        "2026-07-14T05:00:00Z",
        &[
            ("one", "first provider event"),
            ("two", "second provider event"),
        ],
    );
    repository
        .reconcile_native_session_history(&context, &native_logical_id, &first_history)
        .await?;
    let history_versions_before_noop = (
        sqlx::query_scalar::<sqlx::Any, i64>(&numbered_placeholders(
            "SELECT version FROM ai_coding_session WHERE id = ?",
        ))
        .bind(&native_logical_id)
        .fetch_one(&pool)
        .await?,
        sqlx::query_scalar::<sqlx::Any, i64>(&numbered_placeholders(
            "SELECT version FROM ai_coding_session_runtime WHERE coding_session_id = ?",
        ))
        .bind(&native_logical_id)
        .fetch_one(&pool)
        .await?,
    );
    repository
        .reconcile_native_session_history(&context, &native_logical_id, &first_history)
        .await?;
    let history_versions_after_noop = (
        sqlx::query_scalar::<sqlx::Any, i64>(&numbered_placeholders(
            "SELECT version FROM ai_coding_session WHERE id = ?",
        ))
        .bind(&native_logical_id)
        .fetch_one(&pool)
        .await?,
        sqlx::query_scalar::<sqlx::Any, i64>(&numbered_placeholders(
            "SELECT version FROM ai_coding_session_runtime WHERE coding_session_id = ?",
        ))
        .bind(&native_logical_id)
        .fetch_one(&pool)
        .await?,
    );
    require_live(
        history_versions_before_noop == history_versions_after_noop,
        "identical PostgreSQL provider history must preserve session/runtime versions",
    )?;
    let (first_history_events, first_history_total) = repository
        .list_events(&context, &native_logical_id, 0, 20)
        .await?;
    require_live(
        first_history_total == 2
            && first_history_events
                .iter()
                .map(|event| event.sequence)
                .collect::<Vec<_>>()
                == [1, 2],
        "PostgreSQL provider history must allocate stable input-ordered sequences",
    )?;
    let local_event = repository
        .append_realtime_event(
            &context,
            &native_logical_id,
            &AppendCodingSessionRealtimeEventInput {
                turn_id: None,
                runtime_id: None,
                kind: "operation.updated".to_owned(),
                payload: BTreeMap::new(),
            },
        )
        .await?;
    let reduced_history = postgresql_history_input(
        "postgres-native-codex-1",
        "2026-07-14T06:00:00Z",
        &[("one", "first provider event")],
    );
    repository
        .reconcile_native_session_history(&context, &native_logical_id, &reduced_history)
        .await?;
    let (reduced_events, reduced_total) = repository
        .list_events(&context, &native_logical_id, 0, 20)
        .await?;
    require_live(
        reduced_total == 2
            && reduced_events
                .iter()
                .any(|event| event.id == "provider-history:event:one" && event.sequence == 1)
            && reduced_events
                .iter()
                .any(|event| event.id == local_event.id),
        "PostgreSQL reduced provider snapshots must soft-delete only missing provider rows",
    )?;

    let page = repository
        .list_sessions(
            &context,
            &CodingSessionListQuery {
                engine_id: Some("codex".to_owned()),
                project_id: Some("project-smoke".to_owned()),
                runtime_location_id: Some("runtime-location-smoke".to_owned()),
                workspace_id: Some("101".to_owned()),
                page_size: Some(1),
                offset: Some(1),
            },
        )
        .await?;
    require_live(
        page.total == 2,
        format!(
            "expected two scoped PostgreSQL sessions, got {}",
            page.total
        ),
    )?;
    require_live(
        page.items.len() == 1,
        format!(
            "expected one paged PostgreSQL session, got {}",
            page.items.len()
        ),
    )?;
    require_live(
        page.items[0].id == "postgres-session-match-offset",
        format!(
            "expected the second scoped PostgreSQL session after offset, got {}",
            page.items[0].id
        ),
    )?;

    let child_session_id = "postgres-session-match-offset";
    let child_created_at = "2026-07-14T01:02:03.456789Z";
    let runtime_insert_sql = numbered_placeholders(
        "INSERT INTO ai_coding_session_runtime \
         (id, tenant_id, organization_id, user_id, created_at, updated_at, coding_session_id, \
          engine_id, model_id, host_mode, status, transport_kind, capability_snapshot_json, metadata_json) \
         VALUES (?, 7, 0, 42, ?::timestamptz, ?::timestamptz, ?, \
                 'codex', 'gpt-5', 'server', 'ready', 'stdio', ?::jsonb, ?::jsonb)",
    );
    sqlx::query(&runtime_insert_sql)
        .bind("postgres-runtime")
        .bind(child_created_at)
        .bind(child_created_at)
        .bind(child_session_id)
        .bind(r#"{"streaming":true}"#)
        .bind(r#"{"source":"postgres-live"}"#)
        .execute(&pool)
        .await?;

    let message_insert_sql = numbered_placeholders(
        "INSERT INTO ai_coding_session_message \
         (id, uuid, tenant_id, organization_id, user_id, created_at, updated_at, coding_session_id, \
          turn_id, role, content, metadata_json, timestamp_ms, tool_calls_json, file_changes_json, \
          commands_json, task_progress_json) \
         VALUES (?, ?::uuid, 7, 0, 42, ?::timestamptz, ?::timestamptz, ?, \
                 NULL, 'assistant', 'postgres message', ?::jsonb, 123, ?::jsonb, ?::jsonb, \
                 ?::jsonb, ?::jsonb)",
    );
    sqlx::query(&message_insert_sql)
        .bind("postgres-message")
        .bind(Uuid::new_v4().to_string())
        .bind(child_created_at)
        .bind(child_created_at)
        .bind(child_session_id)
        .bind(r#"{"kind":"message"}"#)
        .bind(r#"[]"#)
        .bind(r#"[]"#)
        .bind(r#"[]"#)
        .bind(r#"{"completed":1}"#)
        .execute(&pool)
        .await?;

    let turn_insert_sql = numbered_placeholders(
        "INSERT INTO ai_coding_session_turn \
         (id, uuid, tenant_id, organization_id, user_id, created_at, updated_at, coding_session_id, \
          runtime_id, request_kind, status, input_summary, started_at, completed_at) \
         VALUES (?, ?::uuid, 7, 0, 42, ?::timestamptz, ?::timestamptz, ?, \
                 'postgres-runtime', 'prompt', 'completed', 'postgres turn', \
                 ?::timestamptz, ?::timestamptz)",
    );
    sqlx::query(&turn_insert_sql)
        .bind("postgres-turn")
        .bind(Uuid::new_v4().to_string())
        .bind(child_created_at)
        .bind(child_created_at)
        .bind(child_session_id)
        .bind(child_created_at)
        .bind(child_created_at)
        .execute(&pool)
        .await?;

    let event_insert_sql = numbered_placeholders(
        "INSERT INTO ai_coding_session_event \
         (id, uuid, tenant_id, organization_id, user_id, created_at, updated_at, coding_session_id, \
          turn_id, runtime_id, event_kind, sequence_no, payload_json) \
         VALUES (?, ?::uuid, 7, 0, 42, ?::timestamptz, ?::timestamptz, ?, \
                 'postgres-turn', 'postgres-runtime', 'turn.completed', 1, ?::jsonb)",
    );
    sqlx::query(&event_insert_sql)
        .bind("postgres-event")
        .bind(Uuid::new_v4().to_string())
        .bind(child_created_at)
        .bind(child_created_at)
        .bind(child_session_id)
        .bind(r#"{"status":"completed"}"#)
        .execute(&pool)
        .await?;

    let artifact_insert_sql = numbered_placeholders(
        "INSERT INTO ai_coding_session_artifact \
         (id, uuid, tenant_id, organization_id, user_id, created_at, updated_at, coding_session_id, \
          turn_id, artifact_kind, title, blob_ref, metadata_json) \
         VALUES (?, ?::uuid, 7, 0, 42, ?::timestamptz, ?::timestamptz, ?, \
                 'postgres-turn', 'patch', 'PostgreSQL patch', 'blob:postgres', ?::jsonb)",
    );
    sqlx::query(&artifact_insert_sql)
        .bind("postgres-artifact")
        .bind(Uuid::new_v4().to_string())
        .bind(child_created_at)
        .bind(child_created_at)
        .bind(child_session_id)
        .bind(r#"{"files":1}"#)
        .execute(&pool)
        .await?;

    let checkpoint_insert_sql = numbered_placeholders(
        "INSERT INTO ai_coding_session_checkpoint \
         (id, tenant_id, organization_id, user_id, created_at, updated_at, coding_session_id, \
          runtime_id, checkpoint_kind, resumable, state_json) \
         VALUES (?, 7, 0, 42, ?::timestamptz, ?::timestamptz, ?, \
                 'postgres-runtime', 'resume', TRUE, ?::jsonb)",
    );
    sqlx::query(&checkpoint_insert_sql)
        .bind("postgres-checkpoint")
        .bind(child_created_at)
        .bind(child_created_at)
        .bind(child_session_id)
        .bind(r#"{"cursor":1}"#)
        .execute(&pool)
        .await?;

    let operation_insert_sql = numbered_placeholders(
        "INSERT INTO ai_coding_session_operation \
         (id, uuid, tenant_id, organization_id, user_id, created_at, updated_at, coding_session_id, \
          turn_id, status, stream_url, stream_kind, artifact_refs_json) \
         VALUES (?, ?::uuid, 7, 0, 42, ?::timestamptz, ?::timestamptz, ?, \
                 'postgres-turn', 'completed', '/streams/postgres', 'sse', ?::jsonb)",
    );
    sqlx::query(&operation_insert_sql)
        .bind("postgres-operation")
        .bind(Uuid::new_v4().to_string())
        .bind(child_created_at)
        .bind(child_created_at)
        .bind(child_session_id)
        .bind(r#"["postgres-artifact"]"#)
        .execute(&pool)
        .await?;

    let session = repository.get_session(&context, child_session_id).await?;
    require_live(
        session.runtime_status.as_deref() == Some("ready"),
        "PostgreSQL runtime status projection must be readable",
    )?;
    let (turns, turn_total) = repository
        .list_turns(&context, child_session_id, 0, 20)
        .await?;
    require_live(
        turn_total == 1 && turns.first().map(|turn| turn.id.as_str()) == Some("postgres-turn"),
        "PostgreSQL turn UUID/timestamp projection must be readable",
    )?;
    let (events, event_total) = repository
        .list_events(&context, child_session_id, 0, 20)
        .await?;
    require_live(
        event_total == 1 && events.first().map(|event| event.id.as_str()) == Some("postgres-event"),
        "PostgreSQL event timestamp/JSONB projection must be readable",
    )?;
    let (artifacts, artifact_total) = repository
        .list_artifacts(&context, child_session_id, 0, 20)
        .await?;
    require_live(
        artifact_total == 1
            && artifacts.first().map(|artifact| artifact.id.as_str()) == Some("postgres-artifact"),
        "PostgreSQL artifact timestamp/JSONB projection must be readable",
    )?;
    let (checkpoints, checkpoint_total) = repository
        .list_checkpoints(&context, child_session_id, 0, 20)
        .await?;
    require_live(
        checkpoint_total == 1
            && checkpoints.first().map(|checkpoint| checkpoint.resumable) == Some(true),
        "PostgreSQL checkpoint JSONB/BOOLEAN projection must be readable",
    )?;
    let operation = repository
        .get_operation(&context, child_session_id, "postgres-operation")
        .await?;
    require_live(
        operation.operation_id == "postgres-operation",
        "PostgreSQL operation timestamp/JSONB projection must be readable",
    )?;
    let edited_message = repository
        .edit_message(
            &context,
            child_session_id,
            "postgres-message",
            &EditCodingSessionMessageInput {
                content: "postgres message edited".to_owned(),
            },
        )
        .await?;
    require_live(
        edited_message.content == "postgres message edited",
        "PostgreSQL message UUID/timestamp/JSONB projection must be readable",
    )?;
    let forked_session = repository
        .fork_session(
            &context,
            child_session_id,
            &ForkCodingSessionInput {
                title: Some("PostgreSQL fork".to_owned()),
            },
        )
        .await?;
    let (forked_turns, forked_turn_total) = repository
        .list_turns(&context, &forked_session.id, 0, 20)
        .await?;
    let (forked_events, forked_event_total) = repository
        .list_events(&context, &forked_session.id, 0, 20)
        .await?;
    let (forked_artifacts, forked_artifact_total) = repository
        .list_artifacts(&context, &forked_session.id, 0, 20)
        .await?;
    require_live(
        forked_turn_total == 1
            && forked_event_total == 2
            && forked_artifact_total == 1
            && !forked_turns.is_empty()
            && !forked_events.is_empty()
            && !forked_artifacts.is_empty(),
        "PostgreSQL history copy must preserve owner scope and cast native column values",
    )?;

    let created_session = repository
        .create_session(
            &context,
            &CreateCodingSessionInput {
                workspace_id: "101".to_owned(),
                project_id: "project-created".to_owned(),
                runtime_location_id: "runtime-location-created".to_owned(),
                title: "PostgreSQL created session".to_owned(),
                host_mode: "server".to_owned(),
                engine_id: "codex".to_owned(),
                model_id: "gpt-5".to_owned(),
            },
        )
        .await?;
    let created_turn = repository
        .create_turn(
            &context,
            &created_session.id,
            &CreateCodingSessionTurnInput {
                runtime_id: Some("postgres-created-runtime".to_owned()),
                request_kind: "prompt".to_owned(),
                input_summary: "exercise PostgreSQL writes".to_owned(),
                stream: false,
                ide_context: None,
                options: None,
            },
        )
        .await?;
    let created_operation_id = format!("{}:operation", created_turn.id);
    let created_operation = repository
        .get_operation(&context, &created_session.id, &created_operation_id)
        .await?;
    require_live(
        created_operation.operation_id == created_operation_id,
        "PostgreSQL session/turn/operation inserts must cast native column values",
    )?;
    let updated_session = repository
        .update_session(
            &context,
            &created_session.id,
            &UpdateCodingSessionInput {
                title: Some("PostgreSQL updated session".to_owned()),
                status: None,
                host_mode: None,
            },
        )
        .await?;
    require_live(
        updated_session.title == "PostgreSQL updated session",
        "PostgreSQL session timestamp updates must cast native column values",
    )?;
    repository
        .delete_session(&context, &created_session.id)
        .await?;
    require_live(
        repository
            .get_session(&context, &created_session.id)
            .await
            .is_err(),
        "PostgreSQL session soft delete must use native BOOLEAN semantics",
    )?;

    let mut transaction = pool.begin().await?;
    let update_sql = numbered_placeholders("UPDATE ai_coding_session SET title = ? WHERE id = ?");
    sqlx::query(&update_sql)
        .bind("uncommitted")
        .bind("postgres-session-match-offset")
        .execute(&mut *transaction)
        .await?;
    transaction.rollback().await?;
    let title_sql = numbered_placeholders("SELECT title FROM ai_coding_session WHERE id = ?");
    let title: String = sqlx::query_scalar(&title_sql)
        .bind("postgres-session-match-offset")
        .fetch_one(&pool)
        .await?;
    require_live(
        title != "uncommitted",
        "PostgreSQL transaction rollback must discard the uncommitted title",
    )?;

    let orphan_insert_sql = numbered_placeholders(
        "INSERT INTO ai_coding_session_message \
         (id, tenant_id, organization_id, user_id, created_at, updated_at, coding_session_id, role, content, metadata_json) \
         VALUES ('orphan', 7, 0, 42, ?::timestamptz, ?::timestamptz, 'missing-session', 'user', 'x', '{}')",
    );
    let orphan_result = sqlx::query(&orphan_insert_sql)
        .bind("2026-07-14T00:00:00Z")
        .bind("2026-07-14T00:00:00Z")
        .execute(&pool)
        .await;
    require_live(
        orphan_result.is_err(),
        "PostgreSQL must reject orphan session messages",
    )?;

    Ok(())
}

#[tokio::test]
async fn production_repository_supports_postgresql_schema_transactions_and_scope() -> LiveTestResult
{
    let Some(dsn) = postgres_dsn() else {
        eprintln!(
            "PostgreSQL live repository test skipped because no authorized DSN is configured"
        );
        return Ok(());
    };

    sqlx::any::install_default_drivers();
    let admin_pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect(&dsn)
        .await?;
    let schema = format!("birdcoder_smoke_{}", Uuid::new_v4().simple());
    sqlx::query(&format!("CREATE SCHEMA \"{schema}\""))
        .execute(&admin_pool)
        .await?;

    let test_result = exercise_postgresql_repository(&dsn, &schema).await;
    let cleanup_result = sqlx::query(&format!("DROP SCHEMA \"{schema}\" CASCADE"))
        .execute(&admin_pool)
        .await;

    match (test_result, cleanup_result) {
        (Ok(()), Ok(_)) => Ok(()),
        (Err(test_error), Ok(_)) => Err(test_error),
        (Ok(()), Err(cleanup_error)) => Err(Box::new(cleanup_error)),
        (Err(test_error), Err(cleanup_error)) => Err(live_test_error(format!(
            "PostgreSQL live test failed ({test_error}); exact schema cleanup also failed ({cleanup_error})"
        ))),
    }
}
