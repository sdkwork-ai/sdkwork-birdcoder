use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderProjectPublishResult};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectPublishResultEnvelope {
    pub data: BirdCoderProjectPublishResult,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
