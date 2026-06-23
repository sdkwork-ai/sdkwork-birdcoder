use sdkwork_birdcoder_errors::{require_scoped_tenant_id, require_scoped_user_id};
use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;

pub fn scoped_tenant_id(ctx: &WorkspaceContext) -> Result<i64, WorkspaceError> {
    require_scoped_tenant_id(&ctx.tenant_id).map_err(|_| {
        WorkspaceError::Forbidden("A valid tenant scope is required.".to_owned())
    })
}

pub fn scoped_user_id(ctx: &WorkspaceContext) -> Result<i64, WorkspaceError> {
    require_scoped_user_id(&ctx.user_id).map_err(|_| {
        WorkspaceError::Forbidden("A valid user scope is required.".to_owned())
    })
}

pub fn project_scoped_tenant_id(ctx: &ProjectContext) -> Result<i64, ProjectError> {
    require_scoped_tenant_id(&ctx.tenant_id).map_err(|_| {
        ProjectError::Forbidden("A valid tenant scope is required.".to_owned())
    })
}

pub fn project_scoped_user_id(ctx: &ProjectContext) -> Result<i64, ProjectError> {
    require_scoped_user_id(&ctx.user_id).map_err(|_| {
        ProjectError::Forbidden("A valid user scope is required.".to_owned())
    })
}
