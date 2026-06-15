use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderAppTemplateSummary {
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
    pub updated_at: String,

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

    #[serde(rename = "presetKey")]
    pub preset_key: String,

    /// Known values include community, saas, and mine.
    pub category: String,

    pub tags: Vec<String>,

    #[serde(rename = "targetProfiles")]
    pub target_profiles: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub downloads: Option<i64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stars: Option<i64>,

    /// Known values include active and archived.
    pub status: String,
}
