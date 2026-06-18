use rusqlite::Connection;
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Manager};

use crate::commands::filesystem_commands::register_allowed_fs_root;

const DESKTOP_LOCAL_SQLITE_FILE_NAME: &str = "sdkwork-birdcoder-pc-desktop-local.sqlite3";
const DEFAULT_EMBEDDED_API_HOST: &str = "127.0.0.1";
const DEFAULT_EMBEDDED_API_PORT: u16 = 10240;

static INITIALIZED_DATABASE_PATHS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();
static EMBEDDED_RUNTIME_CONFIG: OnceLock<DesktopRuntimeConfig> = OnceLock::new();
static EMBEDDED_RUNTIME_STARTUP: OnceLock<
    tokio::sync::OnceCell<Result<DesktopRuntimeConfig, String>>,
> = OnceLock::new();

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopRuntimeConfig {
    pub api_base_url: String,
}

pub struct TauriHostState {
    api_base_url_override: Option<String>,
}

impl TauriHostState {
    pub fn new(api_base_url_override: Option<String>) -> Self {
        Self {
            api_base_url_override,
        }
    }

    pub fn resolve_api_base_url_static(app: &AppHandle) -> Option<String> {
        if let Some(state) = app.try_state::<TauriHostState>() {
            if let Some(ref url) = state.api_base_url_override {
                return Some(url.clone());
            }
        }
        read_explicit_api_base_url()
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
        register_runtime_fs_roots(app)?;
        Ok(())
    }
}

fn register_runtime_fs_roots(app: &AppHandle) -> Result<(), String> {
    if let Ok(project_root) = std::env::var("BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT") {
        let trimmed = project_root.trim();
        if !trimmed.is_empty() {
            register_allowed_fs_root(PathBuf::from(trimmed))?;
        }
    }
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let _ = register_allowed_fs_root(app_data_dir);
    }
    Ok(())
}

fn normalize_api_base_url(api_base_url: &str) -> Option<String> {
    let normalized_api_base_url = api_base_url.trim();
    if normalized_api_base_url.is_empty() {
        None
    } else {
        Some(normalized_api_base_url.to_string())
    }
}

fn read_explicit_api_base_url() -> Option<String> {
    std::env::var("VITE_BIRDCODER_API_BASE_URL")
        .ok()
        .as_deref()
        .and_then(normalize_api_base_url)
        .or_else(|| {
            std::env::var("BIRDCODER_API_BASE_URL")
                .ok()
                .as_deref()
                .and_then(normalize_api_base_url)
        })
}

fn resolve_listener_api_base_url(listener: &std::net::TcpListener) -> Result<String, String> {
    let local_address = listener
        .local_addr()
        .map_err(|error| format!("failed to resolve embedded BirdCoder API address: {error}"))?;
    Ok(format!("http://{local_address}"))
}

fn bind_embedded_api_listener() -> Result<(std::net::TcpListener, String), String> {
    let preferred_address = format!("{DEFAULT_EMBEDDED_API_HOST}:{DEFAULT_EMBEDDED_API_PORT}");
    match std::net::TcpListener::bind(&preferred_address) {
        Ok(listener) => {
            let api_base_url = resolve_listener_api_base_url(&listener)?;
            Ok((listener, api_base_url))
        }
        Err(error) if error.kind() == std::io::ErrorKind::AddrInUse => {
            let listener =
                std::net::TcpListener::bind((DEFAULT_EMBEDDED_API_HOST, 0)).map_err(|fallback_error| {
                    format!(
                        "failed to bind embedded BirdCoder API on {preferred_address} or a fallback loopback port: {fallback_error}"
                    )
                })?;
            let api_base_url = resolve_listener_api_base_url(&listener)?;
            eprintln!(
                "embedded BirdCoder API default port {preferred_address} is unavailable; using {api_base_url} instead."
            );
            Ok((listener, api_base_url))
        }
        Err(error) => Err(format!(
            "failed to bind embedded BirdCoder API on {preferred_address}: {error}"
        )),
    }
}

fn embedded_runtime_startup(
) -> &'static tokio::sync::OnceCell<Result<DesktopRuntimeConfig, String>> {
    EMBEDDED_RUNTIME_STARTUP.get_or_init(tokio::sync::OnceCell::new)
}

pub fn start_embedded_coding_server(app: &AppHandle) -> Result<DesktopRuntimeConfig, String> {
    if let Some(runtime_config) = EMBEDDED_RUNTIME_CONFIG.get() {
        return Ok(runtime_config.clone());
    }

    if let Some(api_base_url) = TauriHostState::resolve_api_base_url_static(app) {
        let runtime_config = DesktopRuntimeConfig { api_base_url };
        let _ = EMBEDDED_RUNTIME_CONFIG.set(runtime_config.clone());
        print_embedded_api_startup_summary(&runtime_config.api_base_url);
        return Ok(runtime_config);
    }

    let database_path = local_database_path(app)?;
    let config = sdkwork_birdcoder_api_server::bootstrap::config::BirdServerConfig {
        host: DEFAULT_EMBEDDED_API_HOST.to_string(),
        port: DEFAULT_EMBEDDED_API_PORT,
        sqlite_file: database_path,
        allowed_origins: sdkwork_birdcoder_api_server::bootstrap::config::default_allowed_origins_for_host(
            DEFAULT_EMBEDDED_API_HOST,
        ),
        project_root: std::env::var("BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT").ok(),
    };
    let router = tauri::async_runtime::block_on(sdkwork_birdcoder_api_server::bootstrap::build_app(
        &config,
    ))
    .map_err(|error| format!("failed to build embedded BirdCoder API router: {error}"))?;
    let (listener, api_base_url) = bind_embedded_api_listener()?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("failed to configure embedded BirdCoder API listener: {error}"))?;

    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(listener) {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!("failed to adopt embedded BirdCoder API listener: {error}");
                return;
            }
        };

        if let Err(error) = axum::serve(listener, router).await {
            eprintln!("embedded BirdCoder API stopped unexpectedly: {error}");
        }
    });

    let runtime_config = DesktopRuntimeConfig { api_base_url };
    let _ = EMBEDDED_RUNTIME_CONFIG.set(runtime_config.clone());
    print_embedded_api_startup_summary(&runtime_config.api_base_url);
    Ok(runtime_config)
}

pub async fn ensure_desktop_runtime_config(
    app: AppHandle,
) -> Result<DesktopRuntimeConfig, String> {
    embedded_runtime_startup()
        .get_or_init(|| async move {
            tauri::async_runtime::spawn_blocking(move || start_embedded_coding_server(&app))
                .await
                .map_err(|error| {
                    format!("failed to join embedded BirdCoder API startup task: {error}")
                })?
        })
        .await
        .clone()
}

pub fn spawn_embedded_coding_server_startup(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) = ensure_desktop_runtime_config(app).await {
            eprintln!("failed to start embedded BirdCoder API: {error}");
        }
    });
}

fn print_embedded_api_startup_summary(api_base_url: &str) {
    println!("SDKWork BirdCoder embedded API: {api_base_url}");
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
