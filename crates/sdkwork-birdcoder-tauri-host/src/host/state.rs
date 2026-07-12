use rusqlite::Connection;
use std::collections::HashSet;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Manager};

use crate::commands::filesystem_commands::register_allowed_fs_root;

const DESKTOP_LOCAL_SQLITE_FILE_NAME: &str = "sdkwork-birdcoder-pc-desktop-local.sqlite3";
const DEFAULT_EMBEDDED_API_HOST: &str = "127.0.0.1";
const DEFAULT_EMBEDDED_API_PORT: u16 = 10240;
const PROVIDER_RUNTIME_ROOT_ENV: &str = "SDKWORK_AGENT_PROVIDER_RUNTIME_ROOT";
const PROVIDER_RUNTIME_DIR_NAME: &str = "provider-runtime";
const PROVIDER_RUNTIME_MANIFEST_FILE_NAME: &str = "runtime-manifest.json";
const PROVIDER_RUNTIME_MANIFEST_SCHEMA_VERSION: u32 = 1;
const PROVIDER_RUNTIME_MANIFEST_KIND: &str = "sdkwork.birdcoder.provider-runtime";

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderRuntimeManifest {
    schema_version: u32,
    kind: String,
    target: ProviderRuntimeTarget,
    node: ProviderRuntimeAsset,
    workers: Vec<ProviderRuntimeAsset>,
}

#[derive(Debug, serde::Deserialize)]
struct ProviderRuntimeTarget {
    platform: String,
    architecture: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderRuntimeAsset {
    relative_path: String,
    sha256: String,
    size: u64,
}

static INITIALIZED_DATABASE_PATHS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();
static EMBEDDED_RUNTIME_CONFIG: OnceLock<DesktopRuntimeConfig> = OnceLock::new();
static EMBEDDED_RUNTIME_STARTUP: OnceLock<tokio::sync::OnceCell<DesktopRuntimeConfig>> =
    OnceLock::new();
static EMBEDDED_API_SHUTDOWN: OnceLock<tokio::sync::watch::Sender<bool>> = OnceLock::new();

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

    pub fn resolve_api_base_url_static(app: &AppHandle) -> Result<Option<String>, String> {
        if let Some(state) = app.try_state::<TauriHostState>() {
            if let Some(ref url) = state.api_base_url_override {
                return Ok(Some(url.clone()));
            }
        }
        read_explicit_api_base_url()
    }

    pub fn register(app: &AppHandle) -> Result<(), String> {
        configure_provider_runtime_root(app)?;
        let api_base_url_override = read_explicit_api_base_url()?;
        app.manage(TauriHostState::new(api_base_url_override));
        register_runtime_fs_roots()?;
        Ok(())
    }
}

fn configure_provider_runtime_root(app: &AppHandle) -> Result<(), String> {
    if std::env::var_os(PROVIDER_RUNTIME_ROOT_ENV).is_some_and(|value| !value.is_empty()) {
        let configured_root = std::env::var_os(PROVIDER_RUNTIME_ROOT_ENV)
            .map(PathBuf::from)
            .ok_or_else(|| "provider runtime root environment value is invalid".to_string())?;
        validate_provider_runtime_root(&configured_root)?;
        return Ok(());
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("failed to resolve desktop resource directory: {error}"))?;
    if let Some(runtime_root) = provider_runtime_root_from_resource_dir(&resource_dir)? {
        std::env::set_var(PROVIDER_RUNTIME_ROOT_ENV, runtime_root);
    }
    Ok(())
}

fn provider_runtime_root_from_resource_dir(resource_dir: &Path) -> Result<Option<PathBuf>, String> {
    let runtime_root = resource_dir.join(PROVIDER_RUNTIME_DIR_NAME);
    if !runtime_root
        .join(PROVIDER_RUNTIME_MANIFEST_FILE_NAME)
        .is_file()
    {
        return Ok(None);
    }
    validate_provider_runtime_root(&runtime_root)?;
    Ok(Some(runtime_root))
}

