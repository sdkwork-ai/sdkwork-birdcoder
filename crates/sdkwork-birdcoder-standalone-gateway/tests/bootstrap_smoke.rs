use axum::body::Body;
use axum::http::{Request, StatusCode};
use std::sync::{Arc, OnceLock};
use tokio::sync::{Mutex, OwnedMutexGuard};
use tower::ServiceExt;

static SMOKE_ENV_LOCK: OnceLock<Arc<Mutex<()>>> = OnceLock::new();

const SMOKE_ENV_VALUES: &[(&str, &str)] = &[
    ("SDKWORK_DEPLOYMENT_ENV", "development"),
    ("SDKWORK_BIRDCODER_ENVIRONMENT", "development"),
    ("SDKWORK_LIFECYCLE_ENVIRONMENT", "development"),
    ("SDKWORK_AGENTS_ENVIRONMENT", "development"),
    ("SDKWORK_AGENTS_CONFIG_PROFILE", "development"),
    ("SDKWORK_AGENTS_DEV_AUTH_BYPASS", "true"),
    ("SDKWORK_AGENTS_STORE_KIND", "memory"),
    ("SDKWORK_AGENTS_MANAGED_STORE_KIND", "memory"),
    ("SDKWORK_IAM_DATABASE_ENGINE", "sqlite"),
    ("SDKWORK_IAM_DATABASE_SCHEMA", "public"),
    ("SDKWORK_IAM_DATABASE_MAX_CONNECTIONS", "1"),
    ("SDKWORK_IAM_DATABASE_MIN_CONNECTIONS", "1"),
    ("SDKWORK_IAM_DATABASE_ACQUIRE_TIMEOUT", "2"),
    ("SDKWORK_BIRDCODER_REALTIME_BACKEND", "memory"),
    ("SDKWORK_BIRDCODER_REDIS_ENABLED", "false"),
];

const SMOKE_ENV_REMOVALS: &[&str] = &[
    "DATABASE_URL",
    "SDKWORK_DATABASE_URL",
    "SDKWORK_DATABASE_SCHEMA",
    "SDKWORK_CLAW_DATABASE_URL",
    "SDKWORK_CLAW_DATABASE_ENGINE",
    "SDKWORK_CLAW_DATABASE_HOST",
    "SDKWORK_CLAW_DATABASE_PORT",
    "SDKWORK_CLAW_DATABASE_NAME",
    "SDKWORK_CLAW_DATABASE_USERNAME",
    "SDKWORK_CLAW_DATABASE_PASSWORD",
    "SDKWORK_CLAW_DATABASE_SSL_MODE",
    "SDKWORK_CLAW_DATABASE_SCHEMA",
    "SDKWORK_IM_DATABASE_URL",
    "SDKWORK_IM_DATABASE_ENGINE",
    "SDKWORK_IAM_APP_ROOT",
    "SDKWORK_APPBASE_APP_ROOT",
    "SDKWORK_APP_ROOT",
    "SDKWORK_CLAW_ROUTER_APP_ROOT",
    "SDKWORK_IM_APP_ROOT",
    "SDKWORK_BIRDCODER_APP_ROOT",
    "BIRDCODER_RATE_LIMIT_REDIS_URL",
];

const SMOKE_BIRDCODER_DATABASE_REMOVALS: &[&str] = &[
    "SDKWORK_BIRDCODER_DATABASE_URL",
    "SDKWORK_BIRDCODER_DATABASE_ENGINE",
];

const SMOKE_AGENTS_DATABASE_KEYS: &[&str] = &[
    "SDKWORK_AGENTS_STORE_POSTGRES_URI",
    "SDKWORK_AGENTS_STORE_DATABASE_URL",
    "SDKWORK_AGENTS_STORE_DATABASE_ENGINE",
    "SDKWORK_AGENTS_STORE_DATABASE_ACQUIRE_TIMEOUT",
    "SDKWORK_AGENTS_STORE_DATABASE_MAX_CONNECTIONS",
    "SDKWORK_AGENTS_STORE_DATABASE_MIN_CONNECTIONS",
];

#[derive(Clone, Copy)]
enum SmokeDatabaseMode {
    IsolatedSqlite,
    PreserveConfiguredBirdcoder,
}

