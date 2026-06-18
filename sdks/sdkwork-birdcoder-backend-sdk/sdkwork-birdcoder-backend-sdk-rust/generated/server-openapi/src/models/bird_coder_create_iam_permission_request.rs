use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateIamPermissionRequest {
    pub code: String,

    pub name: String,

    pub resource: String,

    pub action: String,
}
