use axum::extract::rejection::JsonRejection;
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;

use sdkwork_birdcoder_codeengine::{
    extract_native_lookup_id_for_engine, list_codeengine_native_session_summaries,
    sanitize_codeengine_git_repository_url, sanitize_codeengine_session_metadata,
    CodeEngineSessionNativeAttributesRecord, CodeEngineSessionSummaryRecord,
};
use sdkwork_birdcoder_coding_sessions_service::native_session_types::NativeSessionAttributesPayload;

use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    ApprovalDecisionPayload, CodingSessionArtifactPayload, CodingSessionCheckpointPayload,
    CodingSessionEventPayload, CodingSessionPayload, CodingSessionTurnPayload,
    DeleteCodingSessionMessagePayload, EditCodingSessionMessagePayload, UserQuestionAnswerPayload,
};
use sdkwork_birdcoder_coding_sessions_service::service::coding_session_service::CodingSessionService;
use sdkwork_birdcoder_errors::{
    build_data_envelope, build_offset_list_envelope, trace_id_from_request_id, ApiDataEnvelope,
    ApiListEnvelope,
};
use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::runtime_location::RuntimeLocationCapability;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;
use sdkwork_birdcoder_router_context::{
    coding_session_context, project_context, RequiredIamContext, StrictOffsetListQuery,
    WebRequestContext,
};

use crate::error::{trace_service_error, AppError, CodingSessionsRouteError};
use crate::mapper::request::{
    CreateCodingSessionRequest, CreateCodingSessionTurnRequest, EditCodingSessionMessageRequest,
    ForkCodingSessionRequest, ListSessionsQuery, SubmitApprovalDecisionRequest,
    SubmitUserQuestionAnswerRequest, UpdateCodingSessionRequest,
};
use crate::mapper::response::DeleteResponse;

#[derive(Clone)]
pub struct CodingSessionsAppState {
    pub service: CodingSessionService,
    pub commerce_pool: Option<sqlx::AnyPool>,
    pub project_service: Option<std::sync::Arc<ProjectService>>,
}

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

pub async fn list_sessions(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<CodingSessionsAppState>,
    Query(query): Query<ListSessionsQuery>,
) -> Result<Json<ApiListEnvelope<CodingSessionPayload>>, CodingSessionsRouteError> {
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    // Read the bounded prefix from both authorities before applying the final
    // window; otherwise a newer native session could displace database items
    // that belong on the requested page.
    let service_query = query
        .clone()
        .into_service_query(0, offset.saturating_add(page_size));
    let ctx = coding_session_context(&iam);
    let page = trace_service_error(
        state.service.list_sessions(&ctx, &service_query).await,
        request_trace_id(&web),
    )?;
    let page = merge_native_session_summaries(
        page,
        &state,
        &project_context(&iam),
        &query,
        offset,
        page_size,
    )
    .await;
    Ok(Json(build_offset_list_envelope(
        page.items,
        offset,
        page_size,
        page.total,
        request_id(&web),
    )))
}

