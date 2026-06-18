use axum::{routing::get, Router};

use crate::handlers;
use crate::handlers::DeploymentBackendAppState;
use crate::paths;

pub fn build_deployment_backend_router() -> Router<DeploymentBackendAppState> {
    Router::new()
        .route(
            paths::ADMIN_DEPLOYMENT_TARGETS_PATH,
            get(handlers::admin_deployment_targets),
        )
        .route(paths::ADMIN_RELEASES_PATH, get(handlers::admin_releases))
        .route(
            paths::ADMIN_DEPLOYMENTS_PATH,
            get(handlers::admin_deployments),
        )
}
