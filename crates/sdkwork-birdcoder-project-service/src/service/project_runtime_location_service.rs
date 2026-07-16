use std::path::{Path, PathBuf};
use std::sync::Arc;

use sdkwork_utils_rust::is_blank;
use sha2::{Digest, Sha256};
use uuid::Uuid;

use crate::context::ProjectContext;
use crate::domain::runtime_location::{
    CreateProjectRuntimeLocationRequest, NewProjectRuntimeLocation,
    NewProjectRuntimeLocationPreference, ProjectRuntimeLocationAuditContext,
    ProjectRuntimeLocationAuditEntry, ProjectRuntimeLocationCommandAcceptedPayload,
    ProjectRuntimeLocationPayload, ProjectRuntimeLocationPreferencePayload,
    ProjectRuntimeLocationRebind, ProjectRuntimeLocationUpdate,
    ProjectRuntimeLocationVerificationAcceptedPayload, ProjectRuntimeLocationVerificationRequest,
    RebindProjectRuntimeLocationRequest, ResolvedProjectRuntimeLocationExecution,
    RuntimeLocationCapability, RuntimeLocationIdempotency,
    SetProjectRuntimeLocationPreferenceRequest, StoredProjectRuntimeLocation,
    TrustedProjectRuntimeLocationVerification, UpdateProjectRuntimeLocationRequest,
    HEALTH_STATUS_DEGRADED, HEALTH_STATUS_HEALTHY, HEALTH_STATUS_LOCAL_OBSERVED,
    HEALTH_STATUS_PENDING_VERIFICATION, HEALTH_STATUS_REVOKED, HEALTH_STATUS_UNAVAILABLE,
    LOCATION_KIND_CONTAINER_VOLUME, LOCATION_KIND_DESKTOP_CHECKOUT, LOCATION_KIND_REMOTE_WORKSPACE,
    LOCATION_KIND_RUNNER_WORKTREE, LOCATION_KIND_SERVER_WORKSPACE, PATH_FLAVOR_POSIX,
    PATH_FLAVOR_WINDOWS, RUNTIME_LOCATION_OPERATION_CREATE, RUNTIME_LOCATION_OPERATION_PREFERENCE,
    RUNTIME_LOCATION_OPERATION_REBIND, RUNTIME_LOCATION_OPERATION_UPDATE,
    RUNTIME_LOCATION_OPERATION_VERIFY, RUNTIME_TARGET_KIND_CONTAINER,
    RUNTIME_TARGET_KIND_DESKTOP_DEVICE, RUNTIME_TARGET_KIND_REMOTE_WORKSPACE,
    RUNTIME_TARGET_KIND_RUNNER, RUNTIME_TARGET_KIND_SERVER,
};
use crate::error::ProjectError;
use crate::ports::project_workspace_root::ProjectWorkspaceRootResolver;
use crate::ports::repository::ProjectRepository;
use crate::ports::runtime_location_execution::{
    ProjectRuntimeLocationExecutionResolver, RuntimeLocationTargetExecutionAuthority,
};
use crate::ports::runtime_location_path_cipher::{
    RuntimeLocationPathCipher, RuntimeLocationPathFingerprintScope,
};
use crate::ports::runtime_location_repository::ProjectRuntimeLocationRepository;
use crate::ports::runtime_location_verification::{
    RuntimeLocationVerificationAuthority, RuntimeLocationVerificationRequestDispatcher,
};

/// Application service for the target-bound runtime-location aggregate. It
/// accepts an absolute path only for encrypted registration/rebinding, and it
/// exposes that path only through the trusted execution resolver.
#[derive(Clone)]
pub struct ProjectRuntimeLocationService {
    project_repository: Arc<dyn ProjectRepository>,
    runtime_location_repository: Arc<dyn ProjectRuntimeLocationRepository>,
    path_cipher: Arc<dyn RuntimeLocationPathCipher>,
    verification_authority: Arc<dyn RuntimeLocationVerificationAuthority>,
    verification_dispatcher: Arc<dyn RuntimeLocationVerificationRequestDispatcher>,
    workspace_root_resolver: Arc<dyn ProjectWorkspaceRootResolver>,
    target_execution_authority: Arc<dyn RuntimeLocationTargetExecutionAuthority>,
}

/// Header-derived mutation metadata shared by runtime-location update and
/// rebind commands. Keeping it separate from request bodies preserves the
/// HTTP contract while giving the application-service boundary one coherent
/// command context.
#[derive(Clone, Copy)]
pub struct RuntimeLocationMutationContext<'a> {
    expected_version: i64,
    idempotency_key: Option<&'a str>,
    audit_context: &'a ProjectRuntimeLocationAuditContext,
}

impl<'a> RuntimeLocationMutationContext<'a> {
    pub const fn new(
        expected_version: i64,
        idempotency_key: Option<&'a str>,
        audit_context: &'a ProjectRuntimeLocationAuditContext,
    ) -> Self {
        Self {
            expected_version,
            idempotency_key,
            audit_context,
        }
    }
}

