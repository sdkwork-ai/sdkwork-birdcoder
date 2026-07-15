use serde::Deserialize;

pub struct CreateProjectRequest {
    pub workspace_id: String,
    pub name: String,
    pub description: Option<String>,
}

pub struct UpdateProjectRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpsertProjectCollaboratorRequest {
    pub user_id: String,
    pub role: Option<String>,
    pub status: Option<String>,
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
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveProjectGitWorktreeRequest {
    pub force: Option<bool>,
    pub worktree_key: String,
}

pub fn is_valid_worktree_key(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
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
