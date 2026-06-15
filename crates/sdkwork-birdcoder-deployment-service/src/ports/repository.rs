use crate::context::SessionContext;
use crate::domain::results::{AuditPayload, DeploymentPayload, DeploymentTargetPayload, PolicyPayload, ReleasePayload};
use crate::error::DeploymentError;

#[async_trait::async_trait]
pub trait DeploymentRepository: Send + Sync {
    async fn find_deployment_by_id(&self, ctx: &SessionContext, id: &str) -> Result<Option<DeploymentPayload>, DeploymentError>;
    async fn list_deployments(&self, ctx: &SessionContext) -> Result<Vec<DeploymentPayload>, DeploymentError>;
    async fn list_deployments_by_project(&self, ctx: &SessionContext, project_id: &str) -> Result<Vec<DeploymentPayload>, DeploymentError>;
    async fn find_deployment_target_by_id(&self, ctx: &SessionContext, id: &str) -> Result<Option<DeploymentTargetPayload>, DeploymentError>;
    async fn list_deployment_targets(&self, ctx: &SessionContext) -> Result<Vec<DeploymentTargetPayload>, DeploymentError>;
    async fn list_deployment_targets_by_project(&self, ctx: &SessionContext, project_id: &str) -> Result<Vec<DeploymentTargetPayload>, DeploymentError>;
    async fn find_release_by_id(&self, ctx: &SessionContext, id: &str) -> Result<Option<ReleasePayload>, DeploymentError>;
    async fn list_releases(&self, ctx: &SessionContext) -> Result<Vec<ReleasePayload>, DeploymentError>;
    async fn list_releases_by_project(&self, ctx: &SessionContext, project_id: &str) -> Result<Vec<ReleasePayload>, DeploymentError>;
    async fn list_audit_logs(&self, ctx: &SessionContext, scope_type: &str, scope_id: &str) -> Result<Vec<AuditPayload>, DeploymentError>;
    async fn list_policies(&self, ctx: &SessionContext, scope_type: &str, scope_id: &str) -> Result<Vec<PolicyPayload>, DeploymentError>;
    async fn create_deployment_target(&self, ctx: &SessionContext, target: &DeploymentTargetPayload) -> Result<(), DeploymentError>;
    async fn create_release(&self, ctx: &SessionContext, release: &ReleasePayload) -> Result<(), DeploymentError>;
    async fn create_deployment(&self, ctx: &SessionContext, deployment: &DeploymentPayload) -> Result<(), DeploymentError>;
    async fn create_audit_event(&self, ctx: &SessionContext, audit: &AuditPayload) -> Result<(), DeploymentError>;
}
