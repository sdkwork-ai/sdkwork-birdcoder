use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    process::Command,
};

use crate::types::*;
use crate::validation::{
    validate_git_branch_name, validate_git_remote_name, validate_git_worktree_path,
};

pub fn inspect_project_git_overview(
    project_root_path: &str,
) -> Result<GitProjectOverview, GitInspectionError> {
    let root = Path::new(project_root_path);
    let Some(current_worktree_path) = resolve_worktree_root(root) else {
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
    };

    let branches = list_branches(root)?;
    let current_branch = branches
        .iter()
        .find(|b| b.is_current)
        .map(|b| b.name.clone());
    let current_revision = run_git(&["rev-parse", "HEAD"], root)
        .ok()
        .map(|revision| revision.trim().to_owned());
    let worktrees = list_worktrees(root, Some(&current_worktree_path))?;
    let status_counts = get_status_counts(root);
    let detached_head = run_git(&["rev-parse", "--abbrev-ref", "HEAD"], root)
        .map(|s| s.trim() == "HEAD")
        .unwrap_or(false);

    Ok(GitProjectOverview {
        branches,
        current_branch,
        current_revision,
        current_worktree_path: Some(current_worktree_path),
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
    let local_ref = format!("refs/heads/{branch_name}");
    let remote_ref = format!("refs/remotes/{branch_name}");
    if git_ref_exists(root, &local_ref) {
        run_git(&["checkout", branch_name], root)
            .map_err(|error| GitMutationError::Mutate(error.message))?;
    } else if git_ref_exists(root, &remote_ref) {
        let local_name = branch_name
            .split_once('/')
            .map(|(_, name)| name)
            .ok_or_else(|| {
                GitMutationError::Validation("remote branch name is invalid".to_owned())
            })?;
        validate_git_branch_name(local_name)?;
        let local_tracking_ref = format!("refs/heads/{local_name}");
        if git_ref_exists(root, &local_tracking_ref) {
            run_git(&["checkout", local_name], root)
                .map_err(|error| GitMutationError::Mutate(error.message))?;
        } else {
            run_git(&["checkout", "-b", local_name, branch_name], root)
                .map_err(|error| GitMutationError::Mutate(error.message))?;
            let _ = run_git(
                &["branch", "--set-upstream-to", branch_name, local_name],
                root,
            );
        }
    } else {
        return Err(GitMutationError::Validation(format!(
            "branch does not exist: {branch_name}"
        )));
    }
    inspect_project_git_overview(project_root_path)
        .map_err(|e| GitMutationError::Mutate(e.to_string()))
}

pub fn commit_project_git_changes(
    project_root_path: &str,
    message: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
    if message.trim().is_empty() {
        return Err(GitMutationError::Validation(
            "commit message is required".to_owned(),
        ));
    }
    let status = run_git(&["status", "--porcelain"], root)
        .map_err(|error| GitMutationError::Mutate(error.message))?;
    if status.trim().is_empty() {
        return Err(GitMutationError::Validation(
            "there are no Git changes to commit".to_owned(),
        ));
    }
    run_git(&["add", "-A"], root).map_err(|e| GitMutationError::Mutate(e.message))?;
    run_git(&["commit", "-m", message], root).map_err(|e| GitMutationError::Mutate(e.message))?;
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
    let remote = remote_name.unwrap_or("origin").trim();
    validate_git_remote_name(remote)?;
    let resolved_branch = match branch_name {
        Some(branch) => branch.trim().to_owned(),
        None => run_git(&["symbolic-ref", "--quiet", "--short", "HEAD"], root)
            .map_err(|_| {
                GitMutationError::Validation(
                    "a branch name is required when HEAD is detached".to_owned(),
                )
            })?
            .trim()
            .to_owned(),
    };
    validate_git_branch_name(&resolved_branch)?;
    let upstream = format!("{resolved_branch}@{{upstream}}");
    let has_upstream = run_git(
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            &upstream,
        ],
        root,
    )
    .is_ok();
    let args = if has_upstream {
        vec!["push", remote, resolved_branch.as_str()]
    } else {
        vec!["push", "--set-upstream", remote, resolved_branch.as_str()]
    };
    run_git(&args, root).map_err(|e| GitMutationError::Mutate(e.message))?;
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
    let worktree = worktree.to_string_lossy();
    let local_ref = format!("refs/heads/{branch_name}");
    let branch_exists = git_ref_exists(root, &local_ref);
    let args = if branch_exists {
        vec!["worktree", "add", worktree.as_ref(), branch_name]
    } else {
        vec!["worktree", "add", "-b", branch_name, worktree.as_ref()]
    };
    let exclude_pattern = add_worktree_exclude(root, Path::new(worktree.as_ref()))?;
    if let Err(error) = run_git(&args, root) {
        remove_worktree_exclude(root, &exclude_pattern);
        return Err(GitMutationError::Mutate(error.message));
    }
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
    let worktree = validate_git_worktree_path(root, worktree_path)?;
    let worktree = worktree.to_string_lossy();
    let mut args = vec!["worktree", "remove"];
    if force {
        args.push("--force");
    }
    args.push(worktree.as_ref());
    run_git(&args, root).map_err(|e| GitMutationError::Mutate(e.message))?;
    if let Ok(pattern) = worktree_exclude_pattern(root, Path::new(worktree.as_ref())) {
        remove_worktree_exclude(root, &pattern);
    }
    inspect_project_git_overview(project_root_path)
        .map_err(|e| GitMutationError::Mutate(e.to_string()))
}

pub fn prune_project_git_worktrees(
    project_root_path: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
    run_git(&["worktree", "prune"], root).map_err(|e| GitMutationError::Mutate(e.message))?;
    cleanup_stale_managed_worktree_excludes(root);
    inspect_project_git_overview(project_root_path)
        .map_err(|e| GitMutationError::Mutate(e.to_string()))
}

pub(crate) fn validate_git_repo(root: &Path) -> Result<(), GitMutationError> {
    if resolve_worktree_root(root).is_none() {
        return Err(GitMutationError::NotRepository);
    }
    Ok(())
}

fn resolve_worktree_root(root: &Path) -> Option<String> {
    let top_level = run_git(&["rev-parse", "--show-toplevel"], root).ok()?;
    let top_level = top_level.trim();
    paths_equal(root, Path::new(top_level)).then(|| top_level.to_owned())
}

fn git_ref_exists(root: &Path, reference: &str) -> bool {
    run_git(&["show-ref", "--verify", "--quiet", reference], root).is_ok()
}

fn add_worktree_exclude(root: &Path, worktree: &Path) -> Result<String, GitMutationError> {
    let pattern = worktree_exclude_pattern(root, worktree)?;
    let exclude_path = resolve_git_exclude_path(root)?;
    let existing = fs::read_to_string(&exclude_path).unwrap_or_default();
    if existing.lines().any(|line| line.trim() == pattern) {
        return Ok(pattern);
    }

    if let Some(parent) = exclude_path.parent() {
        fs::create_dir_all(parent).map_err(|error| GitMutationError::Mutate(error.to_string()))?;
    }
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&exclude_path)
        .map_err(|error| GitMutationError::Mutate(error.to_string()))?;
    if !existing.is_empty() && !existing.ends_with('\n') {
        writeln!(file).map_err(|error| GitMutationError::Mutate(error.to_string()))?;
    }
    writeln!(file, "{pattern}").map_err(|error| GitMutationError::Mutate(error.to_string()))?;
    Ok(pattern)
}

