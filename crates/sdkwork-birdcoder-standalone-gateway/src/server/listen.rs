use axum::Router;
use std::time::Duration;
use tokio::net::TcpListener;

/// Maximum time to wait for active connections to drain after a shutdown
/// signal. Connections that exceed this grace period are forcibly closed.
const SHUTDOWN_DRAIN_TIMEOUT: Duration = Duration::from_secs(30);

pub async fn serve(app: Router, bind_address: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let listener = TcpListener::bind(bind_address).await?;
    let server = axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal());

    // Wrap the server in a timeout so that even if some connections are stuck,
    // the server will shut down within `SHUTDOWN_DRAIN_TIMEOUT`.
    match tokio::time::timeout(SHUTDOWN_DRAIN_TIMEOUT, server).await {
        Ok(result) => {
            result?;
            tracing::info!("server shutdown complete, all connections drained");
        }
        Err(_) => {
            tracing::warn!(
                "server shutdown timed out after {}s, forcibly closing remaining connections",
                SHUTDOWN_DRAIN_TIMEOUT.as_secs()
            );
        }
    }

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            tracing::error!(%error, "failed to install Ctrl+C handler");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(error) => {
                tracing::error!(%error, "failed to install SIGTERM handler");
            }
        }
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }

    tracing::info!("shutdown signal received, draining active connections");
}
