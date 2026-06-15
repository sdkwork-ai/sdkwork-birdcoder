use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderApiGatewaySurfaceSummary {
    #[serde(rename = "authMode")]
    pub auth_mode: String,

    #[serde(rename = "basePath")]
    pub base_path: String,

    pub description: String,

    pub name: String,

    #[serde(rename = "routeCount")]
    pub route_count: i64,
}
