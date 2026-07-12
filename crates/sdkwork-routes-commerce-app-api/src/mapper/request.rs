use serde::Deserialize;

use sdkwork_birdcoder_commerce_service::domain::models::{
    ConfirmPaymentCommand, CreateOrderCommand, CreatePaymentCommand,
};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderBody {
    pub package_id: String,
    pub amount: String,
    pub currency: Option<String>,
    pub workspace_id: Option<String>,
    pub metadata: Option<String>,
}

impl From<CreateOrderBody> for CreateOrderCommand {
    fn from(value: CreateOrderBody) -> Self {
        Self {
            package_id: value.package_id,
            amount: value.amount,
            currency: value.currency,
            workspace_id: value.workspace_id,
            metadata: value.metadata,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentBody {
    pub order_id: String,
    pub channel: String,
    pub amount: Option<String>,
    pub channel_transaction_id: Option<String>,
    pub metadata: Option<String>,
}

impl From<CreatePaymentBody> for CreatePaymentCommand {
    fn from(value: CreatePaymentBody) -> Self {
        Self {
            order_id: value.order_id,
            channel: value.channel,
            amount: value.amount,
            channel_transaction_id: value.channel_transaction_id,
            metadata: value.metadata,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmPaymentBody {
    pub channel_transaction_id: String,
}

impl From<ConfirmPaymentBody> for ConfirmPaymentCommand {
    fn from(value: ConfirmPaymentBody) -> Self {
        Self {
            channel_transaction_id: value.channel_transaction_id,
        }
    }
}
