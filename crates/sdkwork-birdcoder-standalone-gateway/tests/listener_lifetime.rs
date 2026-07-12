use axum::routing::get;
use axum::Router;
use std::time::Duration;

use sdkwork_birdcoder_standalone_gateway::server::listen::serve;

#[tokio::test(start_paused = true)]
async fn serve_does_not_exit_without_shutdown_signal() {
    let app = Router::new().route("/health/live", get(|| async { "ok" }));
    let handle = tokio::spawn(async move { serve(app, "127.0.0.1:0").await });

    tokio::task::yield_now().await;
    tokio::time::advance(Duration::from_secs(31)).await;
    tokio::task::yield_now().await;

    let finished_without_shutdown_signal = handle.is_finished();
    if !finished_without_shutdown_signal {
        handle.abort();
    }

    assert!(
        !finished_without_shutdown_signal,
        "gateway listener must keep serving until an explicit shutdown signal is received",
    );
}
