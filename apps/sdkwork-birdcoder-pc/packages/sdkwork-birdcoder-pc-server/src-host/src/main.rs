use sdkwork_birdcoder_server::{
    build_app_from_runtime_config, print_coding_server_startup_summary,
    BIRD_SERVER_DEFAULT_BIND_ADDRESS,
};

#[tokio::main]
async fn main() {
    let listener = tokio::net::TcpListener::bind(BIRD_SERVER_DEFAULT_BIND_ADDRESS)
        .await
        .expect("bind bird server");
    let local_address = listener
        .local_addr()
        .expect("read bird server local address");
    let api_base_url = format!("http://{local_address}");

    let app = build_app_from_runtime_config().expect("load bird server app");
    print_coding_server_startup_summary(&api_base_url);

    axum::serve(listener, app).await.expect("serve bird server");
}
