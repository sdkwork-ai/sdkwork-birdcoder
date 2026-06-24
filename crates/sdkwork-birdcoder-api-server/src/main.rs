use sdkwork_birdcoder_api_server::bootstrap;
use sdkwork_birdcoder_api_server::server;

#[tokio::main]
async fn main() {
    sdkwork_web_bootstrap::init_tracing_from_env();

    let config = bootstrap::config::BirdServerConfig::from_env();
    let app = bootstrap::build_app(&config)
        .await
        .expect("bootstrap failed");

    let bind_address = config.bind_address();
    tracing::info!("sdkwork-birdcoder-api-server listening on {bind_address}");
    server::listen::serve(app, &bind_address).await;
}
