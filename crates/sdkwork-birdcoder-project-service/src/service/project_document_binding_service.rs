use std::sync::Arc;

use sdkwork_utils_rust::is_blank;

use crate::context::ProjectContext;
use crate::domain::document_binding::{
    NewProjectDocumentBinding, ProjectDocumentBindingPayload,
    UpsertProjectDocumentBindingRequest,
};
use crate::error::ProjectError;
use crate::ports::document_binding_repository::ProjectDocumentBindingRepository;
use crate::ports::repository::ProjectRepository;

#[derive(Clone)]
pub struct ProjectDocumentBindingService {
    project_repository: Arc<dyn ProjectRepository>,
    binding_repository: Arc<dyn ProjectDocumentBindingRepository>,
}

impl ProjectDocumentBindingService {
    pub fn new(
        project_repository: Arc<dyn ProjectRepository>,
        binding_repository: Arc<dyn ProjectDocumentBindingRepository>,
    ) -> Self {
        Self {
            project_repository,
            binding_repository,
        }
    }

    pub async fn get(
        &self,
        context: &ProjectContext,
        project_id: &str,
        binding_id: &str,
    ) -> Result<ProjectDocumentBindingPayload, ProjectError> {
        validate_ids(project_id, Some(binding_id))?;
        self.project_repository
            .find_project_by_id(context, project_id)
            .await?
            .ok_or_else(|| ProjectError::NotFound("Project was not found.".to_owned()))?;
        self.binding_repository
            .get_document_binding(context, project_id, binding_id)
            .await?
            .ok_or_else(|| ProjectError::NotFound("Document binding was not found.".to_owned()))
    }

    pub async fn list(
        &self,
        context: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectDocumentBindingPayload>, usize), ProjectError> {
        validate_ids(project_id, None)?;
        self.project_repository
            .find_project_by_id(context, project_id)
            .await?
            .ok_or_else(|| ProjectError::NotFound("Project was not found.".to_owned()))?;
        self.binding_repository
            .list_document_bindings(context, project_id, offset, limit.min(200))
            .await
    }

    pub async fn upsert(
        &self,
        context: &ProjectContext,
        project_id: &str,
        request: &UpsertProjectDocumentBindingRequest,
    ) -> Result<ProjectDocumentBindingPayload, ProjectError> {
        validate_ids(project_id, None)?;
        validate_opaque_reference(&request.document_id, "documentId", 160)?;
        validate_binding_kind(&request.binding_kind)?;
        self.project_repository
            .ensure_project_write_access(context, project_id)
            .await?;
        self.binding_repository
            .upsert_document_binding(
                context,
                &NewProjectDocumentBinding {
                    project_id: project_id.to_owned(),
                    document_id: request.document_id.trim().to_owned(),
                    binding_kind: request.binding_kind.trim().to_owned(),
                },
            )
            .await
    }

    pub async fn delete(
        &self,
        context: &ProjectContext,
        project_id: &str,
        binding_id: &str,
        expected_version: i64,
    ) -> Result<(), ProjectError> {
        validate_ids(project_id, Some(binding_id))?;
        if expected_version < 0 {
            return Err(ProjectError::InvalidInput(
                "If-Match must be a non-negative version.".to_owned(),
            ));
        }
        self.project_repository
            .ensure_project_write_access(context, project_id)
            .await?;
        self.binding_repository
            .delete_document_binding(context, project_id, binding_id, expected_version)
            .await
    }
}

fn validate_ids(project_id: &str, binding_id: Option<&str>) -> Result<(), ProjectError> {
    if is_blank(Some(project_id)) {
        return Err(ProjectError::InvalidInput(
            "projectId is required.".to_owned(),
        ));
    }
    if binding_id.is_some_and(|value| is_blank(Some(value))) {
        return Err(ProjectError::InvalidInput(
            "bindingId is required.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_opaque_reference(value: &str, field: &str, max_len: usize) -> Result<(), ProjectError> {
    if value.trim() != value
        || value.is_empty()
        || value.len() > max_len
        || value.chars().any(char::is_control)
    {
        return Err(ProjectError::InvalidInput(format!(
            "{field} must be a non-blank opaque identifier of at most {max_len} bytes."
        )));
    }
    Ok(())
}

fn validate_binding_kind(value: &str) -> Result<(), ProjectError> {
    let value = value.trim();
    if value.is_empty()
        || value.len() > 64
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
    {
        return Err(ProjectError::InvalidInput(
            "bindingKind must be a lower-snake-case token of at most 64 bytes.".to_owned(),
        ));
    }
    Ok(())
}
