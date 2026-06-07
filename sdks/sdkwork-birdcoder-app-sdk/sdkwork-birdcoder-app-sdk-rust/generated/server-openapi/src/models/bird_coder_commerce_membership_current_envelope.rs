use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderCommerceMembershipCurrentSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCommerceMembershipCurrentEnvelope {
    pub data: BirdCoderCommerceMembershipCurrentSummary,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
