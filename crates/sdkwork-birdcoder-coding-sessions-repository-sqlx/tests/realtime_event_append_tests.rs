use std::{
    collections::BTreeMap,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, Mutex,
    },
};

use async_trait::async_trait;
use sdkwork_birdcoder_coding_sessions_repository_sqlx::db::schema::PROVIDER_AUTHORITY_SCHEMA;
use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::commands::{
    AppendCodingSessionRealtimeEventInput, CodingSessionInteractionKind,
    CreateCodingSessionTurnRequest, SubmitApprovalDecisionInput, SubmitUserQuestionAnswerInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    CodingSessionEventPayload, CodingSessionTurnPayload, FinalizedProjectionTurnExecution,
    PendingProjectionTurnExecution,
};
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::ports::engine_validator::EngineValidator;
use sdkwork_birdcoder_coding_sessions_service::ports::events::{
    CodingSessionRealtimeEventInput, RealtimeEventPublisher,
};
use sdkwork_birdcoder_coding_sessions_service::ports::project_execution_scope::ProjectExecutionScopeResolver;
use sdkwork_birdcoder_coding_sessions_service::ports::provider::CodeEngineProvider;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use sdkwork_birdcoder_coding_sessions_service::service::coding_session_service::CodingSessionService;
use sdkwork_birdcoder_coding_sessions_service::{
    domain::commands::SubmitApprovalDecisionRequest,
    domain::models::AuthoritativeEngineRuntimeProfile,
};
use sqlx::{any::AnyPoolOptions, AnyPool, Row};

async fn setup_repository() -> (SqliteCodingSessionRepository, AnyPool) {
    sqlx::any::install_default_drivers();
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open realtime event test database");
    sqlx::raw_sql(PROVIDER_AUTHORITY_SCHEMA)
        .execute(&pool)
        .await
        .expect("create provider authority schema");

    sqlx::query(
        "INSERT INTO studio_workspace \
         (id, tenant_id, created_at, updated_at, name, owner_id, status) \
         VALUES (101, 7, '2026-07-16T00:00:00Z', '2026-07-16T00:00:00Z', \
                 'Realtime workspace', 42, 'active')",
    )
    .execute(&pool)
    .await
    .expect("seed workspace");
    for (session_id, user_id) in [("session-1", 42_i64), ("session-2", 43_i64)] {
        sqlx::query(
            "INSERT INTO ai_coding_session \
             (id, tenant_id, user_id, created_at, updated_at, workspace_id, project_id, runtime_location_id, title, \
              status, entry_surface, host_mode, engine_id, model_id) \
             VALUES (?, 7, ?, '2026-07-16T00:00:00Z', '2026-07-16T00:00:00Z', \
                     '101', 'project-1', 'runtime-location-1', 'Realtime session', 'active', 'pc', 'server', \
                     'codex', 'gpt-5-codex')",
        )
        .bind(session_id)
        .bind(user_id)
        .execute(&pool)
        .await
        .expect("seed coding session");
    }
    for (turn_id, session_id, user_id) in [
        ("turn-1", "session-1", 42_i64),
        ("turn-2", "session-2", 43_i64),
    ] {
        sqlx::query(
            "INSERT INTO ai_coding_session_turn \
             (id, tenant_id, user_id, created_at, updated_at, coding_session_id, runtime_id, \
              request_kind, status, input_summary) \
             VALUES (?, 7, ?, '2026-07-16T00:00:00Z', '2026-07-16T00:00:00Z', \
                     ?, ?, 'user_message', 'running', 'realtime request')",
        )
        .bind(turn_id)
        .bind(user_id)
        .bind(session_id)
        .bind(format!("runtime-{turn_id}"))
        .execute(&pool)
        .await
        .expect("seed coding session turn");
    }
    for (turn_id, session_id, user_id) in [
        ("turn-1", "session-1", 42_i64),
        ("turn-2", "session-2", 43_i64),
    ] {
        sqlx::query(
            "INSERT INTO ai_coding_session_operation \
             (id, tenant_id, user_id, created_at, updated_at, coding_session_id, turn_id, \
              status, stream_url, stream_kind, artifact_refs_json) \
             VALUES (?, 7, ?, '2026-07-16T00:00:00Z', '2026-07-16T00:00:00Z', \
                     ?, ?, 'running', '', 'none', '[]')",
        )
        .bind(format!("{turn_id}:operation"))
        .bind(user_id)
        .bind(session_id)
        .bind(turn_id)
        .execute(&pool)
        .await
        .expect("seed coding session operation");
    }

    (SqliteCodingSessionRepository::new(pool.clone()), pool)
}

fn context(user_id: i64) -> CodingSessionContext {
    CodingSessionContext {
        tenant_id: "7".to_owned(),
        organization_id: "0".to_owned(),
        user_id: user_id.to_string(),
        session_id: format!("request-{user_id}"),
    }
}

fn realtime_delta(
    turn_id: &str,
    runtime_id: &str,
    content_delta: &str,
) -> AppendCodingSessionRealtimeEventInput {
    let mut payload = BTreeMap::new();
    payload.insert(
        "contentDelta".to_owned(),
        serde_json::Value::String(content_delta.to_owned()),
    );
    payload.insert(
        "role".to_owned(),
        serde_json::Value::String("assistant".to_owned()),
    );
    AppendCodingSessionRealtimeEventInput {
        turn_id: Some(turn_id.to_owned()),
        runtime_id: Some(runtime_id.to_owned()),
        kind: "message.delta".to_owned(),
        payload,
    }
}

