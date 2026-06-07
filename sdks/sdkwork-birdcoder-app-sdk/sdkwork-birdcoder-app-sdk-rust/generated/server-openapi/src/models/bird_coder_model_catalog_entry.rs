use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderModelCatalogEntry {
    pub id: String,

    pub uuid: String,

    #[serde(rename = "tenantId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,

    #[serde(rename = "organizationId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,

    #[serde(rename = "engineKey")]
    pub engine_key: String,

    #[serde(rename = "modelId")]
    pub model_id: String,

    #[serde(rename = "displayName")]
    pub display_name: String,

    #[serde(rename = "providerId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,

    pub status: String,

    #[serde(rename = "defaultForEngine")]
    pub default_for_engine: bool,

    #[serde(rename = "transportKinds")]
    pub transport_kinds: Vec<String>,

    #[serde(rename = "capabilityMatrix")]
    pub capability_matrix: serde_json::Value,
}
