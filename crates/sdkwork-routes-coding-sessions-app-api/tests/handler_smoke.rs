use std::sync::Arc;

use async_trait::async_trait;
use axum::body::Body;
use axum::http::{Request, StatusCode};
use sdkwork_birdcoder_coding_sessions_repository_sqlx::db::schema::SCHEMA_SQL;
use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::commands::{
    SubmitApprovalDecisionInput, SubmitUserQuestionAnswerInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::models::AuthoritativeEngineRuntimeProfile;
use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    FinalizedProjectionTurnExecution, PendingProjectionTurnExecution,
};
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::ports::engine_validator::EngineValidator;
use sdkwork_birdcoder_coding_sessions_service::ports::events::{
    CodingSessionRealtimeEventInput, RealtimeEventPublisher,
};
use sdkwork_birdcoder_coding_sessions_service::ports::project_execution_scope::ProjectExecutionScopeResolver;
use sdkwork_birdcoder_coding_sessions_service::ports::provider::CodeEngineProvider;
use sdkwork_birdcoder_coding_sessions_service::service::coding_session_service::CodingSessionService;
use sdkwork_birdcoder_workspace_repository_sqlx::db::schema::ALL_TABLES_DDL as WORKSPACE_TABLES_DDL;
use sdkwork_database_config::{DatabaseConfig, DatabaseEngine, DeploymentMode};
use sdkwork_database_sqlx::create_any_pool_from_config;
use sdkwork_iam_context_service::{
    AuthLevel, DeploymentMode as IamDeploymentMode, Environment, IamAppContext,
};
use sdkwork_routes_coding_sessions_app_api::build_coding_sessions_app_api_router;
use sdkwork_routes_coding_sessions_app_api::handlers::CodingSessionsAppState;
use sdkwork_web_core::{
    ServerRequestId, WebApiSurface, WebAuthMode, WebRequestContext, WebTransportFacts,
};
use sqlx::AnyPool;
use tower::ServiceExt;

struct NoopRealtimePublisher;

