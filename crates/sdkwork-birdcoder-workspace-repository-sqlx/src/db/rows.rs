use sdkwork_birdcoder_sqlx_repository_pool::dialect::row_get_bool_as_i64;
use sqlx::Row;

#[derive(Clone, Debug)]
pub struct WorkspaceRow {
    pub id: i64,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub data_scope: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub name: String,
    pub code: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub owner_id: i64,
    pub leader_id: Option<i64>,
    pub created_by_user_id: Option<i64>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub r#type: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub max_members: Option<i64>,
    pub current_members: Option<i64>,
    pub member_count: Option<i64>,
    pub max_storage: Option<i64>,
    pub used_storage: Option<i64>,
    pub settings_json: Option<String>,
    pub is_public: i64,
    pub is_template: i64,
    pub status: String,
}

impl WorkspaceRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            data_scope: row.try_get("data_scope")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            name: row.try_get("name")?,
            code: row.try_get("code")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            owner_id: row.try_get("owner_id")?,
            leader_id: row.try_get("leader_id")?,
            created_by_user_id: row.try_get("created_by_user_id")?,
            icon: row.try_get("icon")?,
            color: row.try_get("color")?,
            r#type: row.try_get("type")?,
            start_time: row.try_get("start_time")?,
            end_time: row.try_get("end_time")?,
            max_members: row.try_get("max_members")?,
            current_members: row.try_get("current_members")?,
            member_count: row.try_get("member_count")?,
            max_storage: row.try_get("max_storage")?,
            used_storage: row.try_get("used_storage")?,
            settings_json: row.try_get("settings_json")?,
            is_public: row_get_bool_as_i64(row, "is_public")?,
            is_template: row_get_bool_as_i64(row, "is_template")?,
            status: row.try_get("status")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct WorkspaceMemberRow {
    pub id: i64,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub workspace_id: i64,
    pub user_id: i64,
    pub team_id: Option<i64>,
    pub role: String,
    pub created_by_user_id: Option<i64>,
    pub granted_by_user_id: Option<i64>,
    pub status: String,
}

impl WorkspaceMemberRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            workspace_id: row.try_get("workspace_id")?,
            user_id: row.try_get("user_id")?,
            team_id: row.try_get("team_id")?,
            role: row.try_get("role")?,
            created_by_user_id: row.try_get("created_by_user_id")?,
            granted_by_user_id: row.try_get("granted_by_user_id")?,
            status: row.try_get("status")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct ProjectRow {
    pub id: i64,
    pub uuid: String,
    pub created_at: String,
    pub updated_at: String,
    pub v: i64,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub data_scope: i64,
    pub parent_id: Option<i64>,
    pub parent_uuid: Option<String>,
    pub parent_metadata: Option<String>,
    pub user_id: Option<i64>,
    pub name: String,
    pub title: String,
    pub cover_image: Option<String>,
    pub author: Option<String>,
    pub file_id: Option<i64>,
    pub code: String,
    pub r#type: i64,
    pub site_path: Option<String>,
    pub domain_prefix: Option<String>,
    pub description: Option<String>,
    pub status: i64,
    pub conversation_id: Option<i64>,
    pub workspace_id: Option<i64>,
    pub workspace_uuid: Option<String>,
    pub leader_id: Option<i64>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub budget_amount: Option<i64>,
    pub is_deleted: i64,
    pub is_template: i64,
}

impl ProjectRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            v: row.try_get("v")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            data_scope: row.try_get("data_scope")?,
            parent_id: row.try_get("parent_id")?,
            parent_uuid: row.try_get("parent_uuid")?,
            parent_metadata: row.try_get("parent_metadata")?,
            user_id: row.try_get("user_id")?,
            name: row.try_get("name")?,
            title: row.try_get("title")?,
            cover_image: row.try_get("cover_image")?,
            author: row.try_get("author")?,
            file_id: row.try_get("file_id")?,
            code: row.try_get("code")?,
            r#type: row.try_get("type")?,
            site_path: row.try_get("site_path")?,
            domain_prefix: row.try_get("domain_prefix")?,
            description: row.try_get("description")?,
            status: row.try_get("status")?,
            conversation_id: row.try_get("conversation_id")?,
            workspace_id: row.try_get("workspace_id")?,
            workspace_uuid: row.try_get("workspace_uuid")?,
            leader_id: row.try_get("leader_id")?,
            start_time: row.try_get("start_time")?,
            end_time: row.try_get("end_time")?,
            budget_amount: row.try_get("budget_amount")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            is_template: row.try_get("is_template")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct ProjectCollaboratorRow {
    pub id: i64,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub project_id: i64,
    pub workspace_id: i64,
    pub user_id: i64,
    pub team_id: Option<i64>,
    pub role: String,
    pub created_by_user_id: Option<i64>,
    pub granted_by_user_id: Option<i64>,
    pub status: String,
}

