use rusqlite::{params, Connection};
use sdkwork_birdcoder_server::{
    build_app_from_sqlite_file, initialize_sqlite_provider_authority_schema,
    print_coding_server_startup_summary, BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV,
    BIRD_SERVER_DEFAULT_BIND_ADDRESS, BIRD_SERVER_DEFAULT_HOST,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use std::time::UNIX_EPOCH;
use tauri::{AppHandle, Manager};

mod file_system_watch;
mod terminal_bridge;
mod window_controls_bridge;

const RESERVED_AUTHORITY_LOCAL_STORE_KEY_PREFIX: &str = "table.sqlite.";
const DEFAULT_BOOTSTRAP_WORKSPACE_ID: &str = "100000000000000101";
const DEFAULT_BOOTSTRAP_WORKSPACE_NAME: &str = "Default Workspace";
const DEFAULT_BOOTSTRAP_WORKSPACE_DESCRIPTION: &str = "Primary local workspace for BirdCoder.";
const DEFAULT_BOOTSTRAP_WORKSPACE_OWNER_USER_ID: &str = "100000000000000001";
const DEFAULT_BOOTSTRAP_TENANT_ID: &str = "0";
const DEFAULT_PRIVATE_DATA_SCOPE: &str = "PRIVATE";

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

fn initialize_database_schema(connection: &Connection) -> Result<(), String> {
    initialize_sqlite_provider_authority_schema(connection)?;
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                model_id TEXT NOT NULL,
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

            CREATE TABLE IF NOT EXISTS workspaces (
                id INTEGER PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
                data_scope TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                name TEXT NOT NULL,
                code TEXT NULL,
                title TEXT NULL,
                description TEXT NULL,
                owner_id TEXT NULL,
                leader_id TEXT NULL,
                created_by_user_id TEXT NULL,
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

            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
                data_scope TEXT NULL,
                user_id TEXT NULL,
                parent_id TEXT NULL,
                parent_uuid TEXT NULL,
                parent_metadata TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                workspace_id INTEGER NOT NULL,
                workspace_uuid TEXT NULL,
                name TEXT NOT NULL,
                code TEXT NULL,
                title TEXT NULL,
                description TEXT NULL,
                root_path TEXT NULL,
                author TEXT NULL,
                file_id TEXT NULL,
                type TEXT NULL,
                site_path TEXT NULL,
                domain_prefix TEXT NULL,
                conversation_id TEXT NULL,
                owner_id TEXT NULL,
                leader_id TEXT NULL,
                created_by_user_id TEXT NULL,
                start_time TEXT NULL,
                end_time TEXT NULL,
                budget_amount INTEGER NULL,
                cover_image_json TEXT NULL,
                is_template INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS skill_packages (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                workspace_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                code TEXT NULL,
                title TEXT NULL,
                description TEXT NULL,
                owner_id TEXT NULL,
                leader_id TEXT NULL,
                created_by_user_id TEXT NULL,
                metadata_json TEXT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS project_documents (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                team_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                created_by_user_id TEXT NULL,
                granted_by_user_id TEXT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS workspace_members (
                id INTEGER PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                workspace_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                team_id INTEGER NULL,
                role TEXT NOT NULL,
                created_by_user_id TEXT NULL,
                granted_by_user_id TEXT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS project_collaborators (
                id INTEGER PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                version INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                project_id INTEGER NOT NULL,
                workspace_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                team_id INTEGER NULL,
                role TEXT NOT NULL,
                created_by_user_id TEXT NULL,
                granted_by_user_id TEXT NULL,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS release_records (
                id TEXT PRIMARY KEY,
                uuid TEXT NULL,
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
                tenant_id TEXT NULL,
                organization_id TEXT NULL,
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
            "SELECT COUNT(*) FROM workspaces WHERE is_deleted = 0",
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
            INSERT INTO workspaces (
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
                Option::<String>::None,
                DEFAULT_PRIVATE_DATA_SCOPE,
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

fn open_database(app: &AppHandle) -> Result<Connection, String> {
    let database_path = local_database_path(app)?;
    let connection = Connection::open(database_path)
        .map_err(|error| format!("failed to open sqlite database: {error}"))?;

    initialize_database_schema(&connection)?;
    purge_reserved_authority_local_store_rows(&connection)?;
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

fn start_embedded_coding_server(app: &AppHandle) -> Result<(), String> {
    if DESKTOP_RUNTIME_CONFIG.get().is_some() {
        return Ok(());
    }

    if let Some(api_base_url) = read_explicit_api_base_url() {
        let _ = DESKTOP_RUNTIME_CONFIG.set(DesktopRuntimeConfig { api_base_url });
        if let Some(runtime_config) = DESKTOP_RUNTIME_CONFIG.get() {
            print_coding_server_startup_summary(&runtime_config.api_base_url);
        }
        return Ok(());
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

    let _ = DESKTOP_RUNTIME_CONFIG.set(DesktopRuntimeConfig { api_base_url });
    if let Some(runtime_config) = DESKTOP_RUNTIME_CONFIG.get() {
        print_coding_server_startup_summary(&runtime_config.api_base_url);
    }
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
    if local_store_key_targets_authority_tables(&key) {
        return Err(format!(
            "local store key '{}' is reserved for direct authority tables and is not readable via kv_store",
            key
        ));
    }
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
    if local_store_key_targets_authority_tables(&key) {
        return Err(format!(
            "local store key '{}' is reserved for direct authority tables and cannot be written via kv_store",
            key
        ));
    }
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
}

#[tauri::command]
fn local_store_delete(app: AppHandle, scope: String, key: String) -> Result<(), String> {
    if local_store_key_targets_authority_tables(&key) {
        return Err(format!(
            "local store key '{}' is reserved for direct authority tables and cannot be deleted via kv_store",
            key
        ));
    }
    let connection = open_database(&app)?;
    connection
        .execute(
            "DELETE FROM kv_store WHERE scope = ?1 AND key = ?2",
            params![&scope, &key],
        )
        .map_err(|error| format!("failed to delete local store value: {error}"))?;
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
        let entry =
            row.map_err(|error| format!("failed to decode local_store_list row: {error}"))?;
        if local_store_key_targets_authority_tables(&entry.key) {
            continue;
        }
        entries.push(entry);
    }

    Ok(entries)
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

#[tauri::command]
fn fs_read_file(root_path: String, relative_path: String) -> Result<String, String> {
    let file_path = resolve_scoped_path(&root_path, &relative_path)?;
    fs::read_to_string(&file_path).map_err(|error| {
        format!(
            "failed to read mounted file '{}': {error}",
            file_path.display()
        )
    })
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
fn fs_get_file_revision(root_path: String, relative_path: String) -> Result<String, String> {
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
}

#[tauri::command]
fn fs_get_file_revisions(
    root_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<FileSystemFileRevisionProbeResponse>, String> {
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
}

#[tauri::command]
fn fs_get_directory_revisions(
    root_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<FileSystemFileRevisionProbeResponse>, String> {
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
}

#[tauri::command]
fn fs_write_file(root_path: String, relative_path: String, content: String) -> Result<(), String> {
    let file_path = resolve_scoped_path(&root_path, &relative_path)?;
    fs::write(&file_path, content).map_err(|error| {
        format!(
            "failed to write mounted file '{}': {error}",
            file_path.display()
        )
    })
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
        .map_err(|error| {
            format!(
                "failed to create mounted file '{}': {error}",
                file_path.display()
            )
        })?;

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

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            app.manage(file_system_watch::FileSystemWatchState::new());
            app.manage(terminal_bridge::DesktopRuntimeState::new(Some(
                app.handle().clone(),
            )));
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
            assert!(
                table_exists(&connection, table_name),
                "missing table: {table_name}"
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
}
