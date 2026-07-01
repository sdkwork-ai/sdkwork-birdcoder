use sdkwork_web_contract::{HttpMethod, HttpRoute};
use sdkwork_web_core::HttpRouteManifest;

use crate::paths;

pub const CHAT_APP_API_ROUTES: &[HttpRoute] = &[
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::CONVERSATIONS_PATH,
        "chat",
        "chat.conversations.list",
    )
    .with_required_permission("chat.conversations.read"),
    HttpRoute::dual_token(
        HttpMethod::Post,
        paths::CONVERSATIONS_PATH,
        "chat",
        "chat.conversations.create",
    )
    .with_required_permission("chat.conversations.create"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::CONVERSATION_PATH,
        "chat",
        "chat.conversations.retrieve",
    )
    .with_required_permission("chat.conversations.read"),
    HttpRoute::dual_token(
        HttpMethod::Delete,
        paths::CONVERSATION_PATH,
        "chat",
        "chat.conversations.delete",
    )
    .with_required_permission("chat.conversations.delete"),
    HttpRoute::dual_token(
        HttpMethod::Get,
        paths::CONVERSATION_MESSAGES_PATH,
        "chat",
        "chat.conversations.messages.list",
    )
    .with_required_permission("chat.conversations.messages.read"),
    HttpRoute::dual_token(
        HttpMethod::Post,
        paths::CONVERSATION_MESSAGES_PATH,
        "chat",
        "chat.conversations.messages.create",
    )
    .with_required_permission("chat.conversations.messages.create"),
];

pub fn chat_app_api_route_manifest() -> HttpRouteManifest {
    HttpRouteManifest::new(CHAT_APP_API_ROUTES)
}
