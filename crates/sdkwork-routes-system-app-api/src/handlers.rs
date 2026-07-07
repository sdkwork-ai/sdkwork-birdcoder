use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use sqlx::AnyPool;

use sdkwork_birdcoder_system_descriptor_service::domain::models::{
    DescriptorPayload, HealthPayload, OperationPayload, RouteCatalogEntryPayload, RuntimePayload,
};
use sdkwork_birdcoder_system_descriptor_service::service::system_service::{
    ManifestRouteCatalogProvider, OperationProvider, SystemService,
};
use sdkwork_birdcoder_errors::{
    build_data_envelope, build_unbounded_list_envelope, trace_id_from_request_id, ApiDataEnvelope,
    ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{RequiredIamContext, WebRequestContext};
use sdkwork_web_contract::HttpRoute;

use crate::error;
use crate::mapper::request::OperationPathParams;

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

// ── Concrete provider implementations ────────────────────────────────

pub struct StaticOperationProvider;

impl OperationProvider for StaticOperationProvider {
    fn find_operation(&self, _operation_id: &str) -> Option<OperationPayload> {
        None
    }
}

// ── State ────────────────────────────────────────────────────────────

pub type ConcreteSystemService =
    SystemService<ManifestRouteCatalogProvider, StaticOperationProvider>;

#[derive(Clone)]
pub struct SystemAppState {
    pub service: Arc<ConcreteSystemService>,
    pub repository_pool: Option<AnyPool>,
    pub routes: &'static [HttpRoute],
}

impl SystemAppState {
    pub fn new(routes: &'static [HttpRoute]) -> Self {
        Self {
            service: Arc::new(SystemService::new(
                ManifestRouteCatalogProvider::new(routes),
                StaticOperationProvider,
            )),
            repository_pool: None,
            routes,
        }
    }

    pub fn with_repository_pool(repository_pool: AnyPool, routes: &'static [HttpRoute]) -> Self {
        Self {
            service: Arc::new(SystemService::new(
                ManifestRouteCatalogProvider::new(routes),
                StaticOperationProvider,
            )),
            repository_pool: Some(repository_pool),
            routes,
        }
    }
}

// ── Handlers ─────────────────────────────────────────────────────────

pub async fn get_descriptor(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
) -> Json<ApiDataEnvelope<DescriptorPayload>> {
    let descriptor = state.service.descriptor_from_routes(
        "server",
        "sdkwork-birdcoder",
        "v1",
        state.routes,
        "/openapi.json",
    );
    Json(build_data_envelope(descriptor, request_id(&web)))
}

pub async fn list_routes(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
) -> Json<ApiListEnvelope<RouteCatalogEntryPayload>> {
    let routes = state.service.route_catalog();
    let total = routes.len();
    Json(build_unbounded_list_envelope(routes, request_id(&web)))
}

pub async fn get_runtime(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
) -> Json<ApiDataEnvelope<RuntimePayload>> {
    let runtime = state.service.runtime("127.0.0.1", 10240, "bird-server.config.json");
    Json(build_data_envelope(runtime, request_id(&web)))
}

pub async fn get_health(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
) -> Json<ApiDataEnvelope<HealthPayload>> {
    if let Some(pool) = state.repository_pool.as_ref() {
        return Json(build_data_envelope(
            build_repository_health_payload(pool).await,
            request_id(&web),
        ));
    }

    Json(build_data_envelope(
        HealthPayload {
            status: "healthy".to_string(),
        },
        request_id(&web),
    ))
}

async fn build_repository_health_payload(pool: &AnyPool) -> HealthPayload {
    let healthy = sqlx::query("SELECT 1").fetch_one(pool).await.is_ok();

    HealthPayload {
        status: if healthy {
            "healthy".to_string()
        } else {
            "degraded".to_string()
        },
    }
}

pub async fn get_operation(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
    Path(params): Path<OperationPathParams>,
) -> Result<Json<ApiDataEnvelope<OperationPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    match state.service.get_operation(&params.operation_id) {
        Ok(operation) => Ok(Json(build_data_envelope(operation, request_id(&web)))),
        Err(e) => Err(error::map_system_error(e, trace_id)),
    }
}
