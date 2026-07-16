use std::path::{Path, PathBuf};
use std::sync::Arc;

use sdkwork_utils_rust::is_blank;
use sha2::{Digest, Sha256};

use crate::context::ProjectContext;
use crate::domain::commands::{
    is_valid_worktree_key, CommitProjectGitChangesRequest, CreateProjectGitBranchRequest,
    CreateProjectGitWorktreeRequest, CreateProjectRequest, PushProjectGitBranchRequest,
    RemoveProjectGitWorktreeRequest, SwitchProjectGitBranchRequest, UpdateProjectRequest,
    UpsertProjectCollaboratorRequest,
};
use crate::domain::results::{DeleteEntityPayload, ProjectCollaboratorPayload, ProjectPayload};
use crate::domain::runtime_location::RuntimeLocationCapability;
use crate::error::ProjectError;
use crate::ports::events::ProjectEventPublisher;
use crate::ports::git::{GitMutationError, GitOperations, GitProjectDiff, GitProjectOverview};
use crate::ports::project_workspace_root::ProjectWorkspaceRootResolver;
use crate::ports::repository::ProjectRepository;
use crate::ports::runtime_location_execution::ProjectRuntimeLocationExecutionResolver;
use crate::service::git_operation_coordinator::GitOperationCoordinator;

#[derive(Clone)]
pub struct ProjectService {
    repository: Arc<dyn ProjectRepository>,
    event_publisher: Arc<dyn ProjectEventPublisher>,
    git: Arc<dyn GitOperations>,
    git_operation_coordinator: GitOperationCoordinator,
    workspace_root_resolver: Arc<dyn ProjectWorkspaceRootResolver>,
    runtime_location_execution_resolver: Arc<dyn ProjectRuntimeLocationExecutionResolver>,
}

impl ProjectService {
    pub fn new(
        repository: Arc<dyn ProjectRepository>,
        event_publisher: Arc<dyn ProjectEventPublisher>,
        git: Arc<dyn GitOperations>,
        workspace_root_resolver: Arc<dyn ProjectWorkspaceRootResolver>,
        runtime_location_execution_resolver: Arc<dyn ProjectRuntimeLocationExecutionResolver>,
    ) -> Self {
        Self {
            repository,
            event_publisher,
            git,
            git_operation_coordinator: GitOperationCoordinator::default(),
            workspace_root_resolver,
            runtime_location_execution_resolver,
        }
    }

