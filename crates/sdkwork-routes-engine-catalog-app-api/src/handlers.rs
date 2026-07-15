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
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::service::coding_session_service::CodingSessionService;
use sdkwork_birdcoder_engine_catalog_service::service::engine_catalog_service::{
    CodeEngineModelConfigPayload, EngineCapabilityMatrixPayload, EngineCatalogProvider,
    EngineCatalogService, EngineDescriptorPayload, ModelCatalogEntryPayload,
    NativeSessionProviderPayload as EngineNativeSessionProviderPayload,
    SyncModelConfigResultPayload,
};
use sdkwork_birdcoder_native_sessions_service::error::NativeSessionError;
use sdkwork_birdcoder_native_sessions_service::service::native_session_service::{
    NativeSessionCommandPayload, NativeSessionDetailPayload, NativeSessionLookup,
    NativeSessionMessagePayload, NativeSessionQuery, NativeSessionRepository, NativeSessionService,
    NativeSessionSummaryPayload,
};
use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;

use sdkwork_birdcoder_errors::{
    build_data_envelope, build_offset_list_envelope, build_unbounded_list_envelope,
    trace_id_from_request_id, ApiDataEnvelope, ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{
    coding_session_context, project_context, RequiredIamContext, StrictOffsetListQuery,
    WebRequestContext,
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
                sessions.push(map_native_session_summary(
                    record,
                    query.workspace_id.as_deref(),
                    query.project_id.as_deref(),
                ));
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
        Ok(Some(map_native_session_detail(
            detail,
            lookup.workspace_id.as_deref(),
            lookup.project_id.as_deref(),
        )))
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
        Ok(Some(map_native_session_summary(
            summary,
            lookup.workspace_id.as_deref(),
            lookup.project_id.as_deref(),
        )))
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
    project_root: Option<&str>,
) -> bool {
    let Some(expected_workspace_id) = workspace_id.filter(|value| !is_blank(Some(*value))) else {
        return false;
    };
    let Some(expected_project_id) = project_id.filter(|value| !is_blank(Some(*value))) else {
        return false;
    };
    let identity_matches = match (
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
    };
    if identity_matches {
        return true;
    }

    record.workspace_id.is_none()
        && record.project_id.is_none()
        && native_session_cwd_is_within_project(record.native_cwd.as_deref(), project_root)
}

fn normalize_native_session_path(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() {
        return None;
    }
    let normalized = value.replace('\\', "/");
    let normalized = normalized.trim_end_matches('/');
    if normalized.is_empty() {
        None
    } else if cfg!(windows) || normalized.as_bytes().get(1) == Some(&b':') {
        Some(normalized.to_ascii_lowercase())
    } else {
        Some(normalized.to_owned())
    }
}

fn native_session_cwd_is_within_project(
    native_cwd: Option<&str>,
    project_root: Option<&str>,
) -> bool {
    let Some(native_cwd) = normalize_native_session_path(native_cwd) else {
        return false;
    };
    let Some(project_root) = normalize_native_session_path(project_root) else {
        return false;
    };

    native_cwd == project_root
        || native_cwd
            .strip_prefix(project_root.as_str())
            .is_some_and(|suffix| suffix.starts_with('/'))
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
        query.project_root.as_deref(),
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
        lookup.project_root.as_deref(),
    )
}

fn map_native_session_summary(
    record: CodeEngineSessionSummaryRecord,
    workspace_id: Option<&str>,
    project_id: Option<&str>,
) -> NativeSessionSummaryPayload {
    let native_session_id = sdkwork_birdcoder_codeengine::extract_native_lookup_id_for_engine(
        record.id.as_str(),
        record.engine_id.as_str(),
    )
    .ok();
    NativeSessionSummaryPayload {
        id: record.id,
        title: record.title,
        status: record.status,
        host_mode: record.host_mode,
        engine_id: record.engine_id,
        model_id: record.model_id,
        workspace_id: record
            .workspace_id
            .clone()
            .or_else(|| workspace_id.map(str::to_owned))
            .unwrap_or_default(),
        project_id: record
            .project_id
            .clone()
            .or_else(|| project_id.map(str::to_owned))
            .unwrap_or_default(),
        native_session_id,
        created_at: record.created_at,
        updated_at: record.updated_at,
        last_turn_at: record.last_turn_at,
        transcript_updated_at: record.transcript_updated_at,
        sort_timestamp: record.sort_timestamp,
        kind: record.kind,
        native_cwd: record.native_cwd,
    }
}

