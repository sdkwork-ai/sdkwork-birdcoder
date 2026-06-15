use axum::extract::{Path, Query};
use axum::Json;

use crate::error;
use crate::mapper::request::{EngineKeyPathParams, NativeSessionPathParams, NativeSessionQueryParams, SyncModelConfigRequest};
use crate::paths;

pub async fn list_engines() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "todo",
        "path": paths::ENGINES_PATH
    }))
}

pub async fn get_engine_capabilities(
    Path(params): Path<EngineKeyPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = &params.engine_key;
    Ok(Json(serde_json::json!({
        "status": "todo",
        "engineKey": params.engine_key
    })))
}

pub async fn list_native_session_providers() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "todo",
        "path": paths::NATIVE_SESSION_PROVIDERS_PATH
    }))
}

pub async fn list_native_sessions(
    Query(params): Query<NativeSessionQueryParams>,
) -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "todo",
        "workspaceId": params.workspace_id,
        "projectId": params.project_id,
        "engineId": params.engine_id,
        "limit": params.limit,
    }))
}

pub async fn get_native_session(
    Path(params): Path<NativeSessionPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = &params.id;
    Ok(Json(serde_json::json!({
        "status": "todo",
        "id": params.id
    })))
}

pub async fn list_models() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "todo",
        "path": paths::MODELS_PATH
    }))
}

pub async fn get_model_config() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "todo",
        "path": paths::MODEL_CONFIG_PATH
    }))
}

pub async fn sync_model_config(
    Json(body): Json<SyncModelConfigRequest>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetails>)> {
    let _ = body.local_config;
    Ok(Json(serde_json::json!({
        "status": "todo",
        "action": "sync"
    })))
}
