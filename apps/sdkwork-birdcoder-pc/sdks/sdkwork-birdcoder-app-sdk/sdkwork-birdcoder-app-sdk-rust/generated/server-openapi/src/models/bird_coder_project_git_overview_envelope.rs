use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderApiMeta, BirdCoderProjectGitOverview};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectGitOverviewEnvelope {
    pub data: BirdCoderProjectGitOverview,

    pub meta: BirdCoderApiMeta,

    /// Server-generated request correlation identifier.
    #[serde(rename = "requestId")]
    pub request_id: String,

    /// Response emission timestamp.
    pub timestamp: String,
}
