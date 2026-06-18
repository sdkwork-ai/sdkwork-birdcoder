use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamUserSummary {
    pub id: String,

    pub uuid: String,

    #[serde(rename = "tenantId")]
    pub tenant_id: String,

    #[serde(rename = "organizationId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,

    pub email: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub phone: Option<String>,

    #[serde(rename = "displayName")]
    pub display_name: String,

    #[serde(rename = "avatarUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub avatar_url: Option<String>,

    pub status: String,

    #[serde(rename = "createdAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,

    #[serde(rename = "updatedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}
