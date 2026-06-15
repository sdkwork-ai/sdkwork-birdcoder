use rusqlite::Row;

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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            data_scope: row.get("data_scope")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            name: row.get("name")?,
            code: row.get("code")?,
            title: row.get("title")?,
            description: row.get("description")?,
            owner_id: row.get("owner_id")?,
            leader_id: row.get("leader_id")?,
            created_by_user_id: row.get("created_by_user_id")?,
            icon: row.get("icon")?,
            color: row.get("color")?,
            r#type: row.get("type")?,
            start_time: row.get("start_time")?,
            end_time: row.get("end_time")?,
            max_members: row.get("max_members")?,
            current_members: row.get("current_members")?,
            member_count: row.get("member_count")?,
            max_storage: row.get("max_storage")?,
            used_storage: row.get("used_storage")?,
            settings_json: row.get("settings_json")?,
            is_public: row.get("is_public")?,
            is_template: row.get("is_template")?,
            status: row.get("status")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            workspace_id: row.get("workspace_id")?,
            user_id: row.get("user_id")?,
            team_id: row.get("team_id")?,
            role: row.get("role")?,
            created_by_user_id: row.get("created_by_user_id")?,
            granted_by_user_id: row.get("granted_by_user_id")?,
            status: row.get("status")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            v: row.get("v")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            data_scope: row.get("data_scope")?,
            parent_id: row.get("parent_id")?,
            parent_uuid: row.get("parent_uuid")?,
            parent_metadata: row.get("parent_metadata")?,
            user_id: row.get("user_id")?,
            name: row.get("name")?,
            title: row.get("title")?,
            cover_image: row.get("cover_image")?,
            author: row.get("author")?,
            file_id: row.get("file_id")?,
            code: row.get("code")?,
            r#type: row.get("type")?,
            site_path: row.get("site_path")?,
            domain_prefix: row.get("domain_prefix")?,
            description: row.get("description")?,
            status: row.get("status")?,
            conversation_id: row.get("conversation_id")?,
            workspace_id: row.get("workspace_id")?,
            workspace_uuid: row.get("workspace_uuid")?,
            leader_id: row.get("leader_id")?,
            start_time: row.get("start_time")?,
            end_time: row.get("end_time")?,
            budget_amount: row.get("budget_amount")?,
            is_deleted: row.get("is_deleted")?,
            is_template: row.get("is_template")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            project_id: row.get("project_id")?,
            workspace_id: row.get("workspace_id")?,
            user_id: row.get("user_id")?,
            team_id: row.get("team_id")?,
            role: row.get("role")?,
            created_by_user_id: row.get("created_by_user_id")?,
            granted_by_user_id: row.get("granted_by_user_id")?,
            status: row.get("status")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            project_id: row.get("project_id")?,
            name: row.get("name")?,
            environment_key: row.get("environment_key")?,
            runtime: row.get("runtime")?,
            status: row.get("status")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            project_id: row.get("project_id")?,
            target_id: row.get("target_id")?,
            release_record_id: row.get("release_record_id")?,
            status: row.get("status")?,
            endpoint_url: row.get("endpoint_url")?,
            started_at: row.get("started_at")?,
            completed_at: row.get("completed_at")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            workspace_id: row.get("workspace_id")?,
            name: row.get("name")?,
            code: row.get("code")?,
            title: row.get("title")?,
            description: row.get("description")?,
            owner_id: row.get("owner_id")?,
            leader_id: row.get("leader_id")?,
            created_by_user_id: row.get("created_by_user_id")?,
            metadata_json: row.get("metadata_json")?,
            status: row.get("status")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            team_id: row.get("team_id")?,
            user_id: row.get("user_id")?,
            role: row.get("role")?,
            created_by_user_id: row.get("created_by_user_id")?,
            granted_by_user_id: row.get("granted_by_user_id")?,
            status: row.get("status")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            release_version: row.get("release_version")?,
            release_kind: row.get("release_kind")?,
            rollout_stage: row.get("rollout_stage")?,
            manifest_json: row.get("manifest_json")?,
            status: row.get("status")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            scope_type: row.get("scope_type")?,
            scope_id: row.get("scope_id")?,
            event_type: row.get("event_type")?,
            payload_json: row.get("payload_json")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            scope_type: row.get("scope_type")?,
            scope_id: row.get("scope_id")?,
            policy_category: row.get("policy_category")?,
            target_type: row.get("target_type")?,
            target_id: row.get("target_id")?,
            approval_policy: row.get("approval_policy")?,
            rationale: row.get("rationale")?,
            status: row.get("status")?,
        })
    }
}
