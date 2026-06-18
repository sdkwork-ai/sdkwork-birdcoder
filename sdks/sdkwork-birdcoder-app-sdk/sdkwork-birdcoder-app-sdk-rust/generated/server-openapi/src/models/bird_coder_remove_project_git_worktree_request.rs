use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderRemoveProjectGitWorktreeRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub force: Option<bool>,

    pub path: String,
}
