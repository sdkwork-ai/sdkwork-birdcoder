use std::sync::Arc;

use sdkwork_birdcoder_coding_sessions_service::service::coding_session_service::CodingSessionService;
use sdkwork_birdcoder_workspace_service::service::workspace_service::WorkspaceService;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;

use crate::bootstrap::adapters::{wire_code_engine_provider, wire_engine_validator};
use crate::bootstrap::config::BirdServerConfig;
use crate::bootstrap::repositories::Repositories;

#[derive(Clone)]
pub struct Services {
    pub coding_session: CodingSessionService,
    pub workspace: WorkspaceService,
    pub project: ProjectService,
    pub deployment: DeploymentService,
}

pub fn wire_services(repos: &Repositories, config: &BirdServerConfig) -> Services {
    let coding_session = CodingSessionService::new(
        repos.coding_session.clone(),
        wire_code_engine_provider(config),
        Arc::new(NoopRealtimeEventPublisher),
        wire_engine_validator(),
    )
    .with_default_working_directory(config.project_root.clone());

    let workspace = WorkspaceService::new(
        repos.workspace.clone(),
        Arc::new(NoopWorkspaceEventPublisher),
    );

    let project = ProjectService::new(
        repos.project.clone(),
        Arc::new(NoopProjectEventPublisher),
        Arc::new(NoopGitOperations),
    );

    let deployment = DeploymentService::new(
        repos.deployment.clone(),
        Arc::new(NoopDeploymentEventPublisher),
    );

    Services {
        coding_session,
        workspace,
        project,
        deployment,
    }
}

// ── Noop port implementations ────────────────────────────────────────

struct NoopRealtimeEventPublisher;

#[async_trait::async_trait]
impl sdkwork_birdcoder_coding_sessions_service::ports::events::RealtimeEventPublisher
    for NoopRealtimeEventPublisher
{
    async fn publish_workspace_event(
        &self,
        _ctx: &sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext,
        _workspace_id: &str,
        _event_kind: &str,
        _payload_json: &str,
    ) -> Result<(), sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError> {
        Ok(())
    }

    async fn publish_coding_session_event(
        &self,
        _ctx: &sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext,
        _event: &sdkwork_birdcoder_coding_sessions_service::ports::events::CodingSessionRealtimeEventInput,
    ) -> Result<(), sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError> {
        Ok(())
    }
}

struct NoopWorkspaceEventPublisher;

#[async_trait::async_trait]
impl sdkwork_birdcoder_workspace_service::ports::events::WorkspaceEventPublisher
    for NoopWorkspaceEventPublisher
{
    async fn publish_workspace_created(&self, _workspace_id: &str) -> Result<(), sdkwork_birdcoder_workspace_service::error::WorkspaceError> {
        Ok(())
    }
    async fn publish_workspace_updated(&self, _workspace_id: &str) -> Result<(), sdkwork_birdcoder_workspace_service::error::WorkspaceError> {
        Ok(())
    }
    async fn publish_workspace_deleted(&self, _workspace_id: &str) -> Result<(), sdkwork_birdcoder_workspace_service::error::WorkspaceError> {
        Ok(())
    }
    async fn publish_workspace_member_added(&self, _workspace_id: &str, _user_id: &str) -> Result<(), sdkwork_birdcoder_workspace_service::error::WorkspaceError> {
        Ok(())
    }
    async fn publish_workspace_member_removed(&self, _workspace_id: &str, _user_id: &str) -> Result<(), sdkwork_birdcoder_workspace_service::error::WorkspaceError> {
        Ok(())
    }
}

struct NoopProjectEventPublisher;

#[async_trait::async_trait]
impl sdkwork_birdcoder_project_service::ports::events::ProjectEventPublisher
    for NoopProjectEventPublisher
{
    async fn publish_project_created(&self, _project_id: &str) -> Result<(), sdkwork_birdcoder_project_service::error::ProjectError> {
        Ok(())
    }
    async fn publish_project_updated(&self, _project_id: &str) -> Result<(), sdkwork_birdcoder_project_service::error::ProjectError> {
        Ok(())
    }
    async fn publish_project_deleted(&self, _project_id: &str) -> Result<(), sdkwork_birdcoder_project_service::error::ProjectError> {
        Ok(())
    }
    async fn publish_project_collaborator_added(&self, _project_id: &str, _user_id: &str) -> Result<(), sdkwork_birdcoder_project_service::error::ProjectError> {
        Ok(())
    }
    async fn publish_project_collaborator_removed(&self, _project_id: &str, _user_id: &str) -> Result<(), sdkwork_birdcoder_project_service::error::ProjectError> {
        Ok(())
    }
}

