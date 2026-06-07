use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiListMeta, BirdCoderModelCatalogEntry};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderModelCatalogEntryListEnvelope {
    pub items: Vec<BirdCoderModelCatalogEntry>,

    pub meta: BirdCoderApiListMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
