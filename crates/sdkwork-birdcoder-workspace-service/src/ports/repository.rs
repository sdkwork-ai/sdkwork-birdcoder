use crate::context::SessionContext;
use crate::domain::commands::{CreateWorkspaceRequest, UpdateWorkspaceRequest, UpsertWorkspaceMemberRequest};
use crate::domain::models::WorkspaceScopedQuery;
use crate::domain::results::{WorkspaceMemberPayload, WorkspacePayload};
use crate::error::WorkspaceError;

#[async_trait::async_trait]
pub trait WorkspaceRepository: Send + Sync {
    async fn find_workspace_by_id(&self, ctx: &SessionContext, id: &str) -> Result<Option<WorkspacePayload>, WorkspaceError>;
    async fn list_workspaces(&self, ctx: &SessionContext, query: &WorkspaceScopedQuery) -> Result<Vec<WorkspacePayload>, WorkspaceError>;
    async fn create_workspace(&self, ctx: &SessionContext, req: &CreateWorkspaceRequest) -> Result<WorkspacePayload, WorkspaceError>;
    async fn update_workspace(&self, ctx: &SessionContext, id: &str, req: &UpdateWorkspaceRequest) -> Result<WorkspacePayload, WorkspaceError>;
    async fn delete_workspace(&self, ctx: &SessionContext, id: &str) -> Result<(), WorkspaceError>;
    async fn list_workspace_members(&self, ctx: &SessionContext, workspace_id: &str) -> Result<Vec<WorkspaceMemberPayload>, WorkspaceError>;
    async fn upsert_workspace_member(&self, ctx: &SessionContext, workspace_id: &str, req: &UpsertWorkspaceMemberRequest) -> Result<WorkspaceMemberPayload, WorkspaceError>;
    async fn remove_workspace_member(&self, ctx: &SessionContext, workspace_id: &str, user_id: &str) -> Result<(), WorkspaceError>;
}
