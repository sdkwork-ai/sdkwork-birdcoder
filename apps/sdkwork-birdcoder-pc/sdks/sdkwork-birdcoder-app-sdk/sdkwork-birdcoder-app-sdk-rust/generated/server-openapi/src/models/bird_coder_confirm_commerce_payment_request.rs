use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderConfirmCommercePaymentRequest {
    #[serde(rename = "channelTransactionId")]
    pub channel_transaction_id: String,
}
