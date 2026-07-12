use rusqlite::params;
use serde::Serialize;
use tauri::AppHandle;

use crate::host::state::open_database;

const RESERVED_AUTHORITY_LOCAL_STORE_KEY_PREFIX: &str = "table.sqlite.";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalStoreEntry {
    pub scope: String,
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

fn local_store_key_targets_authority_tables(key: &str) -> bool {
    key.starts_with(RESERVED_AUTHORITY_LOCAL_STORE_KEY_PREFIX)
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
