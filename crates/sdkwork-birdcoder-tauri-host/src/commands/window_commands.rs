use serde::{Deserialize, Serialize};
use tauri::WebviewWindow;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWindowControlRect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWindowControlsBridgeConfig {
    pub active: bool,
    pub minimize: Option<NativeWindowControlRect>,
    pub maximize: Option<NativeWindowControlRect>,
    pub close: Option<NativeWindowControlRect>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NativeWindowControlAction {
    Minimize,
    ToggleMaximize,
    Close,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWindowControlsBridgeCapabilities {
    pub platform: String,
    pub supports_native_hit_test: bool,
    pub supports_system_hover_preview: bool,
    pub uses_host_control_actions: bool,
}

fn current_platform_identifier() -> String {
    if cfg!(target_os = "windows") {
        "windows".to_string()
    } else if cfg!(target_os = "macos") {
        "macos".to_string()
    } else if cfg!(target_os = "linux") {
        "linux".to_string()
    } else {
        "unknown".to_string()
    }
}

#[tauri::command]
pub fn desktop_window_controls_bridge_capabilities() -> NativeWindowControlsBridgeCapabilities {
    NativeWindowControlsBridgeCapabilities {
        platform: current_platform_identifier(),
        supports_native_hit_test: false,
        supports_system_hover_preview: false,
        uses_host_control_actions: true,
    }
}

#[tauri::command]
pub fn desktop_configure_window_controls_bridge(
    _window: WebviewWindow,
    config: NativeWindowControlsBridgeConfig,
) -> Result<(), String> {
    if !config.active {
        return Ok(());
    }
    for (role, rect) in [
        ("minimize", config.minimize.as_ref()),
        ("maximize", config.maximize.as_ref()),
        ("close", config.close.as_ref()),
    ] {
        let rect = rect.ok_or_else(|| {
            format!(
                "active native window controls bridge config requires a {role} rectangle"
            )
        })?;
        if rect.width <= 0 || rect.height <= 0 {
            return Err(format!(
                "native window control rectangle '{role}' must have positive width and height"
            ));
        }
    }
    Ok(())
}

#[tauri::command]
pub fn desktop_perform_window_control_action(
    window: WebviewWindow,
    action: NativeWindowControlAction,
) -> Result<(), String> {
    match action {
        NativeWindowControlAction::Minimize => window
            .minimize()
            .map_err(|error| format!("failed to minimize desktop window: {error}")),
        NativeWindowControlAction::ToggleMaximize => {
            let is_maximized = window.is_maximized().map_err(|error| {
                format!("failed to inspect desktop window maximize state: {error}")
            })?;

            if is_maximized {
                window
                    .unmaximize()
                    .map_err(|error| format!("failed to restore desktop window: {error}"))
            } else {
                window
                    .maximize()
                    .map_err(|error| format!("failed to maximize desktop window: {error}"))
            }
        }
        NativeWindowControlAction::Close => window
            .close()
            .map_err(|error| format!("failed to close desktop window: {error}")),
    }
}
