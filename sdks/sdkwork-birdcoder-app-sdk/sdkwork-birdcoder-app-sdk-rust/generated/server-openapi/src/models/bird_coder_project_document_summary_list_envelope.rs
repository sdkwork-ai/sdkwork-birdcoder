use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderProjectDocumentSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectDocumentSummaryListEnvelope {
    pub items: Vec<BirdCoderProjectDocumentSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
