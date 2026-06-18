use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderSwitchProjectGitBranchRequest {
    #[serde(rename = "branchName")]
    pub branch_name: String,
}
