use std::path::PathBuf;

use crate::context::CodingSessionContext;
use crate::error::CodingSessionError;

/// Resolves the target-owned execution root bound to a coding session.
/// Implementations must validate workspace/project write authority and the
/// explicit runtime-location binding. They must never select a preference or
/// derive a filesystem location from a project id, process CWD, or session
/// payload path.
#[async_trait::async_trait]
pub trait ProjectExecutionScopeResolver: Send + Sync {
    async fn resolve_execution_root(
        &self,
        context: &CodingSessionContext,
        workspace_id: &str,
        project_id: &str,
        runtime_location_id: &str,
    ) -> Result<PathBuf, CodingSessionError>;
}
