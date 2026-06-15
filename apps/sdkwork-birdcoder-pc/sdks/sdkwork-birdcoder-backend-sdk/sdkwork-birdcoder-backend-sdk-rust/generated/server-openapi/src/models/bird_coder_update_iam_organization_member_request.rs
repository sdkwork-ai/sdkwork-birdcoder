use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderUpdateIamOrganizationMemberRequest {
    #[serde(rename = "roleCode")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role_code: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remark: Option<String>,
}
