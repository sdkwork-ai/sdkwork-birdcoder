pub mod adapters;
pub mod agents;
pub mod auth;
mod code_engine_sandbox_policy;
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
use sdkwork_database_sqlx::DatabasePool;
use sqlx::AnyPool;
use std::sync::Arc;

use config::BirdServerConfig;

pub struct BuiltApplication {
    pub router: Router,
    pub database_pool: Arc<DatabasePool>,
    pub compatibility_pool: AnyPool,
}

pub async fn build_application(
    config: &BirdServerConfig,
) -> Result<BuiltApplication, Box<dyn std::error::Error>> {
    config.validate_runtime()?;
    let database_host = database::bootstrap_database(config).await?;
    let database_pool = Arc::new(database_host.pool().clone());
    let repositories = repositories::wire_repositories(
        database_pool.clone(),
        database_host.id_generator().clone(),
        database_host.node_lease().clone(),
    )
    .await?;
    let compatibility_pool = repositories.any_pool.clone();
    let services = services::wire_services(&repositories, config)
        .await
        .map_err(|error| -> Box<dyn std::error::Error> { error.to_string().into() })?;
    let state = state::AppState::new(services, repositories, database_pool.clone());
    let router = routers::build_router(state, config).await?;
    crate::health::init_iam_pool().await;

    Ok(BuiltApplication {
        router,
        database_pool,
        compatibility_pool,
    })
}

pub async fn build_app(config: &BirdServerConfig) -> Result<Router, Box<dyn std::error::Error>> {
    build_application(config)
        .await
        .map(|application| application.router)
}
