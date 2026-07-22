use sdkwork_database_config::{DatabaseConfig, DatabaseEngine};
use sdkwork_database_sqlx::create_pool_from_config;

use crate::bootstrap::config::BirdServerConfig;

pub fn resolve_birdcoder_database_config(
    config: &BirdServerConfig,
) -> Result<DatabaseConfig, sdkwork_database_config::ConfigError> {
    let url = config.resolved_database_url();
    let engine = match config.resolved_database_engine().to_lowercase().as_str() {
        "sqlite" => DatabaseEngine::Sqlite,
        "postgres" | "postgresql" => DatabaseEngine::Postgres,
        _ => DatabaseEngine::from_url(&url).unwrap_or(DatabaseEngine::Sqlite),
    };

    if engine == DatabaseEngine::Postgres {
        return DatabaseConfig::from_env("CLAW");
    }

    Ok(DatabaseConfig {
        engine,
        url,
        ..DatabaseConfig::default()
    })
}

pub async fn bootstrap_database(
    config: &BirdServerConfig,
) -> Result<sdkwork_birdcoder_database_host::BirdcoderDatabaseHost, Box<dyn std::error::Error>> {
    let db_config = resolve_birdcoder_database_config(config)?;
    if db_config.engine == DatabaseEngine::Sqlite {
        if let Some(parent) = config.sqlite_file.parent() {
            std::fs::create_dir_all(parent)?;
        }
    }
    let pool = create_pool_from_config(db_config.clone()).await?;

    let host = sdkwork_birdcoder_database_host::bootstrap_birdcoder_database(pool)
        .await
        .map_err(|error| -> Box<dyn std::error::Error> { error.into() })?;

    tracing::info!("sdkwork-database pool ready for BIRDCODER");
    Ok(host)
}
