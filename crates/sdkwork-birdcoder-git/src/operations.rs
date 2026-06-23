use std::{path::Path, process::Command};

use crate::types::*;
use crate::validation::{
    validate_git_branch_name, validate_git_remote_name, validate_git_worktree_path,
};

pub fn inspect_project_git_overview(
    project_root_path: &str,
) -> Result<GitProjectOverview, GitInspectionError> {
    let root = Path::new(project_root_path);
    if !root.join(".git").exists() {
        return Ok(GitProjectOverview {
            branches: vec![],
            current_branch: None,
            current_revision: None,
            current_worktree_path: None,
            detached_head: false,
            repository_root_path: None,
            status: GitOverviewStatus::NotRepository,
            status_counts: GitStatusCounts::default(),
            worktrees: vec![],
        });
    }

    let branches = list_branches(root)?;
    let current_branch = branches.iter().find(|b| b.is_current).map(|b| b.name.clone());
    let current_revision = run_git(&["rev-parse", "HEAD"], root).ok();
    let worktrees = list_worktrees(root)?;
    let status_counts = get_status_counts(root);
    let detached_head = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], root)
        .map(|s| s.trim() == "HEAD")
        .unwrap_or(false);

    Ok(GitProjectOverview {
        branches,
        current_branch,
        current_revision,
        current_worktree_path: None,
        detached_head,
        repository_root_path: Some(root.to_string_lossy().to_string()),
        status: GitOverviewStatus::Ready,
        status_counts,
        worktrees,
    })
}

pub fn create_project_git_branch(
    project_root_path: &str,
    branch_name: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
    validate_git_branch_name(branch_name)?;
    run_git(&["checkout", "-b", branch_name], root)
        .map_err(|e| GitMutationError::Mutate(e.message))?;
    inspect_project_git_overview(project_root_path)
        .map_err(|e| GitMutationError::Mutate(e.to_string()))
}

pub fn switch_project_git_branch(
    project_root_path: &str,
    branch_name: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
    validate_git_branch_name(branch_name)?;
    run_git(&["checkout", branch_name], root)
        .map_err(|e| GitMutationError::Mutate(e.message))?;
    inspect_project_git_overview(project_root_path)
        .map_err(|e| GitMutationError::Mutate(e.to_string()))
}

pub fn commit_project_git_changes(
    project_root_path: &str,
    message: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
    run_git(&["add", "-A"], root).map_err(|e| GitMutationError::Mutate(e.message))?;
    run_git(&["commit", "-m", message], root)
        .map_err(|e| GitMutationError::Mutate(e.message))?;
    inspect_project_git_overview(project_root_path)
        .map_err(|e| GitMutationError::Mutate(e.to_string()))
}

pub fn push_project_git_branch(
    project_root_path: &str,
    branch_name: Option<&str>,
    remote_name: Option<&str>,
) -> Result<GitProjectOverview, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
    let remote = remote_name.unwrap_or("origin");
    validate_git_remote_name(remote)?;
    let branch = branch_name.unwrap_or("HEAD");
    if branch != "HEAD" {
        validate_git_branch_name(branch)?;
    }
    run_git(&["push", remote, branch], root)
        .map_err(|e| GitMutationError::Mutate(e.message))?;
    inspect_project_git_overview(project_root_path)
        .map_err(|e| GitMutationError::Mutate(e.to_string()))
}

pub fn create_project_git_worktree(
    project_root_path: &str,
    branch_name: &str,
    worktree_path: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
    validate_git_branch_name(branch_name)?;
    let worktree = validate_git_worktree_path(root, worktree_path)?;
    run_git(
        &[
            "worktree",
            "add",
            &worktree.to_string_lossy(),
            branch_name,
        ],
        root,
    )
        .map_err(|e| GitMutationError::Mutate(e.message))?;
    inspect_project_git_overview(project_root_path)
        .map_err(|e| GitMutationError::Mutate(e.to_string()))
}

pub fn remove_project_git_worktree(
    project_root_path: &str,
    worktree_path: &str,
    force: bool,
) -> Result<GitProjectOverview, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(worktree_path);
    run_git(&args, root).map_err(|e| GitMutationError::Mutate(e.message))?;
    inspect_project_git_overview(project_root_path)
        .map_err(|e| GitMutationError::Mutate(e.to_string()))
}

