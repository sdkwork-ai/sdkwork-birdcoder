use crate::context::DeploymentContext;
use crate::error::DeploymentError;

#[async_trait::async_trait]
pub trait DeploymentEventPublisher: Send + Sync {
    async fn publish_deployment_created(
        &self,
        ctx: &DeploymentContext,
        workspace_id: &str,
        project_id: &str,
        deployment_id: &str,
    ) -> Result<(), DeploymentError>;
    async fn publish_deployment_status_changed(
        &self,
        ctx: &DeploymentContext,
        workspace_id: &str,
        project_id: &str,
        deployment_id: &str,
        status: &str,
    ) -> Result<(), DeploymentError>;
    async fn publish_release_created(
        &self,
        ctx: &DeploymentContext,
        workspace_id: &str,
        project_id: &str,
        release_id: &str,
    ) -> Result<(), DeploymentError>;
    async fn publish_audit_event(
        &self,
        ctx: &DeploymentContext,
        workspace_id: &str,
        project_id: &str,
        scope_type: &str,
        scope_id: &str,
        event_type: &str,
    ) -> Result<(), DeploymentError>;
}
