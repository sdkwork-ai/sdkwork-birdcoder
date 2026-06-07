use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderIamPermissionSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamPermissionSummaryListEnvelope {
    pub items: Vec<BirdCoderIamPermissionSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