fn validate_provider_runtime_root(runtime_root: &Path) -> Result<(), String> {
    let canonical_root = runtime_root
        .canonicalize()
        .map_err(|_| "provider runtime root cannot be resolved".to_string())?;
    if !canonical_root.is_dir() {
        return Err("provider runtime root must be a directory".to_string());
    }
    let manifest_path = canonical_root.join(PROVIDER_RUNTIME_MANIFEST_FILE_NAME);
    let manifest_source = fs::read_to_string(&manifest_path)
        .map_err(|_| "provider runtime manifest cannot be read".to_string())?;
    let manifest: ProviderRuntimeManifest = serde_json::from_str(&manifest_source)
        .map_err(|_| "provider runtime manifest is invalid".to_string())?;
    if manifest.schema_version != PROVIDER_RUNTIME_MANIFEST_SCHEMA_VERSION
        || manifest.kind != PROVIDER_RUNTIME_MANIFEST_KIND
    {
        return Err("provider runtime manifest has an unsupported schema or kind".to_string());
    }
    if manifest.target.platform != runtime_target_platform()
        || manifest.target.architecture != runtime_target_architecture()
    {
        return Err("provider runtime manifest targets a different platform".to_string());
    }
    if manifest.workers.is_empty() {
        return Err("provider runtime manifest must declare at least one worker".to_string());
    }
    validate_provider_runtime_asset(&canonical_root, &manifest.node, "node")?;
    for worker in &manifest.workers {
        validate_provider_runtime_asset(&canonical_root, worker, "worker")?;
    }
    Ok(())
}

fn validate_provider_runtime_asset(
    canonical_root: &Path,
    asset: &ProviderRuntimeAsset,
    asset_kind: &str,
) -> Result<(), String> {
    let relative_path = Path::new(asset.relative_path.trim());
    if relative_path.as_os_str().is_empty()
        || relative_path.is_absolute()
        || relative_path.components().any(|component| {
            matches!(
                component,
                Component::ParentDir | Component::RootDir | Component::Prefix(_)
            )
        })
        || asset.sha256.len() != 64
        || !asset
            .sha256
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        return Err(format!(
            "provider runtime {asset_kind} asset metadata is invalid"
        ));
    }
    let asset_path = canonical_root.join(relative_path);
    let canonical_asset_path = asset_path
        .canonicalize()
        .map_err(|_| format!("provider runtime {asset_kind} asset is missing"))?;
    if !canonical_asset_path.starts_with(canonical_root) || !canonical_asset_path.is_file() {
        return Err(format!(
            "provider runtime {asset_kind} asset escapes its runtime root"
        ));
    }
    let actual_size = fs::metadata(&canonical_asset_path)
        .map_err(|_| format!("provider runtime {asset_kind} asset metadata is unavailable"))?
        .len();
    if actual_size != asset.size {
        return Err(format!(
            "provider runtime {asset_kind} asset size does not match manifest"
        ));
    }
    Ok(())
}

fn runtime_target_platform() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    }
}

fn runtime_target_architecture() -> &'static str {
    if cfg!(target_arch = "x86_64") {
        "x64"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "unknown"
    }
}

fn register_runtime_fs_roots() -> Result<(), String> {
    if let Ok(project_root) = std::env::var("BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT") {
        let trimmed = project_root.trim();
        if !trimmed.is_empty() {
            register_allowed_fs_root(PathBuf::from(trimmed))?;
        }
    }
    Ok(())
}

fn normalize_api_base_url(api_base_url: &str) -> Result<Option<String>, String> {
    let normalized_api_base_url = api_base_url.trim();
    if normalized_api_base_url.is_empty() {
        return Ok(None);
    }

    let mut parsed_url = tauri::Url::parse(normalized_api_base_url)
        .map_err(|_| "configured API base URL is invalid".to_string())?;
    if !matches!(parsed_url.scheme(), "http" | "https")
        || parsed_url.host_str().is_none()
        || !parsed_url.username().is_empty()
        || parsed_url.password().is_some()
    {
        return Err(
            "configured API base URL must use http/https without credentials and include a host"
                .to_string(),
        );
    }

    parsed_url.set_query(None);
    parsed_url.set_fragment(None);
    let mut normalized_url = parsed_url.to_string();
    while normalized_url.ends_with('/') {
        normalized_url.pop();
    }
    Ok(Some(normalized_url))
}

fn read_explicit_api_base_url() -> Result<Option<String>, String> {
    for environment_key in ["VITE_BIRDCODER_API_BASE_URL", "BIRDCODER_API_BASE_URL"] {
        let Ok(configured_value) = std::env::var(environment_key) else {
            continue;
        };
        if let Some(normalized_url) = normalize_api_base_url(&configured_value)? {
            return Ok(Some(normalized_url));
        }
    }
    Ok(None)
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

fn embedded_runtime_startup() -> &'static tokio::sync::OnceCell<DesktopRuntimeConfig> {
    EMBEDDED_RUNTIME_STARTUP.get_or_init(tokio::sync::OnceCell::new)
}

