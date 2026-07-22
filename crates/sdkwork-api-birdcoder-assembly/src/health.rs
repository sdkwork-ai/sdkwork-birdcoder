use axum::http::StatusCode;
use axum::Json;
use sdkwork_database_sqlx::DatabasePool;
use sdkwork_web_bootstrap::{ReadinessCheck, ReadinessFuture};
use serde::Serialize;
use serde_json::{json, Value};

#[derive(Clone, Debug, Serialize)]
pub struct HealthState {
    pub status: String,
    pub liveness: bool,
    pub readiness: ReadinessState,
}

#[derive(Clone, Debug, Serialize)]
pub struct ReadinessState {
    pub database: bool,
}

#[derive(Clone)]
pub struct BirdCoderReadinessCheck {
    database_pool: DatabasePool,
}

impl BirdCoderReadinessCheck {
    pub fn new(database_pool: DatabasePool) -> Self {
        Self { database_pool }
    }
}

impl ReadinessCheck for BirdCoderReadinessCheck {
    fn check(&self) -> ReadinessFuture<'_> {
        let database_pool = self.database_pool.clone();
        Box::pin(async move {
            if health_state(&database_pool).await.readiness.database {
                Ok(())
            } else {
                Err("BirdCoder database is unavailable".to_owned())
            }
        })
    }
}

pub async fn health_state(database_pool: &DatabasePool) -> HealthState {
    let database = check_database_connectivity(database_pool).await;
    HealthState {
        status: if database { "healthy" } else { "degraded" }.to_owned(),
        liveness: true,
        readiness: ReadinessState { database },
    }
}

async fn check_database_connectivity(pool: &DatabasePool) -> bool {
    if !pool_is_open(pool) {
        return false;
    }
    match pool {
        DatabasePool::Sqlite(inner, _) => sqlx::query("SELECT 1").execute(inner).await.is_ok(),
        DatabasePool::Postgres(inner, _) => sqlx::query("SELECT 1").execute(inner).await.is_ok(),
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
    let status = if state.readiness.database {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    (status, Json(build_health_payload(&pool).await))
}

pub fn liveness_check() -> (StatusCode, Json<Value>) {
    (
        StatusCode::OK,
        Json(json!({ "status": "alive", "liveness": true })),
    )
}

pub async fn build_health_payload(pool: &DatabasePool) -> Value {
    let state = health_state(pool).await;
    json!({
        "status": state.status,
        "liveness": state.liveness,
        "checks": {
            "database": {
                "ok": state.readiness.database,
                "engine": pool_engine_label(pool),
            }
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use sdkwork_database_config::{DatabaseConfig, DatabaseEngine};
    use sdkwork_database_sqlx::create_pool_from_config;

    async fn make_sqlite_pool() -> DatabasePool {
        create_pool_from_config(DatabaseConfig {
            engine: DatabaseEngine::Sqlite,
            url: "sqlite::memory:".to_owned(),
            max_connections: 1,
            ..Default::default()
        })
        .await
        .expect("sqlite pool")
    }

    #[tokio::test]
    async fn readiness_tracks_database_connectivity_only() {
        let pool = make_sqlite_pool().await;
        assert!(health_state(&pool).await.readiness.database);
        pool.close().await;
        let state = health_state(&pool).await;
        assert!(state.liveness);
        assert!(!state.readiness.database);
        assert_eq!(state.status, "degraded");
    }

    #[tokio::test]
    async fn health_payload_names_only_owned_database_dependency() {
        let pool = make_sqlite_pool().await;
        let payload = build_health_payload(&pool).await;
        assert_eq!(payload["checks"]["database"]["ok"], json!(true));
        assert!(payload["checks"].get("iam_database").is_none());
        assert!(payload["checks"].get("realtime").is_none());
    }
}
