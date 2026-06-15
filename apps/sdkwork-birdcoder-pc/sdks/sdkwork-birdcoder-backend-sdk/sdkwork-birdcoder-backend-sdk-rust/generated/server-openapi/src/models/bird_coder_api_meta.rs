use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderApiMeta {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page: Option<i64>,

    #[serde(rename = "pageSize")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page_size: Option<i64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total: Option<i64>,

    pub version: String,
}