fn remove_worktree_exclude(root: &Path, pattern: &str) {
    let Ok(exclude_path) = resolve_git_exclude_path(root) else {
        return;
    };
    let Ok(existing) = fs::read_to_string(&exclude_path) else {
        return;
    };
    let retained = existing
        .lines()
        .filter(|line| line.trim() != pattern)
        .collect::<Vec<_>>();
    let next = if retained.is_empty() {
        String::new()
    } else {
        format!("{}\n", retained.join("\n"))
    };
    let _ = fs::write(exclude_path, next);
}

fn cleanup_stale_managed_worktree_excludes(root: &Path) {
    let Ok(exclude_path) = resolve_git_exclude_path(root) else {
        return;
    };
    let Ok(existing) = fs::read_to_string(&exclude_path) else {
        return;
    };
    let retained = existing
        .lines()
        .filter(|line| {
            let pattern = line.trim();
            let Some(worktree_key) = pattern
                .strip_prefix("/.sdkwork-worktrees/")
                .and_then(|value| value.strip_suffix('/'))
            else {
                return true;
            };
            let is_managed_key = worktree_key.len() == 64
                && worktree_key
                    .bytes()
                    .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'));
            !is_managed_key || root.join(".sdkwork-worktrees").join(worktree_key).exists()
        })
        .collect::<Vec<_>>();
    if retained.len() == existing.lines().count() {
        return;
    }
    let next = if retained.is_empty() {
        String::new()
    } else {
        format!("{}\n", retained.join("\n"))
    };
    let _ = fs::write(exclude_path, next);
}

