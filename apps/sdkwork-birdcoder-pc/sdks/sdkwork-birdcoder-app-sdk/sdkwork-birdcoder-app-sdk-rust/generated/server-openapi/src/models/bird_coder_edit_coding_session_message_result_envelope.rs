use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderEditCodingSessionMessageResult};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderEditCodingSessionMessageResultEnvelope {
    pub data: BirdCoderEditCodingSessionMessageResult,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
