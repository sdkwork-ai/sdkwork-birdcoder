use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderCoreRuntimeSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCoreRuntimeSummaryEnvelope {
    pub data: BirdCoderCoreRuntimeSummary,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
