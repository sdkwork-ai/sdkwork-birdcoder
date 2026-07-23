use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderWorkspaceSummary {
    pub id: String,

    pub uuid: String,

    #[serde(rename = "tenantId")]
    pub tenant_id: String,

    #[serde(rename = "organizationId")]
    pub organization_id: String,

    #[serde(rename = "ownerUserId")]
    pub owner_user_id: String,

    #[serde(rename = "createdByUserId")]
    pub created_by_user_id: String,

    pub code: String,

    pub name: String,

    pub description: String,

    #[serde(rename = "iconUrl")]
    pub icon_url: String,

    pub color: String,

    pub visibility: String,

    pub status: String,

    /// Optimistic concurrency version used with the If-Match request header.
    pub version: String,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}
