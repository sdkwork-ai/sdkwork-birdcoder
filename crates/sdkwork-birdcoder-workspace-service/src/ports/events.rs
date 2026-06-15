use crate::error::WorkspaceError;

#[async_trait::async_trait]
pub trait WorkspaceEventPublisher: Send + Sync {
    async fn publish_workspace_created(&self, workspace_id: &str) -> Result<(), WorkspaceError>;
    async fn publish_workspace_updated(&self, workspace_id: &str) -> Result<(), WorkspaceError>;
    async fn publish_workspace_deleted(&self, workspace_id: &str) -> Result<(), WorkspaceError>;
    async fn publish_workspace_member_added(&self, workspace_id: &str, user_id: &str) -> Result<(), WorkspaceError>;
    async fn publish_workspace_member_removed(&self, workspace_id: &str, user_id: &str) -> Result<(), WorkspaceError>;
}
