pub mod state;
pub mod terminal_runtime;

pub use state::{
    ensure_desktop_runtime_config, request_embedded_api_shutdown,
    spawn_embedded_application_gateway_startup, start_embedded_application_gateway,
    DesktopRuntimeConfig, TauriHostState,
};
pub use terminal_runtime::DesktopTerminalRuntimeState;
