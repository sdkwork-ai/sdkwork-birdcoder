use serde::Serialize;

#[derive(Clone, Debug, Serialize)]
pub struct HealthPayload {
    pub status: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DescriptorPayload {
    pub api_version: String,
    pub gateway: GatewayDescriptorPayload,
    pub host_mode: String,
    pub module_id: String,
    pub open_api_path: String,
    pub surfaces: Vec<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayDescriptorPayload {
    pub docs_path: String,
    pub live_open_api_path: String,
    pub open_api_path: String,
    pub route_catalog_path: String,
    pub route_count: usize,
    pub routes_by_surface: GatewayRoutesBySurfacePayload,
    pub surfaces: Vec<GatewaySurfaceDescriptorPayload>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayRoutesBySurfacePayload {
    pub app: usize,
    pub backend: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewaySurfaceDescriptorPayload {
    pub auth_mode: String,
    pub base_path: String,
    pub description: String,
    pub name: String,
    pub route_count: usize,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RouteCatalogEntryPayload {
    pub auth_mode: String,
    pub method: String,
    pub open_api_path: String,
    pub operation_id: String,
    pub path: String,
    pub surface: String,
    pub summary: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePayload {
    pub host: String,
    pub port: u16,
    pub config_file_name: String,
}
