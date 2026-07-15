use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitBranchSummary {
    pub name: String,
    pub is_current: bool,
    pub is_remote: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitWorktreeSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worktree_key: Option<String>,
    pub branch: Option<String>,
    pub head: Option<String>,
    pub is_current: bool,
    pub prunable_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusCounts {
    pub staged: usize,
    pub unstaged: usize,
    pub untracked: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum GitOverviewStatus {
    Ready,
    NotRepository,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitProjectOverview {
    pub branches: Vec<GitBranchSummary>,
    pub current_branch: Option<String>,
    pub current_revision: Option<String>,
    pub detached_head: bool,
    pub status: GitOverviewStatus,
    pub status_counts: GitStatusCounts,
    pub worktrees: Vec<GitWorktreeSummary>,
}

#[derive(Debug, Clone)]
pub enum GitMutationError {
    NotRepository,
    Validation(String),
    Mutate(String),
}

impl std::fmt::Display for GitMutationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotRepository => write!(f, "project is not a Git repository"),
            Self::Validation(msg) => write!(f, "{msg}"),
            Self::Mutate(msg) => write!(f, "git operation failed: {msg}"),
        }
    }
}

impl std::error::Error for GitMutationError {}

#[async_trait::async_trait]
pub trait GitOperations: Send + Sync {
    async fn inspect_overview(
        &self,
        project_root_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError>;

    async fn create_branch(
        &self,
        project_root_path: &str,
        branch_name: &str,
    ) -> Result<GitProjectOverview, GitMutationError>;

    async fn switch_branch(
        &self,
        project_root_path: &str,
        branch_name: &str,
    ) -> Result<GitProjectOverview, GitMutationError>;

    async fn commit_changes(
        &self,
        project_root_path: &str,
        message: &str,
    ) -> Result<GitProjectOverview, GitMutationError>;

    async fn push_branch(
        &self,
        project_root_path: &str,
        branch_name: Option<&str>,
        remote_name: Option<&str>,
    ) -> Result<GitProjectOverview, GitMutationError>;

    async fn create_worktree(
        &self,
        project_root_path: &str,
        branch_name: &str,
        worktree_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError>;

    async fn remove_worktree(
        &self,
        project_root_path: &str,
        worktree_path: &str,
        force: bool,
    ) -> Result<GitProjectOverview, GitMutationError>;

    async fn prune_worktrees(
        &self,
        project_root_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError>;
}
