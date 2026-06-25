use sdkwork_birdcoder_api_server::bootstrap;
use sdkwork_birdcoder_api_server::server;

#[tokio::main]
async fn main() {
    if let Err(error) = run().await {
        tracing::error!(%error, "sdkwork-birdcoder-api-server failed");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    sdkwork_web_bootstrap::init_tracing_from_env();

    let config = bootstrap::config::BirdServerConfig::from_env();
    config.seed_birdcoder_database_env();
    let app = bootstrap::build_app(&config)
        .await
        .map_err(|error| -> Box<dyn std::error::Error + Send + Sync> {
            Box::new(std::io::Error::new(std::io::ErrorKind::Other, error.to_string()))
        })?;
    let bind_address = config.bind_address();
    tracing::info!("sdkwork-birdcoder-api-server listening on {bind_address}");
    server::listen::serve(app, &bind_address).await?;
    Ok(())
}
