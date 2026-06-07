use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderIamTenantMemberSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamTenantMemberSummaryEnvelope {
    pub data: BirdCoderIamTenantMemberSummary,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
