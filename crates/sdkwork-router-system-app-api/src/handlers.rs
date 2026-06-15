use axum::extract::Path;
use axum::Json;

use crate::error;
use crate::mapper::request::OperationPathParams;
use crate::paths;

pub async fn get_descriptor() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "todo",
        "path": paths::SYSTEM_DESCRIPTOR_PATH
    }))
}

pub async fn list_routes() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "todo",
        "path": paths::SYSTEM_ROUTES_PATH
    }))
}

pub async fn get_runtime() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "todo",
        "path": paths::SYSTEM_RUNTIME_PATH
    }))
}

pub async fn get_health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy"
    }))
}

pub async fn get_operation(
    Path(params): Path<OperationPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = &params.operation_id;
    Ok(Json(serde_json::json!({
        "status": "todo",
        "operationId": params.operation_id
    })))
}
