use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderPushProjectGitBranchRequest {
    /// Verified project runtime-location identifier used for Git execution.
    #[serde(rename = "runtimeLocationId")]
    pub runtime_location_id: String,

    #[serde(rename = "branchName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch_name: Option<String>,

    #[serde(rename = "remoteName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remote_name: Option<String>,
}