fn map_native_session_detail(
    record: CodeEngineSessionDetailRecord,
    workspace_id: Option<&str>,
    project_id: Option<&str>,
) -> NativeSessionDetailPayload {
    let summary = map_native_session_summary(record.summary, workspace_id, project_id);
    let coding_session_id = summary.id.clone();
    NativeSessionDetailPayload {
        summary,
        messages: record
            .messages
            .into_iter()
            .map(|message| NativeSessionMessagePayload {
                id: message.id,
                coding_session_id: coding_session_id.clone(),
                turn_id: message.turn_id,
                role: message.role,
                content: message.content,
                created_at: message.created_at,
                commands: message.commands.map(|commands| {
                    commands
                        .into_iter()
                        .map(|command| NativeSessionCommandPayload {
                            command: command.command,
                            status: command.status,
                            output: command.output,
                            kind: command.kind,
                            tool_name: command.tool_name,
                            tool_call_id: command.tool_call_id,
                            runtime_status: command.runtime_status,
                            requires_approval: command.requires_approval,
                            requires_reply: command.requires_reply,
                        })
                        .collect()
                }),
                tool_calls: message.tool_calls,
                tool_call_id: message.tool_call_id,
                file_changes: message.file_changes,
                task_progress: message.task_progress,
                metadata: message.metadata,
            })
            .collect(),
    }
}

// ── State ────────────────────────────────────────────────────────────

async fn resolve_native_project_root(
    project_service: Option<&ProjectService>,
    coding_session_service: Option<&CodingSessionService>,
    coding_context: &CodingSessionContext,
    context: &ProjectContext,
    workspace_id: Option<&str>,
    project_id: Option<&str>,
    trace_id: Option<&str>,
) -> Result<Option<String>, error::ProblemJsonBody> {
    let Some(project_service) = project_service else {
        return Ok(None);
    };
    let Some(workspace_id) = workspace_id.filter(|value| !is_blank(Some(*value))) else {
        return Ok(None);
    };
    let Some(project_id) = project_id.filter(|value| !is_blank(Some(*value))) else {
        return Ok(None);
    };

    let project = project_service
        .get_project(context, project_id)
        .await
        .map_err(|project_error| {
            error::map_native_session_error(
                NativeSessionError::Repository(project_error.to_string()),
                trace_id,
            )
        })?;
    if project.workspace_id != workspace_id {
        return Ok(None);
    }

    if let Some(coding_session_service) = coding_session_service {
        if let Some(root) = coding_session_service
            .resolve_project_working_directory(coding_context, project_id)
            .await
            .map_err(|coding_error| {
                error::map_native_session_error(
                    NativeSessionError::Repository(coding_error.to_string()),
                    trace_id,
                )
            })?
        {
            let root = std::fs::canonicalize(root).map_err(|error| {
                error::map_native_session_error(
                    NativeSessionError::Repository(format!(
                        "project working directory is unavailable: {error}"
                    )),
                    trace_id,
                )
            })?;
            if root.is_dir() {
                return Ok(Some(root.to_string_lossy().into_owned()));
            }
        }
    }

    project_service
        .resolve_project_root_for_scope(context, workspace_id, project_id)
        .await
        .map(|root| Some(root.to_string_lossy().into_owned()))
        .map_err(|project_error| {
            error::map_native_session_error(
                NativeSessionError::Repository(project_error.to_string()),
                trace_id,
            )
        })
}

