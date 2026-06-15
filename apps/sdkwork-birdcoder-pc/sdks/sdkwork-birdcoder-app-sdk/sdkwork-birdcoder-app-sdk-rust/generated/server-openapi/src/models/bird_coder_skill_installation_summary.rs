use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderSkillInstallationSummary {
    pub id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uuid: Option<String>,

    #[serde(rename = "tenantId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,

    #[serde(rename = "organizationId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,

    #[serde(rename = "createdAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,

    #[serde(rename = "updatedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,

    #[serde(rename = "packageId")]
    pub package_id: String,

    #[serde(rename = "scopeId")]
    pub scope_id: String,

    #[serde(rename = "scopeType")]
    pub scope_type: String,

    /// Known values include active and archived.
    pub status: String,

    #[serde(rename = "versionId")]
    pub version_id: String,

    #[serde(rename = "installedAt")]
    pub installed_at: String,
}
