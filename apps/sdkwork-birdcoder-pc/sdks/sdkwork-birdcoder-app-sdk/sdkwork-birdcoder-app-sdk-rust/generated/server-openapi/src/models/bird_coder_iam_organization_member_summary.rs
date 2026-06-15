use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamOrganizationMemberSummary {
    pub id: String,

    #[serde(rename = "tenantId")]
    pub tenant_id: String,

    #[serde(rename = "organizationId")]
    pub organization_id: String,

    #[serde(rename = "userId")]
    pub user_id: String,

    #[serde(rename = "roleCode")]
    pub role_code: String,

    pub status: String,

    #[serde(rename = "joinedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub joined_at: Option<String>,

    #[serde(rename = "leftAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left_at: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remark: Option<String>,
}
