use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderApprovalDecisionResult {
    #[serde(rename = "approvalId")]
    pub approval_id: String,

    #[serde(rename = "checkpointId")]
    pub checkpoint_id: String,

    #[serde(rename = "codingSessionId")]
    pub coding_session_id: String,

    pub decision: String,

    #[serde(rename = "decidedAt")]
    pub decided_at: String,

    #[serde(rename = "operationId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub operation_id: Option<String>,

    #[serde(rename = "operationStatus")]
    pub operation_status: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,

    #[serde(rename = "runtimeId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime_id: Option<String>,

    #[serde(rename = "runtimeStatus")]
    pub runtime_status: String,

    #[serde(rename = "turnId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,
}
