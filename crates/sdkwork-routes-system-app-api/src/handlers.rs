use std::sync::Arc;

use axum::extract::State;
use axum::Json;

use sdkwork_birdcoder_errors::{
    build_data_envelope, build_unbounded_list_envelope, trace_id_from_request_id, ApiDataEnvelope,
    ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{RequiredIamContext, WebRequestContext};
use sdkwork_birdcoder_system_descriptor_service::domain::models::{
    DescriptorPayload, HealthPayload, RouteCatalogEntryPayload, RuntimePayload,
};
use sdkwork_birdcoder_system_descriptor_service::service::system_service::{
    ManifestRouteCatalogProvider, SystemService,
};
use sdkwork_web_bootstrap::{AlwaysReady, ReadinessCheck};
use sdkwork_web_contract::HttpRoute;

pub type ConcreteSystemService = SystemService<ManifestRouteCatalogProvider>;

#[derive(Clone)]
pub struct SystemAppState {
    pub service: Arc<ConcreteSystemService>,
    pub routes: &'static [HttpRoute],
    pub runtime_host: String,
    pub runtime_port: u16,
    pub config_file_name: String,
    pub readiness_check: Arc<dyn ReadinessCheck>,
}

impl SystemAppState {
    pub fn new(routes: &'static [HttpRoute]) -> Self {
        Self::with_runtime(routes, "127.0.0.1", 10_240, "sdkwork.app.config.json")
    }

    pub fn with_runtime(
        routes: &'static [HttpRoute],
        host: impl Into<String>,
        port: u16,
        config_file_name: impl Into<String>,
    ) -> Self {
        Self {
            service: Arc::new(SystemService::new(ManifestRouteCatalogProvider::new(
                routes,
            ))),
            routes,
            runtime_host: host.into(),
            runtime_port: port,
            config_file_name: config_file_name.into(),
            readiness_check: Arc::new(AlwaysReady),
        }
    }

    /// Attaches the composed dependency readiness check so the System health
    /// endpoint reports real dependency availability instead of a hard-coded
    /// healthy status.
    pub fn with_readiness_check(mut self, readiness_check: Arc<dyn ReadinessCheck>) -> Self {
        self.readiness_check = readiness_check;
        self
    }
}

fn request_id(web: &WebRequestContext) -> &str {
    trace_id_from_request_id(web.request_id.0.as_str()).unwrap_or("unavailable")
}

pub async fn get_descriptor(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
) -> Json<ApiDataEnvelope<DescriptorPayload>> {
    let descriptor = state.service.descriptor_from_routes(
        "server",
        "sdkwork-birdcoder",
        "v3",
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
    Json(build_unbounded_list_envelope(
        state.service.route_catalog(),
        request_id(&web),
    ))
}

pub async fn get_runtime(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
) -> Json<ApiDataEnvelope<RuntimePayload>> {
    let runtime = state.service.runtime(
        &state.runtime_host,
        state.runtime_port,
        &state.config_file_name,
    );
    Json(build_data_envelope(runtime, request_id(&web)))
}

pub async fn get_health(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<SystemAppState>,
) -> Json<ApiDataEnvelope<HealthPayload>> {
    // The System health endpoint reports real dependency availability: the
    // composed readiness check covers every mounted owner dependency, so a
    // gateway whose dependencies are unavailable reports not_healthy instead
    // of a hard-coded healthy status.
    let healthy = state.readiness_check.check().await.is_ok();
    Json(build_data_envelope(
        state.service.health(healthy),
        request_id(&web),
    ))
}