pub fn start_embedded_coding_server(app: &AppHandle) -> Result<DesktopRuntimeConfig, String> {
    if let Some(runtime_config) = EMBEDDED_RUNTIME_CONFIG.get() {
        return Ok(runtime_config.clone());
    }

    if let Some(api_base_url) = TauriHostState::resolve_api_base_url_static(app)? {
        let runtime_config = DesktopRuntimeConfig { api_base_url };
        let _ = EMBEDDED_RUNTIME_CONFIG.set(runtime_config.clone());
        print_embedded_api_startup_summary(&runtime_config.api_base_url);
        return Ok(runtime_config);
    }

    let database_path = local_database_path(app)?;
    let config = sdkwork_birdcoder_standalone_gateway::bootstrap::config::BirdServerConfig {
        host: DEFAULT_EMBEDDED_API_HOST.to_string(),
        port: DEFAULT_EMBEDDED_API_PORT,
        sqlite_file: database_path,
        allowed_origins: sdkwork_birdcoder_standalone_gateway::bootstrap::config::default_allowed_origins_for_host(
            DEFAULT_EMBEDDED_API_HOST,
        ),
        project_root: std::env::var("BIRDCODER_LOCAL_BOOTSTRAP_PROJECT_ROOT").ok(),
        rate_limit_enabled: sdkwork_birdcoder_standalone_gateway::bootstrap::config::DEFAULT_RATE_LIMIT_ENABLED,
        rate_limit_max_requests: sdkwork_birdcoder_standalone_gateway::bootstrap::config::DEFAULT_RATE_LIMIT_MAX_REQUESTS,
        rate_limit_window_secs: sdkwork_birdcoder_standalone_gateway::bootstrap::config::DEFAULT_RATE_LIMIT_WINDOW_SECS,
    };
    let router = tauri::async_runtime::block_on(
        sdkwork_birdcoder_standalone_gateway::bootstrap::build_app(&config),
    )
    .map_err(|error| format!("failed to build embedded BirdCoder API router: {error}"))?;
    let (listener, api_base_url) = bind_embedded_api_listener()?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("failed to configure embedded BirdCoder API listener: {error}"))?;

    let (shutdown_tx, shutdown_rx) = tokio::sync::watch::channel(false);
    let _ = EMBEDDED_API_SHUTDOWN.set(shutdown_tx);

    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(listener) {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!("failed to adopt embedded BirdCoder API listener: {error}");
                return;
            }
        };

        let mut shutdown_rx = shutdown_rx;
        let shutdown = async move {
            let _ = shutdown_rx.changed().await;
        };

        if let Err(error) = axum::serve(listener, router)
            .with_graceful_shutdown(shutdown)
            .await
        {
            eprintln!("embedded BirdCoder API stopped unexpectedly: {error}");
        }
    });

    let runtime_config = DesktopRuntimeConfig { api_base_url };
    let _ = EMBEDDED_RUNTIME_CONFIG.set(runtime_config.clone());
    print_embedded_api_startup_summary(&runtime_config.api_base_url);
    Ok(runtime_config)
}

pub async fn ensure_desktop_runtime_config(app: AppHandle) -> Result<DesktopRuntimeConfig, String> {
    embedded_runtime_startup()
        .get_or_try_init(|| async move {
            tauri::async_runtime::spawn_blocking(move || start_embedded_coding_server(&app))
                .await
                .map_err(|error| {
                    format!("failed to join embedded BirdCoder API startup task: {error}")
                })?
        })
        .await
        .map(Clone::clone)
}

pub fn spawn_embedded_coding_server_startup(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) = ensure_desktop_runtime_config(app).await {
            eprintln!("failed to start embedded BirdCoder API: {error}");
        }
    });
}

/// Signals the embedded Axum server to drain in-flight requests before desktop exit.
pub fn request_embedded_api_shutdown() {
    if let Some(shutdown_tx) = EMBEDDED_API_SHUTDOWN.get() {
        let _ = shutdown_tx.send(true);
    }
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
    configure_database_connection(&connection)?;
    ensure_database_ready(&connection, &database_path)?;
    Ok(connection)
}

