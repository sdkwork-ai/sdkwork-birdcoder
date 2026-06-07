use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateIamTenantRequest {
    pub code: String,

    pub name: String,
}
