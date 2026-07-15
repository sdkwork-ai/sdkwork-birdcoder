use std::path::PathBuf;

use crate::context::ProjectContext;
use crate::error::ProjectError;

/// Resolves a project directory from authenticated scope and server-owned IDs.
/// Implementations must never accept a client-provided filesystem path.
pub trait ProjectWorkspaceRootResolver: Send + Sync {
    fn resolve_project_root(
        &self,
        context: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<PathBuf, ProjectError>;
}
