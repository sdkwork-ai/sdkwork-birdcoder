use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiGatewaySummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderApplicationDescriptor {
    #[serde(rename = "apiVersion")]
    pub api_version: String,

    pub gateway: BirdCoderApiGatewaySummary,

    #[serde(rename = "hostMode")]
    pub host_mode: String,

    #[serde(rename = "moduleId")]
    pub module_id: String,

    #[serde(rename = "openApiPath")]
    pub open_api_path: String,

    pub surfaces: Vec<String>,
}
