use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::path::PathBuf;
use tauri::AppHandle;
use uuid::Uuid;

use crate::host::state::open_device_state;

use super::filesystem_commands::{
    authorize_provider_session_directory_identity, ProviderSessionDirectoryIdentity,
};

const RESERVED_AUTHORITY_LOCAL_STORE_KEY_PREFIX: &str = "table.sqlite.";
const APP_SETTINGS_SCOPE: &str = "settings";
const APP_SETTINGS_KEY: &str = "app";
const DESKTOP_RUNTIME_LOCATION_IDENTITY_SCOPE: &str = "desktop-runtime-location-identity";
const DESKTOP_RUNTIME_LOCATION_INSTALLATION_KEY: &str = "installation.v1";
const DESKTOP_RUNTIME_TARGET_ID_PREFIX: &str = "desktop-device:";
const DESKTOP_RUNTIME_ROOT_LOCATOR_PREFIX: &str = "desktop-root:";
const PROJECT_DEVICE_MOUNTS_SCOPE: &str = "project-device-mounts";
const PROJECT_DEVICE_MOUNT_KEY_HEX_LENGTH: usize = 64;
const MAX_DEVICE_STATE_VALUE_BYTES: usize = 256 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalStoreEntry {
    pub scope: String,
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDeviceMountEntry {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredProjectDeviceMountIdentity {
    owner_key: Option<String>,
    path: Option<String>,
    project_id: Option<String>,
    root_locator: Option<String>,
    version: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopRuntimeLocationInstallIdentity {
    pub runtime_target_id: String,
}

fn is_valid_prefixed_uuid(value: &str, prefix: &str) -> bool {
    value
        .strip_prefix(prefix)
        .and_then(|suffix| Uuid::parse_str(suffix).ok())
        .is_some()
}

fn create_prefixed_uuid(prefix: &str) -> String {
    format!("{prefix}{}", Uuid::new_v4())
}

fn local_store_key_targets_authority_tables(key: &str) -> bool {
    key.starts_with(RESERVED_AUTHORITY_LOCAL_STORE_KEY_PREFIX)
}

fn is_project_device_mount_key(key: &str) -> bool {
    key.len() == PROJECT_DEVICE_MOUNT_KEY_HEX_LENGTH
        && key.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn normalize_project_device_mount_owner_keys(
    owner_keys: Vec<String>,
) -> Result<BTreeSet<String>, String> {
    if owner_keys.is_empty() || owner_keys.len() > 4 {
        return Err("project mount recovery requires between one and four owner keys".to_string());
    }

    let normalized = owner_keys
        .into_iter()
        .map(|owner_key| owner_key.trim().to_ascii_lowercase())
        .collect::<BTreeSet<_>>();
    if normalized
        .iter()
        .any(|owner_key| !is_project_device_mount_key(owner_key))
    {
        return Err("project mount recovery owner keys must be SHA-256 hex digests".to_string());
    }
    Ok(normalized)
}

fn normalize_project_device_mount_path_identity(path: &str) -> String {
    let mut normalized = path.trim().replace('\\', "/");
    while normalized.ends_with('/')
        && normalized.len() > 1
        && !(normalized.len() == 3 && normalized.as_bytes().get(1) == Some(&b':'))
    {
        normalized.pop();
    }
    if cfg!(windows) {
        normalized.make_ascii_lowercase();
    }
    normalized
}

fn read_project_device_mount_by_identity(
    connection: &rusqlite::Connection,
    project_id: &str,
    owner_keys: &BTreeSet<String>,
) -> Result<Option<ProjectDeviceMountEntry>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT key, value
            FROM device_state_entry
            WHERE scope = ?1
            ORDER BY updated_at DESC, key ASC
            "#,
        )
        .map_err(|error| format!("failed to prepare project mount recovery: {error}"))?;
    let rows = statement
        .query_map(params![PROJECT_DEVICE_MOUNTS_SCOPE], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| format!("failed to query project mount recovery: {error}"))?;

    let mut matched_entry = None;
    let mut matched_paths = BTreeSet::new();
    let mut stale_owner_entry = None;
    let mut stale_owner_paths = BTreeSet::new();
    for row in rows {
        let (key, value) =
            row.map_err(|error| format!("failed to decode project mount recovery row: {error}"))?;
        let Ok(mount) = serde_json::from_str::<StoredProjectDeviceMountIdentity>(&value) else {
            continue;
        };
        let owner_key = mount
            .owner_key
            .as_deref()
            .map(str::trim)
            .map(str::to_ascii_lowercase);
        if mount.version != Some(1)
            || !owner_key
                .as_ref()
                .is_some_and(|value| owner_keys.contains(value))
        {
            continue;
        }
        let path = mount.path.as_deref().map(str::trim).unwrap_or_default();
        if path.is_empty() {
            continue;
        }
        let normalized_path = normalize_project_device_mount_path_identity(path);
        if mount.project_id.as_deref().map(str::trim) == Some(project_id) {
            matched_paths.insert(normalized_path);
            if matched_entry.is_none() {
                matched_entry = Some(ProjectDeviceMountEntry { key, value });
            }
        } else {
            // A mount bound to an earlier project record after the project
            // was re-imported under a new id. The client migrates the
            // stored projectId when the owner holds exactly one mount;
            // several same-owner mounts are ambiguous and fail closed.
            stale_owner_paths.insert(normalized_path);
            if stale_owner_entry.is_none() {
                stale_owner_entry = Some(ProjectDeviceMountEntry { key, value });
            }
        }
    }

    if matched_paths.len() > 1 {
        return Err(format!(
            "multiple desktop folders are bound to project {project_id} for the active user"
        ));
    }
    if matched_entry.is_some() {
        return Ok(matched_entry);
    }
    if stale_owner_paths.len() == 1 {
        return Ok(stale_owner_entry);
    }
    Ok(None)
}

fn local_store_scope_and_key_are_allowed(scope: &str, key: &str) -> bool {
    match scope {
        APP_SETTINGS_SCOPE => key == APP_SETTINGS_KEY,
        PROJECT_DEVICE_MOUNTS_SCOPE => is_project_device_mount_key(key),
        _ => false,
    }
}

fn validate_local_store_access(scope: &str, key: &str) -> Result<(), String> {
    if local_store_key_targets_authority_tables(key) {
        return Err(format!(
            "local store key '{key}' is reserved for authority tables"
        ));
    }
    if !local_store_scope_and_key_are_allowed(scope, key) {
        return Err(format!(
            "local store scope/key '{scope}/{key}' is outside the device-state allowlist"
        ));
    }
    Ok(())
}

fn local_store_scope_is_enumerable(scope: &str) -> bool {
    scope == APP_SETTINGS_SCOPE
}

#[tauri::command]
pub async fn local_store_get(
    app: AppHandle,
    scope: String,
    key: String,
) -> Result<Option<String>, String> {
    validate_local_store_access(&scope, &key)?;
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_device_state(&app)?;
        let mut statement = connection
            .prepare("SELECT value FROM device_state_entry WHERE scope = ?1 AND key = ?2")
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
pub async fn local_store_set(
    app: AppHandle,
    scope: String,
    key: String,
    value: String,
) -> Result<(), String> {
    validate_local_store_access(&scope, &key)?;
    if value.len() > MAX_DEVICE_STATE_VALUE_BYTES {
        return Err(format!(
            "local store value exceeds the {MAX_DEVICE_STATE_VALUE_BYTES}-byte device-state limit"
        ));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_device_state(&app)?;
        connection
            .execute(
                r#"
                INSERT INTO device_state_entry (scope, key, value, updated_at)
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
pub async fn local_store_delete(app: AppHandle, scope: String, key: String) -> Result<(), String> {
    validate_local_store_access(&scope, &key)?;
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_device_state(&app)?;
        connection
            .execute(
                "DELETE FROM device_state_entry WHERE scope = ?1 AND key = ?2",
                params![&scope, &key],
            )
            .map_err(|error| format!("failed to delete local store value: {error}"))?;
        Ok(())
    })
    .await
    .map_err(|error| format!("failed to join local store delete task: {error}"))?
}

/// Recovers one subject-owned project mount after a renderer realm-key change.
/// The command accepts only hashed owner identities and never exposes an
/// enumerable project-mount collection to the renderer.
#[tauri::command]
pub async fn project_device_mount_find(
    app: AppHandle,
    project_id: String,
    owner_keys: Vec<String>,
) -> Result<Option<ProjectDeviceMountEntry>, String> {
    let project_id = project_id.trim().to_string();
    if project_id.is_empty() {
        return Err("project mount recovery requires a project ID".to_string());
    }
    let owner_keys = normalize_project_device_mount_owner_keys(owner_keys)?;
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_device_state(&app)?;
        read_project_device_mount_by_identity(&connection, &project_id, &owner_keys)
    })
    .await
    .map_err(|error| format!("failed to join project mount recovery task: {error}"))?
}

fn resolve_project_mount_provider_session_directory_identity(
    connection: &rusqlite::Connection,
    project_id: &str,
    owner_keys: &BTreeSet<String>,
) -> Result<Option<ProviderSessionDirectoryIdentity>, String> {
    let Some(entry) = read_project_device_mount_by_identity(connection, project_id, owner_keys)?
    else {
        return Ok(None);
    };
    let mount = serde_json::from_str::<StoredProjectDeviceMountIdentity>(&entry.value)
        .map_err(|error| format!("failed to decode persisted project mount: {error}"))?;
    let path = mount
        .path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "persisted project mount path is missing".to_string())?;
    authorize_provider_session_directory_identity(path).map(Some)
}

/// Re-authorizes one persisted, subject-owned mount after a desktop restart
/// and returns only safe directory identity metadata to the renderer.
#[tauri::command]
pub async fn project_device_mount_provider_session_directory_identity(
    app: AppHandle,
    project_id: String,
    owner_keys: Vec<String>,
) -> Result<Option<ProviderSessionDirectoryIdentity>, String> {
    let project_id = project_id.trim().to_string();
    if project_id.is_empty() {
        return Err("provider Session directory identity requires a project ID".to_string());
    }
    let owner_keys = normalize_project_device_mount_owner_keys(owner_keys)?;
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_device_state(&app)?;
        resolve_project_mount_provider_session_directory_identity(
            &connection,
            &project_id,
            &owner_keys,
        )
    })
    .await
    .map_err(|error| format!("failed to join provider Session directory identity task: {error}"))?
}

