use crate::db::rows::{MembershipBenefitRow, MembershipPackageRow, MembershipRow, PackageGroupRow};
use sdkwork_birdcoder_membership_service::domain::results::{
    CommerceMembershipBenefitPayload, CommerceMembershipCurrentPayload,
    CommerceMembershipPackageGroupPayload, CommerceMembershipPackagePayload,
};

fn i64_to_string(v: i64) -> String {
    v.to_string()
}

fn i64_to_bool(v: i64) -> bool {
    v != 0
}

pub fn membership_row_to_payload(
    row: &MembershipRow,
    benefits: &[MembershipBenefitRow],
) -> CommerceMembershipCurrentPayload {
    CommerceMembershipCurrentPayload {
        tenant_id: Some(i64_to_string(row.tenant_id)),
        organization_id: Some(i64_to_string(row.organization_id)),
        owner_user_id: row.owner_user_id.clone(),
        plan_id: row.plan_id.clone(),
        plan_name: row.plan_name.clone(),
        status: row.status.clone(),
        started_at: row.started_at.clone(),
        expires_at: row.expires_at.clone(),
        remaining_days: row.remaining_days.clone(),
        total_days: row.total_days.clone(),
        total_spent: row.total_spent.clone(),
        points: row.points.clone(),
        growth_value: row.growth_value.clone(),
        upgrade_growth_value: row.upgrade_growth_value.clone(),
        benefits: benefits.iter().map(benefit_row_to_payload).collect(),
    }
}

pub fn benefit_row_to_payload(row: &MembershipBenefitRow) -> CommerceMembershipBenefitPayload {
    CommerceMembershipBenefitPayload {
        id: row.id.clone(),
        name: row.name.clone(),
        benefit_key: row.benefit_key.clone(),
        r#type: row.benefit_type.clone(),
        description: row.description.clone(),
        icon: row.icon.clone(),
        claimed: i64_to_bool(row.claimed),
        usage_limit: row.usage_limit.clone(),
        used_count: row.used_count.clone(),
    }
}

pub fn package_group_row_to_payload(
    group: &PackageGroupRow,
    packages: &[MembershipPackageRow],
) -> CommerceMembershipPackageGroupPayload {
    CommerceMembershipPackageGroupPayload {
        id: group.id.clone(),
        name: group.name.clone(),
        description: group.description.clone(),
        sort_weight: group.sort_weight.clone(),
        packages: packages
            .iter()
            .filter(|p| p.group_id == group.id)
            .map(package_row_to_payload)
            .collect(),
    }
}

pub fn package_row_to_payload(row: &MembershipPackageRow) -> CommerceMembershipPackagePayload {
    CommerceMembershipPackagePayload {
        id: row.id.clone(),
        name: row.name.clone(),
        description: row.description.clone(),
        price: row.price.clone(),
        original_price: row.original_price.clone(),
        point_amount: row.point_amount.clone(),
        duration_days: row.duration_days.clone(),
        plan_name: row.plan_name.clone(),
        sort_weight: row.sort_weight.clone(),
        recommended: i64_to_bool(row.recommended),
        tags: Vec::new(),
    }
}
