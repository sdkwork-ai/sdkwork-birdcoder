use std::path::PathBuf;

use serde::Serialize;

use crate::error::ProjectError;

pub const RUNTIME_TARGET_KIND_DESKTOP_DEVICE: &str = "desktop_device";
pub const RUNTIME_TARGET_KIND_SERVER: &str = "server";
pub const RUNTIME_TARGET_KIND_RUNNER: &str = "runner";
pub const RUNTIME_TARGET_KIND_CONTAINER: &str = "container";
pub const RUNTIME_TARGET_KIND_REMOTE_WORKSPACE: &str = "remote_workspace";

pub const LOCATION_KIND_DESKTOP_CHECKOUT: &str = "desktop_checkout";
pub const LOCATION_KIND_SERVER_WORKSPACE: &str = "server_workspace";
pub const LOCATION_KIND_RUNNER_WORKTREE: &str = "runner_worktree";
pub const LOCATION_KIND_CONTAINER_VOLUME: &str = "container_volume";
pub const LOCATION_KIND_REMOTE_WORKSPACE: &str = "remote_workspace";

pub const PATH_FLAVOR_WINDOWS: &str = "windows";
pub const PATH_FLAVOR_POSIX: &str = "posix";

pub const HEALTH_STATUS_PENDING_VERIFICATION: &str = "pending_verification";
pub const HEALTH_STATUS_LOCAL_OBSERVED: &str = "local_observed";
pub const HEALTH_STATUS_HEALTHY: &str = "healthy";
pub const HEALTH_STATUS_DEGRADED: &str = "degraded";
pub const HEALTH_STATUS_UNAVAILABLE: &str = "unavailable";
pub const HEALTH_STATUS_REVOKED: &str = "revoked";

pub const RUNTIME_LOCATION_OPERATION_CREATE: &str = "create";
pub const RUNTIME_LOCATION_OPERATION_UPDATE: &str = "update";
pub const RUNTIME_LOCATION_OPERATION_REBIND: &str = "rebind";
pub const RUNTIME_LOCATION_OPERATION_VERIFY: &str = "verify";
pub const RUNTIME_LOCATION_OPERATION_PREFERENCE: &str = "preference";

/// A capability is always resolved on one target-bound location. It is not a
/// project-global feature flag.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RuntimeLocationCapability {
    Terminal,
    Git,
    Build,
    FileSystem,
}

impl RuntimeLocationCapability {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Terminal => "terminal",
            Self::Git => "git",
            Self::Build => "build",
            Self::FileSystem => "file_system",
        }
    }

    pub fn parse(value: &str) -> Result<Self, ProjectError> {
        match value.trim() {
            "terminal" => Ok(Self::Terminal),
            "git" => Ok(Self::Git),
            "build" => Ok(Self::Build),
            "file_system" => Ok(Self::FileSystem),
            _ => Err(ProjectError::InvalidInput(
                "capability must be terminal, git, build, or file_system.".to_owned(),
            )),
        }
    }
}

/// A target-bound project root. `absolute_path`, its encryption material, and
/// its duplicate-detection fingerprint are deliberately absent from this API
/// representation.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRuntimeLocationPayload {
    pub id: String,
    pub uuid: String,
    pub project_id: String,
    pub runtime_target_id: String,
    pub runtime_target_kind: String,
    pub location_kind: String,
    pub path_flavor: String,
    /// An opaque, path-free target-local label. It is not a directory.
    pub root_locator: String,
    pub display_name: String,
    pub has_absolute_path: bool,
    pub terminal_available: bool,
    pub git_available: bool,
    pub build_available: bool,
    pub file_system_available: bool,
    pub health_status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_verified_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<String>,
    /// This value is validated to exclude credentials before persistence.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_repository_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_remote_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_commit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_worktree_key: Option<String>,
    /// Decimal text so API clients and `If-Match` never lose a 64-bit value.
    pub version: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRuntimeLocationPreferencePayload {
    pub id: String,
    pub project_id: String,
    pub subject_user_id: String,
    pub capability: String,
    pub runtime_location_id: String,
    /// Decimal text so API clients and `If-Match` never lose a 64-bit value.
    pub version: String,
    pub created_at: String,
    pub updated_at: String,
}

