use crate::host::{ensure_desktop_runtime_config, DesktopRuntimeConfig};

#[tauri::command]
pub fn host_mode() -> &'static str {
    "desktop"
}

#[tauri::command]
pub async fn desktop_runtime_config(app: tauri::AppHandle) -> Result<DesktopRuntimeConfig, String> {
    ensure_desktop_runtime_config(app)
        .await
        .map_err(|error| format!("failed to resolve desktop runtime config: {error}"))
}
