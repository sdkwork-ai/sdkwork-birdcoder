use crate::host::TauriHostState;

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopRuntimeConfig {
    pub api_base_url: String,
}

#[tauri::command]
pub fn host_mode() -> &'static str {
    "desktop"
}

#[tauri::command]
pub async fn desktop_runtime_config(
    app: tauri::AppHandle,
) -> Result<DesktopRuntimeConfig, String> {
    let api_base_url = TauriHostState::resolve_api_base_url_static(&app)
        .map_err(|error| format!("failed to resolve desktop runtime config: {error}"))?;
    Ok(DesktopRuntimeConfig { api_base_url })
}
