use serde::Serialize;

// ── Membership benefit ───────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommerceMembershipBenefitPayload {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub benefit_key: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub claimed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_limit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub used_count: Option<String>,
}

// ── Membership current ───────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommerceMembershipCurrentPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,
    pub owner_user_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan_id: Option<String>,
    pub plan_name: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
    pub remaining_days: String,
    pub total_days: String,
    pub total_spent: String,
    pub points: String,
    pub growth_value: String,
    pub upgrade_growth_value: String,
    pub benefits: Vec<CommerceMembershipBenefitPayload>,
}

// ── Membership package ───────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommerceMembershipPackagePayload {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub price: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_price: Option<String>,
    pub point_amount: String,
    pub duration_days: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub plan_name: Option<String>,
    pub sort_weight: String,
    pub recommended: bool,
    pub tags: Vec<String>,
}

// ── Membership package group ─────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommerceMembershipPackageGroupPayload {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub sort_weight: String,
    pub packages: Vec<CommerceMembershipPackagePayload>,
}
