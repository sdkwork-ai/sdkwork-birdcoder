use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderCodeEngineModelConfig};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderSyncCodeEngineModelConfigRequest {
    #[serde(rename = "localConfig")]
    pub local_config: BirdCoderCodeEngineModelConfig,
}