fn configure_database_connection(connection: &Connection) -> Result<(), String> {
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|_| "failed to configure sqlite busy timeout".to_string())?;
    connection
        .execute_batch(
            "PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;",
        )
        .map_err(|_| "failed to configure sqlite connection pragmas".to_string())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn api_base_url_validation_rejects_unsafe_schemes_and_credentials() {
        assert_eq!(
            normalize_api_base_url(" https://example.com/api/?token=ignored#fragment ")
                .expect("valid API base URL should normalize"),
            Some("https://example.com/api".to_string())
        );
        assert!(normalize_api_base_url("file:///tmp/birdcoder").is_err());
        assert!(normalize_api_base_url("https://user:password@example.com").is_err());
        assert!(normalize_api_base_url("https://").is_err());
        assert_eq!(
            normalize_api_base_url("   ").expect("empty override is allowed"),
            None
        );
    }

    #[test]
    fn sqlite_connections_enable_busy_timeout_foreign_keys_and_wal() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("test clock must be after Unix epoch")
            .as_nanos();
        let database_path = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-sqlite-pragmas-{}-{nonce}.sqlite3",
            std::process::id()
        ));
        let connection = Connection::open(&database_path).expect("temporary sqlite connection");
        configure_database_connection(&connection).expect("sqlite pragmas should configure");

        let foreign_keys: i64 = connection
            .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
            .expect("foreign_keys pragma should be readable");
        let busy_timeout: i64 = connection
            .query_row("PRAGMA busy_timeout", [], |row| row.get(0))
            .expect("busy_timeout pragma should be readable");
        let journal_mode: String = connection
            .query_row("PRAGMA journal_mode", [], |row| row.get(0))
            .expect("journal_mode pragma should be readable");
        let synchronous: i64 = connection
            .query_row("PRAGMA synchronous", [], |row| row.get(0))
            .expect("synchronous pragma should be readable");
        assert_eq!(foreign_keys, 1);
        assert_eq!(busy_timeout, 5_000);
        assert_eq!(journal_mode, "wal");
        assert_eq!(synchronous, 1);

        drop(connection);
        let _ = std::fs::remove_file(database_path.with_extension("sqlite3-shm"));
        let _ = std::fs::remove_file(database_path.with_extension("sqlite3-wal"));
        let _ = std::fs::remove_file(database_path);
    }

    #[test]
    fn provider_runtime_root_requires_packaged_manifest() {
        let resource_dir = std::env::temp_dir().join(format!(
            "birdcoder-tauri-provider-runtime-{}",
            std::process::id()
        ));
        let runtime_root = resource_dir.join(PROVIDER_RUNTIME_DIR_NAME);
        std::fs::create_dir_all(&runtime_root).expect("provider runtime fixture directory");

        assert_eq!(
            provider_runtime_root_from_resource_dir(&resource_dir)
                .expect("missing provider runtime manifest should be accepted as absent"),
            None
        );

        let node_path = runtime_root.join("node/node.exe");
        let worker_path = runtime_root.join("workers/worker.mjs");
        std::fs::create_dir_all(node_path.parent().expect("node fixture parent"))
            .expect("provider runtime node directory");
        std::fs::create_dir_all(worker_path.parent().expect("worker fixture parent"))
            .expect("provider runtime worker directory");
        std::fs::write(&node_path, b"node").expect("provider runtime node fixture");
        std::fs::write(&worker_path, b"worker").expect("provider runtime worker fixture");
        let manifest = format!(
            r#"{{
                "schemaVersion": 1,
                "kind": "{PROVIDER_RUNTIME_MANIFEST_KIND}",
                "target": {{"platform": "{}", "architecture": "{}"}},
                "node": {{"relativePath": "node/node.exe", "sha256": "{}", "size": 4}},
                "workers": [{{"relativePath": "workers/worker.mjs", "sha256": "{}", "size": 6}}]
            }}
            "#,
            runtime_target_platform(),
            runtime_target_architecture(),
            "0".repeat(64),
            "0".repeat(64),
        );
        std::fs::write(
            runtime_root.join(PROVIDER_RUNTIME_MANIFEST_FILE_NAME),
            manifest,
        )
        .expect("provider runtime fixture manifest");
        assert_eq!(
            provider_runtime_root_from_resource_dir(&resource_dir)
                .expect("valid provider runtime manifest should validate"),
            Some(runtime_root)
        );

        let _ = std::fs::remove_dir_all(resource_dir);
    }
}
