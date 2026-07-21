use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderChatMessageReasoningItem, BirdCoderChatMessageResource, BirdCoderNativeSessionCommand};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderNativeSessionMessage {
    pub id: String,

    #[serde(rename = "codingSessionId")]
    pub coding_session_id: String,

    #[serde(rename = "turnId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,

    pub role: String,

    pub content: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub commands: Option<Vec<BirdCoderNativeSessionCommand>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<std::collections::HashMap<String, serde_json::Value>>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,

    #[serde(rename = "fileChanges")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_changes: Option<Vec<serde_json::Value>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reasoning: Option<Vec<BirdCoderChatMessageReasoningItem>>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resources: Option<Vec<BirdCoderChatMessageResource>>,

    #[serde(rename = "taskProgress")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_progress: Option<serde_json::Value>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<std::collections::HashMap<String, String>>,

    #[serde(rename = "createdAt")]
    pub created_at: String,
}
