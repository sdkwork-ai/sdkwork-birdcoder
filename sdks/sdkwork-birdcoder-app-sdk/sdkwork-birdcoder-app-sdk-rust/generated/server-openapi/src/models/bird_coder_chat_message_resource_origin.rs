use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderChatMessageResourceOrigin {
    pub kind: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uri: Option<String>,

    #[serde(rename = "clientName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_name: Option<String>,

    #[serde(rename = "lineStart")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_start: Option<i64>,

    #[serde(rename = "lineEnd")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_end: Option<i64>,

    #[serde(rename = "columnStart")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub column_start: Option<i64>,

    #[serde(rename = "columnEnd")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub column_end: Option<i64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub excerpt: Option<String>,
}
