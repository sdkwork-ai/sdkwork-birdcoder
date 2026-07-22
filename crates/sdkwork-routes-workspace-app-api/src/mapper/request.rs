use serde::Deserialize;

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
pub struct ProjectDocumentBindingPathParams {
    pub project_id: String,
    pub binding_id: String,
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
    pub runtime_location_id: String,
}

#[derive(Debug, Default, Deserialize)]
pub struct WorkspaceListQuery {
    pub user_id: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
pub struct ProjectListQuery {
    pub workspace_id: Option<String>,
    pub user_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateWorkspaceBody {
    pub name: String,
    pub description: Option<String>,
    pub code: Option<String>,
    pub icon_url: Option<String>,
    pub color: Option<String>,
    pub visibility: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateWorkspaceBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub code: Option<String>,
    pub icon_url: Option<String>,
    pub color: Option<String>,
    pub visibility: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateProjectBody {
    pub workspace_id: String,
    pub name: String,
    pub description: Option<String>,
    pub code: Option<String>,
    pub project_kind: Option<String>,
    pub default_agent_project_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateProjectBody {
    pub name: Option<String>,
    pub description: Option<String>,
    pub code: Option<String>,
    pub project_kind: Option<String>,
    pub default_agent_project_id: Option<String>,
    pub status: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpsertProjectDocumentBindingBody {
    pub document_id: String,
    pub binding_kind: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateProjectRuntimeLocationBody {
    pub runtime_target_id: String,
    pub runtime_target_kind: String,
    pub location_kind: String,
    pub path_flavor: String,
    pub absolute_path: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateProjectRuntimeLocationBody {
    pub display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RebindProjectRuntimeLocationBody {
    pub path_flavor: String,
    pub absolute_path: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SetProjectRuntimeLocationPreferenceBody {
    pub runtime_location_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpsertProjectSandboxBindingBody {
    pub sandbox_id: String,
    pub root_entry_id: String,
    pub logical_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateGitBranchBody {
    pub runtime_location_id: String,
    pub branch_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SwitchGitBranchBody {
    pub runtime_location_id: String,
    pub branch_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CommitGitChangesBody {
    pub runtime_location_id: String,
    pub include_unstaged: Option<bool>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PushGitBranchBody {
    pub runtime_location_id: String,
    pub branch_name: Option<String>,
    pub remote_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateGitWorktreeBody {
    pub runtime_location_id: String,
    pub branch_name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct RemoveGitWorktreeBody {
    pub runtime_location_id: String,
    pub worktree_key: String,
    pub force: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PruneGitWorktreesBody {
    pub runtime_location_id: String,
}
