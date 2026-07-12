use std::sync::Arc;

use axum::extract::{Path, Query, State};
use axum::Json;

use sdkwork_birdcoder_codeengine::{
    find_codeengine_descriptor, get_codeengine_native_session_detail,
    get_codeengine_native_session_summary, list_codeengine_descriptors,
    list_codeengine_model_catalog_entries, list_codeengine_native_session_summaries,
    list_native_session_provider_catalog_entries, CodeEngineSessionDetailRecord,
    CodeEngineSessionSummaryRecord,
};
use sdkwork_birdcoder_engine_catalog_service::service::engine_catalog_service::{
    CodeEngineModelConfigPayload, EngineCapabilityMatrixPayload, EngineCatalogProvider,
    EngineCatalogService, EngineDescriptorPayload, ModelCatalogEntryPayload,
    NativeSessionProviderPayload as EngineNativeSessionProviderPayload,
    SyncModelConfigResultPayload,
};
use sdkwork_birdcoder_native_sessions_service::error::NativeSessionError;
use sdkwork_birdcoder_native_sessions_service::service::native_session_service::{
    NativeSessionDetailPayload, NativeSessionLookup, NativeSessionQuery, NativeSessionRepository,
    NativeSessionService, NativeSessionSummaryPayload, NativeSessionTurnPayload,
};

use sdkwork_birdcoder_errors::{
    build_data_envelope, build_offset_list_envelope, build_unbounded_list_envelope,
    trace_id_from_request_id, ApiDataEnvelope, ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{
    RequiredIamContext, StrictOffsetListQuery, WebRequestContext,
};
use sdkwork_utils_rust::is_blank;

use crate::error;
use crate::mapper::request::{
    EngineKeyPathParams, NativeSessionPathParams, NativeSessionQueryParams,
    NativeSessionScopeQuery, SyncModelConfigRequest,
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
    ) -> Result<Vec<EngineNativeSessionProviderPayload>, String> {
        let entries = list_native_session_provider_catalog_entries();
        Ok(entries
            .iter()
            .map(|e| EngineNativeSessionProviderPayload {
                provider_id: e.engine_id.clone(),
                name: e.display_name.clone(),
                description: e.native_session_id_prefix.clone(),
            })
            .collect())
    }
}

// ── Real Native Session Repository ───────────────────────────────────

#[derive(Clone)]
pub struct RealNativeSessionRepository;

impl NativeSessionRepository for RealNativeSessionRepository {
    fn list_sessions(
        &self,
        query: &NativeSessionQuery,
    ) -> Result<(Vec<NativeSessionSummaryPayload>, usize), String> {
        let engine_id = query
            .engine_id
            .as_deref()
            .filter(|value| !is_blank(Some(*value)));
        let offset = query.offset.unwrap_or(0);
        let limit = query
            .limit
            .unwrap_or(sdkwork_birdcoder_project_service::pagination::DEFAULT_LIST_PAGE_SIZE)
            .clamp(
                1,
                sdkwork_birdcoder_project_service::pagination::MAX_LIST_PAGE_SIZE,
            );
        let mut total = 0usize;
        let mut sessions = Vec::new();
        for record in list_codeengine_native_session_summaries(engine_id)? {
            if !matches_native_session_query(&record, query) {
                continue;
            }
            if total >= offset && sessions.len() < limit {
                sessions.push(map_native_session_summary(record));
            }
            total += 1;
        }
        Ok((sessions, total))
    }

    fn get_session(
        &self,
        lookup: &NativeSessionLookup,
    ) -> Result<Option<NativeSessionDetailPayload>, String> {
        let engine_id = lookup
            .engine_id
            .as_deref()
            .filter(|value| !is_blank(Some(*value)));
        let Some(detail) = get_codeengine_native_session_detail(&lookup.session_id, engine_id)?
        else {
            return Ok(None);
        };
        if !matches_native_session_lookup(&detail.summary, lookup) {
            return Ok(None);
        }
        Ok(Some(map_native_session_detail(detail)))
    }

    fn get_session_summary(
        &self,
        lookup: &NativeSessionLookup,
    ) -> Result<Option<NativeSessionSummaryPayload>, String> {
        let engine_id = lookup
            .engine_id
            .as_deref()
            .filter(|value| !is_blank(Some(*value)));
        let Some(summary) = get_codeengine_native_session_summary(&lookup.session_id, engine_id)?
        else {
            return Ok(None);
        };
        if !matches_native_session_lookup(&summary, lookup) {
            return Ok(None);
        }
        Ok(Some(map_native_session_summary(summary)))
    }
}

fn native_session_query_is_scoped(query: &NativeSessionQuery) -> bool {
    let workspace_id = query
        .workspace_id
        .as_deref()
        .filter(|value| !is_blank(Some(*value)));
    let project_id = query
        .project_id
        .as_deref()
        .filter(|value| !is_blank(Some(*value)));
    workspace_id.is_some() && project_id.is_some()
}

fn native_session_lookup_is_scoped(lookup: &NativeSessionLookup) -> bool {
    let workspace_id = lookup
        .workspace_id
        .as_deref()
        .filter(|value| !is_blank(Some(*value)));
    let project_id = lookup
        .project_id
        .as_deref()
        .filter(|value| !is_blank(Some(*value)));
    workspace_id.is_some() && project_id.is_some()
}

