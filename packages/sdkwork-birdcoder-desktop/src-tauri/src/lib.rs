use rusqlite::{
    params, params_from_iter,
    types::{Value as SqlValue, ValueRef},
    Connection,
};
use sdkwork_birdcoder_server::{
    build_app_from_sqlite_file, initialize_sqlite_provider_authority_schema,
    print_coding_server_startup_summary, BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV,
    BIRD_SERVER_DEFAULT_BIND_ADDRESS, BIRD_SERVER_DEFAULT_HOST,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map as JsonMap, Number as JsonNumber, Value as JsonValue};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

mod file_system_watch;
mod terminal_bridge;
mod window_controls_bridge;

const RESERVED_AUTHORITY_LOCAL_STORE_KEY_PREFIX: &str = "table.sqlite.";
const DESKTOP_LOCAL_SQLITE_FILE_NAME: &str = "sdkwork-birdcoder-desktop-local.sqlite3";
const LEGACY_DESKTOP_SQLITE_FILE_NAME: &str = "sdkwork-birdcoder.sqlite3";
const DEFAULT_BOOTSTRAP_WORKSPACE_ID: &str = "100000000000000101";
const DEFAULT_BOOTSTRAP_WORKSPACE_NAME: &str = "Default Workspace";
const DEFAULT_BOOTSTRAP_WORKSPACE_DESCRIPTION: &str = "Primary local workspace for BirdCoder.";
const DEFAULT_BOOTSTRAP_WORKSPACE_OWNER_USER_ID: &str = "100000000000000001";
const DEFAULT_DESKTOP_LOCAL_USER_ID: &str = "user-local-default";
const DEFAULT_BOOTSTRAP_TENANT_ID: &str = "0";
const DEFAULT_BOOTSTRAP_ORGANIZATION_ID: &str = "0";
const DEFAULT_PRIVATE_DATA_SCOPE_VALUE: i64 = 1;
const USER_HOME_CONFIG_RELATIVE_ROOT: &str = ".sdkwork/birdcoder";

static DESKTOP_RUNTIME_CONFIG: OnceLock<DesktopRuntimeConfig> = OnceLock::new();
static DESKTOP_RUNTIME_STARTUP: OnceLock<
    tokio::sync::OnceCell<Result<DesktopRuntimeConfig, String>>,
