pub mod config;
pub mod route_manifest;
pub mod routers;

use axum::Router;
use sdkwork_web_core::HttpRouteManifest;

use config::BirdServerConfig;

/// Host-neutral BirdCoder owner build result.
///
/// This assembly mounts only BirdCoder-owned System App API routes. Dependency
/// assemblies, process middleware, listener state, and infrastructure routes are
/// owned by the selected gateway profile.
pub struct BuiltApplication {
    pub router: Router,
    pub route_manifest: HttpRouteManifest,
}

pub async fn build_application(
    config: &BirdServerConfig,
) -> Result<BuiltApplication, Box<dyn std::error::Error>> {
    config.validate_runtime()?;
    let (router, route_manifest) = routers::build_router(config).await?;

    Ok(BuiltApplication {
        router,
        route_manifest,
    })
}
