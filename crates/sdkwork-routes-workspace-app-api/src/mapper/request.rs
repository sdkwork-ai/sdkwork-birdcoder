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
pub struct ProjectRuntimeLocationPathParams {
    pub project_id: String,
    pub runtime_location_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRuntimeLocationPreferencePathParams {
    pub capability: String,
    pub project_id: String,
}

#[derive(Debug, Deserialize)]
pub struct ProjectGitRuntimeLocationQuery {
    #[serde(rename = "runtime_location_id")]
    pub runtime_location_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceListQuery {
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectListQuery {
    pub workspace_id: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamListQuery {
    pub user_id: Option<String>,
    pub workspace_id: Option<String>,
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
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateProjectRuntimeLocationBody {
    pub runtime_target_id: String,
    pub runtime_target_kind: String,
    pub location_kind: String,
    pub path_flavor: String,
    pub root_locator: String,
    pub absolute_path: String,
    pub display_name: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateProjectRuntimeLocationBody {
    pub display_name: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RebindProjectRuntimeLocationBody {
    pub path_flavor: String,
    pub root_locator: String,
    pub absolute_path: String,
    pub display_name: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SetProjectRuntimeLocationPreferenceBody {
    pub runtime_location_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpsertProjectWorkspaceBindingBody {
    pub sandbox_id: String,
    pub root_entry_id: String,
    pub logical_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGitBranchBody {
    pub runtime_location_id: String,
    pub branch_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchGitBranchBody {
    pub runtime_location_id: String,
    pub branch_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitGitChangesBody {
    pub runtime_location_id: String,
    pub include_unstaged: Option<bool>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PushGitBranchBody {
    pub runtime_location_id: String,
    pub branch_name: Option<String>,
    pub remote_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGitWorktreeBody {
    pub runtime_location_id: String,
    pub branch_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveGitWorktreeBody {
    pub runtime_location_id: String,
    pub worktree_key: String,
    pub force: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PruneGitWorktreesBody {
    pub runtime_location_id: String,
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
    pub user_id: String,
    pub role: Option<String>,
    pub status: Option<String>,
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
