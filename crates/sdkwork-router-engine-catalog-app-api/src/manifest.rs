use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const ENGINE_CATALOG_APP_API_ROUTES: &[HttpRoute] = &[
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ENGINES_PATH,
        "engines",
        "engines.list",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ENGINE_CAPABILITIES_PATH,
        "engines",
        "engines.capabilities.retrieve",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::NATIVE_SESSION_PROVIDERS_PATH,
        "nativeSessions",
        "nativeSessionProviders.list",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::NATIVE_SESSIONS_PATH,
        "nativeSessions",
        "nativeSessions.list",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::NATIVE_SESSION_DETAIL_PATH,
        "nativeSessions",
        "nativeSessions.retrieve",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::MODELS_PATH,
        "models",
        "models.list",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::MODEL_CONFIG_PATH,
        "models",
        "modelConfig.retrieve",
    ),
    HttpRoute::dual_token(
        HttpMethod::Put,
        paths::MODEL_CONFIG_PATH,
        "models",
        "modelConfig.sync",
    ),
];

pub fn engine_catalog_app_api_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(ENGINE_CATALOG_APP_API_ROUTES)
}