async fn merge_native_session_summaries(
    page: sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionListPage,
    state: &CodingSessionsAppState,
    project_context: &ProjectContext,
    query: &ListSessionsQuery,
    offset: usize,
    page_size: usize,
) -> sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionListPage {
    let Some(project_id) = query
        .project_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    else {
        return page;
    };
    let Some(workspace_id) = query
        .workspace_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    else {
        return page;
    };
    let Some(runtime_location_id) = query
        .runtime_location_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    else {
        // Native provider records expose only host-local CWD facts. Without a
        // concrete runtime-location binding there is no execution authority
        // from which an authorized root can be obtained.
        return page;
    };

    let Some(project_service) = state.project_service.as_deref() else {
        tracing::warn!(
            "native coding session discovery is disabled because project execution authorization is unavailable"
        );
        return page;
    };
    let project_root = match project_service
        .resolve_runtime_location_execution_root(
            project_context,
            workspace_id,
            project_id,
            runtime_location_id,
            RuntimeLocationCapability::Terminal,
        )
        .await
    {
        Ok(root) => normalize_session_path(root.to_string_lossy().as_ref()),
        Err(error) => {
            tracing::warn!(
                error = %error,
                "native coding session discovery was denied for the requested project scope"
            );
            return page;
        }
    };
    let native_summaries =
        match list_codeengine_native_session_summaries(query.engine_id.as_deref()) {
            Ok(summaries) => summaries,
            Err(error) => {
                tracing::warn!(%error, "failed to read native coding session summaries");
                return page;
            }
        };

    let database_total = page.total;
    let mut merged = page.items;
    for summary in native_summaries {
        if !native_summary_matches_scope(
            &summary,
            workspace_id,
            project_id,
            Some(project_root.as_str()),
        ) {
            continue;
        }
        let native_session_id =
            extract_native_lookup_id_for_engine(&summary.id, &summary.engine_id).ok();
        let existing_index = merged.iter().position(|item| {
            item.id == summary.id
                || (item.engine_id == summary.engine_id
                    && item.native_session_id.is_some()
                    && item.native_session_id == native_session_id)
        });
        let mapped = map_native_summary_to_coding_session(
            summary,
            workspace_id,
            project_id,
            runtime_location_id,
            native_session_id,
        );
        if let Some(index) = existing_index {
            merged[index] = mapped;
        } else {
            merged.push(mapped);
        }
    }

    merged.sort_by(|left, right| {
        right
            .sort_timestamp
            .cmp(&left.sort_timestamp)
            .then_with(|| left.id.cmp(&right.id))
    });
    let total = database_total.max(merged.len());
    let items = merged.into_iter().skip(offset).take(page_size).collect();
    sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionListPage {
        items,
        total,
    }
}

fn map_native_summary_to_coding_session(
    summary: CodeEngineSessionSummaryRecord,
    workspace_id: &str,
    project_id: &str,
    runtime_location_id: &str,
    native_session_id: Option<String>,
) -> sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionPayload {
    let native_attributes = map_native_session_attributes(summary.native_attributes);
    sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionPayload {
        id: summary.id,
        workspace_id: workspace_id.to_owned(),
        project_id: project_id.to_owned(),
        runtime_location_id: Some(runtime_location_id.to_owned()),
        title: summary.title,
        status: summary.status,
        host_mode: summary.host_mode,
        engine_id: summary.engine_id,
        model_id: summary.model_id,
        native_session_id,
        created_at: summary.created_at,
        updated_at: summary.updated_at,
        last_turn_at: summary.last_turn_at,
        runtime_status: summary.runtime_status,
        sort_timestamp: summary.sort_timestamp,
        transcript_updated_at: summary.transcript_updated_at,
        native_attributes,
    }
}

fn map_native_session_attributes(
    record: CodeEngineSessionNativeAttributesRecord,
) -> NativeSessionAttributesPayload {
    let metadata = sanitize_codeengine_session_metadata(&serde_json::Value::Object(
        record.metadata.into_iter().collect(),
    ));

    NativeSessionAttributesPayload {
        schema_version: record.schema_version,
        session_tree_id: record.session_tree_id,
        parent_session_id: record.parent_session_id,
        forked_from_session_id: record.forked_from_session_id,
        title: record.title,
        preview: record.preview,
        source: record.source,
        provider_version: record.provider_version,
        model_provider: record.model_provider,
        project_id: record.project_id,
        cwd: record.cwd,
        git_branch: record.git_branch,
        git_commit: record.git_commit,
        git_repository_url: sanitize_codeengine_git_repository_url(record.git_repository_url),
        agent_name: record.agent_name,
        agent_role: record.agent_role,
        is_ephemeral: record.is_ephemeral,
        is_sidechain: record.is_sidechain,
        metadata,
    }
}

