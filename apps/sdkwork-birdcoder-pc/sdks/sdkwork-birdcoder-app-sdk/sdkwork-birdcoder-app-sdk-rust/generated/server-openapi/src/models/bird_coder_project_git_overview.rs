use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderGitBranchSummary, BirdCoderGitStatusCounts, BirdCoderGitWorktreeSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectGitOverview {
    pub branches: Vec<BirdCoderGitBranchSummary>,

    #[serde(rename = "currentBranch")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_branch: Option<String>,

    #[serde(rename = "currentRevision")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_revision: Option<String>,

    #[serde(rename = "detachedHead")]
    pub detached_head: bool,

    pub status: String,

    #[serde(rename = "statusCounts")]
    pub status_counts: BirdCoderGitStatusCounts,

    pub worktrees: Vec<BirdCoderGitWorktreeSummary>,
}