> = OnceLock::new();
static INITIALIZED_DATABASE_PATHS: OnceLock<Mutex<HashSet<PathBuf>>> = OnceLock::new();

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopRuntimeConfig {
    api_base_url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalStoreEntry {
    scope: String,
    key: String,
    value: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalSqlPlanStatement {
    sql: String,
    #[serde(default)]
    params: Vec<JsonValue>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalSqlPlan {
    provider_id: String,
    #[allow(dead_code)]
    intent: String,
    #[serde(default)]
    meta: Option<JsonValue>,
    #[serde(default)]
    statements: Vec<LocalSqlPlanStatement>,
    transactional: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalSqlExecutionResult {
    affected_row_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    rows: Option<Vec<JsonMap<String, JsonValue>>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalCliProfileDetectRequest {
    profile_id: String,
    executable: String,
    aliases: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalCliProfileAvailability {
    profile_id: String,
    status: String,
    resolved_executable: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileSystemSnapshotResponse {
    root_virtual_path: String,
    tree: FileSystemNode,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileSystemDirectoryListingResponse {
    root_virtual_path: String,
    directory: FileSystemNode,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileSystemFileRevisionProbeResponse {
    revision: Option<String>,
    missing: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct FileSystemNode {
    name: String,
    #[serde(rename = "type")]
    kind: String,
    path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    children: Option<Vec<FileSystemNode>>,
}

fn build_virtual_child_path(parent_path: &str, name: &str) -> String {
    if parent_path == "/" {
        format!("/{name}")
    } else {
        format!("{parent_path}/{name}")
    }
}

fn sort_file_system_nodes(nodes: &mut [FileSystemNode]) {
    nodes.sort_by(|left, right| {
        if left.kind != right.kind {
            return if left.kind == "directory" {
                std::cmp::Ordering::Less
            } else {
                std::cmp::Ordering::Greater
            };
        }

        left.name.cmp(&right.name)
    });
}

fn build_directory_entry_node(
    entry_name: String,
    entry_type: &fs::FileType,
    entry_virtual_path: &str,
) -> Option<FileSystemNode> {
    if entry_type.is_dir() {
        return Some(FileSystemNode {
            name: entry_name,
            kind: "directory".to_string(),
            path: entry_virtual_path.to_string(),
            children: None,
        });
    }

    if entry_type.is_file() {
        return Some(FileSystemNode {
            name: entry_name,
            kind: "file".to_string(),
            path: entry_virtual_path.to_string(),
            children: None,
        });
    }

    None
}

fn resolve_root_directory_path(root_path: &str) -> Result<PathBuf, String> {
    let normalized_root_path = root_path.trim();
    if normalized_root_path.is_empty() {
        return Err("root path must not be empty".to_string());
    }

    let root_directory = PathBuf::from(normalized_root_path);
    if !root_directory.exists() {
        return Err(format!(
            "mounted root directory does not exist: {}",
            root_directory.display()
        ));
    }

    if !root_directory.is_dir() {
        return Err(format!(
            "mounted root path must be a directory: {}",
            root_directory.display()
        ));
    }

    Ok(root_directory)
}

fn resolve_root_directory_name(root_directory: &Path) -> String {
    root_directory
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .map(|value| value.to_string())
        .unwrap_or_else(|| "mounted-folder".to_string())
}

fn normalize_relative_path(relative_path: &str) -> Result<PathBuf, String> {
    let trimmed_relative_path = relative_path.trim();
    if trimmed_relative_path.is_empty() {
        return Err("relative path must not be empty".to_string());
    }

    let mut normalized_path = PathBuf::new();
    for component in Path::new(trimmed_relative_path).components() {
        match component {
            Component::CurDir => {}
            Component::Normal(value) => normalized_path.push(value),
            Component::ParentDir => {
                return Err("relative path must not traverse outside the mounted root".to_string())
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("relative path must stay relative to the mounted root".to_string())
            }
        }
    }

    if normalized_path.as_os_str().is_empty() {
        return Err("relative path must not be empty".to_string());
    }

    Ok(normalized_path)
}

fn build_virtual_path_from_relative(root_virtual_path: &str, relative_path: &Path) -> String {
    let normalized_root_virtual_path =
        if root_virtual_path.ends_with('/') && root_virtual_path.len() > 1 {
            &root_virtual_path[..root_virtual_path.len() - 1]
        } else {
            root_virtual_path
        };

    let mut virtual_path = normalized_root_virtual_path.to_string();
    for component in relative_path.components() {
        if let Component::Normal(value) = component {
            virtual_path.push('/');
            virtual_path.push_str(&value.to_string_lossy());
        }
    }

    virtual_path
}

fn resolve_scoped_path(root_path: &str, relative_path: &str) -> Result<PathBuf, String> {
    let root_directory = resolve_root_directory_path(root_path)?;
    let normalized_relative_path = normalize_relative_path(relative_path)?;
    Ok(root_directory.join(normalized_relative_path))
}

fn resolve_user_home_config_path(relative_path: &str) -> Result<PathBuf, String> {
    let normalized_relative_path = normalize_relative_path(relative_path)?;
    if !normalized_relative_path.starts_with(USER_HOME_CONFIG_RELATIVE_ROOT) {
        return Err(format!(
            "user home config path must stay under {USER_HOME_CONFIG_RELATIVE_ROOT}"
        ));
    }
    if normalized_relative_path == Path::new(USER_HOME_CONFIG_RELATIVE_ROOT) {
        return Err(format!(
            "user home config path must target a file under {USER_HOME_CONFIG_RELATIVE_ROOT}"
        ));
    }

    let home_directory = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .ok_or_else(|| "failed to resolve user home directory".to_string())?;

    Ok(home_directory.join(normalized_relative_path))
}

fn build_directory_listing(
    directory_path: &Path,
    virtual_path: &str,
) -> Result<FileSystemNode, String> {
    let mut children = Vec::new();
    let entries = fs::read_dir(directory_path).map_err(|error| {
        format!(
            "failed to enumerate directory '{}': {error}",
            directory_path.display()
        )
    })?;

    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "failed to inspect directory entry '{}': {error}",
                directory_path.display()
            )
        })?;
        let entry_path = entry.path();
        let entry_name = entry.file_name().to_string_lossy().to_string();
        let entry_type = entry.file_type().map_err(|error| {
            format!(
                "failed to inspect entry type '{}': {error}",
                entry_path.display()
            )
        })?;
        let child_virtual_path = build_virtual_child_path(virtual_path, &entry_name);

        if let Some(child) =
            build_directory_entry_node(entry_name, &entry_type, &child_virtual_path)
        {
            children.push(child);
        }
    }

    sort_file_system_nodes(&mut children);

    Ok(FileSystemNode {
        name: resolve_root_directory_name(directory_path),
        kind: "directory".to_string(),
        path: virtual_path.to_string(),
        children: Some(children),
    })
}

fn build_directory_snapshot(
    directory_path: &Path,
    virtual_path: &str,
) -> Result<FileSystemNode, String> {
    let mut children = Vec::new();
    let entries = fs::read_dir(directory_path).map_err(|error| {
        format!(
            "failed to enumerate directory '{}': {error}",
            directory_path.display()
        )
    })?;

    for entry in entries {
        let entry = entry.map_err(|error| {
            format!(
                "failed to inspect directory entry '{}': {error}",
                directory_path.display()
            )
        })?;
        let entry_path = entry.path();
        let entry_name = entry.file_name().to_string_lossy().to_string();
        let entry_type = entry.file_type().map_err(|error| {
            format!(
                "failed to inspect entry type '{}': {error}",
                entry_path.display()
            )
        })?;
        let child_virtual_path = build_virtual_child_path(virtual_path, &entry_name);

        if entry_type.is_dir() {
            children.push(build_directory_snapshot(&entry_path, &child_virtual_path)?);
        } else if entry_type.is_file() {
            children.push(FileSystemNode {
                name: entry_name,
                kind: "file".to_string(),
                path: child_virtual_path,
                children: None,
            });
        }
    }

    sort_file_system_nodes(&mut children);

    Ok(FileSystemNode {
        name: resolve_root_directory_name(directory_path),
        kind: "directory".to_string(),
        path: virtual_path.to_string(),
        children: Some(children),
    })
}

fn local_database_path(app: &AppHandle) -> Result<PathBuf, String> {
    let database_path = if let Some(configured_path) =
        std::env::var_os(BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV)
            .map(PathBuf::from)
            .filter(|path| !path.as_os_str().is_empty())
    {
        configured_path
    } else {
        let mut app_dir = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("failed to resolve app data directory: {error}"))?;
        app_dir.push("sdkwork-birdcoder.sqlite3");
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

fn sqlite_table_exists(connection: &Connection, table_name: &str) -> Result<bool, String> {
    let mut statement = connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1")
        .map_err(|error| format!("prepare sqlite table probe for {table_name} failed: {error}"))?;
    let mut rows = statement
        .query([table_name])
        .map_err(|error| format!("query sqlite table probe for {table_name} failed: {error}"))?;

    rows.next()
        .map(|row| row.is_some())
        .map_err(|error| format!("read sqlite table probe for {table_name} failed: {error}"))
}

fn sqlite_column_exists(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
) -> Result<bool, String> {
    let pragma = format!("PRAGMA table_info({table_name})");
    let mut statement = connection
        .prepare(&pragma)
        .map_err(|error| format!("prepare sqlite table info for {table_name} failed: {error}"))?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("query sqlite table info for {table_name} failed: {error}"))?;

    for row in rows {
        let existing_column_name = row
            .map_err(|error| format!("read sqlite table info for {table_name} failed: {error}"))?;
        if existing_column_name == column_name {
            return Ok(true);
        }
    }

    Ok(false)
}

fn ensure_sqlite_table_column(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
    column_sql: &str,
) -> Result<(), String> {
    if sqlite_column_exists(connection, table_name, column_name)? {
        return Ok(());
    }

    connection
        .execute(
            &format!("ALTER TABLE {table_name} ADD COLUMN {column_sql}"),
            [],
        )
        .map_err(|error| {
            format!("alter sqlite table {table_name} add column {column_name} failed: {error}")
        })?;

    Ok(())
}

fn derive_legacy_run_configuration_config_key(storage_id: &str, rowid: i64) -> String {
    let normalized_storage_id = storage_id.trim();
    if normalized_storage_id.is_empty() {
        return format!("config-{rowid}");
    }

    if normalized_storage_id.starts_with("run-config:") {
        if let Some(candidate) = normalized_storage_id.rsplit(':').next() {
            let normalized_candidate = candidate.trim();
            if !normalized_candidate.is_empty() {
                return normalized_candidate.to_string();
            }
        }
    }

    normalized_storage_id.to_string()
}

fn backfill_legacy_run_configuration_config_keys(connection: &Connection) -> Result<(), String> {
    if !sqlite_table_exists(connection, "run_configurations")?
        || !sqlite_column_exists(connection, "run_configurations", "config_key")?
    {
        return Ok(());
    }

    let mut statement = connection
        .prepare(
            r#"
            SELECT rowid, id, scope_type, scope_id, config_key
            FROM run_configurations
            ORDER BY created_at ASC, rowid ASC
            "#,
        )
        .map_err(|error| format!("prepare legacy run configuration backfill failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, Option<String>>(4)?,
            ))
        })
        .map_err(|error| format!("query legacy run configuration backfill failed: {error}"))?;

    let mut scoped_key_counts = HashMap::<(String, String, String), usize>::new();
    let mut updates = Vec::<(i64, String)>::new();

    for row in rows {
        let (rowid, storage_id, scope_type, scope_id, existing_config_key) =
            row.map_err(|error| format!("read legacy run configuration row failed: {error}"))?;
        let base_config_key = existing_config_key
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_string)
            .unwrap_or_else(|| derive_legacy_run_configuration_config_key(&storage_id, rowid));
        let occurrence_key = (
            scope_type.clone(),
            scope_id.clone(),
            base_config_key.clone(),
        );
        let next_occurrence = scoped_key_counts.entry(occurrence_key).or_insert(0);
        *next_occurrence += 1;

        let config_key = if *next_occurrence == 1 {
            base_config_key
        } else {
            format!("{base_config_key}-{}", next_occurrence)
        };

        updates.push((rowid, config_key));
    }

    drop(statement);

    for (rowid, config_key) in updates {
        connection
            .execute(
                "UPDATE run_configurations SET config_key = ?1 WHERE rowid = ?2",
                params![config_key, rowid],
            )
            .map_err(|error| {
                format!(
                    "update legacy run configuration config_key for row {rowid} failed: {error}"
                )
            })?;
    }

    Ok(())
}

fn ensure_runtime_schema_backfill(connection: &Connection) -> Result<(), String> {
    if sqlite_table_exists(connection, "coding_sessions")? {
        ensure_sqlite_table_column(connection, "coding_sessions", "uuid", "uuid TEXT NULL")?;
        ensure_sqlite_table_column(
            connection,
            "coding_sessions",
            "host_mode",
            "host_mode TEXT NOT NULL DEFAULT 'desktop'",
        )?;
        ensure_sqlite_table_column(
            connection,
            "coding_sessions",
            "native_session_id",
            "native_session_id TEXT NULL",
        )?;
        ensure_sqlite_table_column(
            connection,
            "coding_sessions",
            "sort_timestamp",
            "sort_timestamp INTEGER NULL",
        )?;
        ensure_sqlite_table_column(
            connection,
            "coding_sessions",
            "transcript_updated_at",
            "transcript_updated_at TEXT NULL",
        )?;
        ensure_sqlite_table_column(
            connection,
            "coding_sessions",
            "pinned",
            "pinned INTEGER NOT NULL DEFAULT 0",
        )?;
        ensure_sqlite_table_column(
            connection,
            "coding_sessions",
            "archived",
            "archived INTEGER NOT NULL DEFAULT 0",
        )?;
        ensure_sqlite_table_column(
            connection,
            "coding_sessions",
            "unread",
            "unread INTEGER NOT NULL DEFAULT 0",
        )?;
        connection
            .execute(
                r#"
                UPDATE coding_sessions
                SET host_mode = 'desktop'
                WHERE TRIM(COALESCE(host_mode, '')) = ''
                   OR host_mode = 'server'
                "#,
                [],
            )
            .map_err(|error| {
                format!("backfill desktop coding session host mode failed: {error}")
            })?;
    }

    if sqlite_table_exists(connection, "run_configurations")? {
        ensure_sqlite_table_column(connection, "run_configurations", "uuid", "uuid TEXT NULL")?;
        ensure_sqlite_table_column(
            connection,
            "run_configurations",
            "tenant_id",
            "tenant_id INTEGER NOT NULL DEFAULT 0",
        )?;
        ensure_sqlite_table_column(
            connection,
            "run_configurations",
            "organization_id",
            "organization_id INTEGER NOT NULL DEFAULT 0",
        )?;
        ensure_sqlite_table_column(
            connection,
            "run_configurations",
            "config_key",
            "config_key TEXT NOT NULL DEFAULT ''",
        )?;
        backfill_legacy_run_configuration_config_keys(connection)?;
    }

    Ok(())
}

fn initialize_database_schema(connection: &Connection) -> Result<(), String> {
    initialize_sqlite_provider_authority_schema(connection)?;
    ensure_runtime_schema_backfill(connection)?;
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

            CREATE TABLE IF NOT EXISTS schema_migration_history (
                id TEXT PRIMARY KEY,
                migration_id TEXT NOT NULL,
                provider_id TEXT NOT NULL,
                status TEXT NOT NULL,
                details_json TEXT NOT NULL DEFAULT '{}',
                applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS run_configurations (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                workspace_id TEXT NOT NULL DEFAULT '',
                project_id TEXT NOT NULL DEFAULT '',
                scope_type TEXT NOT NULL DEFAULT 'global',
                scope_id TEXT NOT NULL DEFAULT '',
                config_key TEXT NOT NULL DEFAULT '',
                name TEXT NOT NULL,
                command TEXT NOT NULL,
                profile_id TEXT NOT NULL,
                group_name TEXT NOT NULL DEFAULT 'custom',
                cwd_mode TEXT NOT NULL DEFAULT 'project',
                custom_cwd TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS terminal_executions (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                workspace_id TEXT NOT NULL DEFAULT '',
                project_id TEXT NOT NULL DEFAULT '',
                session_id TEXT NOT NULL,
                command TEXT NOT NULL,
                args_json TEXT NOT NULL DEFAULT '[]',
                cwd TEXT NOT NULL DEFAULT '',
                stdout_ref TEXT NOT NULL DEFAULT '',
                stderr_ref TEXT NOT NULL DEFAULT '',
                exit_code INTEGER NULL,
                started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ended_at TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS workbench_preferences (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                scope_type TEXT NOT NULL DEFAULT 'global',
                scope_id TEXT NOT NULL DEFAULT '',
                code_engine_id TEXT NOT NULL DEFAULT 'codex',
                code_model_id TEXT NOT NULL DEFAULT 'gpt-5.4',
                terminal_profile_id TEXT NOT NULL DEFAULT 'powershell',
                payload_json TEXT NOT NULL DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS engine_registry (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                engine_id TEXT NOT NULL,
                display_name TEXT NOT NULL,
                vendor TEXT NOT NULL,
                installation_kind TEXT NOT NULL,
                default_model_id TEXT NOT NULL,
                transport_kinds_json TEXT NOT NULL DEFAULT '[]',
                capability_matrix_json TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS model_catalog (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                engine_id TEXT NOT NULL,
                model_id TEXT NOT NULL,
                display_name TEXT NOT NULL,
                provider_id TEXT NULL,
                transport_kinds_json TEXT NOT NULL DEFAULT '[]',
                capability_matrix_json TEXT NOT NULL DEFAULT '{}',
                is_default INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'active'
            );

            CREATE TABLE IF NOT EXISTS engine_bindings (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                scope_type TEXT NOT NULL,
                scope_id TEXT NOT NULL,
                engine_id TEXT NOT NULL,
                model_id TEXT NOT NULL,
                host_modes_json TEXT NOT NULL DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS coding_sessions (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                workspace_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                entry_surface TEXT NOT NULL DEFAULT 'code',
                host_mode TEXT NOT NULL DEFAULT 'desktop',
                engine_id TEXT NOT NULL,
                model_id TEXT NOT NULL,
                last_turn_at TEXT NULL,
                native_session_id TEXT NULL,
                sort_timestamp INTEGER NULL,
                transcript_updated_at TEXT NULL,
                pinned INTEGER NOT NULL DEFAULT 0,
                archived INTEGER NOT NULL DEFAULT 0,
                unread INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS coding_session_messages (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                version INTEGER NOT NULL,
                is_deleted INTEGER NOT NULL,
                coding_session_id TEXT NOT NULL,
                turn_id TEXT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata_json TEXT NOT NULL,
                timestamp_ms INTEGER NULL,
                name TEXT NULL,
                tool_calls_json TEXT NULL,
                tool_call_id TEXT NULL,
                file_changes_json TEXT NULL,
                commands_json TEXT NULL,
                task_progress_json TEXT NULL
            );

            CREATE TABLE IF NOT EXISTS coding_session_runtimes (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                coding_session_id TEXT NOT NULL,
                engine_id TEXT NOT NULL,
                model_id TEXT NOT NULL,
                host_mode TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'ready',
                transport_kind TEXT NOT NULL,
                native_session_id TEXT NULL,
                native_turn_container_id TEXT NULL,
                capability_snapshot_json TEXT NOT NULL DEFAULT '{}',
                metadata_json TEXT NOT NULL DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS coding_session_events (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                coding_session_id TEXT NOT NULL,
                turn_id TEXT NULL,
                runtime_id TEXT NULL,
                event_kind TEXT NOT NULL,
                sequence_no INTEGER NOT NULL,
                payload_json TEXT NOT NULL DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS coding_session_artifacts (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                coding_session_id TEXT NOT NULL,
                turn_id TEXT NULL,
                artifact_kind TEXT NOT NULL,
                title TEXT NOT NULL,
                blob_ref TEXT NULL,
                metadata_json TEXT NOT NULL DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS coding_session_checkpoints (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                coding_session_id TEXT NOT NULL,
                runtime_id TEXT NULL,
                checkpoint_kind TEXT NOT NULL,
                resumable INTEGER NOT NULL DEFAULT 0,
                state_json TEXT NOT NULL DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS coding_session_operations (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                coding_session_id TEXT NOT NULL,
                turn_id TEXT NULL,
                status TEXT NOT NULL,
                stream_url TEXT NOT NULL DEFAULT '',
                stream_kind TEXT NOT NULL DEFAULT 'sse',
                artifact_refs_json TEXT NOT NULL DEFAULT '[]'
            );

            CREATE TABLE IF NOT EXISTS coding_session_prompt_entries (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                coding_session_id TEXT NOT NULL,
                prompt_text TEXT NOT NULL,
                normalized_prompt_text TEXT NOT NULL,
                last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                use_count INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS saved_prompt_entries (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                prompt_text TEXT NOT NULL,
                normalized_prompt_text TEXT NOT NULL,
                last_saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                use_count INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS plus_workspace (
                id INTEGER PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                data_scope INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                name TEXT NOT NULL,
                code TEXT NULL,
                title TEXT NULL,
                description TEXT NULL,
                owner_id INTEGER NOT NULL,
                leader_id INTEGER NULL,
                created_by_user_id INTEGER NULL,
                icon TEXT NULL,
                color TEXT NULL,
                type TEXT NULL,
                start_time TEXT NULL,
                end_time TEXT NULL,
                max_members INTEGER NULL,
                current_members INTEGER NULL,
                member_count INTEGER NULL,
                max_storage INTEGER NULL,
                used_storage INTEGER NULL,
                settings_json TEXT NULL,
                is_public INTEGER NOT NULL DEFAULT 0,
                is_template INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS plus_project (
                id INTEGER PRIMARY KEY,
                uuid TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                v INTEGER NOT NULL DEFAULT 0,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                data_scope INTEGER NOT NULL DEFAULT 1,
                parent_id INTEGER NULL,
                parent_uuid TEXT NULL,
                parent_metadata TEXT NULL,
                user_id INTEGER NULL,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                cover_image TEXT NULL,
                author TEXT NULL,
                file_id INTEGER NULL,
                code TEXT NOT NULL,
                type INTEGER NOT NULL,
                site_path TEXT NULL,
                domain_prefix TEXT NULL,
                description TEXT NULL,
                status INTEGER NOT NULL,
                conversation_id INTEGER NULL,
                workspace_id INTEGER NULL,
                workspace_uuid TEXT NULL,
                leader_id INTEGER NULL,
                start_time TEXT NULL,
                end_time TEXT NULL,
                budget_amount INTEGER NULL,
                is_deleted INTEGER NOT NULL,
                is_template INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS plus_project_content (
                id INTEGER PRIMARY KEY,
                uuid TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                v INTEGER NOT NULL DEFAULT 0,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                data_scope INTEGER NOT NULL DEFAULT 1,
                user_id INTEGER NULL,
                parent_id INTEGER NULL,
                project_id INTEGER NOT NULL,
                project_uuid TEXT NOT NULL,
                config_data TEXT NULL,
                content_data TEXT NULL,
                metadata TEXT NULL,
                content_version TEXT NOT NULL,
                content_hash TEXT NULL
            );

            CREATE TABLE IF NOT EXISTS skill_packages (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                slug TEXT NOT NULL,
                source_uri TEXT NOT NULL,
                status TEXT NOT NULL,
                manifest_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS skill_versions (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                skill_package_id TEXT NOT NULL,
                version_label TEXT NOT NULL,
                manifest_json TEXT NOT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS skill_capabilities (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                skill_version_id TEXT NOT NULL,
                capability_key TEXT NOT NULL,
                description_text TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS skill_installations (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                scope_type TEXT NOT NULL,
                scope_id TEXT NOT NULL,
                skill_version_id TEXT NOT NULL,
                status TEXT NOT NULL,
                installed_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_templates (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                slug TEXT NOT NULL,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_template_versions (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                app_template_id TEXT NOT NULL,
                version_label TEXT NOT NULL,
                manifest_json TEXT NOT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_template_target_profiles (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                app_template_version_id TEXT NOT NULL,
                profile_key TEXT NOT NULL,
                runtime TEXT NOT NULL,
                deployment_mode TEXT NOT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_template_presets (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                app_template_version_id TEXT NOT NULL,
                preset_key TEXT NOT NULL,
                description_text TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_template_instantiations (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                project_id TEXT NOT NULL,
                app_template_version_id TEXT NOT NULL,
                preset_key TEXT NOT NULL,
                status TEXT NOT NULL,
                output_root TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS teams (
                id INTEGER PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                workspace_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                code TEXT NULL,
                title TEXT NULL,
                description TEXT NULL,
                owner_id INTEGER NOT NULL,
                leader_id INTEGER NULL,
                created_by_user_id INTEGER NULL,
                metadata_json TEXT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS project_documents (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                project_id TEXT NOT NULL,
                document_kind TEXT NOT NULL,
                title TEXT NOT NULL,
                slug TEXT NOT NULL,
                body_ref TEXT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS deployment_targets (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                environment_key TEXT NOT NULL,
                runtime TEXT NOT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS deployment_records (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                project_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                release_record_id TEXT NULL,
                status TEXT NOT NULL,
                endpoint_url TEXT NULL,
                started_at TEXT NULL,
                completed_at TEXT NULL
            );

            CREATE TABLE IF NOT EXISTS team_members (
                id INTEGER PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                team_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                created_by_user_id INTEGER NULL,
                granted_by_user_id INTEGER NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS workspace_members (
                id INTEGER PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                workspace_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                team_id INTEGER NULL,
                role TEXT NOT NULL,
                created_by_user_id INTEGER NULL,
                granted_by_user_id INTEGER NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS project_collaborators (
                id INTEGER PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                project_id INTEGER NOT NULL,
                workspace_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                team_id INTEGER NULL,
                role TEXT NOT NULL,
                created_by_user_id INTEGER NULL,
                granted_by_user_id INTEGER NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS release_records (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                release_version TEXT NOT NULL,
                release_kind TEXT NOT NULL,
                rollout_stage TEXT NOT NULL,
                manifest_json TEXT NOT NULL DEFAULT '{}',
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_events (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                scope_type TEXT NOT NULL,
                scope_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS governance_policies (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id INTEGER NOT NULL DEFAULT 0,
                organization_id INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                scope_type TEXT NOT NULL,
                scope_id TEXT NOT NULL,
                policy_category TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                approval_policy TEXT NOT NULL,
                rationale TEXT NULL,
                status TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_run_configurations_scope_group
            ON run_configurations(scope_type, scope_id, group_name);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_run_configurations_scope_config_key
            ON run_configurations(scope_type, scope_id, config_key);

            CREATE INDEX IF NOT EXISTS idx_terminal_executions_session_started
            ON terminal_executions(session_id, started_at DESC);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_workbench_preferences_scope
            ON workbench_preferences(scope_type, scope_id);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_engine_registry_engine_id
            ON engine_registry(engine_id);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_model_catalog_engine_model
            ON model_catalog(engine_id, model_id);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_engine_bindings_scope_engine
            ON engine_bindings(scope_type, scope_id, engine_id);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_schema_migration_history_provider_migration
            ON schema_migration_history(provider_id, migration_id);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_project_name
            ON plus_project(name);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_plus_project_code
            ON plus_project(code);

            CREATE INDEX IF NOT EXISTS idx_plus_project_content_project_id
            ON plus_project_content(project_id);

            CREATE INDEX IF NOT EXISTS idx_plus_project_content_project_uuid
            ON plus_project_content(project_uuid);

            CREATE INDEX IF NOT EXISTS idx_coding_sessions_project_updated
            ON coding_sessions(project_id, updated_at);

            CREATE INDEX IF NOT EXISTS idx_coding_sessions_project_sort
            ON coding_sessions(project_id, sort_timestamp);

            CREATE INDEX IF NOT EXISTS idx_coding_session_messages_session_created
            ON coding_session_messages(coding_session_id, created_at);

            CREATE INDEX IF NOT EXISTS idx_coding_session_runtimes_session_updated
            ON coding_session_runtimes(coding_session_id, updated_at);

            CREATE INDEX IF NOT EXISTS idx_coding_session_events_session_sequence
            ON coding_session_events(coding_session_id, sequence_no);

            CREATE INDEX IF NOT EXISTS idx_coding_session_artifacts_session_created
            ON coding_session_artifacts(coding_session_id, created_at);

            CREATE INDEX IF NOT EXISTS idx_coding_session_checkpoints_session_created
            ON coding_session_checkpoints(coding_session_id, created_at);

            CREATE INDEX IF NOT EXISTS idx_coding_session_operations_session_created
            ON coding_session_operations(coding_session_id, created_at);

            CREATE INDEX IF NOT EXISTS idx_coding_session_prompt_entries_session_last_used
            ON coding_session_prompt_entries(coding_session_id, last_used_at);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_coding_session_prompt_entries_session_normalized_prompt
            ON coding_session_prompt_entries(coding_session_id, normalized_prompt_text);

            CREATE INDEX IF NOT EXISTS idx_saved_prompt_entries_last_saved
            ON saved_prompt_entries(last_saved_at);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_saved_prompt_entries_normalized_prompt
            ON saved_prompt_entries(normalized_prompt_text);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_coding_session_operations_turn
            ON coding_session_operations(turn_id);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_release_records_version
            ON release_records(release_version);

            INSERT OR IGNORE INTO schema_migration_history (
                id, migration_id, provider_id, status, details_json
            )
            VALUES (
                'runtime-data-kernel-v1',
                'runtime-data-kernel-v1',
                'sqlite',
                'applied',
                '{"source":"desktop-open-database"}'
            );

            INSERT OR IGNORE INTO schema_migration_history (
                id, migration_id, provider_id, status, details_json
            )
            VALUES (
                'coding-server-kernel-v2',
                'coding-server-kernel-v2',
                'sqlite',
                'applied',
                '{"source":"desktop-open-database","coverage":"authority-direct-provider-schema"}'
            );
            "#,
        )
        .map_err(|error| format!("failed to initialize sqlite schema: {error}"))
}

fn local_store_key_targets_authority_tables(key: &str) -> bool {
    key.starts_with(RESERVED_AUTHORITY_LOCAL_STORE_KEY_PREFIX)
}

fn purge_reserved_authority_local_store_rows(connection: &Connection) -> Result<(), String> {
    connection
        .execute("DELETE FROM kv_store WHERE key LIKE 'table.sqlite.%'", [])
        .map_err(|error| format!("failed to purge legacy authority local-store rows: {error}"))?;
    connection
        .execute(
            "DELETE FROM schema_migration_history WHERE migration_id = 'coding-server-authority-backfill-v1'",
            [],
        )
        .map_err(|error| format!("failed to purge legacy authority backfill migration marker: {error}"))?;
    Ok(())
}

fn ensure_bootstrap_workspace_authority(connection: &Connection) -> Result<(), String> {
    let workspace_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM plus_workspace AS workspaces WHERE is_deleted = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("failed to count bootstrap workspaces: {error}"))?;
    if workspace_count > 0 {
        return Ok(());
    }

    connection
        .execute(
            r#"
            INSERT INTO plus_workspace AS workspaces (
                id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted,
                data_scope, name, code, title, description, owner_id, leader_id, created_by_user_id, type,
                settings_json, is_public, is_template, status
            )
            VALUES (
                ?1, ?2, ?3, ?4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0,
                ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17
            )
            "#,
            params![
                DEFAULT_BOOTSTRAP_WORKSPACE_ID,
                "workspace-uuid-default",
                DEFAULT_BOOTSTRAP_TENANT_ID,
                DEFAULT_BOOTSTRAP_ORGANIZATION_ID,
                DEFAULT_PRIVATE_DATA_SCOPE_VALUE,
                DEFAULT_BOOTSTRAP_WORKSPACE_NAME,
                DEFAULT_BOOTSTRAP_WORKSPACE_ID,
                DEFAULT_BOOTSTRAP_WORKSPACE_NAME,
                DEFAULT_BOOTSTRAP_WORKSPACE_DESCRIPTION,
                DEFAULT_BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                DEFAULT_BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                DEFAULT_BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                "DEFAULT",
                "{}",
                0_i64,
                0_i64,
                "active",
            ],
        )
        .map_err(|error| format!("failed to insert bootstrap workspace authority row: {error}"))?;

    Ok(())
}

#[derive(Debug)]
struct PlusWorkspaceIdentity {
    id: String,
    uuid: Option<String>,
}

#[derive(Debug)]
struct LegacyDesktopLocalProject {
    legacy_id: String,
    legacy_workspace_id: String,
    name: String,
    title: Option<String>,
    description: Option<String>,
    root_path: String,
    status: String,
    created_at: String,
    updated_at: String,
}

fn is_desktop_local_sqlite_database_path(database_path: &Path) -> bool {
    database_path
        .file_name()
        .and_then(|file_name| file_name.to_str())
        == Some(DESKTOP_LOCAL_SQLITE_FILE_NAME)
}

fn legacy_desktop_local_sibling_database_path(database_path: &Path) -> Option<PathBuf> {
    if !is_desktop_local_sqlite_database_path(database_path) {
        return None;
    }

    Some(database_path.with_file_name(LEGACY_DESKTOP_SQLITE_FILE_NAME))
}

fn is_windows_absolute_project_path(path: &str) -> bool {
    let bytes = path.as_bytes();
    bytes.len() >= 3
        && bytes[1] == b':'
        && bytes[0].is_ascii_alphabetic()
        && (bytes[2] == b'\\' || bytes[2] == b'/')
}

fn is_absolute_project_path(path: &str) -> bool {
    is_windows_absolute_project_path(path) || path.starts_with("\\\\") || path.starts_with('/')
}

fn collapse_project_path_separators(path: &str) -> String {
    let preserve_unc_prefix = path.starts_with("//");
    let mut collapsed = String::with_capacity(path.len());
    let mut previous_was_separator = false;

    for character in path.chars() {
        if character == '/' {
            if preserve_unc_prefix && collapsed.len() < 2 {
                collapsed.push(character);
            } else if !previous_was_separator {
                collapsed.push(character);
            }
            previous_was_separator = true;
            continue;
        }

        collapsed.push(character);
        previous_was_separator = false;
    }

    collapsed
}

fn normalize_project_root_path_for_comparison(root_path: &str) -> Option<String> {
    let trimmed_root_path = root_path.trim();
    if trimmed_root_path.is_empty() || !is_absolute_project_path(trimmed_root_path) {
        return None;
    }

    let windows_path =
        is_windows_absolute_project_path(trimmed_root_path) || trimmed_root_path.contains('\\');
    let normalized_separators = trimmed_root_path.replace('\\', "/");
    let collapsed_path = collapse_project_path_separators(&normalized_separators);
    let without_trailing_separator = if collapsed_path == "/" {
        collapsed_path
    } else {
        collapsed_path.trim_end_matches('/').to_string()
    };

    Some(if windows_path {
        without_trailing_separator.to_ascii_lowercase()
    } else {
        without_trailing_separator
    })
}

fn read_root_path_from_project_config_data(config_data: &str) -> Option<String> {
    let parsed_config = serde_json::from_str::<JsonValue>(config_data).ok()?;
    let config_object = parsed_config.as_object()?;
    for key in ["rootPath", "root_path"] {
        let root_path = config_object
            .get(key)
            .and_then(|value| value.as_str())
            .map(str::trim)
            .filter(|value| !value.is_empty());
        if let Some(root_path) = root_path {
            return Some(root_path.to_string());
        }
    }

    None
}

fn collect_current_plus_project_root_paths(
    connection: &Connection,
) -> Result<HashSet<String>, String> {
    let mut root_paths = HashSet::new();

    if sqlite_table_exists(connection, "plus_project_content")? {
        let mut statement = connection
            .prepare("SELECT config_data FROM plus_project_content WHERE config_data IS NOT NULL")
            .map_err(|error| {
                format!("prepare plus_project_content root path scan failed: {error}")
            })?;
        let rows = statement
            .query_map([], |row| row.get::<_, Option<String>>(0))
            .map_err(|error| {
                format!("query plus_project_content root path scan failed: {error}")
            })?;
        for row in rows {
            let config_data = row.map_err(|error| {
                format!("read plus_project_content root path row failed: {error}")
            })?;
            let Some(config_data) = config_data else {
                continue;
            };
            let Some(root_path) = read_root_path_from_project_config_data(&config_data) else {
                continue;
            };
            if let Some(normalized_root_path) =
                normalize_project_root_path_for_comparison(&root_path)
            {
                root_paths.insert(normalized_root_path);
            }
        }
    }

    if sqlite_table_exists(connection, "plus_project")?
        && sqlite_column_exists(connection, "plus_project", "root_path")?
    {
        let mut statement = connection
            .prepare(
                r#"
                SELECT root_path
                FROM plus_project
                WHERE is_deleted = 0
                  AND root_path IS NOT NULL
                "#,
            )
            .map_err(|error| format!("prepare plus_project root_path scan failed: {error}"))?;
        let rows = statement
            .query_map([], |row| row.get::<_, Option<String>>(0))
            .map_err(|error| format!("query plus_project root_path scan failed: {error}"))?;
        for row in rows {
            let root_path =
                row.map_err(|error| format!("read plus_project root_path row failed: {error}"))?;
            let Some(root_path) = root_path else {
                continue;
            };
            if let Some(normalized_root_path) =
                normalize_project_root_path_for_comparison(&root_path)
            {
                root_paths.insert(normalized_root_path);
            }
        }
    }

    Ok(root_paths)
}

fn read_default_plus_workspace_identity(
    connection: &Connection,
) -> Result<PlusWorkspaceIdentity, String> {
    if !sqlite_table_exists(connection, "plus_workspace")? {
        return Ok(PlusWorkspaceIdentity {
            id: DEFAULT_BOOTSTRAP_WORKSPACE_ID.to_string(),
            uuid: Some("workspace-uuid-default".to_string()),
        });
    }

    let mut statement = connection
        .prepare(
            r#"
            SELECT CAST(id AS TEXT), uuid
            FROM plus_workspace
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
            "#,
        )
        .map_err(|error| format!("prepare plus_workspace default lookup failed: {error}"))?;
    let mut rows = statement
        .query([])
        .map_err(|error| format!("query plus_workspace default lookup failed: {error}"))?;
    if let Some(row) = rows
        .next()
        .map_err(|error| format!("read plus_workspace default row failed: {error}"))?
    {
        return Ok(PlusWorkspaceIdentity {
            id: row
                .get::<_, String>(0)
                .map_err(|error| format!("read plus_workspace id failed: {error}"))?,
            uuid: row
                .get::<_, Option<String>>(1)
                .map_err(|error| format!("read plus_workspace uuid failed: {error}"))?,
        });
    }

    Ok(PlusWorkspaceIdentity {
        id: DEFAULT_BOOTSTRAP_WORKSPACE_ID.to_string(),
        uuid: Some("workspace-uuid-default".to_string()),
    })
}

fn collect_existing_plus_project_text_values(
    connection: &Connection,
    column_name: &str,
) -> Result<HashSet<String>, String> {
    let mut values = HashSet::new();
    if !sqlite_table_exists(connection, "plus_project")?
        || !sqlite_column_exists(connection, "plus_project", column_name)?
    {
        return Ok(values);
    }

    let sql = format!("SELECT {column_name} FROM plus_project WHERE {column_name} IS NOT NULL");
    let mut statement = connection
        .prepare(&sql)
        .map_err(|error| format!("prepare plus_project {column_name} scan failed: {error}"))?;
    let rows = statement
        .query_map([], |row| row.get::<_, Option<String>>(0))
        .map_err(|error| format!("query plus_project {column_name} scan failed: {error}"))?;
    for row in rows {
        let value = row
            .map_err(|error| format!("read plus_project {column_name} scan row failed: {error}"))?;
        let Some(value) = value.map(|candidate| candidate.trim().to_string()) else {
            continue;
        };
        if !value.is_empty() {
            values.insert(value);
        }
    }

    Ok(values)
}

fn reserve_unique_text_value(
    existing_values: &mut HashSet<String>,
    base_value: String,
    suffix_separator: &str,
) -> String {
    let normalized_base_value = base_value.trim();
    let base_value = if normalized_base_value.is_empty() {
        "legacy-project".to_string()
    } else {
        normalized_base_value.to_string()
    };
    let mut candidate = base_value.clone();
    let mut duplicate_index = 2_i64;
    while existing_values.contains(&candidate) {
        candidate = format!("{base_value}{suffix_separator}{duplicate_index}");
        duplicate_index += 1;
    }
    existing_values.insert(candidate.clone());
    candidate
}

fn stable_legacy_project_suffix(project: &LegacyDesktopLocalProject) -> String {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in format!("{}|{}", project.legacy_id, project.root_path).bytes() {
        hash ^= u64::from(byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }

    format!("{hash:016x}").chars().take(12).collect()
}

fn normalize_legacy_project_status(status: &str) -> &'static str {
    if status.trim().eq_ignore_ascii_case("archived") {
        "archived"
    } else {
        "active"
    }
}

fn normalize_legacy_project_timestamp(timestamp: &str) -> String {
    let normalized_timestamp = timestamp.trim();
    if normalized_timestamp.is_empty() {
        "1970-01-01T00:00:00.000Z".to_string()
    } else {
        normalized_timestamp.to_string()
    }
}

fn read_legacy_desktop_local_projects(
    legacy_connection: &Connection,
) -> Result<Vec<LegacyDesktopLocalProject>, String> {
    if !sqlite_table_exists(legacy_connection, "projects")? {
        return Ok(Vec::new());
    }

    let title_expr = if sqlite_column_exists(legacy_connection, "projects", "title")? {
        "title"
    } else {
        "NULL"
    };
    let description_expr = if sqlite_column_exists(legacy_connection, "projects", "description")? {
        "description"
    } else {
        "NULL"
    };
    let sql = format!(
        r#"
        SELECT
            id,
            workspace_id,
            name,
            {title_expr} AS title,
            {description_expr} AS description,
            root_path,
            status,
            created_at,
            updated_at
        FROM projects
        WHERE COALESCE(is_deleted, 0) = 0
          AND TRIM(COALESCE(root_path, '')) <> ''
        ORDER BY updated_at ASC, id ASC
        "#
    );
    let mut statement = legacy_connection
        .prepare(&sql)
        .map_err(|error| format!("prepare legacy projects scan failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(LegacyDesktopLocalProject {
                legacy_id: row.get::<_, String>(0)?,
                legacy_workspace_id: row.get::<_, String>(1)?,
                name: row.get::<_, String>(2)?,
                title: row.get::<_, Option<String>>(3)?,
                description: row.get::<_, Option<String>>(4)?,
                root_path: row.get::<_, String>(5)?,
                status: row.get::<_, String>(6)?,
                created_at: row.get::<_, String>(7)?,
                updated_at: row.get::<_, String>(8)?,
            })
        })
        .map_err(|error| format!("query legacy projects scan failed: {error}"))?;

    let mut projects = Vec::new();
    for row in rows {
        let project = row.map_err(|error| format!("read legacy project row failed: {error}"))?;
        if normalize_project_root_path_for_comparison(&project.root_path).is_some() {
            projects.push(project);
        }
    }

    Ok(projects)
}

fn next_plus_project_id(connection: &Connection) -> Result<i64, String> {
    connection
        .query_row(
            "SELECT COALESCE(MAX(CAST(id AS INTEGER)), 100000000000000200) + 1 FROM plus_project",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("read next plus_project id failed: {error}"))
}

fn import_legacy_desktop_local_projects_from_sibling(
    connection: &Connection,
    database_path: &Path,
) -> Result<(), String> {
    let Some(legacy_database_path) = legacy_desktop_local_sibling_database_path(database_path)
    else {
        return Ok(());
    };
    if !legacy_database_path.exists() || legacy_database_path == database_path {
        return Ok(());
    }

    let legacy_connection = Connection::open(&legacy_database_path).map_err(|error| {
        format!(
            "failed to open legacy desktop-local sqlite database {}: {error}",
            legacy_database_path.display()
        )
    })?;
    let legacy_projects = read_legacy_desktop_local_projects(&legacy_connection)?;
    if legacy_projects.is_empty() {
        return Ok(());
    }

    let workspace = read_default_plus_workspace_identity(connection)?;
    let mut known_root_paths = collect_current_plus_project_root_paths(connection)?;
    let mut known_names = collect_existing_plus_project_text_values(connection, "name")?;
    let mut known_codes = collect_existing_plus_project_text_values(connection, "code")?;
    let mut known_uuids = collect_existing_plus_project_text_values(connection, "uuid")?;
    let mut next_project_id = next_plus_project_id(connection)?;

    for project in legacy_projects {
        let Some(normalized_root_path) =
            normalize_project_root_path_for_comparison(&project.root_path)
        else {
            continue;
        };
        if known_root_paths.contains(&normalized_root_path) {
            continue;
        }

        let suffix = stable_legacy_project_suffix(&project);
        let display_title = project
            .title
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| project.name.trim());
        let display_title = if display_title.is_empty() {
            format!("Legacy Project {suffix}")
        } else {
            display_title.to_string()
        };
        let project_name = reserve_unique_text_value(
            &mut known_names,
            format!("{display_title} [legacy:{suffix}]"),
            " ",
        );
        let project_code = reserve_unique_text_value(
            &mut known_codes,
            format!("LEGACY-{}", suffix.to_ascii_uppercase()),
            "-",
        );
        let project_uuid =
            reserve_unique_text_value(&mut known_uuids, format!("legacy-project-{suffix}"), "-");
        let project_content_uuid = format!("legacy-project-content-{suffix}");
        let project_id = next_project_id;
        next_project_id += 1;
        let created_at = normalize_legacy_project_timestamp(&project.created_at);
        let updated_at = normalize_legacy_project_timestamp(&project.updated_at);
        let config_data = serde_json::json!({
            "rootPath": project.root_path,
        })
        .to_string();
        let metadata = serde_json::json!({
            "source": "legacy-desktop-local-projects",
            "legacyProjectId": project.legacy_id,
            "legacyWorkspaceId": project.legacy_workspace_id,
        })
        .to_string();

        connection
            .execute(
                r#"
                INSERT INTO plus_project (
                    id, uuid, created_at, updated_at, v, tenant_id, organization_id, data_scope,
                    parent_id, parent_uuid, parent_metadata, user_id, name, title, cover_image,
                    author, file_id, code, type, site_path, domain_prefix, description, status,
                    conversation_id, workspace_id, workspace_uuid, leader_id, start_time, end_time,
                    budget_amount, is_deleted, is_template
                )
                VALUES (
                    ?1, ?2, ?3, ?4, 0, ?5, ?6, ?7,
                    0, NULL, NULL, ?8, ?9, ?10, NULL,
                    ?8, NULL, ?11, 1, NULL, NULL, ?12, ?13,
                    NULL, ?14, ?15, ?8, NULL, NULL,
                    NULL, 0, 0
                )
                "#,
                params![
                    project_id,
                    &project_uuid,
                    &created_at,
                    &updated_at,
                    DEFAULT_BOOTSTRAP_TENANT_ID,
                    DEFAULT_BOOTSTRAP_ORGANIZATION_ID,
                    DEFAULT_PRIVATE_DATA_SCOPE_VALUE,
                    DEFAULT_DESKTOP_LOCAL_USER_ID,
                    &project_name,
                    &display_title,
                    &project_code,
                    project.description.as_deref(),
                    normalize_legacy_project_status(&project.status),
                    &workspace.id,
                    workspace.uuid.as_deref(),
                ],
            )
            .map_err(|error| {
                format!(
                    "insert imported legacy project {} into plus_project failed: {error}",
                    project.legacy_id
                )
            })?;
        connection
            .execute(
                r#"
                INSERT INTO plus_project_content (
                    id, uuid, created_at, updated_at, v, tenant_id, organization_id, data_scope,
                    user_id, parent_id, project_id, project_uuid, config_data, content_data,
                    metadata, content_version, content_hash
                )
                VALUES (
                    ?1, ?2, ?3, ?4, 0, ?5, ?6, ?7,
                    ?8, 0, ?1, ?9, ?10, NULL,
                    ?11, '1.0', NULL
                )
                "#,
                params![
                    project_id,
                    &project_content_uuid,
                    &created_at,
                    &updated_at,
                    DEFAULT_BOOTSTRAP_TENANT_ID,
                    DEFAULT_BOOTSTRAP_ORGANIZATION_ID,
                    DEFAULT_PRIVATE_DATA_SCOPE_VALUE,
                    DEFAULT_DESKTOP_LOCAL_USER_ID,
                    &project_uuid,
                    &config_data,
                    &metadata,
                ],
            )
            .map_err(|error| {
                format!(
                    "insert imported legacy project {} into plus_project_content failed: {error}",
                    project.legacy_id
                )
            })?;
        known_root_paths.insert(normalized_root_path);
    }

    Ok(())
}

fn initialized_database_paths() -> &'static Mutex<HashSet<PathBuf>> {
    INITIALIZED_DATABASE_PATHS.get_or_init(|| Mutex::new(HashSet::new()))
}

fn ensure_database_ready(connection: &Connection, database_path: &Path) -> Result<(), String> {
    let mut initialized_paths = initialized_database_paths()
        .lock()
        .map_err(|error| format!("failed to lock sqlite initialization guard: {error}"))?;
    if initialized_paths.contains(database_path) {
        return Ok(());
    }

    initialize_database_schema(connection)?;
    purge_reserved_authority_local_store_rows(connection)?;
    ensure_bootstrap_workspace_authority(connection)?;
    if let Err(error) = import_legacy_desktop_local_projects_from_sibling(connection, database_path)
    {
        eprintln!("failed to import legacy desktop-local projects: {error}");
    }
    initialized_paths.insert(database_path.to_path_buf());

    Ok(())
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let database_path = local_database_path(app)?;
    let connection = Connection::open(&database_path)
        .map_err(|error| format!("failed to open sqlite database: {error}"))?;
    ensure_database_ready(&connection, &database_path)?;
    Ok(connection)
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
    let local_address = listener.local_addr().map_err(|error| {
        format!("failed to resolve embedded coding server local address: {error}")
    })?;
    Ok(format!("http://{local_address}"))
}

fn bind_embedded_coding_server_listener(
    preferred_bind_address: &str,
    fallback_host: &str,
) -> Result<(std::net::TcpListener, String), String> {
    match std::net::TcpListener::bind(preferred_bind_address) {
        Ok(listener) => {
            let api_base_url = resolve_listener_api_base_url(&listener)?;
            Ok((listener, api_base_url))
        }
        Err(error) if error.kind() == std::io::ErrorKind::AddrInUse => {
            let listener = std::net::TcpListener::bind((fallback_host, 0)).map_err(|fallback_error| {
                format!(
                    "failed to bind embedded coding server on {preferred_bind_address} or a fallback loopback port: {fallback_error}"
                )
            })?;
            let api_base_url = resolve_listener_api_base_url(&listener)?;
            eprintln!(
                "embedded coding server default port {preferred_bind_address} is unavailable; using {api_base_url} instead."
            );
            Ok((listener, api_base_url))
        }
        Err(error) => Err(format!(
            "failed to bind embedded coding server on {preferred_bind_address}: {error}"
        )),
    }
}

fn desktop_runtime_startup() -> &'static tokio::sync::OnceCell<Result<DesktopRuntimeConfig, String>>
{
    DESKTOP_RUNTIME_STARTUP.get_or_init(tokio::sync::OnceCell::new)
}

fn start_embedded_coding_server(app: &AppHandle) -> Result<DesktopRuntimeConfig, String> {
    if let Some(runtime_config) = DESKTOP_RUNTIME_CONFIG.get() {
        return Ok(runtime_config.clone());
    }

    if let Some(api_base_url) = read_explicit_api_base_url() {
        let runtime_config = DesktopRuntimeConfig { api_base_url };
        let _ = DESKTOP_RUNTIME_CONFIG.set(runtime_config.clone());
        print_coding_server_startup_summary(&runtime_config.api_base_url);
        return Ok(runtime_config);
    }

    let connection = open_database(app)?;
    drop(connection);

    let database_path = local_database_path(app)?;
    let router = build_app_from_sqlite_file(&database_path)?;
    let (listener, api_base_url) = bind_embedded_coding_server_listener(
        BIRD_SERVER_DEFAULT_BIND_ADDRESS,
        BIRD_SERVER_DEFAULT_HOST,
    )?;
    listener
        .set_nonblocking(true)
        .map_err(|error| format!("failed to configure embedded coding server listener: {error}"))?;

    tauri::async_runtime::spawn(async move {
        let listener = match tokio::net::TcpListener::from_std(listener) {
            Ok(listener) => listener,
            Err(error) => {
                eprintln!("failed to adopt embedded coding server listener: {error}");
                return;
            }
        };

        if let Err(error) = axum::serve(listener, router).await {
            eprintln!("embedded coding server stopped unexpectedly: {error}");
        }
    });

    let runtime_config = DesktopRuntimeConfig { api_base_url };
    let _ = DESKTOP_RUNTIME_CONFIG.set(runtime_config.clone());
    print_coding_server_startup_summary(&runtime_config.api_base_url);
    Ok(runtime_config)
}

async fn ensure_desktop_runtime_config(app: AppHandle) -> Result<DesktopRuntimeConfig, String> {
    desktop_runtime_startup()
        .get_or_init(|| async move {
            tauri::async_runtime::spawn_blocking(move || start_embedded_coding_server(&app))
                .await
                .map_err(|error| {
                    format!("failed to join embedded coding server startup task: {error}")
                })?
        })
        .await
        .clone()
}

fn spawn_embedded_coding_server_startup(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(error) = ensure_desktop_runtime_config(app).await {
            eprintln!("failed to start embedded coding server: {error}");
        }
    });
}

#[tauri::command]
fn host_mode() -> &'static str {
    "desktop"
}

#[tauri::command]
async fn desktop_runtime_config(app: AppHandle) -> Result<DesktopRuntimeConfig, String> {
    ensure_desktop_runtime_config(app).await
}

fn json_value_to_sql_value(value: &JsonValue) -> SqlValue {
    match value {
        JsonValue::Null => SqlValue::Null,
        JsonValue::Bool(value) => SqlValue::Integer(if *value { 1 } else { 0 }),
        JsonValue::Number(value) => {
            if let Some(integer_value) = value.as_i64() {
                SqlValue::Integer(integer_value)
            } else if let Some(unsigned_value) = value.as_u64() {
                match i64::try_from(unsigned_value) {
                    Ok(integer_value) => SqlValue::Integer(integer_value),
                    Err(_) => SqlValue::Text(unsigned_value.to_string()),
                }
            } else if let Some(real_value) = value.as_f64() {
                SqlValue::Real(real_value)
            } else {
                SqlValue::Null
            }
        }
        JsonValue::String(value) => SqlValue::Text(value.clone()),
        JsonValue::Array(_) | JsonValue::Object(_) => SqlValue::Text(value.to_string()),
    }
}

fn sqlite_value_to_json(value: ValueRef<'_>) -> JsonValue {
    match value {
        ValueRef::Null => JsonValue::Null,
        ValueRef::Integer(value) => JsonValue::String(value.to_string()),
        ValueRef::Real(value) => JsonNumber::from_f64(value)
            .map(JsonValue::Number)
            .unwrap_or(JsonValue::Null),
        ValueRef::Text(value) => JsonValue::String(String::from_utf8_lossy(value).to_string()),
        ValueRef::Blob(value) => JsonValue::String(String::from_utf8_lossy(value).to_string()),
    }
}

fn normalize_local_sql(sql: &str) -> String {
    sql.trim().trim_end_matches(';').trim().to_string()
}

fn is_local_sql_read_statement(sql: &str) -> bool {
    normalize_local_sql(sql)
        .to_ascii_uppercase()
        .starts_with("SELECT ")
}

fn is_safe_local_sql_identifier(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
}

fn read_local_sql_plan_meta_kind(plan: &LocalSqlPlan) -> Option<&str> {
    plan.meta
        .as_ref()
        .and_then(JsonValue::as_object)
        .and_then(|meta| meta.get("kind"))
        .and_then(JsonValue::as_str)
}

fn read_local_sql_plan_allowed_tables(plan: &LocalSqlPlan) -> Result<Vec<String>, String> {
    let Some(meta) = plan.meta.as_ref().and_then(JsonValue::as_object) else {
        return if plan.statements.is_empty() {
            Ok(Vec::new())
        } else {
            Err("local SQL plan metadata is required for non-empty plans".to_string())
        };
    };

    let table_names = if read_local_sql_plan_meta_kind(plan) == Some("migration") {
        meta.get("tableNames")
            .and_then(JsonValue::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(JsonValue::as_str)
                    .map(str::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default()
    } else {
        meta.get("tableName")
            .and_then(JsonValue::as_str)
            .map(|table_name| vec![table_name.to_string()])
            .unwrap_or_default()
    };

    if plan.statements.is_empty() {
        return Ok(table_names);
    }
    if table_names.is_empty() {
        return Err("local SQL plan metadata must include tableName or tableNames".to_string());
    }
    if table_names
        .iter()
        .any(|table_name| !is_safe_local_sql_identifier(table_name))
    {
        return Err("local SQL plan metadata contains an unsafe table name".to_string());
    }

    Ok(table_names)
}

fn normalize_sql_for_table_match(sql: &str) -> String {
    sql.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_uppercase()
}

fn local_sql_mentions_allowed_table(sql: &str, allowed_tables: &[String]) -> bool {
    let normalized_sql = normalize_sql_for_table_match(sql);
    let padded_sql = format!(" {normalized_sql} ");

    allowed_tables.iter().any(|table_name| {
        let table_name = table_name.to_ascii_uppercase();
        [
            format!(" FROM {table_name} "),
            format!(" INTO {table_name} "),
            format!(" UPDATE {table_name} "),
            format!(" DELETE FROM {table_name} "),
            format!(" TABLE {table_name} "),
            format!(" TABLE IF NOT EXISTS {table_name} "),
            format!(" ON {table_name} "),
        ]
        .iter()
        .any(|pattern| padded_sql.contains(pattern))
    })
}

fn validate_local_sql_statement(
    sql: &str,
    allowed_tables: &[String],
    allow_create: bool,
) -> Result<String, String> {
    let normalized_sql = normalize_local_sql(sql);
    if normalized_sql.is_empty() {
        return Err("local SQL plan contains an empty statement".to_string());
    }
    if normalized_sql.contains(';') {
        return Err("local SQL plan statements must contain exactly one SQL statement".to_string());
    }

    let upper_sql = normalized_sql.to_ascii_uppercase();
    let allowed_prefixes = ["SELECT ", "INSERT ", "UPDATE ", "DELETE ", "CREATE "];
    if !allowed_prefixes
        .iter()
        .any(|prefix| upper_sql.starts_with(prefix))
    {
        return Err(format!(
            "local SQL plan statement is not allowed: {}",
            upper_sql.split_whitespace().next().unwrap_or("<empty>")
        ));
    }

    if upper_sql.starts_with("CREATE ") && !allow_create {
        return Err("local SQL CREATE statements are only allowed for migration plans".to_string());
    }

    for forbidden_token in ["ATTACH", "DETACH", "DROP", "PRAGMA", "VACUUM"] {
        if upper_sql
            .split(|character: char| !character.is_ascii_alphanumeric() && character != '_')
            .any(|token| token == forbidden_token)
        {
            return Err(format!(
                "local SQL plan statement contains forbidden token {forbidden_token}"
            ));
        }
    }

    if !local_sql_mentions_allowed_table(&normalized_sql, allowed_tables) {
        return Err(
            "local SQL plan statement does not target its declared table metadata".to_string(),
        );
    }

    Ok(normalized_sql)
}

fn execute_local_sql_statement(
    connection: &Connection,
    statement: &LocalSqlPlanStatement,
    allowed_tables: &[String],
    allow_create: bool,
) -> Result<(usize, Option<Vec<JsonMap<String, JsonValue>>>), String> {
    let sql = validate_local_sql_statement(&statement.sql, allowed_tables, allow_create)?;
    let params: Vec<SqlValue> = statement
        .params
        .iter()
        .map(json_value_to_sql_value)
        .collect();

    if is_local_sql_read_statement(&sql) {
        let mut prepared_statement = connection
            .prepare(&sql)
            .map_err(|error| format!("failed to prepare local SQL read: {error}"))?;
        let column_names: Vec<String> = prepared_statement
            .column_names()
            .iter()
            .map(|column_name| column_name.to_string())
            .collect();
        let mut rows = prepared_statement
            .query(params_from_iter(params.iter()))
            .map_err(|error| format!("failed to query local SQL read: {error}"))?;
        let mut mapped_rows = Vec::new();
        while let Some(row) = rows
            .next()
            .map_err(|error| format!("failed to read local SQL row: {error}"))?
        {
            let mut mapped_row = JsonMap::new();
            for (column_index, column_name) in column_names.iter().enumerate() {
                let value = row
                    .get_ref(column_index)
                    .map_err(|error| format!("failed to read local SQL column: {error}"))?;
                mapped_row.insert(column_name.clone(), sqlite_value_to_json(value));
            }
            mapped_rows.push(mapped_row);
        }
        return Ok((0, Some(mapped_rows)));
    }

    let affected_row_count = connection
        .execute(&sql, params_from_iter(params.iter()))
        .map_err(|error| format!("failed to execute local SQL write: {error}"))?;
    Ok((affected_row_count, None))
}

fn execute_local_sql_plan(
    connection: &mut Connection,
    plan: &LocalSqlPlan,
) -> Result<LocalSqlExecutionResult, String> {
    if plan.provider_id != "sqlite" {
        return Err(format!(
            "local SQL bridge only supports sqlite plans, received {}",
            plan.provider_id
        ));
    }

    let allowed_tables = read_local_sql_plan_allowed_tables(plan)?;
    let allow_create = read_local_sql_plan_meta_kind(plan) == Some("migration");
    let mut affected_row_count = 0_usize;
    let mut rows = None;

    if plan.transactional {
        let transaction = connection
            .transaction()
            .map_err(|error| format!("failed to start local SQL transaction: {error}"))?;
        for statement in &plan.statements {
            let (statement_affected_row_count, statement_rows) = execute_local_sql_statement(
                &transaction,
                statement,
                &allowed_tables,
                allow_create,
            )?;
            affected_row_count += statement_affected_row_count;
            if statement_rows.is_some() {
                rows = statement_rows;
            }
        }
        transaction
            .commit()
            .map_err(|error| format!("failed to commit local SQL transaction: {error}"))?;
    } else {
        for statement in &plan.statements {
            let (statement_affected_row_count, statement_rows) =
                execute_local_sql_statement(connection, statement, &allowed_tables, allow_create)?;
            affected_row_count += statement_affected_row_count;
            if statement_rows.is_some() {
                rows = statement_rows;
            }
        }
    }

    Ok(LocalSqlExecutionResult {
        affected_row_count,
        rows,
    })
}

#[tauri::command]
async fn local_sql_execute_plan(
    app: AppHandle,
    plan: LocalSqlPlan,
) -> Result<LocalSqlExecutionResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut connection = open_database(&app)?;
        execute_local_sql_plan(&mut connection, &plan)
    })
    .await
    .map_err(|error| format!("failed to join local SQL execution task: {error}"))?
}

#[tauri::command]
async fn user_home_config_read(relative_path: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = resolve_user_home_config_path(&relative_path)?;
        if !path.exists() {
            return Ok(None);
        }

        if !path.is_file() {
            return Err(format!(
                "user home config path is not a file: {}",
                path.display()
            ));
        }

        fs::read_to_string(&path).map(Some).map_err(|error| {
            format!(
                "failed to read user home config {}: {error}",
                path.display()
            )
        })
    })
    .await
    .map_err(|error| format!("failed to join user home config read task: {error}"))?
}

#[tauri::command]
async fn user_home_config_write(relative_path: String, content: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = resolve_user_home_config_path(&relative_path)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|error| {
                format!(
                    "failed to create user home config directory {}: {error}",
                    parent.display()
                )
            })?;
        }

        fs::write(&path, content).map_err(|error| {
            format!(
                "failed to write user home config {}: {error}",
                path.display()
            )
        })
    })
    .await
    .map_err(|error| format!("failed to join user home config write task: {error}"))?
}

#[tauri::command]
async fn local_store_get(
    app: AppHandle,
    scope: String,
    key: String,
) -> Result<Option<String>, String> {
    if local_store_key_targets_authority_tables(&key) {
        return Err(format!(
            "local store key '{}' is reserved for direct authority tables and is not readable via kv_store",
            key
        ));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_database(&app)?;
        let mut statement = connection
            .prepare("SELECT value FROM kv_store WHERE scope = ?1 AND key = ?2")
            .map_err(|error| format!("failed to prepare local_store_get: {error}"))?;

        let mut rows = statement
            .query(params![scope, key])
            .map_err(|error| format!("failed to query local_store_get: {error}"))?;

        match rows
            .next()
            .map_err(|error| format!("failed to read local_store_get row: {error}"))?
        {
            Some(row) => row
                .get(0)
                .map(Some)
                .map_err(|error| format!("failed to decode local_store_get value: {error}")),
            None => Ok(None),
        }
    })
    .await
    .map_err(|error| format!("failed to join local store get task: {error}"))?
}

#[tauri::command]
async fn local_store_set(
    app: AppHandle,
    scope: String,
    key: String,
    value: String,
) -> Result<(), String> {
    if local_store_key_targets_authority_tables(&key) {
        return Err(format!(
            "local store key '{}' is reserved for direct authority tables and cannot be written via kv_store",
            key
        ));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_database(&app)?;
        connection
            .execute(
                r#"
                INSERT INTO kv_store (scope, key, value, updated_at)
                VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
                ON CONFLICT(scope, key)
                DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
                "#,
                params![&scope, &key, &value],
            )
            .map_err(|error| format!("failed to persist local store value: {error}"))?;
        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join local store set task: {error}"))?
}

#[tauri::command]
async fn local_store_delete(app: AppHandle, scope: String, key: String) -> Result<(), String> {
    if local_store_key_targets_authority_tables(&key) {
        return Err(format!(
            "local store key '{}' is reserved for direct authority tables and cannot be deleted via kv_store",
            key
        ));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_database(&app)?;
        connection
            .execute(
                "DELETE FROM kv_store WHERE scope = ?1 AND key = ?2",
                params![&scope, &key],
            )
            .map_err(|error| format!("failed to delete local store value: {error}"))?;
        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join local store delete task: {error}"))?
}

#[tauri::command]
async fn local_store_list(app: AppHandle, scope: String) -> Result<Vec<LocalStoreEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_database(&app)?;
        let mut statement = connection
            .prepare(
                r#"
                SELECT scope, key, value, updated_at
                FROM kv_store
                WHERE scope = ?1
                ORDER BY updated_at DESC, key ASC
                "#,
            )
            .map_err(|error| format!("failed to prepare local_store_list: {error}"))?;

        let rows = statement
            .query_map(params![scope], |row| {
                Ok(LocalStoreEntry {
                    scope: row.get(0)?,
                    key: row.get(1)?,
                    value: row.get(2)?,
                    updated_at: row.get(3)?,
                })
            })
            .map_err(|error| format!("failed to list local store values: {error}"))?;

        let mut entries = Vec::new();
        for row in rows {
            let entry =
                row.map_err(|error| format!("failed to decode local_store_list row: {error}"))?;
            if local_store_key_targets_authority_tables(&entry.key) {
                continue;
            }
            entries.push(entry);
        }

        Ok(entries)
    })
    .await
    .map_err(|error| format!("failed to join local store list task: {error}"))?
}

#[tauri::command]
async fn fs_snapshot_folder(root_path: String) -> Result<FileSystemSnapshotResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root_directory = resolve_root_directory_path(&root_path)?;
        let root_virtual_path = format!("/{}", resolve_root_directory_name(&root_directory));
        let tree = build_directory_snapshot(&root_directory, &root_virtual_path)?;

        Ok(FileSystemSnapshotResponse {
            root_virtual_path,
            tree,
        })
    })
    .await
    .map_err(|error| format!("failed to join folder snapshot task: {error}"))?
}

#[tauri::command]
async fn fs_list_directory(
    root_path: String,
    relative_path: Option<String>,
) -> Result<FileSystemDirectoryListingResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let root_directory = resolve_root_directory_path(&root_path)?;
        let root_virtual_path = format!("/{}", resolve_root_directory_name(&root_directory));

        let target_relative_path = relative_path
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(normalize_relative_path)
            .transpose()?;
        let target_directory = if let Some(ref normalized_relative_path) = target_relative_path {
            root_directory.join(normalized_relative_path)
        } else {
            root_directory.clone()
        };

        if !target_directory.exists() {
            return Err(format!(
                "mounted directory does not exist: {}",
                target_directory.display()
            ));
        }

        if !target_directory.is_dir() {
            return Err(format!(
                "mounted path must be a directory: {}",
                target_directory.display()
            ));
        }

        let directory_virtual_path =
            if let Some(ref normalized_relative_path) = target_relative_path {
                build_virtual_path_from_relative(&root_virtual_path, normalized_relative_path)
            } else {
                root_virtual_path.clone()
            };
        let directory = build_directory_listing(&target_directory, &directory_virtual_path)?;

        Ok(FileSystemDirectoryListingResponse {
            root_virtual_path,
            directory,
        })
    })
    .await
    .map_err(|error| format!("failed to join directory listing task: {error}"))?
}

fn read_mounted_file_to_string(
    file_path: &Path,
    max_bytes: Option<usize>,
) -> Result<String, String> {
    if let Some(max_bytes) = max_bytes.filter(|value| *value > 0) {
        let file = fs::File::open(file_path).map_err(|error| {
            format!(
                "failed to open mounted file '{}': {error}",
                file_path.display()
            )
        })?;
        let mut buffer = Vec::with_capacity(max_bytes.min(64 * 1024));
        file.take(max_bytes as u64)
            .read_to_end(&mut buffer)
            .map_err(|error| {
                format!(
                    "failed to read mounted file prefix '{}': {error}",
                    file_path.display()
                )
            })?;
        return Ok(String::from_utf8_lossy(&buffer).into_owned());
    }

    fs::read_to_string(file_path).map_err(|error| {
        format!(
            "failed to read mounted file '{}': {error}",
            file_path.display()
        )
    })
}

#[tauri::command]
async fn fs_read_file(
    root_path: String,
    relative_path: String,
    max_bytes: Option<usize>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_scoped_path(&root_path, &relative_path)?;
        read_mounted_file_to_string(&file_path, max_bytes)
    })
    .await
    .map_err(|error| format!("failed to join mounted file read task: {error}"))?
}

fn build_entry_revision(metadata: &fs::Metadata) -> Result<String, String> {
    let modified_nanos = metadata
        .modified()
        .map_err(|error| format!("failed to inspect mounted file modified time: {error}"))?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| format!("mounted file modified time is before unix epoch: {error}"))?
        .as_nanos();

    Ok(format!("{}:{}", modified_nanos, metadata.len()))
}

#[tauri::command]
async fn fs_get_file_revision(root_path: String, relative_path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_scoped_path(&root_path, &relative_path)?;
        let metadata = fs::metadata(&file_path).map_err(|error| {
            format!(
                "failed to inspect mounted file '{}': {error}",
                file_path.display()
            )
        })?;

        if !metadata.is_file() {
            return Err(format!(
                "mounted path must be a file: {}",
                file_path.display()
            ));
        }

        build_entry_revision(&metadata)
    })
    .await
    .map_err(|error| format!("failed to join mounted file revision task: {error}"))?
}

#[tauri::command]
async fn fs_get_file_revisions(
    root_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<FileSystemFileRevisionProbeResponse>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut probes = Vec::with_capacity(relative_paths.len());

        for relative_path in relative_paths {
            let file_path = match resolve_scoped_path(&root_path, &relative_path) {
                Ok(file_path) => file_path,
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(error),
                    });
                    continue;
                }
            };

            let metadata = match fs::metadata(&file_path) {
                Ok(metadata) => metadata,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: true,
                        error: None,
                    });
                    continue;
                }
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(format!(
                            "failed to inspect mounted file '{}': {error}",
                            file_path.display()
                        )),
                    });
                    continue;
                }
            };

            if !metadata.is_file() {
                probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(format!(
                        "mounted path must be a file: {}",
                        file_path.display()
                    )),
                });
                continue;
            }

            match build_entry_revision(&metadata) {
                Ok(revision) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: Some(revision),
                    missing: false,
                    error: None,
                }),
                Err(error) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(error),
                }),
            }
        }

        Ok(probes)
    })
    .await
    .map_err(|error| format!("failed to join mounted file revisions task: {error}"))?
}

