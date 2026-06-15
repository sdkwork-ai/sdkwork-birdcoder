use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderReleaseSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderReleaseSummaryListEnvelope {
    pub items: Vec<BirdCoderReleaseSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
