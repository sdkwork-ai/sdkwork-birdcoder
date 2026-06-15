use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderCodingSessionArtifact};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionArtifactListEnvelope {
    pub items: Vec<BirdCoderCodingSessionArtifact>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
