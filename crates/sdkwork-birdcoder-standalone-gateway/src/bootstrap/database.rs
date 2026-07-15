use std::sync::Arc;

use sdkwork_database_config::{DatabaseConfig, DatabaseEngine};
use sdkwork_database_sqlx::{create_pool_from_config, DatabasePool};
use sqlx::SqlitePool;

use crate::bootstrap::config::BirdServerConfig;
use crate::bootstrap::legacy_sqlite::upgrade_legacy_sqlite_schema;

pub fn resolve_birdcoder_database_config(config: &BirdServerConfig) -> DatabaseConfig {
    let url = config.resolved_database_url();
    let engine = match config.resolved_database_engine().to_lowercase().as_str() {
        "sqlite" => DatabaseEngine::Sqlite,
        "postgres" | "postgresql" => DatabaseEngine::Postgres,
        _ => DatabaseEngine::from_url(&url).unwrap_or(DatabaseEngine::Sqlite),
    };

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

    let db_config = resolve_birdcoder_database_config(config);
    let pool = create_pool_from_config(db_config.clone()).await?;

    if db_config.engine == DatabaseEngine::Sqlite {
        let sqlite = require_sqlite_pool(&pool)?;
        apply_sqlite_pragmas(&sqlite).await?;
        upgrade_legacy_sqlite_schema(&sqlite).await?;
    }

    sdkwork_birdcoder_database_host::bootstrap_birdcoder_database(pool.clone())
        .await
        .map_err(|error| -> Box<dyn std::error::Error> { error.into() })?;

    tracing::info!("sdkwork-database pool ready for BIRDCODER");
    Ok(Arc::new(pool))
}

pub fn require_sqlite_pool(pool: &DatabasePool) -> Result<SqlitePool, String> {
    pool.as_sqlite()
        .cloned()
        .ok_or_else(|| "BIRDCODER database profile must use sqlite".to_string())
}

async fn apply_sqlite_pragmas(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query("PRAGMA journal_mode=WAL;")
        .execute(pool)
        .await?;
    sqlx::query("PRAGMA foreign_keys=ON;").execute(pool).await?;
    Ok(())
}
