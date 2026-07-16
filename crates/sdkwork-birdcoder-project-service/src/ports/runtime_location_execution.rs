use std::path::PathBuf;

use crate::context::ProjectContext;
use crate::domain::runtime_location::{
    ResolvedProjectRuntimeLocationExecution, RuntimeLocationCapability,
    StoredProjectRuntimeLocation,
};
use crate::error::ProjectError;

/// Application-facing execution boundary. Callers either supply a concrete
/// location id or request the authenticated subject's stored capability
/// preference. The service never infers a local directory from a project id,
/// a process working directory, or deployment configuration.
#[async_trait::async_trait]
pub trait ProjectRuntimeLocationExecutionResolver: Send + Sync {
    async fn resolve_execution_root(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        capability: RuntimeLocationCapability,
    ) -> Result<ResolvedProjectRuntimeLocationExecution, ProjectError>;

    /// Resolves only a durable, current-subject capability preference. This is
    /// deliberately distinct from a project-global default: the preference
    /// lookup remains tenant, organization, project, subject, and capability
    /// scoped before a target-owned root can be returned.
    async fn resolve_preferred_execution_root(
        &self,
        _context: &ProjectContext,
        _project_id: &str,
        _capability: RuntimeLocationCapability,
    ) -> Result<ResolvedProjectRuntimeLocationExecution, ProjectError> {
        Err(ProjectError::Unavailable(
            "Project runtime location is not available on this execution target.".to_owned(),
        ))
    }
}

/// Safe default for service composition that has not supplied a runtime
/// location resolver. It prevents legacy project-id-only execution fallback.
#[derive(Clone, Default)]
pub struct DenyProjectRuntimeLocationExecutionResolver;

#[async_trait::async_trait]
impl ProjectRuntimeLocationExecutionResolver for DenyProjectRuntimeLocationExecutionResolver {
    async fn resolve_execution_root(
        &self,
        _context: &ProjectContext,
        _project_id: &str,
        _runtime_location_id: &str,
        _capability: RuntimeLocationCapability,
    ) -> Result<ResolvedProjectRuntimeLocationExecution, ProjectError> {
        Err(ProjectError::Unavailable(
            "Project runtime location is not available on this execution target.".to_owned(),
        ))
    }
}

/// Target-owned boundary for non-server locations. An implementation is
/// responsible for checking its mutually authenticated target binding and
/// ensuring the canonical result stays below a target-owned allowed root.
/// It must not log or return the root to an app-api caller.
#[async_trait::async_trait]
pub trait RuntimeLocationTargetExecutionAuthority: Send + Sync {
    async fn resolve_target_owned_root(
        &self,
        context: &ProjectContext,
        location: &StoredProjectRuntimeLocation,
        capability: RuntimeLocationCapability,
    ) -> Result<PathBuf, ProjectError>;
}

/// Fail closed until a desktop device, runner, container, or remote workspace
/// has a mutually authenticated target adapter.
#[derive(Clone, Default)]
pub struct DenyRuntimeLocationTargetExecutionAuthority;

#[async_trait::async_trait]
impl RuntimeLocationTargetExecutionAuthority for DenyRuntimeLocationTargetExecutionAuthority {
    async fn resolve_target_owned_root(
        &self,
        _context: &ProjectContext,
        _location: &StoredProjectRuntimeLocation,
        _capability: RuntimeLocationCapability,
    ) -> Result<PathBuf, ProjectError> {
        Err(ProjectError::Unavailable(
            "Project runtime location is not available on this execution target.".to_owned(),
        ))
    }
}
