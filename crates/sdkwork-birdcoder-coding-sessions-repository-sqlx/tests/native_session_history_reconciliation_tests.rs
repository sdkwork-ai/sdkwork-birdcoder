use std::collections::BTreeMap;

use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::commands::AppendCodingSessionRealtimeEventInput;
use sdkwork_birdcoder_coding_sessions_service::domain::models::{
    CodingSessionDiscoveryScope, CodingSessionListQuery, DiscoveredNativeSessionInput,
    NativeSessionHistoryReconciliationInput, ReconciledCodingSessionEventInput,
    ReconciledCodingSessionMessageInput,
};
use sdkwork_birdcoder_coding_sessions_service::native_session_types::NativeSessionAttributesPayload;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use sqlx::{any::AnyPoolOptions, AnyPool};

const SQLITE_SCHEMA: &str = include_str!("../../../database/ddl/generated/sqlite_schema.sql");

fn context() -> CodingSessionContext {
    CodingSessionContext {
        tenant_id: "7".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "42".to_owned(),
        session_id: "provider-history-test".to_owned(),
    }
}

fn discovered(native_session_id: &str) -> DiscoveredNativeSessionInput {
    DiscoveredNativeSessionInput {
        title: "Provider session".to_owned(),
        status: "active".to_owned(),
        host_mode: "server".to_owned(),
        engine_id: "codex".to_owned(),
        model_id: "gpt-5".to_owned(),
        native_session_id: native_session_id.to_owned(),
        created_at: "2026-07-20T01:00:00Z".to_owned(),
        updated_at: "2026-07-20T02:00:00Z".to_owned(),
        last_turn_at: Some("2026-07-20T02:00:00Z".to_owned()),
        sort_timestamp: 100,
        transcript_updated_at: Some("2026-07-20T02:00:00Z".to_owned()),
        native_attributes: NativeSessionAttributesPayload::default(),
    }
}

async fn fixture(
    native_session_id: &str,
) -> (
    AnyPool,
    SqliteCodingSessionRepository,
    CodingSessionContext,
    String,
) {
    sqlx::any::install_default_drivers();
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open SQLite fixture");
    sqlx::raw_sql(SQLITE_SCHEMA)
        .execute(&pool)
        .await
        .expect("apply SQLite schema");
    sqlx::query(
        "INSERT INTO studio_workspace \
         (id, created_at, updated_at, tenant_id, organization_id, name, title, code, type, owner_id, status, is_deleted) \
         VALUES (101, ?, ?, 7, 0, 'History', 'History', 'history', 'team', 42, 'active', 0)",
    )
    .bind("2026-07-20T00:00:00Z")
    .bind("2026-07-20T00:00:00Z")
    .execute(&pool)
    .await
    .expect("seed workspace");
    let repository = SqliteCodingSessionRepository::new(pool.clone());
    let context = context();
    let scope = CodingSessionDiscoveryScope {
        workspace_id: "101".to_owned(),
        project_id: "project-history".to_owned(),
        runtime_location_id: "runtime-history".to_owned(),
    };
    repository
        .upsert_discovered_native_sessions(&context, &scope, &[discovered(native_session_id)])
        .await
        .expect("materialize provider session");
    let page = repository
        .list_sessions(
            &context,
            &CodingSessionListQuery {
                workspace_id: Some(scope.workspace_id),
                project_id: Some(scope.project_id),
                runtime_location_id: Some(scope.runtime_location_id),
                page_size: Some(20),
                offset: Some(0),
                ..CodingSessionListQuery::default()
            },
        )
        .await
        .expect("read materialized session");
    (pool, repository, context, page.items[0].id.clone())
}

fn message(
    id: &str,
    role: &str,
    content: &str,
    created_at: &str,
) -> ReconciledCodingSessionMessageInput {
    ReconciledCodingSessionMessageInput {
        id: format!("provider-history:message:{id}"),
        turn_id: Some(format!("turn-{id}")),
        role: role.to_owned(),
        content: content.to_owned(),
        metadata: BTreeMap::new(),
        tool_calls: None,
        tool_call_id: None,
        file_changes: None,
        commands: None,
        task_progress: None,
        created_at: created_at.to_owned(),
    }
}

