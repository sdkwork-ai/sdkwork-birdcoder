use std::path::{Component, Path};

use sdkwork_birdcoder_git as birdcoder_git;
use sdkwork_birdcoder_project_service::domain::commands::is_valid_worktree_key;
use sdkwork_birdcoder_project_service::ports::git::{
    GitBranchSummary, GitMutationError, GitOperations, GitOverviewStatus, GitProjectDiff,
    GitProjectOverview, GitStatusCounts, GitWorktreeSummary,
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
        let project_root_path = project_root_path.to_string();
        let inspect_path = project_root_path.clone();
        let overview = tokio::task::spawn_blocking(move || {
            birdcoder_git::inspect_project_git_overview(&inspect_path)
        })
        .await
        .map_err(|error| GitMutationError::Mutate(error.to_string()))?
        .map_err(map_inspection_error)?;

        Ok(map_git_overview(&project_root_path, overview))
    }

    async fn inspect_diff(
        &self,
        project_root_path: &str,
    ) -> Result<GitProjectDiff, GitMutationError> {
        let project_root_path = project_root_path.to_string();
        tokio::task::spawn_blocking(move || {
            birdcoder_git::inspect_project_git_diff(&project_root_path)
        })
        .await
        .map_err(|error| GitMutationError::Mutate(error.to_string()))?
        .map(|diff| GitProjectDiff {
            patch: diff.patch,
            truncated: diff.truncated,
        })
        .map_err(map_mutation_error)
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
        include_unstaged: bool,
    ) -> Result<GitProjectOverview, GitMutationError> {
        let message = message.to_string();
        run_git_mutation(project_root_path, move |path| {
            birdcoder_git::commit_project_git_changes(path, &message, include_unstaged)
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
    let project_root_path = project_root_path.to_string();
    let operation_path = project_root_path.clone();
    let overview = tokio::task::spawn_blocking(move || operation(&operation_path))
        .await
        .map_err(|error| GitMutationError::Mutate(error.to_string()))?
        .map_err(map_mutation_error)?;

    Ok(map_git_overview(&project_root_path, overview))
}

fn map_inspection_error(error: birdcoder_git::GitInspectionError) -> GitMutationError {
    GitMutationError::Mutate(error.to_string())
}

fn map_mutation_error(error: birdcoder_git::GitMutationError) -> GitMutationError {
    match error {
        birdcoder_git::GitMutationError::NotRepository => GitMutationError::NotRepository,
        birdcoder_git::GitMutationError::Validation(message) => {
            GitMutationError::Validation(message)
        }
        birdcoder_git::GitMutationError::Mutate(message) => GitMutationError::Mutate(message),
    }
}

fn map_git_overview(
    project_root_path: &str,
    overview: birdcoder_git::GitProjectOverview,
) -> GitProjectOverview {
    let project_root = Path::new(project_root_path);
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
        detached_head: overview.detached_head,
        status: match overview.status {
            birdcoder_git::GitOverviewStatus::Ready => GitOverviewStatus::Ready,
            birdcoder_git::GitOverviewStatus::NotRepository => GitOverviewStatus::NotRepository,
        },
        status_counts: GitStatusCounts {
            staged: overview.status_counts.staged,
            unstaged: overview.status_counts.modified
                + overview.status_counts.deleted
                + overview.status_counts.conflicted,
            untracked: overview.status_counts.untracked,
        },
        worktrees: overview
            .worktrees
            .into_iter()
            .map(|worktree| GitWorktreeSummary {
                worktree_key: managed_worktree_key(project_root, Path::new(&worktree.path)),
                branch: worktree.branch,
                head: worktree.head,
                is_current: worktree.is_current,
                prunable_reason: worktree.prunable_reason,
            })
            .collect(),
    }
}

fn managed_worktree_key(project_root: &Path, worktree_path: &Path) -> Option<String> {
    let managed_root = project_root.join(".sdkwork-worktrees");
    let relative_path = worktree_path.strip_prefix(managed_root).ok()?;
    let Component::Normal(key) = relative_path.components().next()? else {
        return None;
    };
    if relative_path.components().count() != 1 {
        return None;
    }
    let key = key.to_str()?;
    is_valid_worktree_key(key).then(|| key.to_owned())
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use sdkwork_birdcoder_project_service::ports::git::{GitOperations, GitOverviewStatus};

    use super::{managed_worktree_key, ProcessGitOperations};

    const WORKTREE_KEY: &str = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    #[test]
    fn exposes_only_direct_managed_worktree_keys() {
        let project_root = Path::new("project-root");
        let managed_worktree = project_root.join(".sdkwork-worktrees").join(WORKTREE_KEY);

        assert_eq!(
            managed_worktree_key(project_root, &managed_worktree),
            Some(WORKTREE_KEY.to_owned())
        );
        assert_eq!(
            managed_worktree_key(project_root, &managed_worktree.join("nested")),
            None
        );
        assert_eq!(
            managed_worktree_key(project_root, &project_root.join("other-worktree")),
            None
        );
        assert_eq!(
            managed_worktree_key(
                project_root,
                &project_root
                    .join(".sdkwork-worktrees")
                    .join("not-a-managed-worktree")
            ),
            None
        );
    }

    #[tokio::test]
    async fn empty_project_directory_reports_not_repository() {
        let project_root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-git-overview-{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&project_root).expect("create empty project directory");

        let overview = ProcessGitOperations
            .inspect_overview(project_root.to_string_lossy().as_ref())
            .await
            .expect("inspect empty project directory");

        assert!(matches!(overview.status, GitOverviewStatus::NotRepository));
        assert!(overview.branches.is_empty());
        let _ = std::fs::remove_dir_all(project_root);
    }
}
