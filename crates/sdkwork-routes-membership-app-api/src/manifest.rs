use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const MEMBERSHIP_APP_API_ROUTES: &[HttpRoute] = &[
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::MEMBERSHIP_CURRENT_PATH,
        "memberships",
        "memberships.current.retrieve",
    )
    .with_required_permission("birdcoder.commerce-memberships-current.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::MEMBERSHIP_PACKAGE_GROUPS_PATH,
        "memberships",
        "memberships.packageGroups.list",
    )
    .with_required_permission("birdcoder.commerce-memberships-package-groups.read"),
];

pub fn membership_app_api_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(MEMBERSHIP_APP_API_ROUTES)
}
