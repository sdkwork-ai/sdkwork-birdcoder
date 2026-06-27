use std::sync::OnceLock;

use axum::http::StatusCode;
use axum::Json;
use sdkwork_database_sqlx::DatabasePool;
use serde::Serialize;
use serde_json::{json, Value};

const IAM_SERVICE_NAME: &str = "IAM";

/// Singleton IAM database pool, initialized once at startup via [`init_iam_pool`].
///
/// Holding the pool in a `OnceLock` ensures every health check reuses the same
/// pool instead of leaking a new connection pool per request.
static IAM_DATABASE_POOL: OnceLock<Option<DatabasePool>> = OnceLock::new();

/// Cached process and dependency readiness state.
#[derive(Clone, Debug, Serialize)]
pub struct HealthState {
    pub status: String,
    pub liveness: bool,
    pub readiness: ReadinessState,
}

#[derive(Clone, Debug, Serialize)]
pub struct ReadinessState {
    pub database: bool,
    pub iam_database: bool,
    pub realtime: bool,
}

/// Initialize the singleton IAM database pool. Idempotent; safe to call multiple times.
///
/// Call once during bootstrap so subsequent health checks read pool state without
/// creating new connections.
pub async fn init_iam_pool() {
    if IAM_DATABASE_POOL.get().is_some() {
        return;
    }
    let pool = load_iam_pool().await;
    match &pool {
        Some(pool) => tracing::debug!(
            engine = pool_engine_label(pool),
            "IAM database health pool initialized"
        ),
        None => tracing::debug!("IAM database health pool not configured"),
    }
    let _ = IAM_DATABASE_POOL.set(pool);
}

async fn load_iam_pool() -> Option<DatabasePool> {
    let configured = std::env::var("SDKWORK_IAM_DATABASE_URL")
        .ok()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);
    if !configured {
        return None;
    }
    match sdkwork_database_sqlx::create_pool_from_env(IAM_SERVICE_NAME).await {
        Ok(Some(pool)) => Some(pool),
        Ok(None) => None,
        Err(error) => {
            tracing::debug!(error = %error, "IAM database pool initialization failed");
            None
        }
    }
}

/// Returns the current health state.
///
/// Liveness reflects process availability (always true once the process runs).
/// Readiness executes a `SELECT 1` probe against the primary database to verify
/// actual connectivity, not just pool state.
pub async fn health_state(database_pool: &DatabasePool) -> HealthState {
    let database = check_database_connectivity(database_pool).await;
    let iam_database = check_iam_database_connectivity().await;
    let realtime = realtime_ok();
    let readiness = ReadinessState {
        database,
        iam_database,
        realtime,
    };
    let status = if readiness.database && readiness.iam_database && readiness.realtime {
        "healthy"
    } else {
        "degraded"
    };
    HealthState {
        status: status.to_string(),
        liveness: true,
        readiness,
    }
}

/// Executes a `SELECT 1` probe against the primary database to verify actual
/// connectivity. Returns `false` if the query fails or the pool is closed.
async fn check_database_connectivity(pool: &DatabasePool) -> bool {
    if !pool_is_open(pool) {
        return false;
    }
    match pool {
        DatabasePool::Sqlite(inner, _) => {
            sqlx::query("SELECT 1")
                .execute(inner)
                .await
                .is_ok()
        }
        DatabasePool::Postgres(inner, _) => {
            sqlx::query("SELECT 1")
                .execute(inner)
                .await
                .is_ok()
        }
    }
}

/// Executes a `SELECT 1` probe against the IAM database if configured.
async fn check_iam_database_connectivity() -> bool {
    match IAM_DATABASE_POOL.get() {
        None | Some(None) => true,
        Some(Some(pool)) => check_database_connectivity(pool).await,
    }
}

/// IAM database readiness read from the singleton pool. No new connections are
/// created and no database queries are issued.
fn iam_database_readiness() -> bool {
    match IAM_DATABASE_POOL.get() {
        None | Some(None) => true,
        Some(Some(pool)) => pool_is_open(pool),
    }
}

fn pool_is_open(pool: &DatabasePool) -> bool {
    match pool {
        DatabasePool::Sqlite(inner, _) => !inner.is_closed(),
        DatabasePool::Postgres(inner, _) => !inner.is_closed(),
    }
}

fn pool_engine_label(pool: &DatabasePool) -> &'static str {
    match pool {
        DatabasePool::Sqlite(_, _) => "sqlite",
        DatabasePool::Postgres(_, _) => "postgresql",
    }
}

pub async fn health_check(pool: DatabasePool) -> (StatusCode, Json<Value>) {
    let state = health_state(&pool).await;
    let payload = build_health_payload(&pool).await;
    let healthy = state.liveness && state.status == "healthy";
    let status_code = if healthy {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status_code, Json(payload))
}

