use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderGitBranchSummary {
    pub ahead: i64,

    pub behind: i64,

    #[serde(rename = "isCurrent")]
    pub is_current: bool,

    pub kind: String,

    pub name: String,

    #[serde(rename = "upstreamName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub upstream_name: Option<String>,
}
