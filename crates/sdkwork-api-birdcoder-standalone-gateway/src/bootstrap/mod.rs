pub mod adapters;
pub mod agents;
pub mod auth;
pub mod config;
pub mod database;
pub mod git_operations;
pub mod iam;
mod legacy_sqlite;
pub mod realtime_hub;
mod realtime_websocket_auth;
pub mod repositories;
pub mod route_manifest;
pub mod routers;
pub mod runner_isolation;
pub mod runtime_location;
pub mod services;
pub mod state;
pub mod terminal_execution;

use axum::Router;
use std::sync::Arc;

use config::BirdServerConfig;

pub async fn build_app(config: &BirdServerConfig) -> Result<Router, Box<dyn std::error::Error>> {
    config.validate_runtime()?;
    let database_host = database::bootstrap_database(config).await?;
    let database_pool = Arc::new(database_host.pool().clone());
    let repositories = repositories::wire_repositories(
        database_pool.clone(),
        database_host.id_generator().clone(),
        database_host.node_lease().clone(),
    )
    .await?;
    let services = services::wire_services(&repositories, config)
        .await
        .map_err(|error| -> Box<dyn std::error::Error> { error.to_string().into() })?;
    let state = state::AppState::new(services, repositories, database_pool);
    let app = routers::build_router(state, config).await?;
    crate::health::init_iam_pool().await;

    Ok(app)
}
