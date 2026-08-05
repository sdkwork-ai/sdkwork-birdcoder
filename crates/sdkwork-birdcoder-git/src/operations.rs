use std::{
    fs::{self, OpenOptions},
    io::{self, Write},
    path::{Path, PathBuf},
};

use crate::command_runner::{run_git, run_git_with_limits, CommandLimits};
use crate::repository_probe::{
    paths_equal, probe_git_repository, GitRepositoryProbeInput, GitRepositoryProbeStatus,
};
use crate::types::*;
use crate::validation::{
    validate_git_branch_name, validate_git_remote_name, validate_git_worktree_path,
};

const GIT_DIFF_RESPONSE_LIMIT_BYTES: usize = 2 * 1024 * 1024;
/// Cap on untracked files folded into a single diff response. Beyond this
/// cap the remaining files are skipped and the response is marked truncated
/// instead of spawning one subprocess per file without a bound.
const GIT_DIFF_MAX_UNTRACKED_FILES: usize = 256;
/// Budget for reading git-owned `info/exclude` metadata; a hostile repository
/// cannot force an unbounded file read into host memory.
const GIT_EXCLUDE_FILE_READ_LIMIT_BYTES: usize = 1024 * 1024;
pub const MAX_COMMIT_MESSAGE_CHARACTERS: usize = 500;

pub fn inspect_project_git_overview(
    project_root_path: &str,
) -> Result<GitProjectOverview, GitInspectionError> {
    let root = Path::new(project_root_path);
    let probe = probe_git_repository(GitRepositoryProbeInput {
        expected_root: root,
    });
    let current_worktree_path = match probe.status {
        GitRepositoryProbeStatus::Ready { worktree_root } => worktree_root,
        GitRepositoryProbeStatus::NotRepository => {
            return Ok(empty_git_overview(
                GitOverviewStatus::NotRepository,
                probe.diagnostic_code,
            ));
        }
        GitRepositoryProbeStatus::RepositoryRootMismatch => {
            return Ok(empty_git_overview(
                GitOverviewStatus::RepositoryRootMismatch,
                probe.diagnostic_code,
            ));
        }
        GitRepositoryProbeStatus::Unavailable => {
            return Ok(empty_git_overview(
                GitOverviewStatus::Unavailable,
                probe.diagnostic_code,
            ));
        }
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
        diagnostic_code: None,
        repository_root_path: Some(root.to_string_lossy().to_string()),
        status: GitOverviewStatus::Ready,
        status_counts,
        worktrees,
    })
}

fn empty_git_overview(
    status: GitOverviewStatus,
    diagnostic_code: Option<GitOverviewDiagnosticCode>,
) -> GitProjectOverview {
    GitProjectOverview {
        branches: vec![],
        current_branch: None,
        current_revision: None,
        current_worktree_path: None,
        detached_head: false,
        diagnostic_code,
        repository_root_path: None,
        status,
        status_counts: GitStatusCounts::default(),
        worktrees: vec![],
    }
}

