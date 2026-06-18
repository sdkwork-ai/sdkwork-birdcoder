use axum::{routing::get, Router};

use crate::handlers;
use crate::handlers::DocumentAppState;
use crate::paths;

pub fn build_document_app_router() -> Router<DocumentAppState> {
    Router::new().route(paths::DOCUMENTS_PATH, get(handlers::list_documents))
}
