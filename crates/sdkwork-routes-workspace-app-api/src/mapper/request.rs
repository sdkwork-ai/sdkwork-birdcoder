use serde::Deserialize;
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePathParams {
    pub workspace_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPathParams {
    pub project_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceListQuery {
    pub user_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectListQuery {
    pub workspace_id: Option<String>,
    pub root_path: Option<String>,
    pub user_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamListQuery {
    pub user_id: Option<String>,
    pub workspace_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct MemberListQuery {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectCollaboratorListQuery {
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentListQuery {
    pub project_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct DeploymentTargetListQuery {
    pub project_id: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkspaceBody {
    pub name: String,
    pub description: Option<String>,
    pub tenant_id: Option<String>,
    pub organization_id: Option<String>,
    pub data_scope: Option<String>,
    pub code: Option<String>,
    pub title: Option<String>,
    pub owner_id: Option<String>,
    pub leader_id: Option<String>,
    pub created_by_user_id: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "type")]
    pub entity_type: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub max_members: Option<i64>,
    pub current_members: Option<i64>,
    pub member_count: Option<i64>,
    pub max_storage: Option<String>,
    pub used_storage: Option<String>,
    pub settings: Option<Value>,
    pub is_public: Option<bool>,
    pub is_template: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWorkspaceBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub data_scope: Option<String>,
    pub code: Option<String>,
    pub title: Option<String>,
    pub owner_id: Option<String>,
    pub leader_id: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    #[serde(rename = "type")]
    pub entity_type: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub max_members: Option<i64>,
    pub current_members: Option<i64>,
    pub member_count: Option<i64>,
    pub max_storage: Option<String>,
    pub used_storage: Option<String>,
    pub settings: Option<Value>,
    pub is_public: Option<bool>,
    pub is_template: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectBody {
    pub workspace_id: String,
    pub name: String,
    pub description: Option<String>,
    pub workspace_uuid: Option<String>,
    pub tenant_id: Option<String>,
    pub organization_id: Option<String>,
    pub data_scope: Option<String>,
    pub user_id: Option<String>,
    pub parent_id: Option<String>,
    pub parent_uuid: Option<String>,
    pub parent_metadata: Option<Value>,
    pub code: Option<String>,
    pub title: Option<String>,
    pub owner_id: Option<String>,
    pub leader_id: Option<String>,
    pub created_by_user_id: Option<String>,
    pub author: Option<String>,
    #[serde(rename = "type")]
    pub entity_type: Option<String>,
    pub root_path: Option<String>,
    pub site_path: Option<String>,
    pub domain_prefix: Option<String>,
    pub file_id: Option<String>,
    pub conversation_id: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub budget_amount: Option<String>,
    pub cover_image: Option<Value>,
    pub is_template: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub data_scope: Option<String>,
    pub user_id: Option<String>,
    pub parent_id: Option<String>,
    pub parent_uuid: Option<String>,
    pub parent_metadata: Option<Value>,
    pub code: Option<String>,
    pub title: Option<String>,
    pub owner_id: Option<String>,
    pub leader_id: Option<String>,
    pub author: Option<String>,
    #[serde(rename = "type")]
    pub entity_type: Option<String>,
    pub root_path: Option<String>,
    pub site_path: Option<String>,
    pub domain_prefix: Option<String>,
    pub file_id: Option<String>,
    pub conversation_id: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub budget_amount: Option<String>,
    pub cover_image: Option<Value>,
    pub is_template: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGitBranchBody {
    pub branch_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchGitBranchBody {
    pub branch_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitGitChangesBody {
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushGitBranchBody {
    pub branch_name: Option<String>,
    pub remote_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGitWorktreeBody {
    pub branch_name: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveGitWorktreeBody {
    pub path: String,
    pub force: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertWorkspaceMemberBody {
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub team_id: Option<String>,
    pub role: Option<String>,
    pub status: Option<String>,
    pub created_by_user_id: Option<String>,
    pub granted_by_user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertProjectCollaboratorBody {
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub team_id: Option<String>,
    pub role: Option<String>,
    pub status: Option<String>,
    pub created_by_user_id: Option<String>,
    pub granted_by_user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishProjectBody {
    pub endpoint_url: Option<String>,
    pub environment_key: Option<String>,
    pub release_kind: Option<String>,
    pub release_version: Option<String>,
    pub rollout_stage: Option<String>,
    pub runtime: Option<String>,
    pub target_id: Option<String>,
    pub target_name: Option<String>,
}