fn event(message: &ReconciledCodingSessionMessageInput) -> ReconciledCodingSessionEventInput {
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
}

fn history(
    native_session_id: &str,
    revision: &str,
    messages: Vec<ReconciledCodingSessionMessageInput>,
) -> NativeSessionHistoryReconciliationInput {
    let events = messages.iter().map(event).collect();
    NativeSessionHistoryReconciliationInput {
        engine_id: "codex".to_owned(),
        native_session_id: native_session_id.to_owned(),
        refresh_revision: revision.to_owned(),
        source_revision: revision.to_owned(),
        messages,
        events,
    }
}

async fn versions(pool: &AnyPool, session_id: &str) -> (i64, i64) {
    let session_version = sqlx::query_scalar("SELECT version FROM ai_coding_session WHERE id = ?")
        .bind(session_id)
        .fetch_one(pool)
        .await
        .expect("read session version");
    let runtime_version = sqlx::query_scalar(
        "SELECT version FROM ai_coding_session_runtime WHERE coding_session_id = ?",
    )
    .bind(session_id)
    .fetch_one(pool)
    .await
    .expect("read runtime version");
    (session_version, runtime_version)
}

async fn seed_local_message(
    pool: &AnyPool,
    session_id: &str,
    message_id: &str,
    turn_id: &str,
    content: &str,
    created_at: &str,
) {
    sqlx::query(
        "INSERT INTO ai_coding_session_message \
         (id, tenant_id, user_id, created_at, updated_at, coding_session_id, turn_id, role, content, metadata_json) \
         VALUES (?, 7, 42, ?, ?, ?, ?, 'assistant', ?, '{}')",
    )
    .bind(message_id)
    .bind(created_at)
    .bind(created_at)
    .bind(session_id)
    .bind(turn_id)
    .bind(content)
    .execute(pool)
    .await
    .expect("seed local message evidence");
}

struct LocalProjectionEvent<'a> {
    id: &'a str,
    turn_id: &'a str,
    kind: &'a str,
    sequence: i64,
    payload: serde_json::Value,
    created_at: &'a str,
}

