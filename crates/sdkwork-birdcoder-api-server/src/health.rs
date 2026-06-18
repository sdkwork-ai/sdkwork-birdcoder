use std::path::{Path, PathBuf};

use axum::Json;
use rusqlite::Connection;
use serde_json::{json, Value};

use crate::bootstrap::config::DEFAULT_SQLITE_FILE;

pub async fn health_check(sqlite_file: PathBuf) -> Json<Value> {
    Json(build_health_payload(&sqlite_file).await)
}

pub async fn build_health_payload(sqlite_file: &Path) -> Value {
    let sqlite = check_sqlite_health(sqlite_file);
    let healthy = sqlite["ok"].as_bool().unwrap_or(false);

    json!({
        "status": if healthy { "healthy" } else { "degraded" },
        "checks": {
            "sqlite": sqlite,
        }
    })
}

fn check_sqlite_health(sqlite_file: &Path) -> Value {
    match Connection::open(sqlite_file) {
        Ok(conn) => match conn.query_row("SELECT 1", [], |_| Ok(())) {
            Ok(_) => json!({
                "ok": true,
                "path": sqlite_file.display().to_string(),
            }),
            Err(error) => json!({
                "ok": false,
                "path": sqlite_file.display().to_string(),
                "error": error.to_string(),
            }),
        },
        Err(error) => json!({
            "ok": false,
            "path": sqlite_file.display().to_string(),
            "error": error.to_string(),
            "fallback": DEFAULT_SQLITE_FILE,
        }),
    }
}