fn canonical_interaction_event(
    turn_id: &str,
    runtime_id: &str,
    source_event_kind: &str,
    interaction_kind: &str,
    interaction_id: Option<&str>,
) -> AppendCodingSessionRealtimeEventInput {
    let mut payload = BTreeMap::new();
    payload.insert(
        "interactionKind".to_owned(),
        serde_json::Value::String(interaction_kind.to_owned()),
    );
    if let Some(interaction_id) = interaction_id {
        payload.insert(
            "interactionId".to_owned(),
            serde_json::Value::String(interaction_id.to_owned()),
        );
    }
    if source_event_kind == "user.question.required" {
        payload.insert(
            "question".to_owned(),
            serde_json::Value::String("Which target should be changed?".to_owned()),
        );
    }
    AppendCodingSessionRealtimeEventInput {
        turn_id: Some(turn_id.to_owned()),
        runtime_id: Some(runtime_id.to_owned()),
        kind: source_event_kind.to_owned(),
        payload,
    }
}

fn user_question_event(
    turn_id: &str,
    runtime_id: &str,
    interaction_id: &str,
) -> AppendCodingSessionRealtimeEventInput {
    canonical_interaction_event(
        turn_id,
        runtime_id,
        "user.question.required",
        "user_question",
        Some(interaction_id),
    )
}

fn approval_required_event(
    turn_id: &str,
    runtime_id: &str,
    interaction_id: &str,
) -> AppendCodingSessionRealtimeEventInput {
    canonical_interaction_event(
        turn_id,
        runtime_id,
        "approval.required",
        "approval",
        Some(interaction_id),
    )
}

async fn seed_checkpoint(pool: &AnyPool, checkpoint_id: &str, session_id: &str, user_id: i64) {
    sqlx::query(
        "INSERT INTO ai_coding_session_checkpoint \
         (id, tenant_id, user_id, created_at, updated_at, coding_session_id, runtime_id, \
          checkpoint_kind, resumable, state_json) \
         VALUES (?, 7, ?, '2026-07-16T00:00:00Z', '2026-07-16T00:00:00Z', ?, \
                 'runtime-turn-1', 'approval', 1, '{}')",
    )
    .bind(checkpoint_id)
    .bind(user_id)
    .bind(session_id)
    .execute(pool)
    .await
    .expect("seed scoped approval checkpoint");
}

struct NoopRealtimeEventPublisher;

#[async_trait]
impl RealtimeEventPublisher for NoopRealtimeEventPublisher {
    async fn publish_workspace_event(
        &self,
        _ctx: &CodingSessionContext,
        _workspace_id: &str,
        _event_kind: &str,
        _payload_json: &str,
    ) -> Result<(), CodingSessionError> {
        Ok(())
    }

    async fn publish_coding_session_event(
        &self,
        _ctx: &CodingSessionContext,
        _event: &CodingSessionRealtimeEventInput,
    ) -> Result<(), CodingSessionError> {
        Ok(())
    }
}

struct StubEngineValidator;

impl EngineValidator for StubEngineValidator {
    fn validate_engine_runtime_profile(
        &self,
        _engine_id: &str,
        _host_mode: &str,
    ) -> Result<AuthoritativeEngineRuntimeProfile, CodingSessionError> {
        Ok(AuthoritativeEngineRuntimeProfile {
            transport_kind: "test".to_owned(),
            capability_snapshot_json: "{}".to_owned(),
        })
    }

    fn validate_engine_model(
        &self,
        _engine_id: &str,
        _model_id: &str,
    ) -> Result<(), CodingSessionError> {
        Ok(())
    }
}

struct UnusedProjectExecutionScopeResolver;

#[async_trait]
impl ProjectExecutionScopeResolver for UnusedProjectExecutionScopeResolver {
    async fn resolve_execution_root(
        &self,
        _context: &CodingSessionContext,
        _workspace_id: &str,
        _project_id: &str,
        _runtime_location_id: &str,
    ) -> Result<std::path::PathBuf, CodingSessionError> {
        Err(CodingSessionError::Internal(
            "project execution scope is not used by interaction tests".to_owned(),
        ))
    }
}

struct BlockingApprovalProvider {
    submit_approval_calls: AtomicUsize,
    entered: tokio::sync::Notify,
    release: tokio::sync::Notify,
    received_interaction_ids: Mutex<Vec<String>>,
}

impl BlockingApprovalProvider {
    fn new() -> Self {
        Self {
            submit_approval_calls: AtomicUsize::new(0),
            entered: tokio::sync::Notify::new(),
            release: tokio::sync::Notify::new(),
            received_interaction_ids: Mutex::new(Vec::new()),
        }
    }
}

#[async_trait]
impl CodeEngineProvider for BlockingApprovalProvider {
    async fn execute_turn(
        &self,
        _ctx: &CodingSessionContext,
        _pending: &PendingProjectionTurnExecution,
    ) -> Result<FinalizedProjectionTurnExecution, CodingSessionError> {
        Err(CodingSessionError::Internal(
            "turn execution is not used by interaction tests".to_owned(),
        ))
    }

    async fn submit_approval(
        &self,
        _ctx: &CodingSessionContext,
        _engine_id: &str,
        _native_session_id: Option<&str>,
        interaction_id: &str,
        _input: &SubmitApprovalDecisionInput,
    ) -> Result<(), CodingSessionError> {
        self.submit_approval_calls.fetch_add(1, Ordering::SeqCst);
        self.received_interaction_ids
            .lock()
            .expect("lock received interaction ids")
            .push(interaction_id.to_owned());
        self.entered.notify_one();
        self.release.notified().await;
        Ok(())
    }

