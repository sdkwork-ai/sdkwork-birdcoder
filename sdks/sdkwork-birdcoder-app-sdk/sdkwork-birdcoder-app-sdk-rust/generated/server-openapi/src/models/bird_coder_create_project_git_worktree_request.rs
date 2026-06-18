use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCreateProjectGitWorktreeRequest {
    #[serde(rename = "branchName")]
    pub branch_name: String,

    pub path: String,
}
