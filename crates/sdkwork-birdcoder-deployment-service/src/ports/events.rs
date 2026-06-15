use crate::error::DeploymentError;

#[async_trait::async_trait]
pub trait DeploymentEventPublisher: Send + Sync {
    async fn publish_deployment_created(&self, deployment_id: &str) -> Result<(), DeploymentError>;
    async fn publish_deployment_status_changed(&self, deployment_id: &str, status: &str) -> Result<(), DeploymentError>;
    async fn publish_release_created(&self, release_id: &str) -> Result<(), DeploymentError>;
    async fn publish_audit_event(&self, scope_type: &str, scope_id: &str, event_type: &str) -> Result<(), DeploymentError>;
}