async fn seed_local_projection_event(
    pool: &AnyPool,
    session_id: &str,
    event: LocalProjectionEvent<'_>,
) {
    sqlx::query(
        "INSERT INTO ai_coding_session_event \
         (id, tenant_id, user_id, created_at, updated_at, coding_session_id, turn_id, event_kind, sequence_no, payload_json) \
         VALUES (?, 7, 42, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(event.id)
    .bind(event.created_at)
    .bind(event.created_at)
    .bind(session_id)
    .bind(event.turn_id)
    .bind(event.kind)
    .bind(event.sequence)
    .bind(event.payload.to_string())
    .execute(pool)
    .await
    .expect("seed local event evidence");
}

fn duplicate_provider_history(
    native_session_id: &str,
    content: &str,
) -> NativeSessionHistoryReconciliationInput {
    history(
        native_session_id,
        "2026-07-20T03:00:00Z",
        vec![
            message(
                "duplicate-first",
                "assistant",
                content,
                "2026-07-20T02:10:01Z",
            ),
            message(
                "duplicate-second",
                "assistant",
                content,
                "2026-07-20T02:10:02Z",
            ),
        ],
    )
}

async fn assert_only_second_provider_projection_remains(pool: &AnyPool, session_id: &str) {
    let message_ids = sqlx::query_scalar::<_, String>(
        "SELECT id FROM ai_coding_session_message WHERE coding_session_id = ? \
         AND id LIKE 'provider-history:message:%' AND is_deleted IS NOT TRUE ORDER BY id",
    )
    .bind(session_id)
    .fetch_all(pool)
    .await
    .expect("read active provider message ids");
    let event_ids = sqlx::query_scalar::<_, String>(
        "SELECT id FROM ai_coding_session_event WHERE coding_session_id = ? \
         AND id LIKE 'provider-history:event:%' AND is_deleted IS NOT TRUE ORDER BY id",
    )
    .bind(session_id)
    .fetch_all(pool)
    .await
    .expect("read active provider event ids");

    assert_eq!(message_ids, ["provider-history:message:duplicate-second"]);
    assert_eq!(event_ids, ["provider-history:event:duplicate-second"]);
}

#[tokio::test]
async fn one_local_message_suppresses_only_one_duplicate_provider_message() {
    let native_id = "native-history-message-cardinality";
    let (pool, repository, context, session_id) = fixture(native_id).await;
    seed_local_message(
        &pool,
        &session_id,
        "local-message",
        "local-turn",
        "repeat",
        "2026-07-20T02:10:00Z",
    )
    .await;

    repository
        .reconcile_native_session_history(
            &context,
            &session_id,
            &duplicate_provider_history(native_id, "repeat"),
        )
        .await
        .expect("reconcile duplicates against one local message");

    assert_only_second_provider_projection_remains(&pool, &session_id).await;
}

#[tokio::test]
async fn one_local_completed_event_suppresses_only_one_duplicate_provider_message() {
    let native_id = "native-history-completed-cardinality";
    let (pool, repository, context, session_id) = fixture(native_id).await;
    seed_local_projection_event(
        &pool,
        &session_id,
        LocalProjectionEvent {
            id: "local-completed",
            turn_id: "local-turn",
            kind: "message.completed",
            sequence: 1,
            payload: serde_json::json!({"role": "assistant", "content": "repeat"}),
            created_at: "2026-07-20T02:10:00Z",
        },
    )
    .await;

    repository
        .reconcile_native_session_history(
            &context,
            &session_id,
            &duplicate_provider_history(native_id, "repeat"),
        )
        .await
        .expect("reconcile duplicates against one completed event");

    assert_only_second_provider_projection_remains(&pool, &session_id).await;
}

#[tokio::test]
async fn one_local_delta_aggregate_suppresses_only_one_duplicate_provider_message() {
    let native_id = "native-history-delta-cardinality";
    let (pool, repository, context, session_id) = fixture(native_id).await;
    for (event_id, sequence, delta, created_at) in [
        ("local-delta-1", 1, "re", "2026-07-20T02:10:00Z"),
        ("local-delta-2", 2, "peat", "2026-07-20T02:10:01Z"),
    ] {
        seed_local_projection_event(
            &pool,
            &session_id,
            LocalProjectionEvent {
                id: event_id,
                turn_id: "local-turn",
                kind: "message.delta",
                sequence,
                payload: serde_json::json!({"role": "assistant", "contentDelta": delta}),
                created_at,
            },
        )
        .await;
    }

    repository
        .reconcile_native_session_history(
            &context,
            &session_id,
            &duplicate_provider_history(native_id, "repeat"),
        )
        .await
        .expect("reconcile duplicates against one aggregate delta stream");

    assert_only_second_provider_projection_remains(&pool, &session_id).await;
}

#[tokio::test]
async fn local_message_and_completed_projection_form_one_logical_evidence() {
    let native_id = "native-history-dual-projection-cardinality";
    let (pool, repository, context, session_id) = fixture(native_id).await;
    seed_local_message(
        &pool,
        &session_id,
        "local-message",
        "local-turn",
        "repeat",
        "2026-07-20T02:10:00Z",
    )
    .await;
    seed_local_projection_event(
        &pool,
        &session_id,
        LocalProjectionEvent {
            id: "local-completed",
            turn_id: "local-turn",
            kind: "message.completed",
            sequence: 1,
            payload: serde_json::json!({
                "messageId": "local-message",
                "role": "assistant",
                "content": "repeat"
            }),
            created_at: "2026-07-20T02:10:00Z",
        },
    )
    .await;

    repository
        .reconcile_native_session_history(
            &context,
            &session_id,
            &duplicate_provider_history(native_id, "repeat"),
        )
        .await
        .expect("reconcile duplicates against one dual-projected local message");

    assert_only_second_provider_projection_remains(&pool, &session_id).await;
}

#[tokio::test]
async fn provider_history_is_idempotent_sequence_stable_and_namespace_scoped() {
    let native_id = "native-history-1";
    let (pool, repository, context, session_id) = fixture(native_id).await;
    sqlx::query(
        "UPDATE ai_coding_session_runtime SET metadata_json = '{\"custom\":\"kept\"}' \
         WHERE coding_session_id = ?",
    )
    .bind(&session_id)
    .execute(&pool)
    .await
    .expect("seed unrelated runtime metadata");

    let first = history(
        native_id,
        "2026-07-20T03:00:00Z",
        vec![
            message("one", "user", "first", "2026-07-20T02:10:00Z"),
            message("two", "assistant", "second", "2026-07-20T02:20:00Z"),
        ],
    );
    repository
        .reconcile_native_session_history(&context, &session_id, &first)
        .await
        .expect("persist first complete provider snapshot");
    let (events, total) = repository
        .list_events(&context, &session_id, 0, 20)
        .await
        .expect("list reconciled events");
    assert_eq!(total, 2);
    assert_eq!(
        events
            .iter()
            .map(|event| event.sequence)
            .collect::<Vec<_>>(),
        [1, 2]
    );
    let first_versions = versions(&pool, &session_id).await;
    repository
        .reconcile_native_session_history(&context, &session_id, &first)
        .await
        .expect("repeat identical provider snapshot");
    assert_eq!(versions(&pool, &session_id).await, first_versions);
    assert!(!repository
        .native_session_history_refresh_required(
            &context,
            &session_id,
            "codex",
            native_id,
            "2026-07-20T03:00:00Z",
        )
        .await
        .expect("check fresh provider history"));
    let metadata: String = sqlx::query_scalar(
        "SELECT metadata_json FROM ai_coding_session_runtime WHERE coding_session_id = ?",
    )
    .bind(&session_id)
    .fetch_one(&pool)
    .await
    .expect("read merged runtime metadata");
    let metadata: serde_json::Value = serde_json::from_str(&metadata).expect("parse metadata");
    assert_eq!(metadata["custom"], "kept");
    assert!(metadata["providerHistoryRefreshedAt"].is_string());

    let local = repository
        .append_realtime_event(
            &context,
            &session_id,
            &AppendCodingSessionRealtimeEventInput {
                turn_id: None,
                runtime_id: None,
                kind: "operation.updated".to_owned(),
                payload: BTreeMap::new(),
            },
        )
        .await
        .expect("append local durable event");
    assert_eq!(local.sequence, 3);
    let local_timestamp: String =
        sqlx::query_scalar("SELECT updated_at FROM ai_coding_session WHERE id = ?")
            .bind(&session_id)
            .fetch_one(&pool)
            .await
            .expect("read local transcript timestamp");

    let second = history(
        native_id,
        "2026-07-20T04:00:00Z",
        vec![
            first.messages[0].clone(),
            first.messages[1].clone(),
            message("three", "assistant", "third", "2026-07-20T03:10:00Z"),
            message("four", "assistant", "fourth", "2026-07-20T03:20:00Z"),
        ],
    );
    repository
        .reconcile_native_session_history(&context, &session_id, &second)
        .await
        .expect("append newly discovered provider history");
    let (events, _) = repository
        .list_events(&context, &session_id, 0, 20)
        .await
        .expect("read stable sequences");
    assert_eq!(
        events
            .iter()
            .map(|event| event.sequence)
            .collect::<Vec<_>>(),
        [1, 2, 3, 4, 5]
    );

    let reduced = history(
        native_id,
        "2026-07-20T05:00:00Z",
        vec![first.messages[0].clone()],
    );
    repository
        .reconcile_native_session_history(&context, &session_id, &reduced)
        .await
        .expect("apply reduced complete provider snapshot");
    let (events, total) = repository
        .list_events(&context, &session_id, 0, 20)
        .await
        .expect("list reduced history");
    assert_eq!(total, 2);
    assert_eq!(events[0].id, "provider-history:event:one");
    assert_eq!(events[1].id, local.id);
    let active_local: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_coding_session_event WHERE id = ? AND is_deleted IS NOT TRUE",
    )
    .bind(&local.id)
    .fetch_one(&pool)
    .await
    .expect("count local event");
    assert_eq!(active_local, 1);
    let preserved_timestamp: String =
        sqlx::query_scalar("SELECT updated_at FROM ai_coding_session WHERE id = ?")
            .bind(&session_id)
            .fetch_one(&pool)
            .await
            .expect("read preserved local timestamp");
    assert_eq!(preserved_timestamp, local_timestamp);
    let versions_before_stale = versions(&pool, &session_id).await;
    let mut stale_history = history(native_id, "2026-07-20T04:00:00Z", Vec::new());
    stale_history.refresh_revision = local_timestamp.clone();
    repository
        .reconcile_native_session_history(&context, &session_id, &stale_history)
        .await
        .expect("treat an older provider transcript as a freshness-only observation");
    assert_eq!(versions(&pool, &session_id).await, versions_before_stale);
    let active_provider_events: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_coding_session_event WHERE coding_session_id = ? \
         AND id LIKE 'provider-history:event:%' AND is_deleted IS NOT TRUE",
    )
    .bind(&session_id)
    .fetch_one(&pool)
    .await
    .expect("count provider events after stale snapshot");
    assert_eq!(active_provider_events, 1);
    assert!(!repository
        .native_session_history_refresh_required(
            &context,
            &session_id,
            "codex",
            native_id,
            &local_timestamp,
        )
        .await
        .expect("freshness-only stale observation must cover the next event page"));
    assert!(repository
        .native_session_history_refresh_required(
            &context,
            &session_id,
            "codex",
            native_id,
            "2099-01-01T00:00:00Z",
        )
        .await
        .expect("a new summary revision must bypass an older freshness lease"));
    assert!(repository
        .native_session_history_refresh_required(
            &context,
            &session_id,
            "claude-code",
            native_id,
            "2026-07-20T05:00:00Z",
        )
        .await
        .is_err());
}

