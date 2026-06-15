use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderTeamSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderTeamSummaryListEnvelope {
    pub items: Vec<BirdCoderTeamSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
