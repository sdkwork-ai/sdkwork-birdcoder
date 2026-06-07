use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderUpdateIamPolicyRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy: Option<std::collections::HashMap<String, serde_json::Value>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}
