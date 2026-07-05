use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateCommercePaymentRequest {
    #[serde(rename = "orderId")]
    pub order_id: String,

    pub channel: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount: Option<String>,

    #[serde(rename = "channelTransactionId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub channel_transaction_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<String>,
}
