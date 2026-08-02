mod desktop_lifecycle;
mod desktop_tray_menu;
mod provider_session_cwd;
pub mod state;
pub mod user_model_config;
pub mod terminal_runtime;

pub(crate) use desktop_lifecycle::setup_desktop_lifecycle;
pub use desktop_tray_menu::{
    desktop_tray_update_menu, DesktopTraySessionMenuEntry, DesktopTraySessionMenuLabels,
    DesktopTraySessionMenuSnapshot,
};
pub use provider_session_cwd::TauriProviderSessionProjectCwdResolver;

pub use user_model_config::{
    apply_client_local_user_model_config_database_url,
    initialize_user_model_config_store,
    user_model_config_delete_channel,
    user_model_config_get_api_key,
    user_model_config_get_channel,
    user_model_config_get_engine_selection,
    user_model_config_list_channels,
    user_model_config_list_engine_configs,
    user_model_config_list_engine_selections,
    user_model_config_upsert_api_key,
    user_model_config_upsert_channel,
    user_model_config_upsert_engine_config,
    user_model_config_upsert_engine_selection,
};
pub use state::{
    ensure_desktop_runtime_config, request_embedded_api_shutdown,
    spawn_embedded_application_gateway_startup, start_embedded_application_gateway,
    DesktopRuntimeConfig, TauriHostState,
};
pub use terminal_runtime::DesktopTerminalRuntimeState;
