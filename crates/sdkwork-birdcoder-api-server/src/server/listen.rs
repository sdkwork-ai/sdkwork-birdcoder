use axum::Router;
use tokio::net::TcpListener;

pub async fn serve(app: Router, bind_address: &str) {
    let listener = TcpListener::bind(bind_address)
        .await
        .expect("failed to bind");

    axum::serve(listener, app)
        .await
        .expect("server error");
}