#[tauri::command]
async fn fs_get_directory_revisions(
    root_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<FileSystemFileRevisionProbeResponse>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut probes = Vec::with_capacity(relative_paths.len());

        for relative_path in relative_paths {
            let directory_path = match resolve_scoped_path(&root_path, &relative_path) {
                Ok(directory_path) => directory_path,
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(error),
                    });
                    continue;
                }
            };

            let metadata = match fs::metadata(&directory_path) {
                Ok(metadata) => metadata,
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: true,
                        error: None,
                    });
                    continue;
                }
                Err(error) => {
                    probes.push(FileSystemFileRevisionProbeResponse {
                        revision: None,
                        missing: false,
                        error: Some(format!(
                            "failed to inspect mounted directory '{}': {error}",
                            directory_path.display()
                        )),
                    });
                    continue;
                }
            };

            if !metadata.is_dir() {
                probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(format!(
                        "mounted path must be a directory: {}",
                        directory_path.display()
                    )),
                });
                continue;
            }

            match build_entry_revision(&metadata) {
                Ok(revision) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: Some(revision),
                    missing: false,
                    error: None,
                }),
                Err(error) => probes.push(FileSystemFileRevisionProbeResponse {
                    revision: None,
                    missing: false,
                    error: Some(error),
                }),
            }
        }

        Ok(probes)
    })
    .await
    .map_err(|error| format!("failed to join mounted directory revisions task: {error}"))?
}

