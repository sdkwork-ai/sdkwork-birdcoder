use sdkwork_api_birdcoder_standalone_gateway::{bootstrap, build_app};

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        tracing::error!(%error, "sdkwork-api-birdcoder-standalone-gateway failed");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    sdkwork_web_bootstrap::init_tracing_from_env();

    let config = bootstrap::config::BirdServerConfig::from_env()?;
    let app = build_app(&config).await?;
    let bind_address = config.bind_address();
    tracing::info!("sdkwork-api-birdcoder-standalone-gateway listening on {bind_address}");
    sdkwork_api_birdcoder_standalone_gateway::server::listen::serve(app, &bind_address).await?;
    Ok(())
}
