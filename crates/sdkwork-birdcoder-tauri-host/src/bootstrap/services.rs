use crate::host::{DesktopTerminalRuntimeState, TauriHostState};
use tauri::Manager;

pub fn setup_tauri_host(app: &tauri::AppHandle) -> Result<(), String> {
    TauriHostState::register(app)?;
    app.manage(DesktopTerminalRuntimeState::new(app.clone())?);
    Ok(())
}
