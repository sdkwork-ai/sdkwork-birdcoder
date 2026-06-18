use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

fn smoke_config(sqlite_name: &str) -> sdkwork_birdcoder_api_server::bootstrap::config::BirdServerConfig {
    sdkwork_birdcoder_api_server::bootstrap::config::BirdServerConfig {
        host: "127.0.0.1".to_string(),
        port: 0,
        sqlite_file: std::env::temp_dir().join(sqlite_name),
        allowed_origins: vec!["http://127.0.0.1:5173".to_string()],
        project_root: None,
    }
}

#[tokio::test]
async fn health_endpoint_returns_healthy_status() {
    let config = smoke_config("bootstrap-smoke-health.db");

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
    assert_eq!(json["checks"]["sqlite"]["ok"], true);
    if json["checks"]["iam_database"]["configured"] == true {
        assert!(
            json["status"] == "healthy" || json["status"] == "degraded",
            "unexpected health status: {json}"
        );
    } else {
        assert_eq!(json["status"], "healthy");
    }

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
async fn build_app_creates_valid_router_with_public_system_health() {
    let config = smoke_config("bootstrap-smoke-full.db");

    let app = sdkwork_birdcoder_api_server::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/app/v3/api/system/health")
                .body(Body::empty())
                .expect("build system health request"),
        )
        .await
        .expect("serve system health request");

    assert_eq!(response.status(), StatusCode::OK);

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
async fn build_app_exposes_public_iam_runtime() {
    let config = smoke_config("bootstrap-smoke-iam-runtime.db");

    let app = sdkwork_birdcoder_api_server::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed");

    if std::env::var("SDKWORK_IAM_DATABASE_URL").is_err() {
        return;
    }

    let response = app
        .oneshot(
            Request::builder()
                .uri("/app/v3/api/system/iam/runtime")
                .body(Body::empty())
                .expect("build iam runtime request"),
        )
        .await
        .expect("serve iam runtime request");

    assert_eq!(response.status(), StatusCode::OK);

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
async fn build_app_with_missing_sqlite_directory_fails_gracefully() {
    let config = sdkwork_birdcoder_api_server::bootstrap::config::BirdServerConfig {
        host: "127.0.0.1".to_string(),
        port: 0,
        sqlite_file: std::path::PathBuf::from("/nonexistent/deeply/nested/path/server.db"),
        allowed_origins: vec!["http://127.0.0.1:5173".to_string()],
        project_root: None,
    };

    let result = sdkwork_birdcoder_api_server::bootstrap::build_app(&config).await;
    assert!(result.is_err(), "build_app should fail for invalid sqlite path");
}

#[tokio::test]
async fn intelligence_session_list_requires_authentication() {
    let config = smoke_config("bootstrap-smoke-intelligence.db");

    let app = sdkwork_birdcoder_api_server::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/app/v3/api/intelligence/coding-sessions")
                .body(Body::empty())
                .expect("build list sessions request"),
        )
        .await
        .expect("serve list sessions request");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
async fn platform_workspaces_endpoint_requires_authentication() {
    let config = smoke_config("bootstrap-smoke-platform.db");

    let app = sdkwork_birdcoder_api_server::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/app/v3/api/workspaces")
                .body(Body::empty())
                .expect("build list workspaces request"),
        )
        .await
        .expect("serve list workspaces request");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
async fn cors_layer_allows_configured_origins() {
    let config = smoke_config("bootstrap-smoke-cors.db");

    let app = sdkwork_birdcoder_api_server::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health")
                .header("origin", "http://127.0.0.1:5173")
                .body(Body::empty())
                .expect("build CORS health request"),
        )
        .await
        .expect("serve CORS health request");

    assert_eq!(response.status(), StatusCode::OK);

    let _ = std::fs::remove_file(&config.sqlite_file);
}
