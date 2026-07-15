use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectGitDiff {
    pub patch: String,

    pub truncated: bool,
}
