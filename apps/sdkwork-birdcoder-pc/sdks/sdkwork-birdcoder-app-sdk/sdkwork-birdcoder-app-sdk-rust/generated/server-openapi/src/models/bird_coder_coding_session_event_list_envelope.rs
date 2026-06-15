use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderCodingSessionEvent};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionEventListEnvelope {
    pub items: Vec<BirdCoderCodingSessionEvent>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
