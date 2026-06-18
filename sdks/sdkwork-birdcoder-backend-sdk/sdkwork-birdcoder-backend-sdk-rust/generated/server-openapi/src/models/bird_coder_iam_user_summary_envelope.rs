use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderIamUserSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamUserSummaryEnvelope {
    pub data: BirdCoderIamUserSummary,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
