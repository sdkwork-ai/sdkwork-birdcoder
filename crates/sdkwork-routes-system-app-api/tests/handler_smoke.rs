use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

use sdkwork_iam_context_service::{AuthLevel, DeploymentMode, Environment, IamAppContext};
use sdkwork_routes_system_app_api::manifest::SYSTEM_APP_API_ROUTES;
use sdkwork_routes_system_app_api::{build_system_app_router, SystemAppState};
use sdkwork_web_core::{
    ServerRequestId, WebApiSurface, WebAuthMode, WebRequestContext, WebTransportFacts,
};

fn test_state() -> SystemAppState {
    SystemAppState::with_runtime(
        SYSTEM_APP_API_ROUTES,
        "127.0.0.1",
        10_240,
        "sdkwork.app.config.json",
    )
}

fn test_iam_context() -> IamAppContext {
    IamAppContext::new(
        "100001",
        None,
        "200001",
        "handler-smoke-session",
        "sdkwork-birdcoder",
        Environment::Dev,
        DeploymentMode::Local,
        AuthLevel::Password,
        vec![],
        vec![],
    )
}

fn with_request_context(mut request: Request<Body>, authenticated: bool) -> Request<Body> {
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
    if authenticated {
        request.extensions_mut().insert(test_iam_context());
    }
    request
}

#[test]
fn system_manifest_contains_only_application_metadata() {
    assert_eq!(SYSTEM_APP_API_ROUTES.len(), 4);
    assert!(SYSTEM_APP_API_ROUTES
        .iter()
        .all(|route| route.path.starts_with("/app/v3/api/system/")));
    assert!(SYSTEM_APP_API_ROUTES
        .iter()
        .all(|route| !route.operation_id.starts_with("operations.")));
}

#[tokio::test]
async fn system_metadata_routes_are_available_to_authenticated_users() {
    for path in [
        "/app/v3/api/system/descriptor",
        "/app/v3/api/system/routes",
        "/app/v3/api/system/runtime",
        "/app/v3/api/system/health",
    ] {
        let response = build_system_app_router()
            .with_state(test_state())
            .oneshot(with_request_context(
                Request::builder()
                    .uri(path)
                    .body(Body::empty())
                    .expect("build system request"),
                true,
            ))
            .await
            .expect("serve system request");
        assert_eq!(response.status(), StatusCode::OK, "path={path}");
    }
}

#[tokio::test]
async fn system_metadata_requires_authentication() {
    let response = build_system_app_router()
        .with_state(test_state())
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/system/descriptor")
                .body(Body::empty())
                .expect("build descriptor request"),
            false,
        ))
        .await
        .expect("serve descriptor request");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn birdcoder_no_longer_exposes_local_session_operations() {
    let response = build_system_app_router()
        .with_state(test_state())
        .oneshot(with_request_context(
            Request::builder()
                .uri("/app/v3/api/operations/legacy-operation")
                .body(Body::empty())
                .expect("build removed operation request"),
            true,
        ))
        .await
        .expect("serve removed operation request");

    assert_eq!(response.status(), StatusCode::NOT_FOUND);
}
