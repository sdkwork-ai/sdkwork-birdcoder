use serde::Serialize;

// ── Health ───────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
pub struct HealthPayload {
    pub status: String,
}

// ── Descriptor ───────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DescriptorPayload {
    pub api_version: String,
    pub gateway: GatewayDescriptorPayload,
    pub host_mode: String,
    pub module_id: String,
    pub open_api_path: String,
    pub surfaces: [String; 2],
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
    pub surfaces: [GatewaySurfaceDescriptorPayload; 2],
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

// ── Route catalog ────────────────────────────────────────────────────

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

// ── Runtime ──────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimePayload {
    pub host: String,
    pub port: u16,
    pub config_file_name: String,
}

// ── Operation ────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationPayload {
    pub operation_id: String,
    pub status: String,
    pub artifact_refs: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream_kind: Option<String>,
}

// ── Problem details ──────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProblemDetailsPayload {
    pub code: String,
    pub message: String,
    pub retryable: bool,
}
