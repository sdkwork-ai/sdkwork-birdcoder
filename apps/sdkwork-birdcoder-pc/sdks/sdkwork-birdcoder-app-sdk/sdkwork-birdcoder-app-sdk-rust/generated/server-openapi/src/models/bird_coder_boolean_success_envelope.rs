use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderBooleanSuccessResult};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderBooleanSuccessEnvelope {
    pub data: BirdCoderBooleanSuccessResult,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
