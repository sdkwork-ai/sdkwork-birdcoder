use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    ffi::{OsStr, OsString},
    fs,
    path::{Path, PathBuf},
    process::Command,
};

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
struct GitCommandOutput {
    stdout: String,
    stderr: String,
}

#[derive(Debug)]
struct GitCommandError {
    message: String,
}

#[derive(Debug, Clone)]
struct GitWorktreeEntry {
    branch: Option<String>,
    detached: bool,
    head: Option<String>,
    locked_reason: Option<String>,
    path: PathBuf,
    prunable_reason: Option<String>,
}

pub fn inspect_project_git_overview(
    project_root_path: &Path,
) -> Result<GitProjectOverview, GitInspectionError> {
    if let Err(error) = ensure_git_worktree(project_root_path) {
        if is_not_repository_message(error.message.as_str()) {
            return Ok(GitProjectOverview {
                branches: Vec::new(),
                current_branch: None,
                current_revision: None,
                current_worktree_path: None,
                detached_head: false,
                repository_root_path: None,
                status: GitOverviewStatus::NotRepository,
                status_counts: GitStatusCounts::default(),
                worktrees: Vec::new(),
            });
        }

        return Err(map_git_inspection_error(error));
    }

    let current_worktree_path = resolve_current_worktree_path(project_root_path)?;
    let current_branch = resolve_current_branch(project_root_path)?;
    let current_revision = resolve_current_revision(project_root_path)?;
    let detached_head = current_revision.is_some() && current_branch.is_none();
    let status_counts = inspect_status_counts(project_root_path)?;
    let branches = inspect_branch_inventory(project_root_path, current_branch.as_deref())?;
    let worktrees = inspect_worktree_inventory(project_root_path, current_worktree_path.as_deref())?;
    let repository_root_path = worktrees
        .first()
        .map(|worktree| worktree.path.clone())
        .or_else(|| current_worktree_path.clone());

    Ok(GitProjectOverview {
        branches,
        current_branch,
        current_revision,
        current_worktree_path,
        detached_head,
        repository_root_path,
        status: GitOverviewStatus::Ready,
        status_counts,
        worktrees,
    })
}

