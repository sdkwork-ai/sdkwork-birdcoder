//! Client-local user model configuration store wiring and Tauri commands.
//!
//! The user's model access channels, API keys, and per-agent-engine
//! configurations live in a dedicated SQLite file (`birdcoder-user-config.sqlite3`)
//! fully decoupled from the sdkwork-models server database. The schema is
//! owned by `sdkwork-models/database-client-local` and initialized by
//! `SqliteUserModelConfigStore::initialize_schema`.

use std::path::PathBuf;
use std::sync::{Arc, OnceLock};

use sdkwork_models_user_config_repository_sqlx::sqlite_store::SqliteUserModelConfigStore;
use sdkwork_models_user_config_repository_sqlx::{
    UserModelApiKey, UserModelChannel, UserModelConfigStore, UserModelEngineConfig,
    UserModelEngineSelection,
};
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use tauri::{AppHandle, Manager};

pub const BIRDCODER_USER_MODEL_CONFIG_DATABASE_FILE_NAME: &str = "birdcoder-user-config.sqlite3";
pub const SDKWORK_USER_MODEL_CONFIG_SQLITE_URL: &str = "SDKWORK_USER_MODEL_CONFIG_SQLITE_URL";

static USER_MODEL_CONFIG_STORE: OnceLock<Arc<SqliteUserModelConfigStore>> = OnceLock::new();

/// Resolves the client-local user model configuration database URL. An
/// explicit `SDKWORK_USER_MODEL_CONFIG_SQLITE_URL` always wins; otherwise the
/// file is created under the user-private app data directory.
pub fn apply_client_local_user_model_config_database_url(app: &AppHandle) -> Result<(), String> {
    if std::env::var_os(SDKWORK_USER_MODEL_CONFIG_SQLITE_URL)
        .is_some_and(|value| !value.is_empty())
    {
        return Ok(());
    }
    let mut database_path = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
    database_path.push(BIRDCODER_USER_MODEL_CONFIG_DATABASE_FILE_NAME);
    std::env::set_var(
        SDKWORK_USER_MODEL_CONFIG_SQLITE_URL,
        format!("sqlite:{}", database_path.display()),
    );
    Ok(())
}

fn user_model_config_database_path() -> Result<PathBuf, String> {
    let url = std::env::var(SDKWORK_USER_MODEL_CONFIG_SQLITE_URL)
        .map_err(|_| format!("{SDKWORK_USER_MODEL_CONFIG_SQLITE_URL} is not configured"))?;
    let path = url
        .strip_prefix("sqlite:")
        .ok_or_else(|| format!("unsupported user model config database url: {url}"))?;
    Ok(PathBuf::from(path))
}

/// Opens (creating the file if needed) and initializes the client-local user
/// model configuration store. Idempotent; safe to call on every startup.
pub async fn initialize_user_model_config_store() -> Result<Arc<SqliteUserModelConfigStore>, String> {
    if let Some(store) = USER_MODEL_CONFIG_STORE.get() {
        return Ok(Arc::clone(store));
    }
    let path = user_model_config_database_path()?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| format!("failed to create user model config directory: {error}"))?;
    }
    let options = SqliteConnectOptions::new()
        .filename(&path)
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
        .busy_timeout(std::time::Duration::from_secs(5));
    let pool = SqlitePoolOptions::new()
        .max_connections(4)
        .connect_with(options)
        .await
        .map_err(|error| format!("failed to open user model config database: {error}"))?;
    let store = Arc::new(SqliteUserModelConfigStore::new(pool));
    store
        .initialize_schema()
        .await
        .map_err(|error| format!("failed to initialize user model config schema: {error}"))?;
    let _ = USER_MODEL_CONFIG_STORE.set(Arc::clone(&store));
    Ok(store)
}

fn store() -> Result<&'static Arc<SqliteUserModelConfigStore>, String> {
    USER_MODEL_CONFIG_STORE
        .get()
        .ok_or_else(|| "user model config store is not initialized".to_owned())
}

#[tauri::command]
pub async fn user_model_config_list_channels() -> Result<Vec<UserModelChannel>, String> {
    store()?
        .list_channels()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_get_channel(code: String) -> Result<Option<UserModelChannel>, String> {
    store()?
        .get_channel(&code)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_upsert_channel(channel: UserModelChannel) -> Result<(), String> {
    store()?
        .upsert_channel(&channel)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_delete_channel(code: String) -> Result<(), String> {
    store()?
        .delete_channel(&code)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_get_api_key(channel_code: String) -> Result<Option<String>, String> {
    store()?
        .get_api_key(&channel_code)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_upsert_api_key(
    channel_code: String,
    api_key: String,
) -> Result<(), String> {
    store()?
        .upsert_api_key(&UserModelApiKey { channel_code, api_key })
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_list_engine_configs(
    engine_id: Option<String>,
) -> Result<Vec<UserModelEngineConfig>, String> {
    store()?
        .list_engine_configs(engine_id.as_deref())
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_upsert_engine_config(
    config: UserModelEngineConfig,
) -> Result<(), String> {
    store()?
        .upsert_engine_config(&config)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_delete_engine_config(
    engine_id: String,
    channel_code: String,
) -> Result<(), String> {
    store()?
        .delete_engine_config(&engine_id, &channel_code)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_list_engine_selections(
) -> Result<Vec<UserModelEngineSelection>, String> {
    store()?
        .list_engine_selections()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_get_engine_selection(
    engine_id: String,
) -> Result<Option<UserModelEngineSelection>, String> {
    store()?
        .get_engine_selection(&engine_id)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_upsert_engine_selection(
    selection: UserModelEngineSelection,
) -> Result<(), String> {
    store()?
        .upsert_engine_selection(&selection)
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn user_model_config_delete_engine_selection(engine_id: String) -> Result<(), String> {
    store()?
        .delete_engine_selection(&engine_id)
        .await
        .map_err(|error| error.to_string())
}
