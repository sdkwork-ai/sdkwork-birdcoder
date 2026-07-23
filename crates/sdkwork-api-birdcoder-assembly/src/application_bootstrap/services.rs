use std::fmt;
use std::sync::Arc;

use sdkwork_birdcoder_project_service::service::project_document_binding_service::ProjectDocumentBindingService;
use sdkwork_birdcoder_project_service::service::project_runtime_location_service::ProjectRuntimeLocationService;
use sdkwork_birdcoder_project_service::service::project_sandbox_binding_service::ProjectSandboxBindingService;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_workspace_service::service::workspace_service::WorkspaceService;

use crate::bootstrap::config::BirdServerConfig;
use crate::bootstrap::git_operations::wire_git_operations;
use crate::bootstrap::repositories::Repositories;
use crate::bootstrap::runtime_location::{
    wire_project_runtime_location_service, RuntimeLocationBootstrapError,
};

#[derive(Clone)]
pub struct Services {
    pub workspace: WorkspaceService,
    pub project: ProjectService,
    pub document_binding: ProjectDocumentBindingService,
    pub runtime_location: ProjectRuntimeLocationService,
    pub sandbox_binding: ProjectSandboxBindingService,
}

pub async fn wire_services(
    repos: &Repositories,
    config: &BirdServerConfig,
) -> Result<Services, ServicesBootstrapError> {
    let workspace = WorkspaceService::new(repos.workspace.clone());

    let runtime_location = wire_project_runtime_location_service(
        config,
        repos.project.clone(),
        repos.runtime_location.clone(),
    )?;
    let project = ProjectService::new(
        repos.project.clone(),
        wire_git_operations(),
        Arc::new(runtime_location.clone()),
    );
    let document_binding = ProjectDocumentBindingService::new(
        repos.project.clone(),
        repos.document_binding.clone(),
    );
    let sandbox_binding = ProjectSandboxBindingService::new(
        repos.project.clone(),
        repos.sandbox_binding.clone(),
    );

    Ok(Services {
        workspace,
        project,
        document_binding,
        runtime_location,
        sandbox_binding,
    })
}

#[derive(Debug)]
pub enum ServicesBootstrapError {
    RuntimeLocation(RuntimeLocationBootstrapError),
}

impl From<RuntimeLocationBootstrapError> for ServicesBootstrapError {
    fn from(value: RuntimeLocationBootstrapError) -> Self {
        Self::RuntimeLocation(value)
    }
}

impl fmt::Display for ServicesBootstrapError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RuntimeLocation(error) => write!(
                formatter,
                "project runtime-location bootstrap failed: {error}"
            ),
        }
    }
}

impl std::error::Error for ServicesBootstrapError {}
