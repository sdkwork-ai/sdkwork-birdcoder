use std::sync::Arc;

use sdkwork_utils_rust::is_blank;

use crate::context::WorkspaceContext;
use crate::domain::commands::{
    CreateWorkspaceRequest, UpdateWorkspaceRequest, UpsertWorkspaceMemberRequest,
};
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
        ctx: &WorkspaceContext,
        query: &WorkspaceScopedQuery,
    ) -> Result<(Vec<WorkspacePayload>, usize), WorkspaceError> {
        self.repository.list_workspaces(ctx, query).await
    }

    pub async fn get_workspace(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        if is_blank(Some(id)) {
            return Err(WorkspaceError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }
        self.repository.ensure_workspace_access(ctx, id).await?;
        self.repository
            .find_workspace_by_id(ctx, id)
            .await?
            .ok_or_else(|| WorkspaceError::NotFound("Workspace was not found.".to_owned()))
    }

    pub async fn ensure_workspace_access(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError> {
        self.repository
            .ensure_workspace_access(ctx, workspace_id)
            .await
    }

    pub async fn create_workspace(
        &self,
        ctx: &WorkspaceContext,
        request: &CreateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        if is_blank(Some(&request.name)) {
            return Err(WorkspaceError::InvalidInput(
                "Workspace name is required.".to_owned(),
            ));
        }
        if request
            .tenant_id
            .as_deref()
            .is_some_and(|tenant_id| tenant_id.trim() != ctx.tenant_id)
        {
            return Err(WorkspaceError::Forbidden(
                "Workspace tenant scope must match the authenticated session.".to_owned(),
            ));
        }
        if request
            .organization_id
            .as_deref()
            .is_some_and(|organization_id| organization_id.trim() != ctx.organization_id)
        {
            return Err(WorkspaceError::Forbidden(
                "Workspace organization scope must match the authenticated session.".to_owned(),
            ));
        }
        for (value, field) in [
            (request.max_members, "maxMembers"),
            (request.current_members, "currentMembers"),
            (request.member_count, "memberCount"),
        ] {
            if value.is_some_and(|value| value < 0) {
                return Err(WorkspaceError::InvalidInput(format!(
                    "{field} must be non-negative."
                )));
            }
        }

        let workspace = self.repository.create_workspace(ctx, request).await?;

        Self::accept_committed_realtime_publish(
            self.event_publisher
                .publish_workspace_created(ctx, &workspace.id)
                .await,
            &workspace.id,
            "workspace.created",
        )?;

        Ok(workspace)
    }

    pub async fn update_workspace(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
        request: &UpdateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        if is_blank(Some(id)) {
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

        Self::accept_committed_realtime_publish(
            self.event_publisher
                .publish_workspace_updated(ctx, &workspace.id)
                .await,
            &workspace.id,
            "workspace.updated",
        )?;

        Ok(workspace)
    }

    pub async fn delete_workspace(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
    ) -> Result<DeleteEntityPayload, WorkspaceError> {
        if is_blank(Some(id)) {
            return Err(WorkspaceError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }

        self.repository.delete_workspace(ctx, id).await?;

        Self::accept_committed_realtime_publish(
            self.event_publisher
                .publish_workspace_deleted(ctx, id)
                .await,
            id,
            "workspace.deleted",
        )?;

        Ok(DeleteEntityPayload { id: id.to_owned() })
    }

    pub async fn list_workspace_members(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<WorkspaceMemberPayload>, usize), WorkspaceError> {
        if is_blank(Some(workspace_id)) {
            return Err(WorkspaceError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }
        self.repository
            .list_workspace_members(ctx, workspace_id, offset, limit)
            .await
    }

    pub async fn upsert_workspace_member(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        request: &UpsertWorkspaceMemberRequest,
    ) -> Result<WorkspaceMemberPayload, WorkspaceError> {
        if is_blank(Some(workspace_id)) {
            return Err(WorkspaceError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }

        let workspace = self
            .repository
            .find_workspace_by_id(ctx, workspace_id)
            .await?;
        if workspace.is_none() {
            return Err(WorkspaceError::NotFound(
                "Workspace was not found.".to_owned(),
            ));
        }

        let member = self
            .repository
            .upsert_workspace_member(ctx, workspace_id, request)
            .await?;

        Self::accept_committed_realtime_publish(
            self.event_publisher
                .publish_workspace_member_added(ctx, workspace_id, &member.user_id)
                .await,
            workspace_id,
            "workspace.member.added",
        )?;

        Ok(member)
    }

    pub async fn remove_workspace_member(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        user_id: &str,
    ) -> Result<(), WorkspaceError> {
        if is_blank(Some(workspace_id)) {
            return Err(WorkspaceError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }
        if is_blank(Some(user_id)) {
            return Err(WorkspaceError::InvalidInput(
                "userId is required.".to_owned(),
            ));
        }

        self.repository
            .remove_workspace_member(ctx, workspace_id, user_id)
            .await?;

        Self::accept_committed_realtime_publish(
            self.event_publisher
                .publish_workspace_member_removed(ctx, workspace_id, user_id)
                .await,
            workspace_id,
            "workspace.member.removed",
        )?;

        Ok(())
    }

    fn accept_committed_realtime_publish(
        result: Result<(), WorkspaceError>,
        workspace_id: &str,
        event_kind: &str,
    ) -> Result<(), WorkspaceError> {
        match result {
            Err(WorkspaceError::EventPublish(reason)) => {
                tracing::warn!(
                    workspace_id = %workspace_id,
                    event_kind = %event_kind,
                    reason = %reason,
                    "committed workspace update fan-out failed; clients must refresh durable state"
                );
                Ok(())
            }
            result => result,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn realtime_failure_does_not_fail_a_committed_workspace_mutation() {
        WorkspaceService::accept_committed_realtime_publish(
            Err(WorkspaceError::EventPublish("redis unavailable".to_owned())),
            "101",
            "workspace.created",
        )
        .expect("realtime fan-out is best effort after the database commit");
    }

    #[test]
    fn non_realtime_failure_remains_terminal() {
        let error = WorkspaceService::accept_committed_realtime_publish(
            Err(WorkspaceError::Internal("unexpected".to_owned())),
            "101",
            "workspace.created",
        )
        .expect_err("non-realtime errors remain terminal");
        assert!(matches!(error, WorkspaceError::Internal(_)));
    }
}
