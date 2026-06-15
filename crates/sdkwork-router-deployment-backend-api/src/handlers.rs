use axum::extract::Query;
use axum::Json;

use crate::mapper::request::DeploymentTargetListQuery;

pub async fn admin_deployment_targets(
    Query(query): Query<DeploymentTargetListQuery>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "todo",
        "items": [],
        "projectId": query.project_id,
    }))
}

pub async fn admin_releases() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "todo", "items": [] }))
}

pub async fn admin_deployments() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "todo", "items": [] }))
}
