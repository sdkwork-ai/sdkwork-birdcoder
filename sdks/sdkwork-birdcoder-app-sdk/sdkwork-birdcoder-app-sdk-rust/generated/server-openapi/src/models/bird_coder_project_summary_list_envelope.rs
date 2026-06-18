use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderProjectSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectSummaryListEnvelope {
    pub items: Vec<BirdCoderProjectSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