fn resolve_git_exclude_path(root: &Path) -> Result<PathBuf, GitMutationError> {
    let value = run_git(&["rev-parse", "--git-path", "info/exclude"], root)
        .map_err(|error| GitMutationError::Mutate(error.message))?;
    let path = PathBuf::from(value.trim());
    Ok(if path.is_absolute() {
        path
    } else {
        root.join(path)
    })
}

fn worktree_exclude_pattern(root: &Path, worktree: &Path) -> Result<String, GitMutationError> {
    let canonical_root =
        fs::canonicalize(root).map_err(|error| GitMutationError::Mutate(error.to_string()))?;
    let parent = worktree
        .parent()
        .ok_or_else(|| GitMutationError::Validation("invalid worktree path".to_owned()))?;
    let canonical_parent =
        fs::canonicalize(parent).map_err(|error| GitMutationError::Mutate(error.to_string()))?;
    let name = worktree
        .file_name()
        .ok_or_else(|| GitMutationError::Validation("invalid worktree path".to_owned()))?;
    let canonical_candidate = canonical_parent.join(name);
    let relative = canonical_candidate
        .strip_prefix(canonical_root)
        .map_err(|_| {
            GitMutationError::Validation("worktree path must stay within the repository".to_owned())
        })?;
    let relative = relative.to_string_lossy().replace('\\', "/");
    Ok(format!("/{}/", relative.trim_matches('/')))
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
        &[
            "for-each-ref",
            "--format=%(refname)\t%(refname:short)\t%(upstream:short)\t%(HEAD)\t%(upstream:track)",
            "refs/heads",
            "refs/remotes",
        ],
        root,
    )
    .map_err(|e| GitInspectionError::Inspect(e.message))?;

    let mut branches = Vec::new();
    for line in output.lines() {
        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 5 {
            let reference = parts[0];
            let is_remote = reference.starts_with("refs/remotes/");
            if is_remote && reference.ends_with("/HEAD") {
                continue;
            }
            let (ahead, behind) = parse_upstream_track(parts[4]);
            branches.push(GitBranchSummary {
                ahead,
                behind,
                is_current: parts[3] == "*",
                kind: if is_remote { "remote" } else { "local" }.to_owned(),
                name: parts[1].to_owned(),
                upstream_name: if parts[2].is_empty() {
                    None
                } else {
                    Some(parts[2].to_owned())
                },
            });
        }
    }
    Ok(branches)
}

fn parse_upstream_track(value: &str) -> (usize, usize) {
    let normalized = value.trim().trim_start_matches('[').trim_end_matches(']');
    let mut ahead = 0;
    let mut behind = 0;
    for segment in normalized.split(',').map(str::trim) {
        if let Some(value) = segment.strip_prefix("ahead ") {
            ahead = value.parse().unwrap_or(0);
        } else if let Some(value) = segment.strip_prefix("behind ") {
            behind = value.parse().unwrap_or(0);
        }
    }
    (ahead, behind)
}

pub(crate) fn list_worktrees(
    root: &Path,
    current_worktree_path: Option<&str>,
) -> Result<Vec<GitWorktreeSummary>, GitInspectionError> {
    let output = run_git(&["worktree", "list", "--porcelain"], root)
        .map_err(|e| GitInspectionError::Inspect(e.message))?;

    let mut worktrees = Vec::new();
    let mut current = GitWorktreeEntry::default();

    for line in output.lines() {
        if line.starts_with("worktree ") {
            if !current.path.is_empty() {
                let mut summary = current.to_summary();
                summary.is_current = current_worktree_path
                    .map(|path| paths_equal(Path::new(path), Path::new(&summary.path)))
                    .unwrap_or(false);
                worktrees.push(summary);
                current = GitWorktreeEntry::default();
            }
            current.path = line.trim_start_matches("worktree ").to_string();
        } else if line.starts_with("HEAD ") {
            current.head = Some(line.trim_start_matches("HEAD ").to_string());
        } else if line.starts_with("branch ") {
            current.branch = Some(
                line.trim_start_matches("branch ")
                    .strip_prefix("refs/heads/")
                    .unwrap_or_else(|| line.trim_start_matches("branch "))
                    .to_owned(),
            );
        } else if line.starts_with("detached") {
            current.detached = true;
        } else if line.starts_with("locked") {
            current.locked = true;
            current.locked_reason = line.strip_prefix("locked ").map(str::to_owned);
        } else if line.starts_with("prunable") {
            current.prunable_reason = line.strip_prefix("prunable ").map(str::to_owned);
        }
    }

    if !current.path.is_empty() {
        let mut summary = current.to_summary();
        summary.is_current = current_worktree_path
            .map(|path| paths_equal(Path::new(path), Path::new(&summary.path)))
            .unwrap_or(false);
        worktrees.push(summary);
    }

    Ok(worktrees)
}

