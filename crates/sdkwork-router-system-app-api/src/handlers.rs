use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;

use sdkwork_birdcoder_system_descriptor_service::domain::models::{
    DescriptorPayload, HealthPayload, OperationPayload, RouteCatalogEntryPayload, RuntimePayload,
};
use sdkwork_birdcoder_system_descriptor_service::service::system_service::{
    OperationProvider, RouteCatalogProvider, SystemService,
};

use crate::error;
use crate::mapper::request::OperationPathParams;

// ── Concrete provider implementations ────────────────────────────────

pub struct StaticRouteCatalogProvider;

impl RouteCatalogProvider for StaticRouteCatalogProvider {
    fn list_route_specs(&self) -> Vec<RouteCatalogEntryPayload> {
        vec![
            RouteCatalogEntryPayload {
                auth_mode: "none".to_string(),
                method: "GET".to_string(),
                open_api_path: "/app/v3/api/system/health".to_string(),
                operation_id: "system.health".to_string(),
                path: "/app/v3/api/system/health".to_string(),
                surface: "app".to_string(),
                summary: "Health check".to_string(),
            },
            RouteCatalogEntryPayload {
                auth_mode: "none".to_string(),
                method: "GET".to_string(),
                open_api_path: "/app/v3/api/system/descriptor".to_string(),
                operation_id: "system.descriptor".to_string(),
                path: "/app/v3/api/system/descriptor".to_string(),
                surface: "app".to_string(),
                summary: "System descriptor".to_string(),
            },
            RouteCatalogEntryPayload {
                auth_mode: "none".to_string(),
                method: "GET".to_string(),
                open_api_path: "/app/v3/api/system/routes".to_string(),
                operation_id: "system.routes".to_string(),
                path: "/app/v3/api/system/routes".to_string(),
                surface: "app".to_string(),
                summary: "Route catalog".to_string(),
            },
            RouteCatalogEntryPayload {
                auth_mode: "none".to_string(),
                method: "GET".to_string(),
                open_api_path: "/app/v3/api/system/runtime".to_string(),
                operation_id: "system.runtime".to_string(),
                path: "/app/v3/api/system/runtime".to_string(),
                surface: "app".to_string(),
                summary: "Runtime metadata".to_string(),
            },
        ]
    }
}

pub struct StaticOperationProvider;

impl OperationProvider for StaticOperationProvider {
    fn find_operation(&self, operation_id: &str) -> Option<OperationPayload> {
        Some(OperationPayload {
            id: operation_id.to_string(),
            status: "active".to_string(),
            kind: "query".to_string(),
            created_at: "2025-01-01T00:00:00Z".to_string(),
            updated_at: "2025-01-01T00:00:00Z".to_string(),
        })
    }
}

// ── State ────────────────────────────────────────────────────────────

pub type ConcreteSystemService = SystemService<StaticRouteCatalogProvider, StaticOperationProvider>;

#[derive(Clone)]
pub struct SystemAppState {
    pub service: Arc<ConcreteSystemService>,
}

impl SystemAppState {
    pub fn new() -> Self {
        Self {
            service: Arc::new(SystemService::new(StaticRouteCatalogProvider, StaticOperationProvider)),
        }
    }
}

// ── Handlers ─────────────────────────────────────────────────────────

pub async fn get_descriptor(
    State(state): State<SystemAppState>,
) -> Json<serde_json::Value> {
    let descriptor = state.service.descriptor(
        "server",
        "sdkwork-birdcoder",
        "v1",
        50,  // app route count
        10,  // backend route count
        "/openapi.json",
    );
    Json(serde_json::json!(descriptor))
}

pub async fn list_routes(
    State(state): State<SystemAppState>,
) -> Json<serde_json::Value> {
    let routes = state.service.route_catalog();
    Json(serde_json::json!({ "items": routes }))
}

pub async fn get_runtime(
    State(state): State<SystemAppState>,
) -> Json<serde_json::Value> {
    let runtime = state.service.runtime("127.0.0.1", 10240, "bird-server.config.json");
    Json(serde_json::json!(runtime))
}

pub async fn get_health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "healthy" }))
}

pub async fn get_operation(
    State(state): State<SystemAppState>,
    Path(params): Path<OperationPathParams>,
) -> Result<Json<serde_json::Value>, (axum::http::StatusCode, Json<error::ProblemDetailsPayload>)> {
    match state.service.get_operation(&params.operation_id) {
        Ok(operation) => Ok(Json(serde_json::json!(operation))),
        Err(e) => Err(error::map_system_error(e)),
    }
}
