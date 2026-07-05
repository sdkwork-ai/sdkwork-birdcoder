use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

fn smoke_config(sqlite_name: &str) -> sdkwork_birdcoder_standalone_gateway::bootstrap::config::BirdServerConfig {
    use sdkwork_birdcoder_standalone_gateway::bootstrap::config::{
        BirdServerConfig, DEFAULT_RATE_LIMIT_ENABLED, DEFAULT_RATE_LIMIT_MAX_REQUESTS,
        DEFAULT_RATE_LIMIT_WINDOW_SECS,
    };

    BirdServerConfig {
        host: "127.0.0.1".to_string(),
        port: 0,
        sqlite_file: std::env::temp_dir().join(sqlite_name),
        allowed_origins: vec!["http://127.0.0.1:5173".to_string()],
        project_root: None,
        rate_limit_enabled: DEFAULT_RATE_LIMIT_ENABLED,
        rate_limit_max_requests: DEFAULT_RATE_LIMIT_MAX_REQUESTS,
        rate_limit_window_secs: DEFAULT_RATE_LIMIT_WINDOW_SECS,
    }
}

async fn liveness_endpoint_returns_alive_status() {
    let config = smoke_config("bootstrap-smoke-liveness.db");

    let app = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed with valid config");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/health/live")
                .body(Body::empty())
                .expect("build liveness request"),
        )
        .await
        .expect("serve liveness request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read liveness body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse liveness JSON");
    assert_eq!(json["status"], "alive");
    assert_eq!(json["liveness"], true);

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
async fn health_endpoint_returns_healthy_status() {
    let config = smoke_config("bootstrap-smoke-health.db");

    let app = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config)
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
    assert_eq!(json["checks"]["database"]["ok"], true);
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
async fn metrics_endpoint_returns_prometheus_payload() {
    let config = smoke_config("bootstrap-smoke-metrics.db");

    let app = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed with valid config");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/metrics")
                .body(Body::empty())
                .expect("build metrics request"),
        )
        .await
        .expect("serve metrics request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read metrics body");
    let text = String::from_utf8(body.to_vec()).expect("metrics body must be utf-8");
    assert!(
        text.contains("sdkwork_health_status"),
        "metrics payload must expose sdkwork_health_status gauge"
    );
    assert!(
        text.contains("sdkwork_http_requests_total"),
        "metrics payload must expose sdkwork_http_requests_total counter"
    );

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
async fn openapi_endpoint_returns_canonical_snapshot() {
    let config = smoke_config("bootstrap-smoke-openapi.db");

    let app = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed with valid config");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/openapi.json")
                .body(Body::empty())
                .expect("build openapi request"),
        )
        .await
        .expect("serve openapi request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read openapi body");
    let text = String::from_utf8(body.to_vec()).expect("openapi body must be utf-8");
    assert!(
        text.contains("\"openapi\"") && text.contains("SDKWork BirdCoder Coding Server API"),
        "openapi payload must expose canonical coding-server snapshot"
    );

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
async fn build_app_requires_authentication_for_system_health() {
    let config = smoke_config("bootstrap-smoke-full.db");

    let app = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config)
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

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
async fn build_app_exposes_public_iam_runtime() {
    let config = smoke_config("bootstrap-smoke-iam-runtime.db");

    let app = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config)
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
async fn build_app_with_invalid_sqlite_target_fails_gracefully() {
    let sqlite_dir = std::env::temp_dir().join("bootstrap-smoke-invalid-sqlite-target");
    let _ = std::fs::remove_dir_all(&sqlite_dir);
    std::fs::create_dir_all(&sqlite_dir).expect("create invalid sqlite target directory");

    let config = smoke_config("bootstrap-smoke-invalid-sqlite-target-unused");
    let config = sdkwork_birdcoder_standalone_gateway::bootstrap::config::BirdServerConfig {
        sqlite_file: sqlite_dir.clone(),
        ..config
    };

    let result = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config).await;
    assert!(result.is_err(), "build_app should fail when sqlite target is not a file");

    let _ = std::fs::remove_dir_all(&sqlite_dir);
}

#[tokio::test]
async fn intelligence_session_list_requires_authentication() {
    let config = smoke_config("bootstrap-smoke-intelligence.db");

    let app = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/app/v3/api/intelligence/coding_sessions")
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

    let app = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config)
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
async fn backend_iam_tenants_route_is_registered() {
    let config = smoke_config("bootstrap-smoke-iam-backend.db");

    let app = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .oneshot(
            Request::builder()
                .uri("/backend/v3/api/iam/tenants")
                .body(Body::empty())
                .expect("build backend iam tenants request"),
        )
        .await
        .expect("serve backend iam tenants request");

    assert_ne!(
        response.status(),
        StatusCode::NOT_FOUND,
        "federated sdkwork-iam backend router must register /backend/v3/api/iam/tenants"
    );

    let _ = std::fs::remove_file(&config.sqlite_file);
}

#[tokio::test]
async fn cors_layer_allows_configured_origins() {
    let config = smoke_config("bootstrap-smoke-cors.db");

    let app = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config)
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
