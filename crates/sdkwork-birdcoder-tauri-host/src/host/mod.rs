pub mod state;

pub use state::{
    ensure_desktop_runtime_config, spawn_embedded_coding_server_startup,
    start_embedded_coding_server, DesktopRuntimeConfig, TauriHostState,
};
