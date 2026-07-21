use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderChatMessageResourceCitation, BirdCoderChatMessageResourceOrigin};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderChatMessageResource {
    pub id: String,

    pub kind: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub uri: Option<String>,

    #[serde(rename = "mediaSource")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub media_source: Option<String>,

    #[serde(rename = "mimeType")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mime_type: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub origin: Option<BirdCoderChatMessageResourceOrigin>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub citation: Option<BirdCoderChatMessageResourceCitation>,
}
