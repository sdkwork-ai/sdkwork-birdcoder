use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderNativeSessionCommand {
    pub command: String,

    pub status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,

    #[serde(rename = "toolName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,

    #[serde(rename = "toolCallId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,

    #[serde(rename = "runtimeStatus")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime_status: Option<String>,

    #[serde(rename = "requiresApproval")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requires_approval: Option<bool>,

    #[serde(rename = "requiresReply")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requires_reply: Option<bool>,
}
