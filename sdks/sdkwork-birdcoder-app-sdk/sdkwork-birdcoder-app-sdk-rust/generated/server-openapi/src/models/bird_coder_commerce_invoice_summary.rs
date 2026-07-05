use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCommerceInvoiceSummary {
    pub id: String,

    #[serde(rename = "invoiceNo")]
    pub invoice_no: String,

    #[serde(rename = "orderId")]
    pub order_id: String,

    #[serde(rename = "userId")]
    pub user_id: String,

    pub amount: String,

    pub tax: String,

    pub status: String,

    #[serde(rename = "issuedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub issued_at: Option<String>,

    #[serde(rename = "pdfUrl")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pdf_url: Option<String>,

    #[serde(rename = "createdAt")]
    pub created_at: String,

    #[serde(rename = "updatedAt")]
    pub updated_at: String,
}