    async fn submit_question_answer(
        &self,
        _ctx: &CodingSessionContext,
        _engine_id: &str,
        _native_session_id: Option<&str>,
        _interaction_id: &str,
        _input: &SubmitUserQuestionAnswerInput,
    ) -> Result<(), CodingSessionError> {
        Err(CodingSessionError::Internal(
            "question submission is not used by approval lease test".to_owned(),
        ))
    }
}

#[tokio::test]
async fn legacy_session_without_runtime_location_fails_closed_before_execution() {
    let (repository, pool) = setup_repository().await;
    sqlx::query("UPDATE ai_coding_session SET runtime_location_id = NULL WHERE id = 'session-1'")
        .execute(&pool)
        .await
        .expect("remove legacy runtime-location binding");

    let service = CodingSessionService::new(
        Arc::new(repository),
        Arc::new(BlockingApprovalProvider::new()),
        Arc::new(NoopRealtimeEventPublisher),
        Arc::new(StubEngineValidator),
        Arc::new(UnusedProjectExecutionScopeResolver),
    );

    let result = service
        .create_turn(
            &context(42),
            "session-1",
            CreateCodingSessionTurnRequest {
                runtime_id: None,
                request_kind: "chat".to_owned(),
                input_summary: "must not execute".to_owned(),
                stream: Some(false),
                ide_context: None,
                options: None,
            },
        )
        .await;

    assert!(
        matches!(result, Err(CodingSessionError::Unavailable(_))),
        "a legacy session must fail closed before execution; got {result:?}"
    );
    let persisted_turn_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_coding_session_turn WHERE coding_session_id = 'session-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("count turns after rejected legacy execution");
    assert_eq!(
        persisted_turn_count, 1,
        "a legacy session must fail before it creates a turn or calls an execution resolver"
    );
}

#[tokio::test]
async fn append_realtime_event_assigns_durable_sequence_and_owner_scope() {
    let (repository, pool) = setup_repository().await;
    let owner = context(42);

    sqlx::query(
        "INSERT INTO ai_coding_session_event \
         (id, tenant_id, user_id, created_at, updated_at, coding_session_id, event_kind, \
          sequence_no, payload_json) \
         VALUES ('foreign-owner-event', 7, 43, '2026-07-16T00:00:00Z', \
                 '2026-07-16T00:00:00Z', 'session-1', 'message.delta', 99, '{}')",
    )
    .execute(&pool)
    .await
    .expect("seed an out-of-scope event with a high sequence");

    let first = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &realtime_delta("turn-1", "runtime-turn-1", "Hello"),
        )
        .await
        .expect("append the first durable delta");
    let second = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &realtime_delta("turn-1", "runtime-turn-1", " world"),
        )
        .await
        .expect("append the second durable delta");

    assert_eq!(first.sequence, 1);
    assert_eq!(second.sequence, 2);
    assert_ne!(first.id, second.id);
    assert!(!first.created_at.is_empty());
    assert!(!second.created_at.is_empty());

    let (visible_events, visible_total) = repository
        .list_events(&owner, "session-1", 0, 10)
        .await
        .expect("list the owner-scoped durable stream");
    assert_eq!(visible_total, 2);
    assert_eq!(
        visible_events
            .iter()
            .map(|event| event.sequence)
            .collect::<Vec<_>>(),
        vec![1, 2],
    );

    let stored = sqlx::query(
        "SELECT tenant_id, user_id, sequence_no, payload_json \
         FROM ai_coding_session_event WHERE id = ?",
    )
    .bind(&second.id)
    .fetch_one(&pool)
    .await
    .expect("load persisted realtime event");
    assert_eq!(stored.get::<i64, _>("tenant_id"), 7);
    assert_eq!(stored.get::<i64, _>("user_id"), 42);
    assert_eq!(stored.get::<i64, _>("sequence_no"), 2);
    assert!(
        stored.get::<String, _>("payload_json").contains(" world"),
        "the canonical payload must be durable before callers publish it",
    );

    let transcript_updated_at = sqlx::query_scalar::<_, Option<String>>(
        "SELECT transcript_updated_at FROM ai_coding_session WHERE id = 'session-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("load transcript freshness");
    assert!(transcript_updated_at.is_some());
}

