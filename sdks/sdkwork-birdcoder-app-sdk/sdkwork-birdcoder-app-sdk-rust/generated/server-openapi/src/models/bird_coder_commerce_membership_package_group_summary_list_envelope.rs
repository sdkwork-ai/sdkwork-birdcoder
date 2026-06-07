use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderCommerceMembershipPackageGroupSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCommerceMembershipPackageGroupSummaryListEnvelope {
    pub items: Vec<BirdCoderCommerceMembershipPackageGroupSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
