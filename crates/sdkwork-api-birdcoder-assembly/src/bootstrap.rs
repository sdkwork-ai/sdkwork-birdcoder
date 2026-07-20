use axum::Router;

use crate::bootstrap::{self, config::BirdServerConfig};

pub struct ApiAssembly {
    pub router: Router,
}

pub async fn assemble_api_router(
    config: &BirdServerConfig,
) -> Result<ApiAssembly, String> {
    let router = bootstrap::build_app(config)
        .await
        .map_err(|error| error.to_string())?;
    Ok(ApiAssembly { router })
}
