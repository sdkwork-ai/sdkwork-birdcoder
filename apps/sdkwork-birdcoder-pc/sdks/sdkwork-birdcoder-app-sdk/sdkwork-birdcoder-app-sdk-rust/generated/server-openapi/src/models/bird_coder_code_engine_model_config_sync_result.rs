use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderCodeEngineModelConfig};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodeEngineModelConfigSyncResult {
    pub action: String,

    #[serde(rename = "authoritativeSource")]
    pub authoritative_source: String,

    pub config: BirdCoderCodeEngineModelConfig,

    #[serde(rename = "shouldWriteLocal")]
    pub should_write_local: bool,

    #[serde(rename = "shouldWriteServer")]
    pub should_write_server: bool,
}
