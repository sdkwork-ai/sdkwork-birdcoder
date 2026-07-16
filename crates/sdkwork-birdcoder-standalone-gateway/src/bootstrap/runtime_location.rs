use std::fmt;
use std::sync::Arc;

use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::project_workspace_root::ProjectWorkspaceRootResolver;
use sdkwork_birdcoder_project_service::ports::repository::ProjectRepository;
use sdkwork_birdcoder_project_service::ports::runtime_location_execution::DenyRuntimeLocationTargetExecutionAuthority;
use sdkwork_birdcoder_project_service::ports::runtime_location_path_cipher::AesGcmRuntimeLocationPathCipher;
use sdkwork_birdcoder_project_service::ports::runtime_location_verification::{
    DenyRuntimeLocationVerificationAuthority, DenyRuntimeLocationVerificationRequestDispatcher,
};
use sdkwork_birdcoder_project_service::service::project_runtime_location_service::ProjectRuntimeLocationService;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project_runtime_location::SqliteProjectRuntimeLocationRepository;
use sqlx::AnyPool;

use crate::bootstrap::config::{BirdServerConfig, BirdServerConfigError};

/// Constructs the durable runtime-location application service without adding
/// any route ownership. Services/router composition injects the returned
/// instance into WorkspaceAppState.
pub fn wire_project_runtime_location_service(
    config: &BirdServerConfig,
    any_pool: AnyPool,
    project_repository: Arc<dyn ProjectRepository>,
    workspace_root_resolver: Arc<dyn ProjectWorkspaceRootResolver>,
) -> Result<ProjectRuntimeLocationService, RuntimeLocationBootstrapError> {
    let encryption = config.runtime_location_path_encryption_config()?;
    let cipher = AesGcmRuntimeLocationPathCipher::new(encryption.master_key, encryption.key_id)
        .map_err(RuntimeLocationBootstrapError::Cipher)?;

    Ok(ProjectRuntimeLocationService::new(
        project_repository,
        Arc::new(SqliteProjectRuntimeLocationRepository::new(any_pool)),
        Arc::new(cipher),
        // There is deliberately no implicit trust path for a client-asserted
        // desktop/runtime-node target. A mutually authenticated enrollment
        // adapter must replace these deny defaults before remote execution.
        Arc::new(DenyRuntimeLocationVerificationAuthority),
        Arc::new(DenyRuntimeLocationVerificationRequestDispatcher),
        workspace_root_resolver,
        Arc::new(DenyRuntimeLocationTargetExecutionAuthority),
    ))
}

#[derive(Debug)]
pub enum RuntimeLocationBootstrapError {
    Config(BirdServerConfigError),
    Cipher(ProjectError),
}

impl From<BirdServerConfigError> for RuntimeLocationBootstrapError {
    fn from(value: BirdServerConfigError) -> Self {
        Self::Config(value)
    }
}

impl fmt::Display for RuntimeLocationBootstrapError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Config(error) => {
                write!(formatter, "runtime-location configuration failed: {error}")
            }
            Self::Cipher(_) => write!(
                formatter,
                "runtime-location encryption could not be initialized from deployment secrets"
            ),
        }
    }
}

impl std::error::Error for RuntimeLocationBootstrapError {}
