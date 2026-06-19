use std::sync::Arc;

use sdkwork_database_config::{DatabaseConfig, DatabaseEngine};
use sdkwork_database_sqlx::{create_pool_from_config, DatabasePool};
use sqlx::SqlitePool;

use crate::bootstrap::config::{sqlite_database_url, BirdServerConfig};

pub fn resolve_birdcoder_database_config(config: &BirdServerConfig) -> DatabaseConfig {
    let url = std::env::var("SDKWORK_BIRDCODER_DATABASE_URL")
        .unwrap_or_else(|_| sqlite_database_url(&config.sqlite_file));
    let engine = std::env::var("SDKWORK_BIRDCODER_DATABASE_ENGINE")
        .ok()
        .and_then(|value| match value.to_lowercase().as_str() {
            "sqlite" => Some(DatabaseEngine::Sqlite),
            "postgres" | "postgresql" => Some(DatabaseEngine::Postgres),
            _ => None,
        })
        .or_else(|| DatabaseEngine::from_url(&url))
        .unwrap_or(DatabaseEngine::Sqlite);

    DatabaseConfig {
        engine,
        url,
        ..DatabaseConfig::default()
    }
}

pub async fn bootstrap_database(
    config: &BirdServerConfig,
) -> Result<Arc<DatabasePool>, Box<dyn std::error::Error>> {
    if let Some(parent) = config.sqlite_file.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let pool = create_pool_from_config(resolve_birdcoder_database_config(config)).await?;
    let sqlite = require_sqlite_pool(&pool)?;
    ensure_schema(&sqlite).await?;
    tracing::info!("sdkwork-database pool ready for BIRDCODER");
    Ok(Arc::new(pool))
}

pub fn require_sqlite_pool(pool: &DatabasePool) -> Result<SqlitePool, String> {
    pool.as_sqlite()
        .cloned()
        .ok_or_else(|| "BIRDCODER database profile must use sqlite".to_string())
}

async fn ensure_schema(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    sqlx::query("PRAGMA journal_mode=WAL;")
        .execute(pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys=ON;")
        .execute(pool)
        .await?;

    execute_sql_batch(
        pool,
        sdkwork_birdcoder_coding_sessions_repository_sqlx::db::schema::SCHEMA_SQL,
    )
    .await
    .map_err(|e| format!("intelligence coding sessions schema: {e}"))?;

    execute_sql_batch(
        pool,
        sdkwork_birdcoder_workspace_repository_sqlx::db::schema::ALL_TABLES_DDL,
    )
    .await
    .map_err(|e| format!("platform workspace schema: {e}"))?;

    execute_sql_batch(
        pool,
        sdkwork_birdcoder_skill_packages_repository_sqlx::db::schema::ALL_TABLES_DDL,
    )
    .await
    .map_err(|e| format!("ecosystem skill packages schema: {e}"))?;

    execute_sql_batch(
        pool,
        sdkwork_birdcoder_model_config_repository_sqlx::db::schema::ALL_TABLES_DDL,
    )
    .await
    .map_err(|e| format!("runtime model config schema: {e}"))?;

    execute_sql_batch(
        pool,
        sdkwork_birdcoder_membership_repository_sqlx::db::schema::ALL_TABLES_DDL,
    )
    .await
    .map_err(|e| format!("commerce membership schema: {e}"))?;

    Ok(())
}

async fn execute_sql_batch(pool: &SqlitePool, sql: &str) -> Result<(), sqlx::Error> {
    for statement in sql.split(';').map(str::trim).filter(|part| !part.is_empty()) {
        sqlx::query(statement).execute(pool).await?;
    }
    Ok(())
}
