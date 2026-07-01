use axum::routing::get;
use axum::Router;

use crate::handlers;
use crate::handlers::ChatAppState;
use crate::paths;

pub fn build_chat_app_router() -> Router<ChatAppState> {
    Router::new()
        .route(
            paths::CONVERSATIONS_PATH,
            get(handlers::list_conversations).post(handlers::create_conversation),
        )
        .route(
            paths::CONVERSATION_PATH,
            get(handlers::get_conversation).delete(handlers::delete_conversation),
        )
        .route(
            paths::CONVERSATION_MESSAGES_PATH,
            get(handlers::list_messages).post(handlers::create_message),
        )
}