#[tauri::command]
pub async fn local_store_list(
    app: AppHandle,
    scope: String,
) -> Result<Vec<LocalStoreEntry>, String> {
    if !local_store_scope_is_enumerable(&scope) {
        return Err(format!(
            "local store scope '{scope}' is not enumerable through the device-state bridge"
        ));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_device_state(&app)?;
        let mut statement = connection
            .prepare(
                r#"
                SELECT scope, key, value, updated_at
                FROM device_state_entry
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

/// Resolves the stable opaque device target identifier for this Tauri install.
/// The identifier is random, host-local, and never derived from a filesystem
/// path, machine name, or user identity.
#[tauri::command]
pub async fn desktop_runtime_location_install_identity(
    app: AppHandle,
) -> Result<DesktopRuntimeLocationInstallIdentity, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_device_state(&app)?;
        let existing = connection
            .query_row(
                "SELECT value FROM device_state_entry WHERE scope = ?1 AND key = ?2",
                params![
                    DESKTOP_RUNTIME_LOCATION_IDENTITY_SCOPE,
                    DESKTOP_RUNTIME_LOCATION_INSTALLATION_KEY
                ],
                |row| row.get::<_, String>(0),
            )
            .optional()
            .map_err(|error| {
                format!("failed to read desktop runtime-location installation identity: {error}")
            })?;

        let runtime_target_id = existing
            .filter(|value| is_valid_prefixed_uuid(value, DESKTOP_RUNTIME_TARGET_ID_PREFIX))
            .unwrap_or_else(|| create_prefixed_uuid(DESKTOP_RUNTIME_TARGET_ID_PREFIX));

        connection
            .execute(
                r#"
                INSERT INTO device_state_entry (scope, key, value, updated_at)
                VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
                ON CONFLICT(scope, key)
                DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
                "#,
                params![
                    DESKTOP_RUNTIME_LOCATION_IDENTITY_SCOPE,
                    DESKTOP_RUNTIME_LOCATION_INSTALLATION_KEY,
                    &runtime_target_id
                ],
            )
            .map_err(|error| {
                format!("failed to persist desktop runtime-location installation identity: {error}")
            })?;

        Ok(DesktopRuntimeLocationInstallIdentity { runtime_target_id })
    })
    .await
    .map_err(|error| {
        format!("failed to join desktop runtime-location installation identity task: {error}")
    })?
}

