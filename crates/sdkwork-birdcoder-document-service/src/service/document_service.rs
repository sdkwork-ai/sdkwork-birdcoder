use crate::domain::models::DocumentPayload;
use crate::error::DocumentError;

use sdkwork_utils_rust::{is_blank, trim as trim_string};

// ── Repository trait ─────────────────────────────────────────────────

#[derive(Clone, Copy, Debug, Default)]
pub struct DocumentListQuery {
    pub offset: Option<usize>,
    pub page_size: Option<usize>,
}

#[derive(Clone, Debug)]
pub struct DocumentListPage {
    pub items: Vec<DocumentPayload>,
    pub total: usize,
}

#[async_trait::async_trait]
pub trait DocumentRepository: Send + Sync {
    async fn list_documents(
        &self,
        project_id: Option<&str>,
        tenant_id: Option<&str>,
        query: &DocumentListQuery,
    ) -> Result<DocumentListPage, String>;

    async fn find_document_by_id(
        &self,
        document_id: &str,
        tenant_id: Option<&str>,
    ) -> Result<Option<DocumentPayload>, String>;
}

// ── Service ──────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct DocumentService<R: DocumentRepository> {
    repository: R,
}

impl<R: DocumentRepository> DocumentService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn list_documents(
        &self,
        project_id: Option<&str>,
        tenant_id: Option<&str>,
        query: &DocumentListQuery,
    ) -> Result<DocumentListPage, DocumentError> {
        self.repository
            .list_documents(project_id, tenant_id, query)
            .await
            .map_err(DocumentError::Repository)
    }

    pub async fn get_document(
        &self,
        document_id: &str,
        tenant_id: Option<&str>,
    ) -> Result<DocumentPayload, DocumentError> {
        let normalized_id = normalize_required(document_id).ok_or_else(|| {
            DocumentError::InvalidInput("documentId is required.".to_string())
        })?;

        self.repository
            .find_document_by_id(&normalized_id, tenant_id)
            .await
            .map_err(DocumentError::Repository)?
            .ok_or_else(|| {
                DocumentError::NotFound(format!("Document \"{normalized_id}\" was not found."))
            })
    }
}

fn normalize_required(value: &str) -> Option<String> {
    if is_blank(Some(value)) {
        None
    } else {
        Some(trim_string(value))
    }
}
