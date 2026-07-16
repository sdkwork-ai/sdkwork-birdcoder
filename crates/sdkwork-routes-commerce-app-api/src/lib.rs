pub mod error;
pub mod handlers;
pub mod manifest;
pub mod mapper;
pub mod paths;
pub mod routes;

use sdkwork_web_core::HttpRouteManifest;

pub use handlers::CommerceAppState;
pub use manifest::commerce_app_api_route_manifest;
pub use routes::build_commerce_app_router;

pub fn gateway_route_manifest() -> HttpRouteManifest {
    commerce_app_api_route_manifest()
}

pub fn gateway_mount() -> axum::Router<CommerceAppState> {
    build_commerce_app_router()
}
