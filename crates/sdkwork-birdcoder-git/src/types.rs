use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GitOverviewStatus {
    Ready,
    NotRepository,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusCounts {
    pub conflicted: usize,
    pub deleted: usize,
    pub modified: usize,
    pub staged: usize,
    pub untracked: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchSummary {
    pub ahead: usize,
    pub behind: usize,
    pub is_current: bool,
    pub kind: String,
    pub name: String,
    pub upstream_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktreeSummary {
    pub branch: Option<String>,
    pub head: Option<String>,
    pub id: String,
    pub is_current: bool,
    pub is_detached: bool,
    pub is_locked: bool,
    pub is_prunable: bool,
    pub label: String,
    pub locked_reason: Option<String>,
    pub path: String,
    pub prunable_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GitProjectOverview {
    pub branches: Vec<GitBranchSummary>,
    pub current_branch: Option<String>,
    pub current_revision: Option<String>,
    pub current_worktree_path: Option<String>,
    pub detached_head: bool,
    pub repository_root_path: Option<String>,
    pub status: GitOverviewStatus,
    pub status_counts: GitStatusCounts,
    pub worktrees: Vec<GitWorktreeSummary>,
}

#[derive(Debug, thiserror::Error)]
pub enum GitInspectionError {
    #[error("git repository inspection failed: {0}")]
    Inspect(String),
}

#[derive(Debug, thiserror::Error)]
pub enum GitMutationError {
    #[error("project is not a Git repository")]
    NotRepository,
    #[error("{0}")]
    Validation(String),
    #[error("git repository mutation failed: {0}")]
    Mutate(String),
}

#[derive(Debug)]
pub(crate) struct GitCommandError {
    pub(crate) message: String,
}

#[derive(Debug, Clone, Default)]
pub(crate) struct GitWorktreeEntry {
    pub(crate) path: String,
    pub(crate) head: Option<String>,
    pub(crate) branch: Option<String>,
    pub(crate) detached: bool,
    pub(crate) locked: bool,
}

impl GitWorktreeEntry {
    pub(crate) fn to_summary(&self) -> GitWorktreeSummary {
        GitWorktreeSummary {
            branch: self.branch.clone(),
            head: self.head.clone(),
            id: self.path.clone(),
            is_current: false,
            is_detached: self.detached,
            is_locked: self.locked,
            is_prunable: false,
            label: self
                .branch
                .clone()
                .unwrap_or_else(|| self.path.clone()),
            locked_reason: None,
            path: self.path.clone(),
            prunable_reason: None,
        }
    }
}
