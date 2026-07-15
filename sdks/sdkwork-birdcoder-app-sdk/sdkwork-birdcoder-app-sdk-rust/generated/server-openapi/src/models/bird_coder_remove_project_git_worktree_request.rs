use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderRemoveProjectGitWorktreeRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub force: Option<bool>,

    #[serde(rename = "worktreeKey")]
    pub worktree_key: String,
}