#[tokio::test]
async fn append_realtime_event_rejects_cross_scope_or_cross_turn_writes_atomically() {
    let (repository, pool) = setup_repository().await;
    let owner = context(42);

    assert!(matches!(
        repository
            .append_realtime_event(
                &context(43),
                "session-1",
                &realtime_delta("turn-1", "runtime-turn-1", "forbidden"),
            )
            .await,
        Err(CodingSessionError::NotFound(_))
    ));
    assert!(matches!(
        repository
            .append_realtime_event(
                &owner,
                "session-1",
                &realtime_delta("turn-2", "runtime-turn-2", "wrong turn"),
            )
            .await,
        Err(CodingSessionError::NotFound(_))
    ));

    let event_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM ai_coding_session_event WHERE coding_session_id = 'session-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("count session events after rejected writes");
    assert_eq!(
        event_count, 0,
        "failed appends must not leave durable events"
    );
    let transcript_updated_at = sqlx::query_scalar::<_, Option<String>>(
        "SELECT transcript_updated_at FROM ai_coding_session WHERE id = 'session-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("load transcript freshness after rejected writes");
    assert!(
        transcript_updated_at.is_none(),
        "failed appends must roll back transcript freshness updates"
    );
}

#[tokio::test]
async fn append_realtime_event_rejects_blank_event_contract_fields_before_writing() {
    let (repository, pool) = setup_repository().await;
    let mut invalid = realtime_delta("turn-1", "runtime-turn-1", "invalid");
    invalid.kind = "  ".to_owned();

    assert!(matches!(
        repository
            .append_realtime_event(&context(42), "session-1", &invalid)
            .await,
        Err(CodingSessionError::InvalidInput(_))
    ));
    let event_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM ai_coding_session_event WHERE coding_session_id = 'session-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("count session events after invalid contract");
    assert_eq!(event_count, 0);
}

#[tokio::test]
async fn finalize_turn_reassigns_provider_projection_event_identity_and_sequence() {
    let (repository, _) = setup_repository().await;
    let owner = context(42);
    repository
        .append_realtime_event(
            &owner,
            "session-1",
            &realtime_delta("turn-1", "runtime-turn-1", "streamed first"),
        )
        .await
        .expect("append a streamed event before finalization");

    let mut payload = BTreeMap::new();
    payload.insert(
        "content".to_owned(),
        serde_json::Value::String("streamed first and completed".to_owned()),
    );
    let persisted = repository
        .finalize_turn_execution(
            &owner,
            "session-1",
            &FinalizedProjectionTurnExecution {
                turn: CodingSessionTurnPayload {
                    id: "turn-1".to_owned(),
                    coding_session_id: "session-1".to_owned(),
                    runtime_id: Some("runtime-turn-1".to_owned()),
                    request_kind: "user_message".to_owned(),
                    status: "completed".to_owned(),
                    input_summary: "finalize realtime stream".to_owned(),
                    started_at: Some("2026-07-16T00:00:01Z".to_owned()),
                    completed_at: Some("2026-07-16T00:00:02Z".to_owned()),
                },
                events: vec![CodingSessionEventPayload {
                    id: "provider-controlled-id".to_owned(),
                    coding_session_id: "session-1".to_owned(),
                    turn_id: Some("turn-1".to_owned()),
                    runtime_id: Some("runtime-turn-1".to_owned()),
                    kind: "message.completed".to_owned(),
                    sequence: 1,
                    payload,
                    created_at: "2000-01-01T00:00:00Z".to_owned(),
                }],
                native_session_id: None,
            },
        )
        .await
        .expect("finalize stream with a durable terminal event");

    assert_eq!(persisted.events.len(), 1);
    let terminal = &persisted.events[0];
    assert_eq!(terminal.sequence, 2);
    assert_ne!(terminal.id, "provider-controlled-id");
    assert_ne!(terminal.created_at, "2000-01-01T00:00:00Z");
    assert_eq!(persisted.turn.status, "completed");

    let (events, total) = repository
        .list_events(&owner, "session-1", 0, 10)
        .await
        .expect("read the durable event stream");
    assert_eq!(total, 2);
    assert_eq!(events[0].sequence, 1);
    assert_eq!(events[1].sequence, 2);
    assert_eq!(events[1].id, terminal.id);
}

#[tokio::test]
async fn durable_interaction_resolution_rejects_wrong_scope_kind_and_payload() {
    let (repository, pool) = setup_repository().await;
    let owner = context(42);
    let question = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &user_question_event("turn-1", "runtime-turn-1", "provider-question-resolve"),
        )
        .await
        .expect("persist canonical user question");
    let approval = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &approval_required_event("turn-1", "runtime-turn-1", "provider-approval-resolve"),
        )
        .await
        .expect("persist canonical approval");

    let resolved_question = repository
        .resolve_durable_interaction(
            &owner,
            "session-1",
            &question.id,
            CodingSessionInteractionKind::UserQuestion,
        )
        .await
        .expect("resolve canonical user question");
    assert_eq!(resolved_question.event_id, question.id);
    assert_eq!(
        resolved_question.interaction_id,
        "provider-question-resolve"
    );
    assert_eq!(resolved_question.turn_id, "turn-1");
    assert_eq!(resolved_question.runtime_id, "runtime-turn-1");

    let resolved_approval = repository
        .resolve_durable_interaction(
            &owner,
            "session-1",
            &approval.id,
            CodingSessionInteractionKind::Approval,
        )
        .await
        .expect("resolve canonical approval");
    assert_eq!(resolved_approval.event_id, approval.id);
    assert_eq!(
        resolved_approval.interaction_id,
        "provider-approval-resolve"
    );

    assert!(matches!(
        repository
            .resolve_durable_interaction(
                &context(43),
                "session-1",
                &question.id,
                CodingSessionInteractionKind::UserQuestion,
            )
            .await,
        Err(CodingSessionError::NotFound(_))
    ));
    assert!(matches!(
        repository
            .resolve_durable_interaction(
                &owner,
                "session-1",
                &question.id,
                CodingSessionInteractionKind::Approval,
            )
            .await,
        Err(CodingSessionError::NotFound(_))
    ));

    let missing_interaction_id = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &canonical_interaction_event(
                "turn-1",
                "runtime-turn-1",
                "user.question.required",
                "user_question",
                None,
            ),
        )
        .await
        .expect("persist malformed user question for resolver test");
    assert!(matches!(
        repository
            .resolve_durable_interaction(
                &owner,
                "session-1",
                &missing_interaction_id.id,
                CodingSessionInteractionKind::UserQuestion,
            )
            .await,
        Err(CodingSessionError::Conflict(_))
    ));

    let mismatched_interaction_kind = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &canonical_interaction_event(
                "turn-1",
                "runtime-turn-1",
                "approval.required",
                "user_question",
                Some("provider-wrong-kind"),
            ),
        )
        .await
        .expect("persist mismatched approval payload for resolver test");
    assert!(matches!(
        repository
            .resolve_durable_interaction(
                &owner,
                "session-1",
                &mismatched_interaction_kind.id,
                CodingSessionInteractionKind::Approval,
            )
            .await,
        Err(CodingSessionError::Conflict(_))
    ));

    let malformed_payload = serde_json::json!({
        "interactionId": "provider-missing-turn",
        "interactionKind": "user_question"
    })
    .to_string();
    sqlx::query(
        "INSERT INTO ai_coding_session_event \
         (id, tenant_id, user_id, created_at, updated_at, coding_session_id, turn_id, runtime_id, \
          event_kind, sequence_no, payload_json) \
         VALUES ('malformed-turn-source', 7, 42, '2026-07-16T00:00:00Z', \
                 '2026-07-16T00:00:00Z', 'session-1', NULL, NULL, \
                 'user.question.required', 999, ?)",
    )
    .bind(malformed_payload)
    .execute(&pool)
    .await
    .expect("insert malformed persisted interaction row");
    assert!(matches!(
        repository
            .resolve_durable_interaction(
                &owner,
                "session-1",
                "malformed-turn-source",
                CodingSessionInteractionKind::UserQuestion,
            )
            .await,
        Err(CodingSessionError::Conflict(_))
    ));
}

