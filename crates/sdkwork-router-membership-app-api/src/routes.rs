use axum::{routing::get, Router};

use crate::handlers;
use crate::paths;

pub fn build_commerce_app_router() -> Router {
    Router::new()
        .route(
            paths::MEMBERSHIP_CURRENT_PATH,
            get(handlers::get_current_membership),
        )
        .route(
            paths::MEMBERSHIP_PACKAGE_GROUPS_PATH,
            get(handlers::list_membership_package_groups),
        )
}
