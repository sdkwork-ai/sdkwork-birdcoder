use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCommerceMembershipPackageSummary {
    pub id: String,

    pub name: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    pub price: String,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "originalPrice")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub original_price: Option<String>,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "pointAmount")]
    pub point_amount: String,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "durationDays")]
    pub duration_days: String,

    #[serde(rename = "planName")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan_name: Option<String>,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "sortWeight")]
    pub sort_weight: String,

    pub recommended: bool,

    pub tags: Vec<String>,
}