pub async fn build_health_payload(pool: &DatabasePool) -> Value {
    let state = health_state(pool).await;
    let database_value = json!({
        "ok": state.readiness.database,
        "engine": pool_engine_label(pool),
    });
    let iam_value = iam_database_payload();
    let realtime_value = realtime_payload();
    json!({
        "status": state.status,
        "liveness": state.liveness,
        "checks": {
            "database": database_value,
            "iam_database": iam_value,
            "realtime": realtime_value,
        }
    })
}

fn iam_database_payload() -> Value {
    match IAM_DATABASE_POOL.get() {
        None | Some(None) => json!({
            "configured": false,
            "ok": true,
        }),
        Some(Some(pool)) => json!({
            "configured": true,
            "ok": pool_is_open(pool),
            "engine": pool_engine_label(pool),
        }),
    }
}

fn realtime_config() -> RealtimeConfig {
    let backend = std::env::var("SDKWORK_BIRDCODER_REALTIME_BACKEND")
        .unwrap_or_else(|_| "memory".to_string());
    let normalized = backend.trim().to_ascii_lowercase();
    let redis_enabled = std::env::var("SDKWORK_BIRDCODER_REDIS_ENABLED")
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false);
    let is_redis = normalized == "redis" || redis_enabled;
    let ok = if is_redis {
        let host = std::env::var("SDKWORK_BIRDCODER_REDIS_HOST")
            .ok()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false);
        let port = std::env::var("SDKWORK_BIRDCODER_REDIS_PORT")
            .ok()
            .and_then(|value| value.trim().parse::<u16>().ok())
            .is_some();
        host && port
    } else {
        true
    };
    RealtimeConfig {
        backend: if is_redis { "redis" } else { "memory" },
        ok,
    }
}

struct RealtimeConfig {
    backend: &'static str,
    ok: bool,
}

fn realtime_ok() -> bool {
    realtime_config().ok
}

fn realtime_payload() -> Value {
    let config = realtime_config();
    json!({
        "backend": config.backend,
        "ok": config.ok,
    })
}

#[cfg(test)]
mod tests {
    use super::{build_health_payload, health_state, init_iam_pool, pool_is_open, HealthState};
    use sdkwork_database_config::{DatabaseConfig, DatabaseEngine};
    use sdkwork_database_sqlx::create_pool_from_config;

    async fn make_sqlite_pool() -> sdkwork_database_sqlx::DatabasePool {
        let config = DatabaseConfig {
            engine: DatabaseEngine::Sqlite,
            url: "sqlite::memory:".to_string(),
            max_connections: 1,
            ..Default::default()
        };
        create_pool_from_config(config).await.expect("sqlite pool")
    }

    #[tokio::test]
    async fn pool_is_open_true_for_fresh_pool() {
        let pool = make_sqlite_pool().await;
        assert!(pool_is_open(&pool));
        pool.close().await;
    }

    #[tokio::test]
    async fn pool_is_open_false_after_close() {
        let pool = make_sqlite_pool().await;
        pool.close().await;
        assert!(!pool_is_open(&pool));
    }

    #[tokio::test]
    async fn health_state_liveness_always_true() {
        let pool = make_sqlite_pool().await;
        let state = health_state(&pool).await;
        assert!(state.liveness);
        assert!(state.readiness.database);
        pool.close().await;
    }

    #[tokio::test]
    async fn health_state_degraded_when_database_closed() {
        let pool = make_sqlite_pool().await;
        pool.close().await;
        let state = health_state(&pool).await;
        assert!(state.liveness);
        assert!(!state.readiness.database);
        assert_eq!(state.status, "degraded");
    }

    #[tokio::test]
    async fn build_health_payload_reflects_state() {
        let pool = make_sqlite_pool().await;
        let payload = build_health_payload(&pool).await;
        assert_eq!(payload["liveness"], serde_json::json!(true));
        assert_eq!(payload["status"], serde_json::json!("healthy"));
        assert_eq!(payload["checks"]["database"]["ok"], serde_json::json!(true));
        pool.close().await;
    }

    #[tokio::test]
    async fn init_iam_pool_is_idempotent() {
        // Calling twice must not panic and must reuse the singleton.
        init_iam_pool().await;
        init_iam_pool().await;
        // Without SDKWORK_IAM_DATABASE_URL the pool is None and readiness is ok.
        assert!(super::iam_database_readiness());
    }

    #[test]
    fn health_state_serializes() {
        let state = HealthState {
            status: "healthy".to_string(),
            liveness: true,
            readiness: super::ReadinessState {
                database: true,
                iam_database: true,
                realtime: true,
            },
        };
        let value = serde_json::to_value(&state).expect("serialize");
        assert_eq!(value["liveness"], serde_json::json!(true));
        assert_eq!(value["readiness"]["database"], serde_json::json!(true));
    }
}
