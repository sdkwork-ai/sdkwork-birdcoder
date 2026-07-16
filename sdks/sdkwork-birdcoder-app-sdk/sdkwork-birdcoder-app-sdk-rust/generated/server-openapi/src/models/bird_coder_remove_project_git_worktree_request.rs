use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderRemoveProjectGitWorktreeRequest {
    /// Verified project runtime-location identifier used for Git execution.
    #[serde(rename = "runtimeLocationId")]
    pub runtime_location_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub force: Option<bool>,

    #[serde(rename = "worktreeKey")]
    pub worktree_key: String,
}
