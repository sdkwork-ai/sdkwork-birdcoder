pub mod adapters;
pub mod auth;
pub mod config;
pub mod database;
pub mod git_operations;
pub mod iam;
pub mod realtime_hub;
pub mod repositories;
pub mod route_manifest;
pub mod routers;
pub mod services;
pub mod state;

use axum::Router;

use config::BirdServerConfig;

pub async fn build_app(config: &BirdServerConfig) -> Result<Router, Box<dyn std::error::Error>> {
    let database_pool = database::bootstrap_database(config).await?;
    let repositories = repositories::wire_repositories(database_pool.clone())?;
    let services = services::wire_services(&repositories, config);
    let adapters = adapters::wire_adapters(config);
    let state = state::AppState::new(services, repositories, adapters, database_pool);
    let app = routers::build_router(state, config).await?;

    Ok(app)
}
