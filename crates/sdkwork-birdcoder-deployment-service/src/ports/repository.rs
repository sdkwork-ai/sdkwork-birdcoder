use crate::context::DeploymentContext;
use crate::domain::results::{AuditPayload, DeploymentPayload, DeploymentTargetPayload, PolicyPayload, ReleasePayload};
use crate::error::DeploymentError;

#[async_trait::async_trait]
pub trait DeploymentRepository: Send + Sync {
    async fn find_deployment_by_id(&self, ctx: &DeploymentContext, id: &str) -> Result<Option<DeploymentPayload>, DeploymentError>;
    /// List deployments with SQL-pushed `LIMIT`/`OFFSET` and a parallel
    /// `COUNT(*)` for the total. Aligns with `PAGINATION_SPEC.md` §2/§5.
    async fn list_deployments(
        &self,
        ctx: &DeploymentContext,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentPayload>, usize), DeploymentError>;
    async fn list_deployments_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentPayload>, usize), DeploymentError>;
    async fn find_deployment_target_by_id(&self, ctx: &DeploymentContext, id: &str) -> Result<Option<DeploymentTargetPayload>, DeploymentError>;
    async fn list_deployment_targets(
        &self,
        ctx: &DeploymentContext,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentTargetPayload>, usize), DeploymentError>;
    async fn list_deployment_targets_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentTargetPayload>, usize), DeploymentError>;
    async fn find_release_by_id(&self, ctx: &DeploymentContext, id: &str) -> Result<Option<ReleasePayload>, DeploymentError>;
    async fn list_releases(
        &self,
        ctx: &DeploymentContext,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ReleasePayload>, usize), DeploymentError>;
    async fn list_releases_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ReleasePayload>, usize), DeploymentError>;
    async fn list_audit_logs(
        &self,
        ctx: &DeploymentContext,
        scope_type: &str,
        scope_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<AuditPayload>, usize), DeploymentError>;
    async fn list_policies(
        &self,
        ctx: &DeploymentContext,
        scope_type: &str,
        scope_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<PolicyPayload>, usize), DeploymentError>;
    async fn create_deployment_target(&self, ctx: &DeploymentContext, target: &DeploymentTargetPayload) -> Result<(), DeploymentError>;
    async fn create_release(&self, ctx: &DeploymentContext, release: &ReleasePayload) -> Result<(), DeploymentError>;
    async fn create_deployment(&self, ctx: &DeploymentContext, deployment: &DeploymentPayload) -> Result<(), DeploymentError>;
    async fn create_audit_event(&self, ctx: &DeploymentContext, audit: &AuditPayload) -> Result<(), DeploymentError>;
}
