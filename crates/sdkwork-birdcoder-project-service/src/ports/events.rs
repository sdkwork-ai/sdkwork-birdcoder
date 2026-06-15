use crate::error::ProjectError;

#[async_trait::async_trait]
pub trait ProjectEventPublisher: Send + Sync {
    async fn publish_project_created(&self, project_id: &str) -> Result<(), ProjectError>;
    async fn publish_project_updated(&self, project_id: &str) -> Result<(), ProjectError>;
    async fn publish_project_deleted(&self, project_id: &str) -> Result<(), ProjectError>;
    async fn publish_project_collaborator_added(&self, project_id: &str, user_id: &str) -> Result<(), ProjectError>;
    async fn publish_project_collaborator_removed(&self, project_id: &str, user_id: &str) -> Result<(), ProjectError>;
}
