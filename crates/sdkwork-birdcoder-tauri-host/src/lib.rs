pub mod adapters;
pub mod bootstrap;
pub mod commands;
pub mod host;

pub use bootstrap::services::setup_tauri_host;
pub use commands::*;
pub use host::{
    ensure_desktop_runtime_config, request_embedded_api_shutdown,
    spawn_embedded_application_gateway_startup, start_embedded_application_gateway,
    DesktopRuntimeConfig, DesktopTerminalRuntimeState, TauriHostState,
};
