use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderIamApiKeySummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamApiKeySummaryListEnvelope {
    pub items: Vec<BirdCoderIamApiKeySummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