struct RuntimeLocationMutationOperation<'a> {
    project_context: &'a ProjectContext,
    project_id: &'a str,
    runtime_location_id: &'a str,
    mutation_context: RuntimeLocationMutationContext<'a>,
}

impl ProjectRuntimeLocationService {
    pub fn new(
        project_repository: Arc<dyn ProjectRepository>,
        runtime_location_repository: Arc<dyn ProjectRuntimeLocationRepository>,
        path_cipher: Arc<dyn RuntimeLocationPathCipher>,
        verification_authority: Arc<dyn RuntimeLocationVerificationAuthority>,
        verification_dispatcher: Arc<dyn RuntimeLocationVerificationRequestDispatcher>,
        workspace_root_resolver: Arc<dyn ProjectWorkspaceRootResolver>,
        target_execution_authority: Arc<dyn RuntimeLocationTargetExecutionAuthority>,
    ) -> Self {
        Self {
            project_repository,
            runtime_location_repository,
            path_cipher,
            verification_authority,
            verification_dispatcher,
            workspace_root_resolver,
            target_execution_authority,
        }
    }

    pub async fn list_runtime_locations(
        &self,
        context: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectRuntimeLocationPayload>, usize), ProjectError> {
        validate_project_id(project_id)?;
        validate_list_window(offset, limit)?;
        self.ensure_project_read_access(context, project_id).await?;
        let (items, total) = self
            .runtime_location_repository
            .list_runtime_locations(context, project_id, offset, limit)
            .await?;
        Ok((
            items
                .iter()
                .map(StoredProjectRuntimeLocation::redacted_payload)
                .collect(),
            total,
        ))
    }

