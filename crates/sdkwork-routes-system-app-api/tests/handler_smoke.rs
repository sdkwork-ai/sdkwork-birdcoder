use axum::body::Body;
use axum::http::{Request, StatusCode};
use sqlx::any::AnyPoolOptions;
use tower::ServiceExt;

use sdkwork_iam_context_service::{AuthLevel, DeploymentMode, Environment, IamAppContext};
use sdkwork_routes_system_app_api::manifest::SYSTEM_APP_API_ROUTES;
use sdkwork_routes_system_app_api::{build_system_app_router, SystemAppState};
use sdkwork_web_core::{
    ServerRequestId, WebApiSurface, WebAuthMode, WebRequestContext, WebTransportFacts,
};

fn test_app() -> axum::Router<SystemAppState> {
    build_system_app_router()
}

fn test_state() -> SystemAppState {
    SystemAppState::new(SYSTEM_APP_API_ROUTES)
}

fn test_iam_context() -> IamAppContext {
    test_iam_context_for_user("handler-smoke-user")
}

fn test_iam_context_for_user(user_id: &str) -> IamAppContext {
    IamAppContext::new(
        "1",
        None,
        user_id,
        "handler-smoke-session",
        "birdcoder",
        Environment::Dev,
        DeploymentMode::Local,
        AuthLevel::Password,
        vec![],
        vec![],
    )
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

#[test]
fn system_router_builds_without_error() {
    let _router = build_system_app_router();
}

#[tokio::test]
async fn system_descriptor_returns_ok() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/system/descriptor")
                .body(Body::empty())
                .expect("build descriptor request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve descriptor request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn system_routes_returns_ok() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/system/routes")
                .body(Body::empty())
                .expect("build routes request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve routes request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn system_runtime_returns_ok() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/system/runtime")
                .body(Body::empty())
                .expect("build runtime request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve runtime request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn system_health_returns_healthy() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/system/health")
                .body(Body::empty())
                .expect("build health request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve health request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn get_operation_returns_not_found_for_unknown_operation() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/operations/op-123")
                .body(Body::empty())
                .expect("build operation request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve operation request");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn get_operation_reads_owned_durable_operation_and_hides_other_users() {
    sqlx::any::install_default_drivers();
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open operation route database");
    for statement in [
        "CREATE TABLE studio_workspace (\
             id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, owner_id INTEGER NOT NULL, \
             is_deleted INTEGER NOT NULL DEFAULT 0\
         )",
        "CREATE TABLE studio_workspace_member (\
             id INTEGER PRIMARY KEY, tenant_id INTEGER NOT NULL, workspace_id INTEGER NOT NULL, \
             user_id INTEGER NOT NULL, status TEXT NOT NULL, \
             is_deleted INTEGER NOT NULL DEFAULT 0\
         )",
        "CREATE TABLE ai_coding_session (\
             id TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, user_id INTEGER NOT NULL, \
             workspace_id TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0\
         )",
        "CREATE TABLE ai_coding_session_operation (\
             id TEXT PRIMARY KEY, tenant_id INTEGER NOT NULL, user_id INTEGER NOT NULL, \
             coding_session_id TEXT NOT NULL, status TEXT NOT NULL, \
             artifact_refs_json TEXT NOT NULL, stream_url TEXT NOT NULL, \
             stream_kind TEXT NOT NULL, is_deleted INTEGER NOT NULL DEFAULT 0\
         )",
    ] {
        sqlx::query(statement)
            .execute(&pool)
            .await
            .expect("create operation route table");
    }
    sqlx::query("INSERT INTO studio_workspace (id, tenant_id, owner_id) VALUES (101, 1, 99)")
        .execute(&pool)
        .await
        .expect("seed operation workspace");
    sqlx::query(
        "INSERT INTO studio_workspace_member \
         (id, tenant_id, workspace_id, user_id, status) VALUES (1, 1, 101, 42, 'active')",
    )
    .execute(&pool)
    .await
    .expect("seed active workspace member");
    sqlx::query(
        "INSERT INTO ai_coding_session \
         (id, tenant_id, user_id, workspace_id) VALUES ('session-1', 1, 42, '101')",
    )
    .execute(&pool)
    .await
    .expect("seed owned coding session");
    sqlx::query(
        "INSERT INTO ai_coding_session_operation \
         (id, tenant_id, user_id, coding_session_id, status, artifact_refs_json, \
          stream_url, stream_kind) \
         VALUES ('turn-1:operation', 1, 42, 'session-1', 'running', \
                 '[\"artifact-1\"]', '', 'none')",
    )
    .execute(&pool)
    .await
    .expect("seed durable operation");

    let state = SystemAppState::with_repository_pool(pool, SYSTEM_APP_API_ROUTES);
    let response = test_app()
        .with_state(state.clone())
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/operations/turn-1:operation")
                .body(Body::empty())
                .expect("build owned operation request"),
            Some(test_iam_context_for_user("42")),
        ))
        .await
        .expect("serve owned operation request");
    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read operation response");
    let payload: serde_json::Value =
        serde_json::from_slice(&body).expect("decode operation response");
    assert_eq!(
        payload["data"]["item"]["operationId"],
        serde_json::json!("turn-1:operation")
    );
    assert_eq!(
        payload["data"]["item"]["artifactRefs"],
        serde_json::json!(["artifact-1"])
    );
    assert!(
        payload["data"]["item"].get("streamKind").is_none(),
        "a missing stream transport must not be advertised as a real SSE/WebSocket stream",
    );

    let other_user_response = test_app()
        .with_state(state)
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/operations/turn-1:operation")
                .body(Body::empty())
                .expect("build cross-user operation request"),
            Some(test_iam_context_for_user("43")),
        ))
        .await
        .expect("serve cross-user operation request");
    assert_eq!(other_user_response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn system_routes_returns_all_registered_paths() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/system/routes")
                .body(Body::empty())
                .expect("build routes request"),
            Some(test_iam_context()),
        ))
        .await
        .expect("serve routes request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn nonexistent_route_returns_404() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(
            Request::builder()
                .uri("/nonexistent/path")
                .body(Body::empty())
                .expect("build nonexistent request"),
        )
        .await
        .expect("serve nonexistent request");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn system_descriptor_requires_authentication() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/system/descriptor")
                .body(Body::empty())
                .expect("build descriptor request"),
            None,
        ))
        .await
        .expect("serve descriptor request");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}
