use sdkwork_birdcoder_git as birdcoder_git;
use sdkwork_birdcoder_project_service::ports::git::{
    GitBranchSummary, GitMutationError, GitOperations, GitOverviewStatus, GitProjectOverview,
    GitStatusCounts, GitWorktreeSummary,
};

struct ProcessGitOperations;

pub fn wire_git_operations() -> std::sync::Arc<dyn GitOperations> {
    std::sync::Arc::new(ProcessGitOperations)
}

#[async_trait::async_trait]
impl GitOperations for ProcessGitOperations {
    async fn inspect_overview(
        &self,
        project_root_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        let path = project_root_path.to_string();
        let overview = tokio::task::spawn_blocking(move || {
            birdcoder_git::inspect_project_git_overview(&path)
        })
        .await
        .map_err(|error| GitMutationError::Mutate(error.to_string()))?
        .map_err(map_inspection_error)?;

        Ok(map_git_overview(overview))
    }

    async fn create_branch(
        &self,
        project_root_path: &str,
        branch_name: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        let branch_name = branch_name.to_string();
        run_git_mutation(project_root_path, move |path| {
            birdcoder_git::create_project_git_branch(path, &branch_name)
        })
        .await
    }

    async fn switch_branch(
        &self,
        project_root_path: &str,
        branch_name: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        let branch_name = branch_name.to_string();
        run_git_mutation(project_root_path, move |path| {
            birdcoder_git::switch_project_git_branch(path, &branch_name)
        })
        .await
    }

    async fn commit_changes(
        &self,
        project_root_path: &str,
        message: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        let message = message.to_string();
        run_git_mutation(project_root_path, move |path| {
            birdcoder_git::commit_project_git_changes(path, &message)
        })
        .await
    }

    async fn push_branch(
        &self,
        project_root_path: &str,
        branch_name: Option<&str>,
        remote_name: Option<&str>,
    ) -> Result<GitProjectOverview, GitMutationError> {
        let branch_name = branch_name.map(str::to_string);
        let remote_name = remote_name.map(str::to_string);
        run_git_mutation(project_root_path, move |path| {
            birdcoder_git::push_project_git_branch(
                path,
                branch_name.as_deref(),
                remote_name.as_deref(),
            )
        })
        .await
    }

    async fn create_worktree(
        &self,
        project_root_path: &str,
        branch_name: &str,
        worktree_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        let branch_name = branch_name.to_string();
        let worktree_path = worktree_path.to_string();
        run_git_mutation(project_root_path, move |path| {
            birdcoder_git::create_project_git_worktree(path, &branch_name, &worktree_path)
        })
        .await
    }

    async fn remove_worktree(
        &self,
        project_root_path: &str,
        worktree_path: &str,
        force: bool,
    ) -> Result<GitProjectOverview, GitMutationError> {
        let worktree_path = worktree_path.to_string();
        run_git_mutation(project_root_path, move |path| {
            birdcoder_git::remove_project_git_worktree(path, &worktree_path, force)
        })
        .await
    }

    async fn prune_worktrees(
        &self,
        project_root_path: &str,
    ) -> Result<GitProjectOverview, GitMutationError> {
        run_git_mutation(project_root_path, |path| {
            birdcoder_git::prune_project_git_worktrees(path)
        })
        .await
    }
}

async fn run_git_mutation<F>(
    project_root_path: &str,
    operation: F,
) -> Result<GitProjectOverview, GitMutationError>
where
    F: FnOnce(&str) -> Result<birdcoder_git::GitProjectOverview, birdcoder_git::GitMutationError>
        + Send
        + 'static,
{
    let path = project_root_path.to_string();
    let overview = tokio::task::spawn_blocking(move || operation(&path))
        .await
        .map_err(|error| GitMutationError::Mutate(error.to_string()))?
        .map_err(map_mutation_error)?;

    Ok(map_git_overview(overview))
}

fn map_inspection_error(error: birdcoder_git::GitInspectionError) -> GitMutationError {
    GitMutationError::Mutate(error.to_string())
}

fn map_mutation_error(error: birdcoder_git::GitMutationError) -> GitMutationError {
    match error {
        birdcoder_git::GitMutationError::NotRepository => GitMutationError::NotRepository,
        birdcoder_git::GitMutationError::Validation(message) => GitMutationError::Validation(message),
        birdcoder_git::GitMutationError::Mutate(message) => GitMutationError::Mutate(message),
    }
}

fn map_git_overview(overview: birdcoder_git::GitProjectOverview) -> GitProjectOverview {
    GitProjectOverview {
        branches: overview
            .branches
            .into_iter()
            .map(|branch| GitBranchSummary {
                name: branch.name,
                is_current: branch.is_current,
                is_remote: branch.kind == "remote",
            })
            .collect(),
        current_branch: overview.current_branch,
        current_revision: overview.current_revision,
        current_worktree_path: overview.current_worktree_path,
        detached_head: overview.detached_head,
        repository_root_path: overview.repository_root_path,
        status: match overview.status {
            birdcoder_git::GitOverviewStatus::Ready => GitOverviewStatus::Ready,
            birdcoder_git::GitOverviewStatus::NotRepository => GitOverviewStatus::NotRepository,
        },
        status_counts: GitStatusCounts {
            staged: overview.status_counts.staged,
            unstaged: overview.status_counts.modified + overview.status_counts.deleted,
            untracked: overview.status_counts.untracked,
        },
        worktrees: overview
            .worktrees
            .into_iter()
            .map(|worktree| GitWorktreeSummary {
                path: worktree.path,
                branch: worktree.branch,
                head: worktree.head,
                is_current: worktree.is_current,
                prunable_reason: worktree.prunable_reason,
            })
            .collect(),
    }
}
