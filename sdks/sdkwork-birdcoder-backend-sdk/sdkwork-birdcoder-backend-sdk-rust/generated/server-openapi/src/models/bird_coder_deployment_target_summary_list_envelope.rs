use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderDeploymentTargetSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderDeploymentTargetSummaryListEnvelope {
    pub items: Vec<BirdCoderDeploymentTargetSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
