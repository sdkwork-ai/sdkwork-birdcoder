use crate::context::ProjectContext;
use crate::domain::commands::{CreateProjectRequest, UpdateProjectRequest};
use crate::domain::results::ProjectPayload;
use crate::error::ProjectError;

#[async_trait::async_trait]
pub trait ProjectRepository: Send + Sync {
    async fn find_project_by_id(
        &self,
        ctx: &ProjectContext,
        id: &str,
    ) -> Result<Option<ProjectPayload>, ProjectError>;
    async fn ensure_workspace_access(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
    ) -> Result<(), ProjectError>;
    async fn ensure_project_write_access(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
    ) -> Result<(), ProjectError>;
    /// List projects for a workspace with SQL-pushed `LIMIT`/`OFFSET` and a
    /// parallel `COUNT(*)` for the total. Aligns with `PAGINATION_SPEC.md`
    /// sections 2 and 5: no in-memory pagination and mandatory store-layer
    /// push-down.
    async fn list_projects_by_workspace(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        user_id: Option<&str>,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectPayload>, usize), ProjectError>;
    async fn create_project(
        &self,
        ctx: &ProjectContext,
        req: &CreateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError>;
    async fn update_project(
        &self,
        ctx: &ProjectContext,
        id: &str,
        req: &UpdateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError>;
    async fn delete_project(
        &self,
        ctx: &ProjectContext,
        id: &str,
        expected_version: i64,
    ) -> Result<(), ProjectError>;
}
