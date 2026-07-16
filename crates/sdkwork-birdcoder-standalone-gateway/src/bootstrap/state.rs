use std::sync::Arc;

use sdkwork_database_sqlx::DatabasePool;

use crate::bootstrap::repositories::Repositories;
use crate::bootstrap::services::Services;

#[derive(Clone)]
pub struct AppState {
    pub services: Services,
    pub repositories: Repositories,
    pub database_pool: Arc<DatabasePool>,
}

impl AppState {
    pub fn new(
        services: Services,
        repositories: Repositories,
        database_pool: Arc<DatabasePool>,
    ) -> Self {
        Self {
            services,
            repositories,
            database_pool,
        }
    }
}
