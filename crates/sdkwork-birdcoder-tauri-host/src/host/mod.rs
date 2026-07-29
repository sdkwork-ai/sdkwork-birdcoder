mod desktop_lifecycle;
mod desktop_tray_menu;
mod provider_session_cwd;
pub mod state;
pub mod terminal_runtime;

pub(crate) use desktop_lifecycle::setup_desktop_lifecycle;
pub use desktop_tray_menu::{
    desktop_tray_update_menu, DesktopTraySessionMenuEntry, DesktopTraySessionMenuLabels,
    DesktopTraySessionMenuSnapshot,
};
pub use provider_session_cwd::TauriProviderSessionProjectCwdResolver;

pub use state::{
    ensure_desktop_runtime_config, request_embedded_api_shutdown,
    spawn_embedded_application_gateway_startup, start_embedded_application_gateway,
    DesktopRuntimeConfig, TauriHostState,
};
pub use terminal_runtime::DesktopTerminalRuntimeState;