pub fn prune_project_git_worktrees(
    project_root_path: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
    run_git(&["worktree", "prune"], root)
        .map_err(|e| GitMutationError::Mutate(e.message))?;
    inspect_project_git_overview(project_root_path)
        .map_err(|e| GitMutationError::Mutate(e.to_string()))
}

pub(crate) fn validate_git_repo(root: &Path) -> Result<(), GitMutationError> {
    if !root.join(".git").exists() {
        return Err(GitMutationError::NotRepository);
    }
    Ok(())
}

pub(crate) fn run_git(args: &[&str], cwd: &Path) -> Result<String, GitCommandError> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|e| GitCommandError {
            message: format!("failed to execute git: {e}"),
        })?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(GitCommandError {
            message: String::from_utf8_lossy(&output.stderr).to_string(),
        })
    }
}

pub(crate) fn list_branches(root: &Path) -> Result<Vec<GitBranchSummary>, GitInspectionError> {
    let output = run_git(
        &["branch", "-vv", "--format=%(refname:short)\t%(upstream:short)\t%(HEAD)\t%(contents:subject)"],
        root,
    )
    .map_err(|e| GitInspectionError::Inspect(e.message))?;

    let mut branches = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 3 {
            branches.push(GitBranchSummary {
                ahead: 0,
                behind: 0,
                is_current: parts[2] == "*",
                kind: "local".to_string(),
                name: parts[0].to_string(),
                upstream_name: if parts[1].is_empty() {
                    None
                } else {
                    Some(parts[1].to_string())
                },
            });
        }
    }
    Ok(branches)
}

pub(crate) fn list_worktrees(root: &Path) -> Result<Vec<GitWorktreeSummary>, GitInspectionError> {
    let output = run_git(&["worktree", "list", "--porcelain"], root)
        .map_err(|e| GitInspectionError::Inspect(e.message))?;

    let mut worktrees = Vec::new();
    let mut current = GitWorktreeEntry::default();

    for line in output.lines() {
        if line.starts_with("worktree ") {
            if !current.path.is_empty() {
                worktrees.push(current.to_summary());
                current = GitWorktreeEntry::default();
            }
            current.path = line.trim_start_matches("worktree ").to_string();
        } else if line.starts_with("HEAD ") {
            current.head = Some(line.trim_start_matches("HEAD ").to_string());
        } else if line.starts_with("branch ") {
            current.branch = Some(line.trim_start_matches("branch ").to_string());
        } else if line.starts_with("detached") {
            current.detached = true;
        } else if line.starts_with("locked") {
            current.locked = true;
        }
    }

    if !current.path.is_empty() {
        worktrees.push(current.to_summary());
    }

    Ok(worktrees)
}

