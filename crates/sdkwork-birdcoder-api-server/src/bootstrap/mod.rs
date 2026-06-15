pub mod adapters;
pub mod config;
pub mod database;
pub mod repositories;
pub mod routers;
pub mod services;
pub mod state;

use axum::Router;

use config::BirdServerConfig;

pub async fn build_app(config: &BirdServerConfig) -> Result<Router, Box<dyn std::error::Error>> {
    database::ensure_schema(config)?;
    let repositories = repositories::wire_repositories(&config.sqlite_file);
    let services = services::wire_services(&repositories);
    let adapters = adapters::wire_adapters(config);
    let state = state::AppState::new(services, adapters);
    let app = routers::build_router(state, config);

    Ok(app)
}
