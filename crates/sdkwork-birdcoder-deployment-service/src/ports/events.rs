use crate::error::DeploymentError;

#[async_trait::async_trait]
pub trait DeploymentEventPublisher: Send + Sync {
    async fn publish_deployment_created(
        &self,
        workspace_id: &str,
        project_id: &str,
        deployment_id: &str,
    ) -> Result<(), DeploymentError>;
    async fn publish_deployment_status_changed(
        &self,
        workspace_id: &str,
        project_id: &str,
        deployment_id: &str,
        status: &str,
    ) -> Result<(), DeploymentError>;
    async fn publish_release_created(
        &self,
        workspace_id: &str,
        project_id: &str,
        release_id: &str,
    ) -> Result<(), DeploymentError>;
    async fn publish_audit_event(
        &self,
        workspace_id: &str,
        project_id: &str,
        scope_type: &str,
        scope_id: &str,
        event_type: &str,
    ) -> Result<(), DeploymentError>;
}
