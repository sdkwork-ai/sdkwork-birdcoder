use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamOrganizationSummary {
    pub id: String,

    #[serde(rename = "tenantId")]
    pub tenant_id: String,

    #[serde(rename = "parentId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,

    pub code: String,

    pub name: String,

    pub path: String,

    pub status: String,

    #[serde(rename = "createdAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,

    #[serde(rename = "updatedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}
