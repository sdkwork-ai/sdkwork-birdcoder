use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const ENGINE_CATALOG_APP_API_ROUTES: &[HttpRoute] = &[
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ENGINES_PATH,
        "engines",
        "engines.list",
    )
    .with_required_permission("runtime.engines.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ENGINE_CAPABILITIES_PATH,
        "engines",
        "engines.capabilities.retrieve",
    )
    .with_required_permission("runtime.engines.capabilities.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::NATIVE_SESSION_PROVIDERS_PATH,
        "nativeSessions",
        "nativeSessionProviders.list",
    )
    .with_required_permission("runtime.nativeSessionProviders.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::NATIVE_SESSIONS_PATH,
        "nativeSessions",
        "nativeSessions.list",
    )
    .with_required_permission("runtime.nativeSessions.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::NATIVE_SESSION_DETAIL_PATH,
        "nativeSessions",
        "nativeSessions.retrieve",
    )
    .with_required_permission("runtime.nativeSessions.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::MODELS_PATH,
        "models",
        "models.list",
    )
    .with_required_permission("runtime.models.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::MODEL_CONFIG_PATH,
        "models",
        "modelConfig.retrieve",
    )
    .with_required_permission("runtime.modelConfig.read"),
    HttpRoute::dual_token(
        HttpMethod::Put,
        paths::MODEL_CONFIG_PATH,
        "models",
        "modelConfig.sync",
    )
    .with_required_permission("runtime.modelConfig.update"),
];

pub fn engine_catalog_app_api_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(ENGINE_CATALOG_APP_API_ROUTES)
}
