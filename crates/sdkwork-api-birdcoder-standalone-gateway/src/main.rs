use sdkwork_api_birdcoder_assembly::{assemble_application_router, bootstrap};
use sdkwork_api_birdcoder_standalone_gateway::server;

#[tokio::main]
async fn main() {
    sdkwork_api_birdcoder_standalone_gateway::enable_process_shared_database_pool();
    if let Err(error) = run().await {
        tracing::error!(%error, "sdkwork-api-birdcoder-standalone-gateway failed");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    sdkwork_web_bootstrap::init_tracing_from_env();

    let config = bootstrap::config::BirdServerConfig::from_env()?;
    let app = assemble_application_router(&config)
        .await
        .map_err(|error| -> Box<dyn std::error::Error + Send + Sync> {
            Box::new(std::io::Error::other(error.to_string()))
        })?
        .router;
    let bind_address = config.bind_address();
    tracing::info!("sdkwork-api-birdcoder-standalone-gateway listening on {bind_address}");
    server::listen::serve(app, &bind_address).await?;
    Ok(())
}
