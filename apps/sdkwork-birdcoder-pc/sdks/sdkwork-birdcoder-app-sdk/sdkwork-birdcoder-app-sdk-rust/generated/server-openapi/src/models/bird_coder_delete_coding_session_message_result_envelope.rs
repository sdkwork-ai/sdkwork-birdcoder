use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderDeleteCodingSessionMessageResult};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderDeleteCodingSessionMessageResultEnvelope {
    pub data: BirdCoderDeleteCodingSessionMessageResult,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
