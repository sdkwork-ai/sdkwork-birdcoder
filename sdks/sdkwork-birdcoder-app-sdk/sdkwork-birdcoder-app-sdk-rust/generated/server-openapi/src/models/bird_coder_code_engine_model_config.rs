use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderCodeEngineModelConfigEngine};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodeEngineModelConfig {
    #[serde(rename = "schemaVersion")]
    pub schema_version: i64,

    pub source: String,

    pub version: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,

    pub engines: std::collections::HashMap<String, BirdCoderCodeEngineModelConfigEngine>,
}
