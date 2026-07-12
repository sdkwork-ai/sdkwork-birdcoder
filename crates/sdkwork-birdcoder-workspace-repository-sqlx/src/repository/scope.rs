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

/// Map a `dataScope` string (e.g. `"PRIVATE"`, `"ORGANIZATION"`) or numeric
/// string (e.g. `"1"`) to the `i64` storage value used by the `data_scope`
/// column. Defaults to `1` (PRIVATE) when the input is missing or
/// unrecognized.
pub fn data_scope_to_i64(value: Option<&str>) -> i64 {
    match value.map(str::trim).filter(|v| !v.is_empty()) {
        None => 1,
        Some(v) => match v.to_ascii_uppercase().as_str() {
            "0" | "DEFAULT" => 0,
            "2" | "ORGANIZATION" => 2,
            "3" | "TENANT" => 3,
            "4" | "PUBLIC" => 4,
            "1" | "PRIVATE" | _ => 1,
        },
    }
}