/// Creates an opaque root locator for a mounted project. The caller stores it
/// with the subject-scoped native mount record; it must never be derived from
/// the mounted path.
#[tauri::command]
pub fn desktop_runtime_location_create_root_locator() -> String {
    create_prefixed_uuid(DESKTOP_RUNTIME_ROOT_LOCATOR_PREFIX)
}

/// Resolves an opaque desktop root capability to its private native path.
/// The native path never crosses the Tauri IPC boundary.
pub(crate) fn resolve_desktop_runtime_location_root(
    app: &AppHandle,
    runtime_location_id: &str,
) -> Result<PathBuf, String> {
    let runtime_location_id = runtime_location_id.trim();
    if !is_valid_prefixed_uuid(runtime_location_id, DESKTOP_RUNTIME_ROOT_LOCATOR_PREFIX) {
        return Err("desktop runtime location is invalid".to_string());
    }

    let connection = open_device_state(app)
        .map_err(|_| "desktop runtime location store is unavailable".to_string())?;
    let mut statement = connection
        .prepare(
            r#"
            SELECT value
            FROM device_state_entry
            WHERE scope = ?1
            ORDER BY updated_at DESC, key ASC
            "#,
        )
        .map_err(|_| "desktop runtime location store is unavailable".to_string())?;
    let rows = statement
        .query_map(params![PROJECT_DEVICE_MOUNTS_SCOPE], |row| {
            row.get::<_, String>(0)
        })
        .map_err(|_| "desktop runtime location store is unavailable".to_string())?;

    let mut matching_paths = BTreeSet::new();
    let mut selected_path = None;
    for row in rows {
        let value = row.map_err(|_| "desktop runtime location store is unavailable".to_string())?;
        let Ok(mount) = serde_json::from_str::<StoredProjectDeviceMountIdentity>(&value) else {
            continue;
        };
        if mount.version != Some(1)
            || mount.root_locator.as_deref().map(str::trim) != Some(runtime_location_id)
        {
            continue;
        }
        let Some(path) = mount
            .path
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        matching_paths.insert(normalize_project_device_mount_path_identity(path));
        selected_path.get_or_insert_with(|| PathBuf::from(path));
    }

    if matching_paths.len() > 1 {
        return Err("desktop runtime location is ambiguous".to_string());
    }
    let selected_path =
        selected_path.ok_or_else(|| "desktop runtime location is unavailable".to_string())?;
    let metadata = std::fs::symlink_metadata(&selected_path)
        .map_err(|_| "desktop runtime location is unavailable".to_string())?;
    if super::filesystem_commands::metadata_is_link_like(&metadata) || !metadata.is_dir() {
        return Err("desktop runtime location is not a safe directory".to_string());
    }
    super::filesystem_commands::register_allowed_fs_root(selected_path.clone())?;
    super::filesystem_commands::resolve_root_directory_path(
        selected_path
            .to_str()
            .ok_or_else(|| "desktop runtime location path is invalid".to_string())?,
    )
}

