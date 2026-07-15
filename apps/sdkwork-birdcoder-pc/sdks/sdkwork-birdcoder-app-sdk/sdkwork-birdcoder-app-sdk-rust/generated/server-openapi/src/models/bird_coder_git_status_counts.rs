use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderGitStatusCounts {
    pub staged: i64,

    pub unstaged: i64,

    pub untracked: i64,
}
