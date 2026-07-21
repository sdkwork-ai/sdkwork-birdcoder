use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderChatMessageResourceCitation {
    #[serde(rename = "lineStart")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_start: Option<i64>,

    #[serde(rename = "lineEnd")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub line_end: Option<i64>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,

    #[serde(rename = "threadIds")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thread_ids: Option<Vec<String>>,
}
