use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiGatewaySurfaceSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderApiGatewaySummary {
    #[serde(rename = "docsPath")]
    pub docs_path: String,

    #[serde(rename = "liveOpenApiPath")]
    pub live_open_api_path: String,

    #[serde(rename = "openApiPath")]
    pub open_api_path: String,

    #[serde(rename = "routeCatalogPath")]
    pub route_catalog_path: String,

    #[serde(rename = "routeCount")]
    pub route_count: i64,

    #[serde(rename = "routesBySurface")]
    pub routes_by_surface: serde_json::Value,

    pub surfaces: Vec<BirdCoderApiGatewaySurfaceSummary>,
}
