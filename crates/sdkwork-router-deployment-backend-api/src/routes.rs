use axum::{routing::get, Router};

use crate::handlers;
use crate::paths;

pub fn build_platform_backend_router() -> Router {
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
