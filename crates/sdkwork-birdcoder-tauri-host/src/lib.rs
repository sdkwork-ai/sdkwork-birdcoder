pub mod adapters;
pub mod application_publish;
pub mod bootstrap;
pub mod commands;
pub mod host;

pub use application_publish::*;
pub use bootstrap::services::setup_tauri_host;
pub use commands::*;
pub use host::{
    desktop_tray_update_menu, ensure_desktop_runtime_config, request_embedded_api_shutdown,
    spawn_embedded_application_gateway_startup, start_embedded_application_gateway,
    user_model_config_delete_channel, user_model_config_get_api_key, user_model_config_get_channel,
    user_model_config_get_engine_selection, user_model_config_list_channels,
    user_model_config_list_engine_configs, user_model_config_list_engine_selections,
    user_model_config_upsert_api_key, user_model_config_upsert_channel,
    user_model_config_upsert_engine_config, user_model_config_upsert_engine_selection,
    DesktopRuntimeConfig, DesktopTerminalRuntimeState, DesktopTraySessionMenuEntry,
    DesktopTraySessionMenuLabels, DesktopTraySessionMenuSnapshot, TauriHostState,
};
