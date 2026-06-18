use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderApiRouteCatalogEntry {
    #[serde(rename = "authMode")]
    pub auth_mode: String,

    pub method: String,

    pub path: String,

    pub surface: String,

    pub summary: String,

    #[serde(rename = "openApiPath")]
    pub open_api_path: String,

    #[serde(rename = "operationId")]
    pub operation_id: String,
}