struct EnvSnapshot {
    values: Vec<(&'static str, Option<String>)>,
}

impl EnvSnapshot {
    fn install(
        config: &sdkwork_birdcoder_standalone_gateway::bootstrap::config::BirdServerConfig,
        database_mode: SmokeDatabaseMode,
    ) -> Self {
        let mut keys = SMOKE_ENV_VALUES
            .iter()
            .map(|(key, _value)| *key)
            .chain(SMOKE_ENV_REMOVALS.iter().copied())
            .chain(SMOKE_BIRDCODER_DATABASE_REMOVALS.iter().copied())
            .chain(SMOKE_AGENTS_DATABASE_KEYS.iter().copied())
            .collect::<Vec<_>>();
        keys.push("SDKWORK_IAM_DATABASE_URL");
        keys.sort_unstable();
        keys.dedup();

        let values = keys
            .into_iter()
            .map(|key| (key, std::env::var(key).ok()))
            .collect::<Vec<_>>();

        for key in SMOKE_ENV_REMOVALS {
            std::env::remove_var(key);
        }
        if matches!(database_mode, SmokeDatabaseMode::IsolatedSqlite) {
            for key in SMOKE_BIRDCODER_DATABASE_REMOVALS {
                std::env::remove_var(key);
            }
        }
        for (key, value) in SMOKE_ENV_VALUES {
            std::env::set_var(key, value);
        }
        std::env::set_var(
            "SDKWORK_IAM_DATABASE_URL",
            sqlite_database_url(&config.sqlite_file),
        );
        Self { values }
    }
}

impl Drop for EnvSnapshot {
    fn drop(&mut self) {
        for (key, value) in self.values.drain(..) {
            match value {
                Some(value) => std::env::set_var(key, value),
                None => std::env::remove_var(key),
            }
        }
    }
}

fn smoke_env_lock() -> Arc<Mutex<()>> {
    SMOKE_ENV_LOCK
        .get_or_init(|| Arc::new(Mutex::new(())))
        .clone()
}

struct SmokeApp {
    router: axum::Router,
    _env: EnvSnapshot,
    _guard: OwnedMutexGuard<()>,
}

impl SmokeApp {
    async fn request(
        &self,
        request: Request<Body>,
    ) -> Result<axum::response::Response, std::convert::Infallible> {
        self.router.clone().oneshot(request).await
    }
}

fn smoke_config(
    sqlite_name: &str,
) -> sdkwork_birdcoder_standalone_gateway::bootstrap::config::BirdServerConfig {
    use sdkwork_birdcoder_standalone_gateway::bootstrap::config::{
        BirdDeploymentProfile, BirdEnvironment, BirdRuntimeTarget, BirdServerConfig,
        DEFAULT_RATE_LIMIT_ENABLED, DEFAULT_RATE_LIMIT_MAX_REQUESTS,
        DEFAULT_RATE_LIMIT_WINDOW_SECS,
    };

    BirdServerConfig {
        environment: BirdEnvironment::Development,
        deployment_profile: BirdDeploymentProfile::Standalone,
        runtime_target: BirdRuntimeTarget::Server,
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

fn sqlite_database_url(path: &std::path::Path) -> String {
    let normalized = path.to_string_lossy().replace('\\', "/");
    format!("sqlite:///{normalized}?mode=rwc")
}

fn cleanup_smoke_database(path: &std::path::Path) {
    let _ = std::fs::remove_file(path);
    let _ = std::fs::remove_file(std::path::PathBuf::from(format!(
        "{}-wal",
        path.to_string_lossy()
    )));
    let _ = std::fs::remove_file(std::path::PathBuf::from(format!(
        "{}-shm",
        path.to_string_lossy()
    )));
}

#[tokio::test]
async fn smoke_env_install_removes_external_birdcoder_database_settings_by_default() {
    let _guard = smoke_env_lock().lock_owned().await;
    let config = smoke_config("bootstrap-smoke-env-isolated-sqlite.db");
    let previous_url = std::env::var("SDKWORK_BIRDCODER_DATABASE_URL").ok();
    let previous_engine = std::env::var("SDKWORK_BIRDCODER_DATABASE_ENGINE").ok();

    std::env::set_var(
        "SDKWORK_BIRDCODER_DATABASE_URL",
        "postgres://birdcoder-smoke.example/sdkwork_birdcoder",
    );
    std::env::set_var("SDKWORK_BIRDCODER_DATABASE_ENGINE", "postgresql");

    {
        let _env = EnvSnapshot::install(&config, SmokeDatabaseMode::IsolatedSqlite);
        assert!(std::env::var("SDKWORK_BIRDCODER_DATABASE_URL").is_err());
        assert!(std::env::var("SDKWORK_BIRDCODER_DATABASE_ENGINE").is_err());
    }

    match previous_url {
        Some(value) => std::env::set_var("SDKWORK_BIRDCODER_DATABASE_URL", value),
        None => std::env::remove_var("SDKWORK_BIRDCODER_DATABASE_URL"),
    }
    match previous_engine {
        Some(value) => std::env::set_var("SDKWORK_BIRDCODER_DATABASE_ENGINE", value),
        None => std::env::remove_var("SDKWORK_BIRDCODER_DATABASE_ENGINE"),
    }

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn smoke_env_install_can_preserve_explicit_birdcoder_postgresql_settings() {
    let _guard = smoke_env_lock().lock_owned().await;
    let config = smoke_config("bootstrap-smoke-env-preserve-postgres.db");
    let previous_url = std::env::var("SDKWORK_BIRDCODER_DATABASE_URL").ok();
    let previous_engine = std::env::var("SDKWORK_BIRDCODER_DATABASE_ENGINE").ok();

    std::env::set_var(
        "SDKWORK_BIRDCODER_DATABASE_URL",
        "postgres://birdcoder-smoke.example/sdkwork_birdcoder",
    );
    std::env::set_var("SDKWORK_BIRDCODER_DATABASE_ENGINE", "postgresql");

    {
        let _env = EnvSnapshot::install(&config, SmokeDatabaseMode::PreserveConfiguredBirdcoder);
        assert_eq!(
            std::env::var("SDKWORK_BIRDCODER_DATABASE_URL")
                .ok()
                .as_deref(),
            Some("postgres://birdcoder-smoke.example/sdkwork_birdcoder")
        );
        assert_eq!(
            std::env::var("SDKWORK_BIRDCODER_DATABASE_ENGINE")
                .ok()
                .as_deref(),
            Some("postgresql")
        );
    }

    match previous_url {
        Some(value) => std::env::set_var("SDKWORK_BIRDCODER_DATABASE_URL", value),
        None => std::env::remove_var("SDKWORK_BIRDCODER_DATABASE_URL"),
    }
    match previous_engine {
        Some(value) => std::env::set_var("SDKWORK_BIRDCODER_DATABASE_ENGINE", value),
        None => std::env::remove_var("SDKWORK_BIRDCODER_DATABASE_ENGINE"),
    }

    cleanup_smoke_database(&config.sqlite_file);
}

async fn build_smoke_app(
    config: &sdkwork_birdcoder_standalone_gateway::bootstrap::config::BirdServerConfig,
) -> Result<SmokeApp, Box<dyn std::error::Error>> {
    build_smoke_app_with_database_mode(config, SmokeDatabaseMode::IsolatedSqlite).await
}

async fn build_smoke_app_with_database_mode(
    config: &sdkwork_birdcoder_standalone_gateway::bootstrap::config::BirdServerConfig,
    database_mode: SmokeDatabaseMode,
) -> Result<SmokeApp, Box<dyn std::error::Error>> {
    let guard = smoke_env_lock().lock_owned().await;
    if matches!(database_mode, SmokeDatabaseMode::IsolatedSqlite) {
        cleanup_smoke_database(&config.sqlite_file);
    }
    let env = EnvSnapshot::install(config, database_mode);
    let router = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(config).await?;
    Ok(SmokeApp {
        router,
        _env: env,
        _guard: guard,
    })
}

#[tokio::test]
async fn build_app_surfaces_agents_managed_store_errors_without_runtime_panic() {
    let guard = smoke_env_lock().lock_owned().await;
    let config = smoke_config("bootstrap-smoke-agents-managed-store-error.db");
    cleanup_smoke_database(&config.sqlite_file);
    let _env = EnvSnapshot::install(&config, SmokeDatabaseMode::IsolatedSqlite);

    std::env::set_var("SDKWORK_AGENTS_DEV_AUTH_BYPASS", "false");
    std::env::set_var(
        "SDKWORK_AGENTS_STORE_DATABASE_URL",
        "postgres://postgres:postgres@127.0.0.1:1/sdkwork_agents",
    );
    std::env::set_var("SDKWORK_AGENTS_STORE_DATABASE_ENGINE", "postgresql");
    std::env::set_var("SDKWORK_AGENTS_STORE_DATABASE_ACQUIRE_TIMEOUT", "1");
    std::env::set_var("SDKWORK_AGENTS_STORE_DATABASE_MAX_CONNECTIONS", "1");
    std::env::set_var("SDKWORK_AGENTS_STORE_DATABASE_MIN_CONNECTIONS", "1");

    let result = sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config).await;
    assert!(
        result.is_err(),
        "build_app should return an agents managed-store bootstrap error"
    );
    let message = result.expect_err("build_app should fail").to_string();
    assert!(
        message.contains("agents managed store bootstrap failed"),
        "unexpected build_app error: {message}"
    );

    drop(guard);
    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn healthz_endpoint_returns_standard_liveness_status() {
    let config = smoke_config("bootstrap-smoke-healthz.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed with valid config");

    let response = app
        .request(
            Request::builder()
                .uri("/healthz")
                .body(Body::empty())
                .expect("build healthz request"),
        )
        .await
        .expect("serve healthz request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read healthz body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse healthz JSON");
    assert_eq!(json["status"], "ok");

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn readyz_endpoint_returns_standard_readiness_status() {
    let config = smoke_config("bootstrap-smoke-readyz.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed with valid config");

    let response = app
        .request(
            Request::builder()
                .uri("/readyz")
                .body(Body::empty())
                .expect("build readyz request"),
        )
        .await
        .expect("serve readyz request");

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .expect("read readyz body");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("parse readyz JSON");
    assert_eq!(json["status"], "ready");

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn livez_endpoint_returns_standard_liveness_status() {
    let config = smoke_config("bootstrap-smoke-liveness.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed with valid config");

    let response = app
        .request(
            Request::builder()
                .uri("/livez")
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
    assert_eq!(json["status"], "ok");

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn legacy_health_endpoints_are_not_mounted_after_standard_cutover() {
    let config = smoke_config("bootstrap-smoke-legacy-health.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed with valid config");

    for legacy_path in ["/health", "/health/live"] {
        let response = app
            .request(
                Request::builder()
                    .uri(legacy_path)
                    .body(Body::empty())
                    .expect("build legacy health request"),
            )
            .await
            .expect("serve legacy health request");

        assert!(
            !response.status().is_success(),
            "legacy health path {legacy_path} must not return a successful infra probe response"
        );
    }

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn metrics_endpoint_returns_prometheus_payload() {
    let config = smoke_config("bootstrap-smoke-metrics.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed with valid config");

    let response = app
        .request(
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

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn openapi_endpoint_returns_canonical_snapshot() {
    let config = smoke_config("bootstrap-smoke-openapi.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed with valid config");

    let response = app
        .request(
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

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn build_app_requires_authentication_for_system_health() {
    let config = smoke_config("bootstrap-smoke-full.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .request(
            Request::builder()
                .uri("/app/v3/api/system/health")
                .body(Body::empty())
                .expect("build system health request"),
        )
        .await
        .expect("serve system health request");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn build_app_exposes_public_iam_runtime() {
    let config = smoke_config("bootstrap-smoke-iam-runtime.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed");

    if std::env::var("SDKWORK_IAM_DATABASE_URL").is_err() {
        return;
    }

    let response = app
        .request(
            Request::builder()
                .uri("/app/v3/api/system/iam/runtime")
                .body(Body::empty())
                .expect("build iam runtime request"),
        )
        .await
        .expect("serve iam runtime request");

    assert_eq!(response.status(), StatusCode::OK);

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn build_app_bootstraps_postgresql_when_configured() {
    let database_url = std::env::var("SDKWORK_BIRDCODER_DATABASE_URL")
        .ok()
        .filter(|value| value.to_ascii_lowercase().contains("postgres"));
    let engine = std::env::var("SDKWORK_BIRDCODER_DATABASE_ENGINE")
        .ok()
        .filter(|value| value.to_ascii_lowercase().contains("postgres"));
    if database_url.is_none() || engine.is_none() {
        return;
    }

    let config = smoke_config("bootstrap-smoke-postgres-unused.db");
    let app =
        build_smoke_app_with_database_mode(&config, SmokeDatabaseMode::PreserveConfiguredBirdcoder)
            .await
            .expect("build_app should bootstrap against configured PostgreSQL");

    let response = app
        .request(
            Request::builder()
                .uri("/readyz")
                .body(Body::empty())
                .expect("build readiness request"),
        )
        .await
        .expect("serve readiness request");

    assert_eq!(response.status(), StatusCode::OK);

    cleanup_smoke_database(&config.sqlite_file);
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

    let result = build_smoke_app(&config).await;
    assert!(
        result.is_err(),
        "build_app should fail when sqlite target is not a file"
    );

    let _ = std::fs::remove_dir_all(&sqlite_dir);
}

#[tokio::test]
async fn intelligence_session_list_requires_authentication() {
    let config = smoke_config("bootstrap-smoke-intelligence.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .request(
            Request::builder()
                .uri("/app/v3/api/intelligence/coding_sessions")
                .body(Body::empty())
                .expect("build list sessions request"),
        )
        .await
        .expect("serve list sessions request");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn platform_workspaces_endpoint_requires_authentication() {
    let config = smoke_config("bootstrap-smoke-platform.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .request(
            Request::builder()
                .uri("/app/v3/api/workspaces")
                .body(Body::empty())
                .expect("build list workspaces request"),
        )
        .await
        .expect("serve list workspaces request");

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn backend_iam_tenants_route_is_registered() {
    let config = smoke_config("bootstrap-smoke-iam-backend.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .request(
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

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn cors_layer_allows_configured_origins() {
    let config = smoke_config("bootstrap-smoke-cors.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .request(
            Request::builder()
                .uri("/readyz")
                .header("origin", "http://127.0.0.1:5173")
                .body(Body::empty())
                .expect("build CORS readiness request"),
        )
        .await
        .expect("serve CORS readiness request");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-origin")
            .and_then(|value| value.to_str().ok()),
        Some("http://127.0.0.1:5173")
    );
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-credentials")
            .and_then(|value| value.to_str().ok()),
        Some("true")
    );

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn cors_preflight_short_circuits_options_with_200_for_iam_routes() {
    let config = smoke_config("bootstrap-smoke-cors-preflight.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .request(
            Request::builder()
                .method("OPTIONS")
                .uri("/app/v3/api/oauth/device_authorizations")
                .header("origin", "http://127.0.0.1:5173")
                .header("access-control-request-method", "POST")
                .header("access-control-request-headers", "content-type")
                .body(Body::empty())
                .expect("build OPTIONS preflight request"),
        )
        .await
        .expect("serve OPTIONS preflight request");

    assert_eq!(
        response.status(),
        StatusCode::OK,
        "OPTIONS preflight must return 200 OK, not 405 Method Not Allowed"
    );
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-origin")
            .and_then(|value| value.to_str().ok()),
        Some("http://127.0.0.1:5173"),
        "preflight must echo the allowed origin"
    );
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-credentials")
            .and_then(|value| value.to_str().ok()),
        Some("true"),
        "preflight must allow credentials"
    );

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn cors_preflight_allows_dynamic_lan_web_origins_in_development() {
    let config = smoke_config("bootstrap-smoke-cors-lan-preflight.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .request(
            Request::builder()
                .method("OPTIONS")
                .uri("/app/v3/api/workspaces")
                .header("origin", "http://192.168.31.108:3001")
                .header("access-control-request-method", "GET")
                .header(
                    "access-control-request-headers",
                    "authorization,content-type",
                )
                .body(Body::empty())
                .expect("build LAN OPTIONS preflight request"),
        )
        .await
        .expect("serve LAN OPTIONS preflight request");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-origin")
            .and_then(|value| value.to_str().ok()),
        Some("http://192.168.31.108:3001")
    );
    assert_eq!(
        response
            .headers()
            .get("access-control-allow-credentials")
            .and_then(|value| value.to_str().ok()),
        Some("true")
    );

    cleanup_smoke_database(&config.sqlite_file);
}

#[tokio::test]
async fn cors_layer_applies_headers_to_iam_routes_for_allowed_origin() {
    let config = smoke_config("bootstrap-smoke-cors-iam-route.db");

    let app = build_smoke_app(&config)
        .await
        .expect("build_app should succeed");

    let response = app
        .request(
            Request::builder()
                .uri("/app/v3/api/system/iam/runtime")
                .header("origin", "http://127.0.0.1:5173")
                .body(Body::empty())
                .expect("build IAM runtime CORS request"),
        )
        .await
        .expect("serve IAM runtime CORS request");

    assert_eq!(
        response
            .headers()
            .get("access-control-allow-origin")
            .and_then(|value| value.to_str().ok()),
        Some("http://127.0.0.1:5173"),
        "IAM routes must receive CORS headers from the gateway CORS layer"
    );

    cleanup_smoke_database(&config.sqlite_file);
}