fn native_summary_matches_scope(
    summary: &CodeEngineSessionSummaryRecord,
    workspace_id: &str,
    project_id: &str,
    project_root: Option<&str>,
) -> bool {
    if workspace_id.trim().is_empty() || project_id.trim().is_empty() {
        return false;
    }
    let Some(native_cwd) = summary.native_cwd.as_deref() else {
        return false;
    };
    let Some(project_root) = project_root else {
        return false;
    };
    let cwd = normalize_session_path(native_cwd);
    let project_root = normalize_session_path(project_root);
    cwd == project_root || cwd.starts_with(&format!("{project_root}/"))
}

fn normalize_session_path(value: &str) -> String {
    let value = value.trim();
    let normalized = std::fs::canonicalize(value)
        .ok()
        .map(|path| path.to_string_lossy().into_owned())
        .unwrap_or_else(|| value.to_owned());
    let normalized = normalize_session_path_lexically(normalized.as_str());
    if cfg!(windows) || normalized.as_bytes().get(1) == Some(&b':') {
        normalized.to_ascii_lowercase()
    } else {
        normalized
    }
}

fn normalize_session_path_lexically(value: &str) -> String {
    let value = value.replace('\\', "/");
    let value = if let Some(unc_path) = value.strip_prefix("//?/UNC/") {
        format!("//{unc_path}")
    } else if let Some(drive_path) = value.strip_prefix("//?/") {
        drive_path.to_owned()
    } else {
        value
    };
    let (prefix, remainder, absolute) = if value.starts_with("//") {
        ("//", value.trim_start_matches('/'), true)
    } else if value.starts_with('/') {
        ("/", value.trim_start_matches('/'), true)
    } else if value.as_bytes().get(1) == Some(&b':') {
        let prefix = &value[..2];
        let remainder = value[2..].trim_start_matches('/');
        (prefix, remainder, value.as_bytes().get(2) == Some(&b'/'))
    } else {
        ("", value.as_str(), false)
    };
    let protected_components = if prefix == "//" { 2 } else { 0 };
    let mut components: Vec<&str> = Vec::new();
    for component in remainder.split('/') {
        match component {
            "" | "." => {}
            ".." => {
                if components.len() > protected_components
                    && components.last().is_some_and(|last| *last != "..")
                {
                    components.pop();
                } else if !absolute {
                    components.push(component);
                }
            }
            component => components.push(component),
        }
    }

    let joined = components.join("/");
    if prefix == "/" {
        if joined.is_empty() {
            "/".to_owned()
        } else {
            format!("/{joined}")
        }
    } else if prefix == "//" {
        if joined.is_empty() {
            "//".to_owned()
        } else {
            format!("//{joined}")
        }
    } else if prefix.len() == 2 && absolute {
        if joined.is_empty() {
            format!("{prefix}/")
        } else {
            format!("{prefix}/{joined}")
        }
    } else if prefix.is_empty() {
        joined
    } else if joined.is_empty() {
        prefix.to_owned()
    } else {
        format!("{prefix}{joined}")
    }
}

pub async fn get_session(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path(session_id): Path<String>,
) -> Result<Json<ApiDataEnvelope<CodingSessionPayload>>, CodingSessionsRouteError> {
    let ctx = coding_session_context(&iam);
    let session = trace_service_error(
        state.service.get_session(&ctx, &session_id).await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(session, request_id(&web))))
}

#[tracing::instrument(
    name = "coding_session.create",
    skip_all,
    fields(
        tenant_id = %iam.tenant_id,
        user_id = %iam.user_id,
        request_id = %web.request_id.0,
        workspace_id = tracing::field::Empty,
    ),
)]
pub async fn create_session(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    body: Result<Json<CreateCodingSessionRequest>, JsonRejection>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<CodingSessionPayload>>), CodingSessionsRouteError> {
    let Json(request) = body.map_err(|_| {
        CodingSessionsRouteError::from(
            AppError::bad_request("Coding-session create request body is invalid.")
                .with_trace_id(request_trace_id(&web)),
        )
    })?;
    let ctx = coding_session_context(&iam);
    let session = trace_service_error(
        state.service.create_session(&ctx, request.into()).await,
        request_trace_id(&web),
    )?;
    tracing::Span::current().record("workspace_id", session.workspace_id.as_str());
    Ok((
        StatusCode::CREATED,
        Json(build_data_envelope(session, request_id(&web))),
    ))
}

