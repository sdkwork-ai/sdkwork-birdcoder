use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderProjectSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectSummaryEnvelope {
    pub data: BirdCoderProjectSummary,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
