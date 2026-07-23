use crate::adapters::secure_app_session_store::{
    delete_secure_app_session, read_secure_app_session, write_secure_app_session,
};

#[tauri::command]
pub async fn secure_app_session_read() -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(read_secure_app_session)
        .await
        .map_err(|_| "secure application session read worker failed".to_owned())?
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn secure_app_session_write(raw: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || write_secure_app_session(&raw))
        .await
        .map_err(|_| "secure application session write worker failed".to_owned())?
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn secure_app_session_delete() -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(delete_secure_app_session)
        .await
        .map_err(|_| "secure application session delete worker failed".to_owned())?
        .map_err(|error| error.to_string())
}
