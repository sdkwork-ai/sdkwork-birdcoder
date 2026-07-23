use std::sync::Arc;

use sdkwork_utils_rust::is_blank;

use crate::context::WorkspaceContext;
use crate::domain::commands::{CreateWorkspaceRequest, UpdateWorkspaceRequest};
use crate::domain::models::WorkspaceScopedQuery;
use crate::domain::results::{DeleteEntityPayload, WorkspacePayload};
use crate::error::WorkspaceError;
use crate::ports::repository::WorkspaceRepository;

#[derive(Clone)]
pub struct WorkspaceService {
    repository: Arc<dyn WorkspaceRepository>,
}

impl WorkspaceService {
    pub fn new(repository: Arc<dyn WorkspaceRepository>) -> Self {
        Self { repository }
    }

    pub async fn list_workspaces(
        &self,
        context: &WorkspaceContext,
        query: &WorkspaceScopedQuery,
    ) -> Result<(Vec<WorkspacePayload>, usize), WorkspaceError> {
        self.repository.list_workspaces(context, query).await
    }

    pub async fn get_workspace(
        &self,
        context: &WorkspaceContext,
        id: &str,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        validate_workspace_id(id)?;
        self.repository
            .find_workspace_by_id(context, id)
            .await?
            .ok_or_else(|| WorkspaceError::NotFound("Workspace was not found.".to_owned()))
    }

    pub async fn ensure_workspace_access(
        &self,
        context: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError> {
        validate_workspace_id(workspace_id)?;
        self.repository
            .ensure_workspace_access(context, workspace_id)
            .await
    }

    pub async fn create_workspace(
        &self,
        context: &WorkspaceContext,
        request: &CreateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        if is_blank(Some(&request.name)) || request.name.trim().len() > 160 {
            return Err(WorkspaceError::InvalidInput(
                "name must contain between 1 and 160 bytes.".to_owned(),
            ));
        }
        validate_workspace_code(request.code.as_deref())?;
        validate_workspace_visibility(request.visibility.as_deref())?;
        self.repository.create_workspace(context, request).await
    }

    pub async fn update_workspace(
        &self,
        context: &WorkspaceContext,
        id: &str,
        request: &UpdateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        validate_workspace_id(id)?;
        if request.expected_version < 0 {
            return Err(WorkspaceError::InvalidInput(
                "If-Match must be a non-negative version.".to_owned(),
            ));
        }
        if request
            .name
            .as_deref()
            .is_some_and(|value| is_blank(Some(value)) || value.trim().len() > 160)
        {
            return Err(WorkspaceError::InvalidInput(
                "name must contain between 1 and 160 bytes.".to_owned(),
            ));
        }
        if request.name.is_none()
            && request.description.is_none()
            && request.code.is_none()
            && request.icon_url.is_none()
            && request.color.is_none()
            && request.visibility.is_none()
            && request.status.is_none()
        {
            return Err(WorkspaceError::InvalidInput(
                "At least one mutable workspace field is required.".to_owned(),
            ));
        }
        validate_workspace_code(request.code.as_deref())?;
        validate_workspace_visibility(request.visibility.as_deref())?;
        validate_workspace_status(request.status.as_deref())?;
        self.repository.update_workspace(context, id, request).await
    }

    pub async fn delete_workspace(
        &self,
        context: &WorkspaceContext,
        id: &str,
        expected_version: i64,
    ) -> Result<DeleteEntityPayload, WorkspaceError> {
        validate_workspace_id(id)?;
        if expected_version < 0 {
            return Err(WorkspaceError::InvalidInput(
                "If-Match must be a non-negative version.".to_owned(),
            ));
        }
        self.repository
            .delete_workspace(context, id, expected_version)
            .await?;
        Ok(DeleteEntityPayload { id: id.to_owned() })
    }
}

fn validate_workspace_id(id: &str) -> Result<(), WorkspaceError> {
    if is_blank(Some(id)) {
        return Err(WorkspaceError::InvalidInput(
            "workspaceId is required.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_workspace_code(code: Option<&str>) -> Result<(), WorkspaceError> {
    if code.is_some_and(|value| {
        let value = value.trim();
        is_blank(Some(value))
            || value.len() > 96
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    }) {
        return Err(WorkspaceError::InvalidInput(
            "code must contain only letters, digits, '.', '_' or '-' and be at most 96 bytes."
                .to_owned(),
        ));
    }
    Ok(())
}

fn validate_workspace_visibility(visibility: Option<&str>) -> Result<(), WorkspaceError> {
    if visibility.is_some_and(|value| !matches!(value.trim(), "private" | "organization")) {
        return Err(WorkspaceError::InvalidInput(
            "visibility must be private or organization.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_workspace_status(status: Option<&str>) -> Result<(), WorkspaceError> {
    if status.is_some_and(|value| !matches!(value.trim(), "active" | "archived")) {
        return Err(WorkspaceError::InvalidInput(
            "status must be active or archived.".to_owned(),
        ));
    }
    Ok(())
}
