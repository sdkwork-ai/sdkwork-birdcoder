use axum::extract::{Path, Query};
use axum::Json;

use crate::error;
use crate::mapper::request::{InstallSkillPackageBody, SkillPackageListQuery, SkillPackagePathParams};

pub async fn list_skill_packages(
    Query(query): Query<SkillPackageListQuery>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "todo",
        "items": [],
        "workspaceId": query.workspace_id,
    }))
}

pub async fn install_skill_package(
    Path(params): Path<SkillPackagePathParams>,
    Json(body): Json<InstallSkillPackageBody>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = (&params.package_id, &body.scope_id, &body.scope_type);
    Ok(Json(serde_json::json!({ "status": "todo", "action": "install" })))
}

pub async fn list_app_templates() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "todo", "items": [] }))
}
