use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderSubmitApprovalDecisionRequest {
    pub decision: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}
