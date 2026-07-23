use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use tauri::AppHandle;
use uuid::Uuid;

use crate::host::state::open_device_state;

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

#[cfg(test)]
mod tests {
    use super::{
        create_prefixed_uuid, is_valid_prefixed_uuid, local_store_scope_and_key_are_allowed,
        local_store_scope_is_enumerable, APP_SETTINGS_KEY, APP_SETTINGS_SCOPE,
        DESKTOP_RUNTIME_LOCATION_IDENTITY_SCOPE, DESKTOP_RUNTIME_ROOT_LOCATOR_PREFIX,
        DESKTOP_RUNTIME_TARGET_ID_PREFIX, PROJECT_DEVICE_MOUNTS_SCOPE,
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
}
