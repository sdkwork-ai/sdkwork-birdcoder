use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderSkillCatalogEntrySummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderSkillPackageSummary {
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

    pub slug: String,

    pub name: String,

    pub description: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author: Option<String>,

    #[serde(rename = "versionId")]
    pub version_id: String,

    #[serde(rename = "versionLabel")]
    pub version_label: String,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "installCount")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub install_count: Option<String>,

    #[serde(rename = "longDescription")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub long_description: Option<String>,

    #[serde(rename = "sourceUri")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_uri: Option<String>,

    pub installed: bool,

    pub skills: Vec<BirdCoderSkillCatalogEntrySummary>,
}