pub async fn update_session(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path(session_id): Path<String>,
    Json(request): Json<UpdateCodingSessionRequest>,
) -> Result<Json<ApiDataEnvelope<CodingSessionPayload>>, CodingSessionsRouteError> {
    let ctx = coding_session_context(&iam);
    let session = trace_service_error(
        state
            .service
            .update_session(&ctx, &session_id, request.into())
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(session, request_id(&web))))
}

pub async fn delete_session(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path(session_id): Path<String>,
) -> Result<Json<ApiDataEnvelope<DeleteResponse>>, CodingSessionsRouteError> {
    let ctx = coding_session_context(&iam);
    let result = trace_service_error(
        state.service.delete_session(&ctx, &session_id).await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(result.into(), request_id(&web))))
}

pub async fn fork_session(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path(session_id): Path<String>,
    Json(request): Json<ForkCodingSessionRequest>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<CodingSessionPayload>>), CodingSessionsRouteError> {
    let ctx = coding_session_context(&iam);
    let session = trace_service_error(
        state
            .service
            .fork_session(&ctx, &session_id, request.into())
            .await,
        request_trace_id(&web),
    )?;
    Ok((
        StatusCode::CREATED,
        Json(build_data_envelope(session, request_id(&web))),
    ))
}

#[tracing::instrument(
    name = "turn.execute",
    skip_all,
    fields(
        tenant_id = %iam.tenant_id,
        user_id = %iam.user_id,
        request_id = %web.request_id.0,
        session_id = %session_id,
        workspace_id = tracing::field::Empty,
    ),
)]
pub async fn create_turn(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path(session_id): Path<String>,
    Json(request): Json<CreateCodingSessionTurnRequest>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<CodingSessionTurnPayload>>), CodingSessionsRouteError>
{
    if let Some(pool) = &state.commerce_pool {
        let trace = request_trace_id(&web);
        let tenant_id = sdkwork_birdcoder_commerce_quota::parse_numeric_tenant_id(&iam.tenant_id)
            .map_err(AppError::from_quota_error)
            .map_err(|error| error.with_trace_id(trace))?;
        sdkwork_birdcoder_commerce_quota::check_tenant_quota(
            pool,
            tenant_id,
            sdkwork_birdcoder_commerce_quota::METRIC_API_REQUESTS,
        )
        .await
        .map_err(AppError::from_quota_error)
        .map_err(|error| error.with_trace_id(trace))?;
    }

    let ctx = coding_session_context(&iam);
    let pending = trace_service_error(
        state
            .service
            .create_turn(&ctx, &session_id, request.into())
            .await,
        request_trace_id(&web),
    )?;
    if let Some(pool) = &state.commerce_pool {
        if let (Ok(tenant_id), Ok(user_id)) = (
            sdkwork_birdcoder_commerce_quota::parse_numeric_tenant_id(&iam.tenant_id),
            sdkwork_birdcoder_commerce_quota::parse_numeric_user_id(&iam.user_id),
        ) {
            if let Err(error) = sdkwork_birdcoder_commerce_quota::record_tenant_usage(
                pool,
                tenant_id,
                Some(pending.session.workspace_id.as_str()),
                user_id,
                sdkwork_birdcoder_commerce_quota::METRIC_API_REQUESTS,
                1,
                Some("{\"surface\":\"codingSessions.turns.create\"}"),
            )
            .await
            {
                tracing::warn!(%error, "failed to record coding session turn usage");
            }
        }
    }
    tracing::Span::current().record("workspace_id", pending.session.workspace_id.as_str());
    Ok((
        StatusCode::CREATED,
        Json(build_data_envelope(pending.turn, request_id(&web))),
    ))
}

pub async fn list_events(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<CodingSessionsAppState>,
    Path(session_id): Path<String>,
) -> Result<Json<ApiListEnvelope<CodingSessionEventPayload>>, CodingSessionsRouteError> {
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let ctx = coding_session_context(&iam);
    let (events, total) = trace_service_error(
        state
            .service
            .list_events(&ctx, &session_id, offset, page_size)
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_offset_list_envelope(
        events,
        offset,
        page_size,
        total,
        request_id(&web),
    )))
}

