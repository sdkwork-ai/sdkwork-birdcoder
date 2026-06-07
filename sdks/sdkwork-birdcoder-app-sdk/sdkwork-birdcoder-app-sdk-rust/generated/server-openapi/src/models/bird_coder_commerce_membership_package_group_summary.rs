use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderCommerceMembershipPackageSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCommerceMembershipPackageGroupSummary {
    pub id: String,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "sortWeight")]
    pub sort_weight: String,

    pub packages: Vec<BirdCoderCommerceMembershipPackageSummary>,
}