/// A response for a verification request. It describes a command request,
/// not a proof that a caller-supplied location is healthy.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRuntimeLocationVerificationAcceptedPayload {
    pub accepted: bool,
    pub resource_id: String,
    pub status: String,
}

/// Standard command acknowledgement for a durable location mutation whose
/// public contract intentionally does not reveal an internal record snapshot.
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRuntimeLocationCommandAcceptedPayload {
    pub accepted: bool,
    pub resource_id: String,
    pub status: String,
}

/// Internal record returned by persistence. It is intentionally neither
/// serializable nor printable: it contains encrypted path material and a
/// keyed duplicate-detection fingerprint.
#[derive(Clone)]
pub struct StoredProjectRuntimeLocation {
    pub id: String,
    pub uuid: String,
    pub tenant_id: String,
    pub organization_id: String,
    pub project_id: String,
    pub registered_by_user_id: String,
    pub runtime_target_id: String,
    pub runtime_target_kind: String,
    pub location_kind: String,
    pub path_flavor: String,
    pub root_locator: String,
    pub display_name: String,
    pub encrypted_absolute_path: String,
    pub path_encryption_key_id: String,
    pub path_fingerprint: String,
    pub terminal_available: bool,
    pub git_available: bool,
    pub build_available: bool,
    pub file_system_available: bool,
    pub health_status: String,
    pub last_verified_at: Option<String>,
    pub last_seen_at: Option<String>,
    pub verified_by_user_id: Option<String>,
    pub git_repository_url: Option<String>,
    pub git_remote_name: Option<String>,
    pub git_branch: Option<String>,
    pub git_commit: Option<String>,
    pub git_worktree_key: Option<String>,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl StoredProjectRuntimeLocation {
    pub fn redacted_payload(&self) -> ProjectRuntimeLocationPayload {
        ProjectRuntimeLocationPayload {
            id: self.id.clone(),
            uuid: self.uuid.clone(),
            project_id: self.project_id.clone(),
            runtime_target_id: self.runtime_target_id.clone(),
            runtime_target_kind: self.runtime_target_kind.clone(),
            location_kind: self.location_kind.clone(),
            path_flavor: self.path_flavor.clone(),
            root_locator: self.root_locator.clone(),
            display_name: self.display_name.clone(),
            has_absolute_path: !self.encrypted_absolute_path.is_empty(),
            terminal_available: self.terminal_available,
            git_available: self.git_available,
            build_available: self.build_available,
            file_system_available: self.file_system_available,
            health_status: self.health_status.clone(),
            last_verified_at: self.last_verified_at.clone(),
            last_seen_at: self.last_seen_at.clone(),
            git_repository_url: self.git_repository_url.clone(),
            git_remote_name: self.git_remote_name.clone(),
            git_branch: self.git_branch.clone(),
            git_commit: self.git_commit.clone(),
            git_worktree_key: self.git_worktree_key.clone(),
            version: self.version.to_string(),
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
        }
    }

    pub fn supports(&self, capability: RuntimeLocationCapability) -> bool {
        match capability {
            RuntimeLocationCapability::Terminal => self.terminal_available,
            RuntimeLocationCapability::Git => self.git_available,
            RuntimeLocationCapability::Build => self.build_available,
            RuntimeLocationCapability::FileSystem => self.file_system_available,
        }
    }

    pub fn is_executable(&self) -> bool {
        self.health_status == HEALTH_STATUS_HEALTHY
    }
}

/// Path-bearing data passed from the application service to persistence only
/// after the path has been encrypted and fingerprinted.
#[derive(Clone)]
pub struct NewProjectRuntimeLocation {
    pub id: String,
    pub uuid: String,
    pub project_id: String,
    pub runtime_target_id: String,
    pub runtime_target_kind: String,
    pub location_kind: String,
    pub path_flavor: String,
    pub root_locator: String,
    pub display_name: String,
    pub encrypted_absolute_path: String,
    pub path_encryption_key_id: String,
    pub path_fingerprint: String,
    pub terminal_available: bool,
    pub git_available: bool,
    pub build_available: bool,
    pub file_system_available: bool,
    pub git_repository_url: Option<String>,
    pub git_remote_name: Option<String>,
    pub git_branch: Option<String>,
    pub git_commit: Option<String>,
    pub git_worktree_key: Option<String>,
    pub idempotency: Option<RuntimeLocationIdempotency>,
}

#[derive(Clone)]
pub struct ProjectRuntimeLocationUpdate {
    pub expected_version: i64,
    pub display_name: Option<String>,
    pub idempotency: Option<RuntimeLocationIdempotency>,
}

#[derive(Clone)]
pub struct ProjectRuntimeLocationRebind {
    pub expected_version: i64,
    pub path_flavor: String,
    pub root_locator: String,
    pub display_name: String,
    pub encrypted_absolute_path: String,
    pub path_encryption_key_id: String,
    pub path_fingerprint: String,
    pub idempotency: Option<RuntimeLocationIdempotency>,
}

/// Verification facts can only arrive from an authenticated target adapter.
/// This type must never be mapped directly from an app-api body.
#[derive(Clone)]
pub struct TrustedProjectRuntimeLocationVerification {
    pub expected_version: i64,
    pub runtime_target_id: String,
    pub health_status: String,
    pub terminal_available: bool,
    pub git_available: bool,
    pub build_available: bool,
    pub file_system_available: bool,
    pub git_repository_url: Option<String>,
    pub git_remote_name: Option<String>,
    pub git_branch: Option<String>,
    pub git_commit: Option<String>,
    pub git_worktree_key: Option<String>,
    pub idempotency: Option<RuntimeLocationIdempotency>,
}

/// Internal representation of the public verification command. The request
/// body is empty; the version and idempotency values come from If-Match and
/// Idempotency-Key headers respectively.
#[derive(Clone)]
pub struct ProjectRuntimeLocationVerificationRequest {
    pub expected_version: i64,
    pub idempotency: RuntimeLocationIdempotency,
}

#[derive(Clone)]
pub struct NewProjectRuntimeLocationPreference {
    pub id: String,
    pub uuid: String,
    pub project_id: String,
    pub capability: String,
    pub runtime_location_id: String,
    pub expected_version: Option<i64>,
    pub idempotency: Option<RuntimeLocationIdempotency>,
}

/// Only hashed/header-derived idempotency state reaches persistence. The raw
/// Idempotency-Key is never stored or emitted.
#[derive(Clone)]
pub struct RuntimeLocationIdempotency {
    pub operation: String,
    pub key_hash: String,
    pub request_fingerprint: String,
}

#[derive(Clone)]
pub struct ProjectRuntimeLocationAuditEntry {
    pub action: String,
    pub result: String,
    pub trace_id: Option<String>,
    /// Safe JSON only; validation rejects path, ciphertext, fingerprint, and
    /// credential-bearing remote URL fields before this reaches the database.
    pub redacted_metadata_json: String,
}

#[derive(Clone, Default)]
pub struct ProjectRuntimeLocationAuditContext {
    pub trace_id: Option<String>,
}

/// Public create body. `Idempotency-Key` is parsed by the route as a header
/// and passed separately to the application service.
#[derive(Clone, Debug)]
pub struct CreateProjectRuntimeLocationRequest {
    pub runtime_target_id: String,
    pub runtime_target_kind: String,
    pub location_kind: String,
    pub path_flavor: String,
    pub root_locator: String,
    pub absolute_path: String,
    pub display_name: Option<String>,
}

/// Public update body. Its precondition is the `If-Match` header, not a
/// competing `expectedVersion` body property.
#[derive(Clone, Debug)]
pub struct UpdateProjectRuntimeLocationRequest {
    pub display_name: Option<String>,
}

/// Public rebind body. Its precondition is the `If-Match` header and the
/// absolute path is write-only.
#[derive(Clone, Debug)]
pub struct RebindProjectRuntimeLocationRequest {
    pub path_flavor: String,
    pub root_locator: String,
    pub absolute_path: String,
    pub display_name: Option<String>,
}

/// Public preference body. Its precondition is the `If-Match` header.
#[derive(Clone, Debug)]
pub struct SetProjectRuntimeLocationPreferenceRequest {
    pub capability: String,
    pub runtime_location_id: String,
}

/// A non-serializable result supplied only to a trusted execution authority.
/// `canonical_root` must never be returned by an app API, logged, or added to
/// telemetry attributes.
pub struct ResolvedProjectRuntimeLocationExecution {
    pub runtime_location_id: String,
    pub runtime_target_id: String,
    pub runtime_target_kind: String,
    pub location_kind: String,
    pub capability: RuntimeLocationCapability,
    pub canonical_root: PathBuf,
}
