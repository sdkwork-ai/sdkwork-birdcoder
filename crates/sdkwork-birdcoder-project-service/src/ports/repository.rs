use crate::context::ProjectContext;
use crate::domain::commands::{
    CreateProjectRequest, UpdateProjectRequest, UpsertProjectCollaboratorRequest,
};
use crate::domain::results::{ProjectCollaboratorPayload, ProjectPayload};
use crate::error::ProjectError;

#[async_trait::async_trait]
pub trait ProjectRepository: Send + Sync {
    async fn find_project_by_id(&self, ctx: &ProjectContext, id: &str) -> Result<Option<ProjectPayload>, ProjectError>;
    /// List projects for a workspace with SQL-pushed `LIMIT`/`OFFSET` and a
    /// parallel `COUNT(*)` for the total. Aligns with `PAGINATION_SPEC.md`
    /// §2 (no in-memory `skip`/`take`) and §5 (store-layer push-down).
    async fn list_projects_by_workspace(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        root_path: Option<&str>,
        user_id: Option<&str>,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectPayload>, usize), ProjectError>;
    async fn create_project(&self, ctx: &ProjectContext, req: &CreateProjectRequest) -> Result<ProjectPayload, ProjectError>;
    async fn update_project(&self, ctx: &ProjectContext, id: &str, req: &UpdateProjectRequest) -> Result<ProjectPayload, ProjectError>;
    async fn delete_project(&self, ctx: &ProjectContext, id: &str) -> Result<(), ProjectError>;
    /// List project collaborators with SQL-pushed `LIMIT`/`OFFSET` and a
    /// parallel `COUNT(*)` for the total.
    async fn list_project_collaborators(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectCollaboratorPayload>, usize), ProjectError>;
    async fn upsert_project_collaborator(&self, ctx: &ProjectContext, project_id: &str, req: &UpsertProjectCollaboratorRequest) -> Result<ProjectCollaboratorPayload, ProjectError>;
    async fn remove_project_collaborator(&self, ctx: &ProjectContext, project_id: &str, user_id: &str) -> Result<(), ProjectError>;
}
