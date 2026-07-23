pub mod auth;
pub mod config;
pub mod route_manifest;
pub mod routers;

use axum::Router;

use config::BirdServerConfig;

pub struct BuiltApplication {
    pub router: Router,
}

pub async fn build_application(
    config: &BirdServerConfig,
) -> Result<BuiltApplication, Box<dyn std::error::Error>> {
    config.validate_runtime()?;
    let agents_router = sdkwork_api_agents_assembly::assemble_app_business_router().await?;
    let router = routers::build_router(agents_router, config).await?;

    Ok(BuiltApplication { router })
}

pub async fn build_app(config: &BirdServerConfig) -> Result<Router, Box<dyn std::error::Error>> {
    build_application(config)
        .await
        .map(|application| application.router)
}
