use std::sync::Arc;

use sdkwork_birdcoder_coding_sessions_service::service::coding_session_service::CodingSessionService;
use sdkwork_birdcoder_deployment_service::service::deployment_service::DeploymentService;
use sdkwork_birdcoder_project_service::ports::project_workspace_root::ProjectWorkspaceRootResolver;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_workspace_service::service::team_service::TeamService;
use sdkwork_birdcoder_workspace_service::service::workspace_service::WorkspaceService;

use crate::bootstrap::adapters::{wire_code_engine_provider, wire_engine_validator};
use crate::bootstrap::config::BirdServerConfig;
use crate::bootstrap::git_operations::wire_git_operations;
use crate::bootstrap::realtime_hub::{
    HubDeploymentEventPublisher, HubProjectEventPublisher, HubRealtimeEventPublisher,
    HubWorkspaceEventPublisher,
};
use crate::bootstrap::repositories::Repositories;
use crate::bootstrap::runner_isolation::ServerProjectWorkspaceRootResolver;
use sdkwork_routes_workspace_app_api::realtime_hub::RealtimeHubBootstrapError;
use sdkwork_routes_workspace_app_api::WorkspaceRealtimeHub;

#[derive(Clone)]
pub struct Services {
    pub coding_session: CodingSessionService,
    pub workspace: WorkspaceService,
    pub project: ProjectService,
    pub deployment: DeploymentService,
    pub team: TeamService,
    pub realtime_hub: WorkspaceRealtimeHub,
}

pub async fn wire_services(
    repos: &Repositories,
    config: &BirdServerConfig,
) -> Result<Services, RealtimeHubBootstrapError> {
    let realtime_hub = WorkspaceRealtimeHub::bootstrap().await?;
    let coding_session = CodingSessionService::new(
        repos.coding_session.clone(),
        wire_code_engine_provider(config),
        Arc::new(HubRealtimeEventPublisher::new(realtime_hub.clone())),
        wire_engine_validator(config),
    )
    .with_default_working_directory(config.project_root.clone());

    let workspace = WorkspaceService::new(
        repos.workspace.clone(),
        Arc::new(HubWorkspaceEventPublisher::new(realtime_hub.clone())),
    );

    let project_workspace_root_resolver: Arc<dyn ProjectWorkspaceRootResolver> = Arc::new(
        ServerProjectWorkspaceRootResolver::new(config.provider_runner_root()),
    );
    let project = ProjectService::new(
        repos.project.clone(),
        Arc::new(HubProjectEventPublisher::new(realtime_hub.clone())),
        wire_git_operations(),
        project_workspace_root_resolver,
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
        deployment,
        team,
        realtime_hub,
    })
}
