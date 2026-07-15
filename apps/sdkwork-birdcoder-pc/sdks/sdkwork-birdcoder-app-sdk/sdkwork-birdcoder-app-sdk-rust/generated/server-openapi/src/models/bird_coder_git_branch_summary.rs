use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderGitBranchSummary {
    #[serde(rename = "isCurrent")]
    pub is_current: bool,

    #[serde(rename = "isRemote")]
    pub is_remote: bool,

    pub name: String,
}
