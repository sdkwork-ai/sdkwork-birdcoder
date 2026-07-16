use crate::context::ProjectContext;
use crate::domain::runtime_location::{
    NewProjectRuntimeLocation, NewProjectRuntimeLocationPreference,
    ProjectRuntimeLocationAuditEntry, ProjectRuntimeLocationPreferencePayload,
    ProjectRuntimeLocationRebind, ProjectRuntimeLocationUpdate,
    ProjectRuntimeLocationVerificationRequest, StoredProjectRuntimeLocation,
    TrustedProjectRuntimeLocationVerification,
};
use crate::error::ProjectError;

/// Persistence boundary for the target-bound project runtime-location
/// aggregate. Mutating methods append their audit entry in the same database
/// transaction as the state transition.
#[async_trait::async_trait]
pub trait ProjectRuntimeLocationRepository: Send + Sync {
    async fn list_runtime_locations(
        &self,
        context: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<StoredProjectRuntimeLocation>, usize), ProjectError>;

    async fn find_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
    ) -> Result<Option<StoredProjectRuntimeLocation>, ProjectError>;

    async fn register_runtime_location(
        &self,
        context: &ProjectContext,
        location: &NewProjectRuntimeLocation,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError>;

    async fn update_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        update: &ProjectRuntimeLocationUpdate,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError>;

    async fn rebind_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        rebind: &ProjectRuntimeLocationRebind,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError>;

    async fn record_runtime_location_verification(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        verification: &TrustedProjectRuntimeLocationVerification,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError>;

    /// Persists a verification command's idempotency and redacted audit fact
    /// before a trusted dispatcher is invoked. It does not let an app client
    /// update health, capability, Git, or filesystem state.
    async fn request_runtime_location_verification(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        request: &ProjectRuntimeLocationVerificationRequest,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError>;

    async fn delete_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        expected_version: i64,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<(), ProjectError>;

    async fn get_runtime_location_preference(
        &self,
        context: &ProjectContext,
        project_id: &str,
        capability: &str,
    ) -> Result<Option<ProjectRuntimeLocationPreferencePayload>, ProjectError>;

    async fn list_runtime_location_preferences(
        &self,
        context: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectRuntimeLocationPreferencePayload>, usize), ProjectError>;

    async fn upsert_runtime_location_preference(
        &self,
        context: &ProjectContext,
        preference: &NewProjectRuntimeLocationPreference,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<ProjectRuntimeLocationPreferencePayload, ProjectError>;
}
