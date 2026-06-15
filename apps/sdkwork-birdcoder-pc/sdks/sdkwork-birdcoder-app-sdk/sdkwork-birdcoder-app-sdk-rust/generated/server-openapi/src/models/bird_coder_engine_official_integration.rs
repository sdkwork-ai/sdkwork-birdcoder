use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderEngineOfficialEntry};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderEngineOfficialIntegration {
    #[serde(rename = "integrationClass")]
    pub integration_class: String,

    #[serde(rename = "runtimeMode")]
    pub runtime_mode: String,

    #[serde(rename = "officialEntry")]
    pub official_entry: BirdCoderEngineOfficialEntry,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}