#[cfg(test)]
mod tests {
    use super::{
        create_prefixed_uuid, is_valid_prefixed_uuid, local_store_scope_and_key_are_allowed,
        local_store_scope_is_enumerable, normalize_project_device_mount_owner_keys,
        read_project_device_mount_by_identity,
        resolve_project_mount_provider_session_directory_identity, APP_SETTINGS_KEY,
        APP_SETTINGS_SCOPE, DESKTOP_RUNTIME_LOCATION_IDENTITY_SCOPE,
        DESKTOP_RUNTIME_ROOT_LOCATOR_PREFIX, DESKTOP_RUNTIME_TARGET_ID_PREFIX,
        PROJECT_DEVICE_MOUNTS_SCOPE,
    };

    #[test]
    fn desktop_runtime_location_identifiers_are_prefixed_random_uuids() {
        let target_id = create_prefixed_uuid(DESKTOP_RUNTIME_TARGET_ID_PREFIX);
        let root_locator = create_prefixed_uuid(DESKTOP_RUNTIME_ROOT_LOCATOR_PREFIX);

        assert!(is_valid_prefixed_uuid(
            &target_id,
            DESKTOP_RUNTIME_TARGET_ID_PREFIX
        ));
        assert!(is_valid_prefixed_uuid(
            &root_locator,
            DESKTOP_RUNTIME_ROOT_LOCATOR_PREFIX
        ));
        assert_ne!(target_id, root_locator);
    }

