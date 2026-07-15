use std::sync::Arc;

use sdkwork_utils_rust::is_blank;

use crate::context::DeploymentContext;
use crate::domain::commands::PublishProjectCommand;
use crate::domain::results::{
    AuditPayload, DeploymentPayload, DeploymentTargetPayload, PolicyPayload,
    PublishProjectResultPayload, ReleasePayload,
};
use crate::error::DeploymentError;
use crate::ports::events::DeploymentEventPublisher;
use crate::ports::repository::DeploymentRepository;

#[derive(Clone)]
pub struct DeploymentService {
    repository: Arc<dyn DeploymentRepository>,
}

impl DeploymentService {
    pub fn new(
        repository: Arc<dyn DeploymentRepository>,
        _event_publisher: Arc<dyn DeploymentEventPublisher>,
    ) -> Self {
        Self { repository }
    }

    pub async fn list_deployments(
        &self,
        ctx: &DeploymentContext,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentPayload>, usize), DeploymentError> {
        self.repository.list_deployments(ctx, offset, limit).await
    }

    pub async fn list_deployments_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentPayload>, usize), DeploymentError> {
        self.repository
            .list_deployments_by_project(ctx, project_id, offset, limit)
            .await
    }

    pub async fn list_deployment_targets(
        &self,
        ctx: &DeploymentContext,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentTargetPayload>, usize), DeploymentError> {
        self.repository
            .list_deployment_targets(ctx, offset, limit)
            .await
    }

    pub async fn list_deployment_targets_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentTargetPayload>, usize), DeploymentError> {
        self.repository
            .list_deployment_targets_by_project(ctx, project_id, offset, limit)
            .await
    }

    pub async fn list_releases(
        &self,
        ctx: &DeploymentContext,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ReleasePayload>, usize), DeploymentError> {
        self.repository.list_releases(ctx, offset, limit).await
    }

    pub async fn list_audit_logs(
        &self,
        ctx: &DeploymentContext,
        scope_type: &str,
        scope_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<AuditPayload>, usize), DeploymentError> {
        self.repository
            .list_audit_logs(ctx, scope_type, scope_id, offset, limit)
            .await
    }

    pub async fn list_policies(
        &self,
        ctx: &DeploymentContext,
        scope_type: &str,
        scope_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<PolicyPayload>, usize), DeploymentError> {
        self.repository
            .list_policies(ctx, scope_type, scope_id, offset, limit)
            .await
    }

    pub async fn publish_project(
        &self,
        _ctx: &DeploymentContext,
        command: &PublishProjectCommand,
    ) -> Result<PublishProjectResultPayload, DeploymentError> {
        Self::publish_unavailable(command.project_id.as_str())
    }

    fn publish_unavailable(
        project_id: &str,
    ) -> Result<PublishProjectResultPayload, DeploymentError> {
        if is_blank(Some(project_id)) {
            return Err(DeploymentError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }

        Err(DeploymentError::Unavailable(
            "Project deployment execution is unavailable until a verified isolated deployment executor is configured."
                .to_owned(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::DeploymentService;
    use crate::error::DeploymentError;

    #[test]
    fn project_publish_is_rejected_before_any_deployment_side_effect() {
        assert!(matches!(
            DeploymentService::publish_unavailable("project-1"),
            Err(DeploymentError::Unavailable(_))
        ));
    }

    #[test]
    fn project_publish_keeps_request_validation_before_availability_check() {
        assert!(matches!(
            DeploymentService::publish_unavailable("  "),
            Err(DeploymentError::InvalidInput(_))
        ));
    }
}
