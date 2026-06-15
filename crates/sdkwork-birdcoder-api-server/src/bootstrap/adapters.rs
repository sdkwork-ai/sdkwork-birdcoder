use crate::bootstrap::config::BirdServerConfig;

pub struct Adapters {
    pub project_root: Option<String>,
}

pub fn wire_adapters(config: &BirdServerConfig) -> Adapters {
    Adapters {
        project_root: config.project_root.clone(),
    }
}