struct NoopGitOperations;

#[async_trait::async_trait]
impl sdkwork_birdcoder_project_service::ports::git::GitOperations for NoopGitOperations {
    async fn inspect_overview(
        &self,
        _project_root_path: &str,
    ) -> Result<sdkwork_birdcoder_project_service::ports::git::GitProjectOverview, sdkwork_birdcoder_project_service::ports::git::GitMutationError> {
        Ok(sdkwork_birdcoder_project_service::ports::git::GitProjectOverview {
            branches: vec![],
            current_branch: None,
            current_revision: None,
            current_worktree_path: None,
            detached_head: false,
            repository_root_path: None,
            status: sdkwork_birdcoder_project_service::ports::git::GitOverviewStatus::NotRepository,
            status_counts: sdkwork_birdcoder_project_service::ports::git::GitStatusCounts {
                staged: 0,
                unstaged: 0,
                untracked: 0,
            },
            worktrees: vec![],
        })
    }

    async fn create_branch(&self, _path: &str, _name: &str) -> Result<sdkwork_birdcoder_project_service::ports::git::GitProjectOverview, sdkwork_birdcoder_project_service::ports::git::GitMutationError> {
        Err(sdkwork_birdcoder_project_service::ports::git::GitMutationError::NotRepository)
    }
    async fn switch_branch(&self, _path: &str, _name: &str) -> Result<sdkwork_birdcoder_project_service::ports::git::GitProjectOverview, sdkwork_birdcoder_project_service::ports::git::GitMutationError> {
        Err(sdkwork_birdcoder_project_service::ports::git::GitMutationError::NotRepository)
    }
    async fn commit_changes(&self, _path: &str, _msg: &str) -> Result<sdkwork_birdcoder_project_service::ports::git::GitProjectOverview, sdkwork_birdcoder_project_service::ports::git::GitMutationError> {
        Err(sdkwork_birdcoder_project_service::ports::git::GitMutationError::NotRepository)
    }
    async fn push_branch(&self, _path: &str, _branch: Option<&str>, _remote: Option<&str>) -> Result<sdkwork_birdcoder_project_service::ports::git::GitProjectOverview, sdkwork_birdcoder_project_service::ports::git::GitMutationError> {
        Err(sdkwork_birdcoder_project_service::ports::git::GitMutationError::NotRepository)
    }
    async fn create_worktree(&self, _path: &str, _branch: &str, _worktree: &str) -> Result<sdkwork_birdcoder_project_service::ports::git::GitProjectOverview, sdkwork_birdcoder_project_service::ports::git::GitMutationError> {
        Err(sdkwork_birdcoder_project_service::ports::git::GitMutationError::NotRepository)
    }
    async fn remove_worktree(&self, _path: &str, _worktree: &str, _force: bool) -> Result<sdkwork_birdcoder_project_service::ports::git::GitProjectOverview, sdkwork_birdcoder_project_service::ports::git::GitMutationError> {
        Err(sdkwork_birdcoder_project_service::ports::git::GitMutationError::NotRepository)
    }
    async fn prune_worktrees(&self, _path: &str) -> Result<sdkwork_birdcoder_project_service::ports::git::GitProjectOverview, sdkwork_birdcoder_project_service::ports::git::GitMutationError> {
        Err(sdkwork_birdcoder_project_service::ports::git::GitMutationError::NotRepository)
    }
}

struct NoopDeploymentEventPublisher;

#[async_trait::async_trait]
impl sdkwork_birdcoder_deployment_service::ports::events::DeploymentEventPublisher
    for NoopDeploymentEventPublisher
{
    async fn publish_deployment_created(&self, _deployment_id: &str) -> Result<(), sdkwork_birdcoder_deployment_service::error::DeploymentError> {
        Ok(())
    }
    async fn publish_deployment_status_changed(&self, _deployment_id: &str, _status: &str) -> Result<(), sdkwork_birdcoder_deployment_service::error::DeploymentError> {
        Ok(())
    }
    async fn publish_release_created(&self, _release_id: &str) -> Result<(), sdkwork_birdcoder_deployment_service::error::DeploymentError> {
        Ok(())
    }
    async fn publish_audit_event(&self, _scope_type: &str, _scope_id: &str, _event_type: &str) -> Result<(), sdkwork_birdcoder_deployment_service::error::DeploymentError> {
        Ok(())
    }
}
