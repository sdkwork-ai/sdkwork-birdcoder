use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const SKILL_PACKAGES_APP_API_ROUTES: &[HttpRoute] = &[
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::SKILL_PACKAGES_PATH,
        "skillPackages",
        "skillPackages.list",
    )
    .with_required_permission("birdcoder.ecosystem-skill-packages.read"),
    HttpRoute::dual_token(
        HttpMethod::Post,
        paths::SKILL_PACKAGE_INSTALLATIONS_PATH,
        "skillPackages",
        "skillPackages.installations.create",
    )
    .with_required_permission("birdcoder.ecosystem-skill-packages-installations.create"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::APP_TEMPLATES_PATH,
        "appTemplates",
        "appTemplates.list",
    )
    .with_required_permission("birdcoder.ecosystem-app-templates.read"),
];

pub fn skill_packages_app_api_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(SKILL_PACKAGES_APP_API_ROUTES)
}
