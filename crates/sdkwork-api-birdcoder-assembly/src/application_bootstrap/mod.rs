pub mod auth;
pub mod config;
pub mod database;
pub mod git_operations;
pub mod repositories;
pub mod route_manifest;
pub mod routers;
pub mod runner_isolation;
pub mod runtime_location;
pub mod services;
pub mod state;

use axum::{Extension, Router};
use std::sync::Arc;

use config::BirdServerConfig;

pub struct BuiltApplication {
    pub router: Router,
}

pub async fn build_application(
    config: &BirdServerConfig,
) -> Result<BuiltApplication, Box<dyn std::error::Error>> {
    config.validate_runtime()?;
    let database_host = Arc::new(database::bootstrap_database(config).await?);
    let repositories = repositories::wire_repositories(
        database_host.pool().clone(),
        database_host.id_generator().clone(),
    );
    let services = services::wire_services(&repositories, config)
        .await
        .map_err(|error| -> Box<dyn std::error::Error> { error.to_string().into() })?;
    let state = state::AppState::new(services, database_host.clone());
    let router = routers::build_router(state, config)
        .await?
        .layer(Extension(database_host));

    Ok(BuiltApplication { router })
}

pub async fn build_app(config: &BirdServerConfig) -> Result<Router, Box<dyn std::error::Error>> {
    build_application(config)
        .await
        .map(|application| application.router)
}