#[tauri::command]
async fn fs_write_file(
    root_path: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_scoped_path(&root_path, &relative_path)?;
        fs::write(&file_path, content).map_err(|error| {
            format!(
                "failed to write mounted file '{}': {error}",
                file_path.display()
            )
        })
    })
    .await
    .map_err(|error| format!("failed to join mounted file write task: {error}"))?
}

#[tauri::command]
async fn fs_create_file(root_path: String, relative_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let file_path = resolve_scoped_path(&root_path, &relative_path)?;
        if file_path.exists() {
            if file_path.is_file() {
                return Ok(());
            }

            return Err(format!(
                "cannot create file because a directory already exists at '{}'",
                file_path.display()
            ));
        }

        let parent_directory = file_path.parent().ok_or_else(|| {
            format!(
                "cannot create mounted file without a parent directory: {}",
                file_path.display()
            )
        })?;

        if !parent_directory.exists() {
            return Err(format!(
                "parent directory does not exist for mounted file '{}'",
                file_path.display()
            ));
        }

        fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(false)
            .open(&file_path)
            .map_err(|error| {
                format!(
                    "failed to create mounted file '{}': {error}",
                    file_path.display()
                )
            })?;

        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted file create task: {error}"))?
}

#[tauri::command]
async fn fs_create_directory(root_path: String, relative_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let directory_path = resolve_scoped_path(&root_path, &relative_path)?;
        if directory_path.exists() {
            if directory_path.is_dir() {
                return Ok(());
            }

            return Err(format!(
                "cannot create directory because a file already exists at '{}'",
                directory_path.display()
            ));
        }

        let parent_directory = directory_path.parent().ok_or_else(|| {
            format!(
                "cannot create mounted directory without a parent directory: {}",
                directory_path.display()
            )
        })?;

        if !parent_directory.exists() {
            return Err(format!(
                "parent directory does not exist for mounted directory '{}'",
                directory_path.display()
            ));
        }

        fs::create_dir(&directory_path).map_err(|error| {
            format!(
                "failed to create mounted directory '{}': {error}",
                directory_path.display()
            )
        })?;

        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted directory create task: {error}"))?
}

