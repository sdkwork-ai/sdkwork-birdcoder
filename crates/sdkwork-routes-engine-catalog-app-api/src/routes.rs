use axum::{routing::get, Router};

use crate::handlers;
use crate::handlers::EngineCatalogAppState;
use crate::paths;

pub fn build_engine_catalog_app_router() -> Router<EngineCatalogAppState> {
    Router::new()
        .route(paths::ENGINES_PATH, get(handlers::list_engines))
        .route(
            paths::ENGINE_CAPABILITIES_PATH,
            get(handlers::get_engine_capabilities),
        )
        .route(
            paths::NATIVE_SESSION_PROVIDERS_PATH,
            get(handlers::list_native_session_providers),
        )
        .route(paths::MODELS_PATH, get(handlers::list_models))
        .route(
            paths::MODEL_CONFIG_PATH,
            get(handlers::get_model_config).put(handlers::sync_model_config),
        )
}
