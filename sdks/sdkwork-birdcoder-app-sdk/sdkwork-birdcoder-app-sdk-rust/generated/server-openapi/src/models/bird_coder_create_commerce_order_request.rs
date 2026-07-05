use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateCommerceOrderRequest {
    #[serde(rename = "packageId")]
    pub package_id: String,

    pub amount: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,

    #[serde(rename = "workspaceId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<String>,
}