    #[test]
    fn desktop_runtime_location_identifier_rejects_path_like_values() {
        assert!(!is_valid_prefixed_uuid(
            "desktop-device:C:\\workspace",
            DESKTOP_RUNTIME_TARGET_ID_PREFIX
        ));
        assert!(!is_valid_prefixed_uuid(
            "desktop-root:/workspace",
            DESKTOP_RUNTIME_ROOT_LOCATOR_PREFIX
        ));
    }

    #[test]
    fn runtime_location_material_cannot_be_enumerated_through_generic_store_list() {
        assert!(!local_store_scope_is_enumerable(
            PROJECT_DEVICE_MOUNTS_SCOPE
        ));
        assert!(!local_store_scope_is_enumerable(
            DESKTOP_RUNTIME_LOCATION_IDENTITY_SCOPE
        ));
        assert!(local_store_scope_is_enumerable(APP_SETTINGS_SCOPE));
    }

    #[test]
    fn generic_store_only_accepts_explicit_device_state_scopes_and_keys() {
        assert!(local_store_scope_and_key_are_allowed(
            APP_SETTINGS_SCOPE,
            APP_SETTINGS_KEY
        ));
        assert!(local_store_scope_and_key_are_allowed(
            PROJECT_DEVICE_MOUNTS_SCOPE,
            &"a".repeat(64)
        ));
        assert!(!local_store_scope_and_key_are_allowed(
            PROJECT_DEVICE_MOUNTS_SCOPE,
            "project-1"
        ));

        for business_scope in [
            "project",
            "projects",
            "session",
            "sessions",
            "conversation",
            "message",
            "messages",
        ] {
            assert!(!local_store_scope_and_key_are_allowed(
                business_scope,
                "aggregate"
            ));
        }
    }

