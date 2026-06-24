use sdkwork_database_config::DatabaseEngine;
use sdkwork_database_sqlx::{create_any_pool_from_config, DatabasePool};
use sqlx::AnyPool;

fn normalize_sqlite_any_url(url: &str) -> String {
    if !url.starts_with("sqlite://") {
        return url.to_string();
    }
    if url.starts_with("sqlite:///") || url.starts_with("sqlite::memory:") {
        return url.to_string();
    }

    let without_scheme = url.trim_start_matches("sqlite://");
    let (path, query) = match without_scheme.split_once('?') {
        Some((path, query)) => (path, Some(query)),
        None => (without_scheme, None),
    };
    let normalized_path = path.trim_start_matches('/');
    match query {
        Some(query) => format!("sqlite:///{normalized_path}?{query}"),
        None => format!("sqlite:///{normalized_path}"),
    }
}

/// Resolve a sqlx `AnyPool` for BirdCoder repository crates from the bootstrap pool.
pub async fn birdcoder_repository_any_pool(pool: &DatabasePool) -> Result<AnyPool, String> {
    let mut config = pool.config().clone();
    if config.engine == DatabaseEngine::Sqlite {
        config.sqlite.create_if_missing = true;
        config.url = normalize_sqlite_any_url(&config.url);
    }

    create_any_pool_from_config(config)
        .await
        .map_err(|error| error.to_string())
}
