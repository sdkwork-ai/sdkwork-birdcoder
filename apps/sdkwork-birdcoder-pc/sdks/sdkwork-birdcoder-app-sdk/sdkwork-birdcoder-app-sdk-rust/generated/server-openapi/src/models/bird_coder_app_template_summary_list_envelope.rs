use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderAppTemplateSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderAppTemplateSummaryListEnvelope {
    pub items: Vec<BirdCoderAppTemplateSummary>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
