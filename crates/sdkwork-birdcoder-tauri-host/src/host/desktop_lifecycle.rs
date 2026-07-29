use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{AppHandle, Manager, WindowEvent};

use super::desktop_tray_menu::setup_desktop_tray;

pub(super) const MAIN_WINDOW_LABEL: &str = "main";
pub(super) const TEST_MAIN_WINDOW_LABEL: &str = "main-test";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum CloseRequestAction {
    AllowClose,
    HideWindow,
}

#[derive(Debug, Default)]
pub(super) struct DesktopLifecycleState {
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

    pub(super) fn request_explicit_exit(&self) {
        self.explicit_exit_requested.store(true, Ordering::SeqCst);
    }
}

pub(crate) fn setup_desktop_lifecycle(app: &AppHandle) -> Result<(), String> {
    app.manage(DesktopLifecycleState::default());

    let main_window = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .or_else(|| app.get_webview_window(TEST_MAIN_WINDOW_LABEL))
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

    setup_desktop_tray(app)
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