#[tauri::command]
async fn fs_delete_entry(
    root_path: String,
    relative_path: String,
    recursive: bool,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let entry_path = resolve_scoped_path(&root_path, &relative_path)?;
        let metadata = fs::metadata(&entry_path).map_err(|error| {
            format!(
                "failed to inspect mounted entry '{}': {error}",
                entry_path.display()
            )
        })?;

        if metadata.is_dir() {
            if recursive {
                fs::remove_dir_all(&entry_path).map_err(|error| {
                    format!(
                        "failed to delete mounted directory '{}': {error}",
                        entry_path.display()
                    )
                })?;
            } else {
                fs::remove_dir(&entry_path).map_err(|error| {
                    format!(
                        "failed to delete mounted directory '{}': {error}",
                        entry_path.display()
                    )
                })?;
            }
        } else {
            fs::remove_file(&entry_path).map_err(|error| {
                format!(
                    "failed to delete mounted file '{}': {error}",
                    entry_path.display()
                )
            })?;
        }

        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted entry delete task: {error}"))?
}

#[tauri::command]
async fn fs_rename_entry(
    root_path: String,
    old_relative_path: String,
    new_relative_path: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let old_path = resolve_scoped_path(&root_path, &old_relative_path)?;
        let new_path = resolve_scoped_path(&root_path, &new_relative_path)?;
        let new_parent_directory = new_path.parent().ok_or_else(|| {
            format!(
                "cannot rename mounted entry without a destination parent directory: {}",
                new_path.display()
            )
        })?;

        if !new_parent_directory.exists() {
            return Err(format!(
                "destination parent directory does not exist for mounted entry '{}'",
                new_path.display()
            ));
        }

        fs::rename(&old_path, &new_path).map_err(|error| {
            format!(
                "failed to rename mounted entry '{}' to '{}': {error}",
                old_path.display(),
                new_path.display()
            )
        })?;

        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join mounted entry rename task: {error}"))?
}

