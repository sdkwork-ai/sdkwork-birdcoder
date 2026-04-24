use git2::{
    build::CheckoutBuilder, BranchType, Cred, CredentialType, ErrorCode, IndexAddOption,
    PushOptions, RemoteCallbacks, Repository, Status, StatusOptions, WorktreeAddOptions,
    WorktreeLockStatus, WorktreePruneOptions,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    fs,
    path::{Path, PathBuf},
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

pub fn inspect_project_git_overview(
    project_root_path: &Path,
) -> Result<GitProjectOverview, GitInspectionError> {
    let repository = match Repository::discover(project_root_path) {
        Ok(repository) => repository,
        Err(error) if error.code() == ErrorCode::NotFound => {
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
        Err(error) => {
            return Err(GitInspectionError::Inspect(error.message().to_owned()));
        }
    };

    let current_worktree_path = repository
        .workdir()
        .map(path_to_display_string)
        .or_else(|| Some(path_to_display_string(repository.commondir())));
    let repository_root_path = repository
        .commondir()
        .parent()
        .or_else(|| repository.workdir())
        .map(path_to_display_string);
    let status_counts = inspect_status_counts(&repository)?;
    let (current_branch, current_revision, detached_head) = inspect_head_state(&repository);
    let branches = inspect_branch_inventory(&repository)?;
    let worktrees = inspect_worktree_inventory(&repository, current_worktree_path.as_deref())?;

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
    let repository = discover_repository_for_mutation(project_root_path)?;
    let normalized_branch_name = validate_git_branch_name(branch_name)?;
    let reference_name = format!("refs/heads/{normalized_branch_name}");

    if repository.find_reference(reference_name.as_str()).is_ok() {
        return Err(GitMutationError::Validation(format!(
            "Git branch already exists: {normalized_branch_name}"
        )));
    }

    let head_commit = repository
        .head()
        .map_err(map_git_mutation_error)?
        .peel_to_commit()
        .map_err(|_| {
            GitMutationError::Validation(
                "Git branch creation requires at least one existing commit.".to_owned(),
            )
        })?;

    repository
        .branch(normalized_branch_name.as_str(), &head_commit, false)
        .map_err(map_git_mutation_error)?;
    checkout_repository_branch(&repository, reference_name.as_str())?;
    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn switch_project_git_branch(
    project_root_path: &Path,
    branch_name: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    let repository = discover_repository_for_mutation(project_root_path)?;
    let normalized_branch_name = validate_git_branch_name(branch_name)?;
    let reference_name = format!("refs/heads/{normalized_branch_name}");

    repository
        .find_reference(reference_name.as_str())
        .map_err(|_| {
            GitMutationError::Validation(format!(
                "Git branch was not found: {normalized_branch_name}"
            ))
        })?;
    checkout_repository_branch(&repository, reference_name.as_str())?;
    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn commit_project_git_changes(
    project_root_path: &Path,
    message: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    let repository = discover_repository_for_mutation(project_root_path)?;
    let normalized_message = validate_git_commit_message(message)?;
    let signature = resolve_repository_signature(&repository)?;
    let mut index = repository.index().map_err(map_git_mutation_error)?;

    index
        .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(map_git_mutation_error)?;
    index.write().map_err(map_git_mutation_error)?;

    let tree_oid = index.write_tree().map_err(map_git_mutation_error)?;
    let tree = repository.find_tree(tree_oid).map_err(map_git_mutation_error)?;
    let parent_commit = repository
        .head()
        .ok()
        .and_then(|head| head.peel_to_commit().ok());

    if parent_commit
        .as_ref()
        .is_some_and(|commit| commit.tree_id() == tree_oid)
    {
        return Err(GitMutationError::Validation(
            "No staged or working-tree changes are available to commit.".to_owned(),
        ));
    }

    if parent_commit.is_none() && tree.iter().next().is_none() {
        return Err(GitMutationError::Validation(
            "No staged or working-tree changes are available to commit.".to_owned(),
        ));
    }

    match parent_commit.as_ref() {
        Some(parent) => repository
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                normalized_message.as_str(),
                &tree,
                &[parent],
            )
            .map_err(map_git_mutation_error)?,
        None => repository
            .commit(
                Some("HEAD"),
                &signature,
                &signature,
                normalized_message.as_str(),
                &tree,
                &[],
            )
            .map_err(map_git_mutation_error)?,
    };

    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn push_project_git_branch(
    project_root_path: &Path,
    branch_name: Option<&str>,
    remote_name: Option<&str>,
) -> Result<GitProjectOverview, GitMutationError> {
    let repository = discover_repository_for_mutation(project_root_path)?;
    let normalized_branch_name = match branch_name {
        Some(branch_name) if !branch_name.trim().is_empty() => validate_git_branch_name(branch_name)?,
        _ => repository
            .head()
            .ok()
            .and_then(|head| {
                if head.is_branch() {
                    head.shorthand().map(str::to_owned)
                } else {
                    None
                }
            })
            .ok_or_else(|| {
                GitMutationError::Validation(
                    "Git push requires a checked-out branch or an explicit branch name."
                        .to_owned(),
                )
            })?,
    };
    let normalized_remote_name = normalize_non_empty_string(remote_name).unwrap_or_else(|| "origin".to_owned());
    let mut remote = repository
        .find_remote(normalized_remote_name.as_str())
        .map_err(|_| {
            GitMutationError::Validation(format!(
                "Git remote was not found: {normalized_remote_name}"
            ))
        })?;
    let callbacks = build_git_remote_callbacks(&repository)?;
    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);
    let refspec = format!(
        "refs/heads/{normalized_branch_name}:refs/heads/{normalized_branch_name}"
    );

    remote
        .push(&[refspec.as_str()], Some(&mut push_options))
        .map_err(map_git_mutation_error)?;
    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn create_project_git_worktree(
    project_root_path: &Path,
    branch_name: &str,
    worktree_path: &str,
) -> Result<GitProjectOverview, GitMutationError> {
    let repository = discover_repository_for_mutation(project_root_path)?;
    let normalized_branch_name = validate_git_branch_name(branch_name)?;
    let target_path = validate_git_worktree_path(worktree_path)?;
    let target_display_path = path_to_display_string(target_path.as_path());
    let target_normalized_path = normalize_display_path(target_display_path.as_str());

    if repository
        .commondir()
        .parent()
        .or_else(|| repository.workdir())
        .map(path_to_display_string)
        .is_some_and(|path| normalize_display_path(path.as_str()) == target_normalized_path)
    {
        return Err(GitMutationError::Validation(format!(
            "Git worktree path is already the repository root: {target_display_path}"
        )));
    }

    if inspect_worktree_inventory(&repository, None)
        .map_err(map_git_inspection_as_mutation_error)?
        .iter()
        .any(|worktree| normalize_display_path(worktree.path.as_str()) == target_normalized_path)
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

    let reference_name = format!("refs/heads/{normalized_branch_name}");
    if repository.find_reference(reference_name.as_str()).is_err() {
        let head_commit = repository
            .head()
            .map_err(map_git_mutation_error)?
            .peel_to_commit()
            .map_err(|_| {
                GitMutationError::Validation(
                    "Git worktree creation requires at least one existing commit.".to_owned(),
                )
            })?;
        repository
            .branch(normalized_branch_name.as_str(), &head_commit, false)
            .map_err(map_git_mutation_error)?;
    }

    let reference = repository
        .find_reference(reference_name.as_str())
        .map_err(map_git_mutation_error)?;
    let worktree_name =
        build_git_worktree_name(&repository, target_path.as_path(), normalized_branch_name.as_str())?;
    let mut add_options = WorktreeAddOptions::new();
    add_options.reference(Some(&reference));
    repository
        .worktree(worktree_name.as_str(), target_path.as_path(), Some(&add_options))
        .map_err(map_git_mutation_error)?;
    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn remove_project_git_worktree(
    project_root_path: &Path,
    worktree_path: &str,
    force: bool,
) -> Result<GitProjectOverview, GitMutationError> {
    let repository = discover_repository_for_mutation(project_root_path)?;
    let target_path = validate_git_worktree_path(worktree_path)?;
    let target_display_path = path_to_display_string(target_path.as_path());
    let target_normalized_path = normalize_display_path(target_display_path.as_str());
    let current_worktree_path = repository
        .workdir()
        .map(path_to_display_string)
        .or_else(|| Some(path_to_display_string(repository.commondir())));

    if current_worktree_path
        .as_ref()
        .is_some_and(|path| normalize_display_path(path.as_str()) == target_normalized_path)
    {
        return Err(GitMutationError::Validation(
            "Current Git worktree cannot be removed.".to_owned(),
        ));
    }

    let worktree_name = find_linked_worktree_name_by_path(&repository, target_path.as_path())?
        .ok_or_else(|| {
            GitMutationError::Validation(format!(
                "Git linked worktree was not found: {target_display_path}"
            ))
        })?;
    let worktree = repository
        .find_worktree(worktree_name.as_str())
        .map_err(map_git_mutation_error)?;

    match worktree.is_locked().map_err(map_git_mutation_error)? {
        WorktreeLockStatus::Locked(reason) => {
            let detail = reason
                .filter(|value| !value.trim().is_empty())
                .unwrap_or_else(|| "Git worktree is locked and cannot be removed.".to_owned());
            return Err(GitMutationError::Validation(detail));
        }
        WorktreeLockStatus::Unlocked => {}
    }

    if !force && target_path.exists() {
        let linked_repository =
            Repository::discover(target_path.as_path()).map_err(map_git_mutation_error)?;
        if has_uncommitted_git_changes(&linked_repository)? {
            return Err(GitMutationError::Validation(
                "Git worktree has uncommitted changes and cannot be removed without force."
                    .to_owned(),
            ));
        }
    }

    remove_worktree_filesystem_entry(target_path.as_path())?;
    let mut prune_options = WorktreePruneOptions::new();
    worktree
        .prune(Some(&mut prune_options))
        .map_err(map_git_mutation_error)?;
    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

pub fn prune_project_git_worktrees(
    project_root_path: &Path,
) -> Result<GitProjectOverview, GitMutationError> {
    let repository = discover_repository_for_mutation(project_root_path)?;
    let worktree_names = repository.worktrees().map_err(map_git_mutation_error)?;

    for worktree_name in worktree_names.iter().flatten() {
        let worktree = repository
            .find_worktree(worktree_name)
            .map_err(map_git_mutation_error)?;
        let mut inspect_options = WorktreePruneOptions::new();
        let is_prunable = worktree
            .is_prunable(Some(&mut inspect_options))
            .map_err(map_git_mutation_error)?;
        if !is_prunable {
            continue;
        }

        let mut prune_options = WorktreePruneOptions::new();
        worktree
            .prune(Some(&mut prune_options))
            .map_err(map_git_mutation_error)?;
    }

    inspect_project_git_overview(project_root_path).map_err(map_git_inspection_as_mutation_error)
}

fn inspect_status_counts(repository: &Repository) -> Result<GitStatusCounts, GitInspectionError> {
    let mut options = StatusOptions::new();
    options
        .show(git2::StatusShow::IndexAndWorkdir)
        .include_untracked(true)
        .recurse_untracked_dirs(true)
        .renames_head_to_index(true)
        .renames_index_to_workdir(true);

    let statuses = repository
        .statuses(Some(&mut options))
        .map_err(map_git_error)?;
    let mut counts = GitStatusCounts::default();

    for entry in statuses.iter() {
        let status = entry.status();
        if status.contains(Status::CONFLICTED) {
            counts.conflicted += 1;
        }
        if status.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) {
            counts.staged += 1;
        }
        if status.intersects(
            Status::WT_MODIFIED | Status::WT_RENAMED | Status::WT_TYPECHANGE | Status::WT_UNREADABLE,
        ) {
            counts.modified += 1;
        }
        if status.intersects(Status::INDEX_DELETED | Status::WT_DELETED) {
            counts.deleted += 1;
        }
        if status.contains(Status::WT_NEW) {
            counts.untracked += 1;
        }
    }

    Ok(counts)
}

fn inspect_head_state(repository: &Repository) -> (Option<String>, Option<String>, bool) {
    let detached_head = repository.head_detached().unwrap_or(false);
    match repository.head() {
        Ok(head) => {
            let current_branch = if head.is_branch() {
                head.shorthand().map(str::to_owned)
            } else {
                None
            };
            let current_revision = head.target().map(|target| target.to_string());
            (current_branch, current_revision, detached_head)
        }
        Err(_) => (None, None, detached_head),
    }
}

fn inspect_branch_inventory(
    repository: &Repository,
) -> Result<Vec<GitBranchSummary>, GitInspectionError> {
    let mut branches = Vec::new();
    let branch_iter = repository
        .branches(Some(BranchType::Local))
        .map_err(map_git_error)?;

    for branch_result in branch_iter {
        let (branch, branch_type) = branch_result.map_err(map_git_error)?;
        let Some(name) = branch.name().map_err(map_git_error)?.map(str::to_owned) else {
            continue;
        };

        let upstream_name = branch
            .upstream()
            .ok()
            .and_then(|upstream| upstream.name().ok().flatten().map(str::to_owned));
        let (ahead, behind) = match (
            branch.get().target(),
            branch.upstream().ok().and_then(|upstream| upstream.get().target()),
        ) {
            (Some(local), Some(upstream)) => repository
                .graph_ahead_behind(local, upstream)
                .unwrap_or((0, 0)),
            _ => (0, 0),
        };

        branches.push(GitBranchSummary {
            ahead,
            behind,
            is_current: branch.is_head(),
            kind: match branch_type {
                BranchType::Local => "local".to_owned(),
                BranchType::Remote => "remote".to_owned(),
            },
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

fn inspect_worktree_inventory(
    repository: &Repository,
    current_worktree_path: Option<&str>,
) -> Result<Vec<GitWorktreeSummary>, GitInspectionError> {
    let mut worktrees_by_path = BTreeMap::<String, GitWorktreeSummary>::new();

    if let Some(main_worktree_path) = repository.commondir().parent() {
        let summary = inspect_single_worktree(
            main_worktree_path,
            current_worktree_path,
            Some("main".to_owned()),
            repository,
        );
        worktrees_by_path.insert(normalize_display_path(summary.path.as_str()), summary);
    }

    if let Some(active_worktree_path) = repository.workdir() {
        let summary = inspect_single_worktree(
            active_worktree_path,
            current_worktree_path,
            Some("active".to_owned()),
            repository,
        );
        worktrees_by_path.insert(normalize_display_path(summary.path.as_str()), summary);
    }

    let worktree_names = repository.worktrees().map_err(map_git_error)?;
    for worktree_name in worktree_names.iter().flatten() {
        let worktree = repository.find_worktree(worktree_name).map_err(map_git_error)?;
        let summary =
            inspect_linked_worktree(repository, &worktree, current_worktree_path, worktree_name)?;
        worktrees_by_path.insert(normalize_display_path(summary.path.as_str()), summary);
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

fn inspect_linked_worktree(
    _repository: &Repository,
    worktree: &git2::Worktree,
    current_worktree_path: Option<&str>,
    fallback_name: &str,
) -> Result<GitWorktreeSummary, GitInspectionError> {
    let linked_repository = Repository::discover(worktree.path()).ok();
    let (branch, head, is_detached) = linked_repository
        .as_ref()
        .map(inspect_head_state)
        .map(|(branch, head, detached)| (branch, head, detached))
        .unwrap_or((None, None, false));
    let display_path = path_to_display_string(worktree.path());
    let label = worktree
        .name()
        .map(str::to_owned)
        .or_else(|| worktree.path().file_name().and_then(|name| name.to_str().map(str::to_owned)))
        .unwrap_or_else(|| fallback_name.to_owned());
    let lock_status = worktree.is_locked().map_err(map_git_error)?;
    let mut prune_options = WorktreePruneOptions::new();
    let is_prunable = worktree
        .is_prunable(Some(&mut prune_options))
        .map_err(map_git_error)?;

    Ok(GitWorktreeSummary {
        branch,
        head,
        id: normalize_display_path(display_path.as_str()),
        is_current: current_worktree_path
            .is_some_and(|current| normalize_display_path(current) == normalize_display_path(display_path.as_str())),
        is_detached,
        is_locked: matches!(lock_status, WorktreeLockStatus::Locked(_)),
        is_prunable,
        label,
        locked_reason: match lock_status {
            WorktreeLockStatus::Locked(reason) => reason,
            WorktreeLockStatus::Unlocked => None,
        },
        path: display_path,
        prunable_reason: if is_prunable {
            Some("worktree metadata is prunable".to_owned())
        } else {
            None
        },
    })
}

fn inspect_single_worktree(
    worktree_path: &Path,
    current_worktree_path: Option<&str>,
    fallback_label: Option<String>,
    repository: &Repository,
) -> GitWorktreeSummary {
    let display_path = path_to_display_string(worktree_path);
    let derived_repository = Repository::discover(worktree_path).ok();
    let (branch, head, is_detached) = derived_repository
        .as_ref()
        .map(inspect_head_state)
        .map(|(branch, head, detached)| (branch, head, detached))
        .unwrap_or_else(|| inspect_head_state(repository));
    let label = worktree_path
        .file_name()
        .and_then(|name| name.to_str().map(str::to_owned))
        .or(fallback_label)
        .unwrap_or_else(|| "worktree".to_owned());

    GitWorktreeSummary {
        branch,
        head,
        id: normalize_display_path(display_path.as_str()),
        is_current: current_worktree_path
            .is_some_and(|current| normalize_display_path(current) == normalize_display_path(display_path.as_str())),
        is_detached,
        is_locked: false,
        is_prunable: false,
        label,
        locked_reason: None,
        path: display_path,
        prunable_reason: None,
    }
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

fn map_git_error(error: git2::Error) -> GitInspectionError {
    GitInspectionError::Inspect(error.message().to_owned())
}

fn discover_repository_for_mutation(
    project_root_path: &Path,
) -> Result<Repository, GitMutationError> {
    match Repository::discover(project_root_path) {
        Ok(repository) => Ok(repository),
        Err(error) if error.code() == ErrorCode::NotFound => Err(GitMutationError::NotRepository),
        Err(error) => Err(map_git_mutation_error(error)),
    }
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

fn resolve_repository_signature(
    repository: &Repository,
) -> Result<git2::Signature<'_>, GitMutationError> {
    repository.signature().map_err(|_| {
        GitMutationError::Validation(
            "Git commit requires configured user.name and user.email.".to_owned(),
        )
    })
}

fn checkout_repository_branch(
    repository: &Repository,
    reference_name: &str,
) -> Result<(), GitMutationError> {
    repository
        .set_head(reference_name)
        .map_err(map_git_mutation_error)?;
    let mut checkout_builder = CheckoutBuilder::new();
    repository
        .checkout_head(Some(&mut checkout_builder))
        .map_err(map_git_mutation_error)
}

fn build_git_worktree_name(
    repository: &Repository,
    worktree_path: &Path,
    branch_name: &str,
) -> Result<String, GitMutationError> {
    let branch_derived_name = sanitize_git_worktree_name(branch_name.replace('/', "-").as_str());
    let path_derived_name = worktree_path
        .file_name()
        .and_then(|value| value.to_str())
        .map(sanitize_git_worktree_name)
        .unwrap_or_default();
    let mut normalized_base_name = if !branch_derived_name.is_empty() {
        branch_derived_name
    } else {
        path_derived_name
    };
    if normalized_base_name.len() > 48 {
        normalized_base_name.truncate(48);
        normalized_base_name =
            normalized_base_name.trim_matches(|character| character == '-' || character == '.').to_owned();
    }
    if normalized_base_name.is_empty() {
        return Err(GitMutationError::Validation(
            "Git worktree name could not be derived from the target path.".to_owned(),
        ));
    }

    let mut candidate = normalized_base_name.clone();
    let mut counter = 2usize;
    while repository.find_worktree(candidate.as_str()).is_ok() {
        candidate = format!("{normalized_base_name}-{counter}");
        counter += 1;
    }

    Ok(candidate)
}

fn sanitize_git_worktree_name(value: &str) -> String {
    let mut normalized = value
        .trim()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    normalized = normalized.trim_matches(|character| character == '-' || character == '.').to_owned();
    while normalized.contains("--") {
        normalized = normalized.replace("--", "-");
    }
    normalized
}

fn find_linked_worktree_name_by_path(
    repository: &Repository,
    worktree_path: &Path,
) -> Result<Option<String>, GitMutationError> {
    let target_path = normalize_display_path(path_to_display_string(worktree_path).as_str());
    let worktree_names = repository.worktrees().map_err(map_git_mutation_error)?;
    for worktree_name in worktree_names.iter().flatten() {
        let worktree = repository
            .find_worktree(worktree_name)
            .map_err(map_git_mutation_error)?;
        let candidate_path =
            normalize_display_path(path_to_display_string(worktree.path()).as_str());
        if candidate_path == target_path {
            return Ok(Some(worktree_name.to_owned()));
        }
    }

    Ok(None)
}

fn has_uncommitted_git_changes(repository: &Repository) -> Result<bool, GitMutationError> {
    let status_counts =
        inspect_status_counts(repository).map_err(map_git_inspection_as_mutation_error)?;
    Ok(
        status_counts.modified > 0
            || status_counts.staged > 0
            || status_counts.untracked > 0
            || status_counts.deleted > 0
            || status_counts.conflicted > 0,
    )
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

fn build_git_remote_callbacks(
    repository: &Repository,
) -> Result<RemoteCallbacks<'static>, GitMutationError> {
    let config = repository.config().map_err(map_git_mutation_error)?;
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |url, username_from_url, allowed_types| {
        if allowed_types.contains(CredentialType::SSH_KEY) {
            if let Some(username) = username_from_url {
                if let Ok(credential) = Cred::ssh_key_from_agent(username) {
                    return Ok(credential);
                }
            }
            if let Ok(credential) = Cred::ssh_key_from_agent("git") {
                return Ok(credential);
            }
        }

        if allowed_types.contains(CredentialType::USER_PASS_PLAINTEXT) {
            if let Ok(credential) = Cred::credential_helper(&config, url, username_from_url) {
                return Ok(credential);
            }
        }

        if allowed_types.contains(CredentialType::USERNAME) {
            return Cred::username(username_from_url.unwrap_or("git"));
        }

        Cred::default()
    });
    Ok(callbacks)
}

fn map_git_mutation_error(error: git2::Error) -> GitMutationError {
    GitMutationError::Mutate(error.message().to_owned())
}

fn map_git_inspection_as_mutation_error(error: GitInspectionError) -> GitMutationError {
    match error {
        GitInspectionError::Inspect(message) => GitMutationError::Mutate(message),
    }
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
