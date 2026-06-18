use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateProjectGitBranchRequest {
    #[serde(rename = "branchName")]
    pub branch_name: String,
}
