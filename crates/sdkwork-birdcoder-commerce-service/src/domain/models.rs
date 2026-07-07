use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default)]
pub struct CommerceListQuery {
    pub offset: i64,
    pub limit: i64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommerceOrderPayload {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
    pub order_no: String,
    pub user_id: String,
    pub package_id: String,
    pub amount: String,
    pub currency: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paid_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refund_at: Option<String>,
    pub metadata: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommerceInvoicePayload {
    pub id: String,
    pub invoice_no: String,
    pub order_id: String,
    pub user_id: String,
    pub amount: String,
    pub tax: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub issued_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pdf_url: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommercePaymentPayload {
    pub id: String,
    pub payment_no: String,
    pub order_id: String,
    pub user_id: String,
    pub channel: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel_transaction_id: Option<String>,
    pub amount: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub paid_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refund_at: Option<String>,
    pub metadata: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateOrderCommand {
    pub package_id: String,
    pub amount: String,
    #[serde(default)]
    pub currency: Option<String>,
    #[serde(default)]
    pub workspace_id: Option<String>,
    #[serde(default)]
    pub metadata: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatePaymentCommand {
    pub order_id: String,
    pub channel: String,
    #[serde(default)]
    pub amount: Option<String>,
    #[serde(default)]
    pub channel_transaction_id: Option<String>,
    #[serde(default)]
    pub metadata: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfirmPaymentCommand {
    pub channel_transaction_id: String,
}
