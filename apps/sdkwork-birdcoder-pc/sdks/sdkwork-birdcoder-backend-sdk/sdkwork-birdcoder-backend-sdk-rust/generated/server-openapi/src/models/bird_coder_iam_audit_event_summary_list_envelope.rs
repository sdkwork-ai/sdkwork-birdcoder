use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderIamAuditEventSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamAuditEventSummaryListEnvelope {
    pub items: Vec<BirdCoderIamAuditEventSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