    pub async fn get_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
    ) -> Result<ProjectRuntimeLocationPayload, ProjectError> {
        let location = self
            .get_stored_runtime_location(context, project_id, runtime_location_id)
            .await?;
        Ok(location.redacted_payload())
    }

    /// Register a target-local root. The Idempotency-Key is supplied by the
    /// route header parser, never by the request body.
    pub async fn create_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        request: &CreateProjectRuntimeLocationRequest,
        idempotency_key: Option<&str>,
        audit_context: &ProjectRuntimeLocationAuditContext,
    ) -> Result<ProjectRuntimeLocationPayload, ProjectError> {
        validate_project_id(project_id)?;
        self.project_repository
            .ensure_project_write_access(context, project_id)
            .await?;
        self.ensure_project_read_access(context, project_id).await?;
        validate_registration_request(request)?;

        let id = Uuid::new_v4().to_string();
        let uuid = Uuid::new_v4().to_string();
        let display_name = request
            .display_name
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(request.root_locator.trim())
            .to_owned();
        validate_display_name(&display_name)?;

        let fingerprint_scope = RuntimeLocationPathFingerprintScope {
            project_id: project_id.to_owned(),
            runtime_target_id: request.runtime_target_id.trim().to_owned(),
            path_flavor: request.path_flavor.trim().to_owned(),
        };
        let encrypted_path =
            self.path_cipher
                .encrypt(context, &uuid, &fingerprint_scope, &request.absolute_path)?;
        let idempotency = build_required_idempotency(
            RUNTIME_LOCATION_OPERATION_CREATE,
            idempotency_key,
            &[
                project_id,
                request.runtime_target_id.trim(),
                request.runtime_target_kind.trim(),
                request.location_kind.trim(),
                request.path_flavor.trim(),
                request.root_locator.trim(),
                &display_name,
                &encrypted_path.fingerprint,
            ],
        )?;
        let location = NewProjectRuntimeLocation {
            id,
            uuid,
            project_id: project_id.to_owned(),
            runtime_target_id: request.runtime_target_id.trim().to_owned(),
            runtime_target_kind: request.runtime_target_kind.trim().to_owned(),
            location_kind: request.location_kind.trim().to_owned(),
            path_flavor: request.path_flavor.trim().to_owned(),
            root_locator: request.root_locator.trim().to_owned(),
            display_name,
            encrypted_absolute_path: encrypted_path.ciphertext,
            path_encryption_key_id: encrypted_path.encryption_key_id,
            path_fingerprint: encrypted_path.fingerprint,
            // User input never creates executable capability claims.
            terminal_available: false,
            git_available: false,
            build_available: false,
            file_system_available: false,
            git_repository_url: None,
            git_remote_name: None,
            git_branch: None,
            git_commit: None,
            git_worktree_key: None,
            idempotency: Some(idempotency),
        };
        let audit = audit_entry("runtime_location.create", audit_context)?;
        let stored = self
            .runtime_location_repository
            .register_runtime_location(context, &location, &audit)
            .await?;
        Ok(stored.redacted_payload())
    }

    /// Public update only changes user-safe display metadata. All execution
    /// state is target-observed and can only change in trusted verification.
    pub async fn update_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        request: &UpdateProjectRuntimeLocationRequest,
        mutation_context: RuntimeLocationMutationContext<'_>,
    ) -> Result<ProjectRuntimeLocationPayload, ProjectError> {
        self.update_runtime_location_operation(
            RuntimeLocationMutationOperation {
                project_context: context,
                project_id,
                runtime_location_id,
                mutation_context,
            },
            request,
        )
        .await
    }

    async fn update_runtime_location_operation(
        &self,
        operation: RuntimeLocationMutationOperation<'_>,
        request: &UpdateProjectRuntimeLocationRequest,
    ) -> Result<ProjectRuntimeLocationPayload, ProjectError> {
        let RuntimeLocationMutationOperation {
            project_context: context,
            project_id,
            runtime_location_id,
            mutation_context,
        } = operation;
        let RuntimeLocationMutationContext {
            expected_version,
            idempotency_key,
            audit_context,
        } = mutation_context;
        validate_project_id(project_id)?;
        validate_runtime_location_id(runtime_location_id)?;
        validate_expected_version(expected_version)?;
        self.project_repository
            .ensure_project_write_access(context, project_id)
            .await?;
        self.get_stored_runtime_location(context, project_id, runtime_location_id)
            .await?;

        if let Some(display_name) = request.display_name.as_deref() {
            validate_display_name(display_name)?;
        }
        if request.display_name.is_none() {
            return Err(ProjectError::InvalidInput(
                "At least one mutable runtime-location field is required.".to_owned(),
            ));
        }
        let update = ProjectRuntimeLocationUpdate {
            expected_version,
            display_name: request
                .display_name
                .as_deref()
                .map(str::trim)
                .map(str::to_owned),
            idempotency: Some(build_required_idempotency(
                RUNTIME_LOCATION_OPERATION_UPDATE,
                idempotency_key,
                &[
                    project_id,
                    runtime_location_id,
                    &expected_version.to_string(),
                    request.display_name.as_deref().unwrap_or(""),
                ],
            )?),
        };
        let audit = audit_entry("runtime_location.update", audit_context)?;
        let stored = self
            .runtime_location_repository
            .update_runtime_location(context, project_id, runtime_location_id, &update, &audit)
            .await?;
        Ok(stored.redacted_payload())
    }

    pub async fn rebind_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        request: &RebindProjectRuntimeLocationRequest,
        mutation_context: RuntimeLocationMutationContext<'_>,
    ) -> Result<ProjectRuntimeLocationCommandAcceptedPayload, ProjectError> {
        self.rebind_runtime_location_operation(
            RuntimeLocationMutationOperation {
                project_context: context,
                project_id,
                runtime_location_id,
                mutation_context,
            },
            request,
        )
        .await
    }

    async fn rebind_runtime_location_operation(
        &self,
        operation: RuntimeLocationMutationOperation<'_>,
        request: &RebindProjectRuntimeLocationRequest,
    ) -> Result<ProjectRuntimeLocationCommandAcceptedPayload, ProjectError> {
        let RuntimeLocationMutationOperation {
            project_context: context,
            project_id,
            runtime_location_id,
            mutation_context,
        } = operation;
        let RuntimeLocationMutationContext {
            expected_version,
            idempotency_key,
            audit_context,
        } = mutation_context;
        validate_project_id(project_id)?;
        validate_runtime_location_id(runtime_location_id)?;
        validate_expected_version(expected_version)?;
        self.project_repository
            .ensure_project_write_access(context, project_id)
            .await?;
        let current = self
            .get_stored_runtime_location(context, project_id, runtime_location_id)
            .await?;
        validate_path_flavor(&request.path_flavor)?;
        validate_root_locator(&request.root_locator)?;
        let display_name = request
            .display_name
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(current.display_name.as_str())
            .to_owned();
        validate_display_name(&display_name)?;
        let fingerprint_scope = RuntimeLocationPathFingerprintScope {
            project_id: project_id.to_owned(),
            runtime_target_id: current.runtime_target_id.clone(),
            path_flavor: request.path_flavor.trim().to_owned(),
        };
        let encrypted_path = self.path_cipher.encrypt(
            context,
            &current.uuid,
            &fingerprint_scope,
            &request.absolute_path,
        )?;
        let rebind = ProjectRuntimeLocationRebind {
            expected_version,
            path_flavor: request.path_flavor.trim().to_owned(),
            root_locator: request.root_locator.trim().to_owned(),
            display_name,
            encrypted_absolute_path: encrypted_path.ciphertext,
            path_encryption_key_id: encrypted_path.encryption_key_id,
            path_fingerprint: encrypted_path.fingerprint.clone(),
            idempotency: Some(build_required_idempotency(
                RUNTIME_LOCATION_OPERATION_REBIND,
                idempotency_key,
                &[
                    project_id,
                    runtime_location_id,
                    &expected_version.to_string(),
                    request.path_flavor.trim(),
                    request.root_locator.trim(),
                    &encrypted_path.fingerprint,
                ],
            )?),
        };
        let audit = audit_entry("runtime_location.rebind", audit_context)?;
        let stored = self
            .runtime_location_repository
            .rebind_runtime_location(context, project_id, runtime_location_id, &rebind, &audit)
            .await?;
        Ok(ProjectRuntimeLocationCommandAcceptedPayload {
            accepted: true,
            resource_id: stored.id,
            status: stored.health_status,
        })
    }

    /// Requests work from a trusted target. It never accepts self-reported
    /// health, Git state, capability, or filesystem data from an app client.
    pub async fn request_runtime_location_verification(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        expected_version: i64,
        idempotency_key: Option<&str>,
        audit_context: &ProjectRuntimeLocationAuditContext,
    ) -> Result<ProjectRuntimeLocationVerificationAcceptedPayload, ProjectError> {
        validate_project_id(project_id)?;
        validate_runtime_location_id(runtime_location_id)?;
        validate_expected_version(expected_version)?;
        self.project_repository
            .ensure_project_write_access(context, project_id)
            .await?;
        let idempotency = build_required_idempotency(
            RUNTIME_LOCATION_OPERATION_VERIFY,
            idempotency_key,
            &[
                project_id,
                runtime_location_id,
                &expected_version.to_string(),
            ],
        )?;
        let audit = audit_entry("runtime_location.verify.request", audit_context)?;
        let location = self
            .runtime_location_repository
            .request_runtime_location_verification(
                context,
                project_id,
                runtime_location_id,
                &ProjectRuntimeLocationVerificationRequest {
                    expected_version,
                    idempotency,
                },
                &audit,
            )
            .await?;
        self.verification_dispatcher
            .request_verification(context, &location, expected_version)
            .await?;
        Ok(ProjectRuntimeLocationVerificationAcceptedPayload {
            accepted: true,
            resource_id: runtime_location_id.to_owned(),
            status: HEALTH_STATUS_PENDING_VERIFICATION.to_owned(),
        })
    }

    /// Called only from a mutually authenticated target adapter after that
    /// target has inspected its own root. It is deliberately not an app-api
    /// mapper target.
    pub async fn record_trusted_runtime_location_verification(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        verification: &TrustedProjectRuntimeLocationVerification,
        audit_context: &ProjectRuntimeLocationAuditContext,
    ) -> Result<ProjectRuntimeLocationPayload, ProjectError> {
        validate_project_id(project_id)?;
        validate_runtime_location_id(runtime_location_id)?;
        validate_expected_version(verification.expected_version)?;
        self.project_repository
            .ensure_project_write_access(context, project_id)
            .await?;
        let location = self
            .get_stored_runtime_location(context, project_id, runtime_location_id)
            .await?;
        validate_trusted_verification(&location, verification)?;
        if verification.idempotency.is_none() {
            return Err(ProjectError::InvalidInput(
                "Idempotency-Key is required for runtime-location verification.".to_owned(),
            ));
        }
        self.verification_authority
            .authorize_verification(context, &location, verification)?;
        let audit = audit_entry("runtime_location.verify", audit_context)?;
        let stored = self
            .runtime_location_repository
            .record_runtime_location_verification(
                context,
                project_id,
                runtime_location_id,
                verification,
                &audit,
            )
            .await?;
        Ok(stored.redacted_payload())
    }

    pub async fn delete_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        expected_version: i64,
        audit_context: &ProjectRuntimeLocationAuditContext,
    ) -> Result<(), ProjectError> {
        validate_project_id(project_id)?;
        validate_runtime_location_id(runtime_location_id)?;
        validate_expected_version(expected_version)?;
        self.project_repository
            .ensure_project_write_access(context, project_id)
            .await?;
        self.get_stored_runtime_location(context, project_id, runtime_location_id)
            .await?;
        let audit = audit_entry("runtime_location.delete", audit_context)?;
        self.runtime_location_repository
            .delete_runtime_location(
                context,
                project_id,
                runtime_location_id,
                expected_version,
                &audit,
            )
            .await
    }

    pub async fn get_runtime_location_preference(
        &self,
        context: &ProjectContext,
        project_id: &str,
        capability: RuntimeLocationCapability,
    ) -> Result<Option<ProjectRuntimeLocationPreferencePayload>, ProjectError> {
        validate_project_id(project_id)?;
        self.ensure_project_read_access(context, project_id).await?;
        self.runtime_location_repository
            .get_runtime_location_preference(context, project_id, capability.as_str())
            .await
    }

    pub async fn list_runtime_location_preferences(
        &self,
        context: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectRuntimeLocationPreferencePayload>, usize), ProjectError> {
        validate_project_id(project_id)?;
        validate_list_window(offset, limit)?;
        self.ensure_project_read_access(context, project_id).await?;
        self.runtime_location_repository
            .list_runtime_location_preferences(context, project_id, offset, limit)
            .await
    }

    pub async fn set_runtime_location_preference(
        &self,
        context: &ProjectContext,
        project_id: &str,
        request: &SetProjectRuntimeLocationPreferenceRequest,
        expected_version: Option<i64>,
        idempotency_key: Option<&str>,
        audit_context: &ProjectRuntimeLocationAuditContext,
    ) -> Result<ProjectRuntimeLocationPreferencePayload, ProjectError> {
        validate_project_id(project_id)?;
        validate_runtime_location_id(&request.runtime_location_id)?;
        if let Some(version) = expected_version {
            validate_expected_version(version)?;
        }
        let capability = RuntimeLocationCapability::parse(&request.capability)?;
        self.project_repository
            .ensure_project_write_access(context, project_id)
            .await?;
        let location = self
            .get_stored_runtime_location(context, project_id, &request.runtime_location_id)
            .await?;
        if !location.supports(capability) || !location.is_executable() {
            return Err(ProjectError::Conflict(
                "The selected runtime location is not verified for the requested capability."
                    .to_owned(),
            ));
        }
        let expected_version_fingerprint =
            expected_version.map_or_else(String::new, |value| value.to_string());
        let preference = NewProjectRuntimeLocationPreference {
            id: Uuid::new_v4().to_string(),
            uuid: Uuid::new_v4().to_string(),
            project_id: project_id.to_owned(),
            capability: capability.as_str().to_owned(),
            runtime_location_id: request.runtime_location_id.clone(),
            expected_version,
            idempotency: Some(build_required_idempotency(
                RUNTIME_LOCATION_OPERATION_PREFERENCE,
                idempotency_key,
                &[
                    project_id,
                    capability.as_str(),
                    &request.runtime_location_id,
                    &expected_version_fingerprint,
                ],
            )?),
        };
        let audit = audit_entry("runtime_location.preference", audit_context)?;
        self.runtime_location_repository
            .upsert_runtime_location_preference(context, &preference, &audit)
            .await
    }

    async fn ensure_project_read_access(
        &self,
        context: &ProjectContext,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        self.project_repository
            .find_project_by_id(context, project_id)
            .await?
            .map(|_| ())
            .ok_or_else(|| ProjectError::NotFound("Project was not found.".to_owned()))
    }

    async fn get_stored_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError> {
        validate_project_id(project_id)?;
        validate_runtime_location_id(runtime_location_id)?;
        self.ensure_project_read_access(context, project_id).await?;
        self.runtime_location_repository
            .find_runtime_location(context, project_id, runtime_location_id)
            .await?
            .ok_or_else(|| {
                ProjectError::NotFound("Project runtime location was not found.".to_owned())
            })
    }

    async fn resolve_server_workspace_root(
        &self,
        context: &ProjectContext,
        project_id: &str,
        location: &StoredProjectRuntimeLocation,
    ) -> Result<PathBuf, ProjectError> {
        let project = self
            .project_repository
            .find_project_by_id(context, project_id)
            .await?
            .ok_or_else(|| ProjectError::NotFound("Project was not found.".to_owned()))?;
        let expected_root = self.workspace_root_resolver.resolve_project_root(
            context,
            &project.workspace_id,
            &project.id,
        )?;
        let expected_root = canonical_directory(expected_root)?;
        let decrypted_root = self.path_cipher.decrypt(
            context,
            &location.uuid,
            &location.path_encryption_key_id,
            &location.encrypted_absolute_path,
        )?;
        let decrypted_root = canonical_directory(PathBuf::from(decrypted_root))?;
        if decrypted_root != expected_root {
            return Err(ProjectError::Unavailable(
                "Project runtime location is not available on this execution target.".to_owned(),
            ));
        }
        Ok(expected_root)
    }
}

