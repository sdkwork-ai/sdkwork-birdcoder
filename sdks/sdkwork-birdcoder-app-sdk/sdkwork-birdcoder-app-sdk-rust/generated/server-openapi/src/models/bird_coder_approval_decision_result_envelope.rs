use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderApprovalDecisionResult};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderApprovalDecisionResultEnvelope {
    pub data: BirdCoderApprovalDecisionResult,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
