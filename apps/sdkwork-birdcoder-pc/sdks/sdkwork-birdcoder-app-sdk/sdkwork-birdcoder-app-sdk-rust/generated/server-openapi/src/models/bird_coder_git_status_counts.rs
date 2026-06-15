use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderGitStatusCounts {
    pub conflicted: i64,

    pub deleted: i64,

    pub modified: i64,

    pub staged: i64,

    pub untracked: i64,
}