#[async_trait::async_trait]
impl ProjectRuntimeLocationExecutionResolver for ProjectRuntimeLocationService {
    async fn resolve_preferred_execution_root(
        &self,
        context: &ProjectContext,
        project_id: &str,
        capability: RuntimeLocationCapability,
    ) -> Result<ResolvedProjectRuntimeLocationExecution, ProjectError> {
        validate_project_id(project_id)?;
        let preference = self
            .get_runtime_location_preference(context, project_id, capability)
            .await?
            .ok_or_else(|| {
                ProjectError::Unavailable(
                    "No project runtime location is selected for the requested capability."
                        .to_owned(),
                )
            })?;

        self.resolve_execution_root(
            context,
            project_id,
            &preference.runtime_location_id,
            capability,
        )
        .await
    }

    async fn resolve_execution_root(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        capability: RuntimeLocationCapability,
    ) -> Result<ResolvedProjectRuntimeLocationExecution, ProjectError> {
        let location = self
            .get_stored_runtime_location(context, project_id, runtime_location_id)
            .await?;
        if !location.is_executable() || !location.supports(capability) {
            return Err(ProjectError::Unavailable(
                "Project runtime location is not available for the requested capability."
                    .to_owned(),
            ));
        }

        let canonical_root = if location.runtime_target_kind == RUNTIME_TARGET_KIND_SERVER
            && location.location_kind == LOCATION_KIND_SERVER_WORKSPACE
        {
            self.resolve_server_workspace_root(context, project_id, &location)
                .await?
        } else {
            let root = self
                .target_execution_authority
                .resolve_target_owned_root(context, &location, capability)
                .await?;
            canonical_directory(root)?
        };

        Ok(ResolvedProjectRuntimeLocationExecution {
            runtime_location_id: location.id.clone(),
            runtime_target_id: location.runtime_target_id.clone(),
            runtime_target_kind: location.runtime_target_kind.clone(),
            location_kind: location.location_kind.clone(),
            capability,
            canonical_root,
        })
    }
}

