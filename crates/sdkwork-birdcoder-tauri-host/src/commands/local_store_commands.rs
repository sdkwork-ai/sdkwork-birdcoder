use rusqlite::{params, OptionalExtension};
use serde::Serialize;
use tauri::AppHandle;
use uuid::Uuid;

use crate::host::state::open_database;

const RESERVED_AUTHORITY_LOCAL_STORE_KEY_PREFIX: &str = "table.sqlite.";
const DESKTOP_RUNTIME_LOCATION_IDENTITY_SCOPE: &str = "desktop-runtime-location-identity";
const DESKTOP_RUNTIME_LOCATION_INSTALLATION_KEY: &str = "installation.v1";
const DESKTOP_RUNTIME_TARGET_ID_PREFIX: &str = "desktop-device:";
const DESKTOP_RUNTIME_ROOT_LOCATOR_PREFIX: &str = "desktop-root:";
const PROJECT_DEVICE_MOUNTS_SCOPE: &str = "project-device-mounts";

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

fn local_store_scope_contains_private_runtime_location_material(scope: &str) -> bool {
    matches!(
        scope,
        PROJECT_DEVICE_MOUNTS_SCOPE | DESKTOP_RUNTIME_LOCATION_IDENTITY_SCOPE
    )
}

#[tauri::command]
pub async fn local_store_get(
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
pub async fn local_store_set(
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
pub async fn local_store_delete(app: AppHandle, scope: String, key: String) -> Result<(), String> {
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
pub async fn local_store_list(
    app: AppHandle,
    scope: String,
) -> Result<Vec<LocalStoreEntry>, String> {
    if local_store_scope_contains_private_runtime_location_material(&scope) {
        return Err(
            "local store scope contains private runtime-location material and cannot be enumerated"
                .to_owned(),
        );
    }
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

/// Resolves the stable opaque device target identifier for this Tauri install.
/// The identifier is random, host-local, and never derived from a filesystem
/// path, machine name, or user identity.
#[tauri::command]
pub async fn desktop_runtime_location_install_identity(
    app: AppHandle,
) -> Result<DesktopRuntimeLocationInstallIdentity, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let connection = open_database(&app)?;
        let existing = connection
            .query_row(
                "SELECT value FROM kv_store WHERE scope = ?1 AND key = ?2",
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
                INSERT INTO kv_store (scope, key, value, updated_at)
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
        create_prefixed_uuid, is_valid_prefixed_uuid,
        local_store_scope_contains_private_runtime_location_material,
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
        assert!(
            local_store_scope_contains_private_runtime_location_material(
                PROJECT_DEVICE_MOUNTS_SCOPE
            )
        );
        assert!(
            local_store_scope_contains_private_runtime_location_material(
                DESKTOP_RUNTIME_LOCATION_IDENTITY_SCOPE
            )
        );
        assert!(
            !local_store_scope_contains_private_runtime_location_material(
                "application-preferences"
            )
        );
    }
}
