use axum::Router;

use crate::bootstrap::{self, config::BirdServerConfig};

pub struct ApiAssembly {
    pub router: Router,
}

pub async fn assemble_api_router(
    config: &BirdServerConfig,
) -> Result<ApiAssembly, String> {
    let birdcoder = bootstrap::build_app(config)
        .await
        .map_err(|error| error.to_string())?;
    let drive = sdkwork_api_drive_assembly::assemble_business_routes_from_env().await?;
    let membership = sdkwork_api_membership_assembly::assemble_api_router_from_env().await?;
    Ok(ApiAssembly {
        router: Router::new()
            .merge(birdcoder)
            .merge(drive.router)
            .merge(membership.router),
    })
}