pub fn inspect_project_git_diff(
    project_root_path: &str,
) -> Result<GitProjectDiff, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
    let has_head = run_git(&["rev-parse", "--verify", "HEAD"], root).is_ok();
    let tracked_args = if has_head {
        vec!["diff", "--no-ext-diff", "--binary", "HEAD", "--"]
    } else {
        vec!["diff", "--no-ext-diff", "--binary", "--cached", "--"]
    };
    // Diff commands run under a diff-sized budget: the runner retains at
    // most the response limit per stream, so a large repository never
    // materializes an unbounded patch in host memory.
    let mut patch = run_git_with_limits(&tracked_args, root, &[0], CommandLimits::diff())
        .map_err(|error| GitMutationError::Mutate(error.message))?;
    let mut truncated = false;

    let untracked =
        run_git_with_limits(&["ls-files", "--others", "--exclude-standard", "-z"], root, &[0], CommandLimits::diff())
            .map_err(|error| GitMutationError::Mutate(error.message))?;
    let untracked_paths = untracked
        .split('\0')
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();
    if untracked_paths.len() > GIT_DIFF_MAX_UNTRACKED_FILES {
        truncated = true;
    }
    // The overall diff response budget is enforced *while* untracked patches
    // accumulate, not only after every file has been materialized: each
    // per-file diff can retain up to 2 MiB, so without an early stop 256
    // untracked files could hold ~512 MiB in host memory before truncation.
    // Once the accumulated patch reaches the response limit we stop spawning
    // further git subprocesses and mark the diff truncated.
    for untracked_path in untracked_paths
        .into_iter()
        .take(GIT_DIFF_MAX_UNTRACKED_FILES)
    {
        if patch.len() >= GIT_DIFF_RESPONSE_LIMIT_BYTES {
            truncated = true;
            break;
        }
        let remaining_budget = GIT_DIFF_RESPONSE_LIMIT_BYTES - patch.len();
        // Retain only what still fits the response budget per file: the
        // trailing window keeps the head of a huge untracked file observable
        // without materializing its full patch.
        let untracked_patch = run_git_with_limits(
            &[
                "diff",
                "--no-index",
                "--binary",
                "--",
                "/dev/null",
                untracked_path,
            ],
            root,
            &[0, 1],
            CommandLimits::diff(),
        )
        .map_err(|error| GitMutationError::Mutate(error.message))?;
        if !untracked_patch.is_empty() {
            if !patch.is_empty() && !patch.ends_with('\n') {
                patch.push('\n');
            }
            let retained_untracked = if untracked_patch.len() > remaining_budget {
                truncated = true;
                truncate_utf8(untracked_patch, remaining_budget).0
            } else {
                untracked_patch
            };
            patch.push_str(&retained_untracked);
        }
        if patch.len() >= GIT_DIFF_RESPONSE_LIMIT_BYTES {
            truncated = true;
            break;
        }
    }

    let (patch, size_truncated) = truncate_utf8(patch, GIT_DIFF_RESPONSE_LIMIT_BYTES);
    Ok(GitProjectDiff {
        patch,
        truncated: truncated || size_truncated,
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
    include_unstaged: bool,
) -> Result<GitProjectOverview, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
    if message.trim().is_empty() {
        return Err(GitMutationError::Validation(
            "commit message is required".to_owned(),
        ));
    }
    if message.chars().count() > MAX_COMMIT_MESSAGE_CHARACTERS {
        return Err(GitMutationError::Validation(format!(
            "commit message must be {MAX_COMMIT_MESSAGE_CHARACTERS} characters or fewer"
        )));
    }
    let status = run_git(&["status", "--porcelain"], root)
        .map_err(|error| GitMutationError::Mutate(error.message))?;
    if status.trim().is_empty() {
        return Err(GitMutationError::Validation(
            "there are no Git changes to commit".to_owned(),
        ));
    }
    if include_unstaged {
        run_git(&["add", "-A"], root).map_err(|e| GitMutationError::Mutate(e.message))?;
    } else {
        let staged_paths = run_git(&["diff", "--cached", "--name-only"], root)
            .map_err(|error| GitMutationError::Mutate(error.message))?;
        if staged_paths.trim().is_empty() {
            return Err(GitMutationError::Validation(
                "there are no staged Git changes to commit".to_owned(),
            ));
        }
    }
    run_git(&["commit", "-m", message], root).map_err(|e| GitMutationError::Mutate(e.message))?;
    inspect_project_git_overview(project_root_path)
        .map_err(|e| GitMutationError::Mutate(e.to_string()))
}

pub fn push_project_git_branch(
    project_root_path: &str,
    branch_name: Option<&str>,
    force_with_lease: bool,
    remote_name: Option<&str>,
) -> Result<GitProjectOverview, GitMutationError> {
    let root = Path::new(project_root_path);
    validate_git_repo(root)?;
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
    let upstream_name = run_git(
        &[
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            &upstream,
        ],
        root,
    )
    .ok()
    .map(|value| value.trim().to_owned())
    .filter(|value| !value.is_empty());
    let remotes = run_git(&["remote"], root)
        .map_err(|error| GitMutationError::Mutate(error.message))?
        .lines()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .collect::<Vec<_>>();
    let upstream_remote = upstream_name
        .as_deref()
        .and_then(|value| value.split('/').next());
    let remote = remote_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or(upstream_remote)
        .or_else(|| {
            remotes
                .iter()
                .any(|value| value == "origin")
                .then_some("origin")
        })
        .or_else(|| (remotes.len() == 1).then(|| remotes[0].as_str()))
        .ok_or_else(|| {
            GitMutationError::Validation(
                "a configured Git remote is required before pushing".to_owned(),
            )
        })?;
    validate_git_remote_name(remote)?;
    if !remotes.iter().any(|value| value == remote) {
        return Err(GitMutationError::Validation(format!(
            "Git remote does not exist: {remote}"
        )));
    }
    let mut args = vec!["push"];
    if force_with_lease {
        args.push("--force-with-lease");
    }
    if upstream_name.is_none() {
        args.push("--set-upstream");
    }
    args.extend([remote, resolved_branch.as_str()]);
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
    let probe = probe_git_repository(GitRepositoryProbeInput {
        expected_root: root,
    });
    match probe.status {
        GitRepositoryProbeStatus::Ready { .. } => Ok(()),
        GitRepositoryProbeStatus::NotRepository
        | GitRepositoryProbeStatus::RepositoryRootMismatch => Err(GitMutationError::NotRepository),
        GitRepositoryProbeStatus::Unavailable => Err(GitMutationError::Mutate(
            "Git repository inspection is unavailable".to_owned(),
        )),
    }
}

