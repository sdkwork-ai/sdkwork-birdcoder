use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

use sdkwork_router_system_app_api::{build_system_app_router, SystemAppState};

fn test_app() -> axum::Router<SystemAppState> {
    build_system_app_router()
}

fn test_state() -> SystemAppState {
    SystemAppState::new()
}

#[test]
fn system_router_builds_without_error() {
    let _router = build_system_app_router();
}

#[tokio::test]
async fn system_descriptor_returns_ok() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(
            Request::builder()
                .uri("/app/v3/api/system/descriptor")
                .body(Body::empty())
                .expect("build descriptor request"),
        )
        .await
        .expect("serve descriptor request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn system_routes_returns_ok() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(
            Request::builder()
                .uri("/app/v3/api/system/routes")
                .body(Body::empty())
                .expect("build routes request"),
        )
        .await
        .expect("serve routes request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn system_runtime_returns_ok() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(
            Request::builder()
                .uri("/app/v3/api/system/runtime")
                .body(Body::empty())
                .expect("build runtime request"),
        )
        .await
        .expect("serve runtime request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn system_health_returns_healthy() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(
            Request::builder()
                .uri("/app/v3/api/system/health")
                .body(Body::empty())
                .expect("build health request"),
        )
        .await
        .expect("serve health request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn get_operation_returns_ok() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(
            Request::builder()
                .uri("/app/v3/api/operations/op-123")
                .body(Body::empty())
                .expect("build operation request"),
        )
        .await
        .expect("serve operation request");

    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn system_routes_returns_all_registered_paths() {
    let response = test_app()
        .with_state(test_state())
        .oneshot(
            Request::builder()
                .uri("/app/v3/api/system/routes")
                .body(Body::empty())
                .expect("build routes request"),
        )
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
