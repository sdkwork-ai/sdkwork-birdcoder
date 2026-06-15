use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderCodingSessionCheckpoint};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionCheckpointListEnvelope {
    pub items: Vec<BirdCoderCodingSessionCheckpoint>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