#[tokio::test]
async fn equivalent_local_completed_and_aggregate_delta_events_suppress_provider_rows() {
    let native_id = "native-history-dedupe";
    let (pool, repository, context, session_id) = fixture(native_id).await;
    sqlx::query(
        "INSERT INTO ai_coding_session_message \
         (id, tenant_id, user_id, created_at, updated_at, coding_session_id, role, content, metadata_json) \
         VALUES ('local-message', 7, 42, ?, ?, ?, 'assistant', 'stored locally', '{}')",
    )
    .bind("2026-07-20T02:10:00Z")
    .bind("2026-07-20T02:10:00Z")
    .bind(&session_id)
    .execute(&pool)
    .await
    .expect("seed local message");
    for (id, turn_id, kind, sequence, payload, created_at) in [
        (
            "local-completed",
            "turn-completed",
            "message.completed",
            1_i64,
            r#"{"role":"assistant","content":"completed locally"}"#,
            "2026-07-20T02:20:00Z",
        ),
        (
            "local-delta-1",
            "turn-delta",
            "message.delta",
            2,
            r#"{"role":"assistant","contentDelta":"stream "}"#,
            "2026-07-20T02:30:00Z",
        ),
        (
            "local-delta-2",
            "turn-delta",
            "message.delta",
            3,
            r#"{"role":"assistant","contentDelta":"done"}"#,
            "2026-07-20T02:30:01Z",
        ),
    ] {
        sqlx::query(
            "INSERT INTO ai_coding_session_event \
             (id, tenant_id, user_id, created_at, updated_at, coding_session_id, turn_id, event_kind, sequence_no, payload_json) \
             VALUES (?, 7, 42, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(created_at)
        .bind(created_at)
        .bind(&session_id)
        .bind(turn_id)
        .bind(kind)
        .bind(sequence)
        .bind(payload)
        .execute(&pool)
        .await
        .expect("seed local projection event");
    }
    let mut stored = message(
        "stored",
        "assistant",
        "stored locally",
        "2026-07-20T02:10:01Z",
    );
    stored.turn_id = None;
    let mut completed = message(
        "completed",
        "assistant",
        "completed locally",
        "2026-07-20T02:20:01Z",
    );
    completed.turn_id = Some("turn-completed".to_owned());
    let mut delta = message("delta", "assistant", "stream done", "2026-07-20T02:30:02Z");
    delta.turn_id = Some("turn-delta".to_owned());
    repository
        .reconcile_native_session_history(
            &context,
            &session_id,
            &history(
                native_id,
                "2026-07-20T03:00:00Z",
                vec![stored, completed, delta],
            ),
        )
        .await
        .expect("deduplicate provider snapshot against local durable rows");
    let provider_messages: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_coding_session_message WHERE coding_session_id = ? \
         AND id LIKE 'provider-history:message:%' AND is_deleted IS NOT TRUE",
    )
    .bind(&session_id)
    .fetch_one(&pool)
    .await
    .expect("count provider messages");
    let provider_events: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_coding_session_event WHERE coding_session_id = ? \
         AND id LIKE 'provider-history:event:%' AND is_deleted IS NOT TRUE",
    )
    .bind(&session_id)
    .fetch_one(&pool)
    .await
    .expect("count provider events");
    assert_eq!((provider_messages, provider_events), (0, 0));
    let local_event_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_coding_session_event WHERE coding_session_id = ? \
         AND id LIKE 'local-%' AND is_deleted IS NOT TRUE",
    )
    .bind(&session_id)
    .fetch_one(&pool)
    .await
    .expect("count local events");
    assert_eq!(local_event_count, 3);
}