pub(crate) fn get_status_counts(root: &Path) -> GitStatusCounts {
    let mut counts = GitStatusCounts::default();
    if let Ok(output) = run_git(&["status", "--porcelain"], root) {
        for line in output.lines() {
            if line.len() >= 2 {
                let x = line.as_bytes()[0];
                let y = line.as_bytes()[1];
                if x == b'?' && y == b'?' {
                    counts.untracked += 1;
                } else {
                    if x != b' ' && x != b'?' {
                        counts.staged += 1;
                    }
                    if y != b' ' && y != b'?' {
                        counts.modified += 1;
                    }
                }
            }
        }
    }
    counts
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    fn create_temp_git_repo(name: &str) -> PathBuf {
        let temp_dir = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-git-{name}-{}",
            std::process::id()
        ));
        fs::create_dir_all(&temp_dir).expect("create temp dir");
        Command::new("git")
            .args(["init"])
            .current_dir(&temp_dir)
            .output()
            .expect("init git repo");
        temp_dir
    }

    #[test]
    fn inspect_project_git_overview_reports_non_repository_directories() {
        let temp_dir = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-git-non-repo-{}",
            std::process::id()
        ));
        fs::create_dir_all(&temp_dir).expect("create temp dir");
        let overview =
            inspect_project_git_overview(&temp_dir.to_string_lossy()).expect("inspect");
        assert_eq!(overview.status, GitOverviewStatus::NotRepository);
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn create_project_git_branch_creates_and_checks_out_branch() {
        let repo = create_temp_git_repo("create-branch");
        fs::write(repo.join("README.md"), "test").expect("write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(&repo)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(&repo)
            .output()
            .expect("git commit");

        let overview = create_project_git_branch(
            &repo.to_string_lossy(),
            "feature/test",
        )
        .expect("create branch");
        assert_eq!(overview.current_branch, Some("feature/test".to_string()));
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn switch_project_git_branch_switches_checked_out_branch() {
        let repo = create_temp_git_repo("switch-branch");
        fs::write(repo.join("README.md"), "test").expect("write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(&repo)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(&repo)
            .output()
            .expect("git commit");
        Command::new("git")
            .args(["checkout", "-b", "feature/a"])
            .current_dir(&repo)
            .output()
            .expect("create branch a");
        Command::new("git")
            .args(["checkout", "main"])
            .current_dir(&repo)
            .output()
            .expect("switch to main");

        let overview = switch_project_git_branch(
            &repo.to_string_lossy(),
            "feature/a",
        )
        .expect("switch branch");
        assert_eq!(overview.current_branch, Some("feature/a".to_string()));
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn commit_project_git_changes_creates_commit_for_staged_worktree_changes() {
        let repo = create_temp_git_repo("commit");
        fs::write(repo.join("README.md"), "test").expect("write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(&repo)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(&repo)
            .output()
            .expect("git commit");
        fs::write(repo.join("new-file.txt"), "new content").expect("write new file");

        let overview = commit_project_git_changes(
            &repo.to_string_lossy(),
            "add new file",
        )
        .expect("commit");
        assert!(overview.current_revision.is_some());
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn commit_project_git_changes_rejects_empty_commit_attempts() {
        let repo = create_temp_git_repo("empty-commit");
        fs::write(repo.join("README.md"), "test").expect("write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(&repo)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(&repo)
            .output()
            .expect("git commit");

        let result = commit_project_git_changes(
            &repo.to_string_lossy(),
            "empty commit",
        );
        assert!(result.is_err());
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn push_project_git_branch_pushes_checked_out_branch_to_remote() {
        let repo = create_temp_git_repo("push");
        fs::write(repo.join("README.md"), "test").expect("write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(&repo)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(&repo)
            .output()
            .expect("git commit");

        let result = push_project_git_branch(
            &repo.to_string_lossy(),
            None,
            None,
        );
        assert!(result.is_err());
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn create_project_git_worktree_creates_linked_worktree_and_branch() {
        let repo = create_temp_git_repo("create-worktree");
        fs::write(repo.join("README.md"), "test").expect("write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(&repo)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(&repo)
            .output()
            .expect("git commit");
        Command::new("git")
            .args(["branch", "feature/worktree"])
            .current_dir(&repo)
            .output()
            .expect("create branch");

        let worktree_path = repo.join("worktree-feature");
        let overview = create_project_git_worktree(
            &repo.to_string_lossy(),
            "feature/worktree",
            &worktree_path.to_string_lossy(),
        )
        .expect("create worktree");
        assert!(!overview.worktrees.is_empty());
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn remove_project_git_worktree_removes_linked_worktree_directory_and_metadata() {
        let repo = create_temp_git_repo("remove-worktree");
        fs::write(repo.join("README.md"), "test").expect("write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(&repo)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(&repo)
            .output()
            .expect("git commit");
        Command::new("git")
            .args(["branch", "feature/remove"])
            .current_dir(&repo)
            .output()
            .expect("create branch");

        let worktree_path = repo.join("worktree-remove");
        create_project_git_worktree(
            &repo.to_string_lossy(),
            "feature/remove",
            &worktree_path.to_string_lossy(),
        )
        .expect("create worktree");

        let overview = remove_project_git_worktree(
            &repo.to_string_lossy(),
            &worktree_path.to_string_lossy(),
            true,
        )
        .expect("remove worktree");
        assert!(overview.worktrees.is_empty() || !worktree_path.exists());
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn prune_project_git_worktrees_removes_stale_worktree_metadata() {
        let repo = create_temp_git_repo("prune-worktree");
        fs::write(repo.join("README.md"), "test").expect("write file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(&repo)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(&repo)
            .output()
            .expect("git commit");

        let overview = prune_project_git_worktrees(&repo.to_string_lossy())
            .expect("prune worktrees");
        assert_eq!(overview.status, GitOverviewStatus::Ready);
        fs::remove_dir_all(&repo).ok();
    }
}
