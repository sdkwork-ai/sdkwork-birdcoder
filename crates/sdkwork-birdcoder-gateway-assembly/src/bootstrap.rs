//! Gateway bootstrap for sdkwork-birdcoder.

use axum::Router;
use sdkwork_birdcoder_standalone_gateway::bootstrap::{self, config::BirdServerConfig};

pub struct ApplicationAssembly {
    pub router: Router,
}

pub async fn assemble_application_router(
    config: &BirdServerConfig,
) -> Result<ApplicationAssembly, String> {
    let router = bootstrap::build_app(config)
        .await
        .map_err(|error| error.to_string())?;
    Ok(ApplicationAssembly { router })
}
