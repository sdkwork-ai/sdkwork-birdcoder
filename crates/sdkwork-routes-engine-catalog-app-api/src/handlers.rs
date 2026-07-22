use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;

use sdkwork_birdcoder_codeengine::{
    find_codeengine_descriptor, list_codeengine_descriptors, list_codeengine_model_catalog_entries,
    list_native_session_provider_catalog_entries,
};
use sdkwork_birdcoder_engine_catalog_service::service::engine_catalog_service::{
    CodeEngineModelConfigPayload, EngineCapabilityMatrixPayload, EngineCatalogProvider,
    EngineCatalogService, EngineDescriptorPayload, ModelCatalogEntryPayload,
    NativeSessionProviderPayload as EngineCatalogNativeSessionProviderPayload,
    SyncModelConfigResultPayload,
};
use sdkwork_birdcoder_errors::{
    build_data_envelope, build_unbounded_list_envelope, trace_id_from_request_id, ApiDataEnvelope,
    ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{RequiredIamContext, WebRequestContext};

use crate::error;
use crate::mapper::request::{EngineKeyPathParams, SyncModelConfigRequest};
use crate::mapper::response::{
    map_native_session_provider_payloads, EngineNativeSessionProviderPayload,
};

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

// ── Real Engine Catalog Provider ─────────────────────────────────────

#[derive(Clone)]
pub struct RealEngineCatalogProvider;

impl EngineCatalogProvider for RealEngineCatalogProvider {
    fn list_engine_descriptors(&self) -> Result<Vec<EngineDescriptorPayload>, String> {
        let descriptors = list_codeengine_descriptors();
        Ok(descriptors
            .iter()
            .map(|d| EngineDescriptorPayload {
                engine_key: d.engine_key.clone(),
                name: d.display_name.clone(),
                description: d.vendor.clone(),
                default_model_id: d.default_model_id.clone(),
                capability_matrix: EngineCapabilityMatrixPayload {
                    engine_key: d.engine_key.clone(),
                    capabilities: vec![],
                },
            })
            .collect())
    }

    fn find_engine_descriptor(
        &self,
        engine_key: &str,
    ) -> Result<Option<EngineDescriptorPayload>, String> {
        match find_codeengine_descriptor(engine_key) {
            Some(d) => Ok(Some(EngineDescriptorPayload {
                engine_key: d.engine_key.clone(),
                name: d.display_name.clone(),
                description: d.vendor.clone(),
                default_model_id: d.default_model_id.clone(),
                capability_matrix: EngineCapabilityMatrixPayload {
                    engine_key: d.engine_key.clone(),
                    capabilities: vec![],
                },
            })),
            None => Ok(None),
        }
    }

    fn list_model_catalog_entries(&self) -> Result<Vec<ModelCatalogEntryPayload>, String> {
        let entries = list_codeengine_model_catalog_entries();
        Ok(entries
            .iter()
            .map(|e| ModelCatalogEntryPayload {
                engine_key: e.engine_key.clone(),
                model_id: e.model_id.clone(),
                label: e.display_name.clone(),
                description: e.status.clone(),
                updated_at: e.updated_at.clone(),
            })
            .collect())
    }

    fn list_native_session_provider_entries(
        &self,
    ) -> Result<Vec<EngineCatalogNativeSessionProviderPayload>, String> {
        let entries = list_native_session_provider_catalog_entries();
        Ok(entries
            .iter()
            .map(|e| EngineCatalogNativeSessionProviderPayload {
                provider_id: e.engine_id.clone(),
                name: e.display_name.clone(),
                description: e.native_session_id_prefix.clone(),
            })
            .collect())
    }
}

#[derive(Clone)]
pub struct EngineCatalogAppState {
    pub engine_catalog_service: Arc<EngineCatalogService<RealEngineCatalogProvider>>,
}

impl Default for EngineCatalogAppState {
    fn default() -> Self {
        Self {
            engine_catalog_service: Arc::new(EngineCatalogService::new(
                RealEngineCatalogProvider,
                "v3".to_string(),
            )),
        }
    }
}

// ── Handlers ─────────────────────────────────────────────────────────

pub async fn list_engines(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<EngineCatalogAppState>,
) -> Result<Json<ApiListEnvelope<EngineDescriptorPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    match state.engine_catalog_service.list_engines() {
        Ok(engines) => Ok(Json(build_unbounded_list_envelope(
            engines,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_engine_catalog_error(e, trace_id)),
    }
}

pub async fn get_engine_capabilities(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<EngineCatalogAppState>,
    Path(params): Path<EngineKeyPathParams>,
) -> Result<Json<ApiDataEnvelope<EngineCapabilityMatrixPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    match state
        .engine_catalog_service
        .get_engine_capabilities(&params.engine_key)
    {
        Ok(matrix) => Ok(Json(build_data_envelope(matrix, request_id(&web)))),
        Err(e) => Err(error::map_engine_catalog_error(e, trace_id)),
    }
}

pub async fn list_native_session_providers(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<EngineCatalogAppState>,
) -> Result<Json<ApiListEnvelope<EngineNativeSessionProviderPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let providers = state
        .engine_catalog_service
        .list_native_session_providers()
        .map_err(|error| error::map_engine_catalog_error(error, trace_id))?;
    let providers = map_native_session_provider_payloads(providers)
        .map_err(|error| error::map_engine_catalog_error(error, trace_id))?;
    Ok(Json(build_unbounded_list_envelope(
        providers,
        request_id(&web),
    )))
}

pub async fn list_models(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<EngineCatalogAppState>,
) -> Result<Json<ApiListEnvelope<ModelCatalogEntryPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    match state.engine_catalog_service.list_models() {
        Ok(models) => Ok(Json(build_unbounded_list_envelope(
            models,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_engine_catalog_error(e, trace_id)),
    }
}

pub async fn get_model_config(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<EngineCatalogAppState>,
) -> Result<Json<ApiDataEnvelope<CodeEngineModelConfigPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    match state.engine_catalog_service.get_model_config() {
        Ok(config) => Ok(Json(build_data_envelope(config, request_id(&web)))),
        Err(e) => Err(error::map_engine_catalog_error(e, trace_id)),
    }
}

pub async fn sync_model_config(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<EngineCatalogAppState>,
    Json(body): Json<SyncModelConfigRequest>,
) -> Result<Json<ApiDataEnvelope<SyncModelConfigResultPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    match state
        .engine_catalog_service
        .sync_model_config(body.local_config)
    {
        Ok(result) => Ok(Json(build_data_envelope(result, request_id(&web)))),
        Err(e) => Err(error::map_engine_catalog_error(e, trace_id)),
    }
}
