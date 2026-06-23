use axum::Json;
use serde_json::{json, Value};
use sqlx::SqlitePool;

pub async fn health_check(pool: SqlitePool) -> Json<Value> {
    Json(build_health_payload(&pool).await)
}

pub async fn build_health_payload(pool: &SqlitePool) -> Value {
    let sqlite = check_sqlite_pool_health(pool).await;
    let healthy = sqlite["ok"].as_bool().unwrap_or(false);

    json!({
        "status": if healthy { "healthy" } else { "degraded" },
        "checks": {
            "sqlite": sqlite,
        }
    })
}

async fn check_sqlite_pool_health(pool: &SqlitePool) -> Value {
    match sqlx::query("SELECT 1").fetch_one(pool).await {
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
