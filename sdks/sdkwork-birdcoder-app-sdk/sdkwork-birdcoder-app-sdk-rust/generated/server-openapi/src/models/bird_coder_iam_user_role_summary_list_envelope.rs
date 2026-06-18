use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderIamUserRoleSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamUserRoleSummaryListEnvelope {
    pub items: Vec<BirdCoderIamUserRoleSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
