use std::sync::Arc;

use sdkwork_birdcoder_coding_sessions_service::service::coding_session_service::CodingSessionService;
use sdkwork_birdcoder_workspace_service::service::workspace_service::WorkspaceService;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;

use crate::bootstrap::repositories::Repositories;

#[derive(Clone)]
pub struct Services {
    pub coding_session: CodingSessionService,
    pub workspace: WorkspaceService,
    pub project: ProjectService,
    pub deployment: DeploymentService,
}

pub fn wire_services(repos: &Repositories) -> Services {
    let coding_session = CodingSessionService::new(
        repos.coding_session.clone(),
        Arc::new(NoopCodeEngineProvider),
        Arc::new(NoopRealtimeEventPublisher),
        Arc::new(NoopEngineValidator),
    );

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

struct NoopCodeEngineProvider;

#[async_trait::async_trait]
impl sdkwork_birdcoder_coding_sessions_service::ports::provider::CodeEngineProvider
    for NoopCodeEngineProvider
{
    async fn execute_turn(
        &self,
        _ctx: &sdkwork_birdcoder_coding_sessions_service::context::SessionContext,
        _pending: &sdkwork_birdcoder_coding_sessions_service::domain::results::PendingProjectionTurnExecution,
    ) -> Result<
        sdkwork_birdcoder_coding_sessions_service::domain::results::FinalizedProjectionTurnExecution,
        sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError,
    > {
        Err(sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError::Repository(
            "code engine provider not wired".into(),
        ))
    }

    async fn submit_approval(
        &self,
        _ctx: &sdkwork_birdcoder_coding_sessions_service::context::SessionContext,
        _session_id: &str,
        _checkpoint_id: &str,
        _input: &sdkwork_birdcoder_coding_sessions_service::domain::commands::SubmitApprovalDecisionInput,
    ) -> Result<(), sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError> {
        Ok(())
    }

    async fn submit_question_answer(
        &self,
        _ctx: &sdkwork_birdcoder_coding_sessions_service::context::SessionContext,
        _session_id: &str,
        _question_id: &str,
        _input: &sdkwork_birdcoder_coding_sessions_service::domain::commands::SubmitUserQuestionAnswerInput,
    ) -> Result<(), sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError> {
        Ok(())
    }
}

struct NoopRealtimeEventPublisher;

#[async_trait::async_trait]
impl sdkwork_birdcoder_coding_sessions_service::ports::events::RealtimeEventPublisher
    for NoopRealtimeEventPublisher
{
    async fn publish_workspace_event(
        &self,
        _ctx: &sdkwork_birdcoder_coding_sessions_service::context::SessionContext,
        _workspace_id: &str,
        _event_kind: &str,
        _payload_json: &str,
    ) -> Result<(), sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError> {
        Ok(())
    }

    async fn publish_coding_session_event(
        &self,
        _ctx: &sdkwork_birdcoder_coding_sessions_service::context::SessionContext,
        _event: &sdkwork_birdcoder_coding_sessions_service::ports::events::CodingSessionRealtimeEventInput,
    ) -> Result<(), sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError> {
        Ok(())
    }
}

struct NoopEngineValidator;

#[async_trait::async_trait]
impl sdkwork_birdcoder_coding_sessions_service::ports::engine_validator::EngineValidator
    for NoopEngineValidator
{
    fn validate_engine_runtime_profile(
        &self,
        _engine_id: &str,
        _host_mode: &str,
    ) -> Result<
        sdkwork_birdcoder_coding_sessions_service::domain::models::AuthoritativeEngineRuntimeProfile,
        sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError,
    > {
        Ok(sdkwork_birdcoder_coding_sessions_service::domain::models::AuthoritativeEngineRuntimeProfile {
            transport_kind: "stdio".to_string(),
            capability_snapshot_json: "{}".to_string(),
        })
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

