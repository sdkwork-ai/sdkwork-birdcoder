use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const DEPLOYMENT_BACKEND_API_ROUTES: &[HttpRoute] = &[
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ADMIN_PROJECT_DEPLOYMENT_TARGETS_PATH,
        "deploymentGovernance",
        "deploymentGovernance.targets.list",
    )
    .with_required_permission("birdcoder.platform-deployment-governance-targets.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ADMIN_RELEASES_PATH,
        "releases",
        "releases.list",
    )
    .with_required_permission("birdcoder.platform-releases.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ADMIN_DEPLOYMENTS_PATH,
        "deploymentGovernance",
        "deploymentGovernance.list",
    )
    .with_required_permission("birdcoder.platform-deployment-governance.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ADMIN_TEAMS_PATH,
        "teams",
        "teams.list",
    )
    .with_required_permission("birdcoder.iam-teams.read"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::ADMIN_TEAM_MEMBERS_PATH,
        "teams",
        "teams.members.list",
    )
    .with_required_permission("birdcoder.iam-teams-members.read"),
];

pub fn deployment_backend_api_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(DEPLOYMENT_BACKEND_API_ROUTES)
}
