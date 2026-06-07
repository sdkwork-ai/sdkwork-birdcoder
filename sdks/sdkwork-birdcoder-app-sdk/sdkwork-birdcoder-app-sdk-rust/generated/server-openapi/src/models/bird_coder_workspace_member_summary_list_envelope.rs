use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderWorkspaceMemberSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderWorkspaceMemberSummaryListEnvelope {
    pub items: Vec<BirdCoderWorkspaceMemberSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
