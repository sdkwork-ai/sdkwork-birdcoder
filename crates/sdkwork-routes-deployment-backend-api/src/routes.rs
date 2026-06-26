use axum::{routing::get, Router};

use crate::handlers;
use crate::handlers::DeploymentBackendAppState;
use crate::paths;

pub fn build_deployment_backend_router() -> Router<DeploymentBackendAppState> {
    Router::new()
        .route(
            paths::ADMIN_PROJECT_DEPLOYMENT_TARGETS_PATH,
            get(handlers::admin_deployment_targets),
        )
        .route(paths::ADMIN_RELEASES_PATH, get(handlers::admin_releases))
        .route(
            paths::ADMIN_DEPLOYMENTS_PATH,
            get(handlers::admin_deployments),
        )
        .route(paths::ADMIN_TEAMS_PATH, get(handlers::admin_teams))
        .route(
            paths::ADMIN_TEAM_MEMBERS_PATH,
            get(handlers::admin_team_members),
        )
}
