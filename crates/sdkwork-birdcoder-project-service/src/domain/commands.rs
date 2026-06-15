use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
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
    pub app_template_version_id: Option<String>,
    pub template_preset_key: Option<String>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectRequest {
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

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertProjectCollaboratorRequest {
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub team_id: Option<String>,
    pub role: Option<String>,
    pub status: Option<String>,
    pub created_by_user_id: Option<String>,
    pub granted_by_user_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectGitBranchRequest {
    pub branch_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchProjectGitBranchRequest {
    pub branch_name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitProjectGitChangesRequest {
    pub message: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushProjectGitBranchRequest {
    pub branch_name: Option<String>,
    pub remote_name: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectGitWorktreeRequest {
    pub branch_name: String,
    pub path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveProjectGitWorktreeRequest {
    pub force: Option<bool>,
    pub path: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishProjectRequest {
    pub endpoint_url: Option<String>,
    pub environment_key: Option<String>,
    pub release_kind: Option<String>,
    pub release_version: Option<String>,
    pub rollout_stage: Option<String>,
    pub runtime: Option<String>,
    pub target_id: Option<String>,
    pub target_name: Option<String>,
}
