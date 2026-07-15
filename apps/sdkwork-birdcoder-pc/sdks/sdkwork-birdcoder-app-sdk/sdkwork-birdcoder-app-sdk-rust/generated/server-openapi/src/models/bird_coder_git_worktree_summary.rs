use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderGitWorktreeSummary {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub head: Option<String>,

    #[serde(rename = "isCurrent")]
    pub is_current: bool,

    #[serde(rename = "prunableReason")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prunable_reason: Option<String>,

    #[serde(rename = "worktreeKey")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub worktree_key: Option<String>,
}
