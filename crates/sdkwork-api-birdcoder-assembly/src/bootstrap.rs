use axum::Router;

use crate::bootstrap::{self, config::BirdServerConfig};

pub struct ApiAssembly {
    pub router: Router,
}

pub async fn assemble_api_router(config: &BirdServerConfig) -> Result<ApiAssembly, String> {
    let birdcoder = bootstrap::build_application(config)
        .await
        .map_err(|error| error.to_string())?;
    let drive = sdkwork_api_drive_assembly::assemble_business_routes_with_process_pool(
        birdcoder.database_pool.as_ref(),
        birdcoder.compatibility_pool.clone(),
    )
    .await?;
    let membership = sdkwork_api_membership_assembly::assemble_api_router_with_process_pool(
        birdcoder.database_pool.as_ref(),
    )
    .await?;
    Ok(ApiAssembly {
        router: Router::new()
            .merge(birdcoder.router)
            .merge(drive.router)
            .merge(membership.router),
    })
}
