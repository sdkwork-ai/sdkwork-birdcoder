use std::sync::Arc;

use crate::bootstrap::adapters::Adapters;
use crate::bootstrap::repositories::Repositories;
use crate::bootstrap::services::Services;

#[derive(Clone)]
pub struct AppState {
    pub services: Services,
    pub repositories: Repositories,
    pub adapters: Arc<Adapters>,
}

impl AppState {
    pub fn new(services: Services, repositories: Repositories, adapters: Adapters) -> Self {
        Self {
            services,
            repositories,
            adapters: Arc::new(adapters),
        }
    }
}