fn locate_terminal_executable(executable: &str, aliases: &[String]) -> Option<String> {
    let mut candidates = Vec::new();

    if !executable.trim().is_empty() {
        candidates.push(executable.trim().to_string());
    }

    for alias in aliases {
        let normalized = alias.trim();
        if !normalized.is_empty() && !candidates.iter().any(|candidate| candidate == normalized) {
            candidates.push(normalized.to_string());
        }
    }

    for candidate in candidates {
        let output = if cfg!(target_os = "windows") {
            std::process::Command::new("where").arg(&candidate).output()
        } else {
            std::process::Command::new("which").arg(&candidate).output()
        };

        let Ok(output) = output else {
            continue;
        };

        if !output.status.success() {
            continue;
        }

        let resolved = String::from_utf8_lossy(&output.stdout)
            .lines()
            .map(|line| line.trim())
            .find(|line| !line.is_empty())
            .map(|line| line.to_string());

        if resolved.is_some() {
            return resolved;
        }
    }

    None
}

#[tauri::command]
async fn terminal_cli_profile_detect(
    request: TerminalCliProfileDetectRequest,
) -> Result<TerminalCliProfileAvailability, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let resolved_executable = locate_terminal_executable(&request.executable, &request.aliases);

        Ok(TerminalCliProfileAvailability {
            profile_id: request.profile_id,
            status: if resolved_executable.is_some() {
                "available".to_string()
            } else {
                "missing".to_string()
            },
            resolved_executable,
        })
    })
    .await
    .map_err(|error| format!("failed to join terminal CLI profile detect task: {error}"))?
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.manage(file_system_watch::FileSystemWatchState::new());
            app.manage(terminal_bridge::DesktopRuntimeState::new(Some(
                app.handle().clone(),
            )));
            spawn_embedded_coding_server_startup(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            host_mode,
            desktop_runtime_config,
            local_store_get,
            local_store_set,
            local_store_delete,
            local_store_list,
            local_sql_execute_plan,
            user_home_config_read,
            user_home_config_write,
            fs_list_directory,
            fs_snapshot_folder,
            fs_read_file,
            fs_get_file_revision,
            fs_get_file_revisions,
            fs_get_directory_revisions,
            file_system_watch::fs_watch_start,
            file_system_watch::fs_watch_stop,
            fs_write_file,
            fs_create_file,
            fs_create_directory,
            fs_delete_entry,
            fs_rename_entry,
            terminal_cli_profile_detect,
            window_controls_bridge::desktop_window_controls_bridge_capabilities,
            window_controls_bridge::desktop_configure_window_controls_bridge,
            window_controls_bridge::desktop_perform_window_control_action,
            terminal_bridge::commands::desktop_session_index,
            terminal_bridge::commands::desktop_pick_working_directory,
            terminal_bridge::commands::desktop_session_replay_slice,
            terminal_bridge::commands::desktop_session_attach,
            terminal_bridge::commands::desktop_session_detach,
            terminal_bridge::commands::desktop_session_reattach,
            terminal_bridge::commands::desktop_terminal_session_inventory_list,
            terminal_bridge::commands::desktop_local_shell_exec,
            terminal_bridge::commands::desktop_local_shell_session_create,
            terminal_bridge::commands::desktop_local_process_session_create,
            terminal_bridge::commands::desktop_session_input,
            terminal_bridge::commands::desktop_session_input_bytes,
            terminal_bridge::commands::desktop_session_attachment_acknowledge,
            terminal_bridge::commands::desktop_session_resize,
            terminal_bridge::commands::desktop_session_terminate
        ])
        .run(tauri::generate_context!())
        .expect("error while running sdkwork birdcoder desktop");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn user_home_config_path_is_scoped_to_birdcoder_config_root() {
        let resolved_path =
            resolve_user_home_config_path(".sdkwork/birdcoder/code-engine-models.json")
                .expect("resolve canonical BirdCoder model config path");
        assert!(
            resolved_path.ends_with(
                Path::new(USER_HOME_CONFIG_RELATIVE_ROOT).join("code-engine-models.json")
            ),
            "canonical model config must resolve under ~/.sdkwork/birdcoder"
        );
        assert!(
            resolve_user_home_config_path(".ssh/config").is_err(),
            "user_home_config must not resolve arbitrary files under the user's home directory"
        );
        assert!(
            resolve_user_home_config_path(".sdkwork/birdcoder").is_err(),
            "user_home_config must target a file below ~/.sdkwork/birdcoder, not the config root directory itself"
        );

        for relative_path in [
            ".sdkwork/birdcoder2/code-engine-models.json",
            ".sdkwork/other/code-engine-models.json",
            "sdkwork/birdcoder/code-engine-models.json",
        ] {
            assert!(
                resolve_user_home_config_path(relative_path).is_err(),
                "user_home_config must reject paths outside ~/.sdkwork/birdcoder: {relative_path}"
            );
        }
    }

    #[test]
    fn bind_embedded_coding_server_listener_falls_back_to_ephemeral_loopback_port_when_preferred_port_is_occupied(
    ) {
        let blocking_listener = std::net::TcpListener::bind((BIRD_SERVER_DEFAULT_HOST, 0))
            .expect("bind blocking listener");
        let occupied_address = blocking_listener
            .local_addr()
            .expect("read blocking listener local address");

        let (listener, api_base_url) = bind_embedded_coding_server_listener(
            &occupied_address.to_string(),
            BIRD_SERVER_DEFAULT_HOST,
        )
        .expect("bind fallback embedded coding server listener");
        let local_address = listener
            .local_addr()
            .expect("read fallback listener local address");

        assert_eq!(local_address.ip().to_string(), BIRD_SERVER_DEFAULT_HOST);
        assert_ne!(local_address.port(), occupied_address.port());
        assert_eq!(api_base_url, format!("http://{local_address}"));
    }

    fn table_exists(connection: &Connection, table_name: &str) -> bool {
        let mut statement = connection
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1")
            .expect("prepare table probe");
        let mut rows = statement.query([table_name]).expect("query table probe");
        rows.next().expect("read table probe").is_some()
    }

    fn column_exists(connection: &Connection, table_name: &str, column_name: &str) -> bool {
        let pragma = format!("PRAGMA table_info({table_name})");
        let mut statement = connection
            .prepare(&pragma)
            .expect("prepare table info probe");
        let rows = statement
            .query_map([], |row| row.get::<_, String>(1))
            .expect("query table info probe");

        for row in rows {
            if row.expect("read table info probe") == column_name {
                return true;
            }
        }

        false
    }

    #[test]
    fn initialize_database_schema_creates_direct_authority_tables_and_migration_markers() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");

        initialize_database_schema(&connection).expect("initialize sqlite schema");

        for table_name in [
            "kv_store",
            "schema_migration_history",
            "workbench_preferences",
            "engine_registry",
            "model_catalog",
            "engine_bindings",
            "run_configurations",
            "terminal_executions",
            "coding_sessions",
            "coding_session_messages",
            "coding_session_runtimes",
            "coding_session_events",
            "coding_session_artifacts",
            "coding_session_checkpoints",
            "coding_session_operations",
            "plus_workspace",
            "plus_project",
            "teams",
            "release_records",
        ] {
            assert!(
                table_exists(&connection, table_name),
                "missing table: {table_name}"
            );
        }

        for column_name in [
            "uuid",
            "host_mode",
            "native_session_id",
            "sort_timestamp",
            "transcript_updated_at",
            "pinned",
            "archived",
            "unread",
        ] {
            assert!(
                column_exists(&connection, "coding_sessions", column_name),
                "coding_sessions must include {column_name}"
            );
        }

        for column_name in [
            "coding_session_id",
            "turn_id",
            "role",
            "content",
            "metadata_json",
            "timestamp_ms",
            "tool_calls_json",
            "file_changes_json",
            "commands_json",
            "task_progress_json",
        ] {
            assert!(
                column_exists(&connection, "coding_session_messages", column_name),
                "coding_session_messages must include {column_name}"
            );
        }

        let applied_migration_count = connection
            .query_row(
                r#"
                SELECT COUNT(*)
                FROM schema_migration_history
                WHERE provider_id = 'sqlite'
                  AND migration_id IN ('runtime-data-kernel-v1', 'coding-server-kernel-v2')
                  AND status = 'applied'
                "#,
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("query applied migrations");
        assert_eq!(applied_migration_count, 2);
    }

    #[test]
    fn desktop_local_startup_imports_legacy_sibling_projects_into_plus_authority_tables() {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("read system time")
            .as_nanos();
        let database_dir = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-desktop-legacy-project-import-{unique_suffix}"
        ));
        std::fs::create_dir_all(&database_dir).expect("create temp sqlite directory");
        let current_database_path = database_dir.join("sdkwork-birdcoder-desktop-local.sqlite3");
        let legacy_database_path = database_dir.join("sdkwork-birdcoder.sqlite3");

        let current_connection =
            Connection::open(&current_database_path).expect("open current desktop-local sqlite");
        initialize_database_schema(&current_connection).expect("initialize current sqlite schema");
        ensure_bootstrap_workspace_authority(&current_connection)
            .expect("ensure current bootstrap workspace");

        let legacy_connection =
            Connection::open(&legacy_database_path).expect("open legacy sibling sqlite");
        let legacy_project_seed_sql = format!(
            r#"
                CREATE TABLE {legacy_projects_table} (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    workspace_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    title TEXT NULL,
                    description TEXT NULL,
                    root_path TEXT NULL,
                    status TEXT NOT NULL
                );
                INSERT INTO {legacy_projects_table} (
                    id, created_at, updated_at, is_deleted, workspace_id,
                    name, title, description, root_path, status
                )
                VALUES
                    (
                        'project-recovered',
                        '2026-04-17T19:50:45Z',
                        '2026-04-17T19:53:25Z',
                        0,
                        'workspace-default',
                        'spring-ai-plus',
                        'spring-ai-plus',
                        'Recovered legacy project',
                        'D:/javasource/spring-ai-plus',
                        'active'
                    ),
                    (
                        'project-deleted',
                        '2026-04-17T19:50:45Z',
                        '2026-04-17T19:53:25Z',
                        1,
                        'workspace-default',
                        'deleted-project',
                        'deleted-project',
                        'Deleted legacy project',
                        'D:/deleted-project',
                        'active'
                    );
                "#,
            legacy_projects_table = "projects",
        );
        legacy_connection
            .execute_batch(&legacy_project_seed_sql)
            .expect("seed legacy projects");
        drop(legacy_connection);

        import_legacy_desktop_local_projects_from_sibling(
            &current_connection,
            &current_database_path,
        )
        .expect("import legacy sibling projects");
        import_legacy_desktop_local_projects_from_sibling(
            &current_connection,
            &current_database_path,
        )
        .expect("repeat legacy sibling project import");

        let imported_count = current_connection
            .query_row(
                r#"
                SELECT COUNT(*)
                FROM plus_project AS project
                JOIN plus_project_content AS content
                  ON content.project_id = project.id
                WHERE project.is_deleted = 0
                  AND content.config_data LIKE '%D:/javasource/spring-ai-plus%'
                "#,
                [],
                |row| row.get::<_, i64>(0),
            )
            .expect("query imported project count");
        assert_eq!(
            imported_count, 1,
            "legacy project import must be idempotent and skip deleted projects"
        );

        let (title, workspace_id, config_data) = current_connection
            .query_row(
                r#"
                SELECT project.title, CAST(project.workspace_id AS TEXT), content.config_data
                FROM plus_project AS project
                JOIN plus_project_content AS content
                  ON content.project_id = project.id
                WHERE content.config_data LIKE '%D:/javasource/spring-ai-plus%'
                LIMIT 1
                "#,
                [],
                |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                    ))
                },
            )
            .expect("query imported project row");
        assert_eq!(title, "spring-ai-plus");
        assert_eq!(workspace_id, DEFAULT_BOOTSTRAP_WORKSPACE_ID);
        assert!(
            config_data.contains("\"rootPath\":\"D:/javasource/spring-ai-plus\""),
            "imported legacy project root must be stored in plus_project_content config_data"
        );
    }

    #[test]
    fn initialize_database_schema_produces_sqlite_authority_file_accepted_by_embedded_server() {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("read system time")
            .as_nanos();
        let sqlite_path = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-desktop-authority-{unique_suffix}.sqlite3"
        ));
        let connection = Connection::open(&sqlite_path).expect("open temp sqlite file");

        initialize_database_schema(&connection).expect("initialize sqlite schema");
        drop(connection);

        let build_result = build_app_from_sqlite_file(&sqlite_path);

        fs::remove_file(&sqlite_path).expect("remove temp sqlite file");

        assert!(
            build_result.is_ok(),
            "desktop-initialized authority file should load in embedded server: {build_result:?}"
        );
    }

    #[test]
    fn local_sql_plan_validation_accepts_table_repository_plans_only_for_declared_tables() {
        let allowed_tables = vec!["plus_project".to_string()];

        assert_eq!(
            validate_local_sql_statement(
                "SELECT * FROM plus_project WHERE id = ?1 LIMIT 1;",
                &allowed_tables,
                false,
            )
            .expect("accept table read"),
            "SELECT * FROM plus_project WHERE id = ?1 LIMIT 1"
        );
        assert!(
            validate_local_sql_statement(
                "SELECT * FROM coding_sessions WHERE id = ?1 LIMIT 1;",
                &allowed_tables,
                false,
            )
            .is_err(),
            "SQL bridge must reject statements that do not target the declared metadata table"
        );
        assert!(
            validate_local_sql_statement(
                "CREATE TABLE IF NOT EXISTS plus_project (id TEXT PRIMARY KEY);",
                &allowed_tables,
                false,
            )
            .is_err(),
            "SQL bridge must only allow CREATE for migration plans"
        );
    }

    #[test]
    fn local_sql_plan_validation_rejects_unsafe_tokens() {
        let allowed_tables = vec!["plus_project".to_string()];

        for sql in [
            "DROP TABLE plus_project",
            "ATTACH DATABASE 'other.sqlite' AS other",
            "PRAGMA table_info(plus_project)",
            "VACUUM",
        ] {
            assert!(
                validate_local_sql_statement(sql, &allowed_tables, true).is_err(),
                "SQL bridge must reject unsafe statement: {sql}"
            );
        }
    }

    #[test]
    fn local_sql_plan_metadata_controls_migration_table_scope() {
        let plan = LocalSqlPlan {
            provider_id: "sqlite".to_string(),
            intent: "write".to_string(),
            meta: Some(serde_json::json!({
                "kind": "migration",
                "tableNames": ["plus_project"],
            })),
            statements: vec![LocalSqlPlanStatement {
                sql: "CREATE TABLE IF NOT EXISTS plus_project (id TEXT PRIMARY KEY);".to_string(),
                params: Vec::new(),
            }],
            transactional: true,
        };
        let allowed_tables =
            read_local_sql_plan_allowed_tables(&plan).expect("read migration table scope");

        assert_eq!(allowed_tables, vec!["plus_project".to_string()]);
        assert!(
            validate_local_sql_statement(&plan.statements[0].sql, &allowed_tables, true).is_ok(),
            "migration plans should be allowed to create their declared table"
        );
    }

    #[test]
    fn initialize_database_schema_upgrades_legacy_run_configurations_with_config_keys() {
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("read system time")
            .as_nanos();
        let sqlite_path = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-desktop-legacy-run-configs-{unique_suffix}.sqlite3"
        ));
        let connection = Connection::open(&sqlite_path).expect("open temp sqlite file");

        connection
            .execute_batch(
                r#"
                CREATE TABLE run_configurations (
                    id TEXT PRIMARY KEY,
                    workspace_id TEXT NOT NULL DEFAULT '',
                    project_id TEXT NOT NULL DEFAULT '',
                    scope_type TEXT NOT NULL DEFAULT 'global',
                    scope_id TEXT NOT NULL DEFAULT '',
                    name TEXT NOT NULL,
                    command TEXT NOT NULL,
                    profile_id TEXT NOT NULL,
                    group_name TEXT NOT NULL DEFAULT 'custom',
                    cwd_mode TEXT NOT NULL DEFAULT 'project',
                    custom_cwd TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0
                );

                INSERT INTO run_configurations (
                    id, workspace_id, project_id, scope_type, scope_id, name, command, profile_id, group_name
                )
                VALUES
                    ('run-config:project:project-1:dev', '', 'project-1', 'project', 'project-1', 'Start Dev', 'npm run dev', 'powershell', 'dev'),
                    ('run-config:project:project-1:test', '', 'project-1', 'project', 'project-1', 'Run Tests', 'npm test', 'powershell', 'test');
                "#,
            )
            .expect("create legacy run configuration table");

        initialize_database_schema(&connection).expect("upgrade legacy sqlite schema");

        assert!(
            column_exists(&connection, "run_configurations", "config_key"),
            "legacy run configuration table should gain config_key column"
        );

        let config_keys: Vec<String> = connection
            .prepare("SELECT config_key FROM run_configurations ORDER BY id")
            .expect("prepare config key read")
            .query_map([], |row| row.get::<_, String>(0))
            .expect("query config key read")
            .map(|row| row.expect("read config key"))
            .collect();

        assert_eq!(
            config_keys,
            vec!["dev".to_string(), "test".to_string()],
            "legacy run configuration rows should be backfilled with stable public config keys"
        );

        drop(connection);
        fs::remove_file(&sqlite_path).expect("remove temp sqlite file");
    }
}
