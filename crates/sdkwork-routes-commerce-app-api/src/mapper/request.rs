use serde::Deserialize;

use sdkwork_birdcoder_commerce_service::domain::models::{
    CommerceListQuery, ConfirmPaymentCommand, CreateOrderCommand, CreatePaymentCommand,
};
use sdkwork_birdcoder_project_service::pagination::clamp_list_page_size;

pub(crate) fn normalize_commerce_list_pagination(
    offset: Option<i64>,
    limit: Option<i64>,
) -> (usize, usize) {
    let offset_usize = offset.map(|value| value.max(0) as usize);
    let limit_usize = limit.map(|value| value.max(0) as usize);
    clamp_list_page_size(offset_usize, limit_usize)
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommerceListQueryParams {
    pub offset: Option<i64>,
    pub limit: Option<i64>,
}

impl CommerceListQueryParams {
    pub fn normalized_pagination(&self) -> (usize, usize) {
        normalize_commerce_list_pagination(self.offset, self.limit)
    }
}

impl From<CommerceListQueryParams> for CommerceListQuery {
    fn from(value: CommerceListQueryParams) -> Self {
        let (offset, limit) = value.normalized_pagination();
        Self {
            offset: i64::try_from(offset).unwrap_or(0),
            limit: i64::try_from(limit).unwrap_or(20),
        }
    }
}

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