fn validate_registration_request(
    request: &CreateProjectRuntimeLocationRequest,
) -> Result<(), ProjectError> {
    validate_target_id(&request.runtime_target_id)?;
    validate_target_location_binding(&request.runtime_target_kind, &request.location_kind)?;
    validate_path_flavor(&request.path_flavor)?;
    validate_root_locator(&request.root_locator)?;
    if is_blank(Some(request.absolute_path.as_str())) {
        return Err(ProjectError::InvalidInput(
            "absolutePath is required.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_target_location_binding(
    runtime_target_kind: &str,
    location_kind: &str,
) -> Result<(), ProjectError> {
    let valid = matches!(
        (runtime_target_kind.trim(), location_kind.trim()),
        (
            RUNTIME_TARGET_KIND_DESKTOP_DEVICE,
            LOCATION_KIND_DESKTOP_CHECKOUT
        ) | (RUNTIME_TARGET_KIND_SERVER, LOCATION_KIND_SERVER_WORKSPACE)
            | (RUNTIME_TARGET_KIND_RUNNER, LOCATION_KIND_RUNNER_WORKTREE)
            | (
                RUNTIME_TARGET_KIND_CONTAINER,
                LOCATION_KIND_CONTAINER_VOLUME
            )
            | (
                RUNTIME_TARGET_KIND_REMOTE_WORKSPACE,
                LOCATION_KIND_REMOTE_WORKSPACE
            )
    );
    if !valid {
        return Err(ProjectError::InvalidInput(
            "runtimeTargetKind and locationKind are not a supported target binding.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_path_flavor(value: &str) -> Result<(), ProjectError> {
    if matches!(value.trim(), PATH_FLAVOR_WINDOWS | PATH_FLAVOR_POSIX) {
        Ok(())
    } else {
        Err(ProjectError::InvalidInput(
            "pathFlavor must be windows or posix.".to_owned(),
        ))
    }
}

fn validate_root_locator(value: &str) -> Result<(), ProjectError> {
    let value = value.trim();
    let valid = !value.is_empty()
        && value.len() <= 160
        && value.as_bytes()[0].is_ascii_alphanumeric()
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-' | b':'))
        && !value.contains("..")
        && !value.contains("://");
    if valid {
        Ok(())
    } else {
        Err(ProjectError::InvalidInput(
            "rootLocator must be a path-free opaque locator.".to_owned(),
        ))
    }
}

fn validate_target_id(value: &str) -> Result<(), ProjectError> {
    let value = value.trim();
    let valid = !value.is_empty()
        && value.len() <= 160
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-' | b':'))
        && !value.contains("..")
        && !value.contains("://");
    if valid {
        Ok(())
    } else {
        Err(ProjectError::InvalidInput(
            "runtimeTargetId must be an opaque target identifier.".to_owned(),
        ))
    }
}

fn validate_display_name(value: &str) -> Result<(), ProjectError> {
    let value = value.trim();
    let looks_windows_absolute = value.len() >= 3
        && value.as_bytes()[0].is_ascii_alphabetic()
        && value.as_bytes()[1] == b':'
        && matches!(value.as_bytes()[2], b'\\' | b'/');
    let valid = !value.is_empty()
        && value.len() <= 160
        && !value.bytes().any(|byte| byte < 0x20)
        && !value.contains(['/', '\\'])
        && !value.contains("://")
        && !looks_windows_absolute;
    if valid {
        Ok(())
    } else {
        Err(ProjectError::InvalidInput(
            "displayName must not contain a filesystem path.".to_owned(),
        ))
    }
}

fn validate_trusted_verification(
    location: &StoredProjectRuntimeLocation,
    verification: &TrustedProjectRuntimeLocationVerification,
) -> Result<(), ProjectError> {
    if verification.runtime_target_id.trim() != location.runtime_target_id {
        return Err(ProjectError::Forbidden(
            "The runtime target does not own this project location.".to_owned(),
        ));
    }
    if !matches!(
        verification.health_status.trim(),
        HEALTH_STATUS_PENDING_VERIFICATION
            | HEALTH_STATUS_LOCAL_OBSERVED
            | HEALTH_STATUS_HEALTHY
            | HEALTH_STATUS_DEGRADED
            | HEALTH_STATUS_UNAVAILABLE
            | HEALTH_STATUS_REVOKED
    ) {
        return Err(ProjectError::InvalidInput(
            "healthStatus is not supported for a runtime-location verification.".to_owned(),
        ));
    }
    validate_optional_git_snapshot(
        verification.git_repository_url.as_deref(),
        verification.git_remote_name.as_deref(),
        verification.git_branch.as_deref(),
        verification.git_commit.as_deref(),
        verification.git_worktree_key.as_deref(),
    )
}

fn validate_optional_git_snapshot(
    repository_url: Option<&str>,
    remote_name: Option<&str>,
    branch: Option<&str>,
    commit: Option<&str>,
    worktree_key: Option<&str>,
) -> Result<(), ProjectError> {
    if let Some(value) = repository_url {
        let value = value.trim();
        let has_uri_userinfo = value
            .split_once("://")
            .map(|(_, rest)| {
                rest.split('/')
                    .next()
                    .is_some_and(|authority| authority.contains('@'))
            })
            .unwrap_or(false);
        let is_safe_scp_git_remote =
            value.starts_with("git@") && value[4..].contains(':') && !value[4..].contains('@');
        let valid = !value.is_empty()
            && value.len() <= 2048
            && !value.bytes().any(|byte| byte <= b' ')
            && !value.contains(['?', '#'])
            && !has_uri_userinfo
            && (value.starts_with("https://")
                || value.starts_with("ssh://") && !value.contains('@')
                || value.starts_with("git://")
                || is_safe_scp_git_remote);
        if !valid {
            return Err(ProjectError::InvalidInput(
                "gitRepositoryUrl must be a credential-free Git remote URL.".to_owned(),
            ));
        }
    }
    if let Some(value) = remote_name {
        let value = value.trim();
        if value.is_empty()
            || value.len() > 64
            || !value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
        {
            return Err(ProjectError::InvalidInput(
                "gitRemoteName must be a safe Git remote name.".to_owned(),
            ));
        }
    }
    if let Some(value) = branch {
        let value = value.trim();
        if value.is_empty()
            || value.len() > 512
            || value.bytes().any(|byte| byte < 0x20)
            || value.contains("..")
            || value.ends_with('/')
            || value.starts_with('/')
        {
            return Err(ProjectError::InvalidInput(
                "gitBranch must be a safe Git reference.".to_owned(),
            ));
        }
    }
    if let Some(value) = commit {
        let value = value.trim();
        if !(7..=64).contains(&value.len()) || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(ProjectError::InvalidInput(
                "gitCommit must be a hexadecimal Git object id.".to_owned(),
            ));
        }
    }
    if let Some(value) = worktree_key {
        let value = value.trim();
        if value.len() != 64 || !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(ProjectError::InvalidInput(
                "gitWorktreeKey must be a server-generated worktree key.".to_owned(),
            ));
        }
    }
    Ok(())
}

fn build_idempotency(
    operation: &str,
    raw_key: Option<&str>,
    request_fields: &[&str],
) -> Result<Option<RuntimeLocationIdempotency>, ProjectError> {
    let Some(raw_key) = raw_key else {
        return Ok(None);
    };
    let raw_key = raw_key.trim();
    if raw_key.is_empty()
        || raw_key.len() > 255
        || raw_key.bytes().any(|byte| !(0x21..=0x7e).contains(&byte))
    {
        return Err(ProjectError::InvalidInput(
            "Idempotency-Key must be a printable value up to 255 characters.".to_owned(),
        ));
    }
    let mut key_hasher = Sha256::new();
    key_hasher.update(raw_key.as_bytes());
    let key_hash = hex::encode(key_hasher.finalize());
    Ok(Some(RuntimeLocationIdempotency {
        operation: operation.to_owned(),
        key_hash,
        request_fingerprint: stable_fingerprint(request_fields),
    }))
}

fn build_required_idempotency(
    operation: &str,
    raw_key: Option<&str>,
    request_fields: &[&str],
) -> Result<RuntimeLocationIdempotency, ProjectError> {
    build_idempotency(operation, raw_key, request_fields)?.ok_or_else(|| {
        ProjectError::InvalidInput(
            "Idempotency-Key is required for this runtime-location command.".to_owned(),
        )
    })
}

fn stable_fingerprint(fields: &[&str]) -> String {
    let mut hasher = Sha256::new();
    for field in fields {
        hasher.update((field.len() as u64).to_be_bytes());
        hasher.update(field.as_bytes());
    }
    hex::encode(hasher.finalize())
}

fn audit_entry(
    action: &str,
    audit_context: &ProjectRuntimeLocationAuditContext,
) -> Result<ProjectRuntimeLocationAuditEntry, ProjectError> {
    if !action
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'))
    {
        return Err(ProjectError::Internal(
            "Runtime-location audit action is invalid.".to_owned(),
        ));
    }
    let redacted_metadata_json = serde_json::json!({ "event": action }).to_string();
    Ok(ProjectRuntimeLocationAuditEntry {
        action: action.to_owned(),
        result: "accepted".to_owned(),
        trace_id: audit_context.trace_id.clone(),
        redacted_metadata_json,
    })
}

fn validate_project_id(project_id: &str) -> Result<(), ProjectError> {
    if is_blank(Some(project_id)) {
        return Err(ProjectError::InvalidInput(
            "projectId is required.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_runtime_location_id(runtime_location_id: &str) -> Result<(), ProjectError> {
    if is_blank(Some(runtime_location_id)) || runtime_location_id.len() > 160 {
        return Err(ProjectError::InvalidInput(
            "runtimeLocationId is required.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_expected_version(value: i64) -> Result<(), ProjectError> {
    if value < 0 {
        return Err(ProjectError::InvalidInput(
            "If-Match must be a non-negative runtime-location version.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_list_window(offset: usize, limit: usize) -> Result<(), ProjectError> {
    if limit == 0 || limit > 200 || offset > i64::MAX as usize {
        return Err(ProjectError::InvalidInput(
            "runtime-location pagination is invalid.".to_owned(),
        ));
    }
    Ok(())
}

fn canonical_directory(path: PathBuf) -> Result<PathBuf, ProjectError> {
    if !path.is_absolute() {
        return Err(ProjectError::Unavailable(
            "Project runtime location is not available on this execution target.".to_owned(),
        ));
    }
    let metadata = std::fs::symlink_metadata(&path).map_err(|_| {
        ProjectError::Unavailable(
            "Project runtime location is not available on this execution target.".to_owned(),
        )
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(ProjectError::Unavailable(
            "Project runtime location is not available on this execution target.".to_owned(),
        ));
    }
    let canonical = std::fs::canonicalize(path).map_err(|_| {
        ProjectError::Unavailable(
            "Project runtime location is not available on this execution target.".to_owned(),
        )
    })?;
    if !canonical.is_absolute() || !Path::new(&canonical).is_dir() {
        return Err(ProjectError::Unavailable(
            "Project runtime location is not available on this execution target.".to_owned(),
        ));
    }
    Ok(canonical)
}

#[cfg(test)]
mod tests {
    use super::{
        build_idempotency, validate_root_locator, validate_target_location_binding,
        validate_trusted_verification, RuntimeLocationMutationContext,
    };
    use crate::domain::runtime_location::{
        ProjectRuntimeLocationAuditContext, StoredProjectRuntimeLocation,
        TrustedProjectRuntimeLocationVerification, HEALTH_STATUS_HEALTHY,
    };

    #[test]
    fn mutation_context_keeps_header_metadata_together() {
        let audit_context = ProjectRuntimeLocationAuditContext {
            trace_id: Some("trace-1".to_owned()),
        };
        let context = RuntimeLocationMutationContext::new(7, Some("key-1"), &audit_context);

        assert_eq!(context.expected_version, 7);
        assert_eq!(context.idempotency_key, Some("key-1"));
        assert_eq!(context.audit_context.trace_id.as_deref(), Some("trace-1"));
    }

    #[test]
    fn idempotency_key_requires_printable_ascii_without_spaces() {
        assert!(build_idempotency("update", Some("!valid~"), &["request"]).is_ok());
        assert!(build_idempotency("update", Some("contains space"), &["request"]).is_err());
        assert!(build_idempotency("update", Some("\u{7f}"), &["request"]).is_err());
    }

    #[test]
    fn root_locator_rejects_path_like_values() {
        assert!(validate_root_locator("desktop-root:project").is_ok());
        assert!(validate_root_locator("C:\\work\\project").is_err());
        assert!(validate_root_locator("../project").is_err());
        assert!(validate_root_locator("https://host/project").is_err());
    }

    #[test]
    fn target_and_location_kind_must_form_a_known_binding() {
        assert!(validate_target_location_binding("desktop_device", "desktop_checkout").is_ok());
        assert!(validate_target_location_binding("desktop_device", "server_workspace").is_err());
    }

    #[test]
    fn trusted_verification_rejects_a_different_target() {
        let location = StoredProjectRuntimeLocation {
            id: "location".to_owned(),
            uuid: "uuid".to_owned(),
            tenant_id: "100001".to_owned(),
            organization_id: "0".to_owned(),
            project_id: "300001".to_owned(),
            registered_by_user_id: "200001".to_owned(),
            runtime_target_id: "desktop-a".to_owned(),
            runtime_target_kind: "desktop_device".to_owned(),
            location_kind: "desktop_checkout".to_owned(),
            path_flavor: "windows".to_owned(),
            root_locator: "desktop-root".to_owned(),
            display_name: "Project".to_owned(),
            encrypted_absolute_path: "ciphertext".to_owned(),
            path_encryption_key_id: "key".to_owned(),
            path_fingerprint: "fingerprint".to_owned(),
            terminal_available: false,
            git_available: false,
            build_available: false,
            file_system_available: false,
            health_status: "pending_verification".to_owned(),
            last_verified_at: None,
            last_seen_at: None,
            verified_by_user_id: None,
            git_repository_url: None,
            git_remote_name: None,
            git_branch: None,
            git_commit: None,
            git_worktree_key: None,
            version: 0,
            created_at: "now".to_owned(),
            updated_at: "now".to_owned(),
        };
        let verification = TrustedProjectRuntimeLocationVerification {
            expected_version: 0,
            runtime_target_id: "desktop-b".to_owned(),
            health_status: HEALTH_STATUS_HEALTHY.to_owned(),
            terminal_available: true,
            git_available: true,
            build_available: false,
            file_system_available: true,
            git_repository_url: None,
            git_remote_name: None,
            git_branch: None,
            git_commit: None,
            git_worktree_key: None,
            idempotency: None,
        };
        assert!(validate_trusted_verification(&location, &verification).is_err());
    }
}
