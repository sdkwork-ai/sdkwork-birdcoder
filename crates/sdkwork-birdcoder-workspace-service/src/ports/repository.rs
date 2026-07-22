use crate::context::WorkspaceContext;
use crate::domain::commands::{CreateWorkspaceRequest, UpdateWorkspaceRequest};
use crate::domain::models::WorkspaceScopedQuery;
use crate::domain::results::WorkspacePayload;
use crate::error::WorkspaceError;

#[async_trait::async_trait]
pub trait WorkspaceRepository: Send + Sync {
    async fn find_workspace_by_id(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
    ) -> Result<Option<WorkspacePayload>, WorkspaceError>;
    /// List workspaces with SQL-pushed `LIMIT`/`OFFSET` and a parallel
    /// `COUNT(*)` for the total. Aligns with `PAGINATION_SPEC.md` sections 2
    /// and 5: no in-memory pagination and mandatory store-layer push-down.
    async fn list_workspaces(
        &self,
        ctx: &WorkspaceContext,
        query: &WorkspaceScopedQuery,
    ) -> Result<(Vec<WorkspacePayload>, usize), WorkspaceError>;
    async fn create_workspace(
        &self,
        ctx: &WorkspaceContext,
        req: &CreateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError>;
    async fn update_workspace(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
        req: &UpdateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError>;
    async fn delete_workspace(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
        expected_version: i64,
    ) -> Result<(), WorkspaceError>;
    async fn ensure_workspace_access(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError>;
}
