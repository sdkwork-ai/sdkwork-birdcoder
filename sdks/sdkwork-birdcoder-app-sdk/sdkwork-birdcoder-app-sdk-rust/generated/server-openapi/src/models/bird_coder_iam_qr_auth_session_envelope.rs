use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderIamQrAuthSessionSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamQrAuthSessionEnvelope {
    pub data: BirdCoderIamQrAuthSessionSummary,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
