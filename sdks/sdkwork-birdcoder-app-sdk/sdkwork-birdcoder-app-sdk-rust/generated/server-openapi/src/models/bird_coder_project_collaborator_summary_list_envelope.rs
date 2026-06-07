use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderProjectCollaboratorSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectCollaboratorSummaryListEnvelope {
    pub items: Vec<BirdCoderProjectCollaboratorSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
