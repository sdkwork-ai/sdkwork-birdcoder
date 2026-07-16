use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCommitProjectGitChangesRequest {
    /// Verified project runtime-location identifier used for Git execution.
    #[serde(rename = "runtimeLocationId")]
    pub runtime_location_id: String,

    #[serde(rename = "includeUnstaged")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub include_unstaged: Option<bool>,

    /// Required non-blank Git commit message.
    pub message: String,
}
