use axum::{routing::get, Router};

use crate::handlers;
use crate::handlers::MembershipAppState;
use crate::paths;

pub fn build_membership_app_router() -> Router<MembershipAppState> {
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
