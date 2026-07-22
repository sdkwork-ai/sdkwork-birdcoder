use crate::context::ProjectContext;
use crate::domain::document_binding::{
    NewProjectDocumentBinding, ProjectDocumentBindingPayload,
};
use crate::error::ProjectError;

#[async_trait::async_trait]
pub trait ProjectDocumentBindingRepository: Send + Sync {
    async fn get_document_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
        binding_id: &str,
    ) -> Result<Option<ProjectDocumentBindingPayload>, ProjectError>;

    async fn list_document_bindings(
        &self,
        context: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectDocumentBindingPayload>, usize), ProjectError>;

    async fn upsert_document_binding(
        &self,
        context: &ProjectContext,
        binding: &NewProjectDocumentBinding,
    ) -> Result<ProjectDocumentBindingPayload, ProjectError>;

    async fn delete_document_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
        binding_id: &str,
        expected_version: i64,
    ) -> Result<(), ProjectError>;
}
