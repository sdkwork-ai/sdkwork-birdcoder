use axum::Json;
use sdkwork_database_sqlx::DatabasePool;
use serde_json::{json, Value};

pub async fn health_check(pool: DatabasePool) -> Json<Value> {
    Json(build_health_payload(&pool).await)
}

pub async fn build_health_payload(pool: &DatabasePool) -> Value {
    let database = check_database_pool_health(pool).await;
    let healthy = database["ok"].as_bool().unwrap_or(false);

    json!({
        "status": if healthy { "healthy" } else { "degraded" },
        "checks": {
            "database": database,
        }
    })
}

async fn check_database_pool_health(pool: &DatabasePool) -> Value {
    match pool {
        sdkwork_database_sqlx::DatabasePool::Sqlite(sqlite, _) => {
            match sqlx::query("SELECT 1").fetch_one(sqlite).await {
                Ok(_) => json!({
                    "ok": true,
                    "engine": "sqlite",
                }),
                Err(_error) => json!({
                    "ok": false,
                    "engine": "sqlite",
                }),
            }
        }
        sdkwork_database_sqlx::DatabasePool::Postgres(postgres, _) => {
            match sqlx::query("SELECT 1").fetch_one(postgres).await {
                Ok(_) => json!({
                    "ok": true,
                    "engine": "postgresql",
                }),
                Err(_error) => json!({
                    "ok": false,
                    "engine": "postgresql",
                }),
            }
        }
    }
}
