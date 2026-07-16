pub mod error;
pub mod handlers;
pub mod manifest;
pub mod mapper;
pub mod paths;
pub mod routes;

use sdkwork_web_core::HttpRouteManifest;

pub use handlers::SystemAppState;
pub use manifest::system_app_api_route_manifest;
pub use routes::build_system_app_router;

pub fn gateway_route_manifest() -> HttpRouteManifest {
    system_app_api_route_manifest()
}

pub fn gateway_mount() -> axum::Router<SystemAppState> {
    build_system_app_router()
}
