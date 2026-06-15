use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateIamUserRoleRequest {
    #[serde(rename = "roleId")]
    pub role_id: String,

    #[serde(rename = "roleCode")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub role_code: Option<String>,
}