    pub async fn list_projects(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        user_id: Option<&str>,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectPayload>, usize), ProjectError> {
        if is_blank(Some(workspace_id)) {
            return Err(ProjectError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }
        if let Some(requested_user_id) = user_id {
            if requested_user_id != ctx.user_id {
                return Err(ProjectError::Forbidden(
                    "Project listing is limited to the authenticated user.".to_owned(),
                ));
            }
        }
        self.repository
            .ensure_workspace_access(ctx, workspace_id)
            .await?;
        self.repository
            .list_projects_by_workspace(ctx, workspace_id, user_id, offset, limit)
            .await
    }

    pub async fn get_project(
        &self,
        ctx: &ProjectContext,
        id: &str,
    ) -> Result<ProjectPayload, ProjectError> {
        if is_blank(Some(id)) {
            return Err(ProjectError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }
        self.repository
            .find_project_by_id(ctx, id)
            .await?
            .ok_or_else(|| ProjectError::NotFound("Project was not found.".to_owned()))
    }

    /// Authorizes a process-capable project operation without resolving a
    /// filesystem root. Callers must resolve an explicit runtime location
    /// through `ProjectRuntimeLocationExecutionResolver` after this check;
    /// this method must never revive the legacy project-root fallback.
    pub async fn require_project_execution_access(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
    ) -> Result<ProjectPayload, ProjectError> {
        if is_blank(Some(project_id)) {
            return Err(ProjectError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }

        self.repository
            .ensure_project_write_access(ctx, project_id)
            .await?;
        self.get_project(ctx, project_id).await
    }

    /// Resolve the server-owned root for an already authorized project scope.
    ///
    /// Native provider session discovery uses this boundary to associate
    /// provider records that only carry a working directory with the current
    /// project. The workspace check is deliberate: a valid project id from a
    /// different workspace must never be usable as a scope alias.
    pub async fn resolve_project_root_for_scope(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
    ) -> Result<PathBuf, ProjectError> {
        let project = self.get_project(ctx, project_id).await?;
        if project.workspace_id != workspace_id {
            return Err(ProjectError::Forbidden(
                "Project does not belong to the requested workspace.".to_owned(),
            ));
        }
        let root = self.workspace_root_resolver.resolve_project_root(
            ctx,
            &project.workspace_id,
            &project.id,
        )?;
        canonical_server_project_root(root)
    }

    /// Resolves one explicit, target-owned execution location after checking
    /// workspace membership, project write authority, and project ownership in
    /// the same tenant and organization scope. Execution never selects a
    /// subject preference and never derives a root from a project id, process
    /// directory, session field, or bootstrap configuration.
    pub async fn resolve_runtime_location_execution_root(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        project_id: &str,
        runtime_location_id: &str,
        capability: RuntimeLocationCapability,
    ) -> Result<PathBuf, ProjectError> {
        if is_blank(Some(workspace_id)) {
            return Err(ProjectError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }
        if is_blank(Some(project_id)) {
            return Err(ProjectError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }
        if is_blank(Some(runtime_location_id)) {
            return Err(ProjectError::InvalidInput(
                "runtimeLocationId is required.".to_owned(),
            ));
        }

        self.repository
            .ensure_workspace_access(ctx, workspace_id)
            .await?;
        let project = self
            .require_project_execution_access(ctx, project_id)
            .await?;
        if project.workspace_id != workspace_id {
            return Err(ProjectError::Forbidden(
                "Project does not belong to the requested workspace.".to_owned(),
            ));
        }

        let resolved = self
            .runtime_location_execution_resolver
            .resolve_execution_root(ctx, &project.id, runtime_location_id, capability)
            .await?;
        Ok(resolved.canonical_root)
    }

    pub async fn create_project(
        &self,
        ctx: &ProjectContext,
        request: &CreateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        if is_blank(Some(&request.workspace_id)) {
            return Err(ProjectError::InvalidInput(
                "workspaceId is required.".to_owned(),
            ));
        }
        if is_blank(Some(&request.name)) {
            return Err(ProjectError::InvalidInput(
                "Project name is required.".to_owned(),
            ));
        }
        self.repository
            .ensure_workspace_access(ctx, &request.workspace_id)
            .await?;

        let project = self.repository.create_project(ctx, request).await?;

        self.event_publisher
            .publish_project_created(ctx, &project.workspace_id, &project.id)
            .await?;

        Ok(project)
    }

    pub async fn update_project(
        &self,
        ctx: &ProjectContext,
        id: &str,
        request: &UpdateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        if is_blank(Some(id)) {
            return Err(ProjectError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }
        validate_project_status(request.status.as_deref())?;
        self.repository.ensure_project_write_access(ctx, id).await?;

        self.get_project(ctx, id).await?;

        let project = self.repository.update_project(ctx, id, request).await?;

        self.event_publisher
            .publish_project_updated(ctx, &project.workspace_id, &project.id)
            .await?;

        Ok(project)
    }

    pub async fn delete_project(
        &self,
        ctx: &ProjectContext,
        id: &str,
    ) -> Result<DeleteEntityPayload, ProjectError> {
        if is_blank(Some(id)) {
            return Err(ProjectError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }
        self.repository.ensure_project_write_access(ctx, id).await?;

        let workspace_id = self.get_project(ctx, id).await?.workspace_id;

        self.repository.delete_project(ctx, id).await?;

        self.event_publisher
            .publish_project_deleted(ctx, &workspace_id, id)
            .await?;

        Ok(DeleteEntityPayload { id: id.to_owned() })
    }

    pub async fn list_project_collaborators(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectCollaboratorPayload>, usize), ProjectError> {
        if is_blank(Some(project_id)) {
            return Err(ProjectError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }
        self.get_project(ctx, project_id).await?;
        self.repository
            .list_project_collaborators(ctx, project_id, offset, limit)
            .await
    }

    pub async fn upsert_project_collaborator(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        request: &UpsertProjectCollaboratorRequest,
    ) -> Result<ProjectCollaboratorPayload, ProjectError> {
        if is_blank(Some(project_id)) {
            return Err(ProjectError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }
        self.repository
            .ensure_project_manage_access(ctx, project_id)
            .await?;

        let workspace_id = self.get_project(ctx, project_id).await?.workspace_id;

        let collaborator = self
            .repository
            .upsert_project_collaborator(ctx, project_id, request)
            .await?;

        self.event_publisher
            .publish_project_collaborator_added(
                ctx,
                &workspace_id,
                project_id,
                &collaborator.user_id,
            )
            .await?;

        Ok(collaborator)
    }

    pub async fn remove_project_collaborator(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        user_id: &str,
    ) -> Result<(), ProjectError> {
        if is_blank(Some(project_id)) {
            return Err(ProjectError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }
        if is_blank(Some(user_id)) {
            return Err(ProjectError::InvalidInput("userId is required.".to_owned()));
        }
        self.repository
            .ensure_project_manage_access(ctx, project_id)
            .await?;

        let workspace_id = self.get_project(ctx, project_id).await?.workspace_id;

        self.repository
            .remove_project_collaborator(ctx, project_id, user_id)
            .await?;

        self.event_publisher
            .publish_project_collaborator_removed(ctx, &workspace_id, project_id, user_id)
            .await?;

        Ok(())
    }

    pub async fn get_project_git_overview(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self
            .resolve_git_execution_root(ctx, project_id, runtime_location_id, false)
            .await?;
        let project_lock = self
            .git_operation_coordinator
            .project_lock(project_id)
            .await;
        let _read_guard = project_lock.read().await;
        self.git
            .inspect_overview(root_path.to_string_lossy().as_ref())
            .await
            .map_err(map_git_error)
    }

    pub async fn get_project_git_diff(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
    ) -> Result<GitProjectDiff, ProjectError> {
        let root_path = self
            .resolve_git_execution_root(ctx, project_id, runtime_location_id, false)
            .await?;
        let project_lock = self
            .git_operation_coordinator
            .project_lock(project_id)
            .await;
        let _read_guard = project_lock.read().await;
        self.git
            .inspect_diff(root_path.to_string_lossy().as_ref())
            .await
            .map_err(map_git_error)
    }

    pub async fn create_project_git_branch(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        request: &CreateProjectGitBranchRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self
            .resolve_git_execution_root(ctx, project_id, runtime_location_id, true)
            .await?;
        let project_lock = self
            .git_operation_coordinator
            .project_lock(project_id)
            .await;
        let _write_guard = project_lock.write().await;
        self.git
            .create_branch(root_path.to_string_lossy().as_ref(), &request.branch_name)
            .await
            .map_err(map_git_error)
    }

    pub async fn switch_project_git_branch(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        request: &SwitchProjectGitBranchRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self
            .resolve_git_execution_root(ctx, project_id, runtime_location_id, true)
            .await?;
        let project_lock = self
            .git_operation_coordinator
            .project_lock(project_id)
            .await;
        let _write_guard = project_lock.write().await;
        self.git
            .switch_branch(root_path.to_string_lossy().as_ref(), &request.branch_name)
            .await
            .map_err(map_git_error)
    }

    pub async fn commit_project_git_changes(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        request: &CommitProjectGitChangesRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self
            .resolve_git_execution_root(ctx, project_id, runtime_location_id, true)
            .await?;
        let project_lock = self
            .git_operation_coordinator
            .project_lock(project_id)
            .await;
        let _write_guard = project_lock.write().await;
        self.git
            .commit_changes(
                root_path.to_string_lossy().as_ref(),
                &request.message,
                request.include_unstaged.unwrap_or(true),
            )
            .await
            .map_err(map_git_error)
    }

    pub async fn push_project_git_branch(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        request: &PushProjectGitBranchRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self
            .resolve_git_execution_root(ctx, project_id, runtime_location_id, true)
            .await?;
        let project_lock = self
            .git_operation_coordinator
            .project_lock(project_id)
            .await;
        let _write_guard = project_lock.write().await;
        self.git
            .push_branch(
                root_path.to_string_lossy().as_ref(),
                request.branch_name.as_deref(),
                request.remote_name.as_deref(),
            )
            .await
            .map_err(map_git_error)
    }

    pub async fn create_project_git_worktree(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        request: &CreateProjectGitWorktreeRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self
            .resolve_git_execution_root(ctx, project_id, runtime_location_id, true)
            .await?;
        let project_lock = self
            .git_operation_coordinator
            .project_lock(project_id)
            .await;
        let _write_guard = project_lock.write().await;
        let worktree_key = derived_worktree_key(&request.branch_name)?;
        let worktree_path = managed_worktree_path(&root_path, &worktree_key, true)?;
        self.git
            .create_worktree(
                root_path.to_string_lossy().as_ref(),
                &request.branch_name,
                worktree_path.to_string_lossy().as_ref(),
            )
            .await
            .map_err(map_git_error)
    }

    pub async fn remove_project_git_worktree(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        request: &RemoveProjectGitWorktreeRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        if !is_valid_worktree_key(&request.worktree_key) {
            return Err(ProjectError::InvalidInput(
                "worktreeKey must be a server-generated SHA-256 key.".to_owned(),
            ));
        }
        let root_path = self
            .resolve_git_execution_root(ctx, project_id, runtime_location_id, true)
            .await?;
        let project_lock = self
            .git_operation_coordinator
            .project_lock(project_id)
            .await;
        let _write_guard = project_lock.write().await;
        let worktree_path = managed_worktree_path(&root_path, &request.worktree_key, false)?;
        self.git
            .remove_worktree(
                root_path.to_string_lossy().as_ref(),
                worktree_path.to_string_lossy().as_ref(),
                request.force.unwrap_or(false),
            )
            .await
            .map_err(map_git_error)
    }

    pub async fn prune_project_git_worktrees(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self
            .resolve_git_execution_root(ctx, project_id, runtime_location_id, true)
            .await?;
        let project_lock = self
            .git_operation_coordinator
            .project_lock(project_id)
            .await;
        let _write_guard = project_lock.write().await;
        self.git
            .prune_worktrees(root_path.to_string_lossy().as_ref())
            .await
            .map_err(map_git_error)
    }

    async fn resolve_git_execution_root(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        require_write_access: bool,
    ) -> Result<PathBuf, ProjectError> {
        if is_blank(Some(project_id)) {
            return Err(ProjectError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }
        if is_blank(Some(runtime_location_id)) {
            return Err(ProjectError::InvalidInput(
                "runtimeLocationId is required for Git operations.".to_owned(),
            ));
        }
        if require_write_access {
            self.repository
                .ensure_project_write_access(ctx, project_id)
                .await?;
        }
        let resolved = self
            .runtime_location_execution_resolver
            .resolve_execution_root(
                ctx,
                project_id,
                runtime_location_id,
                RuntimeLocationCapability::Git,
            )
            .await?;
        Ok(resolved.canonical_root)
    }
}

fn map_git_error(error: GitMutationError) -> ProjectError {
    match error {
        GitMutationError::NotRepository => {
            ProjectError::GitOperation("Project root path is not a Git repository.".to_owned())
        }
        GitMutationError::Validation(detail) => ProjectError::InvalidInput(detail),
        GitMutationError::Mutate(_) => {
            ProjectError::GitOperation("Git operation could not be completed.".to_owned())
        }
    }
}

fn validate_project_status(status: Option<&str>) -> Result<(), ProjectError> {
    let Some(status) = status else {
        return Ok(());
    };
    if matches!(
        status.trim().to_ascii_lowercase().as_str(),
        "active" | "archived"
    ) {
        Ok(())
    } else {
        Err(ProjectError::InvalidInput(
            "status must be active or archived.".to_owned(),
        ))
    }
}

fn derived_worktree_key(branch_name: &str) -> Result<String, ProjectError> {
    let branch_name = branch_name.trim();
    if branch_name.is_empty() {
        return Err(ProjectError::InvalidInput(
            "branchName is required.".to_owned(),
        ));
    }
    Ok(hex::encode(Sha256::digest(branch_name.as_bytes())))
}

fn canonical_server_project_root(root: PathBuf) -> Result<PathBuf, ProjectError> {
    let metadata = std::fs::symlink_metadata(&root).map_err(|_| {
        ProjectError::Unavailable("Server project workspace is unavailable.".to_owned())
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(ProjectError::Unavailable(
            "Server project workspace is unavailable.".to_owned(),
        ));
    }
    std::fs::canonicalize(root).map_err(|_| {
        ProjectError::Unavailable("Server project workspace is unavailable.".to_owned())
    })
}

fn managed_worktree_path(
    project_root: &Path,
    worktree_key: &str,
    create_parent: bool,
) -> Result<PathBuf, ProjectError> {
    if !is_valid_worktree_key(worktree_key) {
        return Err(ProjectError::InvalidInput(
            "worktreeKey must be a server-generated SHA-256 key.".to_owned(),
        ));
    }

    let managed_root = project_root.join(".sdkwork-worktrees");
    if create_parent && !managed_root.exists() {
        std::fs::create_dir(&managed_root).map_err(|_| {
            ProjectError::GitOperation("Managed worktree storage is unavailable.".to_owned())
        })?;
    }
    let metadata = std::fs::symlink_metadata(&managed_root)
        .map_err(|_| ProjectError::NotFound("Worktree was not found.".to_owned()))?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(ProjectError::GitOperation(
            "Managed worktree storage is unavailable.".to_owned(),
        ));
    }

    let canonical_root = std::fs::canonicalize(project_root).map_err(|_| {
        ProjectError::GitOperation("Server project workspace is unavailable.".to_owned())
    })?;
    let canonical_managed_root = std::fs::canonicalize(&managed_root).map_err(|_| {
        ProjectError::GitOperation("Managed worktree storage is unavailable.".to_owned())
    })?;
    if !canonical_managed_root.starts_with(&canonical_root)
        || canonical_managed_root.parent() != Some(canonical_root.as_path())
    {
        return Err(ProjectError::GitOperation(
            "Managed worktree storage is unavailable.".to_owned(),
        ));
    }

    let candidate = canonical_managed_root.join(worktree_key);
    if let Ok(metadata) = std::fs::symlink_metadata(&candidate) {
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(ProjectError::GitOperation(
                "Managed worktree storage is unavailable.".to_owned(),
            ));
        }
        let canonical_candidate = std::fs::canonicalize(&candidate).map_err(|_| {
            ProjectError::GitOperation("Managed worktree storage is unavailable.".to_owned())
        })?;
        if !canonical_candidate.starts_with(&canonical_managed_root)
            || canonical_candidate.parent() != Some(canonical_managed_root.as_path())
        {
            return Err(ProjectError::GitOperation(
                "Managed worktree storage is unavailable.".to_owned(),
            ));
        }
    }
    Ok(candidate)
}
