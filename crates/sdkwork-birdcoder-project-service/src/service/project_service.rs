use std::sync::Arc;

use sdkwork_utils_rust::is_blank;

use crate::context::ProjectContext;
use crate::domain::commands::{
    CommitProjectGitChangesRequest, CreateProjectGitBranchRequest, CreateProjectGitWorktreeRequest,
    CreateProjectRequest, PushProjectGitBranchRequest, RemoveProjectGitWorktreeRequest,
    SwitchProjectGitBranchRequest, UpdateProjectRequest, UpsertProjectCollaboratorRequest,
};
use crate::domain::results::{DeleteEntityPayload, ProjectCollaboratorPayload, ProjectPayload};
use crate::error::ProjectError;
use crate::ports::events::ProjectEventPublisher;
use crate::ports::git::{GitOperations, GitProjectOverview, GitMutationError};
use crate::ports::repository::ProjectRepository;

#[derive(Clone)]
pub struct ProjectService {
    repository: Arc<dyn ProjectRepository>,
    event_publisher: Arc<dyn ProjectEventPublisher>,
    git: Arc<dyn GitOperations>,
}

impl ProjectService {
    pub fn new(
        repository: Arc<dyn ProjectRepository>,
        event_publisher: Arc<dyn ProjectEventPublisher>,
        git: Arc<dyn GitOperations>,
    ) -> Self {
        Self {
            repository,
            event_publisher,
            git,
        }
    }

    pub async fn list_projects(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
    ) -> Result<Vec<ProjectPayload>, ProjectError> {
        self.repository
            .list_projects_by_workspace(ctx, workspace_id)
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

        let project = self.repository.create_project(ctx, request).await?;

        self.event_publisher
            .publish_project_created(&project.id)
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

        let existing = self.repository.find_project_by_id(ctx, id).await?;
        if existing.is_none() {
            return Err(ProjectError::NotFound(
                "Project was not found.".to_owned(),
            ));
        }

        let project = self.repository.update_project(ctx, id, request).await?;

        self.event_publisher
            .publish_project_updated(&project.id)
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

        self.repository.delete_project(ctx, id).await?;

        self.event_publisher.publish_project_deleted(id).await?;

        Ok(DeleteEntityPayload { id: id.to_owned() })
    }

    pub async fn list_project_collaborators(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
    ) -> Result<Vec<ProjectCollaboratorPayload>, ProjectError> {
        if is_blank(Some(project_id)) {
            return Err(ProjectError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }
        self.repository
            .list_project_collaborators(ctx, project_id)
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

        let project = self.repository.find_project_by_id(ctx, project_id).await?;
        if project.is_none() {
            return Err(ProjectError::NotFound(
                "Project was not found.".to_owned(),
            ));
        }

        let collaborator = self
            .repository
            .upsert_project_collaborator(ctx, project_id, request)
            .await?;

        self.event_publisher
            .publish_project_collaborator_added(project_id, &collaborator.user_id)
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
            return Err(ProjectError::InvalidInput(
                "userId is required.".to_owned(),
            ));
        }

        self.repository
            .remove_project_collaborator(ctx, project_id, user_id)
            .await?;

        self.event_publisher
            .publish_project_collaborator_removed(project_id, user_id)
            .await?;

        Ok(())
    }

    pub async fn get_project_git_overview(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self.resolve_project_root_path(ctx, project_id).await?;
        self.git
            .inspect_overview(&root_path)
            .await
            .map_err(|e| ProjectError::GitOperation(e.to_string()))
    }

    pub async fn create_project_git_branch(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        request: &CreateProjectGitBranchRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self.resolve_project_root_path(ctx, project_id).await?;
        self.git
            .create_branch(&root_path, &request.branch_name)
            .await
            .map_err(map_git_error)
    }

    pub async fn switch_project_git_branch(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        request: &SwitchProjectGitBranchRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self.resolve_project_root_path(ctx, project_id).await?;
        self.git
            .switch_branch(&root_path, &request.branch_name)
            .await
            .map_err(map_git_error)
    }

    pub async fn commit_project_git_changes(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        request: &CommitProjectGitChangesRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self.resolve_project_root_path(ctx, project_id).await?;
        self.git
            .commit_changes(&root_path, &request.message)
            .await
            .map_err(map_git_error)
    }

    pub async fn push_project_git_branch(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        request: &PushProjectGitBranchRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self.resolve_project_root_path(ctx, project_id).await?;
        self.git
            .push_branch(
                &root_path,
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
        request: &CreateProjectGitWorktreeRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self.resolve_project_root_path(ctx, project_id).await?;
        self.git
            .create_worktree(&root_path, &request.branch_name, &request.path)
            .await
            .map_err(map_git_error)
    }

    pub async fn remove_project_git_worktree(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        request: &RemoveProjectGitWorktreeRequest,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self.resolve_project_root_path(ctx, project_id).await?;
        self.git
            .remove_worktree(&root_path, &request.path, request.force.unwrap_or(false))
            .await
            .map_err(map_git_error)
    }

    pub async fn prune_project_git_worktrees(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
    ) -> Result<GitProjectOverview, ProjectError> {
        let root_path = self.resolve_project_root_path(ctx, project_id).await?;
        self.git
            .prune_worktrees(&root_path)
            .await
            .map_err(map_git_error)
    }

    async fn resolve_project_root_path(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
    ) -> Result<String, ProjectError> {
        if is_blank(Some(project_id)) {
            return Err(ProjectError::InvalidInput(
                "projectId is required.".to_owned(),
            ));
        }
        let project = self
            .repository
            .find_project_by_id(ctx, project_id)
            .await?
            .ok_or_else(|| ProjectError::NotFound("Project was not found.".to_owned()))?;
        project
            .root_path
            .ok_or_else(|| ProjectError::NotFound("Project root path was not found.".to_owned()))
    }
}

fn map_git_error(error: GitMutationError) -> ProjectError {
    match error {
        GitMutationError::NotRepository => {
            ProjectError::GitOperation("Project root path is not a Git repository.".to_owned())
        }
        GitMutationError::Validation(detail) => ProjectError::InvalidInput(detail),
        GitMutationError::Mutate(detail) => ProjectError::GitOperation(detail),
    }
}
