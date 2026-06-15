use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateIamPolicyRequest {
    pub code: String,

    pub name: String,

    pub policy: std::collections::HashMap<String, serde_json::Value>,
}
