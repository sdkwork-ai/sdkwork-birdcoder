use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateIamOrganizationMemberRequest {
    #[serde(rename = "userId")]
    pub user_id: String,

    #[serde(rename = "roleCode")]
    pub role_code: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remark: Option<String>,
}