fn git_ref_exists(root: &Path, reference: &str) -> bool {
    run_git(&["show-ref", "--verify", "--quiet", reference], root).is_ok()
}

fn add_worktree_exclude(root: &Path, worktree: &Path) -> Result<String, GitMutationError> {
    let pattern = worktree_exclude_pattern(root, worktree)?;
    let exclude_path = resolve_git_exclude_path(root)?;
    let existing = read_exclude_file(&exclude_path).unwrap_or_default();
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
    let Ok(existing) = read_exclude_file(&exclude_path) else {
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
    let Ok(existing) = read_exclude_file(&exclude_path) else {
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
    let candidate = if path.is_absolute() {
        path
    } else {
        root.join(path)
    };
    // The git directory may live outside the worktree (a `.git` file or an
    // external `GIT_DIR`). The exclude file must still resolve inside the
    // repository's canonical root so repository-controlled metadata can never
    // redirect our writes outside the project boundary.
    let canonical_root = fs::canonicalize(root)
        .map_err(|error| GitMutationError::Mutate(error.to_string()))?;
    let canonical_candidate = canonicalize_allowing_missing_file(&candidate)
        .map_err(|error| GitMutationError::Mutate(error.to_string()))?;
    if !canonical_candidate.starts_with(&canonical_root) {
        return Err(GitMutationError::Validation(
            "git exclude path escapes the repository boundary".to_owned(),
        ));
    }
    Ok(candidate)
}

/// Canonicalizes a path whose final component may not exist yet, by
/// canonicalizing the existing parent directory and re-appending the name.
fn canonicalize_allowing_missing_file(path: &Path) -> io::Result<PathBuf> {
    match fs::canonicalize(path) {
        Ok(canonical) => Ok(canonical),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            let parent = path.parent().ok_or_else(|| {
                io::Error::new(io::ErrorKind::InvalidInput, "path has no parent")
            })?;
            let name = path.file_name().ok_or_else(|| {
                io::Error::new(io::ErrorKind::InvalidInput, "path has no file name")
            })?;
            Ok(fs::canonicalize(parent)?.join(name))
        }
        Err(error) => Err(error),
    }
}

/// Reads a git-owned metadata file with an explicit byte budget so a hostile
/// repository cannot force an unbounded file read into host memory.
fn read_exclude_file(path: &Path) -> io::Result<String> {
    let metadata = fs::metadata(path)?;
    if metadata.len() > GIT_EXCLUDE_FILE_READ_LIMIT_BYTES as u64 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "git exclude file exceeds the read budget",
        ));
    }
    fs::read_to_string(path)
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

