use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderIamRolePermissionSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderIamRolePermissionSummaryListEnvelope {
    pub items: Vec<BirdCoderIamRolePermissionSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
