use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamApiKeySummary {
    pub id: String,

    #[serde(rename = "tenantId")]
    pub tenant_id: String,

    #[serde(rename = "userId")]
    pub user_id: String,

    pub name: String,

    #[serde(rename = "permissionScopes")]
    pub permission_scopes: Vec<String>,

    pub status: String,

    #[serde(rename = "expiresAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,

    #[serde(rename = "createdAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,

    #[serde(rename = "updatedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}