#[tokio::test]
async fn interaction_claim_release_is_owner_scoped_and_retryable() {
    let (repository, _) = setup_repository().await;
    let owner = context(42);
    let question = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &user_question_event("turn-1", "runtime-turn-1", "provider-question-claim"),
        )
        .await
        .expect("persist claimable question");
    let first_claim = repository
        .claim_durable_interaction(
            &owner,
            "session-1",
            &question.id,
            CodingSessionInteractionKind::UserQuestion,
        )
        .await
        .expect("claim question");

    repository
        .release_durable_interaction_claim(
            &owner,
            "session-1",
            &question.id,
            CodingSessionInteractionKind::UserQuestion,
            "not-the-owner",
        )
        .await
        .expect("a non-owner release is a no-op");
    assert!(matches!(
        repository
            .claim_durable_interaction(
                &owner,
                "session-1",
                &question.id,
                CodingSessionInteractionKind::UserQuestion,
            )
            .await,
        Err(CodingSessionError::Conflict(_))
    ));

    repository
        .release_durable_interaction_claim(
            &owner,
            "session-1",
            &question.id,
            CodingSessionInteractionKind::UserQuestion,
            &first_claim.claim_id,
        )
        .await
        .expect("release owned claim after a definite provider rejection");
    let retry_claim = repository
        .claim_durable_interaction(
            &owner,
            "session-1",
            &question.id,
            CodingSessionInteractionKind::UserQuestion,
        )
        .await
        .expect("claim can be retried after owner release");
    assert_ne!(retry_claim.claim_id, first_claim.claim_id);
    assert_eq!(
        retry_claim.interaction.interaction_id,
        "provider-question-claim"
    );
}

#[tokio::test]
async fn expired_interaction_claim_is_fenced_before_settlement() {
    let (repository, pool) = setup_repository().await;
    let owner = context(42);
    let question = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &user_question_event("turn-1", "runtime-turn-1", "provider-question-expired"),
        )
        .await
        .expect("persist claimable question");
    let expired_claim = repository
        .claim_durable_interaction(
            &owner,
            "session-1",
            &question.id,
            CodingSessionInteractionKind::UserQuestion,
        )
        .await
        .expect("claim question before expiring its lease");

    let payload_json: String =
        sqlx::query_scalar("SELECT payload_json FROM ai_coding_session_event WHERE id = ?")
            .bind(&question.id)
            .fetch_one(&pool)
            .await
            .expect("load claimed interaction payload");
    let mut payload: serde_json::Value =
        serde_json::from_str(&payload_json).expect("parse claimed interaction payload");
    payload["claimedAt"] = serde_json::json!("1999-01-01T00:00:00Z");
    payload["claimExpiresAt"] = serde_json::json!("2000-01-01T00:00:00Z");
    sqlx::query(
        "UPDATE ai_coding_session_event SET payload_json = ?, version = version + 1 WHERE id = ?",
    )
    .bind(payload.to_string())
    .bind(&question.id)
    .execute(&pool)
    .await
    .expect("expire interaction claim fixture");

    assert!(matches!(
        repository
            .submit_user_question_answer(
                &owner,
                "session-1",
                &question.id,
                &expired_claim.claim_id,
                &SubmitUserQuestionAnswerInput {
                    answer: Some("Do not accept a stale fence".to_owned()),
                    option_id: None,
                    option_label: None,
                    rejected: false,
                },
            )
            .await,
        Err(CodingSessionError::Conflict(_))
    ));
    let recovered_claim = repository
        .claim_durable_interaction(
            &owner,
            "session-1",
            &question.id,
            CodingSessionInteractionKind::UserQuestion,
        )
        .await
        .expect("an expired claim can be recovered with a new fence");
    assert_ne!(recovered_claim.claim_id, expired_claim.claim_id);
}

#[tokio::test]
async fn public_event_projections_hide_internal_interaction_claim_metadata() {
    let (repository, _) = setup_repository().await;
    let owner = context(42);
    let question = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &user_question_event("turn-1", "runtime-turn-1", "provider-question-private"),
        )
        .await
        .expect("persist claimable question");
    let _claim = repository
        .claim_durable_interaction(
            &owner,
            "session-1",
            &question.id,
            CodingSessionInteractionKind::UserQuestion,
        )
        .await
        .expect("claim question");

    let (listed_events, _) = repository
        .list_events(&owner, "session-1", 0, 10)
        .await
        .expect("list public events");
    let listed_question = listed_events
        .iter()
        .find(|event| event.id == question.id)
        .expect("find claimed question in public list");
    for field in [
        "claimId",
        "claimedAt",
        "claimExpiresAt",
        "releasedClaimId",
        "releasedAt",
        "settledClaimId",
    ] {
        assert!(
            !listed_question.payload.contains_key(field),
            "public list must not expose internal {field}"
        );
    }

    let replay_page = repository
        .replay_events(&owner, "session-1", None, None, 10)
        .await
        .expect("replay public events");
    let replayed_question = replay_page
        .events
        .iter()
        .find(|event| event.id == question.id)
        .expect("find claimed question in replay page");
    assert!(!replayed_question.payload.contains_key("claimId"));
    assert!(!replayed_question.payload.contains_key("claimExpiresAt"));
}

