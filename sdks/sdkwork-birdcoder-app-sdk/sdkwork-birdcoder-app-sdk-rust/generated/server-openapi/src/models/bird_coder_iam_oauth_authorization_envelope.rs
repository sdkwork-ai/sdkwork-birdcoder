use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderIamOAuthAuthorizationSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamOAuthAuthorizationEnvelope {
    pub data: BirdCoderIamOAuthAuthorizationSummary,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
