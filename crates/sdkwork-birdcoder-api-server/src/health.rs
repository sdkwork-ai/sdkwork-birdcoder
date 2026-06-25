use axum::Json;
use sdkwork_database_sqlx::DatabasePool;
use serde_json::{json, Value};

pub async fn health_check(pool: DatabasePool) -> Json<Value> {
    Json(build_health_payload(&pool).await)
}

pub async fn build_health_payload(pool: &DatabasePool) -> Value {
    let database = check_database_pool_health(pool).await;
    let iam_database = check_iam_database_health().await;
    let realtime = check_realtime_health();
    let healthy = database["ok"].as_bool().unwrap_or(false)
        && iam_database["ok"].as_bool().unwrap_or(false)
        && realtime["ok"].as_bool().unwrap_or(false);

    json!({
        "status": if healthy { "healthy" } else { "degraded" },
        "checks": {
            "database": database,
            "iam_database": iam_database,
            "realtime": realtime,
        }
    })
}

async fn check_database_pool_health(pool: &DatabasePool) -> Value {
    match pool {
        DatabasePool::Sqlite(sqlite, _) => {
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
        DatabasePool::Postgres(postgres, _) => {
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

async fn check_iam_database_health() -> Value {
    let configured = std::env::var("SDKWORK_IAM_DATABASE_URL")
        .ok()
        .map(|value| !value.trim().is_empty())
        .unwrap_or(false);

    if !configured {
        return json!({
            "configured": false,
            "ok": true,
        });
    }

    match sdkwork_database_sqlx::create_pool_from_env("IAM").await {
        Ok(None) => json!({
            "configured": true,
            "ok": false,
            "engine": "unknown",
        }),
        Err(_) => json!({
            "configured": true,
            "ok": false,
            "engine": "unknown",
        }),
        Ok(Some(pool)) => {
            let ping = check_database_pool_health(&pool).await;
            json!({
                "configured": true,
                "ok": ping["ok"],
                "engine": ping["engine"],
            })
        },
    }
}

fn check_realtime_health() -> Value {
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

    if normalized == "redis" || redis_enabled {
        let host = std::env::var("SDKWORK_BIRDCODER_REDIS_HOST")
            .ok()
            .map(|value| !value.trim().is_empty())
            .unwrap_or(false);
        let port = std::env::var("SDKWORK_BIRDCODER_REDIS_PORT")
            .ok()
            .and_then(|value| value.trim().parse::<u16>().ok())
            .is_some();

        json!({
            "backend": "redis",
            "ok": host && port,
        })
    } else {
        json!({
            "backend": "memory",
            "ok": true,
        })
    }
}
