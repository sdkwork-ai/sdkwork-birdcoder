use serde::{Deserialize, Serialize};
use tauri::WebviewWindow;

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWindowControlRect {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeWindowControlsBridgeConfig {
    active: bool,
    minimize: Option<NativeWindowControlRect>,
    maximize: Option<NativeWindowControlRect>,
    close: Option<NativeWindowControlRect>,
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
    platform: String,
    supports_native_hit_test: bool,
    supports_system_hover_preview: bool,
    uses_host_control_actions: bool,
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
    platform::desktop_window_controls_bridge_capabilities()
}

#[tauri::command]
pub fn desktop_configure_window_controls_bridge(
    window: WebviewWindow,
    config: NativeWindowControlsBridgeConfig,
) -> Result<(), String> {
    platform::desktop_configure_window_controls_bridge(&window, config)
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

#[cfg(target_os = "windows")]
mod platform {
    use super::{
        current_platform_identifier, NativeWindowControlRect,
        NativeWindowControlsBridgeCapabilities, NativeWindowControlsBridgeConfig,
    };
    use std::collections::HashMap;
    use std::io;
    use std::sync::{Mutex, OnceLock};
    use tauri::WebviewWindow;
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, POINT, WPARAM};
    use windows_sys::Win32::Graphics::Gdi::ScreenToClient;
    use windows_sys::Win32::UI::Shell::{DefSubclassProc, RemoveWindowSubclass, SetWindowSubclass};
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        HTCLOSE, HTMAXBUTTON, HTMINBUTTON, WM_NCDESTROY, WM_NCHITTEST,
    };

    const WINDOW_CONTROLS_SUBCLASS_ID: usize = 0x53444b5742434f44;

    #[derive(Clone, Debug)]
    struct NativeWindowControlsLayout {
        minimize: NativeWindowControlRect,
        maximize: NativeWindowControlRect,
        close: NativeWindowControlRect,
    }

    #[derive(Clone, Debug, Default)]
    struct NativeWindowControlsBridgeWindowState {
        layout: Option<NativeWindowControlsLayout>,
    }

    static WINDOW_CONTROLS_BRIDGE_STATE: OnceLock<
        Mutex<HashMap<isize, NativeWindowControlsBridgeWindowState>>,
    > = OnceLock::new();

    fn bridge_state() -> &'static Mutex<HashMap<isize, NativeWindowControlsBridgeWindowState>> {
        WINDOW_CONTROLS_BRIDGE_STATE.get_or_init(|| Mutex::new(HashMap::new()))
    }

    fn normalize_config(
        config: NativeWindowControlsBridgeConfig,
    ) -> Result<Option<NativeWindowControlsLayout>, String> {
        if !config.active {
            return Ok(None);
        }

        match (config.minimize, config.maximize, config.close) {
            (Some(minimize), Some(maximize), Some(close)) => {
                validate_rect(&minimize, "minimize")?;
                validate_rect(&maximize, "maximize")?;
                validate_rect(&close, "close")?;

                Ok(Some(NativeWindowControlsLayout {
                    minimize,
                    maximize,
                    close,
                }))
            }
            _ => Err(
                "active native window controls bridge config requires minimize, maximize, and close rectangles"
                    .to_string(),
            ),
        }
    }

    fn validate_rect(rect: &NativeWindowControlRect, role: &str) -> Result<(), String> {
        if rect.width <= 0 || rect.height <= 0 {
            return Err(format!(
                "native window control rectangle '{role}' must have positive width and height"
            ));
        }

        Ok(())
    }

    fn window_key(hwnd: HWND) -> isize {
        hwnd as isize
    }

    fn read_layout_for_window(hwnd: HWND) -> Option<NativeWindowControlsLayout> {
        let guard = bridge_state().lock().ok()?;
        guard
            .get(&window_key(hwnd))
            .and_then(|state| state.layout.clone())
    }

    fn window_state_exists(hwnd: HWND) -> bool {
        bridge_state()
            .lock()
            .map(|guard| guard.contains_key(&window_key(hwnd)))
            .unwrap_or(false)
    }

    fn update_layout_for_window(
        hwnd: HWND,
        layout: Option<NativeWindowControlsLayout>,
    ) -> Result<(), String> {
        let mut guard = bridge_state()
            .lock()
            .map_err(|_| "window controls bridge state lock poisoned".to_string())?;
        let state = guard.entry(window_key(hwnd)).or_default();
        state.layout = layout;
        Ok(())
    }

    fn clear_layout_for_window(hwnd: HWND) {
        if let Ok(mut guard) = bridge_state().lock() {
            guard.remove(&window_key(hwnd));
        }
    }

    fn ensure_window_subclass(hwnd: HWND) -> Result<(), String> {
        {
            let guard = bridge_state()
                .lock()
                .map_err(|_| "window controls bridge state lock poisoned".to_string())?;
            if guard.contains_key(&window_key(hwnd)) {
                return Ok(());
            }
        }

        let install_result = unsafe {
            SetWindowSubclass(
                hwnd,
                Some(native_window_controls_subclass_proc),
                WINDOW_CONTROLS_SUBCLASS_ID,
                0,
            )
        };

        if install_result == 0 {
            return Err(format!(
                "failed to install native window controls subclass: {}",
                io::Error::last_os_error()
            ));
        }

        let mut guard = bridge_state()
            .lock()
            .map_err(|_| "window controls bridge state lock poisoned".to_string())?;
        guard
            .entry(window_key(hwnd))
            .or_insert_with(NativeWindowControlsBridgeWindowState::default);
        Ok(())
    }

    fn detach_window_subclass(hwnd: HWND) -> Result<(), String> {
        let removed = unsafe {
            RemoveWindowSubclass(
                hwnd,
                Some(native_window_controls_subclass_proc),
                WINDOW_CONTROLS_SUBCLASS_ID,
            )
        };

        if removed == 0 {
            return Err(format!(
                "failed to remove native window controls subclass: {}",
                io::Error::last_os_error()
            ));
        }

        clear_layout_for_window(hwnd);
        Ok(())
    }

    fn contains_client_point(rect: &NativeWindowControlRect, point: &POINT) -> bool {
        point.x >= rect.x
            && point.x < rect.x + rect.width
            && point.y >= rect.y
            && point.y < rect.y + rect.height
    }

    fn resolve_hit_test_for_client_point(
        layout: &NativeWindowControlsLayout,
        point: &POINT,
    ) -> Option<LRESULT> {
        if contains_client_point(&layout.close, point) {
            return Some(HTCLOSE as LRESULT);
        }

        if contains_client_point(&layout.maximize, point) {
            return Some(HTMAXBUTTON as LRESULT);
        }

        if contains_client_point(&layout.minimize, point) {
            return Some(HTMINBUTTON as LRESULT);
        }

        None
    }

    fn point_from_lparam(lparam: LPARAM) -> POINT {
        let x = (lparam as i32 & 0xffff) as u16 as i16 as i32;
        let y = ((lparam as i32 >> 16) & 0xffff) as u16 as i16 as i32;
        POINT { x, y }
    }

    fn client_point_from_lparam(hwnd: HWND, lparam: LPARAM) -> Option<POINT> {
        let mut point = point_from_lparam(lparam);
        let converted = unsafe { ScreenToClient(hwnd, &mut point) };
        if converted == 0 {
            return None;
        }

        Some(point)
    }

    fn resolve_hit_test_result(hwnd: HWND, lparam: LPARAM) -> Option<LRESULT> {
        let layout = read_layout_for_window(hwnd)?;
        let point = client_point_from_lparam(hwnd, lparam)?;
        resolve_hit_test_for_client_point(&layout, &point)
    }

    unsafe extern "system" fn native_window_controls_subclass_proc(
        hwnd: HWND,
        umsg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
        _uidsubclass: usize,
        _dwrefdata: usize,
    ) -> LRESULT {
        match umsg {
            WM_NCHITTEST => {
                if let Some(hit_test_result) = resolve_hit_test_result(hwnd, lparam) {
                    return hit_test_result;
                }
            }
            WM_NCDESTROY => {
                clear_layout_for_window(hwnd);
                unsafe {
                    RemoveWindowSubclass(
                        hwnd,
                        Some(native_window_controls_subclass_proc),
                        WINDOW_CONTROLS_SUBCLASS_ID,
                    );
                }
            }
            _ => {}
        }

        unsafe { DefSubclassProc(hwnd, umsg, wparam, lparam) }
    }

    pub fn desktop_configure_window_controls_bridge(
        window: &WebviewWindow,
        config: NativeWindowControlsBridgeConfig,
    ) -> Result<(), String> {
        let normalized_layout = normalize_config(config)?;
        let hwnd = window
            .hwnd()
            .map_err(|error| format!("failed to resolve desktop window handle: {error}"))?
            .0 as HWND;

        if normalized_layout.is_some() {
            ensure_window_subclass(hwnd)?;
            return update_layout_for_window(hwnd, normalized_layout);
        }

        if !window_state_exists(hwnd) {
            return Ok(());
        }

        update_layout_for_window(hwnd, None)?;
        detach_window_subclass(hwnd)
    }

    pub fn desktop_window_controls_bridge_capabilities() -> NativeWindowControlsBridgeCapabilities {
        NativeWindowControlsBridgeCapabilities {
            platform: current_platform_identifier(),
            supports_native_hit_test: true,
            supports_system_hover_preview: true,
            uses_host_control_actions: true,
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        fn build_layout() -> NativeWindowControlsLayout {
            NativeWindowControlsLayout {
                minimize: NativeWindowControlRect {
                    x: 0,
                    y: 0,
                    width: 40,
                    height: 32,
                },
                maximize: NativeWindowControlRect {
                    x: 40,
                    y: 0,
                    width: 40,
                    height: 32,
                },
                close: NativeWindowControlRect {
                    x: 80,
                    y: 0,
                    width: 40,
                    height: 32,
                },
            }
        }

        #[test]
        fn normalize_config_rejects_invalid_rectangles() {
            let config = NativeWindowControlsBridgeConfig {
                active: true,
                minimize: Some(NativeWindowControlRect {
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 32,
                }),
                maximize: Some(NativeWindowControlRect {
                    x: 40,
                    y: 0,
                    width: 40,
                    height: 32,
                }),
                close: Some(NativeWindowControlRect {
                    x: 80,
                    y: 0,
                    width: 40,
                    height: 32,
                }),
            };

            let error = normalize_config(config).expect_err("invalid rect must be rejected");
            assert!(
                error.contains("positive width and height"),
                "unexpected validation error: {error}"
            );
        }

        #[test]
        fn normalize_config_requires_all_control_regions() {
            let config = NativeWindowControlsBridgeConfig {
                active: true,
                minimize: Some(NativeWindowControlRect {
                    x: 0,
                    y: 0,
                    width: 40,
                    height: 32,
                }),
                maximize: Some(NativeWindowControlRect {
                    x: 40,
                    y: 0,
                    width: 40,
                    height: 32,
                }),
                close: None,
            };

            let error =
                normalize_config(config).expect_err("missing close region must be rejected");
            assert!(
                error.contains("requires minimize, maximize, and close rectangles"),
                "unexpected validation error: {error}"
            );
        }

        #[test]
        fn resolve_hit_test_for_client_point_maps_each_control_region() {
            let layout = build_layout();

            assert_eq!(
                resolve_hit_test_for_client_point(&layout, &POINT { x: 10, y: 10 }),
                Some(HTMINBUTTON as LRESULT)
            );
            assert_eq!(
                resolve_hit_test_for_client_point(&layout, &POINT { x: 50, y: 10 }),
                Some(HTMAXBUTTON as LRESULT)
            );
            assert_eq!(
                resolve_hit_test_for_client_point(&layout, &POINT { x: 90, y: 10 }),
                Some(HTCLOSE as LRESULT)
            );
            assert_eq!(
                resolve_hit_test_for_client_point(&layout, &POINT { x: 140, y: 10 }),
                None
            );
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod platform {
    use super::{
        current_platform_identifier, NativeWindowControlsBridgeCapabilities,
        NativeWindowControlsBridgeConfig,
    };
    use tauri::WebviewWindow;

    pub fn desktop_configure_window_controls_bridge(
        _window: &WebviewWindow,
        _config: NativeWindowControlsBridgeConfig,
    ) -> Result<(), String> {
        Ok(())
    }

    pub fn desktop_window_controls_bridge_capabilities() -> NativeWindowControlsBridgeCapabilities {
        NativeWindowControlsBridgeCapabilities {
            platform: current_platform_identifier(),
            supports_native_hit_test: false,
            supports_system_hover_preview: false,
            uses_host_control_actions: true,
        }
    }
}
