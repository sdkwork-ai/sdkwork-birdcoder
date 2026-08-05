use axum::Router;
use sdkwork_routes_system_app_api::SystemAppState;
use sdkwork_web_bootstrap::ReadinessCheck;
use sdkwork_web_core::HttpRouteManifest;

use crate::bootstrap::config::BirdServerConfig;
use crate::bootstrap::route_manifest::{
    birdcoder_app_api_route_manifest, birdcoder_app_api_routes,
};

/// Mounts only BirdCoder-owned System App API routes.
///
/// The returned router is raw and contains no dependency routes, Web Framework
/// layer, CORS middleware, or infrastructure routes.
pub async fn build_router(
    config: &BirdServerConfig,
    readiness_check: Option<std::sync::Arc<dyn ReadinessCheck>>,
) -> Result<(Router, HttpRouteManifest), Box<dyn std::error::Error>> {
    let owned_routes = birdcoder_app_api_routes();
    let mut state = SystemAppState::with_runtime(
        owned_routes,
        config.host.clone(),
        config.port,
        "sdkwork.app.config.json",
    );
    if let Some(readiness_check) = readiness_check {
        state = state.with_readiness_check(readiness_check);
    }
    let system_router =
        sdkwork_routes_system_app_api::build_system_app_router().with_state(state);

    Ok((system_router, birdcoder_app_api_route_manifest()))
}
