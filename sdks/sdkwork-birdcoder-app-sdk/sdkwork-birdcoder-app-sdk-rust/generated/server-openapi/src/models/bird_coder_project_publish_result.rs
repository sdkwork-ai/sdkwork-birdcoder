use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderDeploymentRecordSummary, BirdCoderDeploymentTargetSummary, BirdCoderReleaseSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderProjectPublishResult {
    pub deployment: BirdCoderDeploymentRecordSummary,

    pub release: BirdCoderReleaseSummary,

    pub target: BirdCoderDeploymentTargetSummary,
}
