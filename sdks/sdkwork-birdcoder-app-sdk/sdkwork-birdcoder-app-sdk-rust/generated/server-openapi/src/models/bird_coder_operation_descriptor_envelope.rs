use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderOperationDescriptor};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderOperationDescriptorEnvelope {
    pub data: BirdCoderOperationDescriptor,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
