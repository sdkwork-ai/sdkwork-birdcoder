use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::Json;
use sqlx::AnyPool;

use sdkwork_birdcoder_chat_repository_sqlx::SqliteChatRepository;
use sdkwork_birdcoder_chat_service::context::ChatContext;
use sdkwork_birdcoder_chat_service::domain::models::{
    ChatConversationPayload, ChatListQuery, ChatMessagePayload,
};
use sdkwork_birdcoder_chat_service::service::chat_service::ChatService;
use sdkwork_birdcoder_errors::{
    build_data_envelope, build_offset_list_envelope, trace_id_from_request_id, ApiDataEnvelope,
    ApiListEnvelope,
};
use sdkwork_birdcoder_router_context::{RequiredIamContext, WebRequestContext};
use sdkwork_iam_context_service::IamAppContext;

use crate::error;
use crate::mapper::request::{
    ChatListQueryParams, CreateChatConversationBody, CreateChatMessageBody,
};
use crate::mapper::response::DeleteChatConversationResponse;

fn request_trace_id(web: &WebRequestContext) -> Option<&str> {
    trace_id_from_request_id(web.request_id.0.as_str())
}

fn request_id(web: &WebRequestContext) -> &str {
    web.request_id.0.as_str()
}

fn chat_context(iam: &IamAppContext) -> ChatContext {
    ChatContext {
        tenant_id: iam.tenant_id.clone(),
        user_id: iam.user_id.clone(),
    }
}

#[derive(Clone)]
pub struct ChatAppState {
    pub service: ChatService<SqliteChatRepository>,
}

impl ChatAppState {
    pub fn new(pool: AnyPool) -> Self {
        Self {
            service: ChatService::new(SqliteChatRepository::new(pool)),
        }
    }
}

pub async fn list_conversations(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<ChatAppState>,
    Query(query): Query<ChatListQueryParams>,
) -> Result<Json<ApiListEnvelope<ChatConversationPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = chat_context(&iam);
    let list_query: ChatListQuery = query.into();
    let offset = list_query.offset;
    let limit = list_query.limit;
    match state.service.list_conversations(&ctx, list_query).await {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            usize::try_from(offset).unwrap_or(0),
            usize::try_from(limit).unwrap_or(50),
            usize::try_from(total).unwrap_or(0),
            request_id(&web),
        ))),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn create_conversation(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<ChatAppState>,
    Json(body): Json<CreateChatConversationBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<ChatConversationPayload>>), error::ProblemJsonBody>
{
    let trace_id = request_trace_id(&web);
    let ctx = chat_context(&iam);
    match state.service.create_conversation(&ctx, body.into()).await {
        Ok(item) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(item, request_id(&web))),
        )),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn get_conversation(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<ChatAppState>,
    Path(conversation_id): Path<String>,
) -> Result<Json<ApiDataEnvelope<ChatConversationPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = chat_context(&iam);
    match state
        .service
        .get_conversation(&ctx, conversation_id.as_str())
        .await
    {
        Ok(item) => Ok(Json(build_data_envelope(item, request_id(&web)))),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn delete_conversation(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<ChatAppState>,
    Path(conversation_id): Path<String>,
) -> Result<Json<ApiDataEnvelope<DeleteChatConversationResponse>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = chat_context(&iam);
    let normalized_id = conversation_id.clone();
    match state
        .service
        .delete_conversation(&ctx, conversation_id.as_str())
        .await
    {
        Ok(()) => Ok(Json(build_data_envelope(
            DeleteChatConversationResponse {
                id: normalized_id,
            },
            request_id(&web),
        ))),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn list_messages(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<ChatAppState>,
    Path(conversation_id): Path<String>,
    Query(query): Query<ChatListQueryParams>,
) -> Result<Json<ApiListEnvelope<ChatMessagePayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = chat_context(&iam);
    let list_query: ChatListQuery = query.into();
    let offset = list_query.offset;
    let limit = list_query.limit;
    match state
        .service
        .list_messages(&ctx, conversation_id.as_str(), list_query)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            usize::try_from(offset).unwrap_or(0),
            usize::try_from(limit).unwrap_or(50),
            usize::try_from(total).unwrap_or(0),
            request_id(&web),
        ))),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn create_message(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    State(state): State<ChatAppState>,
    Path(conversation_id): Path<String>,
    Json(body): Json<CreateChatMessageBody>,
) -> Result<(StatusCode, Json<ApiDataEnvelope<ChatMessagePayload>>), error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = chat_context(&iam);
    match state
        .service
        .create_message(&ctx, conversation_id.as_str(), body.into())
        .await
    {
        Ok(item) => Ok((
            StatusCode::CREATED,
            Json(build_data_envelope(item, request_id(&web))),
        )),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}
