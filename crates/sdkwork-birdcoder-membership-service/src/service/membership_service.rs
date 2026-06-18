use crate::domain::models::{
    CommerceMembershipBenefitPayload, CommerceMembershipCurrentPayload,
    CommerceMembershipPackageGroupPayload,
};
use crate::error::MembershipError;

// ── Repository trait ─────────────────────────────────────────────────

pub trait MembershipRepository: Send + Sync {
    fn find_current_membership(
        &self,
        tenant_id: Option<&str>,
        owner_user_id: &str,
    ) -> Result<Option<CommerceMembershipCurrentPayload>, String>;

    fn list_package_groups(&self) -> Result<Vec<CommerceMembershipPackageGroupPayload>, String>;
}

// ── Service ──────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct MembershipService<R: MembershipRepository> {
    repository: R,
}

impl<R: MembershipRepository> MembershipService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn get_current_membership(
        &self,
        tenant_id: Option<String>,
        organization_id: Option<String>,
        owner_user_id: &str,
    ) -> Result<CommerceMembershipCurrentPayload, MembershipError> {
        if owner_user_id.trim().is_empty() {
            return Err(MembershipError::InvalidInput(
                "ownerUserId is required.".to_string(),
            ));
        }

        if let Some(existing) = self
            .repository
            .find_current_membership(
                tenant_id.as_deref(),
                owner_user_id,
            )
            .map_err(MembershipError::Repository)?
        {
            return Ok(existing);
        }

        Ok(build_default_membership(
            tenant_id,
            organization_id,
            owner_user_id.to_string(),
        ))
    }

    pub fn list_package_groups(
        &self,
    ) -> Result<Vec<CommerceMembershipPackageGroupPayload>, MembershipError> {
        self.repository
            .list_package_groups()
            .map_err(MembershipError::Repository)
    }
}

fn build_default_membership(
    tenant_id: Option<String>,
    organization_id: Option<String>,
    owner_user_id: String,
) -> CommerceMembershipCurrentPayload {
    CommerceMembershipCurrentPayload {
        tenant_id,
        organization_id,
        owner_user_id,
        plan_id: None,
        plan_name: "Free".to_owned(),
        status: "inactive".to_owned(),
        started_at: None,
        expires_at: None,
        remaining_days: "0".to_owned(),
        total_days: "0".to_owned(),
        total_spent: "0".to_owned(),
        points: "0".to_owned(),
        growth_value: "0".to_owned(),
        upgrade_growth_value: "0".to_owned(),
        benefits: Vec::<CommerceMembershipBenefitPayload>::new(),
    }
}
