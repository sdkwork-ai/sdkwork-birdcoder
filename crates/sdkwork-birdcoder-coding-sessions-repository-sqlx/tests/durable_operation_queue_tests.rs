use sdkwork_birdcoder_coding_sessions_repository_sqlx::db::schema::PROVIDER_AUTHORITY_SCHEMA;
use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use std::collections::BTreeMap;

use sdkwork_birdcoder_coding_sessions_service::domain::commands::AppendCodingSessionRealtimeEventInput;
use sdkwork_birdcoder_coding_sessions_service::domain::models::{
    ClaimCodingSessionOperationInput, CompleteCodingSessionOperationInput,
    EnqueueCodingSessionOperationInput, FailCodingSessionOperationInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    CodingSessionEventPayload, CodingSessionTurnPayload, FinalizedProjectionTurnExecution,
};
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use sqlx::{any::AnyPoolOptions, AnyPool, Row};

async fn setup_repository() -> (SqliteCodingSessionRepository, AnyPool) {
    sqlx::any::install_default_drivers();
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open durable operation database");
    sqlx::raw_sql(PROVIDER_AUTHORITY_SCHEMA)
        .execute(&pool)
        .await
        .expect("create provider authority schema");
    sqlx::query(
        "INSERT INTO studio_workspace \
         (id, tenant_id, created_at, updated_at, name, owner_id, status) \
         VALUES (101, 7, '2026-07-11T00:00:00Z', '2026-07-11T00:00:00Z', \
                 'Queue workspace', 42, 'active')",
    )
    .execute(&pool)
    .await
    .expect("seed workspace");
    for (session_id, user_id) in [("session-1", 42_i64), ("session-2", 43_i64)] {
        sqlx::query(
            "INSERT INTO ai_coding_session \
             (id, tenant_id, user_id, created_at, updated_at, workspace_id, project_id, runtime_location_id, title, \
              status, entry_surface, host_mode, engine_id, model_id) \
             VALUES (?, 7, ?, '2026-07-11T00:00:00Z', '2026-07-11T00:00:00Z', \
                     '101', 'project-1', 'runtime-location-1', 'Queue session', 'active', 'pc', 'server', \
                     'codex', 'gpt-5-codex')",
        )
        .bind(session_id)
        .bind(user_id)
        .execute(&pool)
        .await
        .expect("seed session");
    }
    for (turn_id, session_id, user_id) in [
        ("turn-1", "session-1", 42_i64),
        ("turn-2", "session-1", 42_i64),
        ("turn-3", "session-2", 43_i64),
    ] {
        sqlx::query(
            "INSERT INTO ai_coding_session_turn \
             (id, tenant_id, user_id, created_at, updated_at, coding_session_id, runtime_id, \
              request_kind, status, input_summary) \
             VALUES (?, 7, ?, '2026-07-11T00:00:00Z', '2026-07-11T00:00:00Z', \
                     ?, ?, 'user_message', 'queued', 'durable request')",
        )
        .bind(turn_id)
        .bind(user_id)
        .bind(session_id)
        .bind(format!("runtime-{turn_id}"))
        .execute(&pool)
        .await
        .expect("seed turn");
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

fn enqueue_input(
    operation_id: &str,
    session_id: &str,
    turn_id: &str,
    idempotency_key: &str,
    fingerprint: &str,
    max_attempt: i64,
) -> EnqueueCodingSessionOperationInput {
    EnqueueCodingSessionOperationInput {
        operation_id: operation_id.to_owned(),
        coding_session_id: session_id.to_owned(),
        turn_id: turn_id.to_owned(),
        request_payload: serde_json::json!({
            "codingSessionId": session_id,
            "turnId": turn_id,
            "runtimeLocationId": "runtime-location-1",
        }),
        request_fingerprint: fingerprint.to_owned(),
        idempotency_key: idempotency_key.to_owned(),
        available_at: "2026-07-11T00:00:00Z".to_owned(),
        max_attempt,
    }
}

fn claim_input(
    owner: &str,
    runner: &str,
    claimed_at: &str,
    lease_expires_at: &str,
) -> ClaimCodingSessionOperationInput {
    ClaimCodingSessionOperationInput {
        lease_owner: owner.to_owned(),
        runner_id: runner.to_owned(),
        claimed_at: claimed_at.to_owned(),
        lease_expires_at: lease_expires_at.to_owned(),
    }
}

fn finalized_turn(session_id: &str, turn_id: &str) -> FinalizedProjectionTurnExecution {
    FinalizedProjectionTurnExecution {
        turn: CodingSessionTurnPayload {
            id: turn_id.to_owned(),
            coding_session_id: session_id.to_owned(),
            runtime_id: Some(format!("runtime-{turn_id}")),
            request_kind: "user_message".to_owned(),
            status: "completed".to_owned(),
            input_summary: "durable request".to_owned(),
            started_at: Some("2026-07-11T00:00:01Z".to_owned()),
            completed_at: Some("2026-07-11T00:00:02Z".to_owned()),
        },
        events: Vec::new(),
        native_session_id: Some(format!("native-{turn_id}")),
    }
}

fn durable_delta(turn_id: &str, content_delta: &str) -> AppendCodingSessionRealtimeEventInput {
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
        runtime_id: Some(format!("runtime-{turn_id}")),
        kind: "message.delta".to_owned(),
        payload,
    }
}

#[tokio::test]
async fn enqueue_is_idempotent_and_owner_scoped() {
    let (repository, pool) = setup_repository().await;
    let owner = context(42);
    let input = enqueue_input(
        "operation-1",
        "session-1",
        "turn-1",
        "request-1",
        "hash-1",
        3,
    );

    let first = repository
        .enqueue_operation(&owner, &input)
        .await
        .expect("enqueue operation");
    let duplicate = repository
        .enqueue_operation(&owner, &input)
        .await
        .expect("return original operation");
    assert_eq!(duplicate.id, first.id);
    assert_eq!(duplicate.idempotency_key.as_deref(), Some("request-1"));

    let persisted_request_payload: String = sqlx::query_scalar(
        "SELECT request_payload_json FROM ai_coding_session_operation WHERE id = ?",
    )
    .bind(&first.id)
    .fetch_one(&pool)
    .await
    .expect("load durable operation request payload");
    let persisted_request_payload: serde_json::Value =
        serde_json::from_str(&persisted_request_payload)
            .expect("parse durable operation request payload");
    assert_eq!(
        persisted_request_payload["runtimeLocationId"],
        "runtime-location-1"
    );
    assert!(
        persisted_request_payload.get("workingDirectory").is_none(),
        "durable coding-session operations must never persist a filesystem execution path"
    );

    let conflicting = EnqueueCodingSessionOperationInput {
        request_fingerprint: "hash-2".to_owned(),
        ..input
    };
    assert!(matches!(
        repository.enqueue_operation(&owner, &conflicting).await,
        Err(CodingSessionError::Conflict(_))
    ));
    assert!(
        repository
            .get_durable_operation(&context(43), "session-1", &first.id)
            .await
            .is_err(),
        "another user in the tenant must not read the operation"
    );
}

#[tokio::test]
async fn claim_recovery_and_fencing_preserve_single_user_execution() {
    let (repository, pool) = setup_repository().await;
    repository
        .enqueue_operation(
            &context(42),
            &enqueue_input(
                "operation-a",
                "session-1",
                "turn-1",
                "request-a",
                "hash-a",
                2,
            ),
        )
        .await
        .expect("enqueue first user operation");
    repository
        .enqueue_operation(
            &context(42),
            &enqueue_input(
                "operation-b",
                "session-1",
                "turn-2",
                "request-b",
                "hash-b",
                2,
            ),
        )
        .await
        .expect("enqueue second user operation");
    repository
        .enqueue_operation(
            &context(43),
            &enqueue_input(
                "operation-c",
                "session-2",
                "turn-3",
                "request-c",
                "hash-c",
                2,
            ),
        )
        .await
        .expect("enqueue other user operation");

    let first_claim = claim_input(
        "worker-a",
        "runner-a",
        "2026-07-11T00:01:00Z",
        "2026-07-11T00:02:00Z",
    );
    let second_claim = claim_input(
        "worker-b",
        "runner-b",
        "2026-07-11T00:01:00Z",
        "2026-07-11T00:02:00Z",
    );
    let (first, second) = tokio::join!(
        repository.claim_operation(&first_claim),
        repository.claim_operation(&second_claim)
    );
    let first = first
        .expect("first claim")
        .expect("first eligible operation");
    let second = second
        .expect("second claim")
        .expect("second eligible operation");
    let mut claimed = [first, second];
    claimed.sort_by(|left, right| left.id.cmp(&right.id));
    assert_eq!(
        claimed
            .iter()
            .map(|item| item.id.as_str())
            .collect::<Vec<_>>(),
        vec!["operation-a", "operation-c"],
        "one active operation per user must leave operation-b queued"
    );
    assert!(repository
        .claim_operation(&claim_input(
            "worker-extra",
            "runner-extra",
            "2026-07-11T00:01:01Z",
            "2026-07-11T00:02:01Z",
        ))
        .await
        .expect("third claim")
        .is_none());

    let other_user_claim = claimed
        .iter()
        .find(|operation| operation.id == "operation-c")
        .expect("other user claim");
    repository
        .complete_operation(&CompleteCodingSessionOperationInput {
            operation_id: other_user_claim.id.clone(),
            lease_owner: other_user_claim.lease_owner.clone().expect("lease owner"),
            fencing_token: other_user_claim.fencing_token,
            completed_at: "2026-07-11T00:01:10Z".to_owned(),
            finalized: finalized_turn("session-2", "turn-3"),
        })
        .await
        .expect("complete other user operation");

    let original = claimed
        .iter()
        .find(|operation| operation.id == "operation-a")
        .expect("original claim")
        .clone();
    let recovered = repository
        .claim_operation(&claim_input(
            "worker-recovery",
            "runner-recovery",
            "2026-07-11T00:03:00Z",
            "2026-07-11T00:04:00Z",
        ))
        .await
        .expect("recover expired lease")
        .expect("expired operation");
    assert_eq!(recovered.id, original.id);
    assert_eq!(recovered.fencing_token, original.fencing_token + 1);
    assert!(matches!(
        repository
            .complete_operation(&CompleteCodingSessionOperationInput {
                operation_id: original.id.clone(),
                lease_owner: original.lease_owner.clone().expect("original lease owner"),
                fencing_token: original.fencing_token,
                completed_at: "2026-07-11T00:03:01Z".to_owned(),
                finalized: finalized_turn("session-1", "turn-1"),
            })
            .await,
        Err(CodingSessionError::Conflict(_))
    ));
    repository
        .complete_operation(&CompleteCodingSessionOperationInput {
            operation_id: recovered.id.clone(),
            lease_owner: recovered
                .lease_owner
                .clone()
                .expect("recovered lease owner"),
            fencing_token: recovered.fencing_token,
            completed_at: "2026-07-11T00:03:02Z".to_owned(),
            finalized: finalized_turn("session-1", "turn-1"),
        })
        .await
        .expect("complete recovered operation");

    let retry_claim = repository
        .claim_operation(&claim_input(
            "worker-retry",
            "runner-retry",
            "2026-07-11T00:03:10Z",
            "2026-07-11T00:04:10Z",
        ))
        .await
        .expect("claim queued sibling")
        .expect("operation-b");
    assert_eq!(retry_claim.id, "operation-b");
    let retrying = repository
        .fail_operation(&FailCodingSessionOperationInput {
            operation_id: retry_claim.id.clone(),
            lease_owner: retry_claim.lease_owner.clone().expect("retry lease owner"),
            fencing_token: retry_claim.fencing_token,
            failed_at: "2026-07-11T00:03:11Z".to_owned(),
            retry_at: Some("2026-07-11T00:03:20Z".to_owned()),
            problem: serde_json::json!({"code": 50301, "detail": "runner unavailable"}),
        })
        .await
        .expect("schedule retry");
    assert_eq!(retrying.status, "queued");

    let final_claim = repository
        .claim_operation(&claim_input(
            "worker-final",
            "runner-final",
            "2026-07-11T00:03:21Z",
            "2026-07-11T00:04:21Z",
        ))
        .await
        .expect("claim retry")
        .expect("retried operation");
    assert_eq!(final_claim.attempt, 2);
    let failed = repository
        .fail_operation(&FailCodingSessionOperationInput {
            operation_id: final_claim.id.clone(),
            lease_owner: final_claim.lease_owner.clone().expect("final lease owner"),
            fencing_token: final_claim.fencing_token,
            failed_at: "2026-07-11T00:03:22Z".to_owned(),
            retry_at: Some("2026-07-11T00:03:30Z".to_owned()),
            problem: serde_json::json!({"code": 50001, "detail": "attempts exhausted"}),
        })
        .await
        .expect("terminal failure");
    assert_eq!(failed.status, "failed");

    let turn_status: String =
        sqlx::query_scalar("SELECT status FROM ai_coding_session_turn WHERE id = 'turn-2'")
            .fetch_one(&pool)
            .await
            .expect("load failed turn");
    assert_eq!(turn_status, "failed");
    let event = sqlx::query(
        "SELECT event_kind, tenant_id, user_id FROM ai_coding_session_event \
         WHERE coding_session_id = 'session-1' AND turn_id = 'turn-2'",
    )
    .fetch_one(&pool)
    .await
    .expect("load terminal event");
    assert_eq!(event.get::<String, _>("event_kind"), "turn.failed");
    assert_eq!(event.get::<i64, _>("tenant_id"), 7);
    assert_eq!(event.get::<i64, _>("user_id"), 42);
}

#[tokio::test]
async fn complete_operation_rejects_provider_native_session_rebinding() {
    let (repository, pool) = setup_repository().await;
    sqlx::query(
        "UPDATE ai_coding_session SET native_session_id = 'provider-session-1' WHERE id = 'session-1'",
    )
    .execute(&pool)
    .await
    .expect("bind the initial provider-native session");

    repository
        .enqueue_operation(
            &context(42),
            &enqueue_input(
                "operation-native-conflict",
                "session-1",
                "turn-2",
                "request-native-conflict",
                "hash-native-conflict",
                1,
            ),
        )
        .await
        .expect("enqueue native session conflict operation");
    let operation = repository
        .claim_operation(&claim_input(
            "worker-native-conflict",
            "runner-native-conflict",
            "2026-07-11T00:01:00Z",
            "2026-07-11T00:02:00Z",
        ))
        .await
        .expect("claim native session conflict operation")
        .expect("queued operation");

    assert!(matches!(
        repository
            .complete_operation(&CompleteCodingSessionOperationInput {
                operation_id: operation.id,
                lease_owner: operation.lease_owner.expect("lease owner"),
                fencing_token: operation.fencing_token,
                completed_at: "2026-07-11T00:01:10Z".to_owned(),
                finalized: FinalizedProjectionTurnExecution {
                    native_session_id: Some("provider-session-2".to_owned()),
                    ..finalized_turn("session-1", "turn-2")
                },
            })
            .await,
        Err(CodingSessionError::Conflict(_))
    ));

    let persisted_native_session_id: Option<String> = sqlx::query_scalar(
        "SELECT native_session_id FROM ai_coding_session WHERE id = 'session-1'",
    )
    .fetch_one(&pool)
    .await
    .expect("load provider-native session binding");
    assert_eq!(
        persisted_native_session_id.as_deref(),
        Some("provider-session-1"),
        "a durable completion must not rebind a logical coding session to a different provider session",
    );
}

#[tokio::test]
async fn complete_operation_reassigns_worker_event_identity_and_sequence() {
    let (repository, pool) = setup_repository().await;
    let owner = context(42);
    repository
        .append_realtime_event(&owner, "session-1", &durable_delta("turn-1", "first"))
        .await
        .expect("append streamed event before worker completion");
    repository
        .enqueue_operation(
            &owner,
            &enqueue_input(
                "operation-worker-complete",
                "session-1",
                "turn-1",
                "worker-complete-request",
                "worker-complete-fingerprint",
                1,
            ),
        )
        .await
        .expect("enqueue worker completion operation");
    let operation = repository
        .claim_operation(&claim_input(
            "worker-complete",
            "runner-complete",
            "2026-07-11T00:01:00Z",
            "2026-07-11T00:02:00Z",
        ))
        .await
        .expect("claim worker completion operation")
        .expect("queued operation");

    let mut finalized = finalized_turn("session-1", "turn-1");
    finalized.events.push(CodingSessionEventPayload {
        id: "provider-controlled-event-id".to_owned(),
        coding_session_id: "session-1".to_owned(),
        turn_id: Some("turn-1".to_owned()),
        runtime_id: Some("runtime-turn-1".to_owned()),
        kind: "message.completed".to_owned(),
        sequence: usize::MAX,
        payload: BTreeMap::from([(
            "content".to_owned(),
            serde_json::Value::String("completed by worker".to_owned()),
        )]),
        created_at: "not-a-server-timestamp".to_owned(),
    });
    repository
        .complete_operation(&CompleteCodingSessionOperationInput {
            operation_id: operation.id,
            lease_owner: operation.lease_owner.expect("lease owner"),
            fencing_token: operation.fencing_token,
            completed_at: "2026-07-11T00:01:10Z".to_owned(),
            finalized,
        })
        .await
        .expect("complete worker operation with durable terminal event");

    let event = sqlx::query(
        "SELECT id, sequence_no, created_at, tenant_id, user_id \
         FROM ai_coding_session_event \
         WHERE coding_session_id = 'session-1' AND turn_id = 'turn-1' \
           AND event_kind = 'message.completed'",
    )
    .fetch_one(&pool)
    .await
    .expect("load durable worker terminal event");
    assert_ne!(
        event.get::<String, _>("id"),
        "provider-controlled-event-id",
        "worker input must not control durable event identity",
    );
    assert_eq!(event.get::<i64, _>("sequence_no"), 2);
    assert_eq!(
        event.get::<String, _>("created_at"),
        "2026-07-11T00:01:10.000000000Z"
    );
    assert_eq!(event.get::<i64, _>("tenant_id"), 7);
    assert_eq!(event.get::<i64, _>("user_id"), 42);
}

#[tokio::test]
async fn terminal_failure_uses_the_next_durable_sequence_after_a_stream_delta() {
    let (repository, pool) = setup_repository().await;
    let owner = context(42);
    repository
        .append_realtime_event(&owner, "session-1", &durable_delta("turn-2", "first"))
        .await
        .expect("append streamed event before worker failure");
    repository
        .enqueue_operation(
            &owner,
            &enqueue_input(
                "operation-worker-failure",
                "session-1",
                "turn-2",
                "worker-failure-request",
                "worker-failure-fingerprint",
                1,
            ),
        )
        .await
        .expect("enqueue worker failure operation");
    let operation = repository
        .claim_operation(&claim_input(
            "worker-failure",
            "runner-failure",
            "2026-07-11T00:01:00Z",
            "2026-07-11T00:02:00Z",
        ))
        .await
        .expect("claim worker failure operation")
        .expect("queued operation");

    repository
        .fail_operation(&FailCodingSessionOperationInput {
            operation_id: operation.id,
            lease_owner: operation.lease_owner.expect("lease owner"),
            fencing_token: operation.fencing_token,
            failed_at: "2026-07-11T00:01:10Z".to_owned(),
            retry_at: None,
            problem: serde_json::json!({"code": 50001, "detail": "worker failed"}),
        })
        .await
        .expect("fail worker operation terminally");

    let event = sqlx::query(
        "SELECT id, sequence_no, created_at, tenant_id, user_id \
         FROM ai_coding_session_event \
         WHERE coding_session_id = 'session-1' AND turn_id = 'turn-2' \
           AND event_kind = 'turn.failed'",
    )
    .fetch_one(&pool)
    .await
    .expect("load durable worker failure event");
    assert!(
        uuid::Uuid::parse_str(&event.get::<String, _>("id")).is_ok(),
        "the repository must generate durable event identity",
    );
    assert_eq!(event.get::<i64, _>("sequence_no"), 2);
    assert_eq!(
        event.get::<String, _>("created_at"),
        "2026-07-11T00:01:10.000000000Z"
    );
    assert_eq!(event.get::<i64, _>("tenant_id"), 7);
    assert_eq!(event.get::<i64, _>("user_id"), 42);
}
