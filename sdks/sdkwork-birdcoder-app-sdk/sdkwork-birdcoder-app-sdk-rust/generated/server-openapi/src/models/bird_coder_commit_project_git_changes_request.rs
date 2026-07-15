use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCommitProjectGitChangesRequest {
    #[serde(rename = "includeUnstaged")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub include_unstaged: Option<bool>,

    pub message: String,
}
