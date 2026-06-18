use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderWorkspaceSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderWorkspaceSummaryListEnvelope {
    pub items: Vec<BirdCoderWorkspaceSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
