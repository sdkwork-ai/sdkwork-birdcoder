use sdkwork_birdcoder_server::{build_app_from_runtime_config, BIRD_SERVER_DEFAULT_BIND_ADDRESS};

#[tokio::main]
async fn main() {
    let listener = tokio::net::TcpListener::bind(BIRD_SERVER_DEFAULT_BIND_ADDRESS)
        .await
        .expect("bind bird server");

    let app = build_app_from_runtime_config().expect("load bird server app");

    axum::serve(listener, app)
        .await
        .expect("serve bird server");
}