#[tokio::test]
async fn replay_events_use_keyset_pages_with_a_fixed_high_watermark() {
    let (repository, _) = setup_repository().await;
    let owner = context(42);
    let empty_page = repository
        .replay_events(&owner, "session-1", Some(0), None, 2)
        .await
        .expect("sequence zero is the valid cursor before the first event");
    assert!(empty_page.events.is_empty());
    assert_eq!(empty_page.high_watermark, None);
    assert!(!empty_page.has_more);
    assert!(matches!(
        repository
            .replay_events(&owner, "session-1", Some(1), None, 2)
            .await,
        Err(CodingSessionError::InvalidInput(_))
    ));

    for delta in ["one", "two", "three", "four", "five"] {
        repository
            .append_realtime_event(
                &owner,
                "session-1",
                &realtime_delta("turn-1", "runtime-turn-1", delta),
            )
            .await
            .expect("append durable replay fixture event");
    }

    let first_page = repository
        .replay_events(&owner, "session-1", None, None, 2)
        .await
        .expect("read first replay page");
    assert_eq!(first_page.high_watermark, Some(5));
    assert!(first_page.has_more);
    assert_eq!(
        first_page
            .events
            .iter()
            .map(|event| event.sequence)
            .collect::<Vec<_>>(),
        vec![1, 2]
    );

    repository
        .append_realtime_event(
            &owner,
            "session-1",
            &realtime_delta("turn-1", "runtime-turn-1", "six after snapshot"),
        )
        .await
        .expect("append event after replay snapshot");
    let second_page = repository
        .replay_events(&owner, "session-1", Some(2), first_page.high_watermark, 2)
        .await
        .expect("read second fixed-window replay page");
    assert_eq!(second_page.high_watermark, Some(5));
    assert!(second_page.has_more);
    assert_eq!(
        second_page
            .events
            .iter()
            .map(|event| event.sequence)
            .collect::<Vec<_>>(),
        vec![3, 4]
    );

    let third_page = repository
        .replay_events(&owner, "session-1", Some(4), first_page.high_watermark, 2)
        .await
        .expect("read final fixed-window replay page");
    assert_eq!(third_page.high_watermark, Some(5));
    assert!(!third_page.has_more);
    assert_eq!(
        third_page
            .events
            .iter()
            .map(|event| event.sequence)
            .collect::<Vec<_>>(),
        vec![5]
    );
    assert!(matches!(
        repository
            .replay_events(&owner, "session-1", Some(6), Some(5), 2)
            .await,
        Err(CodingSessionError::InvalidInput(_))
    ));
}

