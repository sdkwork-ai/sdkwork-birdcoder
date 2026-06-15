use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCommerceMembershipBenefitSummary {
    pub id: String,

    pub name: String,

    #[serde(rename = "benefitKey")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub benefit_key: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,

    pub claimed: bool,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "usageLimit")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub usage_limit: Option<String>,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "usedCount")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub used_count: Option<String>,
}
