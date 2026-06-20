use crate::domain::models::{
    CommerceMembershipBenefitPayload, CommerceMembershipCurrentPayload,
    CommerceMembershipPackageGroupPayload,
};
use crate::error::MembershipError;
use sdkwork_utils_rust::is_blank;

// ── Repository trait ─────────────────────────────────────────────────

#[async_trait::async_trait]
pub trait MembershipRepository: Send + Sync {
    async fn find_current_membership(
        &self,
        tenant_id: Option<&str>,
        owner_user_id: &str,
    ) -> Result<Option<CommerceMembershipCurrentPayload>, String>;

    async fn list_package_groups(&self) -> Result<Vec<CommerceMembershipPackageGroupPayload>, String>;
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

    pub async fn get_current_membership(
        &self,
        tenant_id: Option<String>,
        organization_id: Option<String>,
        owner_user_id: &str,
    ) -> Result<CommerceMembershipCurrentPayload, MembershipError> {
        if is_blank(Some(owner_user_id)) {
            return Err(MembershipError::InvalidInput(
                "ownerUserId is required.".to_string(),
            ));
        }

        if let Some(existing) = self
            .repository
            .find_current_membership(tenant_id.as_deref(), owner_user_id)
            .await
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

    pub async fn list_package_groups(
        &self,
    ) -> Result<Vec<CommerceMembershipPackageGroupPayload>, MembershipError> {
        self.repository
            .list_package_groups()
            .await
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
