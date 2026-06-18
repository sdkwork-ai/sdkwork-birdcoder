use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderTeamMemberSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderTeamMemberSummaryListEnvelope {
    pub items: Vec<BirdCoderTeamMemberSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