fn paths_equal(left: &Path, right: &Path) -> bool {
    match (std::fs::canonicalize(left), std::fs::canonicalize(right)) {
        (Ok(left), Ok(right)) => left == right,
        _ => left == right,
    }
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
                } else if matches!(
                    (x, y),
                    (b'D', b'D')
                        | (b'A', b'U')
                        | (b'U', b'D')
                        | (b'U', b'A')
                        | (b'D', b'U')
                        | (b'A', b'A')
                        | (b'U', b'U')
                ) {
                    counts.conflicted += 1;
                } else {
                    if x != b' ' && x != b'?' {
                        counts.staged += 1;
                    }
                    if y == b'D' {
                        counts.deleted += 1;
                    } else if y != b' ' && y != b'?' {
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
        let overview = inspect_project_git_overview(&temp_dir.to_string_lossy()).expect("inspect");
        assert_eq!(overview.status, GitOverviewStatus::NotRepository);
        fs::remove_dir_all(&temp_dir).ok();
    }

    #[test]
    fn inspect_project_git_overview_does_not_adopt_parent_repository() {
        let repo = create_temp_git_repo("nested-non-repo");
        let nested = repo.join("nested-project");
        fs::create_dir_all(&nested).expect("create nested project directory");

        let overview = inspect_project_git_overview(&nested.to_string_lossy()).expect("inspect");

        assert_eq!(overview.status, GitOverviewStatus::NotRepository);
        fs::remove_dir_all(&repo).ok();
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

        let overview = create_project_git_branch(&repo.to_string_lossy(), "feature/test")
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

        let overview =
            switch_project_git_branch(&repo.to_string_lossy(), "feature/a").expect("switch branch");
        assert_eq!(overview.current_branch, Some("feature/a".to_string()));
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn switch_project_git_branch_creates_local_tracking_branch_for_remote_ref() {
        let repo = create_temp_git_repo("switch-remote-branch");
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
            .args(["update-ref", "refs/remotes/origin/feature/remote", "HEAD"])
            .current_dir(&repo)
            .output()
            .expect("create remote tracking ref");

        let before = inspect_project_git_overview(&repo.to_string_lossy()).expect("inspect");
        assert!(before
            .branches
            .iter()
            .any(|branch| { branch.kind == "remote" && branch.name == "origin/feature/remote" }));

        let overview = switch_project_git_branch(&repo.to_string_lossy(), "origin/feature/remote")
            .expect("switch remote branch");
        assert_eq!(overview.current_branch.as_deref(), Some("feature/remote"));
        assert!(!overview.detached_head);
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn inspect_project_git_overview_reports_staged_and_unstaged_statuses_once() {
        let repo = create_temp_git_repo("status-counts");
        fs::write(repo.join("modified.txt"), "initial").expect("write modified fixture");
        fs::write(repo.join("deleted.txt"), "initial").expect("write deleted fixture");
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

        fs::write(repo.join("modified.txt"), "changed").expect("modify fixture");
        fs::remove_file(repo.join("deleted.txt")).expect("delete fixture");
        fs::write(repo.join("untracked.txt"), "new").expect("write untracked fixture");

        let overview = inspect_project_git_overview(&repo.to_string_lossy()).expect("inspect");
        assert_eq!(overview.status_counts.modified, 1);
        assert_eq!(overview.status_counts.deleted, 1);
        assert_eq!(overview.status_counts.untracked, 1);
        assert_eq!(overview.status_counts.staged, 0);

        Command::new("git")
            .args(["add", "modified.txt"])
            .current_dir(&repo)
            .output()
            .expect("stage modified fixture");
        let overview = inspect_project_git_overview(&repo.to_string_lossy()).expect("inspect");
        assert_eq!(overview.status_counts.staged, 1);
        assert_eq!(overview.status_counts.modified, 0);
        assert_eq!(overview.status_counts.deleted, 1);
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

        let overview =
            commit_project_git_changes(&repo.to_string_lossy(), "add new file").expect("commit");
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

        let result = commit_project_git_changes(&repo.to_string_lossy(), "empty commit");
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

        let result = push_project_git_branch(&repo.to_string_lossy(), None, None);
        assert!(result.is_err());
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn push_project_git_branch_sets_upstream_on_first_push() {
        let repo = create_temp_git_repo("push-upstream");
        let remote = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-git-push-upstream-remote-{}",
            std::process::id()
        ));
        fs::create_dir_all(&remote).expect("create remote directory");
        Command::new("git")
            .args(["init", "--bare"])
            .current_dir(&remote)
            .output()
            .expect("init bare remote");
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
            .args(["remote", "add", "origin", &remote.to_string_lossy()])
            .current_dir(&repo)
            .output()
            .expect("add origin");

        let overview = push_project_git_branch(&repo.to_string_lossy(), None, None)
            .expect("push current branch");
        let current_branch = overview.current_branch.expect("current branch");
        let upstream = run_git(
            &[
                "rev-parse",
                "--abbrev-ref",
                &format!("{current_branch}@{{upstream}}"),
            ],
            &repo,
        )
        .expect("resolve upstream");
        assert_eq!(upstream.trim(), format!("origin/{current_branch}"));
        fs::remove_dir_all(&repo).ok();
        fs::remove_dir_all(&remote).ok();
    }

    #[test]
    fn push_project_git_branch_requires_branch_when_head_is_detached() {
        let repo = create_temp_git_repo("push-detached");
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
            .args(["checkout", "--detach", "HEAD"])
            .current_dir(&repo)
            .output()
            .expect("detach HEAD");

        let result = push_project_git_branch(&repo.to_string_lossy(), None, None);
        assert!(matches!(result, Err(GitMutationError::Validation(_))));
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
        let worktree_path = repo.join("worktree-feature");
        let overview = create_project_git_worktree(
            &repo.to_string_lossy(),
            "feature/worktree",
            &worktree_path.to_string_lossy(),
        )
        .expect("create worktree");
        assert!(overview
            .worktrees
            .iter()
            .any(|worktree| worktree.branch.as_deref() == Some("feature/worktree")));
        assert_eq!(overview.status_counts.untracked, 0);
        assert_eq!(
            overview.current_revision.as_deref(),
            overview.current_revision.as_deref().map(str::trim)
        );

        let linked_overview = inspect_project_git_overview(&worktree_path.to_string_lossy())
            .expect("inspect linked worktree");
        assert_eq!(linked_overview.status, GitOverviewStatus::Ready);
        assert_eq!(
            linked_overview.current_branch.as_deref(),
            Some("feature/worktree")
        );
        assert_eq!(
            linked_overview
                .worktrees
                .iter()
                .filter(|worktree| worktree.is_current)
                .count(),
            1
        );
        assert!(linked_overview.worktrees.iter().any(|worktree| {
            worktree.is_current && worktree.branch.as_deref() == Some("feature/worktree")
        }));
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
        let exclude_path = resolve_git_exclude_path(&repo).expect("resolve exclude path");
        let exclude = fs::read_to_string(exclude_path).expect("read exclude file");
        assert!(!exclude.contains("/worktree-remove/"));
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

        let overview =
            prune_project_git_worktrees(&repo.to_string_lossy()).expect("prune worktrees");
        assert_eq!(overview.status, GitOverviewStatus::Ready);
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn prune_project_git_worktrees_removes_stale_managed_exclude() {
        const WORKTREE_KEY: &str =
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let repo = create_temp_git_repo("prune-managed-worktree");
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
        let managed_root = repo.join(".sdkwork-worktrees");
        fs::create_dir(&managed_root).expect("create managed root");
        let worktree_path = managed_root.join(WORKTREE_KEY);
        create_project_git_worktree(
            &repo.to_string_lossy(),
            "feature/prunable",
            &worktree_path.to_string_lossy(),
        )
        .expect("create managed worktree");
        fs::remove_dir_all(&worktree_path).expect("remove managed worktree directory");

        prune_project_git_worktrees(&repo.to_string_lossy()).expect("prune worktrees");

        let exclude_path = resolve_git_exclude_path(&repo).expect("resolve exclude path");
        let exclude = fs::read_to_string(exclude_path).expect("read exclude file");
        assert!(!exclude.contains(WORKTREE_KEY));
        fs::remove_dir_all(&repo).ok();
    }
}
