use crate::error::ProjectError;

#[async_trait::async_trait]
pub trait ProjectEventPublisher: Send + Sync {
    async fn publish_project_created(
        &self,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError>;
    async fn publish_project_updated(
        &self,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError>;
    async fn publish_project_deleted(
        &self,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError>;
    async fn publish_project_collaborator_added(
        &self,
        workspace_id: &str,
        project_id: &str,
        user_id: &str,
    ) -> Result<(), ProjectError>;
    async fn publish_project_collaborator_removed(
        &self,
        workspace_id: &str,
        project_id: &str,
        user_id: &str,
    ) -> Result<(), ProjectError>;
}