#[tokio::test]
async fn reconciliation_failure_rolls_back_messages_events_and_revision() {
    let (pool, repository, context, session_id) = fixture("native-history-rollback").await;
    let scope = CodingSessionDiscoveryScope {
        workspace_id: "101".to_owned(),
        project_id: "project-history".to_owned(),
        runtime_location_id: "runtime-history".to_owned(),
    };
    repository
        .upsert_discovered_native_sessions(&context, &scope, &[discovered("native-other")])
        .await
        .expect("materialize collision owner session");
    let other_id: String = sqlx::query_scalar(
        "SELECT id FROM ai_coding_session WHERE native_session_id = 'native-other'",
    )
    .fetch_one(&pool)
    .await
    .expect("read other session");
    sqlx::query(
        "INSERT INTO ai_coding_session_event \
         (id, tenant_id, user_id, created_at, updated_at, coding_session_id, event_kind, sequence_no, payload_json) \
         VALUES ('provider-history:event:collision', 7, 42, ?, ?, ?, 'message.completed', 1, '{}')",
    )
    .bind("2026-07-20T02:00:00Z")
    .bind("2026-07-20T02:00:00Z")
    .bind(&other_id)
    .execute(&pool)
    .await
    .expect("seed provider event id collision");
    let collision_message = message(
        "collision",
        "assistant",
        "must roll back",
        "2026-07-20T02:30:00Z",
    );
    let input = history(
        "native-history-rollback",
        "2026-07-20T03:00:00Z",
        vec![collision_message.clone()],
    );
    assert!(repository
        .reconcile_native_session_history(&context, &session_id, &input)
        .await
        .is_err());
    let inserted_message_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM ai_coding_session_message WHERE id = ?")
            .bind(&collision_message.id)
            .fetch_one(&pool)
            .await
            .expect("count rolled-back message");
    assert_eq!(inserted_message_count, 0);
    let revision: Option<String> = sqlx::query_scalar(
        "SELECT native_turn_container_id FROM ai_coding_session_runtime WHERE coding_session_id = ?",
    )
    .bind(&session_id)
    .fetch_one(&pool)
    .await
    .expect("read unchanged revision");
    assert_eq!(revision, None);
}
