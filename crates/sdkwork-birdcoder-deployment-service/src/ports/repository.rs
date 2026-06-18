use crate::context::DeploymentContext;
use crate::domain::results::{AuditPayload, DeploymentPayload, DeploymentTargetPayload, PolicyPayload, ReleasePayload};
use crate::error::DeploymentError;

#[async_trait::async_trait]
pub trait DeploymentRepository: Send + Sync {
    async fn find_deployment_by_id(&self, ctx: &DeploymentContext, id: &str) -> Result<Option<DeploymentPayload>, DeploymentError>;
    async fn list_deployments(&self, ctx: &DeploymentContext) -> Result<Vec<DeploymentPayload>, DeploymentError>;
    async fn list_deployments_by_project(&self, ctx: &DeploymentContext, project_id: &str) -> Result<Vec<DeploymentPayload>, DeploymentError>;
    async fn find_deployment_target_by_id(&self, ctx: &DeploymentContext, id: &str) -> Result<Option<DeploymentTargetPayload>, DeploymentError>;
    async fn list_deployment_targets(&self, ctx: &DeploymentContext) -> Result<Vec<DeploymentTargetPayload>, DeploymentError>;
    async fn list_deployment_targets_by_project(&self, ctx: &DeploymentContext, project_id: &str) -> Result<Vec<DeploymentTargetPayload>, DeploymentError>;
    async fn find_release_by_id(&self, ctx: &DeploymentContext, id: &str) -> Result<Option<ReleasePayload>, DeploymentError>;
    async fn list_releases(&self, ctx: &DeploymentContext) -> Result<Vec<ReleasePayload>, DeploymentError>;
    async fn list_releases_by_project(&self, ctx: &DeploymentContext, project_id: &str) -> Result<Vec<ReleasePayload>, DeploymentError>;
    async fn list_audit_logs(&self, ctx: &DeploymentContext, scope_type: &str, scope_id: &str) -> Result<Vec<AuditPayload>, DeploymentError>;
    async fn list_policies(&self, ctx: &DeploymentContext, scope_type: &str, scope_id: &str) -> Result<Vec<PolicyPayload>, DeploymentError>;
    async fn create_deployment_target(&self, ctx: &DeploymentContext, target: &DeploymentTargetPayload) -> Result<(), DeploymentError>;
    async fn create_release(&self, ctx: &DeploymentContext, release: &ReleasePayload) -> Result<(), DeploymentError>;
    async fn create_deployment(&self, ctx: &DeploymentContext, deployment: &DeploymentPayload) -> Result<(), DeploymentError>;
    async fn create_audit_event(&self, ctx: &DeploymentContext, audit: &AuditPayload) -> Result<(), DeploymentError>;
}
