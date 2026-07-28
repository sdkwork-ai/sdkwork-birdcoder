use crate::application_publish::ApplicationPublishState;
use crate::host::{DesktopTerminalRuntimeState, TauriHostState};
use tauri::Manager;

pub fn setup_tauri_host(app: &tauri::AppHandle) -> Result<(), String> {
    TauriHostState::register(app)?;
    app.manage(ApplicationPublishState::new()?);
    app.manage(DesktopTerminalRuntimeState::new(app.clone())?);
    Ok(())
}
