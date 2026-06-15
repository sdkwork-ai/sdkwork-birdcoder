use axum::{routing::get, Router};

use crate::handlers;
use crate::paths;

pub fn build_content_app_router() -> Router {
    Router::new().route(paths::DOCUMENTS_PATH, get(handlers::list_documents))
}
