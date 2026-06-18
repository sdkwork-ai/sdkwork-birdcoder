use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodeEngineModelConfigCustomModel {
    pub id: String,

    pub label: String,
}
