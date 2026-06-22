use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const SYSTEM_APP_API_ROUTES: &[HttpRoute] = &[
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::SYSTEM_DESCRIPTOR_PATH,
        "system",
        "descriptor.retrieve",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::SYSTEM_ROUTES_PATH,
        "system",
        "routes.list",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::SYSTEM_RUNTIME_PATH,
        "system",
        "runtime.retrieve",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::SYSTEM_HEALTH_PATH,
        "system",
        "health.retrieve",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::OPERATIONS_PATH,
        "system",
        "operations.retrieve",
    ),
];

pub fn system_app_api_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(SYSTEM_APP_API_ROUTES)
}
