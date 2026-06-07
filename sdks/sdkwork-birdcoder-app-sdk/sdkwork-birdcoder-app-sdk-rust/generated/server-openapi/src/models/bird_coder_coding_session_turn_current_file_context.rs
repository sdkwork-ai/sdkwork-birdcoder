use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCodingSessionTurnCurrentFileContext {
    pub path: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
}
