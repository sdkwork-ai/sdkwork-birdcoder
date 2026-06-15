use std::sync::Arc;

use crate::context::SessionContext;
use crate::domain::commands::{CreateWorkspaceRequest, UpdateWorkspaceRequest, UpsertWorkspaceMemberRequest};
use crate::domain::models::WorkspaceScopedQuery;
use crate::domain::results::{DeleteEntityPayload, WorkspaceMemberPayload, WorkspacePayload};
use crate::error::WorkspaceError;
use crate::ports::events::WorkspaceEventPublisher;
use crate::ports::repository::WorkspaceRepository;

#[derive(Clone)]
pub struct WorkspaceService {
    repository: Arc<dyn WorkspaceRepository>,
    event_publisher: Arc<dyn WorkspaceEventPublisher>,
}

impl WorkspaceService {
    pub fn new(
        repository: Arc<dyn WorkspaceRepository>,
        event_publisher: Arc<dyn WorkspaceEventPublisher>,
    ) -> Self {
        Self {
            repository,
            event_publisher,
        }
    }

    pub async fn list_workspaces(
        &self,
        ctx: &SessionContext,
        query: &WorkspaceScopedQuery,
    ) -> Result<Vec<WorkspacePayload>, WorkspaceError> {
        self.repository.list_workspaces(ctx, query).await
    }

    pub async fn get_workspace(
        &self,
        ctx: &SessionContext,
        id: &str,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        if id.trim().is_empty() {
            return Err(WorkspaceError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }
        self.repository
            .find_workspace_by_id(ctx, id)
            .await?
            .ok_or_else(|| WorkspaceError::NotFound("Workspace was not found.".to_owned()))
    }

    pub async fn create_workspace(
        &self,
        ctx: &SessionContext,
        request: &CreateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        if request.name.trim().is_empty() {
            return Err(WorkspaceError::InvalidInput(
                "Workspace name is required.".to_owned(),
            ));
        }

        let workspace = self.repository.create_workspace(ctx, request).await?;

        self.event_publisher
            .publish_workspace_created(&workspace.id)
            .await?;

        Ok(workspace)
    }

    pub async fn update_workspace(
        &self,
        ctx: &SessionContext,
        id: &str,
        request: &UpdateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        if id.trim().is_empty() {
            return Err(WorkspaceError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }

        let existing = self.repository.find_workspace_by_id(ctx, id).await?;
        if existing.is_none() {
            return Err(WorkspaceError::NotFound(
                "Workspace was not found.".to_owned(),
            ));
        }

        let workspace = self.repository.update_workspace(ctx, id, request).await?;

        self.event_publisher
            .publish_workspace_updated(&workspace.id)
            .await?;

        Ok(workspace)
    }

    pub async fn delete_workspace(
        &self,
        ctx: &SessionContext,
        id: &str,
    ) -> Result<DeleteEntityPayload, WorkspaceError> {
        if id.trim().is_empty() {
            return Err(WorkspaceError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }

        self.repository.delete_workspace(ctx, id).await?;

        self.event_publisher
            .publish_workspace_deleted(id)
            .await?;

        Ok(DeleteEntityPayload { id: id.to_owned() })
    }

    pub async fn list_workspace_members(
        &self,
        ctx: &SessionContext,
        workspace_id: &str,
    ) -> Result<Vec<WorkspaceMemberPayload>, WorkspaceError> {
        if workspace_id.trim().is_empty() {
            return Err(WorkspaceError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }
        self.repository
            .list_workspace_members(ctx, workspace_id)
            .await
    }

    pub async fn upsert_workspace_member(
        &self,
        ctx: &SessionContext,
        workspace_id: &str,
        request: &UpsertWorkspaceMemberRequest,
    ) -> Result<WorkspaceMemberPayload, WorkspaceError> {
        if workspace_id.trim().is_empty() {
            return Err(WorkspaceError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }

        let workspace = self.repository.find_workspace_by_id(ctx, workspace_id).await?;
        if workspace.is_none() {
            return Err(WorkspaceError::NotFound(
                "Workspace was not found.".to_owned(),
            ));
        }

        let member = self
            .repository
            .upsert_workspace_member(ctx, workspace_id, request)
            .await?;

        self.event_publisher
            .publish_workspace_member_added(workspace_id, &member.user_id)
            .await?;

        Ok(member)
    }

    pub async fn remove_workspace_member(
        &self,
        ctx: &SessionContext,
        workspace_id: &str,
        user_id: &str,
    ) -> Result<(), WorkspaceError> {
        if workspace_id.trim().is_empty() {
            return Err(WorkspaceError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }
        if user_id.trim().is_empty() {
            return Err(WorkspaceError::InvalidInput(
                "userId is required.".to_owned(),
            ));
        }

        self.repository
            .remove_workspace_member(ctx, workspace_id, user_id)
            .await?;

        self.event_publisher
            .publish_workspace_member_removed(workspace_id, user_id)
            .await?;

        Ok(())
    }
}
