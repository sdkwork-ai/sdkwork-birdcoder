use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderModelCatalogEntry};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodeEngineModelConfigEngine {
    #[serde(rename = "engineId")]
    pub engine_id: String,

    #[serde(rename = "defaultModelId")]
    pub default_model_id: String,

    #[serde(rename = "selectedModelId")]
    pub selected_model_id: String,

    pub models: Vec<BirdCoderModelCatalogEntry>,
}
