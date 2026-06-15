use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderNativeSessionProviderSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderNativeSessionProviderSummaryListEnvelope {
    pub items: Vec<BirdCoderNativeSessionProviderSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
