use axum::extract::{Query, State};
use axum::Json;
use sqlx::SqlitePool;

use sdkwork_birdcoder_document_repository_sqlx::SqliteDocumentRepository;
use sdkwork_birdcoder_document_service::service::document_service::DocumentService;
use sdkwork_birdcoder_errors::trace_id_from_request_id;
use sdkwork_birdcoder_router_context::{RequiredIamContext, WebRequestContext};

use crate::error;
use crate::mapper::request::DocumentListQuery;

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

#[derive(Clone)]
pub struct DocumentAppState {
    pub service: DocumentService<SqliteDocumentRepository>,
}

impl DocumentAppState {
    pub fn new(pool: SqlitePool) -> Self {
        Self {
            service: DocumentService::new(SqliteDocumentRepository::new(pool)),
        }
    }
}

pub async fn list_documents(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<DocumentAppState>,
    Query(query): Query<DocumentListQuery>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)>
{
    let trace_id = request_trace_id(&web);
    match state
        .service
        .list_documents(
            query.project_id.as_deref(),
            Some(iam.tenant_id.as_str()),
        )
        .await
    {
        Ok(items) => Ok(Json(serde_json::json!({ "items": items }))),
        Err(e) => Err(error::map_service_error(e, trace_id)),
    }
}
