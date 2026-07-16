use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderCodingSessionTurnIdeContext, BirdCoderCodingSessionTurnOptions};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateCodingSessionTurnRequest {
    #[serde(rename = "runtimeId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime_id: Option<String>,

    #[serde(rename = "requestKind")]
    pub request_kind: String,

    #[serde(rename = "inputSummary")]
    pub input_summary: String,

    /// Whether the turn should stream message.delta events. Defaults to true.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,

    #[serde(rename = "ideContext")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ide_context: Option<BirdCoderCodingSessionTurnIdeContext>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub options: Option<BirdCoderCodingSessionTurnOptions>,
}
