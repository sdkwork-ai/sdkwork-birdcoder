use std::sync::{Arc, Mutex};

use axum::extract::{Query, State};
use axum::Json;
use rusqlite::Connection;

use sdkwork_birdcoder_document_repository_sqlx::SqliteDocumentRepository;
use sdkwork_birdcoder_document_service::service::document_service::DocumentService;
use sdkwork_birdcoder_router_context::RequiredIamContext;

use crate::error;
use crate::mapper::request::DocumentListQuery;

#[derive(Clone)]
pub struct DocumentAppState {
    pub service: DocumentService<SqliteDocumentRepository>,
}

impl DocumentAppState {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self {
            service: DocumentService::new(SqliteDocumentRepository::new(conn)),
        }
    }
}

pub async fn list_documents(
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<DocumentAppState>,
    Query(query): Query<DocumentListQuery>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    match state.service.list_documents(
        query.project_id.as_deref(),
        Some(iam.tenant_id.as_str()),
    ) {
        Ok(items) => Ok(Json(serde_json::json!({ "items": items }))),
        Err(e) => Err(error::map_service_error(e)),
    }
}
