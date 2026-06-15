use crate::host::TauriHostState;

pub fn setup_tauri_host(app: &tauri::AppHandle) -> Result<(), String> {
    TauriHostState::register(app)
}