#[tokio::test]
async fn interaction_mutations_commit_with_scoped_checkpoint_projection() {
    let (repository, pool) = setup_repository().await;
    let owner = context(42);
    seed_checkpoint(&pool, "provider-approval-1", "session-1", 42).await;

    let question = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &user_question_event("turn-1", "runtime-turn-1", "provider-question-1"),
        )
        .await
        .expect("persist the original user-question event");
    assert_eq!(question.sequence, 1);

    let approval_source = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &approval_required_event("turn-1", "runtime-turn-1", "provider-approval-1"),
        )
        .await
        .expect("persist the original approval event");
    assert_eq!(approval_source.sequence, 2);
    let approval_claim = repository
        .claim_durable_interaction(
            &owner,
            "session-1",
            &approval_source.id,
            CodingSessionInteractionKind::Approval,
        )
        .await
        .expect("claim the canonical approval event");
    assert_eq!(
        approval_claim.interaction.interaction_id,
        "provider-approval-1"
    );

    let approval = repository
        .submit_approval_decision(
            &owner,
            "session-1",
            &approval_source.id,
            &approval_claim.claim_id,
            &SubmitApprovalDecisionInput {
                decision: "approved".to_owned(),
                reason: Some("within project scope".to_owned()),
            },
        )
        .await
        .expect("commit approval and durable event together");
    assert_eq!(approval.event.sequence, 3);
    assert_eq!(approval.event.kind, "operation.updated");
    assert_eq!(approval.payload.checkpoint_id, approval_source.id);
    assert_eq!(approval.payload.approval_id, approval_source.id);
    assert_eq!(approval.payload.turn_id.as_deref(), Some("turn-1"));
    assert_eq!(
        approval.payload.runtime_id.as_deref(),
        Some("runtime-turn-1")
    );
    assert_eq!(
        approval
            .event
            .payload
            .get("checkpointId")
            .and_then(serde_json::Value::as_str),
        Some(approval_source.id.as_str())
    );
    assert_eq!(
        approval
            .event
            .payload
            .get("interactionEventId")
            .and_then(serde_json::Value::as_str),
        Some(approval_source.id.as_str())
    );
    assert_eq!(
        approval
            .event
            .payload
            .get("interactionId")
            .and_then(serde_json::Value::as_str),
        Some("provider-approval-1")
    );
    let checkpoint_state: String = sqlx::query_scalar(
        "SELECT state_json FROM ai_coding_session_checkpoint WHERE id = 'provider-approval-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("load settled approval checkpoint state");
    let checkpoint_state: serde_json::Value =
        serde_json::from_str(&checkpoint_state).expect("parse settled approval checkpoint state");
    let checkpoint_approval = checkpoint_state
        .get("approvals")
        .and_then(serde_json::Value::as_array)
        .and_then(|approvals| approvals.first())
        .expect("approval checkpoint contains the settled interaction");
    assert_eq!(
        checkpoint_approval
            .get("approvalId")
            .and_then(serde_json::Value::as_str),
        Some(approval_source.id.as_str())
    );
    assert_eq!(
        checkpoint_approval
            .get("interactionId")
            .and_then(serde_json::Value::as_str),
        Some("provider-approval-1")
    );

    let question_claim = repository
        .claim_durable_interaction(
            &owner,
            "session-1",
            &question.id,
            CodingSessionInteractionKind::UserQuestion,
        )
        .await
        .expect("claim the canonical user-question event");
    assert_eq!(
        question_claim.interaction.interaction_id,
        "provider-question-1"
    );

    let answer = repository
        .submit_user_question_answer(
            &owner,
            "session-1",
            &question.id,
            &question_claim.claim_id,
            &SubmitUserQuestionAnswerInput {
                answer: Some("Update the workspace configuration.".to_owned()),
                option_id: None,
                option_label: None,
                rejected: false,
            },
        )
        .await
        .expect("commit answer and durable event together");
    assert_eq!(answer.event.sequence, 4);
    assert_eq!(answer.event.kind, "operation.updated");
    assert_eq!(answer.payload.question_id, question.id);
    assert_eq!(answer.payload.turn_id.as_deref(), Some("turn-1"));
    assert_eq!(answer.payload.runtime_id.as_deref(), Some("runtime-turn-1"));
    assert_eq!(
        answer
            .event
            .payload
            .get("interactionEventId")
            .and_then(serde_json::Value::as_str),
        Some(question.id.as_str())
    );
    assert_eq!(
        answer
            .event
            .payload
            .get("interactionId")
            .and_then(serde_json::Value::as_str),
        Some("provider-question-1")
    );

    let event_owner =
        sqlx::query("SELECT tenant_id, user_id FROM ai_coding_session_event WHERE id = ?")
            .bind(&answer.event.id)
            .fetch_one(&pool)
            .await
            .expect("load atomic answer event owner");
    assert_eq!(event_owner.get::<i64, _>("tenant_id"), 7);
    assert_eq!(event_owner.get::<i64, _>("user_id"), 42);

    let question_payload: String =
        sqlx::query_scalar("SELECT payload_json FROM ai_coding_session_event WHERE id = ?")
            .bind(&question.id)
            .fetch_one(&pool)
            .await
            .expect("load answered question payload");
    assert!(question_payload.contains("Update the workspace configuration."));
    assert!(question_payload.contains("settledAt"));
    assert!(!question_payload.contains("claimExpiresAt"));

    let (events, total) = repository
        .list_events(&owner, "session-1", 0, 10)
        .await
        .expect("read the atomic mutation stream");
    assert_eq!(total, 4);
    assert_eq!(
        events
            .iter()
            .map(|event| event.sequence)
            .collect::<Vec<_>>(),
        vec![1, 2, 3, 4]
    );

    assert!(matches!(
        repository
            .claim_durable_interaction(
                &context(43),
                "session-1",
                &approval_source.id,
                CodingSessionInteractionKind::Approval,
            )
            .await,
        Err(CodingSessionError::NotFound(_))
    ));
    assert!(matches!(
        repository
            .claim_durable_interaction(
                &owner,
                "session-1",
                &question.id,
                CodingSessionInteractionKind::UserQuestion,
            )
            .await,
        Err(CodingSessionError::Conflict(_))
    ));
    let event_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_coding_session_event WHERE coding_session_id = 'session-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("count events after rejected cross-user mutation");
    assert_eq!(event_count, 4);
}

#[tokio::test]
async fn approval_event_insert_failure_rolls_back_checkpoint_source_event_and_session_changes() {
    let (repository, pool) = setup_repository().await;
    let owner = context(42);
    seed_checkpoint(&pool, "provider-approval-rollback", "session-1", 42).await;
    let approval_source = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &approval_required_event("turn-1", "runtime-turn-1", "provider-approval-rollback"),
        )
        .await
        .expect("persist approval source event before simulating a failure");
    let approval_claim = repository
        .claim_durable_interaction(
            &owner,
            "session-1",
            &approval_source.id,
            CodingSessionInteractionKind::Approval,
        )
        .await
        .expect("claim approval source event before simulating a failure");
    let source_payload_before: String =
        sqlx::query_scalar("SELECT payload_json FROM ai_coding_session_event WHERE id = ?")
            .bind(&approval_source.id)
            .fetch_one(&pool)
            .await
            .expect("load claimed approval source payload");
    let checkpoint_state_before: String = sqlx::query_scalar(
        "SELECT state_json FROM ai_coding_session_checkpoint WHERE id = 'provider-approval-rollback'",
    )
    .fetch_one(&pool)
    .await
    .expect("load checkpoint state before rejected approval");
    let session_version_before: i64 =
        sqlx::query_scalar("SELECT version FROM ai_coding_session WHERE id = 'session-1'")
            .fetch_one(&pool)
            .await
            .expect("load session version before rejected approval");
    sqlx::query(
        "CREATE TRIGGER reject_approval_operation_event \
         BEFORE INSERT ON ai_coding_session_event \
         WHEN NEW.event_kind = 'operation.updated' \
         BEGIN SELECT RAISE(ABORT, 'simulate durable event insert failure'); END",
    )
    .execute(&pool)
    .await
    .expect("install approval failure trigger");

    assert!(
        repository
            .submit_approval_decision(
                &owner,
                "session-1",
                &approval_source.id,
                &approval_claim.claim_id,
                &SubmitApprovalDecisionInput {
                    decision: "approved".to_owned(),
                    reason: None,
                },
            )
            .await
            .is_err(),
        "the transaction must fail when its durable event cannot be inserted"
    );

    let event_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_coding_session_event WHERE coding_session_id = 'session-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("count rejected approval events");
    assert_eq!(event_count, 1);
    let source_payload_after: String =
        sqlx::query_scalar("SELECT payload_json FROM ai_coding_session_event WHERE id = ?")
            .bind(&approval_source.id)
            .fetch_one(&pool)
            .await
            .expect("load approval source after rejected operation event");
    assert_eq!(source_payload_after, source_payload_before);
    let checkpoint_state_after: String = sqlx::query_scalar(
        "SELECT state_json FROM ai_coding_session_checkpoint WHERE id = 'provider-approval-rollback'",
    )
    .fetch_one(&pool)
    .await
    .expect("load checkpoint state after rejected approval");
    assert_eq!(checkpoint_state_after, checkpoint_state_before);
    let session_version_after: i64 =
        sqlx::query_scalar("SELECT version FROM ai_coding_session WHERE id = 'session-1'")
            .fetch_one(&pool)
            .await
            .expect("load session version after rejected approval");
    assert_eq!(session_version_after, session_version_before);
}