pub fn create_project_git_branch(
    project_root_path: &Path,
    branch_name: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    ensure_git_worktree_for_mutation(project_root_path)?;
    let normalized_branch_name = validate_git_branch_name(branch_name)?;

    if branch_exists(project_root_path, normalized_branch_name.as_str())? {
        return Err(GitMutationError::Validation(format!(
            "Git branch already exists: {normalized_branch_name}"
        )));
    }
    ensure_head_commit_for_branch_mutation(project_root_path, "creation")?;

    run_git_for_mutation(project_root_path, ["branch", normalized_branch_name.as_str()])?;
    run_git_for_mutation(project_root_path, ["checkout", normalized_branch_name.as_str()])?;
    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn switch_project_git_branch(
    project_root_path: &Path,
    branch_name: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    ensure_git_worktree_for_mutation(project_root_path)?;
    let normalized_branch_name = validate_git_branch_name(branch_name)?;

    if !branch_exists(project_root_path, normalized_branch_name.as_str())? {
        return Err(GitMutationError::Validation(format!(
            "Git branch was not found: {normalized_branch_name}"
        )));
    }

    run_git_for_mutation(project_root_path, ["checkout", normalized_branch_name.as_str()])?;
    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn commit_project_git_changes(
    project_root_path: &Path,
    message: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    ensure_git_worktree_for_mutation(project_root_path)?;
    let normalized_message = validate_git_commit_message(message)?;
    ensure_commit_identity(project_root_path)?;

    run_git_for_mutation(project_root_path, ["add", "--all"])?;
    if git_command_succeeds(project_root_path, ["diff", "--cached", "--quiet", "--exit-code"]) {
        return Err(GitMutationError::Validation(
            "No staged or working-tree changes are available to commit.".to_owned(),
        ));
    }

    run_git_for_mutation(project_root_path, ["commit", "-m", normalized_message.as_str()])?;
    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn push_project_git_branch(
    project_root_path: &Path,
    branch_name: Option<&str>,
    remote_name: Option<&str>,
) -> Result<GitProjectOverview, GitMutationError> {
    ensure_git_worktree_for_mutation(project_root_path)?;
    let normalized_branch_name = match branch_name {
        Some(branch_name) if !branch_name.trim().is_empty() => validate_git_branch_name(branch_name)?,
        _ => resolve_current_branch_for_mutation(project_root_path)?,
    };
    let normalized_remote_name = normalize_non_empty_string(remote_name).unwrap_or_else(|| "origin".to_owned());

    if !git_command_succeeds(project_root_path, ["remote", "get-url", normalized_remote_name.as_str()]) {
        return Err(GitMutationError::Validation(format!(
            "Git remote was not found: {normalized_remote_name}"
        )));
    }

    let refspec = format!(
        "refs/heads/{normalized_branch_name}:refs/heads/{normalized_branch_name}"
    );
    run_git_for_mutation(project_root_path, ["push", normalized_remote_name.as_str(), refspec.as_str()])?;
    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn create_project_git_worktree(
    project_root_path: &Path,
    branch_name: &str,
    worktree_path: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    ensure_git_worktree_for_mutation(project_root_path)?;
    let normalized_branch_name = validate_git_branch_name(branch_name)?;
    let target_path = validate_git_worktree_path(worktree_path)?;
    let target_display_path = path_to_display_string(target_path.as_path());
    let target_normalized_path = normalize_display_path(target_display_path.as_str());
    let existing_worktrees = inspect_worktree_entries_for_mutation(project_root_path)?;

    if existing_worktrees
        .iter()
        .any(|worktree| normalize_display_path(path_to_display_string(worktree.path.as_path()).as_str()) == target_normalized_path)
    {
        return Err(GitMutationError::Validation(format!(
            "Git worktree path already exists: {target_display_path}"
        )));
    }

    if target_path.exists() {
        return Err(GitMutationError::Validation(format!(
            "Git worktree path already exists: {target_display_path}"
        )));
    }

    if !branch_exists(project_root_path, normalized_branch_name.as_str())? {
        ensure_head_commit_for_branch_mutation(project_root_path, "creation")?;
        run_git_for_mutation(project_root_path, ["branch", normalized_branch_name.as_str()])?;
    }

    run_git_for_mutation(
        project_root_path,
        [
            OsString::from("worktree"),
            OsString::from("add"),
            target_path.as_os_str().to_os_string(),
            OsString::from(normalized_branch_name.as_str()),
        ],
    )?;
    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn remove_project_git_worktree(
    project_root_path: &Path,
    worktree_path: &str,
    force: bool,
) -> Result<GitProjectOverview, GitMutationError> {
    ensure_git_worktree_for_mutation(project_root_path)?;
    let target_path = validate_git_worktree_path(worktree_path)?;
    let target_display_path = path_to_display_string(target_path.as_path());
    let target_normalized_path = normalize_display_path(target_display_path.as_str());
    let current_worktree_path = resolve_current_worktree_path(project_root_path)
        .map_err(map_git_inspection_as_mutation_error)?
        .map(|path| normalize_display_path(path.as_str()));

    if current_worktree_path
        .as_ref()
        .is_some_and(|path| path == &target_normalized_path)
    {
        return Err(GitMutationError::Validation(
            "Current Git worktree cannot be removed.".to_owned(),
        ));
    }

    let worktree = inspect_worktree_entries_for_mutation(project_root_path)?
        .into_iter()
        .find(|worktree| normalize_display_path(path_to_display_string(worktree.path.as_path()).as_str()) == target_normalized_path)
        .ok_or_else(|| {
            GitMutationError::Validation(format!(
                "Git linked worktree was not found: {target_display_path}"
            ))
        })?;

    if let Some(reason) = worktree.locked_reason.filter(|value| !value.trim().is_empty()) {
        return Err(GitMutationError::Validation(reason));
    }
    if !force && target_path.exists() && has_uncommitted_git_changes(target_path.as_path())? {
        return Err(GitMutationError::Validation(
            "Git worktree has uncommitted changes and cannot be removed without force."
                .to_owned(),
        ));
    }

    if target_path.exists() {
        if force {
            run_git_for_mutation(
                project_root_path,
                [
                    OsString::from("worktree"),
                    OsString::from("remove"),
                    OsString::from("--force"),
                    target_path.as_os_str().to_os_string(),
                ],
            )?;
        } else {
            run_git_for_mutation(
                project_root_path,
                [
                    OsString::from("worktree"),
                    OsString::from("remove"),
                    target_path.as_os_str().to_os_string(),
                ],
            )?;
        }
    } else {
        run_git_for_mutation(project_root_path, ["worktree", "prune"])?;
    }

    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn prune_project_git_worktrees(
    project_root_path: &Path,
) -> Result<GitProjectOverview, GitMutationError> {
    ensure_git_worktree_for_mutation(project_root_path)?;
    run_git_for_mutation(project_root_path, ["worktree", "prune"])?;
    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

fn ensure_git_worktree(path: &Path) -> Result<(), GitCommandError> {
    run_git(path, ["rev-parse", "--is-inside-work-tree"]).map(|_| ())
}

fn ensure_git_worktree_for_mutation(path: &Path) -> Result<(), GitMutationError> {
    ensure_git_worktree(path).map_err(|error| {
        if is_not_repository_message(error.message.as_str()) {
            GitMutationError::NotRepository
        } else {
            map_git_mutation_error(error)
        }
    })
}

fn resolve_current_worktree_path(path: &Path) -> Result<Option<String>, GitInspectionError> {
    let output = run_git(path, ["rev-parse", "--show-toplevel"]).map_err(map_git_inspection_error)?;
    Ok(normalize_optional_stdout_path(output.stdout.as_str()))
}

fn resolve_current_branch(path: &Path) -> Result<Option<String>, GitInspectionError> {
    let output = run_git(path, ["branch", "--show-current"]).map_err(map_git_inspection_error)?;
    Ok(normalize_non_empty_string(Some(output.stdout.as_str())))
}

fn resolve_current_branch_for_mutation(path: &Path) -> Result<String, GitMutationError> {
    let output = run_git(path, ["branch", "--show-current"]).map_err(map_git_mutation_error)?;
    normalize_non_empty_string(Some(output.stdout.as_str())).ok_or_else(|| {
        GitMutationError::Validation(
            "Git push requires a checked-out branch or an explicit branch name.".to_owned(),
        )
    })
}

fn resolve_current_revision(path: &Path) -> Result<Option<String>, GitInspectionError> {
    match run_git(path, ["rev-parse", "--verify", "HEAD"]) {
        Ok(output) => Ok(normalize_non_empty_string(Some(output.stdout.as_str()))),
        Err(error) if is_missing_head_message(error.message.as_str()) => Ok(None),
        Err(error) => Err(map_git_inspection_error(error)),
    }
}

fn inspect_status_counts(path: &Path) -> Result<GitStatusCounts, GitInspectionError> {
    let output = run_git(path, ["status", "--porcelain=v1", "--untracked-files=all"])
        .map_err(map_git_inspection_error)?;
    Ok(parse_status_counts(output.stdout.as_str()))
}

fn inspect_status_counts_for_mutation(path: &Path) -> Result<GitStatusCounts, GitMutationError> {
    let output = run_git(path, ["status", "--porcelain=v1", "--untracked-files=all"])
        .map_err(map_git_mutation_error)?;
    Ok(parse_status_counts(output.stdout.as_str()))
}

fn parse_status_counts(status_output: &str) -> GitStatusCounts {
    let mut counts = GitStatusCounts::default();

    for line in status_output.lines() {
        if line.len() < 2 {
            continue;
        }

        let status = line.as_bytes();
        let index_status = status[0] as char;
        let worktree_status = status[1] as char;

        if index_status == '?' && worktree_status == '?' {
            counts.untracked += 1;
            continue;
        }
        if index_status == '!' && worktree_status == '!' {
            continue;
        }
        if matches!(index_status, 'U' | 'A' | 'D') && matches!(worktree_status, 'U' | 'A' | 'D') {
            counts.conflicted += 1;
        }
        if matches!(index_status, 'A' | 'C' | 'D' | 'M' | 'R' | 'T') {
            counts.staged += 1;
        }
        if matches!(worktree_status, 'D') || matches!(index_status, 'D') {
            counts.deleted += 1;
        }
        if matches!(worktree_status, 'M' | 'R' | 'T') {
            counts.modified += 1;
        }
    }

    counts
}

fn inspect_branch_inventory(
    path: &Path,
    current_branch: Option<&str>,
) -> Result<Vec<GitBranchSummary>, GitInspectionError> {
    let output = run_git(
        path,
        [
            "for-each-ref",
            "refs/heads",
            "--format=%(refname:short)%00%(upstream:short)%00%(objectname)",
        ],
    )
    .map_err(map_git_inspection_error)?;
    let mut branches = Vec::new();

    for line in output.stdout.lines() {
        let mut fields = line.split('\0');
        let Some(name) = fields.next().and_then(|value| normalize_non_empty_string(Some(value))) else {
            continue;
        };
        let upstream_name = fields
            .next()
            .and_then(|value| normalize_non_empty_string(Some(value)));
        let (ahead, behind) = upstream_name
            .as_deref()
            .map(|upstream| inspect_branch_ahead_behind(path, name.as_str(), upstream))
            .transpose()?
            .unwrap_or((0, 0));

        branches.push(GitBranchSummary {
            ahead,
            behind,
            is_current: current_branch.is_some_and(|current| current == name),
            kind: "local".to_owned(),
            name,
            upstream_name,
        });
    }

    branches.sort_by(|left, right| {
        right
            .is_current
            .cmp(&left.is_current)
            .then_with(|| left.name.cmp(&right.name))
    });

    Ok(branches)
}

fn inspect_branch_ahead_behind(
    path: &Path,
    branch_name: &str,
    upstream_name: &str,
) -> Result<(usize, usize), GitInspectionError> {
    let revision_range = format!("{branch_name}...{upstream_name}");
    let output = run_git(path, ["rev-list", "--left-right", "--count", revision_range.as_str()])
        .map_err(map_git_inspection_error)?;
    let mut fields = output.stdout.split_whitespace();
    let ahead = fields
        .next()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    let behind = fields
        .next()
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    Ok((ahead, behind))
}

fn inspect_worktree_inventory(
    path: &Path,
    current_worktree_path: Option<&str>,
) -> Result<Vec<GitWorktreeSummary>, GitInspectionError> {
    let entries = inspect_worktree_entries(path).map_err(map_git_inspection_error)?;
    let mut worktrees_by_path = BTreeMap::<String, GitWorktreeSummary>::new();

    for entry in entries {
        let display_path = path_to_display_string(entry.path.as_path());
        let normalized_path = normalize_display_path(display_path.as_str());
        let label = entry
            .path
            .file_name()
            .and_then(|value| value.to_str().map(str::to_owned))
            .unwrap_or_else(|| "worktree".to_owned());
        let is_prunable = entry.prunable_reason.is_some();
        worktrees_by_path.insert(
            normalized_path.clone(),
            GitWorktreeSummary {
                branch: entry.branch,
                head: entry.head,
                id: normalized_path,
                is_current: current_worktree_path
                    .is_some_and(|current| normalize_display_path(current) == normalize_display_path(display_path.as_str())),
                is_detached: entry.detached,
                is_locked: entry.locked_reason.is_some(),
                is_prunable,
                label,
                locked_reason: entry.locked_reason,
                path: display_path,
                prunable_reason: entry
                    .prunable_reason
                    .or_else(|| is_prunable.then(|| "worktree metadata is prunable".to_owned())),
            },
        );
    }

    let mut worktrees = worktrees_by_path.into_values().collect::<Vec<_>>();
    worktrees.sort_by(|left, right| {
        right
            .is_current
            .cmp(&left.is_current)
            .then_with(|| left.label.cmp(&right.label))
            .then_with(|| left.path.cmp(&right.path))
    });

    Ok(worktrees)
}

fn inspect_worktree_entries_for_mutation(path: &Path) -> Result<Vec<GitWorktreeEntry>, GitMutationError> {
    inspect_worktree_entries(path).map_err(map_git_mutation_error)
}

fn inspect_worktree_entries(path: &Path) -> Result<Vec<GitWorktreeEntry>, GitCommandError> {
    let output = run_git(path, ["worktree", "list", "--porcelain"])?;
    let mut entries = Vec::new();
    let mut current: Option<GitWorktreeEntry> = None;

    for line in output.stdout.lines() {
        if line.trim().is_empty() {
            if let Some(entry) = current.take() {
                entries.push(entry);
            }
            continue;
        }

        if let Some(path_value) = line.strip_prefix("worktree ") {
            if let Some(entry) = current.take() {
                entries.push(entry);
            }
            current = Some(GitWorktreeEntry {
                branch: None,
                detached: false,
                head: None,
                locked_reason: None,
                path: PathBuf::from(path_value.trim()),
                prunable_reason: None,
            });
            continue;
        }

        let Some(entry) = current.as_mut() else {
            continue;
        };
        if let Some(head) = line.strip_prefix("HEAD ") {
            entry.head = normalize_non_empty_string(Some(head));
        } else if let Some(branch) = line.strip_prefix("branch ") {
            entry.branch = normalize_branch_ref(branch);
        } else if line == "detached" {
            entry.detached = true;
        } else if let Some(reason) = line.strip_prefix("locked") {
            entry.locked_reason = Some(reason.trim().to_owned()).filter(|value| !value.is_empty());
        } else if let Some(reason) = line.strip_prefix("prunable") {
            let normalized_reason = reason.trim();
            entry.prunable_reason = if normalized_reason.is_empty() {
                Some("worktree metadata is prunable".to_owned())
            } else {
                Some(normalized_reason.to_owned())
            };
        }
    }

    if let Some(entry) = current.take() {
        entries.push(entry);
    }

    Ok(entries)
}

fn normalize_branch_ref(value: &str) -> Option<String> {
    let trimmed = value.trim();
    normalize_non_empty_string(Some(
        trimmed
            .strip_prefix("refs/heads/")
            .unwrap_or(trimmed),
    ))
}

fn branch_exists(path: &Path, branch_name: &str) -> Result<bool, GitMutationError> {
    let reference_name = format!("refs/heads/{branch_name}");
    Ok(git_command_succeeds(path, ["show-ref", "--verify", "--quiet", reference_name.as_str()]))
}

fn ensure_head_commit_for_branch_mutation(path: &Path, action: &str) -> Result<(), GitMutationError> {
    if git_command_succeeds(path, ["rev-parse", "--verify", "HEAD"]) {
        return Ok(());
    }

    Err(GitMutationError::Validation(format!(
        "Git branch {action} requires at least one existing commit."
    )))
}

fn ensure_commit_identity(path: &Path) -> Result<(), GitMutationError> {
    let has_name = git_command_succeeds(path, ["config", "--get", "user.name"]);
    let has_email = git_command_succeeds(path, ["config", "--get", "user.email"]);
    if has_name && has_email {
        return Ok(());
    }

    Err(GitMutationError::Validation(
        "Git commit requires configured user.name and user.email.".to_owned(),
    ))
}

fn has_uncommitted_git_changes(path: &Path) -> Result<bool, GitMutationError> {
    let status_counts = inspect_status_counts_for_mutation(path)?;
    Ok(
        status_counts.modified > 0
            || status_counts.staged > 0
            || status_counts.untracked > 0
            || status_counts.deleted > 0
            || status_counts.conflicted > 0,
    )
}

fn run_git_for_mutation<I, S>(cwd: &Path, args: I) -> Result<GitCommandOutput, GitMutationError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    run_git(cwd, args).map_err(map_git_mutation_error)
}

fn git_command_succeeds<I, S>(cwd: &Path, args: I) -> bool
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    run_git(cwd, args).is_ok()
}

fn run_git<I, S>(cwd: &Path, args: I) -> Result<GitCommandOutput, GitCommandError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let args = args
        .into_iter()
        .map(|arg| arg.as_ref().to_os_string())
        .collect::<Vec<_>>();
    let output = Command::new("git")
        .arg("-C")
        .arg(cwd)
        .args(args.iter())
        .output()
        .map_err(|error| GitCommandError {
            message: format!("Git command failed to launch: {error}"),
        })?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_owned();

    if output.status.success() {
        return Ok(GitCommandOutput { stdout, stderr });
    }

    Err(GitCommandError {
        message: build_git_command_error_message(args.as_slice(), stdout.as_str(), stderr.as_str()),
    })
}

fn build_git_command_error_message(args: &[OsString], stdout: &str, stderr: &str) -> String {
    let args_display = args
        .iter()
        .map(|arg| arg.to_string_lossy())
        .collect::<Vec<_>>()
        .join(" ");
    let detail = if !stderr.trim().is_empty() {
        stderr.trim()
    } else if !stdout.trim().is_empty() {
        stdout.trim()
    } else {
        "command exited with a non-zero status"
    };

    format!("git {args_display}: {detail}")
}

fn normalize_optional_stdout_path(value: &str) -> Option<String> {
    normalize_non_empty_string(Some(value)).map(|value| path_to_display_string(Path::new(value.as_str())))
}

fn path_to_display_string(path: &Path) -> String {
    trim_display_path_trailing_separators(path.to_string_lossy().replace('\\', "/"))
}

fn normalize_display_path(path: &str) -> String {
    trim_display_path_trailing_separators(path.trim().replace('\\', "/")).to_ascii_lowercase()
}

fn trim_display_path_trailing_separators(path: String) -> String {
    let mut normalized_path = path.trim().to_owned();
    loop {
        if normalized_path.len() <= 1
            || normalized_path == "/"
            || normalized_path.ends_with(":/")
            || normalized_path.ends_with("://")
            || !normalized_path.ends_with('/')
        {
            break;
        }
        normalized_path.pop();
    }
    normalized_path
}

fn normalize_non_empty_string(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

fn validate_git_branch_name(branch_name: &str) -> Result<String, GitMutationError> {
    let normalized_branch_name = branch_name.trim();
    let has_invalid_segment = normalized_branch_name.is_empty()
        || normalized_branch_name.starts_with('-')
        || normalized_branch_name.ends_with('/')
        || normalized_branch_name.ends_with('.')
        || normalized_branch_name.ends_with(".lock")
        || normalized_branch_name.contains("..")
        || normalized_branch_name.contains("@{")
        || normalized_branch_name.contains('\\')
        || normalized_branch_name.contains("//")
        || normalized_branch_name
            .chars()
            .any(|value| value.is_whitespace() || matches!(value, '~' | '^' | ':' | '?' | '*' | '[' | ']'));

    if has_invalid_segment {
        return Err(GitMutationError::Validation(format!(
            "Invalid Git branch name: {branch_name}"
        )));
    }

    Ok(normalized_branch_name.to_owned())
}

fn validate_git_worktree_path(worktree_path: &str) -> Result<PathBuf, GitMutationError> {
    let normalized_worktree_path = worktree_path.trim();
    if normalized_worktree_path.is_empty() {
        return Err(GitMutationError::Validation(
            "Git worktree path is required.".to_owned(),
        ));
    }

    let path = PathBuf::from(normalized_worktree_path);
    if !path.is_absolute() {
        return Err(GitMutationError::Validation(
            "Git worktree path must be absolute.".to_owned(),
        ));
    }

    Ok(path)
}

fn validate_git_commit_message(message: &str) -> Result<String, GitMutationError> {
    normalize_non_empty_string(Some(message)).ok_or_else(|| {
        GitMutationError::Validation("Git commit message is required.".to_owned())
    })
}

fn is_not_repository_message(message: &str) -> bool {
    let normalized_message = message.to_ascii_lowercase();
    normalized_message.contains("not a git repository")
        || normalized_message.contains("not a git command")
        || normalized_message.contains("cannot change to")
}

fn is_missing_head_message(message: &str) -> bool {
    let normalized_message = message.to_ascii_lowercase();
    normalized_message.contains("needed a single revision")
        || normalized_message.contains("unknown revision")
        || normalized_message.contains("ambiguous argument")
        || normalized_message.contains("bad revision")
}

fn map_git_inspection_error(error: GitCommandError) -> GitInspectionError {
    GitInspectionError::Inspect(error.message)
}

fn map_git_mutation_error(error: GitCommandError) -> GitMutationError {
    GitMutationError::Mutate(error.message)
}

fn map_git_inspection_as_mutation_error(error: GitInspectionError) -> GitMutationError {
    match error {
        GitInspectionError::Inspect(message) => GitMutationError::Mutate(message),
    }
}

fn remove_worktree_filesystem_entry(path: &Path) -> Result<(), GitMutationError> {
    if !path.exists() {
        return Ok(());
    }

    let metadata = fs::metadata(path).map_err(|error| {
        GitMutationError::Mutate(format!(
            "Failed to inspect Git worktree path {}: {error}",
            path.display()
        ))
    })?;
    if metadata.is_dir() {
        fs::remove_dir_all(path).map_err(|error| {
            GitMutationError::Mutate(format!(
                "Failed to remove Git worktree directory {}: {error}",
                path.display()
            ))
        })?;
    } else {
        fs::remove_file(path).map_err(|error| {
            GitMutationError::Mutate(format!(
                "Failed to remove Git worktree file {}: {error}",
                path.display()
            ))
        })?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        commit_project_git_changes, create_project_git_branch, create_project_git_worktree,
        inspect_project_git_overview, prune_project_git_worktrees, push_project_git_branch,
        remove_project_git_worktree, switch_project_git_branch, GitMutationError,
        GitOverviewStatus,
    };
    use std::{
        fs,
        path::{Path, PathBuf},
        process::Command,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn create_temp_dir(prefix: &str) -> PathBuf {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-git-{prefix}-{}-{timestamp}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("create temp directory");
        path
    }

    fn create_temp_path(prefix: &str) -> PathBuf {
        let path = create_temp_dir(prefix);
        fs::remove_dir_all(&path).expect("remove temp path placeholder");
        path
    }

    fn run_git(args: &[&str], cwd: &Path) {
        let status = Command::new("git")
            .args(args)
            .current_dir(cwd)
            .status()
            .expect("git command should launch");
        assert!(
            status.success(),
            "git {:?} should succeed inside {}",
            args,
            cwd.display()
        );
    }

    fn write_text(path: &Path, content: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent directories");
        }
        fs::write(path, content).expect("write file");
    }

    #[test]
    fn inspect_project_git_overview_reports_non_repository_directories() {
        let directory = create_temp_dir("plain");
        let overview =
            inspect_project_git_overview(&directory).expect("non-repository inspection should succeed");

        assert_eq!(overview.status, GitOverviewStatus::NotRepository);
        assert!(overview.branches.is_empty());
        assert!(overview.worktrees.is_empty());
        assert!(overview.repository_root_path.is_none());
    }

    #[test]
    fn inspect_project_git_overview_collects_branch_and_worktree_inventory() {
        let repository_root = create_temp_dir("repo");
        let normalized_repository_root = repository_root.to_string_lossy().replace('\\', "/");
        run_git(&["init", "--initial-branch=main"], &repository_root);
        run_git(&["config", "user.name", "SDKWork Test"], &repository_root);
        run_git(&["config", "user.email", "sdkwork@example.com"], &repository_root);
        write_text(&repository_root.join("README.md"), "# BirdCoder\n");
        run_git(&["add", "README.md"], &repository_root);
        run_git(&["commit", "-m", "initial"], &repository_root);
        run_git(&["branch", "feature/git-panel"], &repository_root);

        let worktree_root = create_temp_dir("linked-worktree");
        let normalized_worktree_root = worktree_root.to_string_lossy().replace('\\', "/");
        run_git(
            &[
                "worktree",
                "add",
                worktree_root.to_string_lossy().as_ref(),
                "feature/git-panel",
            ],
            &repository_root,
        );

        let overview = inspect_project_git_overview(&repository_root)
            .expect("repository inspection should succeed");

        assert_eq!(overview.status, GitOverviewStatus::Ready);
        assert_eq!(overview.current_branch.as_deref(), Some("main"));
        assert!(
            overview.branches.iter().any(|branch| branch.name == "main" && branch.is_current),
            "expected main branch to be marked current"
        );
        assert!(
            overview
                .branches
                .iter()
                .any(|branch| branch.name == "feature/git-panel"),
            "expected linked branch to be present"
        );
        assert!(
            overview.worktrees.iter().any(|worktree| {
                worktree.path == normalized_repository_root && worktree.is_current
            }),
            "expected current worktree to be present"
        );
        assert!(
            overview.worktrees.iter().any(|worktree| {
                worktree.path == normalized_worktree_root
                    && worktree.branch.as_deref() == Some("feature/git-panel")
            }),
            "expected linked worktree to be present"
        );
    }

    #[test]
    fn create_project_git_branch_creates_and_checks_out_branch() {
        let repository_root = create_temp_dir("create-branch");
        run_git(&["init", "--initial-branch=main"], &repository_root);
        run_git(&["config", "user.name", "SDKWork Test"], &repository_root);
        run_git(&["config", "user.email", "sdkwork@example.com"], &repository_root);
        write_text(&repository_root.join("README.md"), "# BirdCoder\n");
        run_git(&["add", "README.md"], &repository_root);
        run_git(&["commit", "-m", "initial"], &repository_root);

        let overview = create_project_git_branch(&repository_root, "feature/git-actions")
            .expect("create branch");

        assert_eq!(overview.current_branch.as_deref(), Some("feature/git-actions"));
        assert!(
            overview
                .branches
                .iter()
                .any(|branch| branch.name == "feature/git-actions" && branch.is_current)
        );
    }

    #[test]
    fn switch_project_git_branch_switches_checked_out_branch() {
        let repository_root = create_temp_dir("switch-branch");
        run_git(&["init", "--initial-branch=main"], &repository_root);
        run_git(&["config", "user.name", "SDKWork Test"], &repository_root);
        run_git(&["config", "user.email", "sdkwork@example.com"], &repository_root);
        write_text(&repository_root.join("README.md"), "# BirdCoder\n");
        run_git(&["add", "README.md"], &repository_root);
        run_git(&["commit", "-m", "initial"], &repository_root);
        run_git(&["branch", "feature/switch"], &repository_root);

        let overview =
            switch_project_git_branch(&repository_root, "feature/switch").expect("switch branch");

        assert_eq!(overview.current_branch.as_deref(), Some("feature/switch"));
    }

    #[test]
    fn create_project_git_worktree_creates_linked_worktree_and_branch() {
        let repository_root = create_temp_dir("create-worktree");
        run_git(&["init", "--initial-branch=main"], &repository_root);
        run_git(&["config", "user.name", "SDKWork Test"], &repository_root);
        run_git(&["config", "user.email", "sdkwork@example.com"], &repository_root);
        write_text(&repository_root.join("README.md"), "# BirdCoder\n");
        run_git(&["add", "README.md"], &repository_root);
        run_git(&["commit", "-m", "initial"], &repository_root);

        let worktree_root = create_temp_path("create-worktree-linked");
        let normalized_worktree_root = worktree_root.to_string_lossy().replace('\\', "/");
        let overview = create_project_git_worktree(
            &repository_root,
            "feature/worktree",
            worktree_root.to_string_lossy().as_ref(),
        )
        .expect("create worktree");

        assert!(worktree_root.exists(), "expected linked worktree directory to exist");
        assert!(
            overview.worktrees.iter().any(|worktree| {
                worktree.path == normalized_worktree_root
                    && worktree.branch.as_deref() == Some("feature/worktree")
            }),
            "expected created worktree to be reflected in overview"
        );
    }

    #[test]
    fn commit_project_git_changes_creates_commit_for_staged_worktree_changes() {
        let repository_root = create_temp_dir("commit");
        run_git(&["init", "--initial-branch=main"], &repository_root);
        run_git(&["config", "user.name", "SDKWork Test"], &repository_root);
        run_git(&["config", "user.email", "sdkwork@example.com"], &repository_root);
        write_text(&repository_root.join("README.md"), "# BirdCoder\n");
        run_git(&["add", "README.md"], &repository_root);
        run_git(&["commit", "-m", "initial"], &repository_root);
        write_text(
            &repository_root.join("README.md"),
            "# BirdCoder\n\nUpdated from Rust mutation test.\n",
        );

        let overview = commit_project_git_changes(&repository_root, "update readme")
            .expect("commit changes");

        assert_eq!(overview.current_branch.as_deref(), Some("main"));
        assert_eq!(overview.status_counts.modified, 0);
        assert_eq!(overview.status_counts.staged, 0);
    }

    #[test]
    fn commit_project_git_changes_rejects_empty_commit_attempts() {
        let repository_root = create_temp_dir("empty-commit");
        run_git(&["init", "--initial-branch=main"], &repository_root);
        run_git(&["config", "user.name", "SDKWork Test"], &repository_root);
        run_git(&["config", "user.email", "sdkwork@example.com"], &repository_root);
        write_text(&repository_root.join("README.md"), "# BirdCoder\n");
        run_git(&["add", "README.md"], &repository_root);
        run_git(&["commit", "-m", "initial"], &repository_root);

        let error = commit_project_git_changes(&repository_root, "empty commit")
            .expect_err("empty commit should fail");

        assert!(matches!(error, GitMutationError::Validation(_)));
    }

    #[test]
    fn remove_project_git_worktree_removes_linked_worktree_directory_and_metadata() {
        let repository_root = create_temp_dir("remove-worktree");
        run_git(&["init", "--initial-branch=main"], &repository_root);
        run_git(&["config", "user.name", "SDKWork Test"], &repository_root);
        run_git(&["config", "user.email", "sdkwork@example.com"], &repository_root);
        write_text(&repository_root.join("README.md"), "# BirdCoder\n");
        run_git(&["add", "README.md"], &repository_root);
        run_git(&["commit", "-m", "initial"], &repository_root);
        run_git(&["branch", "feature/remove"], &repository_root);

        let worktree_root = create_temp_dir("remove-worktree-linked");
        let normalized_worktree_root = worktree_root.to_string_lossy().replace('\\', "/");
        run_git(
            &[
                "worktree",
                "add",
                worktree_root.to_string_lossy().as_ref(),
                "feature/remove",
            ],
            &repository_root,
        );

        let overview = remove_project_git_worktree(
            &repository_root,
            worktree_root.to_string_lossy().as_ref(),
            false,
        )
        .expect("remove worktree");

        assert!(
            !worktree_root.exists(),
            "expected linked worktree directory to be removed"
        );
        assert!(
            overview
                .worktrees
                .iter()
                .all(|worktree| worktree.path != normalized_worktree_root),
            "expected removed worktree to disappear from overview"
        );
    }

    #[test]
    fn prune_project_git_worktrees_removes_stale_worktree_metadata() {
        let repository_root = create_temp_dir("prune-worktree");
        run_git(&["init", "--initial-branch=main"], &repository_root);
        run_git(&["config", "user.name", "SDKWork Test"], &repository_root);
        run_git(&["config", "user.email", "sdkwork@example.com"], &repository_root);
        write_text(&repository_root.join("README.md"), "# BirdCoder\n");
        run_git(&["add", "README.md"], &repository_root);
        run_git(&["commit", "-m", "initial"], &repository_root);
        run_git(&["branch", "feature/prune"], &repository_root);

        let worktree_root = create_temp_dir("prune-worktree-linked");
        let normalized_worktree_root = worktree_root.to_string_lossy().replace('\\', "/");
        run_git(
            &[
                "worktree",
                "add",
                worktree_root.to_string_lossy().as_ref(),
                "feature/prune",
            ],
            &repository_root,
        );
        fs::remove_dir_all(&worktree_root).expect("remove linked worktree directory");

        let overview = prune_project_git_worktrees(&repository_root).expect("prune worktrees");

        assert!(
            overview
                .worktrees
                .iter()
                .all(|worktree| worktree.path != normalized_worktree_root),
            "expected stale worktree metadata to be pruned"
        );
    }

    #[test]
    fn push_project_git_branch_pushes_checked_out_branch_to_remote() {
        let remote_root = create_temp_dir("remote");
        run_git(&["init", "--bare"], &remote_root);

        let repository_root = create_temp_dir("push");
        run_git(&["init", "--initial-branch=main"], &repository_root);
        run_git(&["config", "user.name", "SDKWork Test"], &repository_root);
        run_git(&["config", "user.email", "sdkwork@example.com"], &repository_root);
        run_git(
            &[
                "remote",
                "add",
                "origin",
                remote_root.to_string_lossy().as_ref(),
            ],
            &repository_root,
        );
        write_text(&repository_root.join("README.md"), "# BirdCoder\n");
        run_git(&["add", "README.md"], &repository_root);
        run_git(&["commit", "-m", "initial"], &repository_root);

        let overview =
            push_project_git_branch(&repository_root, Some("main"), Some("origin")).expect("push branch");

        assert_eq!(overview.current_branch.as_deref(), Some("main"));
        let remote_head = Command::new("git")
            .args(["--git-dir", remote_root.to_string_lossy().as_ref(), "rev-parse", "main"])
            .output()
            .expect("read remote main revision");
        assert!(
            remote_head.status.success(),
            "expected remote main branch to exist after push"
        );
    }
}
