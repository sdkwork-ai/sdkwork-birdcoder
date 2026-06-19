use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const DEPLOYMENT_BACKEND_API_ROUTES: &[HttpRoute] = &[
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ADMIN_DEPLOYMENT_TARGETS_PATH,
        "deploymentGovernance",
        "deploymentTargets.list",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ADMIN_RELEASES_PATH,
        "releases",
        "releases.list",
    ),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ADMIN_DEPLOYMENTS_PATH,
        "deploymentGovernance",
        "deploymentGovernance.list",
    ),
];

pub fn deployment_backend_api_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(DEPLOYMENT_BACKEND_API_ROUTES)
}
