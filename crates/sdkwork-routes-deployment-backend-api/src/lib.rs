pub mod error;
pub mod handlers;
pub mod manifest;
pub mod mapper;
pub mod paths;
pub mod routes;

use sdkwork_web_core::HttpRouteManifest;

pub use handlers::DeploymentBackendAppState;
pub use manifest::deployment_backend_api_route_manifest;
pub use routes::build_deployment_backend_router;

pub fn gateway_route_manifest() -> HttpRouteManifest {
    deployment_backend_api_route_manifest()
}

pub fn gateway_mount() -> axum::Router<DeploymentBackendAppState> {
    build_deployment_backend_router()
}
