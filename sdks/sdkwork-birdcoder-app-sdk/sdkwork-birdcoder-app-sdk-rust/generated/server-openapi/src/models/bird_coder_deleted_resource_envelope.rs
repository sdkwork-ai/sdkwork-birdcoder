use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderDeletedResourceResult};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderDeletedResourceEnvelope {
    pub data: BirdCoderDeletedResourceResult,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
