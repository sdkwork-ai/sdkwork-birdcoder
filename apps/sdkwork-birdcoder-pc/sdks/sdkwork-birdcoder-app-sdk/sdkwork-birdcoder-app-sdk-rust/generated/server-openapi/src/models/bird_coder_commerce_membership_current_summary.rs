use serde::{Deserialize, Serialize};

use crate::models::{BirdCoderCommerceMembershipBenefitSummary};

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct BirdCoderCommerceMembershipCurrentSummary {
    #[serde(rename = "tenantId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,

    #[serde(rename = "organizationId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,

    #[serde(rename = "ownerUserId")]
    pub owner_user_id: String,

    #[serde(rename = "planId")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan_id: Option<String>,

    #[serde(rename = "planName")]
    pub plan_name: String,

    pub status: String,

    #[serde(rename = "startedAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,

    #[serde(rename = "expiresAt")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "remainingDays")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub remaining_days: Option<String>,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "totalDays")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub total_days: Option<String>,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "totalSpent")]
    pub total_spent: String,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    pub points: String,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "growthValue")]
    pub growth_value: String,

    /// Java Long/BIGINT value serialized as an exact decimal string.
    #[serde(rename = "upgradeGrowthValue")]
    pub upgrade_growth_value: String,

    pub benefits: Vec<BirdCoderCommerceMembershipBenefitSummary>,
}
