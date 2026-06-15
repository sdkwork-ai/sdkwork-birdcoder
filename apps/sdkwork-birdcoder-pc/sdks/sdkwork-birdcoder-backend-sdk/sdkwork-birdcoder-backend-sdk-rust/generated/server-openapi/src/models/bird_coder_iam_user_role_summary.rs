use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamUserRoleSummary {
    pub id: String,

    #[serde(rename = "tenantId")]
    pub tenant_id: String,

    #[serde(rename = "userId")]
    pub user_id: String,

    #[serde(rename = "roleId")]
    pub role_id: String,

    #[serde(rename = "roleCode")]
    pub role_code: String,

    pub status: String,

    #[serde(rename = "createdAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}
