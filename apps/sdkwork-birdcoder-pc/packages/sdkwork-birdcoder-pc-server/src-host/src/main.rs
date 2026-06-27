use sdkwork_birdcoder_standalone_gateway::bootstrap;
use sdkwork_birdcoder_standalone_gateway::server;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    let config = bootstrap::config::BirdServerConfig::from_env();
    let app = bootstrap::build_app(&config)
        .await
        .expect("bootstrap failed");

    let bind_address = config.bind_address();
    tracing::info!("sdkwork-birdcoder-pc-server-host-shim listening on {bind_address}");
    server::listen::serve(app, &bind_address).await;
}
