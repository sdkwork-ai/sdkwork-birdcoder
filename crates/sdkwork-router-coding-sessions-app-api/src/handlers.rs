use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;

use sdkwork_birdcoder_coding_sessions_service::context::SessionContext;
use sdkwork_birdcoder_coding_sessions_service::service::coding_session_service::CodingSessionService;

use crate::error::AppError;
use crate::mapper::request::{
    CreateCodingSessionRequest, CreateCodingSessionTurnRequest, ForkCodingSessionRequest,
    ListSessionsQuery, SubmitApprovalDecisionRequest, SubmitUserQuestionAnswerRequest,
    UpdateCodingSessionRequest,
};
use crate::mapper::response::{ApiListResponse, ApiResponse, DeleteResponse};

#[derive(Clone)]
pub struct IntelligenceAppState {
    pub service: CodingSessionService,
}

fn default_session_context() -> SessionContext {
    SessionContext {
        tenant_id: String::new(),
        user_id: String::new(),
        session_id: String::new(),
    }
}

pub async fn list_sessions(
    State(state): State<IntelligenceAppState>,
    Query(query): Query<ListSessionsQuery>,
) -> Result<Json<ApiListResponse<sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionPayload>>, AppError>
{
    let ctx = default_session_context();
    let service_query = query.into();
    let sessions = state.service.list_sessions(&ctx, &service_query).await?;
    Ok(Json(ApiListResponse::new(sessions)))
}

pub async fn get_session(
    State(state): State<IntelligenceAppState>,
    Path(session_id): Path<String>,
) -> Result<
    Json<ApiResponse<sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionPayload>>,
    AppError,
> {
    let ctx = default_session_context();
    let session = state.service.get_session(&ctx, &session_id).await?;
    Ok(Json(ApiResponse::new(session)))
}

pub async fn create_session(
    State(state): State<IntelligenceAppState>,
    Json(request): Json<CreateCodingSessionRequest>,
) -> Result<
    (StatusCode, Json<ApiResponse<sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionPayload>>),
    AppError,
> {
    let ctx = default_session_context();
    let session = state.service.create_session(&ctx, request.into()).await?;
    Ok((StatusCode::CREATED, Json(ApiResponse::new(session))))
}

pub async fn update_session(
    State(state): State<IntelligenceAppState>,
    Path(session_id): Path<String>,
    Json(request): Json<UpdateCodingSessionRequest>,
) -> Result<
    Json<ApiResponse<sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionPayload>>,
    AppError,
> {
    let ctx = default_session_context();
    let session = state
        .service
        .update_session(&ctx, &session_id, request.into())
        .await?;
    Ok(Json(ApiResponse::new(session)))
}

pub async fn delete_session(
    State(state): State<IntelligenceAppState>,
    Path(session_id): Path<String>,
) -> Result<Json<ApiResponse<DeleteResponse>>, AppError> {
    let ctx = default_session_context();
    let result = state.service.delete_session(&ctx, &session_id).await?;
    Ok(Json(ApiResponse::new(result.into())))
}

pub async fn fork_session(
    State(state): State<IntelligenceAppState>,
    Path(session_id): Path<String>,
    Json(request): Json<ForkCodingSessionRequest>,
) -> Result<
    (StatusCode, Json<ApiResponse<sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionPayload>>),
    AppError,
> {
    let ctx = default_session_context();
    let session = state
        .service
        .fork_session(&ctx, &session_id, request.into())
        .await?;
    Ok((StatusCode::CREATED, Json(ApiResponse::new(session))))
}

pub async fn create_turn(
    State(state): State<IntelligenceAppState>,
    Path(session_id): Path<String>,
    Json(request): Json<CreateCodingSessionTurnRequest>,
) -> Result<
    (StatusCode, Json<ApiResponse<sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionTurnPayload>>),
    AppError,
> {
    let ctx = default_session_context();
    let pending = state
        .service
        .create_turn(&ctx, &session_id, request.into())
        .await?;
    Ok((StatusCode::CREATED, Json(ApiResponse::new(pending.turn))))
}

pub async fn list_events(
    State(state): State<IntelligenceAppState>,
    Path(session_id): Path<String>,
) -> Result<
    Json<ApiListResponse<sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionEventPayload>>,
    AppError,
> {
    let ctx = default_session_context();
    let events = state.service.list_events(&ctx, &session_id).await?;
    Ok(Json(ApiListResponse::new(events)))
}

pub async fn list_artifacts(
    State(state): State<IntelligenceAppState>,
    Path(session_id): Path<String>,
) -> Result<
    Json<ApiListResponse<sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionArtifactPayload>>,
    AppError,
> {
    let ctx = default_session_context();
    let artifacts = state.service.list_artifacts(&ctx, &session_id).await?;
    Ok(Json(ApiListResponse::new(artifacts)))
}

pub async fn list_checkpoints(
    State(state): State<IntelligenceAppState>,
    Path(session_id): Path<String>,
) -> Result<
    Json<ApiListResponse<sdkwork_birdcoder_coding_sessions_service::domain::results::CodingSessionCheckpointPayload>>,
    AppError,
> {
    let ctx = default_session_context();
    let checkpoints = state.service.list_checkpoints(&ctx, &session_id).await?;
    Ok(Json(ApiListResponse::new(checkpoints)))
}

pub async fn submit_approval_decision(
    State(state): State<IntelligenceAppState>,
    Path((session_id, checkpoint_id)): Path<(String, String)>,
    Json(request): Json<SubmitApprovalDecisionRequest>,
) -> Result<
    Json<ApiResponse<sdkwork_birdcoder_coding_sessions_service::domain::results::ApprovalDecisionPayload>>,
    AppError,
> {
    let ctx = default_session_context();
    let approval = state
        .service
        .submit_approval_decision(&ctx, &session_id, &checkpoint_id, request.into())
        .await?;
    Ok(Json(ApiResponse::new(approval)))
}

pub async fn submit_user_question_answer(
    State(state): State<IntelligenceAppState>,
    Path((session_id, question_id)): Path<(String, String)>,
    Json(request): Json<SubmitUserQuestionAnswerRequest>,
) -> Result<
    Json<ApiResponse<sdkwork_birdcoder_coding_sessions_service::domain::results::UserQuestionAnswerPayload>>,
    AppError,
> {
    let ctx = default_session_context();
    let answer = state
        .service
        .submit_user_question_answer(&ctx, &session_id, &question_id, request.into())
        .await?;
    Ok(Json(ApiResponse::new(answer)))
}