fn truncate_utf8(value: String, max_bytes: usize) -> (String, bool) {
    if value.len() <= max_bytes {
        return (value, false);
    }
    let mut end = max_bytes;
    while !value.is_char_boundary(end) {
        end -= 1;
    }
    (value[..end].to_owned(), true)
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
    use std::process::Command;

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

        assert_eq!(overview.status, GitOverviewStatus::RepositoryRootMismatch);
        assert_eq!(
            overview.diagnostic_code,
            Some(GitOverviewDiagnosticCode::RepositoryRootMismatch)
        );
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
    fn inspect_project_git_diff_includes_tracked_and_untracked_changes() {
        let repo = create_temp_git_repo("diff");
        fs::write(repo.join("tracked.txt"), "initial\n").expect("write tracked fixture");
        Command::new("git")
            .args(["add", "tracked.txt"])
            .current_dir(&repo)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(&repo)
            .output()
            .expect("git commit");

        fs::write(repo.join("tracked.txt"), "updated\n").expect("modify tracked fixture");
        fs::write(repo.join("untracked.txt"), "new file\n").expect("write untracked fixture");

        let diff = inspect_project_git_diff(&repo.to_string_lossy()).expect("inspect diff");
        assert!(!diff.truncated);
        assert!(diff.patch.contains("tracked.txt"));
        assert!(diff.patch.contains("untracked.txt"));
        assert!(diff.patch.contains("+updated"));
        assert!(diff.patch.contains("+new file"));
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

        let overview = commit_project_git_changes(&repo.to_string_lossy(), "add new file", true)
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

        let result = commit_project_git_changes(&repo.to_string_lossy(), "empty commit", true);
        assert!(result.is_err());
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn commit_project_git_changes_rejects_oversized_messages() {
        let repo = create_temp_git_repo("oversized-commit-message");
        fs::write(repo.join("README.md"), "test").expect("write file");
        let oversized_message = "x".repeat(MAX_COMMIT_MESSAGE_CHARACTERS + 1);

        let result = commit_project_git_changes(&repo.to_string_lossy(), &oversized_message, true);

        assert!(matches!(result, Err(GitMutationError::Validation(_))));
        fs::remove_dir_all(&repo).ok();
    }

    #[test]
    fn commit_project_git_changes_can_commit_only_staged_changes() {
        let repo = create_temp_git_repo("staged-only-commit");
        fs::write(repo.join("README.md"), "initial").expect("write initial file");
        Command::new("git")
            .args(["add", "README.md"])
            .current_dir(&repo)
            .output()
            .expect("git add initial file");
        Command::new("git")
            .args(["commit", "-m", "initial"])
            .current_dir(&repo)
            .output()
            .expect("git commit initial file");

        fs::write(repo.join("staged.txt"), "staged").expect("write staged file");
        fs::write(repo.join("untracked.txt"), "untracked").expect("write untracked file");
        Command::new("git")
            .args(["add", "staged.txt"])
            .current_dir(&repo)
            .output()
            .expect("git add staged file");

        let overview = commit_project_git_changes(
            &repo.to_string_lossy(),
            "commit staged changes only",
            false,
        )
        .expect("commit staged changes");
        assert_eq!(overview.status_counts.untracked, 1);
        assert!(Command::new("git")
            .args(["cat-file", "-e", "HEAD:staged.txt"])
            .current_dir(&repo)
            .status()
            .expect("inspect staged file")
            .success());
        assert!(!Command::new("git")
            .args(["cat-file", "-e", "HEAD:untracked.txt"])
            .current_dir(&repo)
            .stderr(std::process::Stdio::null())
            .status()
            .expect("inspect untracked file")
            .success());
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

        let result = push_project_git_branch(&repo.to_string_lossy(), None, false, None);
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
            .args(["remote", "add", "upstream", &remote.to_string_lossy()])
            .current_dir(&repo)
            .output()
            .expect("add upstream");

        let overview = push_project_git_branch(&repo.to_string_lossy(), None, false, None)
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
        assert_eq!(upstream.trim(), format!("upstream/{current_branch}"));
        fs::remove_dir_all(&repo).ok();
        fs::remove_dir_all(&remote).ok();
    }

    #[test]
    fn push_project_git_branch_uses_force_with_lease_for_rewritten_history() {
        let repo = create_temp_git_repo("push-force-with-lease");
        let remote = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-git-force-with-lease-remote-{}",
            std::process::id()
        ));
        fs::create_dir_all(&remote).expect("create remote directory");
        Command::new("git")
            .args(["init", "--bare"])
            .current_dir(&remote)
            .output()
            .expect("init bare remote");
        fs::write(repo.join("README.md"), "initial").expect("write file");
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

        let initial_overview = push_project_git_branch(
            &repo.to_string_lossy(),
            None,
            false,
            Some("origin"),
        )
        .expect("push initial history");
        let branch = initial_overview.current_branch.expect("current branch");
        fs::write(repo.join("README.md"), "rewritten").expect("rewrite file");
        Command::new("git")
            .args(["add", "."])
            .current_dir(&repo)
            .output()
            .expect("git add rewritten file");
        Command::new("git")
            .args(["commit", "--amend", "-m", "rewritten"])
            .current_dir(&repo)
            .output()
            .expect("amend commit");

        assert!(push_project_git_branch(
            &repo.to_string_lossy(),
            Some(&branch),
            false,
            Some("origin"),
        )
        .is_err());
        push_project_git_branch(
            &repo.to_string_lossy(),
            Some(&branch),
            true,
            Some("origin"),
        )
        .expect("push rewritten history with force-with-lease");

        let local_revision = run_git(&["rev-parse", "HEAD"], &repo).expect("local revision");
        let remote_ref = format!("refs/heads/{branch}");
        let remote_revision = run_git(&["rev-parse", &remote_ref], &remote)
            .expect("remote revision");
        assert_eq!(local_revision.trim(), remote_revision.trim());
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

        let result = push_project_git_branch(&repo.to_string_lossy(), None, false, None);
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
