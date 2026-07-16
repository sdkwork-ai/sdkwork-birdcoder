use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderSwitchProjectGitBranchRequest {
    /// Verified project runtime-location identifier used for Git execution.
    #[serde(rename = "runtimeLocationId")]
    pub runtime_location_id: String,

    #[serde(rename = "branchName")]
    pub branch_name: String,
}
