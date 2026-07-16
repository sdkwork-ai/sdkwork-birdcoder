use crate::context::WorkspaceContext;
use crate::error::WorkspaceError;

#[async_trait::async_trait]
pub trait WorkspaceEventPublisher: Send + Sync {
    async fn publish_workspace_created(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError>;
    async fn publish_workspace_updated(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError>;
    async fn publish_workspace_deleted(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError>;
    async fn publish_workspace_member_added(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        user_id: &str,
    ) -> Result<(), WorkspaceError>;
    async fn publish_workspace_member_removed(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        user_id: &str,
    ) -> Result<(), WorkspaceError>;
}