pub async fn list_artifacts(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<CodingSessionsAppState>,
    Path(session_id): Path<String>,
) -> Result<Json<ApiListEnvelope<CodingSessionArtifactPayload>>, CodingSessionsRouteError> {
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let ctx = coding_session_context(&iam);
    let (artifacts, total) = trace_service_error(
        state
            .service
            .list_artifacts(&ctx, &session_id, offset, page_size)
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_offset_list_envelope(
        artifacts,
        offset,
        page_size,
        total,
        request_id(&web),
    )))
}

pub async fn list_checkpoints(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<CodingSessionsAppState>,
    Path(session_id): Path<String>,
) -> Result<Json<ApiListEnvelope<CodingSessionCheckpointPayload>>, CodingSessionsRouteError> {
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let ctx = coding_session_context(&iam);
    let (checkpoints, total) = trace_service_error(
        state
            .service
            .list_checkpoints(&ctx, &session_id, offset, page_size)
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_offset_list_envelope(
        checkpoints,
        offset,
        page_size,
        total,
        request_id(&web),
    )))
}

pub async fn submit_approval_decision(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path((session_id, checkpoint_id)): Path<(String, String)>,
    Json(request): Json<SubmitApprovalDecisionRequest>,
) -> Result<Json<ApiDataEnvelope<ApprovalDecisionPayload>>, CodingSessionsRouteError> {
    let ctx = coding_session_context(&iam);
    let approval = trace_service_error(
        state
            .service
            .submit_approval_decision(&ctx, &session_id, &checkpoint_id, request.into())
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(approval, request_id(&web))))
}

pub async fn submit_user_question_answer(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path((session_id, question_id)): Path<(String, String)>,
    Json(request): Json<SubmitUserQuestionAnswerRequest>,
) -> Result<Json<ApiDataEnvelope<UserQuestionAnswerPayload>>, CodingSessionsRouteError> {
    let ctx = coding_session_context(&iam);
    let answer = trace_service_error(
        state
            .service
            .submit_user_question_answer(&ctx, &session_id, &question_id, request.into())
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(answer, request_id(&web))))
}

pub async fn edit_coding_session_message(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path((session_id, message_id)): Path<(String, String)>,
    Json(request): Json<EditCodingSessionMessageRequest>,
) -> Result<Json<ApiDataEnvelope<EditCodingSessionMessagePayload>>, CodingSessionsRouteError> {
    let ctx = coding_session_context(&iam);
    let result = trace_service_error(
        state
            .service
            .edit_coding_session_message(&ctx, &session_id, &message_id, request.into())
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(result, request_id(&web))))
}

