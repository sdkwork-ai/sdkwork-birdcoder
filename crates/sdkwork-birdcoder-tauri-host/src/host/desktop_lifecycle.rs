use std::sync::atomic::{AtomicBool, Ordering};

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Runtime, WindowEvent};

const MAIN_WINDOW_LABEL: &str = "main";
const TRAY_ICON_ID: &str = "birdcoder-main";
const TRAY_MENU_OPEN_ID: &str = "birdcoder-open";
const TRAY_MENU_QUIT_ID: &str = "birdcoder-quit";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CloseRequestAction {
    AllowClose,
    HideWindow,
}

#[derive(Debug, Default)]
struct DesktopLifecycleState {
    explicit_exit_requested: AtomicBool,
}

impl DesktopLifecycleState {
    fn close_request_action(&self) -> CloseRequestAction {
        if self.explicit_exit_requested.load(Ordering::SeqCst) {
            CloseRequestAction::AllowClose
        } else {
            CloseRequestAction::HideWindow
        }
    }

    fn request_explicit_exit(&self) {
        self.explicit_exit_requested.store(true, Ordering::SeqCst);
    }
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) else {
        return Ok(());
    };
    window.unminimize()?;
    window.show()?;
    window.set_focus()?;
    Ok(())
}

fn should_show_window_for_tray_event(event: &TrayIconEvent) -> bool {
    matches!(
        event,
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } | TrayIconEvent::DoubleClick {
            button: MouseButton::Left,
            ..
        }
    )
}

pub(crate) fn setup_desktop_lifecycle(app: &AppHandle) -> Result<(), String> {
    app.manage(DesktopLifecycleState::default());

    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| "BirdCoder main window is unavailable during desktop setup".to_string())?;
    let close_window = main_window.clone();
    let close_app = app.clone();
    main_window.on_window_event(move |event| {
        if let WindowEvent::CloseRequested { api, .. } = event {
            let lifecycle = close_app.state::<DesktopLifecycleState>();
            if lifecycle.close_request_action() == CloseRequestAction::HideWindow {
                api.prevent_close();
                if let Err(error) = close_window.hide() {
                    eprintln!("failed to hide BirdCoder main window: {error}");
                }
            }
        }
    });

    let open_item = MenuItem::with_id(app, TRAY_MENU_OPEN_ID, "Open BirdCoder", true, None::<&str>)
        .map_err(|error| format!("failed to create BirdCoder tray open item: {error}"))?;
    let quit_item = MenuItem::with_id(app, TRAY_MENU_QUIT_ID, "Quit BirdCoder", true, None::<&str>)
        .map_err(|error| format!("failed to create BirdCoder tray quit item: {error}"))?;
    let menu = Menu::with_items(app, &[&open_item, &quit_item])
        .map_err(|error| format!("failed to create BirdCoder tray menu: {error}"))?;
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "BirdCoder bundle icon is unavailable for the system tray".to_string())?;

    TrayIconBuilder::with_id(TRAY_ICON_ID)
        .icon(icon)
        .tooltip("SDKWork BirdCoder")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            TRAY_MENU_OPEN_ID => {
                if let Err(error) = show_main_window(app) {
                    eprintln!("failed to show BirdCoder main window: {error}");
                }
            }
            TRAY_MENU_QUIT_ID => {
                app.state::<DesktopLifecycleState>().request_explicit_exit();
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if should_show_window_for_tray_event(&event) {
                if let Err(error) = show_main_window(tray.app_handle()) {
                    eprintln!("failed to show BirdCoder main window from tray: {error}");
                }
            }
        })
        .build(app)
        .map_err(|error| format!("failed to create BirdCoder system tray: {error}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{CloseRequestAction, DesktopLifecycleState};

    #[test]
    fn close_request_hides_window_until_explicit_exit() {
        let lifecycle = DesktopLifecycleState::default();

        assert_eq!(
            lifecycle.close_request_action(),
            CloseRequestAction::HideWindow
        );

        lifecycle.request_explicit_exit();

        assert_eq!(
            lifecycle.close_request_action(),
            CloseRequestAction::AllowClose
        );
    }
}
