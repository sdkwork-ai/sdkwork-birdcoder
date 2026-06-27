use axum::body::Body;
use axum::http::{Request, StatusCode};
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
    IamAppContext::new(
        "1",
        None,
        "handler-smoke-user",
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
