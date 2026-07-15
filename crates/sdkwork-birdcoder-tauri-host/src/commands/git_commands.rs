use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;
use sha2::{Digest, Sha256};

use super::filesystem_commands::resolve_root_directory_path;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DesktopGitOverviewStatus {
    Ready,
    NotRepository,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopGitStatusCounts {
    pub staged: usize,
    pub unstaged: usize,
    pub untracked: usize,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopGitBranchSummary {
    pub is_current: bool,
    pub is_remote: bool,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopGitWorktreeSummary {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub head: Option<String>,
    pub is_current: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub prunable_reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub worktree_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopGitProjectOverview {
    pub branches: Vec<DesktopGitBranchSummary>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_revision: Option<String>,
    pub detached_head: bool,
    pub status: DesktopGitOverviewStatus,
    pub status_counts: DesktopGitStatusCounts,
    pub worktrees: Vec<DesktopGitWorktreeSummary>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopGitProjectDiff {
    pub patch: String,
    pub truncated: bool,
}

fn worktree_key_for_branch(branch_name: &str) -> Result<String, String> {
    let branch_name = branch_name.trim();
    if branch_name.is_empty() {
        return Err("branch name is required".to_string());
    }
    Ok(hex::encode(Sha256::digest(branch_name.as_bytes())))
}

fn is_valid_worktree_key(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| matches!(byte, b'0'..=b'9' | b'a'..=b'f'))
}

fn managed_worktree_root(project_root: &Path, create: bool) -> Result<PathBuf, String> {
    let managed_root = project_root.join(".sdkwork-worktrees");
    if create && !managed_root.exists() {
        fs::create_dir(&managed_root)
            .map_err(|error| format!("failed to create managed worktree directory: {error}"))?;
    }
    let metadata = fs::symlink_metadata(&managed_root)
        .map_err(|_| "managed worktree directory is unavailable".to_string())?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err("managed worktree directory is unavailable".to_string());
    }
    let canonical_root = project_root
        .canonicalize()
        .map_err(|_| "mounted Git root is unavailable".to_string())?;
    let canonical_managed_root = managed_root
        .canonicalize()
        .map_err(|_| "managed worktree directory is unavailable".to_string())?;
    if canonical_managed_root.parent() != Some(canonical_root.as_path()) {
        return Err("managed worktree directory escaped the mounted Git root".to_string());
    }
    // Keep the canonical path only for containment checks. Git for Windows
    // does not accept the `\\?\` verbatim prefix for worktree destinations.
    Ok(managed_root)
}

fn managed_worktree_path(
    project_root: &Path,
    worktree_key: &str,
    create_parent: bool,
) -> Result<PathBuf, String> {
    if !is_valid_worktree_key(worktree_key) {
        return Err("worktree key must be a generated SHA-256 key".to_string());
    }
    let managed_root = managed_worktree_root(project_root, create_parent)?;
    let candidate = managed_root.join(worktree_key);
    if let Ok(metadata) = fs::symlink_metadata(&candidate) {
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err("managed worktree path is unavailable".to_string());
        }
        let canonical_candidate = candidate
            .canonicalize()
            .map_err(|_| "managed worktree path is unavailable".to_string())?;
        let canonical_managed_root = managed_root
            .canonicalize()
            .map_err(|_| "managed worktree directory is unavailable".to_string())?;
        if canonical_candidate.parent() != Some(canonical_managed_root.as_path()) {
            return Err("managed worktree path escaped its storage root".to_string());
        }
    }
    Ok(candidate)
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

fn map_overview(
    project_root: &Path,
    overview: sdkwork_birdcoder_git::GitProjectOverview,
) -> DesktopGitProjectOverview {
    DesktopGitProjectOverview {
        branches: overview
            .branches
            .into_iter()
            .map(|branch| DesktopGitBranchSummary {
                is_current: branch.is_current,
                is_remote: branch.kind == "remote",
                name: branch.name,
            })
            .collect(),
        current_branch: overview.current_branch,
        current_revision: overview.current_revision,
        detached_head: overview.detached_head,
        status: match overview.status {
            sdkwork_birdcoder_git::GitOverviewStatus::Ready => DesktopGitOverviewStatus::Ready,
            sdkwork_birdcoder_git::GitOverviewStatus::NotRepository => {
                DesktopGitOverviewStatus::NotRepository
            }
        },
        status_counts: DesktopGitStatusCounts {
            staged: overview.status_counts.staged,
            unstaged: overview.status_counts.modified
                + overview.status_counts.deleted
                + overview.status_counts.conflicted,
            untracked: overview.status_counts.untracked,
        },
        worktrees: overview
            .worktrees
            .into_iter()
            .map(|worktree| DesktopGitWorktreeSummary {
                worktree_key: managed_worktree_key(project_root, Path::new(&worktree.path)),
                branch: worktree.branch,
                head: worktree.head,
                is_current: worktree.is_current,
                prunable_reason: worktree.prunable_reason,
            })
            .collect(),
    }
}

#[cfg(windows)]
fn git_cli_root_path(authorized_root: &Path) -> PathBuf {
    let value = authorized_root.to_string_lossy();
    if let Some(unc_path) = value.strip_prefix(r"\\?\UNC\") {
        return PathBuf::from(format!(r"\\{unc_path}"));
    }
    if let Some(local_path) = value.strip_prefix(r"\\?\") {
        return PathBuf::from(local_path);
    }
    authorized_root.to_path_buf()
}

#[cfg(not(windows))]
fn git_cli_root_path(authorized_root: &Path) -> PathBuf {
    authorized_root.to_path_buf()
}

async fn run_with_git_root<T, F>(root_path: String, operation: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce(PathBuf, String) -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || {
        let authorized_root = resolve_root_directory_path(&root_path)?;
        let root = git_cli_root_path(&authorized_root);
        let root_string = root.to_string_lossy().into_owned();
        operation(root, root_string)
    })
    .await
    .map_err(|error| format!("failed to join desktop Git operation: {error}"))?
}

#[tauri::command]
pub async fn git_project_overview(root_path: String) -> Result<DesktopGitProjectOverview, String> {
    run_with_git_root(root_path, |root, root_string| {
        sdkwork_birdcoder_git::inspect_project_git_overview(&root_string)
            .map(|overview| map_overview(&root, overview))
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_project_diff(root_path: String) -> Result<DesktopGitProjectDiff, String> {
    run_with_git_root(root_path, |_root, root_string| {
        sdkwork_birdcoder_git::inspect_project_git_diff(&root_string)
            .map(|diff| DesktopGitProjectDiff {
                patch: diff.patch,
                truncated: diff.truncated,
            })
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_create_branch(
    root_path: String,
    branch_name: String,
) -> Result<DesktopGitProjectOverview, String> {
    run_with_git_root(root_path, move |root, root_string| {
        sdkwork_birdcoder_git::create_project_git_branch(&root_string, &branch_name)
            .map(|overview| map_overview(&root, overview))
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_switch_branch(
    root_path: String,
    branch_name: String,
) -> Result<DesktopGitProjectOverview, String> {
    run_with_git_root(root_path, move |root, root_string| {
        sdkwork_birdcoder_git::switch_project_git_branch(&root_string, &branch_name)
            .map(|overview| map_overview(&root, overview))
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_commit_changes(
    root_path: String,
    message: String,
    include_unstaged: bool,
) -> Result<DesktopGitProjectOverview, String> {
    run_with_git_root(root_path, move |root, root_string| {
        sdkwork_birdcoder_git::commit_project_git_changes(&root_string, &message, include_unstaged)
            .map(|overview| map_overview(&root, overview))
            .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_push_branch(
    root_path: String,
    branch_name: Option<String>,
    remote_name: Option<String>,
) -> Result<DesktopGitProjectOverview, String> {
    run_with_git_root(root_path, move |root, root_string| {
        sdkwork_birdcoder_git::push_project_git_branch(
            &root_string,
            branch_name.as_deref(),
            remote_name.as_deref(),
        )
        .map(|overview| map_overview(&root, overview))
        .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_create_worktree(
    root_path: String,
    branch_name: String,
) -> Result<DesktopGitProjectOverview, String> {
    run_with_git_root(root_path, move |root, root_string| {
        let worktree_key = worktree_key_for_branch(&branch_name)?;
        let worktree_path = managed_worktree_path(&root, &worktree_key, true)?;
        sdkwork_birdcoder_git::create_project_git_worktree(
            &root_string,
            &branch_name,
            worktree_path.to_string_lossy().as_ref(),
        )
        .map(|overview| map_overview(&root, overview))
        .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_remove_worktree(
    root_path: String,
    worktree_key: String,
    force: bool,
) -> Result<DesktopGitProjectOverview, String> {
    run_with_git_root(root_path, move |root, root_string| {
        let worktree_path = managed_worktree_path(&root, &worktree_key, false)?;
        sdkwork_birdcoder_git::remove_project_git_worktree(
            &root_string,
            worktree_path.to_string_lossy().as_ref(),
            force,
        )
        .map(|overview| map_overview(&root, overview))
        .map_err(|error| error.to_string())
    })
    .await
}

#[tauri::command]
pub async fn git_prune_worktrees(root_path: String) -> Result<DesktopGitProjectOverview, String> {
    run_with_git_root(root_path, |root, root_string| {
        sdkwork_birdcoder_git::prune_project_git_worktrees(&root_string)
            .map(|overview| map_overview(&root, overview))
            .map_err(|error| error.to_string())
    })
    .await
}

#[cfg(test)]
mod tests {
    use std::process::Command;

    use super::*;
    use crate::commands::filesystem_commands::register_allowed_fs_root;

    struct TestDirectory {
        root: PathBuf,
    }

    impl TestDirectory {
        fn new(label: &str) -> Self {
            let root = std::env::temp_dir().join(format!(
                "sdkwork-birdcoder-tauri-git-{label}-{}-{}",
                std::process::id(),
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .expect("test clock")
                    .as_nanos()
            ));
            fs::create_dir_all(&root).expect("create test directory");
            Self { root }
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.root);
        }
    }

    fn run_git(root: &Path, args: &[&str]) -> String {
        let output = Command::new("git")
            .args(args)
            .current_dir(root)
            .output()
            .expect("execute git");
        assert!(
            output.status.success(),
            "git {:?} failed: {}",
            args,
            String::from_utf8_lossy(&output.stderr)
        );
        String::from_utf8_lossy(&output.stdout).trim().to_owned()
    }

    fn create_repository(label: &str) -> TestDirectory {
        let repository = TestDirectory::new(label);
        run_git(&repository.root, &["init", "-b", "main"]);
        run_git(
            &repository.root,
            &["config", "user.email", "tauri-git@test.invalid"],
        );
        run_git(&repository.root, &["config", "user.name", "Tauri Git Test"]);
        repository
    }

    #[tokio::test]
    async fn rejects_unregistered_git_roots() {
        let repository = create_repository("unauthorized");
        let error = git_project_overview(repository.root.to_string_lossy().into_owned())
            .await
            .expect_err("unregistered root must be rejected");
        assert!(
            error.contains("not registered"),
            "unexpected error: {error}"
        );
    }

    #[tokio::test]
    async fn mounted_repository_supports_commit_push_and_worktrees() {
        let repository = create_repository("workflow");
        register_allowed_fs_root(repository.root.clone()).expect("authorize repository root");

        fs::write(repository.root.join("README.md"), "mounted repository\n")
            .expect("write repository file");
        let committed = git_commit_changes(
            repository.root.to_string_lossy().into_owned(),
            "initial desktop commit".to_string(),
            true,
        )
        .await
        .expect("commit through Tauri command");
        assert_eq!(committed.current_branch.as_deref(), Some("main"));
        assert_eq!(committed.status_counts.untracked, 0);

        let remote = TestDirectory::new("remote");
        run_git(&remote.root, &["init", "--bare"]);
        run_git(
            &repository.root,
            &[
                "remote",
                "add",
                "origin",
                remote.root.to_string_lossy().as_ref(),
            ],
        );
        let pushed = git_push_branch(
            repository.root.to_string_lossy().into_owned(),
            Some("main".to_string()),
            None,
        )
        .await
        .expect("push through Tauri command");
        assert_eq!(pushed.current_branch.as_deref(), Some("main"));
        assert!(!run_git(&remote.root, &["rev-parse", "refs/heads/main"]).is_empty());

        let worktree_overview = git_create_worktree(
            repository.root.to_string_lossy().into_owned(),
            "feature/desktop-git".to_string(),
        )
        .await
        .expect("create managed worktree");
        let managed_worktree = worktree_overview
            .worktrees
            .iter()
            .find(|worktree| worktree.branch.as_deref() == Some("feature/desktop-git"))
            .expect("managed worktree overview");
        let worktree_key = managed_worktree
            .worktree_key
            .clone()
            .expect("managed worktree key");
        assert!(is_valid_worktree_key(&worktree_key));

        let removed = git_remove_worktree(
            repository.root.to_string_lossy().into_owned(),
            worktree_key,
            false,
        )
        .await
        .expect("remove managed worktree");
        assert!(removed
            .worktrees
            .iter()
            .all(|worktree| worktree.branch.as_deref() != Some("feature/desktop-git")));
    }

    #[test]
    fn desktop_overview_status_uses_public_snake_case_contract() {
        assert_eq!(
            serde_json::to_value(DesktopGitOverviewStatus::NotRepository)
                .expect("serialize status"),
            serde_json::json!("not_repository")
        );
    }
}
