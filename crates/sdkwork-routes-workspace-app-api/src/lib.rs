pub mod error;
pub mod handlers;
pub mod manifest;
pub mod mapper;
pub mod paths;
pub mod routes;

use sdkwork_web_core::HttpRouteManifest;

pub use handlers::WorkspaceAppState;
pub use manifest::workspace_app_api_route_manifest;
pub use routes::build_workspace_app_router;

pub fn gateway_route_manifest() -> HttpRouteManifest {
    workspace_app_api_route_manifest()
}

pub fn gateway_mount() -> axum::Router<WorkspaceAppState> {
    build_workspace_app_router()
}
