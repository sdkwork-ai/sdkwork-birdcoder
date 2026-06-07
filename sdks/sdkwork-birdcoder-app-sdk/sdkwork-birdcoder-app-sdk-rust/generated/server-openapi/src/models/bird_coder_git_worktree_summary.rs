use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderGitWorktreeSummary {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub head: Option<String>,

    pub id: String,

    #[serde(rename = "isCurrent")]
    pub is_current: bool,

    #[serde(rename = "isDetached")]
    pub is_detached: bool,

    #[serde(rename = "isLocked")]
    pub is_locked: bool,

    #[serde(rename = "isPrunable")]
    pub is_prunable: bool,

    pub label: String,

    #[serde(rename = "lockedReason")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub locked_reason: Option<String>,

    pub path: String,

    #[serde(rename = "prunableReason")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prunable_reason: Option<String>,
}
