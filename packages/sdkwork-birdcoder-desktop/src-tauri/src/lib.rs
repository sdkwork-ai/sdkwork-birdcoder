use rusqlite::{params, Connection};
use sdkwork_birdcoder_server::{
    build_app_from_sqlite_file, BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV,
    BIRD_SERVER_DEFAULT_BIND_ADDRESS, BIRD_SERVER_DEFAULT_HOST,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

const CODING_SERVER_AUTHORITY_BACKFILL_MIGRATION_ID: &str = "coding-server-authority-backfill-v1";
const LOCAL_STORE_SQLITE_TABLE_PREFIX: &str = "table.sqlite.";
const LOCAL_STORE_WORKSPACES_KEY: &str = "table.sqlite.workspaces.v1";
const LOCAL_STORE_CODING_SESSIONS_KEY: &str = "table.sqlite.coding-sessions.v1";
const LOCAL_STORE_CODING_SESSION_RUNTIMES_KEY: &str = "table.sqlite.coding-session-runtimes.v1";
const LOCAL_STORE_CODING_SESSION_RUNTIMES_KEY_PREFIX: &str =
    "table.sqlite.coding-session-runtimes.";
const LOCAL_STORE_CODING_SESSION_EVENTS_KEY_PREFIX: &str = "table.sqlite.coding-session-events.";
const LOCAL_STORE_CODING_SESSION_ARTIFACTS_KEY_PREFIX: &str =
    "table.sqlite.coding-session-artifacts.";
const LOCAL_STORE_CODING_SESSION_CHECKPOINTS_KEY_PREFIX: &str =
    "table.sqlite.coding-session-checkpoints.";
const LOCAL_STORE_CODING_SESSION_OPERATIONS_KEY_PREFIX: &str =
    "table.sqlite.coding-session-operations.";
const LOCAL_STORE_PROJECTS_KEY: &str = "table.sqlite.projects.v1";
const LOCAL_STORE_TEAMS_KEY: &str = "table.sqlite.teams.v1";
const LOCAL_STORE_RELEASE_RECORDS_KEY: &str = "table.sqlite.release-records.v1";
const DEFAULT_BOOTSTRAP_WORKSPACE_ID: &str = "workspace-default";
const DEFAULT_BOOTSTRAP_WORKSPACE_NAME: &str = "Default Workspace";
const DEFAULT_BOOTSTRAP_WORKSPACE_DESCRIPTION: &str = "Primary local workspace for BirdCoder.";
const DEFAULT_BOOTSTRAP_WORKSPACE_OWNER_IDENTITY_ID: &str = "identity-local-default";

static DESKTOP_RUNTIME_CONFIG: OnceLock<DesktopRuntimeConfig> = OnceLock::new();

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

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalSessionRecord {
    id: String,
    title: String,
    profile_id: String,
    cwd: String,
    command_history_json: String,
    recent_output_json: String,
    workspace_id: String,
    project_id: String,
    status: String,
    last_exit_code: Option<i32>,
    updated_at: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExecutionRequest {
    profile_id: String,
    kind: String,
    executable: String,
    args: Vec<String>,
    cwd: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalHostSessionState {
    session_id: String,
    profile_id: String,
    kind: String,
    title: String,
    cwd: String,
    status: String,
    last_exit_code: Option<i32>,
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TerminalHostSessionExecuteRequest {
    session_id: String,
    profile_id: String,
    kind: String,
    title: String,
    cwd: String,
    executable: String,
    args: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalHostSessionExecuteResponse {
    state: TerminalHostSessionState,
    execution: TerminalExecutionResult,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TerminalExecutionResult {
    profile_id: String,
    kind: String,
    executable: String,
    args: Vec<String>,
    cwd: String,
    stdout: String,
    stderr: String,
    exit_code: i32,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredCodingSessionRecord {
    id: String,
    workspace_id: String,
    project_id: String,
    title: String,
    status: String,
    entry_surface: Option<String>,
    engine_id: String,
    model_id: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
    last_turn_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredCodingSessionRuntimeNativeRef {
    transport_kind: Option<String>,
    native_session_id: Option<String>,
    native_turn_container_id: Option<String>,
    metadata: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredCodingSessionRuntimeRecord {
    id: String,
    coding_session_id: Option<String>,
    host_mode: String,
    status: Option<String>,
    engine_id: Option<String>,
    model_id: Option<String>,
    transport_kind: Option<String>,
    native_session_id: Option<String>,
    native_turn_container_id: Option<String>,
    capability_snapshot: Option<serde_json::Value>,
    capability_snapshot_json: Option<serde_json::Value>,
    metadata: Option<serde_json::Value>,
    metadata_json: Option<serde_json::Value>,
    native_ref: Option<StoredCodingSessionRuntimeNativeRef>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredCodingSessionEventRecord {
    id: String,
    coding_session_id: Option<String>,
    turn_id: Option<String>,
    runtime_id: Option<String>,
    kind: String,
    sequence: i64,
    payload: serde_json::Value,
    created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredCodingSessionArtifactRecord {
    id: String,
    coding_session_id: Option<String>,
    turn_id: Option<String>,
    kind: String,
    status: Option<String>,
    title: String,
    blob_ref: Option<String>,
    metadata: Option<serde_json::Value>,
    created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredCodingSessionCheckpointRecord {
    id: String,
    coding_session_id: Option<String>,
    runtime_id: Option<String>,
    checkpoint_kind: String,
    resumable: bool,
    state: serde_json::Value,
    created_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredCodingSessionOperationRecord {
    id: Option<String>,
    operation_id: Option<String>,
    coding_session_id: Option<String>,
    turn_id: Option<String>,
    status: String,
    artifact_refs: Vec<String>,
    stream_url: Option<String>,
    stream_kind: Option<String>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StoredWorkspaceRecord {
    id: String,
    name: String,
    description: Option<String>,
    owner_identity_id: Option<String>,
    status: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredProjectRecord {
    id: String,
    workspace_id: String,
    name: String,
    description: Option<String>,
    root_path: Option<String>,
    status: String,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredTeamRecord {
    id: String,
    workspace_id: String,
    name: String,
    description: Option<String>,
    status: String,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredReleaseRecord {
    id: String,
    release_version: String,
    release_kind: String,
    rollout_stage: String,
    manifest_json: Option<serde_json::Value>,
    status: String,
    created_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileSystemSnapshotResponse {
    root_virtual_path: String,
    tree: FileSystemNode,
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

fn resolve_scoped_path(root_path: &str, relative_path: &str) -> Result<PathBuf, String> {
    let root_directory = resolve_root_directory_path(root_path)?;
    let normalized_relative_path = normalize_relative_path(relative_path)?;
    Ok(root_directory.join(normalized_relative_path))
}

fn build_directory_snapshot(directory_path: &Path, virtual_path: &str) -> Result<FileSystemNode, String> {
    let mut children = Vec::new();
    let entries = fs::read_dir(directory_path)
        .map_err(|error| format!("failed to enumerate directory '{}': {error}", directory_path.display()))?;

    for entry in entries {
        let entry =
            entry.map_err(|error| format!("failed to inspect directory entry '{}': {error}", directory_path.display()))?;
        let entry_path = entry.path();
        let entry_name = entry.file_name().to_string_lossy().to_string();
        let entry_type = entry
            .file_type()
            .map_err(|error| format!("failed to inspect entry type '{}': {error}", entry_path.display()))?;
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
    let database_path = if let Some(configured_path) = std::env::var_os(BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV)
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

fn initialize_database_schema(connection: &Connection) -> Result<(), String> {
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

            CREATE TABLE IF NOT EXISTS terminal_sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                profile_id TEXT NOT NULL,
                cwd TEXT NOT NULL,
                command_history_json TEXT NOT NULL,
                recent_output_json TEXT NOT NULL,
                workspace_id TEXT NOT NULL DEFAULT '',
                project_id TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'idle',
                last_exit_code INTEGER NULL,
                updated_at INTEGER NOT NULL
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

            CREATE TABLE IF NOT EXISTS terminal_executions (
                id TEXT PRIMARY KEY,
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

            CREATE TABLE IF NOT EXISTS coding_sessions (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                workspace_id TEXT NOT NULL,
                project_id TEXT NOT NULL,
                title TEXT NOT NULL,
                status TEXT NOT NULL,
                entry_surface TEXT NOT NULL DEFAULT 'code',
                engine_id TEXT NOT NULL,
                model_id TEXT NULL,
                last_turn_at TEXT NULL
            );

            CREATE TABLE IF NOT EXISTS coding_session_runtimes (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                coding_session_id TEXT NOT NULL,
                engine_id TEXT NOT NULL,
                model_id TEXT NULL,
                host_mode TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'ready',
                transport_kind TEXT NULL,
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

            CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                name TEXT NOT NULL,
                description TEXT NULL,
                owner_identity_id TEXT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                workspace_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NULL,
                root_path TEXT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS teams (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                workspace_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS release_records (
                id TEXT PRIMARY KEY,
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

            CREATE INDEX IF NOT EXISTS idx_terminal_sessions_updated_at
            ON terminal_sessions(updated_at DESC);

            CREATE INDEX IF NOT EXISTS idx_terminal_sessions_profile_id
            ON terminal_sessions(profile_id);

            CREATE INDEX IF NOT EXISTS idx_terminal_sessions_project_id
            ON terminal_sessions(project_id, updated_at DESC);

            CREATE INDEX IF NOT EXISTS idx_run_configurations_scope_group
            ON run_configurations(scope_type, scope_id, group_name);

            CREATE INDEX IF NOT EXISTS idx_terminal_executions_session_started
            ON terminal_executions(session_id, started_at DESC);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_schema_migration_history_provider_migration
            ON schema_migration_history(provider_id, migration_id);

            CREATE UNIQUE INDEX IF NOT EXISTS uk_projects_workspace_name
            ON projects(workspace_id, name);

            CREATE INDEX IF NOT EXISTS idx_coding_sessions_project_updated
            ON coding_sessions(project_id, updated_at);

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
                '{"source":"desktop-open-database","coverage":"authority-direct-read-subset"}'
            );
            "#,
        )
        .map_err(|error| format!("failed to initialize sqlite schema: {error}"))
}

fn parse_local_store_table_records<T>(value: &str, context: &str) -> Result<Vec<T>, String>
where
    T: for<'de> Deserialize<'de>,
{
    serde_json::from_str(value).map_err(|error| format!("failed to parse {context}: {error}"))
}

fn parse_scoped_table_key_session_id(key: &str, prefix: &str) -> Option<String> {
    key.strip_prefix(prefix)?
        .strip_suffix(".v1")
        .map(|session_id| session_id.to_string())
}

fn sql_json_or_default(value: Option<serde_json::Value>, default: &str) -> String {
    value
        .map(|json| json.to_string())
        .unwrap_or_else(|| default.to_string())
}

fn clear_local_store_table_rows(
    connection: &Connection,
    scope: &str,
    key: &str,
) -> Result<(), String> {
    match (scope, key) {
        ("coding-session", LOCAL_STORE_CODING_SESSIONS_KEY) => {
            connection
                .execute("DELETE FROM coding_sessions", [])
                .map_err(|error| format!("failed to clear coding_sessions mirror: {error}"))?;
        }
        ("coding-session", LOCAL_STORE_CODING_SESSION_RUNTIMES_KEY) => {
            connection
                .execute("DELETE FROM coding_session_runtimes", [])
                .map_err(|error| {
                    format!("failed to clear coding_session_runtimes mirror: {error}")
                })?;
        }
        ("coding-session", _) if key.starts_with(LOCAL_STORE_CODING_SESSION_RUNTIMES_KEY_PREFIX) => {
            if let Some(session_id) =
                parse_scoped_table_key_session_id(key, LOCAL_STORE_CODING_SESSION_RUNTIMES_KEY_PREFIX)
            {
                connection
                    .execute(
                        "DELETE FROM coding_session_runtimes WHERE coding_session_id = ?1",
                        [session_id],
                    )
                    .map_err(|error| {
                        format!("failed to clear scoped coding_session_runtimes mirror: {error}")
                    })?;
            }
        }
        ("coding-session", _) if key.starts_with(LOCAL_STORE_CODING_SESSION_EVENTS_KEY_PREFIX) => {
            if let Some(session_id) =
                parse_scoped_table_key_session_id(key, LOCAL_STORE_CODING_SESSION_EVENTS_KEY_PREFIX)
            {
                connection
                    .execute(
                        "DELETE FROM coding_session_events WHERE coding_session_id = ?1",
                        [session_id],
                    )
                    .map_err(|error| {
                        format!("failed to clear scoped coding_session_events mirror: {error}")
                    })?;
            }
        }
        ("coding-session", _) if key.starts_with(LOCAL_STORE_CODING_SESSION_ARTIFACTS_KEY_PREFIX) => {
            if let Some(session_id) = parse_scoped_table_key_session_id(
                key,
                LOCAL_STORE_CODING_SESSION_ARTIFACTS_KEY_PREFIX,
            ) {
                connection
                    .execute(
                        "DELETE FROM coding_session_artifacts WHERE coding_session_id = ?1",
                        [session_id],
                    )
                    .map_err(|error| {
                        format!("failed to clear scoped coding_session_artifacts mirror: {error}")
                    })?;
            }
        }
        ("coding-session", _)
            if key.starts_with(LOCAL_STORE_CODING_SESSION_CHECKPOINTS_KEY_PREFIX) =>
        {
            if let Some(session_id) = parse_scoped_table_key_session_id(
                key,
                LOCAL_STORE_CODING_SESSION_CHECKPOINTS_KEY_PREFIX,
            ) {
                connection
                    .execute(
                        "DELETE FROM coding_session_checkpoints WHERE coding_session_id = ?1",
                        [session_id],
                    )
                    .map_err(|error| {
                        format!("failed to clear scoped coding_session_checkpoints mirror: {error}")
                    })?;
            }
        }
        ("coding-session", _)
            if key.starts_with(LOCAL_STORE_CODING_SESSION_OPERATIONS_KEY_PREFIX) =>
        {
            if let Some(session_id) = parse_scoped_table_key_session_id(
                key,
                LOCAL_STORE_CODING_SESSION_OPERATIONS_KEY_PREFIX,
            ) {
                connection
                    .execute(
                        "DELETE FROM coding_session_operations WHERE coding_session_id = ?1",
                        [session_id],
                    )
                    .map_err(|error| {
                        format!("failed to clear scoped coding_session_operations mirror: {error}")
                    })?;
            }
        }
        ("workspace", LOCAL_STORE_WORKSPACES_KEY) => {
            connection
                .execute("DELETE FROM workspaces", [])
                .map_err(|error| format!("failed to clear workspaces mirror: {error}"))?;
        }
        ("workspace", LOCAL_STORE_PROJECTS_KEY) => {
            connection
                .execute("DELETE FROM projects", [])
                .map_err(|error| format!("failed to clear projects mirror: {error}"))?;
        }
        ("collaboration", LOCAL_STORE_TEAMS_KEY) => {
            connection
                .execute("DELETE FROM teams", [])
                .map_err(|error| format!("failed to clear teams mirror: {error}"))?;
        }
        ("governance", LOCAL_STORE_RELEASE_RECORDS_KEY) => {
            connection
                .execute("DELETE FROM release_records", [])
                .map_err(|error| format!("failed to clear release_records mirror: {error}"))?;
        }
        _ => {}
    }

    Ok(())
}

fn has_backfill_marker(connection: &Connection) -> Result<bool, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT 1
            FROM schema_migration_history
            WHERE provider_id = 'sqlite' AND migration_id = ?1
            LIMIT 1
            "#,
        )
        .map_err(|error| format!("failed to prepare backfill marker probe: {error}"))?;
    let mut rows = statement
        .query([CODING_SERVER_AUTHORITY_BACKFILL_MIGRATION_ID])
        .map_err(|error| format!("failed to query backfill marker probe: {error}"))?;

    rows.next()
        .map(|row| row.is_some())
        .map_err(|error| format!("failed to read backfill marker probe: {error}"))
}

fn mark_backfill_applied(connection: &Connection) -> Result<(), String> {
    connection
        .execute(
            r#"
            INSERT OR IGNORE INTO schema_migration_history (
                id, migration_id, provider_id, status, details_json
            )
            VALUES (?1, ?1, 'sqlite', 'applied', '{"source":"desktop-open-database","mode":"kv-store-replay"}')
            "#,
            [CODING_SERVER_AUTHORITY_BACKFILL_MIGRATION_ID],
        )
        .map_err(|error| format!("failed to persist backfill marker: {error}"))?;
    Ok(())
}

fn sync_local_store_table_rows(
    connection: &Connection,
    scope: &str,
    key: &str,
    value: &str,
) -> Result<(), String> {
    if !key.starts_with(LOCAL_STORE_SQLITE_TABLE_PREFIX) {
        return Ok(());
    }

    clear_local_store_table_rows(connection, scope, key)?;

    if scope == "coding-session" && key == LOCAL_STORE_CODING_SESSIONS_KEY {
        let records = parse_local_store_table_records::<StoredCodingSessionRecord>(
            value,
            "coding session records",
        )?;
        for record in records {
            connection
                .execute(
                    r#"
                    INSERT INTO coding_sessions (
                        id, created_at, updated_at, version, is_deleted,
                        workspace_id, project_id, title, status, entry_surface, engine_id, model_id, last_turn_at
                    )
                    VALUES (
                        ?1, COALESCE(?2, CURRENT_TIMESTAMP), COALESCE(?3, CURRENT_TIMESTAMP), 0, 0,
                        ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11
                    )
                    ON CONFLICT(id)
                    DO UPDATE SET
                        updated_at = COALESCE(excluded.updated_at, CURRENT_TIMESTAMP),
                        workspace_id = excluded.workspace_id,
                        project_id = excluded.project_id,
                        title = excluded.title,
                        status = excluded.status,
                        entry_surface = excluded.entry_surface,
                        engine_id = excluded.engine_id,
                        model_id = excluded.model_id,
                        last_turn_at = excluded.last_turn_at,
                        is_deleted = 0
                    "#,
                    params![
                        record.id,
                        record.created_at,
                        record.updated_at,
                        record.workspace_id,
                        record.project_id,
                        record.title,
                        record.status,
                        record.entry_surface.unwrap_or_else(|| "code".to_string()),
                        record.engine_id,
                        record.model_id,
                        record.last_turn_at,
                    ],
                )
                .map_err(|error| format!("failed to mirror coding session record: {error}"))?;
        }

        return Ok(());
    }

    if scope == "coding-session"
        && (key == LOCAL_STORE_CODING_SESSION_RUNTIMES_KEY
            || key.starts_with(LOCAL_STORE_CODING_SESSION_RUNTIMES_KEY_PREFIX))
    {
        let scoped_session_id =
            parse_scoped_table_key_session_id(key, LOCAL_STORE_CODING_SESSION_RUNTIMES_KEY_PREFIX);
        let records = parse_local_store_table_records::<StoredCodingSessionRuntimeRecord>(
            value,
            "coding session runtime records",
        )?;
        for record in records {
            let native_ref = record.native_ref;
            let transport_kind = record
                .transport_kind
                .or_else(|| native_ref.as_ref().and_then(|value| value.transport_kind.clone()));
            let native_session_id = record
                .native_session_id
                .or_else(|| native_ref.as_ref().and_then(|value| value.native_session_id.clone()));
            let native_turn_container_id = record.native_turn_container_id.or_else(|| {
                native_ref
                    .as_ref()
                    .and_then(|value| value.native_turn_container_id.clone())
            });
            let metadata_json = record
                .metadata_json
                .or(record.metadata)
                .or_else(|| native_ref.and_then(|value| value.metadata));

            connection
                .execute(
                    r#"
                    INSERT INTO coding_session_runtimes (
                        id, created_at, updated_at, version, is_deleted,
                        coding_session_id, engine_id, model_id, host_mode, status, transport_kind,
                        native_session_id, native_turn_container_id, capability_snapshot_json, metadata_json
                    )
                    VALUES (
                        ?1, COALESCE(?2, CURRENT_TIMESTAMP), COALESCE(?3, CURRENT_TIMESTAMP), 0, 0,
                        ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13
                    )
                    ON CONFLICT(id)
                    DO UPDATE SET
                        updated_at = COALESCE(excluded.updated_at, CURRENT_TIMESTAMP),
                        coding_session_id = excluded.coding_session_id,
                        engine_id = excluded.engine_id,
                        model_id = excluded.model_id,
                        host_mode = excluded.host_mode,
                        status = excluded.status,
                        transport_kind = excluded.transport_kind,
                        native_session_id = excluded.native_session_id,
                        native_turn_container_id = excluded.native_turn_container_id,
                        capability_snapshot_json = excluded.capability_snapshot_json,
                        metadata_json = excluded.metadata_json,
                        is_deleted = 0
                    "#,
                    params![
                        record.id,
                        record.created_at,
                        record.updated_at,
                        record
                            .coding_session_id
                            .or_else(|| scoped_session_id.clone())
                            .ok_or_else(|| {
                                "coding session runtime record requires codingSessionId".to_string()
                            })?,
                        record.engine_id.unwrap_or_else(|| "unknown".to_string()),
                        record.model_id,
                        record.host_mode,
                        record.status.unwrap_or_else(|| "ready".to_string()),
                        transport_kind,
                        native_session_id,
                        native_turn_container_id,
                        sql_json_or_default(
                            record.capability_snapshot_json.or(record.capability_snapshot),
                            "{}",
                        ),
                        sql_json_or_default(metadata_json, "{}"),
                    ],
                )
                .map_err(|error| format!("failed to mirror coding session runtime record: {error}"))?;
        }

        return Ok(());
    }

    if scope == "coding-session" && key.starts_with(LOCAL_STORE_CODING_SESSION_EVENTS_KEY_PREFIX) {
        let scoped_session_id =
            parse_scoped_table_key_session_id(key, LOCAL_STORE_CODING_SESSION_EVENTS_KEY_PREFIX);
        let records = parse_local_store_table_records::<StoredCodingSessionEventRecord>(
            value,
            "coding session event records",
        )?;
        for record in records {
            connection
                .execute(
                    r#"
                    INSERT INTO coding_session_events (
                        id, created_at, updated_at, version, is_deleted,
                        coding_session_id, turn_id, runtime_id, event_kind, sequence_no, payload_json
                    )
                    VALUES (
                        ?1, COALESCE(?2, CURRENT_TIMESTAMP), COALESCE(?2, CURRENT_TIMESTAMP), 0, 0,
                        ?3, ?4, ?5, ?6, ?7, ?8
                    )
                    ON CONFLICT(id)
                    DO UPDATE SET
                        updated_at = COALESCE(excluded.updated_at, CURRENT_TIMESTAMP),
                        coding_session_id = excluded.coding_session_id,
                        turn_id = excluded.turn_id,
                        runtime_id = excluded.runtime_id,
                        event_kind = excluded.event_kind,
                        sequence_no = excluded.sequence_no,
                        payload_json = excluded.payload_json,
                        is_deleted = 0
                    "#,
                    params![
                        record.id,
                        record.created_at,
                        record
                            .coding_session_id
                            .or_else(|| scoped_session_id.clone())
                            .ok_or_else(|| {
                                "coding session event record requires codingSessionId".to_string()
                            })?,
                        record.turn_id,
                        record.runtime_id,
                        record.kind,
                        record.sequence,
                        record.payload.to_string(),
                    ],
                )
                .map_err(|error| format!("failed to mirror coding session event record: {error}"))?;
        }

        return Ok(());
    }

    if scope == "coding-session"
        && key.starts_with(LOCAL_STORE_CODING_SESSION_ARTIFACTS_KEY_PREFIX)
    {
        let scoped_session_id =
            parse_scoped_table_key_session_id(key, LOCAL_STORE_CODING_SESSION_ARTIFACTS_KEY_PREFIX);
        let records = parse_local_store_table_records::<StoredCodingSessionArtifactRecord>(
            value,
            "coding session artifact records",
        )?;
        for record in records {
            let status = record.status.unwrap_or_else(|| "sealed".to_string());
            let metadata_value = match record.metadata {
                Some(serde_json::Value::Object(mut object)) => {
                    object
                        .entry("status".to_string())
                        .or_insert(serde_json::Value::String(status.clone()));
                    serde_json::Value::Object(object)
                }
                Some(other) => serde_json::json!({
                    "status": status,
                    "value": other,
                }),
                None => serde_json::json!({
                    "status": status,
                }),
            };

            connection
                .execute(
                    r#"
                    INSERT INTO coding_session_artifacts (
                        id, created_at, updated_at, version, is_deleted,
                        coding_session_id, turn_id, artifact_kind, title, blob_ref, metadata_json
                    )
                    VALUES (
                        ?1, COALESCE(?2, CURRENT_TIMESTAMP), COALESCE(?2, CURRENT_TIMESTAMP), 0, 0,
                        ?3, ?4, ?5, ?6, ?7, ?8
                    )
                    ON CONFLICT(id)
                    DO UPDATE SET
                        updated_at = COALESCE(excluded.updated_at, CURRENT_TIMESTAMP),
                        coding_session_id = excluded.coding_session_id,
                        turn_id = excluded.turn_id,
                        artifact_kind = excluded.artifact_kind,
                        title = excluded.title,
                        blob_ref = excluded.blob_ref,
                        metadata_json = excluded.metadata_json,
                        is_deleted = 0
                    "#,
                    params![
                        record.id,
                        record.created_at,
                        record
                            .coding_session_id
                            .or_else(|| scoped_session_id.clone())
                            .ok_or_else(|| {
                                "coding session artifact record requires codingSessionId".to_string()
                            })?,
                        record.turn_id,
                        record.kind,
                        record.title,
                        record.blob_ref,
                        metadata_value.to_string(),
                    ],
                )
                .map_err(|error| {
                    format!("failed to mirror coding session artifact record: {error}")
                })?;
        }

        return Ok(());
    }

    if scope == "coding-session"
        && key.starts_with(LOCAL_STORE_CODING_SESSION_CHECKPOINTS_KEY_PREFIX)
    {
        let scoped_session_id = parse_scoped_table_key_session_id(
            key,
            LOCAL_STORE_CODING_SESSION_CHECKPOINTS_KEY_PREFIX,
        );
        let records = parse_local_store_table_records::<StoredCodingSessionCheckpointRecord>(
            value,
            "coding session checkpoint records",
        )?;
        for record in records {
            connection
                .execute(
                    r#"
                    INSERT INTO coding_session_checkpoints (
                        id, created_at, updated_at, version, is_deleted,
                        coding_session_id, runtime_id, checkpoint_kind, resumable, state_json
                    )
                    VALUES (
                        ?1, COALESCE(?2, CURRENT_TIMESTAMP), COALESCE(?2, CURRENT_TIMESTAMP), 0, 0,
                        ?3, ?4, ?5, ?6, ?7
                    )
                    ON CONFLICT(id)
                    DO UPDATE SET
                        updated_at = COALESCE(excluded.updated_at, CURRENT_TIMESTAMP),
                        coding_session_id = excluded.coding_session_id,
                        runtime_id = excluded.runtime_id,
                        checkpoint_kind = excluded.checkpoint_kind,
                        resumable = excluded.resumable,
                        state_json = excluded.state_json,
                        is_deleted = 0
                    "#,
                    params![
                        record.id,
                        record.created_at,
                        record
                            .coding_session_id
                            .or_else(|| scoped_session_id.clone())
                            .ok_or_else(|| {
                                "coding session checkpoint record requires codingSessionId".to_string()
                            })?,
                        record.runtime_id,
                        record.checkpoint_kind,
                        if record.resumable { 1_i64 } else { 0_i64 },
                        record.state.to_string(),
                    ],
                )
                .map_err(|error| {
                    format!("failed to mirror coding session checkpoint record: {error}")
                })?;
        }

        return Ok(());
    }

    if scope == "coding-session"
        && key.starts_with(LOCAL_STORE_CODING_SESSION_OPERATIONS_KEY_PREFIX)
    {
        let scoped_session_id = parse_scoped_table_key_session_id(
            key,
            LOCAL_STORE_CODING_SESSION_OPERATIONS_KEY_PREFIX,
        );
        let records = parse_local_store_table_records::<StoredCodingSessionOperationRecord>(
            value,
            "coding session operation records",
        )?;
        for record in records {
            let operation_id = record
                .id
                .or(record.operation_id)
                .ok_or_else(|| "coding session operation record requires operationId".to_string())?;
            let turn_id = record.turn_id.or_else(|| {
                operation_id
                    .strip_suffix(":operation")
                    .map(|value| value.to_string())
            });

            connection
                .execute(
                    r#"
                    INSERT INTO coding_session_operations (
                        id, created_at, updated_at, version, is_deleted,
                        coding_session_id, turn_id, status, stream_url, stream_kind, artifact_refs_json
                    )
                    VALUES (
                        ?1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 0, 0,
                        ?2, ?3, ?4, ?5, ?6, ?7
                    )
                    ON CONFLICT(id)
                    DO UPDATE SET
                        updated_at = CURRENT_TIMESTAMP,
                        coding_session_id = excluded.coding_session_id,
                        turn_id = excluded.turn_id,
                        status = excluded.status,
                        stream_url = excluded.stream_url,
                        stream_kind = excluded.stream_kind,
                        artifact_refs_json = excluded.artifact_refs_json,
                        is_deleted = 0
                    "#,
                    params![
                        operation_id,
                        record
                            .coding_session_id
                            .or_else(|| scoped_session_id.clone())
                            .ok_or_else(|| {
                                "coding session operation record requires codingSessionId".to_string()
                            })?,
                        turn_id,
                        record.status,
                        record.stream_url.unwrap_or_default(),
                        record.stream_kind.unwrap_or_else(|| "sse".to_string()),
                        serde_json::Value::Array(
                            record
                                .artifact_refs
                                .into_iter()
                                .map(serde_json::Value::String)
                                .collect(),
                        )
                        .to_string(),
                    ],
                )
                .map_err(|error| {
                    format!("failed to mirror coding session operation record: {error}")
                })?;
        }

        return Ok(());
    }

    if scope == "workspace" && key == LOCAL_STORE_WORKSPACES_KEY {
        let records =
            parse_local_store_table_records::<StoredWorkspaceRecord>(value, "workspace records")?;
        for record in records {
            connection
                .execute(
                    r#"
                    INSERT INTO workspaces (
                        id, created_at, updated_at, version, is_deleted,
                        name, description, owner_identity_id, status
                    )
                    VALUES (
                        ?1, COALESCE(?2, CURRENT_TIMESTAMP), COALESCE(?3, CURRENT_TIMESTAMP), 0, 0,
                        ?4, ?5, ?6, ?7
                    )
                    ON CONFLICT(id)
                    DO UPDATE SET
                        updated_at = COALESCE(excluded.updated_at, CURRENT_TIMESTAMP),
                        name = excluded.name,
                        description = excluded.description,
                        owner_identity_id = excluded.owner_identity_id,
                        status = excluded.status,
                        is_deleted = 0
                    "#,
                    params![
                        record.id,
                        record.created_at,
                        record.updated_at,
                        record.name,
                        record.description,
                        record.owner_identity_id,
                        record.status.unwrap_or_else(|| "active".to_string()),
                    ],
                )
                .map_err(|error| format!("failed to mirror workspace record: {error}"))?;
        }

        return Ok(());
    }

    if scope == "workspace" && key == LOCAL_STORE_PROJECTS_KEY {
        let records =
            parse_local_store_table_records::<StoredProjectRecord>(value, "project records")?;
        for record in records {
            connection
                .execute(
                    r#"
                    INSERT INTO projects (
                        id, created_at, updated_at, version, is_deleted,
                        workspace_id, name, description, root_path, status
                    )
                    VALUES (
                        ?1, COALESCE(?2, CURRENT_TIMESTAMP), COALESCE(?3, CURRENT_TIMESTAMP), 0, 0,
                        ?4, ?5, ?6, ?7, ?8
                    )
                    ON CONFLICT(id)
                    DO UPDATE SET
                        updated_at = COALESCE(excluded.updated_at, CURRENT_TIMESTAMP),
                        workspace_id = excluded.workspace_id,
                        name = excluded.name,
                        description = excluded.description,
                        root_path = excluded.root_path,
                        status = excluded.status,
                        is_deleted = 0
                    "#,
                    params![
                        record.id,
                        record.created_at,
                        record.updated_at,
                        record.workspace_id,
                        record.name,
                        record.description,
                        record.root_path,
                        record.status,
                    ],
                )
                .map_err(|error| format!("failed to mirror project record: {error}"))?;
        }

        return Ok(());
    }

    if scope == "collaboration" && key == LOCAL_STORE_TEAMS_KEY {
        let records =
            parse_local_store_table_records::<StoredTeamRecord>(value, "team records")?;
        for record in records {
            connection
                .execute(
                    r#"
                    INSERT INTO teams (
                        id, created_at, updated_at, version, is_deleted,
                        workspace_id, name, description, status
                    )
                    VALUES (
                        ?1, COALESCE(?2, CURRENT_TIMESTAMP), COALESCE(?3, CURRENT_TIMESTAMP), 0, 0,
                        ?4, ?5, ?6, ?7
                    )
                    ON CONFLICT(id)
                    DO UPDATE SET
                        updated_at = COALESCE(excluded.updated_at, CURRENT_TIMESTAMP),
                        workspace_id = excluded.workspace_id,
                        name = excluded.name,
                        description = excluded.description,
                        status = excluded.status,
                        is_deleted = 0
                    "#,
                    params![
                        record.id,
                        record.created_at,
                        record.updated_at,
                        record.workspace_id,
                        record.name,
                        record.description,
                        record.status,
                    ],
                )
                .map_err(|error| format!("failed to mirror team record: {error}"))?;
        }

        return Ok(());
    }

    if scope == "governance" && key == LOCAL_STORE_RELEASE_RECORDS_KEY {
        let records = parse_local_store_table_records::<StoredReleaseRecord>(
            value,
            "release records",
        )?;
        for record in records {
            connection
                .execute(
                    r#"
                    INSERT INTO release_records (
                        id, created_at, updated_at, version, is_deleted,
                        release_version, release_kind, rollout_stage, manifest_json, status
                    )
                    VALUES (
                        ?1, COALESCE(?2, CURRENT_TIMESTAMP), COALESCE(?3, CURRENT_TIMESTAMP), 0, 0,
                        ?4, ?5, ?6, ?7, ?8
                    )
                    ON CONFLICT(id)
                    DO UPDATE SET
                        updated_at = COALESCE(excluded.updated_at, CURRENT_TIMESTAMP),
                        release_version = excluded.release_version,
                        release_kind = excluded.release_kind,
                        rollout_stage = excluded.rollout_stage,
                        manifest_json = excluded.manifest_json,
                        status = excluded.status,
                        is_deleted = 0
                    "#,
                    params![
                        record.id,
                        record.created_at,
                        record.updated_at,
                        record.release_version,
                        record.release_kind,
                        record.rollout_stage,
                        sql_json_or_default(record.manifest_json, "{}"),
                        record.status,
                    ],
                )
                .map_err(|error| format!("failed to mirror release record: {error}"))?;
        }
    }

    Ok(())
}

fn backfill_provider_tables_from_kv_store(connection: &Connection) -> Result<(), String> {
    if has_backfill_marker(connection)? {
        return Ok(());
    }

    let mut statement = connection
        .prepare(
            r#"
            SELECT scope, key, value
            FROM kv_store
            WHERE key LIKE 'table.sqlite.%'
            ORDER BY scope ASC, key ASC
            "#,
        )
        .map_err(|error| format!("failed to prepare kv_store backfill query: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| format!("failed to query kv_store backfill rows: {error}"))?;

    for row in rows {
        let (scope, key, value) =
            row.map_err(|error| format!("failed to decode kv_store backfill row: {error}"))?;
        sync_local_store_table_rows(connection, &scope, &key, &value)?;
    }

    mark_backfill_applied(connection)
}

fn ensure_bootstrap_workspace_authority(connection: &Connection) -> Result<(), String> {
    let workspace_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM workspaces WHERE is_deleted = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("failed to count bootstrap workspaces: {error}"))?;
    if workspace_count > 0 {
        return Ok(());
    }

    let default_workspace_payload = serde_json::to_string(&vec![StoredWorkspaceRecord {
        id: DEFAULT_BOOTSTRAP_WORKSPACE_ID.to_string(),
        name: DEFAULT_BOOTSTRAP_WORKSPACE_NAME.to_string(),
        description: Some(DEFAULT_BOOTSTRAP_WORKSPACE_DESCRIPTION.to_string()),
        owner_identity_id: Some(DEFAULT_BOOTSTRAP_WORKSPACE_OWNER_IDENTITY_ID.to_string()),
        status: Some("active".to_string()),
        created_at: None,
        updated_at: None,
    }])
    .map_err(|error| format!("failed to serialize bootstrap workspace payload: {error}"))?;

    connection
        .execute(
            r#"
            INSERT INTO kv_store (scope, key, value, updated_at)
            VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
            ON CONFLICT(scope, key)
            DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            "#,
            params!["workspace", LOCAL_STORE_WORKSPACES_KEY, &default_workspace_payload],
        )
        .map_err(|error| format!("failed to persist bootstrap workspace payload: {error}"))?;

    sync_local_store_table_rows(
        connection,
        "workspace",
        LOCAL_STORE_WORKSPACES_KEY,
        &default_workspace_payload,
    )
}

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let database_path = local_database_path(app)?;
    let connection = Connection::open(database_path)
        .map_err(|error| format!("failed to open sqlite database: {error}"))?;

    migrate_terminal_sessions_schema(&connection)?;
    initialize_database_schema(&connection)?;
    backfill_provider_tables_from_kv_store(&connection)?;
    ensure_bootstrap_workspace_authority(&connection)?;

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
    let local_address = listener
        .local_addr()
        .map_err(|error| format!("failed to resolve embedded coding server local address: {error}"))?;
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

fn start_embedded_coding_server(app: &AppHandle) -> Result<(), String> {
    if DESKTOP_RUNTIME_CONFIG.get().is_some() {
        return Ok(());
    }

    if let Some(api_base_url) = read_explicit_api_base_url() {
        let _ = DESKTOP_RUNTIME_CONFIG.set(DesktopRuntimeConfig { api_base_url });
        return Ok(());
    }

    let connection = open_database(app)?;
    drop(connection);

    let database_path = local_database_path(app)?;
    let router = build_app_from_sqlite_file(&database_path)?;
    let (listener, api_base_url) =
        bind_embedded_coding_server_listener(BIRD_SERVER_DEFAULT_BIND_ADDRESS, BIRD_SERVER_DEFAULT_HOST)?;
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

    let _ = DESKTOP_RUNTIME_CONFIG.set(DesktopRuntimeConfig { api_base_url });
    Ok(())
}

fn migrate_terminal_sessions_schema(connection: &Connection) -> Result<(), String> {
    let mut pragma = connection
        .prepare("PRAGMA table_info(terminal_sessions)")
        .map_err(|error| format!("failed to inspect terminal_sessions schema: {error}"))?;
    let columns = pragma
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("failed to query terminal_sessions schema: {error}"))?;

    let mut column_names = Vec::new();
    for column in columns {
        column_names.push(
            column.map_err(|error| format!("failed to decode terminal_sessions column: {error}"))?,
        );
    }

    if column_names.is_empty() {
        return Ok(());
    }

    let required_columns = [
        "id",
        "title",
        "profile_id",
        "cwd",
        "command_history_json",
        "recent_output_json",
        "workspace_id",
        "project_id",
        "status",
        "last_exit_code",
        "updated_at",
    ];

    if required_columns
        .iter()
        .all(|required| column_names.iter().any(|column| column == required))
    {
        return Ok(());
    }

    connection
        .execute_batch(
            r#"
            ALTER TABLE terminal_sessions RENAME TO terminal_sessions_legacy;

            CREATE TABLE terminal_sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                profile_id TEXT NOT NULL,
                cwd TEXT NOT NULL,
                command_history_json TEXT NOT NULL,
                recent_output_json TEXT NOT NULL,
                workspace_id TEXT NOT NULL DEFAULT '',
                project_id TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'idle',
                last_exit_code INTEGER NULL,
                updated_at INTEGER NOT NULL
            );
            "#,
        )
        .map_err(|error| format!("failed to create terminal_sessions migration table: {error}"))?;

    if column_names.iter().any(|column| column == "payload") {
        let mut statement = connection
            .prepare(
                r#"
                SELECT id, profile_id, cwd, payload, updated_at
                FROM terminal_sessions_legacy
                "#,
            )
            .map_err(|error| format!("failed to read terminal_sessions legacy rows: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                ))
            })
            .map_err(|error| format!("failed to iterate terminal_sessions legacy rows: {error}"))?;

        for row in rows {
            let (id, profile_id, cwd, payload, updated_at) = row
                .map_err(|error| format!("failed to decode terminal_sessions legacy row: {error}"))?;
            let payload_json: serde_json::Value =
                serde_json::from_str(&payload).unwrap_or_else(|_| serde_json::json!({}));
            let title = payload_json
                .get("title")
                .and_then(|value| value.as_str())
                .unwrap_or(&profile_id)
                .to_string();
            let command_history_json = payload_json
                .get("commandHistory")
                .cloned()
                .unwrap_or_else(|| serde_json::json!([]))
                .to_string();
            let recent_output_json = payload_json
                .get("recentOutput")
                .cloned()
                .unwrap_or_else(|| serde_json::json!([]))
                .to_string();
            let updated_at = updated_at.parse::<i64>().unwrap_or(0);

            connection
                .execute(
                    r#"
                    INSERT INTO terminal_sessions (
                        id, title, profile_id, cwd, command_history_json, recent_output_json, workspace_id, project_id, status, last_exit_code, updated_at
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                    "#,
                    params![
                        id,
                        title,
                        profile_id,
                        cwd,
                        command_history_json,
                        recent_output_json,
                        "",
                        "",
                        "idle",
                        Option::<i32>::None,
                        updated_at
                    ],
                )
                .map_err(|error| format!("failed to migrate terminal_sessions row: {error}"))?;
        }
    } else {
        let workspace_id_column = if column_names.iter().any(|column| column == "workspace_id") {
            "workspace_id"
        } else {
            "'' AS workspace_id"
        };
        let project_id_column = if column_names.iter().any(|column| column == "project_id") {
            "project_id"
        } else {
            "'' AS project_id"
        };
        let status_column = if column_names.iter().any(|column| column == "status") {
            "status"
        } else {
            "'idle' AS status"
        };
        let last_exit_code_column = if column_names.iter().any(|column| column == "last_exit_code") {
            "last_exit_code"
        } else {
            "NULL AS last_exit_code"
        };

        let query = format!(
            r#"
            SELECT id, title, profile_id, cwd, command_history_json, recent_output_json, {workspace_id_column}, {project_id_column}, {status_column}, {last_exit_code_column}, updated_at
            FROM terminal_sessions_legacy
            "#,
        );

        let mut statement = connection
            .prepare(&query)
            .map_err(|error| format!("failed to read terminal_sessions structured rows: {error}"))?;
        let rows = statement
            .query_map([], |row| {
                Ok(TerminalSessionRecord {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    profile_id: row.get(2)?,
                    cwd: row.get(3)?,
                    command_history_json: row.get(4)?,
                    recent_output_json: row.get(5)?,
                    workspace_id: row.get(6)?,
                    project_id: row.get(7)?,
                    status: row.get(8)?,
                    last_exit_code: row.get(9)?,
                    updated_at: row.get(10)?,
                })
            })
            .map_err(|error| format!("failed to iterate terminal_sessions structured rows: {error}"))?;

        for row in rows {
            let record = row
                .map_err(|error| format!("failed to decode terminal_sessions structured row: {error}"))?;

            connection
                .execute(
                    r#"
                    INSERT INTO terminal_sessions (
                        id, title, profile_id, cwd, command_history_json, recent_output_json, workspace_id, project_id, status, last_exit_code, updated_at
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                    "#,
                    params![
                        record.id,
                        record.title,
                        record.profile_id,
                        record.cwd,
                        record.command_history_json,
                        record.recent_output_json,
                        record.workspace_id,
                        record.project_id,
                        record.status,
                        record.last_exit_code,
                        record.updated_at
                    ],
                )
                .map_err(|error| format!("failed to migrate terminal_sessions structured row: {error}"))?;
        }
    }

    connection
        .execute("DROP TABLE terminal_sessions_legacy", [])
        .map_err(|error| format!("failed to drop terminal_sessions legacy table: {error}"))?;

    Ok(())
}

#[tauri::command]
fn host_mode() -> &'static str {
    "desktop"
}

#[tauri::command]
fn desktop_runtime_config() -> Result<DesktopRuntimeConfig, String> {
    DESKTOP_RUNTIME_CONFIG
        .get()
        .cloned()
        .ok_or_else(|| "desktop runtime config is unavailable".to_string())
}

#[tauri::command]
fn local_store_get(app: AppHandle, scope: String, key: String) -> Result<Option<String>, String> {
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
}

#[tauri::command]
fn local_store_set(
    app: AppHandle,
    scope: String,
    key: String,
    value: String,
) -> Result<(), String> {
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
    sync_local_store_table_rows(&connection, &scope, &key, &value)?;
    Ok(())
}

#[tauri::command]
fn local_store_delete(app: AppHandle, scope: String, key: String) -> Result<(), String> {
    let connection = open_database(&app)?;
    connection
        .execute(
            "DELETE FROM kv_store WHERE scope = ?1 AND key = ?2",
            params![&scope, &key],
        )
        .map_err(|error| format!("failed to delete local store value: {error}"))?;
    clear_local_store_table_rows(&connection, &scope, &key)?;
    Ok(())
}

#[tauri::command]
fn local_store_list(app: AppHandle, scope: String) -> Result<Vec<LocalStoreEntry>, String> {
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
        entries.push(row.map_err(|error| format!("failed to decode local_store_list row: {error}"))?);
    }

    Ok(entries)
}

#[tauri::command]
fn fs_snapshot_folder(root_path: String) -> Result<FileSystemSnapshotResponse, String> {
    let root_directory = resolve_root_directory_path(&root_path)?;
    let root_virtual_path = format!("/{}", resolve_root_directory_name(&root_directory));
    let tree = build_directory_snapshot(&root_directory, &root_virtual_path)?;

    Ok(FileSystemSnapshotResponse {
        root_virtual_path,
        tree,
    })
}

#[tauri::command]
fn fs_read_file(root_path: String, relative_path: String) -> Result<String, String> {
    let file_path = resolve_scoped_path(&root_path, &relative_path)?;
    fs::read_to_string(&file_path)
        .map_err(|error| format!("failed to read mounted file '{}': {error}", file_path.display()))
}

#[tauri::command]
fn fs_write_file(root_path: String, relative_path: String, content: String) -> Result<(), String> {
    let file_path = resolve_scoped_path(&root_path, &relative_path)?;
    fs::write(&file_path, content)
        .map_err(|error| format!("failed to write mounted file '{}': {error}", file_path.display()))
}

#[tauri::command]
fn fs_create_file(root_path: String, relative_path: String) -> Result<(), String> {
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
        .map_err(|error| format!("failed to create mounted file '{}': {error}", file_path.display()))?;

    Ok(())
}

#[tauri::command]
fn fs_create_directory(root_path: String, relative_path: String) -> Result<(), String> {
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
}

#[tauri::command]
fn fs_delete_entry(
    root_path: String,
    relative_path: String,
    recursive: bool,
) -> Result<(), String> {
    let entry_path = resolve_scoped_path(&root_path, &relative_path)?;
    let metadata = fs::metadata(&entry_path)
        .map_err(|error| format!("failed to inspect mounted entry '{}': {error}", entry_path.display()))?;

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
        fs::remove_file(&entry_path)
            .map_err(|error| format!("failed to delete mounted file '{}': {error}", entry_path.display()))?;
    }

    Ok(())
}

#[tauri::command]
fn fs_rename_entry(
    root_path: String,
    old_relative_path: String,
    new_relative_path: String,
) -> Result<(), String> {
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
}

#[tauri::command]
fn terminal_session_upsert(app: AppHandle, record: TerminalSessionRecord) -> Result<(), String> {
    let connection = open_database(&app)?;
    connection
        .execute(
            r#"
            INSERT INTO terminal_sessions (
                id, title, profile_id, cwd, command_history_json, recent_output_json, workspace_id, project_id, status, last_exit_code, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            ON CONFLICT(id)
            DO UPDATE SET
                title = excluded.title,
                profile_id = excluded.profile_id,
                cwd = excluded.cwd,
                command_history_json = excluded.command_history_json,
                recent_output_json = excluded.recent_output_json,
                workspace_id = excluded.workspace_id,
                project_id = excluded.project_id,
                status = excluded.status,
                last_exit_code = excluded.last_exit_code,
                updated_at = excluded.updated_at
            "#,
            params![
                record.id,
                record.title,
                record.profile_id,
                record.cwd,
                record.command_history_json,
                record.recent_output_json,
                record.workspace_id,
                record.project_id,
                record.status,
                record.last_exit_code,
                record.updated_at
            ],
        )
        .map_err(|error| format!("failed to persist terminal session: {error}"))?;
    Ok(())
}

#[tauri::command]
fn terminal_session_delete(app: AppHandle, id: String) -> Result<(), String> {
    let connection = open_database(&app)?;
    connection
        .execute("DELETE FROM terminal_sessions WHERE id = ?1", params![id])
        .map_err(|error| format!("failed to delete terminal session: {error}"))?;
    Ok(())
}

#[tauri::command]
fn terminal_session_list(app: AppHandle) -> Result<Vec<TerminalSessionRecord>, String> {
    let connection = open_database(&app)?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, title, profile_id, cwd, command_history_json, recent_output_json, updated_at
                 , workspace_id, project_id, status, last_exit_code
            FROM terminal_sessions
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("failed to prepare terminal_session_list: {error}"))?;

    let rows = statement
        .query_map([], |row| {
            Ok(TerminalSessionRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                profile_id: row.get(2)?,
                cwd: row.get(3)?,
                command_history_json: row.get(4)?,
                recent_output_json: row.get(5)?,
                updated_at: row.get(6)?,
                workspace_id: row.get(7)?,
                project_id: row.get(8)?,
                status: row.get(9)?,
                last_exit_code: row.get(10)?,
            })
        })
        .map_err(|error| format!("failed to query terminal sessions: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
      records.push(
          row.map_err(|error| format!("failed to decode terminal session row: {error}"))?,
      );
    }

    Ok(records)
}

fn execute_terminal_command_internal(
    request: TerminalExecutionRequest,
) -> Result<TerminalExecutionResult, String> {
    let mut command = std::process::Command::new(&request.executable);
    command.args(&request.args);

    if !request.cwd.trim().is_empty() && !request.cwd.trim().starts_with('~') {
        command.current_dir(&request.cwd);
    }

    let output = command
        .output()
        .map_err(|error| format!("failed to execute terminal command '{}': {error}", request.executable))?;

    Ok(TerminalExecutionResult {
        profile_id: request.profile_id,
        kind: request.kind,
        executable: request.executable,
        args: request.args,
        cwd: request.cwd,
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
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
fn terminal_host_session_open(
    request: TerminalHostSessionState,
) -> Result<TerminalHostSessionState, String> {
    Ok(TerminalHostSessionState {
        status: "idle".to_string(),
        last_exit_code: None,
        ..request
    })
}

#[tauri::command]
fn terminal_host_session_execute(
    request: TerminalHostSessionExecuteRequest,
) -> Result<TerminalHostSessionExecuteResponse, String> {
    let execution = execute_terminal_command_internal(TerminalExecutionRequest {
        profile_id: request.profile_id.clone(),
        kind: request.kind.clone(),
        executable: request.executable,
        args: request.args,
        cwd: request.cwd.clone(),
    })?;
    let status = if execution.exit_code == 0 {
        "idle".to_string()
    } else {
        "error".to_string()
    };

    Ok(TerminalHostSessionExecuteResponse {
        state: TerminalHostSessionState {
            session_id: request.session_id,
            profile_id: request.profile_id,
            kind: request.kind,
            title: request.title,
            cwd: request.cwd,
            status,
            last_exit_code: Some(execution.exit_code),
        },
        execution,
    })
}

#[tauri::command]
fn terminal_host_session_close(_session_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn terminal_cli_profile_detect(
    request: TerminalCliProfileDetectRequest,
) -> Result<TerminalCliProfileAvailability, String> {
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
}

#[tauri::command]
fn execute_terminal_command(
    request: TerminalExecutionRequest,
) -> Result<TerminalExecutionResult, String> {
    execute_terminal_command_internal(request)
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            start_embedded_coding_server(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            host_mode,
            desktop_runtime_config,
            local_store_get,
            local_store_set,
            local_store_delete,
            local_store_list,
            fs_snapshot_folder,
            fs_read_file,
            fs_write_file,
            fs_create_file,
            fs_create_directory,
            fs_delete_entry,
            fs_rename_entry,
            terminal_session_upsert,
            terminal_session_delete,
            terminal_session_list,
            terminal_host_session_open,
            terminal_host_session_execute,
            terminal_host_session_close,
            terminal_cli_profile_detect,
            execute_terminal_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running sdkwork birdcoder desktop");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bind_embedded_coding_server_listener_falls_back_to_ephemeral_loopback_port_when_preferred_port_is_occupied(
    ) {
        let blocking_listener =
            std::net::TcpListener::bind((BIRD_SERVER_DEFAULT_HOST, 0)).expect("bind blocking listener");
        let occupied_address = blocking_listener
            .local_addr()
            .expect("read blocking listener local address");

        let (listener, api_base_url) = bind_embedded_coding_server_listener(
            &occupied_address.to_string(),
            BIRD_SERVER_DEFAULT_HOST,
        )
        .expect("bind fallback embedded coding server listener");
        let local_address = listener.local_addr().expect("read fallback listener local address");

        assert_eq!(local_address.ip().to_string(), BIRD_SERVER_DEFAULT_HOST);
        assert_ne!(local_address.port(), occupied_address.port());
        assert_eq!(api_base_url, format!("http://{local_address}"));
    }

    fn table_exists(connection: &Connection, table_name: &str) -> bool {
        let mut statement = connection
            .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1")
            .expect("prepare table probe");
        let mut rows = statement.query([table_name]).expect("query table probe");
        rows.next()
            .expect("read table probe")
            .is_some()
    }

    fn query_count(connection: &Connection, sql: &str) -> i64 {
        connection
            .query_row(sql, [], |row| row.get(0))
            .expect("query count")
    }

    #[test]
    fn initialize_database_schema_creates_direct_authority_tables_and_migration_markers() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");

        initialize_database_schema(&connection).expect("initialize sqlite schema");

        for table_name in [
            "kv_store",
            "schema_migration_history",
            "coding_sessions",
            "coding_session_runtimes",
            "coding_session_events",
            "coding_session_artifacts",
            "coding_session_checkpoints",
            "coding_session_operations",
            "workspaces",
            "projects",
            "teams",
            "release_records",
        ] {
            assert!(table_exists(&connection, table_name), "missing table: {table_name}");
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
    fn sync_local_store_table_rows_materializes_provider_authority_tables() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");
        initialize_database_schema(&connection).expect("initialize sqlite schema");

        sync_local_store_table_rows(
            &connection,
            "coding-session",
            "table.sqlite.coding-sessions.v1",
            r#"[{
                "id":"sqlite-session",
                "workspaceId":"workspace-sqlite",
                "projectId":"project-sqlite",
                "title":"SQLite authority session",
                "status":"active",
                "hostMode":"desktop",
                "engineId":"claude-code",
                "modelId":"claude-sonnet-4",
                "createdAt":"2026-04-10T11:59:59Z",
                "updatedAt":"2026-04-10T12:00:02Z",
                "lastTurnAt":"2026-04-10T12:00:02Z"
            }]"#,
        )
        .expect("sync coding sessions");
        sync_local_store_table_rows(
            &connection,
            "coding-session",
            "table.sqlite.coding-session-runtimes.sqlite-session.v1",
            r#"[{
                "id":"sqlite-runtime",
                "codingSessionId":"sqlite-session",
                "engineId":"claude-code",
                "modelId":"claude-sonnet-4",
                "hostMode":"server",
                "status":"ready",
                "transportKind":"stdio",
                "nativeSessionId":"native-session-1",
                "nativeTurnContainerId":"native-turns-1",
                "capabilitySnapshotJson":{"supportsDiff":true},
                "metadataJson":{"source":"desktop"}
            }]"#,
        )
        .expect("sync runtimes");
        sync_local_store_table_rows(
            &connection,
            "coding-session",
            "table.sqlite.coding-session-events.sqlite-session.v1",
            r#"[{
                "id":"sqlite-runtime:sqlite-turn:event:0",
                "codingSessionId":"sqlite-session",
                "turnId":"sqlite-turn",
                "runtimeId":"sqlite-runtime",
                "kind":"turn.completed",
                "sequence":0,
                "payload":{"engineId":"claude-code","runtimeStatus":"completed"},
                "createdAt":"2026-04-10T12:00:00Z"
            }]"#,
        )
        .expect("sync events");
        sync_local_store_table_rows(
            &connection,
            "coding-session",
            "table.sqlite.coding-session-artifacts.sqlite-session.v1",
            r#"[{
                "id":"sqlite-turn:artifact:1",
                "codingSessionId":"sqlite-session",
                "turnId":"sqlite-turn",
                "kind":"patch",
                "status":"sealed",
                "title":"SQLite authority patch",
                "metadata":{"sourceEngineId":"claude-code"},
                "createdAt":"2026-04-10T12:00:01Z"
            }]"#,
        )
        .expect("sync artifacts");
        sync_local_store_table_rows(
            &connection,
            "coding-session",
            "table.sqlite.coding-session-checkpoints.sqlite-session.v1",
            r#"[{
                "id":"sqlite-checkpoint:1",
                "codingSessionId":"sqlite-session",
                "runtimeId":"sqlite-runtime",
                "checkpointKind":"approval",
                "resumable":true,
                "state":{"approvalId":"approval-1","reason":"Need confirmation"},
                "createdAt":"2026-04-10T12:00:03Z"
            }]"#,
        )
        .expect("sync checkpoints");
        sync_local_store_table_rows(
            &connection,
            "coding-session",
            "table.sqlite.coding-session-operations.sqlite-session.v1",
            r#"[{
                "operationId":"sqlite-turn:operation",
                "codingSessionId":"sqlite-session",
                "turnId":"sqlite-turn",
                "status":"succeeded",
                "artifactRefs":["sqlite-turn:artifact:1"],
                "streamUrl":"/api/core/v1/coding-sessions/sqlite-session/events",
                "streamKind":"sse"
            }]"#,
        )
        .expect("sync operations");
        sync_local_store_table_rows(
            &connection,
            "workspace",
            "table.sqlite.workspaces.v1",
            r#"[{
                "id":"workspace-sqlite",
                "name":"SQLite authority workspace",
                "description":"Authority-backed app workspace list item",
                "ownerIdentityId":"identity-sqlite-owner",
                "status":"active"
            }]"#,
        )
        .expect("sync workspaces");
        sync_local_store_table_rows(
            &connection,
            "workspace",
            "table.sqlite.projects.v1",
            r#"[{
                "id":"project-sqlite",
                "workspaceId":"workspace-sqlite",
                "name":"SQLite authority project",
                "description":"Authority-backed app project list item",
                "rootPath":"E:/sdkwork/project-sqlite",
                "status":"active"
            }]"#,
        )
        .expect("sync projects");
        sync_local_store_table_rows(
            &connection,
            "collaboration",
            "table.sqlite.teams.v1",
            r#"[{
                "id":"team-sqlite",
                "workspaceId":"workspace-sqlite",
                "name":"SQLite authority team",
                "description":"Authority-backed admin team list item",
                "status":"active"
            }]"#,
        )
        .expect("sync teams");
        sync_local_store_table_rows(
            &connection,
            "governance",
            "table.sqlite.release-records.v1",
            r#"[{
                "id":"release-0.2.0-sqlite",
                "releaseVersion":"0.2.0-sqlite",
                "releaseKind":"formal",
                "rolloutStage":"general-availability",
                "status":"ready"
            }]"#,
        )
        .expect("sync releases");

        assert_eq!(query_count(&connection, "SELECT COUNT(*) FROM coding_sessions"), 1);
        assert_eq!(
            query_count(&connection, "SELECT COUNT(*) FROM coding_session_runtimes"),
            1
        );
        assert_eq!(query_count(&connection, "SELECT COUNT(*) FROM coding_session_events"), 1);
        assert_eq!(
            query_count(&connection, "SELECT COUNT(*) FROM coding_session_artifacts"),
            1
        );
        assert_eq!(
            query_count(&connection, "SELECT COUNT(*) FROM coding_session_checkpoints"),
            1
        );
        assert_eq!(
            query_count(&connection, "SELECT COUNT(*) FROM coding_session_operations"),
            1
        );
        assert_eq!(query_count(&connection, "SELECT COUNT(*) FROM workspaces"), 1);
        assert_eq!(query_count(&connection, "SELECT COUNT(*) FROM projects"), 1);
        assert_eq!(query_count(&connection, "SELECT COUNT(*) FROM teams"), 1);
        assert_eq!(query_count(&connection, "SELECT COUNT(*) FROM release_records"), 1);

        let host_mode: String = connection
            .query_row(
                "SELECT host_mode FROM coding_session_runtimes WHERE id = 'sqlite-runtime'",
                [],
                |row| row.get(0),
            )
            .expect("query runtime host mode");
        assert_eq!(host_mode, "server");

        let artifact_refs_json: String = connection
            .query_row(
                "SELECT artifact_refs_json FROM coding_session_operations WHERE turn_id = 'sqlite-turn'",
                [],
                |row| row.get(0),
            )
            .expect("query operation artifact refs");
        assert_eq!(artifact_refs_json, r#"["sqlite-turn:artifact:1"]"#);
    }

    #[test]
    fn backfill_provider_tables_from_kv_store_replays_existing_rows_once() {
        let connection = Connection::open_in_memory().expect("open in-memory sqlite");
        initialize_database_schema(&connection).expect("initialize sqlite schema");

        connection
            .execute(
                r#"
                INSERT INTO kv_store (scope, key, value, updated_at)
                VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
                "#,
                params![
                    "workspace",
                    "table.sqlite.workspaces.v1",
                    r#"[{
                        "id":"workspace-backfill",
                        "name":"Backfill workspace",
                        "description":"Recovered from kv_store",
                        "ownerIdentityId":"identity-backfill-owner",
                        "status":"active"
                    }]"#
                ],
            )
            .expect("insert kv_store workspace fixture");

        connection
            .execute(
                r#"
                INSERT INTO kv_store (scope, key, value, updated_at)
                VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
                "#,
                params![
                    "workspace",
                    "table.sqlite.projects.v1",
                    r#"[{
                        "id":"project-backfill",
                        "workspaceId":"workspace-backfill",
                        "name":"Backfill project",
                        "description":"Recovered from kv_store",
                        "rootPath":"E:/sdkwork/project-backfill",
                        "status":"active"
                    }]"#
                ],
            )
            .expect("insert kv_store project fixture");

        backfill_provider_tables_from_kv_store(&connection).expect("run first backfill");
        backfill_provider_tables_from_kv_store(&connection).expect("run second backfill");

        assert_eq!(query_count(&connection, "SELECT COUNT(*) FROM workspaces"), 1);
        assert_eq!(query_count(&connection, "SELECT COUNT(*) FROM projects"), 1);
        assert_eq!(
            query_count(
                &connection,
                &format!(
                    "SELECT COUNT(*) FROM schema_migration_history WHERE migration_id = '{}'",
                    CODING_SERVER_AUTHORITY_BACKFILL_MIGRATION_ID
                )
            ),
            1
        );
    }
}
