pub mod error;
pub mod handlers;
pub mod manifest;
pub mod mapper;
pub mod paths;
pub mod routes;

use sdkwork_web_core::HttpRouteManifest;

pub use handlers::EngineCatalogAppState;
pub use manifest::engine_catalog_app_api_route_manifest;
pub use routes::build_engine_catalog_app_router;

pub fn gateway_route_manifest() -> HttpRouteManifest {
    engine_catalog_app_api_route_manifest()
}

pub fn gateway_mount() -> axum::Router<EngineCatalogAppState> {
    build_engine_catalog_app_router()
}
