use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn health_endpoint_returns_healthy_status() {
    let config = sdkwork_birdcoder_api_server::bootstrap::config::BirdServerConfig {
        host: "127.0.0.1".to_string(),
        port: 0,
        sqlite_file: std::env::temp_dir().join("bootstrap-smoke-health.db"),
        allowed_origins: vec!["*".to_string()],
        project_root: None,
    };

    let app = sdkwork_birdcoder_api_server::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed with valid config");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .body(Body::empty())
                .expect("build health request"),
        )
        .await
        .expect("serve health request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read health body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse health JSON");
    assert_eq!(json["status"], "healthy");

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
#[ignore]
async fn build_app_creates_valid_router_with_all_sub_routers() {
    let config = sdkwork_birdcoder_api_server::bootstrap::config::BirdServerConfig {
        host: "127.0.0.1".to_string(),
        port: 0,
        sqlite_file: std::env::temp_dir().join("bootstrap-smoke-full.db"),
        allowed_origins: vec!["*".to_string()],
        project_root: None,
    };

    let app = sdkwork_birdcoder_api_server::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/system/health")
                .body(Body::empty())
                .expect("build system health request"),
        )
        .await
        .expect("serve system health request");

    assert_eq!(response.status(), StatusCode::OK);

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
#[ignore]
async fn build_app_with_missing_sqlite_directory_fails_gracefully() {
    let config = sdkwork_birdcoder_api_server::bootstrap::config::BirdServerConfig {
        host: "127.0.0.1".to_string(),
        port: 0,
        sqlite_file: std::path::PathBuf::from("/nonexistent/deeply/nested/path/server.db"),
        allowed_origins: vec!["*".to_string()],
        project_root: None,
    };

    let result = sdkwork_birdcoder_api_server::bootstrap::build_app(&config).await;
    assert!(result.is_err(), "build_app should fail for invalid sqlite path");
}

#[tokio::test]
#[ignore]
async fn intelligence_session_list_endpoint_returns_paginated_structure() {
    let config = sdkwork_birdcoder_api_server::bootstrap::config::BirdServerConfig {
        host: "127.0.0.1".to_string(),
        port: 0,
        sqlite_file: std::env::temp_dir().join("bootstrap-smoke-intelligence.db"),
        allowed_origins: vec!["*".to_string()],
        project_root: None,
    };

    let app = sdkwork_birdcoder_api_server::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/intelligence/coding-sessions")
                .body(Body::empty())
                .expect("build list sessions request"),
        )
        .await
        .expect("serve list sessions request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read list sessions body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse list sessions JSON");
    assert!(json["items"].is_array(), "response should contain items array");

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
#[ignore]
async fn platform_workspaces_endpoint_returns_json_response() {
    let config = sdkwork_birdcoder_api_server::bootstrap::config::BirdServerConfig {
        host: "127.0.0.1".to_string(),
        port: 0,
        sqlite_file: std::env::temp_dir().join("bootstrap-smoke-platform.db"),
        allowed_origins: vec!["*".to_string()],
        project_root: None,
    };

    let app = sdkwork_birdcoder_api_server::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/workspaces")
                .body(Body::empty())
                .expect("build list workspaces request"),
        )
        .await
        .expect("serve list workspaces request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read list workspaces body");
    let json: serde_json::Value =
        serde_json::from_slice(&body).expect("parse list workspaces JSON");
    assert!(json["items"].is_array(), "response should contain items array");

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
#[ignore]
async fn cors_layer_allows_configured_origins() {
    let config = sdkwork_birdcoder_api_server::bootstrap::config::BirdServerConfig {
        host: "127.0.0.1".to_string(),
        port: 0,
        sqlite_file: std::env::temp_dir().join("bootstrap-smoke-cors.db"),
        allowed_origins: vec!["http://localhost:3000".to_string()],
        project_root: None,
    };

    let app = sdkwork_birdcoder_api_server::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .header("origin", "http://localhost:3000")
                .body(Body::empty())
                .expect("build CORS health request"),
        )
        .await
        .expect("serve CORS health request");

    assert_eq!(response.status(), StatusCode::OK);

    let _ = std::fs::remove_file(&config.sqlite_file);
}
