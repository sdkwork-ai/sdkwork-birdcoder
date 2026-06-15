use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateIamRolePermissionRequest {
    #[serde(rename = "permissionId")]
    pub permission_id: String,
}