pub async fn delete_coding_session_message(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path((session_id, message_id)): Path<(String, String)>,
) -> Result<Json<ApiDataEnvelope<DeleteCodingSessionMessagePayload>>, CodingSessionsRouteError> {
    let ctx = coding_session_context(&iam);
    let result = trace_service_error(
        state
            .service
            .delete_coding_session_message(&ctx, &session_id, &message_id)
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(result, request_id(&web))))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn codex_summary(native_cwd: &str) -> CodeEngineSessionSummaryRecord {
        CodeEngineSessionSummaryRecord {
            created_at: "2026-07-15T08:00:00.000Z".to_owned(),
            id: "codex-native:thread-1".to_owned(),
            title: "Codex thread".to_owned(),
            status: "active".to_owned(),
            runtime_status: Some("idle".to_owned()),
            host_mode: "desktop".to_owned(),
            engine_id: "codex".to_owned(),
            model_id: "gpt-5.3-codex".to_owned(),
            updated_at: "2026-07-15T08:01:00.000Z".to_owned(),
            last_turn_at: Some("2026-07-15T08:01:00.000Z".to_owned()),
            kind: "coding".to_owned(),
            native_cwd: Some(native_cwd.to_owned()),
            sort_timestamp: 1_784_099_260_000,
            transcript_updated_at: Some("2026-07-15T08:01:00.000Z".to_owned()),
            workspace_id: Some("1".to_owned()),
            project_id: Some("2".to_owned()),
            native_attributes: CodeEngineSessionNativeAttributesRecord {
                model_provider: Some("openai".to_owned()),
                title: Some("Native Codex thread".to_owned()),
                ..Default::default()
            },
        }
    }

    #[test]
    fn native_scope_matches_windows_extended_project_root() {
        let summary = codex_summary(r"E:\sdkwork-space\sdkwork-birdcoder");

        assert!(native_summary_matches_scope(
            &summary,
            "1",
            "2",
            Some("//?/e:/sdkwork-space/sdkwork-birdcoder"),
        ));
    }

    #[test]
    fn native_scope_rejects_another_project_directory() {
        let summary = codex_summary(r"E:\sdkwork-space\sdkwork-im");

        assert!(!native_summary_matches_scope(
            &summary,
            "1",
            "2",
            Some("e:/sdkwork-space/sdkwork-birdcoder"),
        ));
    }

    #[test]
    fn native_scope_rejects_a_path_that_lexically_escapes_the_project_root() {
        let summary = codex_summary(r"E:\sdkwork-space\sdkwork-birdcoder\..\sdkwork-im");

        assert!(!native_summary_matches_scope(
            &summary,
            "1",
            "2",
            Some("e:/sdkwork-space/sdkwork-birdcoder"),
        ));
    }

    #[test]
    fn native_summary_maps_to_unified_coding_session_contract() {
        let mapped = map_native_summary_to_coding_session(
            codex_summary(r"E:\sdkwork-space\sdkwork-birdcoder"),
            "1",
            "2",
            "runtime-location-1",
            Some("thread-1".to_owned()),
        );

        assert_eq!(mapped.id, "codex-native:thread-1");
        assert_eq!(mapped.native_session_id.as_deref(), Some("thread-1"));
        assert_eq!(mapped.workspace_id, "1");
        assert_eq!(mapped.project_id, "2");
        assert_eq!(
            mapped.runtime_location_id.as_deref(),
            Some("runtime-location-1")
        );
        assert_eq!(mapped.engine_id, "codex");
        assert_eq!(
            mapped.native_attributes.model_provider.as_deref(),
            Some("openai")
        );
        assert_eq!(
            mapped.native_attributes.title.as_deref(),
            Some("Native Codex thread")
        );
    }

    #[test]
    fn native_summary_metadata_redacts_path_like_values_recursively() {
        let mut record = codex_summary(r"E:\sdkwork-space\sdkwork-birdcoder");
        record.native_attributes.metadata = std::collections::BTreeMap::from([
            ("cwd".to_owned(), serde_json::json!(r"E:\private\project")),
            (
                "nested".to_owned(),
                serde_json::json!({
                    "workingDirectory": r"E:\private\project\packages",
                    "safe": "preserved",
                }),
            ),
            (
                "items".to_owned(),
                serde_json::json!([
                    { "nativeCwd": r"E:\private\project\src" },
                    { "safe": true },
                ]),
            ),
        ]);
        record.native_attributes.git_repository_url =
            Some("https://token:secret@example.com/owner/repository.git".to_owned());

        let mapped = map_native_summary_to_coding_session(
            record,
            "1",
            "2",
            "runtime-location-1",
            Some("thread-1".to_owned()),
        );
        let json = serde_json::to_value(mapped).expect("serialize coding-session projection");
        let metadata = &json["nativeAttributes"]["metadata"];

        assert!(metadata.get("cwd").is_none());
        assert!(metadata["nested"].get("workingDirectory").is_none());
        assert!(metadata["items"][0].get("nativeCwd").is_none());
        assert_eq!(metadata["nested"]["safe"], "preserved");
        assert_eq!(metadata["items"][1]["safe"], true);
        assert!(json["nativeAttributes"].get("gitRepositoryUrl").is_none());
    }
}
