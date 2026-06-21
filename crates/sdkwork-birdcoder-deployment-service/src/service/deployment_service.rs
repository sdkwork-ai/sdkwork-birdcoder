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
    event_publisher: Arc<dyn DeploymentEventPublisher>,
}

impl DeploymentService {
    pub fn new(
        repository: Arc<dyn DeploymentRepository>,
        event_publisher: Arc<dyn DeploymentEventPublisher>,
    ) -> Self {
        Self {
            repository,
            event_publisher,
        }
    }

    pub async fn list_deployments(
        &self,
        ctx: &DeploymentContext,
    ) -> Result<Vec<DeploymentPayload>, DeploymentError> {
        self.repository.list_deployments(ctx).await
    }

    pub async fn list_deployments_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
    ) -> Result<Vec<DeploymentPayload>, DeploymentError> {
        self.repository
            .list_deployments_by_project(ctx, project_id)
            .await
    }

    pub async fn list_deployment_targets(
        &self,
        ctx: &DeploymentContext,
    ) -> Result<Vec<DeploymentTargetPayload>, DeploymentError> {
        self.repository.list_deployment_targets(ctx).await
    }

    pub async fn list_deployment_targets_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
    ) -> Result<Vec<DeploymentTargetPayload>, DeploymentError> {
        self.repository
            .list_deployment_targets_by_project(ctx, project_id)
            .await
    }

    pub async fn list_releases(
        &self,
        ctx: &DeploymentContext,
    ) -> Result<Vec<ReleasePayload>, DeploymentError> {
        self.repository.list_releases(ctx).await
    }

    pub async fn list_audit_logs(
        &self,
        ctx: &DeploymentContext,
        scope_type: &str,
        scope_id: &str,
    ) -> Result<Vec<AuditPayload>, DeploymentError> {
        self.repository
            .list_audit_logs(ctx, scope_type, scope_id)
            .await
    }

    pub async fn list_policies(
        &self,
        ctx: &DeploymentContext,
        scope_type: &str,
        scope_id: &str,
    ) -> Result<Vec<PolicyPayload>, DeploymentError> {
        self.repository
            .list_policies(ctx, scope_type, scope_id)
            .await
    }

    pub async fn publish_project(
        &self,
        ctx: &DeploymentContext,
        command: &PublishProjectCommand,
    ) -> Result<PublishProjectResultPayload, DeploymentError> {
        if is_blank(Some(&command.project_id)) {
            return Err(DeploymentError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }

        let requested_target_id = command.request.target_id.as_deref().map(str::trim).filter(|s| !s.is_empty());
        let requested_environment_key = command
            .request
            .environment_key
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        let requested_runtime = command
            .request
            .runtime
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        let requested_release_kind = command
            .request
            .release_kind
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or("formal");
        let requested_endpoint_url = command
            .request
            .endpoint_url
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());
        let requested_target_name = command
            .request
            .target_name
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty());

        let active_targets = self
            .repository
            .list_deployment_targets_by_project(ctx, &command.project_id)
            .await?
            .into_iter()
            .filter(|target| target.status == "active")
            .collect::<Vec<_>>();

        let explicit_existing_target = if let Some(target_id) = requested_target_id {
            Some(
                active_targets
                    .iter()
                    .find(|target| target.id == target_id)
                    .cloned()
                    .ok_or_else(|| {
                        DeploymentError::NotFound(
                            "Deployment target was not found for the project.".to_owned(),
                        )
                    })?,
            )
        } else {
            None
        };

        let create_new_target = requested_target_id.is_none()
            && (requested_target_name.is_some()
                || requested_environment_key.is_some()
                || requested_runtime.is_some()
                || active_targets.is_empty());
        let fallback_existing_target = if create_new_target {
            None
        } else {
            active_targets.first().cloned()
        };

        let effective_environment_key = requested_environment_key
            .or(explicit_existing_target
                .as_ref()
                .map(|t| t.environment_key.as_str()))
            .or(fallback_existing_target
                .as_ref()
                .map(|t| t.environment_key.as_str()))
            .unwrap_or("prod")
            .to_owned();
        let effective_runtime = requested_runtime
            .or(explicit_existing_target
                .as_ref()
                .map(|t| t.runtime.as_str()))
            .or(fallback_existing_target
                .as_ref()
                .map(|t| t.runtime.as_str()))
            .unwrap_or("web")
            .to_owned();
        let effective_rollout_stage = command
            .request
            .rollout_stage
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .unwrap_or(&effective_environment_key)
            .to_owned();

        let canonical_tenant_id = command.project_tenant_id.clone();
        let canonical_organization_id = command.project_organization_id.clone();
        let now = crate::domain::results::current_timestamp();
        let release_version = command
            .request
            .release_version
            .as_deref()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| format!("v{}", now.replace(['-', ':', '.'], "").chars().take(14).collect::<String>()));

        let created_target = if create_new_target {
            Some(DeploymentTargetPayload {
                id: format!("target-{}", uuid::Uuid::new_v4()),
                uuid: Some(uuid::Uuid::new_v4().to_string()),
                tenant_id: Some(canonical_tenant_id.clone()),
                organization_id: canonical_organization_id.clone(),
                created_at: Some(now.clone()),
                updated_at: Some(now.clone()),
                project_id: command.project_id.clone(),
                name: requested_target_name
                    .map(str::to_owned)
                    .unwrap_or_else(|| {
                        format!(
                            "{}-{}-{}",
                            command.project_name, effective_environment_key, effective_runtime
                        )
                    }),
                environment_key: effective_environment_key.clone(),
                runtime: effective_runtime.clone(),
                status: "active".to_owned(),
            })
        } else {
            None
        };

        let target = created_target
            .clone()
            .or(explicit_existing_target)
            .or(fallback_existing_target)
            .ok_or_else(|| {
                DeploymentError::Internal(
                    "Failed to resolve a deployment target for the project.".to_owned(),
                )
            })?;

        let created_by_user_id = command
            .current_user_id
            .clone()
            .or_else(|| command.project_created_by_user_id.clone())
            .or_else(|| command.project_owner_id.clone())
            .unwrap_or_else(|| "system".to_owned());

        let release_manifest = serde_json::json!({
            "projectId": command.project_id,
            "projectName": command.project_name,
            "targetId": target.id,
            "targetName": target.name,
            "environmentKey": target.environment_key,
            "runtime": target.runtime,
            "releaseVersion": release_version,
            "releaseKind": requested_release_kind,
            "rolloutStage": effective_rollout_stage,
            "endpointUrl": requested_endpoint_url,
            "createdByUserId": created_by_user_id,
            "publishedAt": now,
        });

        let release_id = format!("release-{}", uuid::Uuid::new_v4());
        let release = ReleasePayload {
            id: release_id.clone(),
            uuid: Some(uuid::Uuid::new_v4().to_string()),
            tenant_id: Some(canonical_tenant_id.clone()),
            organization_id: canonical_organization_id.clone(),
            created_at: Some(now.clone()),
            updated_at: Some(now.clone()),
            release_version,
            release_kind: requested_release_kind.to_owned(),
            rollout_stage: effective_rollout_stage,
            manifest: Some(release_manifest.clone()),
            status: "ready".to_owned(),
        };

        let deployment_id = format!("deployment-{}", uuid::Uuid::new_v4());
        let deployment = DeploymentPayload {
            id: deployment_id.clone(),
            uuid: Some(uuid::Uuid::new_v4().to_string()),
            tenant_id: Some(canonical_tenant_id.clone()),
            organization_id: canonical_organization_id.clone(),
            created_at: Some(now.clone()),
            updated_at: Some(now.clone()),
            project_id: command.project_id.clone(),
            target_id: target.id.clone(),
            release_record_id: Some(release.id.clone()),
            status: "planned".to_owned(),
            endpoint_url: requested_endpoint_url.map(str::to_owned),
            started_at: Some(now.clone()),
            completed_at: None,
        };

        let audit_payload = serde_json::json!({
            "projectId": deployment.project_id,
            "deploymentId": deployment.id,
            "targetId": target.id,
            "releaseId": release.id,
            "releaseVersion": release.release_version,
            "status": deployment.status,
        });
        let audit = AuditPayload {
            id: format!("audit-{}", uuid::Uuid::new_v4()),
            uuid: Some(uuid::Uuid::new_v4().to_string()),
            tenant_id: Some(canonical_tenant_id),
            organization_id: canonical_organization_id,
            created_at: Some(now.clone()),
            updated_at: Some(now),
            scope_type: "project".to_owned(),
            scope_id: command.project_id.clone(),
            event_type: "project.publish.created".to_owned(),
            payload: audit_payload,
        };

        if let Some(target_to_create) = created_target.as_ref() {
            self.repository
                .create_deployment_target(ctx, target_to_create)
                .await?;
        }
        self.repository.create_release(ctx, &release).await?;
        self.repository.create_deployment(ctx, &deployment).await?;
        self.repository.create_audit_event(ctx, &audit).await?;

        self.event_publisher
            .publish_deployment_created(
                &command.workspace_id,
                &command.project_id,
                &deployment.id,
            )
            .await?;
        self.event_publisher
            .publish_release_created(
                &command.workspace_id,
                &command.project_id,
                &release.id,
            )
            .await?;
        self.event_publisher
            .publish_audit_event(
                &command.workspace_id,
                &command.project_id,
                "project",
                &command.project_id,
                "project.publish.created",
            )
            .await?;

        Ok(PublishProjectResultPayload {
            deployment,
            release,
            target,
        })
    }
}
