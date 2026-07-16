pub mod error;
pub mod handlers;
pub mod manifest;
pub mod mapper;
pub mod paths;
pub mod routes;

use sdkwork_web_core::HttpRouteManifest;

pub use handlers::ChatAppState;
pub use manifest::chat_app_api_route_manifest;
pub use routes::build_chat_app_router;

pub fn gateway_route_manifest() -> HttpRouteManifest {
    chat_app_api_route_manifest()
}

pub fn gateway_mount() -> axum::Router<ChatAppState> {
    build_chat_app_router()
}
