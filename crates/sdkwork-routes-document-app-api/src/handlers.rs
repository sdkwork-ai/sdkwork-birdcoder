use axum::extract::{Query, State};
use axum::Json;
use sqlx::AnyPool;

use sdkwork_birdcoder_document_repository_sqlx::SqliteDocumentRepository;
use sdkwork_birdcoder_document_service::domain::models::DocumentPayload;
use sdkwork_birdcoder_document_service::service::document_service::{
    DocumentListQuery as DocumentListServiceQuery, DocumentService,
};
use sdkwork_birdcoder_errors::{
    build_offset_list_envelope, trace_id_from_request_id, ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{RequiredIamContext, WebRequestContext};

use crate::error;
use crate::mapper::request::DocumentListQuery;

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

#[derive(Clone)]
pub struct DocumentAppState {
    pub service: DocumentService<SqliteDocumentRepository>,
}

impl DocumentAppState {
    pub fn new(pool: AnyPool) -> Self {
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
) -> Result<
    Json<ApiListEnvelope<DocumentPayload>>,
    error::ProblemJsonBody,
>
{
    let trace_id = request_trace_id(&web);
    match state
        .service
        .list_documents(
            query.project_id.as_deref(),
            Some(iam.tenant_id.as_str()),
            &DocumentListServiceQuery {
                offset: query.offset,
                limit: query.limit,
            },
        )
        .await
    {
        Ok(page) => {
            let (offset, page_size) = query.normalized_pagination();
            Ok(Json(build_offset_list_envelope(
                page.items,
                offset,
                page_size,
                page.total,
                request_id(&web),
            )))
        }
        Err(e) => Err(error::map_service_error(e, trace_id)),
    }
}