fn matches_native_session_scope(
    record: &CodeEngineSessionSummaryRecord,
    workspace_id: Option<&str>,
    project_id: Option<&str>,
) -> bool {
    let Some(expected_workspace_id) = workspace_id.filter(|value| !is_blank(Some(*value))) else {
        return false;
    };
    let Some(expected_project_id) = project_id.filter(|value| !is_blank(Some(*value))) else {
        return false;
    };
    match (
        record
            .workspace_id
            .as_deref()
            .filter(|value| !is_blank(Some(*value))),
        record
            .project_id
            .as_deref()
            .filter(|value| !is_blank(Some(*value))),
    ) {
        (Some(record_workspace_id), Some(record_project_id)) => {
            record_workspace_id == expected_workspace_id && record_project_id == expected_project_id
        }
        _ => false,
    }
}

fn matches_native_session_query(
    record: &CodeEngineSessionSummaryRecord,
    query: &NativeSessionQuery,
) -> bool {
    if !native_session_query_is_scoped(query) {
        return false;
    }

    if let Some(engine_id) = query
        .engine_id
        .as_deref()
        .filter(|value| !is_blank(Some(*value)))
    {
        if record.engine_id != engine_id {
            return false;
        }
    }

    matches_native_session_scope(
        record,
        query.workspace_id.as_deref(),
        query.project_id.as_deref(),
    )
}

fn matches_native_session_lookup(
    record: &CodeEngineSessionSummaryRecord,
    lookup: &NativeSessionLookup,
) -> bool {
    if !native_session_lookup_is_scoped(lookup) {
        return false;
    }

    if let Some(engine_id) = lookup
        .engine_id
        .as_deref()
        .filter(|value| !is_blank(Some(*value)))
    {
        if record.engine_id != engine_id {
            return false;
        }
    }

    matches_native_session_scope(
        record,
        lookup.workspace_id.as_deref(),
        lookup.project_id.as_deref(),
    )
}

fn map_native_session_summary(
    record: CodeEngineSessionSummaryRecord,
) -> NativeSessionSummaryPayload {
    NativeSessionSummaryPayload {
        id: record.id,
        title: record.title,
        status: record.status,
        host_mode: record.host_mode,
        engine_id: record.engine_id,
        model_id: record.model_id,
        workspace_id: record.workspace_id.clone().unwrap_or_default(),
        project_id: record.project_id.clone().unwrap_or_default(),
        created_at: record.created_at,
        updated_at: record.updated_at,
        last_turn_at: record.last_turn_at,
        transcript_updated_at: record.transcript_updated_at,
    }
}

fn map_native_session_detail(record: CodeEngineSessionDetailRecord) -> NativeSessionDetailPayload {
    NativeSessionDetailPayload {
        summary: map_native_session_summary(record.summary),
        turns: record
            .messages
            .into_iter()
            .map(|message| NativeSessionTurnPayload {
                id: message.id,
                role: message.role,
                content: message.content,
                created_at: message.created_at,
                ide_context: None,
            })
            .collect(),
    }
}

// ── State ────────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct EngineCatalogAppState {
    pub engine_catalog_service: Arc<EngineCatalogService<RealEngineCatalogProvider>>,
    pub native_session_service: Arc<NativeSessionService<RealNativeSessionRepository>>,
}

impl Default for EngineCatalogAppState {
    fn default() -> Self {
        Self {
            engine_catalog_service: Arc::new(EngineCatalogService::new(
                RealEngineCatalogProvider,
                "v3".to_string(),
            )),
            native_session_service: Arc::new(NativeSessionService::new(
                RealNativeSessionRepository,
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
    match state.engine_catalog_service.list_native_session_providers() {
        Ok(providers) => Ok(Json(build_unbounded_list_envelope(
            providers,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_engine_catalog_error(e, trace_id)),
    }
}

pub async fn list_native_sessions(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<EngineCatalogAppState>,
    Query(params): Query<NativeSessionQueryParams>,
) -> Result<Json<ApiListEnvelope<NativeSessionSummaryPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let offset = pagination.offset as usize;
    let limit = pagination.page_size as usize;
    let query = NativeSessionQuery {
        workspace_id: params.workspace_id,
        project_id: params.project_id,
        engine_id: params.engine_id,
        offset: Some(offset),
        limit: Some(limit),
    };
    if !native_session_query_is_scoped(&query) {
        return Err(error::map_native_session_error(
            NativeSessionError::InvalidInput(
                "workspaceId and projectId are required to list native sessions.".into(),
            ),
            trace_id,
        ));
    }

    match state.native_session_service.list_sessions(&query) {
        Ok((sessions, total)) => Ok(Json(build_offset_list_envelope(
            sessions,
            offset,
            limit,
            total,
            request_id(&web),
        ))),
        Err(e) => Err(error::map_native_session_error(e, trace_id)),
    }
}

pub async fn get_native_session(
    web: WebRequestContext,
    RequiredIamContext(_iam): RequiredIamContext,
    State(state): State<EngineCatalogAppState>,
    Path(params): Path<NativeSessionPathParams>,
    Query(scope): Query<NativeSessionScopeQuery>,
) -> Result<Json<ApiDataEnvelope<NativeSessionDetailPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    if is_blank(Some(scope.workspace_id.as_str())) || is_blank(Some(scope.project_id.as_str())) {
        return Err(error::map_native_session_error(
            NativeSessionError::InvalidInput(
                "workspaceId and projectId are required to retrieve native sessions.".into(),
            ),
            trace_id,
        ));
    }

    let lookup = NativeSessionLookup {
        session_id: params.id,
        engine_id: scope.engine_id,
        workspace_id: Some(scope.workspace_id),
        project_id: Some(scope.project_id),
    };
    match state.native_session_service.get_session_detail(&lookup) {
        Ok(session) => Ok(Json(build_data_envelope(session, request_id(&web)))),
        Err(e) => Err(error::map_native_session_error(e, trace_id)),
    }
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
