use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::Json;
use sqlx::AnyPool;

use sdkwork_birdcoder_chat_repository_sqlx::SqliteChatRepository;
use sdkwork_birdcoder_chat_service::context::ChatContext;
use sdkwork_birdcoder_chat_service::domain::models::{
    ChatConversationPayload, ChatListQuery, ChatMessagePayload, CreateChatMessageCommand,
};
use sdkwork_birdcoder_chat_service::service::chat_service::ChatService;
use sdkwork_birdcoder_errors::{
    build_data_envelope, build_offset_list_envelope, checked_list_total_items,
    client_safe_provider_problem, trace_id_from_request_id, traced_problem_json, ApiDataEnvelope,
    ApiListEnvelope,
};
use sdkwork_birdcoder_kernel_bridge::generate_mobile_chat_assistant_reply;
use sdkwork_birdcoder_router_context::{
    RequiredIamContext, StrictOffsetListQuery, WebRequestContext,
};
use sdkwork_iam_context_service::IamAppContext;

use crate::error;
use crate::mapper::request::{CreateChatConversationBody, CreateChatMessageBody};
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
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<ChatAppState>,
) -> Result<Json<ApiListEnvelope<ChatConversationPayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = chat_context(&iam);
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let list_query = ChatListQuery {
        offset: pagination.offset,
        limit: pagination.page_size,
    };
    match state.service.list_conversations(&ctx, list_query).await {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            checked_list_total_items(total, trace_id)?,
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
) -> Result<(StatusCode, Json<ApiDataEnvelope<ChatConversationPayload>>), error::ProblemJsonBody> {
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
            DeleteChatConversationResponse { id: normalized_id },
            request_id(&web),
        ))),
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

pub async fn list_messages(
    web: WebRequestContext,
    RequiredIamContext(iam): RequiredIamContext,
    StrictOffsetListQuery(pagination): StrictOffsetListQuery,
    State(state): State<ChatAppState>,
    Path(conversation_id): Path<String>,
) -> Result<Json<ApiListEnvelope<ChatMessagePayload>>, error::ProblemJsonBody> {
    let trace_id = request_trace_id(&web);
    let ctx = chat_context(&iam);
    let offset = pagination.offset as usize;
    let page_size = pagination.page_size as usize;
    let list_query = ChatListQuery {
        offset: pagination.offset,
        limit: pagination.page_size,
    };
    match state
        .service
        .list_messages(&ctx, conversation_id.as_str(), list_query)
        .await
    {
        Ok((items, total)) => Ok(Json(build_offset_list_envelope(
            items,
            offset,
            page_size,
            checked_list_total_items(total, trace_id)?,
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
    let command: CreateChatMessageCommand = body.into();
    let is_user_message = command.role.trim().eq_ignore_ascii_case("user");
    match state
        .service
        .create_message(&ctx, conversation_id.as_str(), command)
        .await
    {
        Ok(item) => {
            if is_user_message {
                persist_mobile_chat_assistant_reply(
                    &state,
                    &ctx,
                    conversation_id.as_str(),
                    item.content.as_str(),
                    request_trace_id(&web),
                )
                .await?;
            }
            Ok((
                StatusCode::CREATED,
                Json(build_data_envelope(item, request_id(&web))),
            ))
        }
        Err(service_error) => Err(error::map_service_error(service_error, trace_id)),
    }
}

async fn persist_mobile_chat_assistant_reply(
    state: &ChatAppState,
    ctx: &ChatContext,
    conversation_id: &str,
    user_content: &str,
    trace_id: Option<&str>,
) -> Result<(), error::ProblemJsonBody> {
    let assistant_content =
        generate_mobile_chat_assistant_reply(user_content).map_err(|error| {
            tracing::warn!(%error, "mobile chat assistant generation failed");
            traced_problem_json(
                StatusCode::BAD_GATEWAY,
                client_safe_provider_problem(),
                trace_id,
            )
        })?;
    let assistant_command = CreateChatMessageCommand {
        role: "assistant".to_string(),
        content: assistant_content,
    };
    state
        .service
        .create_message(ctx, conversation_id, assistant_command)
        .await
        .map_err(|error| error::map_service_error(error, trace_id))?;
    Ok(())
}
