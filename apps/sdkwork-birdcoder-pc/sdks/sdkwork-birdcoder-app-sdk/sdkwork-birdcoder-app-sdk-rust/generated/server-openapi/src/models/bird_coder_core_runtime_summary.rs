use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCoreRuntimeSummary {
    pub host: String,

    pub port: i64,

    #[serde(rename = "configFileName")]
    pub config_file_name: String,
}