#[tokio::test]
async fn question_answer_event_insert_failure_rolls_back_question_payload() {
    let (repository, pool) = setup_repository().await;
    let owner = context(42);
    let question = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &user_question_event("turn-1", "runtime-turn-1", "provider-question-rollback"),
        )
        .await
        .expect("persist the question before simulating a failure");
    let question_claim = repository
        .claim_durable_interaction(
            &owner,
            "session-1",
            &question.id,
            CodingSessionInteractionKind::UserQuestion,
        )
        .await
        .expect("claim the question before simulating a failure");
    let payload_before: String =
        sqlx::query_scalar("SELECT payload_json FROM ai_coding_session_event WHERE id = ?")
            .bind(&question.id)
            .fetch_one(&pool)
            .await
            .expect("load question payload before answer");
    sqlx::query(
        "CREATE TRIGGER reject_answer_operation_event \
         BEFORE INSERT ON ai_coding_session_event \
         WHEN NEW.event_kind = 'operation.updated' \
         BEGIN SELECT RAISE(ABORT, 'simulate durable event insert failure'); END",
    )
    .execute(&pool)
    .await
    .expect("install answer failure trigger");

    assert!(
        repository
            .submit_user_question_answer(
                &owner,
                "session-1",
                &question.id,
                &question_claim.claim_id,
                &SubmitUserQuestionAnswerInput {
                    answer: Some("This answer must not be partially committed.".to_owned()),
                    option_id: None,
                    option_label: None,
                    rejected: false,
                },
            )
            .await
            .is_err(),
        "the question payload update must roll back with its durable event"
    );

    let payload_after: String =
        sqlx::query_scalar("SELECT payload_json FROM ai_coding_session_event WHERE id = ?")
            .bind(&question.id)
            .fetch_one(&pool)
            .await
            .expect("load question payload after rejected answer");
    assert_eq!(payload_after, payload_before);
    let event_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_coding_session_event WHERE coding_session_id = 'session-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("count events after rejected answer");
    assert_eq!(event_count, 1);
}

#[tokio::test]
async fn interaction_claim_allows_only_one_concurrent_provider_submission() {
    let (repository, pool) = setup_repository().await;
    let owner = context(42);
    seed_checkpoint(&pool, "provider-approval-once", "session-1", 42).await;
    let approval_source = repository
        .append_realtime_event(
            &owner,
            "session-1",
            &approval_required_event("turn-1", "runtime-turn-1", "provider-approval-once"),
        )
        .await
        .expect("persist approval source event");
    let approval_source_id = approval_source.id.clone();

    let provider = Arc::new(BlockingApprovalProvider::new());
    let service = Arc::new(CodingSessionService::new(
        Arc::new(repository),
        provider.clone(),
        Arc::new(NoopRealtimeEventPublisher),
        Arc::new(StubEngineValidator),
        Arc::new(UnusedProjectExecutionScopeResolver),
    ));

    let provider_entered = provider.entered.notified();
    let first_service = service.clone();
    let first_source_id = approval_source_id.clone();
    let first = tokio::spawn(async move {
        let context = context(42);
        first_service
            .submit_approval_decision(
                &context,
                "session-1",
                &first_source_id,
                SubmitApprovalDecisionRequest {
                    decision: "approved".to_owned(),
                    reason: None,
                },
            )
            .await
    });
    provider_entered.await;

    let second = service
        .submit_approval_decision(
            &owner,
            "session-1",
            &approval_source_id,
            SubmitApprovalDecisionRequest {
                decision: "approved".to_owned(),
                reason: None,
            },
        )
        .await;
    assert!(matches!(second, Err(CodingSessionError::Conflict(_))));
    assert_eq!(provider.submit_approval_calls.load(Ordering::SeqCst), 1);

    provider.release.notify_one();
    let first_payload = first
        .await
        .expect("first provider task completes")
        .expect("first claimed approval settles successfully");
    assert_eq!(first_payload.checkpoint_id, approval_source_id);
    assert_eq!(provider.submit_approval_calls.load(Ordering::SeqCst), 1);
    assert_eq!(
        provider
            .received_interaction_ids
            .lock()
            .expect("lock received interaction ids")
            .as_slice(),
        ["provider-approval-once"]
    );
}
