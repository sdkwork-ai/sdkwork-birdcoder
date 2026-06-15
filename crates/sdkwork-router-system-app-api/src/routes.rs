use axum::{routing::get, Router};

use crate::handlers;
use crate::paths;

pub fn build_system_app_router() -> Router {
    Router::new()
        .route(paths::SYSTEM_DESCRIPTOR_PATH, get(handlers::get_descriptor))
        .route(paths::SYSTEM_ROUTES_PATH, get(handlers::list_routes))
        .route(paths::SYSTEM_RUNTIME_PATH, get(handlers::get_runtime))
        .route(paths::SYSTEM_HEALTH_PATH, get(handlers::get_health))
        .route(paths::OPERATIONS_PATH, get(handlers::get_operation))
}
