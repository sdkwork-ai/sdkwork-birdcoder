use sdkwork_birdcoder_engine_catalog_service::service::engine_catalog_service::CodeEngineModelConfigPayload;
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineKeyPathParams {
    pub engine_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncModelConfigRequest {
    pub local_config: CodeEngineModelConfigPayload,
}
