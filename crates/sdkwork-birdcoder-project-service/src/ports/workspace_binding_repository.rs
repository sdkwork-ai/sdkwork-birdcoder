use crate::context::ProjectContext;
use crate::domain::workspace_binding::{
    NewProjectWorkspaceBinding, ProjectWorkspaceBindingAuditEntry, ProjectWorkspaceBindingPayload,
};
use crate::error::ProjectError;

#[async_trait::async_trait]
pub trait ProjectWorkspaceBindingRepository: Send + Sync {
    async fn get_workspace_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
    ) -> Result<Option<ProjectWorkspaceBindingPayload>, ProjectError>;

    /// Atomically reserves idempotency, creates or compare-and-swaps the
    /// binding, and appends the audit fact.
    async fn upsert_workspace_binding(
        &self,
        context: &ProjectContext,
        binding: &NewProjectWorkspaceBinding,
        audit: &ProjectWorkspaceBindingAuditEntry,
    ) -> Result<ProjectWorkspaceBindingPayload, ProjectError>;

    /// Atomically compare-and-swaps the lifecycle tombstone and appends audit.
    async fn delete_workspace_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
        expected_version: i64,
        audit: &ProjectWorkspaceBindingAuditEntry,
    ) -> Result<(), ProjectError>;
}