impl ProjectCollaboratorRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            project_id: row.try_get("project_id")?,
            workspace_id: row.try_get("workspace_id")?,
            user_id: row.try_get("user_id")?,
            team_id: row.try_get("team_id")?,
            role: row.try_get("role")?,
            created_by_user_id: row.try_get("created_by_user_id")?,
            granted_by_user_id: row.try_get("granted_by_user_id")?,
            status: row.try_get("status")?,
        })
    }
}

#[derive(Clone)]
pub struct ProjectRuntimeLocationRow {
    pub id: String,
    pub uuid: String,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub project_id: i64,
    pub registered_by_user_id: i64,
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
    pub verified_by_user_id: Option<i64>,
    pub git_repository_url: Option<String>,
    pub git_remote_name: Option<String>,
    pub git_branch: Option<String>,
    pub git_commit: Option<String>,
    pub git_worktree_key: Option<String>,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
    pub is_deleted: i64,
}

impl ProjectRuntimeLocationRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            project_id: row.try_get("project_id")?,
            registered_by_user_id: row.try_get("registered_by_user_id")?,
            runtime_target_id: row.try_get("runtime_target_id")?,
            runtime_target_kind: row.try_get("runtime_target_kind")?,
            location_kind: row.try_get("location_kind")?,
            path_flavor: row.try_get("path_flavor")?,
            root_locator: row.try_get("root_locator")?,
            display_name: row.try_get("display_name")?,
            encrypted_absolute_path: row.try_get("encrypted_absolute_path")?,
            path_encryption_key_id: row.try_get("path_encryption_key_id")?,
            path_fingerprint: row.try_get("path_fingerprint")?,
            terminal_available: row_get_bool_as_i64(row, "terminal_available")? != 0,
            git_available: row_get_bool_as_i64(row, "git_available")? != 0,
            build_available: row_get_bool_as_i64(row, "build_available")? != 0,
            file_system_available: row_get_bool_as_i64(row, "file_system_available")? != 0,
            health_status: row.try_get("health_status")?,
            last_verified_at: row.try_get("last_verified_at")?,
            last_seen_at: row.try_get("last_seen_at")?,
            verified_by_user_id: row.try_get("verified_by_user_id")?,
            git_repository_url: row.try_get("git_repository_url")?,
            git_remote_name: row.try_get("git_remote_name")?,
            git_branch: row.try_get("git_branch")?,
            git_commit: row.try_get("git_commit")?,
            git_worktree_key: row.try_get("git_worktree_key")?,
            version: row.try_get("version")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
        })
    }
}

#[derive(Clone)]
pub struct ProjectRuntimeLocationPreferenceRow {
    pub id: String,
    pub uuid: String,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub project_id: i64,
    pub subject_user_id: i64,
    pub capability: String,
    pub runtime_location_id: String,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
    pub is_deleted: i64,
}

impl ProjectRuntimeLocationPreferenceRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            project_id: row.try_get("project_id")?,
            subject_user_id: row.try_get("subject_user_id")?,
            capability: row.try_get("capability")?,
            runtime_location_id: row.try_get("runtime_location_id")?,
            version: row.try_get("version")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
        })
    }
}

#[derive(Clone)]
pub struct ProjectWorkspaceBindingRow {
    pub id: String,
    pub project_id: i64,
    pub sandbox_id: String,
    pub root_entry_id: String,
    pub logical_path: String,
    pub lifecycle_status: String,
    pub version: i64,
    pub created_at: String,
    pub updated_at: String,
}

impl ProjectWorkspaceBindingRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            project_id: row.try_get("project_id")?,
            sandbox_id: row.try_get("sandbox_id")?,
            root_entry_id: row.try_get("root_entry_id")?,
            logical_path: row.try_get("logical_path")?,
            lifecycle_status: row.try_get("lifecycle_status")?,
            version: row.try_get("version")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct DeploymentTargetRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub project_id: String,
    pub name: String,
    pub environment_key: String,
    pub runtime: String,
    pub status: String,
}

impl DeploymentTargetRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            project_id: row.try_get("project_id")?,
            name: row.try_get("name")?,
            environment_key: row.try_get("environment_key")?,
            runtime: row.try_get("runtime")?,
            status: row.try_get("status")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct DeploymentRecordRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub project_id: String,
    pub target_id: String,
    pub release_record_id: Option<String>,
    pub status: String,
    pub endpoint_url: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

impl DeploymentRecordRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            project_id: row.try_get("project_id")?,
            target_id: row.try_get("target_id")?,
            release_record_id: row.try_get("release_record_id")?,
            status: row.try_get("status")?,
            endpoint_url: row.try_get("endpoint_url")?,
            started_at: row.try_get("started_at")?,
            completed_at: row.try_get("completed_at")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct TeamRow {
    pub id: i64,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub workspace_id: i64,
    pub name: String,
    pub code: Option<String>,
    pub title: Option<String>,
    pub description: Option<String>,
    pub owner_id: i64,
    pub leader_id: Option<i64>,
    pub created_by_user_id: Option<i64>,
    pub metadata_json: Option<String>,
    pub status: String,
}

impl TeamRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            workspace_id: row.try_get("workspace_id")?,
            name: row.try_get("name")?,
            code: row.try_get("code")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            owner_id: row.try_get("owner_id")?,
            leader_id: row.try_get("leader_id")?,
            created_by_user_id: row.try_get("created_by_user_id")?,
            metadata_json: row.try_get("metadata_json")?,
            status: row.try_get("status")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct TeamMemberRow {
    pub id: i64,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub team_id: i64,
    pub user_id: i64,
    pub role: String,
    pub created_by_user_id: Option<i64>,
    pub granted_by_user_id: Option<i64>,
    pub status: String,
}

impl TeamMemberRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            team_id: row.try_get("team_id")?,
            user_id: row.try_get("user_id")?,
            role: row.try_get("role")?,
            created_by_user_id: row.try_get("created_by_user_id")?,
            granted_by_user_id: row.try_get("granted_by_user_id")?,
            status: row.try_get("status")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct ReleaseRecordRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub release_version: String,
    pub release_kind: String,
    pub rollout_stage: String,
    pub manifest_json: String,
    pub status: String,
}

impl ReleaseRecordRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            release_version: row.try_get("release_version")?,
            release_kind: row.try_get("release_kind")?,
            rollout_stage: row.try_get("rollout_stage")?,
            manifest_json: row.try_get("manifest_json")?,
            status: row.try_get("status")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct AuditEventRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub scope_type: String,
    pub scope_id: String,
    pub event_type: String,
    pub payload_json: String,
}

impl AuditEventRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            scope_type: row.try_get("scope_type")?,
            scope_id: row.try_get("scope_id")?,
            event_type: row.try_get("event_type")?,
            payload_json: row.try_get("payload_json")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct GovernancePolicyRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub scope_type: String,
    pub scope_id: String,
    pub policy_category: String,
    pub target_type: String,
    pub target_id: String,
    pub approval_policy: String,
    pub rationale: Option<String>,
    pub status: String,
}

impl GovernancePolicyRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            scope_type: row.try_get("scope_type")?,
            scope_id: row.try_get("scope_id")?,
            policy_category: row.try_get("policy_category")?,
            target_type: row.try_get("target_type")?,
            target_id: row.try_get("target_id")?,
            approval_policy: row.try_get("approval_policy")?,
            rationale: row.try_get("rationale")?,
            status: row.try_get("status")?,
        })
    }
}
