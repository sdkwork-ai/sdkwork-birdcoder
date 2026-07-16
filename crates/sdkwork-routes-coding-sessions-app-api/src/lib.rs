pub mod error;
pub mod handlers;
pub mod manifest;
pub mod mapper;
pub mod paths;
pub mod routes;

use sdkwork_web_core::HttpRouteManifest;

pub use error::AppError;
pub use handlers::CodingSessionsAppState;
pub use manifest::coding_sessions_app_api_route_manifest;
pub use routes::build_coding_sessions_app_api_router;

pub fn gateway_route_manifest() -> HttpRouteManifest {
    coding_sessions_app_api_route_manifest()
}

pub fn gateway_mount() -> axum::Router<CodingSessionsAppState> {
    build_coding_sessions_app_api_router()
}
