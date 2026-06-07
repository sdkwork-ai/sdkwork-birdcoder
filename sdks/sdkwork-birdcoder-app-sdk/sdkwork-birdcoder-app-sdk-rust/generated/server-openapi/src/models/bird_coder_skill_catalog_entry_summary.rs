use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderSkillCatalogEntrySummary {
    pub id: String,

    #[serde(rename = "packageId")]
    pub package_id: String,

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

    pub tags: Vec<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub license: Option<String>,

    #[serde(rename = "repositoryUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repository_url: Option<String>,

    #[serde(rename = "lastUpdated")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_updated: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub readme: Option<String>,

    #[serde(rename = "capabilityKeys")]
    pub capability_keys: Vec<String>,

    pub installed: bool,
}
