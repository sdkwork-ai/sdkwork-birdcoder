use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderCoreHealthSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCoreHealthSummaryEnvelope {
    pub data: BirdCoderCoreHealthSummary,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
