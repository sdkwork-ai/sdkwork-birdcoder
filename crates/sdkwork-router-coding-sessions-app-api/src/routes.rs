use axum::routing::{delete, get, post, patch};
use axum::Router;

use crate::handlers::CodingSessionsAppState;
use crate::paths;
use crate::handlers;

pub fn build_coding_sessions_app_api_router() -> Router<CodingSessionsAppState> {
    Router::new()
        .route(paths::SESSIONS, get(handlers::list_sessions))
        .route(paths::SESSIONS, post(handlers::create_session))
        .route(paths::SESSION, get(handlers::get_session))
        .route(paths::SESSION, patch(handlers::update_session))
        .route(paths::SESSION, delete(handlers::delete_session))
        .route(paths::SESSION_FORK, post(handlers::fork_session))
        .route(paths::SESSION_TURNS, post(handlers::create_turn))
        .route(paths::SESSION_EVENTS, get(handlers::list_events))
        .route(paths::SESSION_ARTIFACTS, get(handlers::list_artifacts))
        .route(paths::SESSION_CHECKPOINTS, get(handlers::list_checkpoints))
        .route(paths::APPROVAL_DECISION, post(handlers::submit_approval_decision))
        .route(
            paths::USER_QUESTION_ANSWER,
            post(handlers::submit_user_question_answer),
        )
}
