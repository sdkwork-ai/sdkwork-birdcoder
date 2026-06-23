use crate::context::ProjectContext;
use crate::domain::commands::{
    CreateProjectRequest, UpdateProjectRequest, UpsertProjectCollaboratorRequest,
};
use crate::domain::results::{ProjectCollaboratorPayload, ProjectPayload};
use crate::error::ProjectError;

#[async_trait::async_trait]
pub trait ProjectRepository: Send + Sync {
    async fn find_project_by_id(&self, ctx: &ProjectContext, id: &str) -> Result<Option<ProjectPayload>, ProjectError>;
    async fn list_projects_by_workspace(&self, ctx: &ProjectContext, workspace_id: &str) -> Result<Vec<ProjectPayload>, ProjectError>;
    async fn create_project(&self, ctx: &ProjectContext, req: &CreateProjectRequest) -> Result<ProjectPayload, ProjectError>;
    async fn update_project(&self, ctx: &ProjectContext, id: &str, req: &UpdateProjectRequest) -> Result<ProjectPayload, ProjectError>;
    async fn delete_project(&self, ctx: &ProjectContext, id: &str) -> Result<(), ProjectError>;
    async fn list_project_collaborators(&self, ctx: &ProjectContext, project_id: &str) -> Result<Vec<ProjectCollaboratorPayload>, ProjectError>;
    async fn upsert_project_collaborator(&self, ctx: &ProjectContext, project_id: &str, req: &UpsertProjectCollaboratorRequest) -> Result<ProjectCollaboratorPayload, ProjectError>;
    async fn remove_project_collaborator(&self, ctx: &ProjectContext, project_id: &str, user_id: &str) -> Result<(), ProjectError>;
}
