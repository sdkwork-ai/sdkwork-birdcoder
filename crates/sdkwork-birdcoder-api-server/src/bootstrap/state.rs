use std::sync::Arc;

use crate::bootstrap::adapters::Adapters;
use crate::bootstrap::services::Services;

#[derive(Clone)]
pub struct AppState {
    pub services: Services,
    pub adapters: Arc<Adapters>,
}

impl AppState {
    pub fn new(services: Services, adapters: Adapters) -> Self {
        Self {
            services,
            adapters: Arc::new(adapters),
        }
    }
}
