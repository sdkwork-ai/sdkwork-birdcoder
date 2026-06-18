use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderApiRouteCatalogEntry};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderApiRouteCatalogEntryListEnvelope {
    pub items: Vec<BirdCoderApiRouteCatalogEntry>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
