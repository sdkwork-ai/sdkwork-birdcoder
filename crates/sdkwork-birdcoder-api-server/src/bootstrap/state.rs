use std::sync::Arc;

use sdkwork_database_sqlx::DatabasePool;

use crate::bootstrap::adapters::Adapters;
use crate::bootstrap::repositories::Repositories;
use crate::bootstrap::services::Services;

#[derive(Clone)]
pub struct AppState {
    pub services: Services,
    pub repositories: Repositories,
    pub adapters: Arc<Adapters>,
    pub database_pool: Arc<DatabasePool>,
}

impl AppState {
    pub fn new(
        services: Services,
        repositories: Repositories,
        adapters: Adapters,
        database_pool: Arc<DatabasePool>,
    ) -> Self {
        Self {
            services,
            repositories,
            adapters: Arc::new(adapters),
            database_pool,
        }
    }
}
