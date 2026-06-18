use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderInstallSkillPackageRequest {
    #[serde(rename = "scopeId")]
    pub scope_id: String,

    #[serde(rename = "scopeType")]
    pub scope_type: String,
}
