use crate::context::ProjectContext;
use crate::error::ProjectError;

#[async_trait::async_trait]
pub trait ProjectEventPublisher: Send + Sync {
    async fn publish_project_created(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError>;
    async fn publish_project_updated(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError>;
    async fn publish_project_deleted(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<(), ProjectError>;
    async fn publish_project_collaborator_added(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
        user_id: &str,
    ) -> Result<(), ProjectError>;
    async fn publish_project_collaborator_removed(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
        user_id: &str,
    ) -> Result<(), ProjectError>;
}
