use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderCodeEngineModelConfigCustomModel, BirdCoderModelCatalogEntry};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodeEngineModelConfigEngine {
    #[serde(rename = "engineId")]
    pub engine_id: String,

    #[serde(rename = "defaultModelId")]
    pub default_model_id: String,

    #[serde(rename = "selectedModelId")]
    pub selected_model_id: String,

    #[serde(rename = "customModels")]
    pub custom_models: Vec<BirdCoderCodeEngineModelConfigCustomModel>,

    pub models: Vec<BirdCoderModelCatalogEntry>,
}
