use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const SYSTEM_APP_API_ROUTES: &[HttpRoute] = &[
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::SYSTEM_DESCRIPTOR_PATH,
        "system",
        "descriptor.retrieve",
    )
    .with_required_permission("system.descriptor.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::SYSTEM_ROUTES_PATH,
        "system",
        "routes.list",
    )
    .with_required_permission("system.routes.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::SYSTEM_RUNTIME_PATH,
        "system",
        "runtime.retrieve",
    )
    .with_required_permission("system.runtime.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::SYSTEM_HEALTH_PATH,
        "system",
        "health.retrieve",
    )
    .with_required_permission("system.health.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::OPERATIONS_PATH,
        "system",
        "operations.retrieve",
    )
    .with_required_permission("system.operations.read"),
];

pub fn system_app_api_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(SYSTEM_APP_API_ROUTES)
}
