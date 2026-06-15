use rusqlite::Connection;
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager};

const DESKTOP_LOCAL_SQLITE_FILE_NAME: &str = "sdkwork-birdcoder-desktop-local.sqlite3";

static INITIALIZED_DATABASE_PATHS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();

pub struct TauriHostState {
    api_base_url_override: Option<String>,
}

impl TauriHostState {
    pub fn new(api_base_url_override: Option<String>) -> Self {
        Self {
            api_base_url_override,
        }
    }

    pub fn resolve_api_base_url_static(app: &AppHandle) -> Result<String, String> {
        if let Ok(url) = std::env::var("VITE_BIRDCODER_API_BASE_URL") {
            let trimmed = url.trim().to_string();
            if !trimmed.is_empty() {
                return Ok(trimmed);
            }
        }
        if let Ok(url) = std::env::var("BIRDCODER_API_BASE_URL") {
            let trimmed = url.trim().to_string();
            if !trimmed.is_empty() {
                return Ok(trimmed);
            }
        }
        if let Some(state) = app.try_state::<TauriHostState>() {
            if let Some(ref url) = state.api_base_url_override {
                return Ok(url.clone());
            }
        }
        Ok(format!("http://127.0.0.1:{}", find_available_port()?))
    }

    pub fn register(app: &AppHandle) -> Result<(), String> {
        let api_base_url_override = std::env::var("VITE_BIRDCODER_API_BASE_URL")
            .ok()
            .map(|url| url.trim().to_string())
            .filter(|url| !url.is_empty())
            .or_else(|| {
                std::env::var("BIRDCODER_API_BASE_URL")
                    .ok()
                    .map(|url| url.trim().to_string())
                    .filter(|url| !url.is_empty())
            });
        app.manage(TauriHostState::new(api_base_url_override));
        Ok(())
    }
}

pub fn local_database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let database_path = if let Some(configured_path) =
        std::env::var_os("BIRDCODER_CODING_SERVER_SQLITE_FILE")
            .map(PathBuf::from)
            .filter(|path| !path.as_os_str().is_empty())
    {
        configured_path
    } else {
        let mut app_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
        app_dir.push(DESKTOP_LOCAL_SQLITE_FILE_NAME);
        app_dir
    };
    let parent_directory = database_path.parent().ok_or_else(|| {
        format!(
            "failed to resolve parent directory for sqlite database path: {}",
            database_path.display()
        )
    })?;
    fs::create_dir_all(parent_directory)
        .map_err(|error| format!("failed to create sqlite database directory: {error}"))?;
    Ok(database_path)
}

pub fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let database_path = local_database_path(app)?;
    let connection = Connection::open(&database_path)
        .map_err(|error| format!("failed to open sqlite database: {error}"))?;
    ensure_database_ready(&connection, &database_path)?;
    Ok(connection)
}

fn ensure_database_ready(connection: &Connection, database_path: &PathBuf) -> Result<(), String> {
    let initialized_paths = INITIALIZED_DATABASE_PATHS.get_or_init(|| Mutex::new(HashSet::new()));
    let mut guard = initialized_paths
        .lock()
        .map_err(|error| format!("failed to lock sqlite initialization guard: {error}"))?;
    if guard.contains(database_path) {
        return Ok(());
    }
    initialize_minimal_schema(connection)?;
    guard.insert(database_path.clone());
    Ok(())
}

fn initialize_minimal_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS kv_store (
                scope TEXT NOT NULL,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (scope, key)
            );
            "#,
        )
        .map_err(|error| format!("failed to initialize sqlite schema: {error}"))
}

fn find_available_port() -> Result<u16, String> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|error| format!("failed to bind ephemeral port: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("failed to read ephemeral port: {error}"))?
        .port();
    Ok(port)
}
