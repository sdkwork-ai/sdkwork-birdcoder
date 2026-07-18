use std::sync::Arc;

use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::runtime_location::{
    RuntimeLocationCapability, LOCATION_KIND_SERVER_WORKSPACE, RUNTIME_TARGET_KIND_SERVER,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::runtime_location_execution::ProjectRuntimeLocationExecutionResolver;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_iam_context_service::PLATFORM_ORGANIZATION_ID;
use sdkwork_routes_terminal_app_api::project_execution::{
    ProjectTerminalExecutionError, ProjectTerminalExecutionRequest,
    ProjectTerminalExecutionResolver, ProjectTerminalExecutionTarget,
    ResolvedProjectTerminalExecution,
};

const BIRDCODER_TERMINAL_EXECUTION_AUTHORITY: &str = "sdkwork-birdcoder-project-runtime-location";

/// Adapts BirdCoder's authenticated, target-bound project location authority
/// to the generic terminal route port. The terminal crate never needs to know
/// about project persistence, encryption, or BirdCoder's target enrollment.
#[derive(Clone)]
pub struct BirdcoderProjectTerminalExecutionResolver {
    project_service: Arc<ProjectService>,
    runtime_location_execution_resolver: Arc<dyn ProjectRuntimeLocationExecutionResolver>,
}

pub fn wire_project_terminal_execution_resolver(
    project_service: Arc<ProjectService>,
    runtime_location_execution_resolver: Arc<dyn ProjectRuntimeLocationExecutionResolver>,
) -> Arc<dyn ProjectTerminalExecutionResolver> {
    Arc::new(BirdcoderProjectTerminalExecutionResolver {
        project_service,
        runtime_location_execution_resolver,
    })
}

#[async_trait::async_trait]
impl ProjectTerminalExecutionResolver for BirdcoderProjectTerminalExecutionResolver {
    async fn resolve_project_terminal_execution(
        &self,
        request: ProjectTerminalExecutionRequest,
    ) -> Result<ResolvedProjectTerminalExecution, ProjectTerminalExecutionError> {
        let context = ProjectContext {
            tenant_id: request.tenant_id,
            // A tenant-scoped request carries no organization claim. Match
            // the application route context by resolving that case to the
            // SDKWork platform organization rather than treating it as an
            // empty, unrelated organization scope.
            organization_id: request
                .organization_id
                .unwrap_or_else(|| PLATFORM_ORGANIZATION_ID.to_owned()),
            user_id: request.subject_id,
        };
        let project = self
            .project_service
            .require_project_execution_access(&context, &request.project_id)
            .await
            .map_err(map_project_terminal_execution_error)?;
        let execution = self
            .runtime_location_execution_resolver
            .resolve_execution_root(
                &context,
                &request.project_id,
                &request.runtime_location_id,
                RuntimeLocationCapability::Terminal,
            )
            .await
            .map_err(map_project_terminal_execution_error)?;

        // The in-process PTY host runs on this gateway's server target only.
        // Desktop, runner, container, and remote-workspace locations need a
        // mutually authenticated target-specific terminal adapter instead of
        // being executed by the gateway process.
        if execution.runtime_target_kind != RUNTIME_TARGET_KIND_SERVER
            || execution.location_kind != LOCATION_KIND_SERVER_WORKSPACE
        {
            return Err(ProjectTerminalExecutionError::Unavailable);
        }

        Ok(ResolvedProjectTerminalExecution::new(
            project.workspace_id,
            ProjectTerminalExecutionTarget::ServerRuntimeNode,
            BIRDCODER_TERMINAL_EXECUTION_AUTHORITY,
            execution.canonical_root,
        ))
    }
}

fn map_project_terminal_execution_error(error: ProjectError) -> ProjectTerminalExecutionError {
    match error {
        ProjectError::InvalidInput(_) => ProjectTerminalExecutionError::InvalidInput,
        ProjectError::NotFound(_) => ProjectTerminalExecutionError::NotFound,
        ProjectError::Forbidden(_) => ProjectTerminalExecutionError::Forbidden,
        ProjectError::PreconditionRequired(_)
        | ProjectError::PreconditionFailed(_)
        | ProjectError::Conflict(_) => ProjectTerminalExecutionError::Conflict,
        ProjectError::Unavailable(_) => ProjectTerminalExecutionError::Unavailable,
        ProjectError::Repository(_)
        | ProjectError::EventPublish(_)
        | ProjectError::GitOperation(_)
        | ProjectError::Internal(_) => ProjectTerminalExecutionError::Internal,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn project_execution_error_mapping_does_not_expose_project_or_path_details() {
        for error in [
            ProjectError::Repository("C:\\sensitive\\checkout".to_owned()),
            ProjectError::Unavailable("/srv/private/project".to_owned()),
        ] {
            let mapped = map_project_terminal_execution_error(error);
            assert!(matches!(
                mapped,
                ProjectTerminalExecutionError::Internal
                    | ProjectTerminalExecutionError::Unavailable
            ));
        }
    }
}
