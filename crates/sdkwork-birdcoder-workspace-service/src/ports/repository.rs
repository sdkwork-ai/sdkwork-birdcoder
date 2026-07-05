use crate::context::WorkspaceContext;
use crate::domain::commands::{CreateWorkspaceRequest, UpdateWorkspaceRequest, UpsertWorkspaceMemberRequest};
use crate::domain::models::WorkspaceScopedQuery;
use crate::domain::results::{WorkspaceMemberPayload, WorkspacePayload};
use crate::error::WorkspaceError;

#[async_trait::async_trait]
pub trait WorkspaceRepository: Send + Sync {
    async fn find_workspace_by_id(&self, ctx: &WorkspaceContext, id: &str) -> Result<Option<WorkspacePayload>, WorkspaceError>;
    /// List workspaces with SQL-pushed `LIMIT`/`OFFSET` and a parallel
    /// `COUNT(*)` for the total. Aligns with `PAGINATION_SPEC.md` §2
    /// (no in-memory `skip`/`take`) and §5 (store-layer push-down).
    async fn list_workspaces(
        &self,
        ctx: &WorkspaceContext,
        query: &WorkspaceScopedQuery,
    ) -> Result<(Vec<WorkspacePayload>, usize), WorkspaceError>;
    async fn create_workspace(&self, ctx: &WorkspaceContext, req: &CreateWorkspaceRequest) -> Result<WorkspacePayload, WorkspaceError>;
    async fn update_workspace(&self, ctx: &WorkspaceContext, id: &str, req: &UpdateWorkspaceRequest) -> Result<WorkspacePayload, WorkspaceError>;
    async fn delete_workspace(&self, ctx: &WorkspaceContext, id: &str) -> Result<(), WorkspaceError>;
    /// List workspace members with SQL-pushed `LIMIT`/`OFFSET` and a
    /// parallel `COUNT(*)` for the total.
    async fn list_workspace_members(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<WorkspaceMemberPayload>, usize), WorkspaceError>;
    async fn upsert_workspace_member(&self, ctx: &WorkspaceContext, workspace_id: &str, req: &UpsertWorkspaceMemberRequest) -> Result<WorkspaceMemberPayload, WorkspaceError>;
    async fn remove_workspace_member(&self, ctx: &WorkspaceContext, workspace_id: &str, user_id: &str) -> Result<(), WorkspaceError>;
    async fn ensure_workspace_access(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError>;
}
