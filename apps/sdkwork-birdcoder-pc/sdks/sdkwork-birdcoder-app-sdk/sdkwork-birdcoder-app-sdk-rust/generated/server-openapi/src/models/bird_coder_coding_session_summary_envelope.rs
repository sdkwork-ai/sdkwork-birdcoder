use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderCodingSessionSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionSummaryEnvelope {
    pub data: BirdCoderCodingSessionSummary,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