    #[test]
    fn project_mount_recovery_is_identity_scoped_and_rejects_ambiguous_paths() {
        let connection = rusqlite::Connection::open_in_memory().expect("in-memory device state");
        connection
            .execute_batch(
                r#"
                CREATE TABLE device_state_entry (
                    scope TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (scope, key)
                );
                "#,
            )
            .expect("device-state test table");
        let owner_key = "a".repeat(64);
        let other_owner_key = "b".repeat(64);
        let first_value = serde_json::json!({
            "ownerKey": owner_key,
            "path": "C:\\work\\birdcoder",
            "projectId": "project-1",
            "version": 1
        })
        .to_string();
        connection
            .execute(
                "INSERT INTO device_state_entry VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![
                    PROJECT_DEVICE_MOUNTS_SCOPE,
                    "1".repeat(64),
                    first_value,
                    "2"
                ],
            )
            .expect("first project mount");
        connection
            .execute(
                "INSERT INTO device_state_entry VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![
                    PROJECT_DEVICE_MOUNTS_SCOPE,
                    "2".repeat(64),
                    serde_json::json!({
                        "ownerKey": other_owner_key,
                        "path": "C:\\private\\other",
                        "projectId": "project-1",
                        "version": 1
                    })
                    .to_string(),
                    "3"
                ],
            )
            .expect("other-user project mount");

        let accepted_owner_keys =
            normalize_project_device_mount_owner_keys(vec![owner_key]).expect("valid owner key");
        let recovered =
            read_project_device_mount_by_identity(&connection, "project-1", &accepted_owner_keys)
                .expect("project mount lookup")
                .expect("matching project mount");
        assert_eq!(recovered.key, "1".repeat(64));

        connection
            .execute(
                "INSERT INTO device_state_entry VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![
                    PROJECT_DEVICE_MOUNTS_SCOPE,
                    "3".repeat(64),
                    serde_json::json!({
                        "ownerKey": "a".repeat(64),
                        "path": "D:\\different\\birdcoder",
                        "projectId": "project-1",
                        "version": 1
                    })
                    .to_string(),
                    "4"
                ],
            )
            .expect("ambiguous project mount");
        assert!(read_project_device_mount_by_identity(
            &connection,
            "project-1",
            &accepted_owner_keys,
        )
        .is_err());
    }

    #[test]
    fn project_mount_recovery_returns_a_single_stale_project_id_mount_for_migration() {
        let connection = rusqlite::Connection::open_in_memory().expect("in-memory device state");
        connection
            .execute_batch(
                r#"
                CREATE TABLE device_state_entry (
                    scope TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (scope, key)
                );
                "#,
            )
            .expect("device-state test table");
        let owner_key = "e".repeat(64);
        connection
            .execute(
                "INSERT INTO device_state_entry VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![
                    PROJECT_DEVICE_MOUNTS_SCOPE,
                    "5".repeat(64),
                    serde_json::json!({
                        "ownerKey": owner_key,
                        "path": "C:\\work\\birdcoder",
                        "projectId": "project-retired",
                        "version": 1
                    })
                    .to_string(),
                    "1"
                ],
            )
            .expect("stale project mount");

        let accepted_owner_keys = normalize_project_device_mount_owner_keys(vec![owner_key.clone()])
            .expect("valid owner key");
        let recovered = read_project_device_mount_by_identity(
            &connection,
            "project-reimported",
            &accepted_owner_keys,
        )
        .expect("stale project mount lookup")
        .expect("single stale project mount");
        assert_eq!(recovered.key, "5".repeat(64));

        connection
            .execute(
                "INSERT INTO device_state_entry VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![
                    PROJECT_DEVICE_MOUNTS_SCOPE,
                    "6".repeat(64),
                    serde_json::json!({
                        "ownerKey": owner_key.clone(),
                        "path": "D:\\work\\birdcoder",
                        "projectId": "project-other",
                        "version": 1
                    })
                    .to_string(),
                    "2"
                ],
            )
            .expect("second same-owner mount");
        assert!(read_project_device_mount_by_identity(
            &connection,
            "project-reimported",
            &accepted_owner_keys,
        )
        .expect("ambiguous stale project mount lookup")
        .is_none());
    }

    #[test]
    fn project_mount_identity_reauthorizes_only_the_matching_subject_root() {
        let connection = rusqlite::Connection::open_in_memory().expect("in-memory device state");
        connection
            .execute_batch(
                r#"
                CREATE TABLE device_state_entry (
                    scope TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (scope, key)
                );
                "#,
            )
            .expect("device-state test table");
        let root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-persisted-mount-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("test clock")
                .as_nanos()
        ));
        std::fs::create_dir_all(root.join("src")).expect("persisted mount fixture");
        let owner_key = "c".repeat(64);
        connection
            .execute(
                "INSERT INTO device_state_entry VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![
                    PROJECT_DEVICE_MOUNTS_SCOPE,
                    "4".repeat(64),
                    serde_json::json!({
                        "ownerKey": owner_key,
                        "path": root.to_string_lossy(),
                        "projectId": "project-native",
                        "version": 1
                    })
                    .to_string(),
                    "1"
                ],
            )
            .expect("persisted project mount");

        let accepted_owner_keys =
            normalize_project_device_mount_owner_keys(vec![owner_key]).expect("valid owner key");
        let identity = resolve_project_mount_provider_session_directory_identity(
            &connection,
            "project-native",
            &accepted_owner_keys,
        )
        .expect("provider Session directory identity lookup")
        .expect("matching provider Session directory identity");
        assert_eq!(
            identity.directory_name,
            root.file_name()
                .and_then(|value| value.to_str())
                .expect("fixture directory name")
        );

        let rejected_owner_keys = normalize_project_device_mount_owner_keys(vec!["d".repeat(64)])
            .expect("valid other owner key");
        assert!(resolve_project_mount_provider_session_directory_identity(
            &connection,
            "project-native",
            &rejected_owner_keys,
        )
        .expect("other owner identity lookup")
        .is_none());

        std::fs::remove_dir_all(root).expect("persisted mount fixture must be removed");
    }
}
