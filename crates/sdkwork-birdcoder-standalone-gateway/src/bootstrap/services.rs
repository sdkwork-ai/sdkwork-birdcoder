use std::fmt;
use std::sync::Arc;

use sdkwork_birdcoder_coding_sessions_service::service::coding_session_service::CodingSessionService;
use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;
use sdkwork_birdcoder_project_service::ports::project_workspace_root::ProjectWorkspaceRootResolver;
use sdkwork_birdcoder_project_service::service::project_runtime_location_service::ProjectRuntimeLocationService;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_project_service::service::project_workspace_binding_service::ProjectWorkspaceBindingService;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project_workspace_binding::SqliteProjectWorkspaceBindingRepository;
use sdkwork_birdcoder_workspace_service::service::team_service::TeamService;
use sdkwork_birdcoder_workspace_service::service::workspace_service::WorkspaceService;

use crate::bootstrap::adapters::{
    wire_code_engine_provider, wire_engine_validator, wire_project_execution_scope_resolver,
};
use crate::bootstrap::config::BirdServerConfig;
use crate::bootstrap::git_operations::wire_git_operations;
use crate::bootstrap::realtime_hub::{
    HubDeploymentEventPublisher, HubProjectEventPublisher, HubRealtimeEventPublisher,
    HubWorkspaceEventPublisher,
};
use crate::bootstrap::repositories::Repositories;
use crate::bootstrap::runner_isolation::ServerProjectWorkspaceRootResolver;
use crate::bootstrap::runtime_location::{
    wire_project_runtime_location_service, RuntimeLocationBootstrapError,
};
use sdkwork_routes_workspace_app_api::realtime_hub::RealtimeHubBootstrapError;
use sdkwork_routes_workspace_app_api::WorkspaceRealtimeHub;

#[derive(Clone)]
pub struct Services {
    pub coding_session: CodingSessionService,
    pub workspace: WorkspaceService,
    pub project: ProjectService,
    pub runtime_location: ProjectRuntimeLocationService,
    pub workspace_binding: ProjectWorkspaceBindingService,
    pub deployment: DeploymentService,
    pub team: TeamService,
    pub realtime_hub: WorkspaceRealtimeHub,
}

pub async fn wire_services(
    repos: &Repositories,
    config: &BirdServerConfig,
) -> Result<Services, ServicesBootstrapError> {
    let realtime_hub = WorkspaceRealtimeHub::bootstrap().await?;
    let workspace = WorkspaceService::new(
        repos.workspace.clone(),
        Arc::new(HubWorkspaceEventPublisher::new(realtime_hub.clone())),
    );

    let project_workspace_root_resolver: Arc<dyn ProjectWorkspaceRootResolver> = Arc::new(
        ServerProjectWorkspaceRootResolver::new(config.provider_runner_root()),
    );
    let runtime_location = wire_project_runtime_location_service(
        config,
        repos.any_pool.clone(),
        repos.project.clone(),
        project_workspace_root_resolver.clone(),
    )?;
    let project = ProjectService::new(
        repos.project.clone(),
        Arc::new(HubProjectEventPublisher::new(realtime_hub.clone())),
        wire_git_operations(),
        project_workspace_root_resolver,
        Arc::new(runtime_location.clone()),
    );
    let workspace_binding = ProjectWorkspaceBindingService::new(
        repos.project.clone(),
        Arc::new(SqliteProjectWorkspaceBindingRepository::new(
            repos.any_pool.clone(),
        )),
    );

    let coding_session = CodingSessionService::new(
        repos.coding_session.clone(),
        wire_code_engine_provider(config),
        Arc::new(HubRealtimeEventPublisher::new(realtime_hub.clone())),
        wire_engine_validator(config),
        wire_project_execution_scope_resolver(Arc::new(project.clone())),
    );

    let deployment = DeploymentService::new(
        repos.deployment.clone(),
        Arc::new(HubDeploymentEventPublisher::new(realtime_hub.clone())),
    );

    let team = TeamService::new(repos.team.clone(), repos.workspace.clone());

    Ok(Services {
        coding_session,
        workspace,
        project,
        runtime_location,
        workspace_binding,
        deployment,
        team,
        realtime_hub,
    })
}

#[derive(Debug)]
pub enum ServicesBootstrapError {
    Realtime(RealtimeHubBootstrapError),
    RuntimeLocation(RuntimeLocationBootstrapError),
}

impl From<RealtimeHubBootstrapError> for ServicesBootstrapError {
    fn from(value: RealtimeHubBootstrapError) -> Self {
        Self::Realtime(value)
    }
}

impl From<RuntimeLocationBootstrapError> for ServicesBootstrapError {
    fn from(value: RuntimeLocationBootstrapError) -> Self {
        Self::RuntimeLocation(value)
    }
}

impl fmt::Display for ServicesBootstrapError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Realtime(error) => {
                write!(formatter, "workspace realtime bootstrap failed: {error}")
            }
            Self::RuntimeLocation(error) => write!(
                formatter,
                "project runtime-location bootstrap failed: {error}"
            ),
        }
    }
}

impl std::error::Error for ServicesBootstrapError {}