#[derive(Clone)]
pub struct EngineCatalogAppState {
    pub engine_catalog_service: Arc<EngineCatalogService<RealEngineCatalogProvider>>,
    pub native_session_service: Arc<NativeSessionService<RealNativeSessionRepository>>,
    pub project_service: Option<Arc<ProjectService>>,
    pub coding_session_service: Option<Arc<CodingSessionService>>,
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
            project_service: None,
            coding_session_service: None,
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
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<EngineCatalogAppState>,
    Query(params): Query<NativeSessionQueryParams>,
) -> Result<Json<ApiListEnvelope<NativeSessionSummaryPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let offset = pagination.offset as usize;
    let limit = pagination.page_size as usize;
    let project_context = project_context(&iam);
    let coding_context = coding_session_context(&iam);
    let project_root = resolve_native_project_root(
        state.project_service.as_deref(),
        state.coding_session_service.as_deref(),
        &coding_context,
        &project_context,
        params.workspace_id.as_deref(),
        params.project_id.as_deref(),
        trace_id,
    )
    .await?;
    let query = NativeSessionQuery {
        workspace_id: params.workspace_id.clone(),
        project_id: params.project_id.clone(),
        engine_id: params.engine_id,
        offset: Some(offset),
        limit: Some(limit),
        project_root,
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
    RequiredIamContext(iam): RequiredIamContext,
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

    let project_context = project_context(&iam);
    let coding_context = coding_session_context(&iam);
    let project_root = resolve_native_project_root(
        state.project_service.as_deref(),
        state.coding_session_service.as_deref(),
        &coding_context,
        &project_context,
        Some(scope.workspace_id.as_str()),
        Some(scope.project_id.as_str()),
        trace_id,
    )
    .await?;
    let lookup = NativeSessionLookup {
        session_id: params.id,
        engine_id: scope.engine_id,
        workspace_id: Some(scope.workspace_id),
        project_id: Some(scope.project_id),
        project_root,
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

#[cfg(test)]
mod tests {
    use super::{map_native_session_summary, matches_native_session_scope};
    use sdkwork_birdcoder_codeengine::{build_native_session_id, CodeEngineSessionSummaryRecord};

    fn native_summary(engine_id: &str, native_cwd: Option<&str>) -> CodeEngineSessionSummaryRecord {
        CodeEngineSessionSummaryRecord {
            created_at: "2026-07-15T00:00:00Z".to_owned(),
            id: build_native_session_id(engine_id, "session-1"),
            title: "Session".to_owned(),
            status: "active".to_owned(),
            runtime_status: Some("completed".to_owned()),
            host_mode: "desktop".to_owned(),
            engine_id: engine_id.to_owned(),
            model_id: "model-1".to_owned(),
            updated_at: "2026-07-15T00:01:00Z".to_owned(),
            last_turn_at: Some("2026-07-15T00:01:00Z".to_owned()),
            kind: "coding".to_owned(),
            native_cwd: native_cwd.map(str::to_owned),
            sort_timestamp: 1_752_537_660_123,
            transcript_updated_at: Some("2026-07-15T00:01:00Z".to_owned()),
            workspace_id: None,
            project_id: None,
        }
    }

    #[test]
    fn native_provider_sessions_are_scoped_by_authorized_project_root() {
        for engine_id in ["codex", "opencode", "claude-code", "gemini"] {
            let exact = native_summary(engine_id, Some("C:\\workspace\\project"));
            let descendant = native_summary(engine_id, Some("C:/workspace/project/packages/app"));
            let sibling = native_summary(engine_id, Some("C:/workspace/project-other"));

            assert!(matches_native_session_scope(
                &exact,
                Some("workspace-1"),
                Some("project-1"),
                Some("C:/workspace/project"),
            ));
            assert!(matches_native_session_scope(
                &descendant,
                Some("workspace-1"),
                Some("project-1"),
                Some("C:/workspace/project"),
            ));
            assert!(!matches_native_session_scope(
                &sibling,
                Some("workspace-1"),
                Some("project-1"),
                Some("C:/workspace/project"),
            ));
        }
    }

    #[test]
    fn explicit_native_scope_cannot_be_reassigned_by_cwd() {
        let mut summary = native_summary("codex", Some("C:/workspace/project"));
        summary.workspace_id = Some("workspace-other".to_owned());
        summary.project_id = Some("project-other".to_owned());

        assert!(!matches_native_session_scope(
            &summary,
            Some("workspace-1"),
            Some("project-1"),
            Some("C:/workspace/project"),
        ));
    }

    #[test]
    fn mapped_native_summary_carries_project_scope_and_lossless_sort_timestamp() {
        let payload = map_native_session_summary(
            native_summary("codex", Some("C:/workspace/project")),
            Some("workspace-1"),
            Some("project-1"),
        );
        let json = serde_json::to_value(payload).expect("serialize native summary");

        assert_eq!(json["workspaceId"], "workspace-1");
        assert_eq!(json["projectId"], "project-1");
        assert_eq!(json["nativeSessionId"], "session-1");
        assert_eq!(json["nativeCwd"], "C:/workspace/project");
        assert_eq!(json["kind"], "coding");
        assert_eq!(json["sortTimestamp"], "1752537660123");
    }
}
