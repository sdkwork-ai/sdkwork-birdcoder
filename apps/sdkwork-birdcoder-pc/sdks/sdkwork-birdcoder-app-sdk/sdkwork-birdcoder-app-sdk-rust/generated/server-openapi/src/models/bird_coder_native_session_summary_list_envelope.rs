use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderNativeSessionSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderNativeSessionSummaryListEnvelope {
    pub items: Vec<BirdCoderNativeSessionSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
