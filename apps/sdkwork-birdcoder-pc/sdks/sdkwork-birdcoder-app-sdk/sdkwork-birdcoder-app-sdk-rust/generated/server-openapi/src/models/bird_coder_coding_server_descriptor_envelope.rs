use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderCodingServerDescriptor};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingServerDescriptorEnvelope {
    pub data: BirdCoderCodingServerDescriptor,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
