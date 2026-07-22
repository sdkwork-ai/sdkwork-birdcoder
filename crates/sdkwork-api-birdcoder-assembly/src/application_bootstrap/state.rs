use std::sync::Arc;

use crate::bootstrap::services::Services;

#[derive(Clone)]
pub struct AppState {
    pub services: Services,
    pub database_host: Arc<sdkwork_birdcoder_database_host::BirdcoderDatabaseHost>,
}

impl AppState {
    pub fn new(
        services: Services,
        database_host: Arc<sdkwork_birdcoder_database_host::BirdcoderDatabaseHost>,
    ) -> Self {
        Self {
            services,
            database_host,
        }
    }
}
