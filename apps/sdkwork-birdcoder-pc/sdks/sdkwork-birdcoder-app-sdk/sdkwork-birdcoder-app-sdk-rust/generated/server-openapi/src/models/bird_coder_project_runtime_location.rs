use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectRuntimeLocation {
    pub id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,

    #[serde(rename = "projectId")]
    pub project_id: String,

    #[serde(rename = "runtimeTargetId")]
    pub runtime_target_id: String,

    #[serde(rename = "runtimeTargetKind")]
    pub runtime_target_kind: String,

    #[serde(rename = "locationKind")]
    pub location_kind: String,

    #[serde(rename = "pathFlavor")]
    pub path_flavor: String,

    /// Opaque, path-free runtime target locator. It is not a filesystem path.
    #[serde(rename = "rootLocator")]
    pub root_locator: String,

    /// Safe display label for this location.
    #[serde(rename = "displayName")]
    pub display_name: String,

    /// Whether encrypted absolute path material is registered. The path itself is never returned.
    #[serde(rename = "hasAbsolutePath")]
    pub has_absolute_path: bool,

    #[serde(rename = "terminalAvailable")]
    pub terminal_available: bool,

    #[serde(rename = "gitAvailable")]
    pub git_available: bool,

    #[serde(rename = "buildAvailable")]
    pub build_available: bool,

    #[serde(rename = "fileSystemAvailable")]
    pub file_system_available: bool,

    #[serde(rename = "healthStatus")]
    pub health_status: String,

    #[serde(rename = "lastVerifiedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_verified_at: Option<String>,

    #[serde(rename = "lastSeenAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_seen_at: Option<String>,

    /// Credential-free sanitized Git repository URL reported by a trusted target.
    #[serde(rename = "gitRepositoryUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_repository_url: Option<String>,

    #[serde(rename = "gitRemoteName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_remote_name: Option<String>,

    #[serde(rename = "gitBranch")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_branch: Option<String>,

    #[serde(rename = "gitCommit")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_commit: Option<String>,

    #[serde(rename = "gitWorktreeKey")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_worktree_key: Option<String>,

    /// Optimistic concurrency version used with the If-Match request header.
    pub version: String,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}
