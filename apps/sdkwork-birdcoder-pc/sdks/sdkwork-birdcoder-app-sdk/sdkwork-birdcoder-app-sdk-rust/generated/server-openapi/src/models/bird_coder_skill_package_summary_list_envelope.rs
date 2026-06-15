use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderSkillPackageSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderSkillPackageSummaryListEnvelope {
    pub items: Vec<BirdCoderSkillPackageSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
