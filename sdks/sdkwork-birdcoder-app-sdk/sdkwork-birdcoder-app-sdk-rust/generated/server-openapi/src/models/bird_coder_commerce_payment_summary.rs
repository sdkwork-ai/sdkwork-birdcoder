use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCommercePaymentSummary {
    pub id: String,

    #[serde(rename = "paymentNo")]
    pub payment_no: String,

    #[serde(rename = "orderId")]
    pub order_id: String,

    #[serde(rename = "userId")]
    pub user_id: String,

    pub channel: String,

    #[serde(rename = "channelTransactionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub channel_transaction_id: Option<String>,

    pub amount: String,

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
