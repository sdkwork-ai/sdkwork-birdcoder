use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderCodingSessionTurn};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionTurnEnvelope {
    pub data: BirdCoderCodingSessionTurn,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
