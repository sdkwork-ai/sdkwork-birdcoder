use sdkwork_birdcoder_engine_catalog_service::service::engine_catalog_service::CodeEngineModelConfigPayload;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineKeyPathParams {
    pub engine_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionPathParams {
    pub id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionQueryParams {
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub runtime_location_id: Option<String>,
    pub engine_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionScopeQuery {
    pub workspace_id: String,
    pub project_id: String,
    pub runtime_location_id: String,
    pub engine_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncModelConfigRequest {
    pub local_config: CodeEngineModelConfigPayload,
}