#[async_trait]
impl RealtimeEventPublisher for NoopRealtimePublisher {
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

#[async_trait]
impl EngineValidator for StubEngineValidator {
    fn validate_engine_runtime_profile(
        &self,
        _engine_id: &str,
        _host_mode: &str,
    ) -> Result<AuthoritativeEngineRuntimeProfile, CodingSessionError> {
        Ok(AuthoritativeEngineRuntimeProfile {
            transport_kind: "stub".to_owned(),
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

struct StubCodeEngineProvider;

#[async_trait]
impl CodeEngineProvider for StubCodeEngineProvider {
    async fn execute_turn(
        &self,
        _ctx: &CodingSessionContext,
        _pending: &PendingProjectionTurnExecution,
    ) -> Result<FinalizedProjectionTurnExecution, CodingSessionError> {
        Err(CodingSessionError::Internal(
            "stub code engine provider".into(),
        ))
    }

    async fn submit_approval(
        &self,
        _ctx: &CodingSessionContext,
        _engine_id: &str,
        _native_session_id: Option<&str>,
        _checkpoint_id: &str,
        _input: &SubmitApprovalDecisionInput,
    ) -> Result<(), CodingSessionError> {
        Ok(())
    }

    async fn submit_question_answer(
        &self,
        _ctx: &CodingSessionContext,
        _engine_id: &str,
        _native_session_id: Option<&str>,
        _question_id: &str,
        _input: &SubmitUserQuestionAnswerInput,
    ) -> Result<(), CodingSessionError> {
        Ok(())
    }
}

struct UnavailableProjectExecutionScopeResolver;

#[async_trait]
impl ProjectExecutionScopeResolver for UnavailableProjectExecutionScopeResolver {
    async fn resolve_execution_root(
        &self,
        _context: &CodingSessionContext,
        _workspace_id: &str,
        _project_id: &str,
        _runtime_location_id: &str,
    ) -> Result<std::path::PathBuf, CodingSessionError> {
        Err(CodingSessionError::Unavailable(
            "test project execution root is unavailable".to_owned(),
        ))
    }
}

fn test_iam_context() -> IamAppContext {
    IamAppContext::new(
        "1",
        None,
        "1",
        "handler-smoke-session",
        "birdcoder",
        Environment::Dev,
        IamDeploymentMode::Local,
        AuthLevel::Password,
        vec![],
        vec![],
    )
}

async fn execute_sql_batch(pool: &AnyPool, sql: &str) -> Result<(), sqlx::Error> {
    for statement in sql
        .split(';')
        .map(str::trim)
        .filter(|part| !part.is_empty())
    {
        sqlx::query(statement).execute(pool).await?;
    }
    Ok(())
}

async fn test_any_pool() -> AnyPool {
    sqlx::any::install_default_drivers();
    create_any_pool_from_config(DatabaseConfig {
        engine: DatabaseEngine::Sqlite,
        url: "sqlite::memory:".to_string(),
        mode: DeploymentMode::Standalone,
        max_connections: 1,
        ..DatabaseConfig::default()
    })
    .await
    .expect("open in-memory sqlite any pool")
}

async fn test_state_with_seeded_workspace(workspace_id: i64) -> CodingSessionsAppState {
    let pool = test_any_pool().await;
    execute_sql_batch(&pool, SCHEMA_SQL)
        .await
        .expect("apply coding sessions schema");
    execute_sql_batch(&pool, WORKSPACE_TABLES_DDL)
        .await
        .expect("apply workspace schema");
    if workspace_id > 0 {
        seed_workspace(&pool, workspace_id).await;
    }

    let repository = Arc::new(SqliteCodingSessionRepository::new(pool));
    let service = CodingSessionService::new(
        repository,
        Arc::new(StubCodeEngineProvider),
        Arc::new(NoopRealtimePublisher),
        Arc::new(StubEngineValidator),
        Arc::new(UnavailableProjectExecutionScopeResolver),
    );

    CodingSessionsAppState {
        service,
        commerce_pool: None,
    }
}

async fn test_state() -> CodingSessionsAppState {
    test_state_with_seeded_workspace(0).await
}

fn with_request_context(mut request: Request<Body>, iam: Option<IamAppContext>) -> Request<Body> {
    let path = request.uri().path().to_owned();
    let method = request.method().as_str().to_owned();
    request.extensions_mut().insert(WebRequestContext {
        request_id: ServerRequestId("handler-smoke-request".to_owned()),
        api_surface: WebApiSurface::AppApi,
        auth_mode: WebAuthMode::DualToken,
        transport: WebTransportFacts {
            path,
            method,
            auth_token_present: true,
            access_token_present: true,
            api_key_present: false,
            oauth_bearer_present: false,
            agent_token_present: false,
        },
        principal: None,
        locale: None,
        client_kind: None,
        operation: None,
        trace_id: None,
        idempotency_key: None,
    });
    if let Some(iam) = iam {
        request.extensions_mut().insert(iam);
    }
    request
}

async fn seed_workspace(pool: &AnyPool, workspace_id: i64) {
    sqlx::query(
        "INSERT INTO studio_workspace (
            id, tenant_id, organization_id, data_scope, created_at, updated_at,
            version, is_deleted, name, owner_id, is_public, is_template, status
        ) VALUES (?, 1, 0, 1, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 0, 0, ?, 1, 0, 0, 'active')",
    )
    .bind(workspace_id)
    .bind(format!("workspace-{workspace_id}"))
    .execute(pool)
    .await
    .expect("seed workspace");
}

#[test]
fn intelligence_router_builds_without_error() {
    let _router = build_coding_sessions_app_api_router();
}

#[test]
fn intelligence_router_state_struct_is_cloneable() {
    fn assert_clone<T: Clone>() {}
    assert_clone::<CodingSessionsAppState>();
}

#[tokio::test]
async fn list_sessions_requires_authentication() {
    let response = build_coding_sessions_app_api_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/intelligence/coding_sessions")
                .body(Body::empty())
                .expect("build list sessions request"),
            None,
        ))
        .await
        .expect("serve list sessions request");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn list_sessions_returns_ok_with_empty_inventory() {
    let response = build_coding_sessions_app_api_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/intelligence/coding_sessions")
                .body(Body::empty())
                .expect("build list sessions request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve list sessions request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read list sessions body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse list sessions JSON");
    assert_eq!(json["code"], 0);
    assert_eq!(json["traceId"], "handler-smoke-request");
    assert_eq!(json["data"]["items"].as_array().map(Vec::len), Some(0));
    assert_eq!(json["data"]["pageInfo"]["mode"], "offset");
    assert_eq!(json["data"]["pageInfo"]["pageSize"], 20);
    assert_eq!(json["data"]["pageInfo"]["page"], 1);
    assert_eq!(json["data"]["pageInfo"]["totalItems"], "0");
}

#[tokio::test]
async fn list_sessions_applies_the_requested_database_page_without_native_scope() {
    let state = test_state_with_seeded_workspace(101).await;
    for _ in 0..3 {
        create_immutable_session(&state).await;
    }

    let response = build_coding_sessions_app_api_router()
        .with_state(state)
        .oneshot(with_request_context(
            Request::builder()
                .uri(
                    "/app/v3/api/intelligence/coding_sessions?page=2&page_size=1&projectId=project-smoke&workspaceId=101",
                )
                .body(Body::empty())
                .expect("build second session page request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve second session page request");

    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read second session page body");
    let json: serde_json::Value =
        serde_json::from_slice(&body).expect("parse second session page JSON");
    assert_eq!(json["data"]["items"].as_array().map(Vec::len), Some(1));
    assert_eq!(json["data"]["pageInfo"]["page"], 2);
    assert_eq!(json["data"]["pageInfo"]["pageSize"], 1);
    assert_eq!(json["data"]["pageInfo"]["totalItems"], "3");
    assert_eq!(json["data"]["pageInfo"]["hasMore"], true);
}

#[tokio::test]
async fn list_sessions_rejects_invalid_page_size_before_accessing_the_repository() {
    let response = build_coding_sessions_app_api_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/intelligence/coding_sessions?page_size=0")
                .body(Body::empty())
                .expect("build invalid list sessions request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve invalid list sessions request");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok()),
        Some("application/problem+json")
    );

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read invalid list sessions body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse invalid list JSON");
    assert_eq!(json["code"], 40003);
    assert_eq!(json["traceId"], "handler-smoke-request");
}

#[tokio::test]
async fn get_session_returns_404_for_nonexistent_id() {
    let response = build_coding_sessions_app_api_router()
        .with_state(test_state().await)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/intelligence/coding_sessions/missing-session")
                .body(Body::empty())
                .expect("build get session request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve get session request");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn create_session_returns_201_with_session_payload() {
    let state = test_state_with_seeded_workspace(101).await;

    let response = build_coding_sessions_app_api_router()
        .with_state(state)
        .oneshot(with_request_context(
            Request::builder()
                .method("POST")
                .uri("/app/v3/api/intelligence/coding_sessions")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "workspaceId": "101",
                        "projectId": "project-smoke",
                        "runtimeLocationId": "runtime-location-smoke",
                        "title": "Handler smoke session",
                        "hostMode": "server",
                        "engineId": "codex",
                        "modelId": "gpt-5-codex",
                    })
                    .to_string(),
                ))
                .expect("build create session request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve create session request");

    assert_eq!(response.status(), StatusCode::CREATED);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read create session body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse create session JSON");
    assert_eq!(json["code"], 0);
    assert_eq!(json["traceId"], "handler-smoke-request");
    assert_eq!(json["data"]["item"]["workspaceId"], "101");
    assert_eq!(json["data"]["item"]["projectId"], "project-smoke");
    assert_eq!(json["data"]["item"]["title"], "Handler smoke session");
}

#[tokio::test]
async fn create_session_rejects_a_missing_runtime_location_id() {
    let response = build_coding_sessions_app_api_router()
        .with_state(test_state_with_seeded_workspace(101).await)
        .oneshot(with_request_context(
            Request::builder()
                .method("POST")
                .uri("/app/v3/api/intelligence/coding_sessions")
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "workspaceId": "101",
                        "projectId": "project-smoke",
                        "title": "Invalid session",
                        "hostMode": "server",
                        "engineId": "codex",
                        "modelId": "gpt-5-codex",
                    })
                    .to_string(),
                ))
                .expect("build invalid create session request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve invalid create session request");

    assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    assert_eq!(
        response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok()),
        Some("application/problem+json")
    );
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read invalid create session body");
    let json: serde_json::Value =
        serde_json::from_slice(&body).expect("parse invalid create session JSON");
    assert_eq!(json["code"], 40001);
    assert_eq!(json["traceId"], "handler-smoke-request");
}

fn coding_session_context() -> CodingSessionContext {
    CodingSessionContext {
        tenant_id: "1".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "1".to_owned(),
        session_id: "handler-smoke-session".to_owned(),
    }
}

async fn create_immutable_session(state: &CodingSessionsAppState) -> String {
    state
        .service
        .create_session(
            &coding_session_context(),
            sdkwork_birdcoder_coding_sessions_service::domain::commands::CreateCodingSessionRequest {
                workspace_id: "101".to_owned(),
                project_id: "project-smoke".to_owned(),
                runtime_location_id: "runtime-location-smoke".to_owned(),
                title: Some("Immutable session".to_owned()),
                host_mode: Some("server".to_owned()),
                engine_id: Some("codex".to_owned()),
                model_id: Some("gpt-5-codex".to_owned()),
            },
        )
        .await
        .expect("create immutable smoke session")
        .id
}

#[tokio::test]
async fn patch_rejects_engine_and_model_overrides_without_mutating_the_session() {
    let state = test_state_with_seeded_workspace(101).await;
    let session_id = create_immutable_session(&state).await;
    let service = state.service.clone();
    let response = build_coding_sessions_app_api_router()
        .with_state(state)
        .oneshot(with_request_context(
            Request::builder()
                .method("PATCH")
                .uri(format!(
                    "/app/v3/api/intelligence/coding_sessions/{session_id}"
                ))
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "title": "attempted update",
                        "engineId": "gemini",
                        "modelId": "gemini-2.5-pro"
                    })
                    .to_string(),
                ))
                .expect("build immutable update request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve immutable update request");

    assert!(
        response.status().is_client_error(),
        "legacy immutable fields must be rejected before update execution"
    );
    let session = service
        .get_session(&coding_session_context(), &session_id)
        .await
        .expect("read unchanged session after rejected update");
    assert_eq!(session.engine_id, "codex");
    assert_eq!(session.model_id, "gpt-5-codex");
}

#[tokio::test]
async fn turn_rejects_engine_and_model_overrides_without_mutating_the_session() {
    let state = test_state_with_seeded_workspace(101).await;
    let session_id = create_immutable_session(&state).await;
    let service = state.service.clone();
    let response = build_coding_sessions_app_api_router()
        .with_state(state)
        .oneshot(with_request_context(
            Request::builder()
                .method("POST")
                .uri(format!(
                    "/app/v3/api/intelligence/coding_sessions/{session_id}/turns"
                ))
                .header("content-type", "application/json")
                .body(Body::from(
                    serde_json::json!({
                        "requestKind": "user_message",
                        "inputSummary": "attempted turn override",
                        "engineId": "gemini",
                        "modelId": "gemini-2.5-pro"
                    })
                    .to_string(),
                ))
                .expect("build immutable turn request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve immutable turn request");

    assert!(
        response.status().is_client_error(),
        "legacy per-turn engine/model fields must be rejected before execution"
    );
    let session = service
        .get_session(&coding_session_context(), &session_id)
        .await
        .expect("read unchanged session after rejected turn");
    assert_eq!(session.engine_id, "codex");
    assert_eq!(session.model_id, "gpt-5-codex");
}
