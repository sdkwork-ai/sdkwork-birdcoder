use crate::context::ProjectContext;
use crate::domain::sandbox_binding::{
    NewProjectSandboxBinding, ProjectSandboxBindingAuditEntry, ProjectSandboxBindingPayload,
};
use crate::error::ProjectError;

#[async_trait::async_trait]
pub trait ProjectSandboxBindingRepository: Send + Sync {
    async fn get_sandbox_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
    ) -> Result<Option<ProjectSandboxBindingPayload>, ProjectError>;

    /// Atomically reserves idempotency, creates or compare-and-swaps the
    /// binding, and appends the audit fact.
    async fn upsert_sandbox_binding(
        &self,
        context: &ProjectContext,
        binding: &NewProjectSandboxBinding,
        audit: &ProjectSandboxBindingAuditEntry,
    ) -> Result<ProjectSandboxBindingPayload, ProjectError>;

    /// Atomically compare-and-swaps the lifecycle tombstone and appends audit.
    async fn delete_sandbox_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
        expected_version: i64,
        audit: &ProjectSandboxBindingAuditEntry,
    ) -> Result<(), ProjectError>;
}
