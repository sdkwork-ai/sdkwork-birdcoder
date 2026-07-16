pub mod error;
pub mod handlers;
pub mod manifest;
pub mod mapper;
pub mod paths;
pub mod routes;

use sdkwork_web_core::HttpRouteManifest;

pub use handlers::SkillPackagesAppState;
pub use manifest::skill_packages_app_api_route_manifest;
pub use routes::build_skill_packages_app_router;

pub fn gateway_route_manifest() -> HttpRouteManifest {
    skill_packages_app_api_route_manifest()
}

pub fn gateway_mount() -> axum::Router<SkillPackagesAppState> {
    build_skill_packages_app_router()
}
