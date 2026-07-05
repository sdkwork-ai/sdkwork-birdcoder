use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;

use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionListQuery;
use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    ApprovalDecisionPayload, CodingSessionArtifactPayload, CodingSessionCheckpointPayload,
    CodingSessionEventPayload, CodingSessionPayload, CodingSessionTurnPayload,
    DeleteCodingSessionMessagePayload, EditCodingSessionMessagePayload, UserQuestionAnswerPayload,
};
use sdkwork_birdcoder_coding_sessions_service::service::coding_session_service::CodingSessionService;
use sdkwork_birdcoder_errors::{
    build_data_envelope, build_list_envelope, build_offset_list_envelope,
    trace_id_from_request_id, ApiDataEnvelope, ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{coding_session_context, RequiredIamContext, WebRequestContext};

use crate::error::{trace_service_error, AppError};
use crate::mapper::request::{
    CreateCodingSessionRequest, CreateCodingSessionTurnRequest, EditCodingSessionMessageRequest,
    ForkCodingSessionRequest,
    ListSessionsQuery, SubmitApprovalDecisionRequest, SubmitUserQuestionAnswerRequest,
    UpdateCodingSessionRequest,
};
use crate::mapper::response::DeleteResponse;

#[derive(Clone)]
pub struct CodingSessionsAppState {
    pub service: CodingSessionService,
    pub commerce_pool: Option<sqlx::AnyPool>,
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
    State(state): State<CodingSessionsAppState>,
    Query(query): Query<ListSessionsQuery>,
) -> Result<Json<ApiListEnvelope<CodingSessionPayload>>, AppError> {
    // PAGINATION_SPEC.md §3: normalize at the route layer so both the SQL
    // push-down (via CodingSessionListQuery) and the envelope's pageInfo
    // report identical values. Previously the envelope echoed the raw
    // request values while the SQL used clamped values, causing the values
    // reported to clients to diverge from the actual query.
    let (offset, page_size) = query.normalized_pagination();
    let service_query: CodingSessionListQuery = query.into();
    let ctx = coding_session_context(&iam);
    let page = trace_service_error(
        state.service.list_sessions(&ctx, &service_query).await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_offset_list_envelope(
        page.items,
        offset,
        page_size,
        page.total,
        request_id(&web),
    )))
}

pub async fn get_session(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path(sessionId): Path<String>,
) -> Result<Json<ApiDataEnvelope<CodingSessionPayload>>, AppError> {
    let ctx = coding_session_context(&iam);
    let session = trace_service_error(
        state.service.get_session(&ctx, &sessionId).await,
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
    Json(request): Json<CreateCodingSessionRequest>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<CodingSessionPayload>>), AppError> {
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
    Path(sessionId): Path<String>,
    Json(request): Json<UpdateCodingSessionRequest>,
) -> Result<Json<ApiDataEnvelope<CodingSessionPayload>>, AppError> {
    let ctx = coding_session_context(&iam);
    let session = trace_service_error(
        state
            .service
            .update_session(&ctx, &sessionId, request.into())
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(session, request_id(&web))))
}

pub async fn delete_session(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path(sessionId): Path<String>,
) -> Result<Json<ApiDataEnvelope<DeleteResponse>>, AppError> {
    let ctx = coding_session_context(&iam);
    let result = trace_service_error(
        state.service.delete_session(&ctx, &sessionId).await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(
        result.into(),
        request_id(&web),
    )))
}

pub async fn fork_session(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path(sessionId): Path<String>,
    Json(request): Json<ForkCodingSessionRequest>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<CodingSessionPayload>>), AppError> {
    let ctx = coding_session_context(&iam);
    let session = trace_service_error(
        state
            .service
            .fork_session(&ctx, &sessionId, request.into())
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
        session_id = %sessionId,
        workspace_id = tracing::field::Empty,
    ),
)]
pub async fn create_turn(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path(sessionId): Path<String>,
    Json(request): Json<CreateCodingSessionTurnRequest>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<CodingSessionTurnPayload>>), AppError> {
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
            .create_turn(&ctx, &sessionId, request.into())
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
    State(state): State<CodingSessionsAppState>,
    Path(sessionId): Path<String>,
) -> Result<Json<ApiListEnvelope<CodingSessionEventPayload>>, AppError> {
    let ctx = coding_session_context(&iam);
    let events = trace_service_error(
        state.service.list_events(&ctx, &sessionId).await,
        request_trace_id(&web),
    )?;
    let total = events.len();
    Ok(Json(build_list_envelope(events, total, request_id(&web))))
}

pub async fn list_artifacts(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path(sessionId): Path<String>,
) -> Result<Json<ApiListEnvelope<CodingSessionArtifactPayload>>, AppError> {
    let ctx = coding_session_context(&iam);
    let artifacts = trace_service_error(
        state.service.list_artifacts(&ctx, &sessionId).await,
        request_trace_id(&web),
    )?;
    let total = artifacts.len();
    Ok(Json(build_list_envelope(artifacts, total, request_id(&web))))
}

pub async fn list_checkpoints(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path(sessionId): Path<String>,
) -> Result<Json<ApiListEnvelope<CodingSessionCheckpointPayload>>, AppError> {
    let ctx = coding_session_context(&iam);
    let checkpoints = trace_service_error(
        state.service.list_checkpoints(&ctx, &sessionId).await,
        request_trace_id(&web),
    )?;
    let total = checkpoints.len();
    Ok(Json(build_list_envelope(checkpoints, total, request_id(&web))))
}

pub async fn submit_approval_decision(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path((sessionId, checkpointId)): Path<(String, String)>,
    Json(request): Json<SubmitApprovalDecisionRequest>,
) -> Result<Json<ApiDataEnvelope<ApprovalDecisionPayload>>, AppError> {
    let ctx = coding_session_context(&iam);
    let approval = trace_service_error(
        state
            .service
            .submit_approval_decision(&ctx, &sessionId, &checkpointId, request.into())
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(approval, request_id(&web))))
}

pub async fn submit_user_question_answer(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path((sessionId, questionId)): Path<(String, String)>,
    Json(request): Json<SubmitUserQuestionAnswerRequest>,
) -> Result<Json<ApiDataEnvelope<UserQuestionAnswerPayload>>, AppError> {
    let ctx = coding_session_context(&iam);
    let answer = trace_service_error(
        state
            .service
            .submit_user_question_answer(&ctx, &sessionId, &questionId, request.into())
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(answer, request_id(&web))))
}

pub async fn edit_coding_session_message(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path((sessionId, messageId)): Path<(String, String)>,
    Json(request): Json<EditCodingSessionMessageRequest>,
) -> Result<Json<ApiDataEnvelope<EditCodingSessionMessagePayload>>, AppError> {
    let ctx = coding_session_context(&iam);
    let result = trace_service_error(
        state
            .service
            .edit_coding_session_message(&ctx, &sessionId, &messageId, request.into())
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(result, request_id(&web))))
}

pub async fn delete_coding_session_message(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<CodingSessionsAppState>,
    Path((sessionId, messageId)): Path<(String, String)>,
) -> Result<Json<ApiDataEnvelope<DeleteCodingSessionMessagePayload>>, AppError> {
    let ctx = coding_session_context(&iam);
    let result = trace_service_error(
        state
            .service
            .delete_coding_session_message(&ctx, &sessionId, &messageId)
            .await,
        request_trace_id(&web),
    )?;
    Ok(Json(build_data_envelope(result, request_id(&web))))
}
