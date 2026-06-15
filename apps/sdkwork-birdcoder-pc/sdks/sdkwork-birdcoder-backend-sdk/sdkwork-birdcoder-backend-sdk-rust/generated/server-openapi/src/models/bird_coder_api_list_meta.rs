use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderApiListMeta {
    pub page: i64,

    #[serde(rename = "pageSize")]
    pub page_size: i64,

    pub total: i64,

    pub version: String,
}
