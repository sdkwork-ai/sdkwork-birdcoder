use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderEngineAccessPlan, BirdCoderEngineCapabilityMatrix, BirdCoderEngineOfficialIntegration};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderEngineDescriptor {
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

    #[serde(rename = "displayName")]
    pub display_name: String,

    pub vendor: String,

    #[serde(rename = "installationKind")]
    pub installation_kind: String,

    #[serde(rename = "defaultModelId")]
    pub default_model_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,

    #[serde(rename = "supportedHostModes")]
    pub supported_host_modes: Vec<String>,

    #[serde(rename = "transportKinds")]
    pub transport_kinds: Vec<String>,

    #[serde(rename = "capabilityMatrix")]
    pub capability_matrix: BirdCoderEngineCapabilityMatrix,

    pub status: String,

    #[serde(rename = "accessPlan")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub access_plan: Option<BirdCoderEngineAccessPlan>,

    #[serde(rename = "officialIntegration")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub official_integration: Option<BirdCoderEngineOfficialIntegration>,
}
