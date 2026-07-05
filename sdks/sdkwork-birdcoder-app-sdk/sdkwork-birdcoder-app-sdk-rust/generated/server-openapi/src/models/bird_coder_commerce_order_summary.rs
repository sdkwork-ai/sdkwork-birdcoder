use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCommerceOrderSummary {
    pub id: String,

    #[serde(rename = "workspaceId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,

    #[serde(rename = "orderNo")]
    pub order_no: String,

    #[serde(rename = "userId")]
    pub user_id: String,

    #[serde(rename = "packageId")]
    pub package_id: String,

    pub amount: String,

    pub currency: String,

    pub status: String,

    #[serde(rename = "paidAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub paid_at: Option<String>,

    #[serde(rename = "refundAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub refund_at: Option<String>,

    pub metadata: String,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}
