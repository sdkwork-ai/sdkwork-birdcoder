use sqlx::SqlitePool;

use sdkwork_birdcoder_membership_service::domain::models::{
    CommerceMembershipCurrentPayload, CommerceMembershipPackageGroupPayload,
};
use sdkwork_birdcoder_membership_service::service::membership_service::MembershipRepository;

use super::membership_repository;

#[derive(Clone)]
pub struct SqliteMembershipRepository {
    pool: SqlitePool,
}

impl SqliteMembershipRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl MembershipRepository for SqliteMembershipRepository {
    async fn find_current_membership(
        &self,
        tenant_id: Option<&str>,
        owner_user_id: &str,
    ) -> Result<Option<CommerceMembershipCurrentPayload>, String> {
        let scoped_tenant_id = tenant_id
            .and_then(|value| value.parse::<i64>().ok())
            .filter(|value| *value > 0);
        match membership_repository::get_current_membership(&self.pool, scoped_tenant_id, owner_user_id)
            .await
        {
            Ok(row) => Ok(Some(CommerceMembershipCurrentPayload {
                tenant_id: Some(row.tenant_id.to_string()),
                organization_id: Some(row.organization_id.to_string()),
                owner_user_id: row.owner_user_id,
                plan_id: row.plan_id,
                plan_name: row.plan_name,
                status: row.status,
                started_at: row.started_at,
                expires_at: row.expires_at,
                remaining_days: row.remaining_days,
                total_days: row.total_days,
                total_spent: row.total_spent,
                points: row.points,
                growth_value: row.growth_value,
                upgrade_growth_value: row.upgrade_growth_value,
                benefits: vec![],
            })),
            Err(_) => Ok(None),
        }
    }

    async fn list_package_groups(&self) -> Result<Vec<CommerceMembershipPackageGroupPayload>, String> {
        let rows = membership_repository::list_package_groups(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(rows
            .into_iter()
            .map(|row| CommerceMembershipPackageGroupPayload {
                id: row.id,
                name: row.name,
                description: row.description,
                sort_weight: row.sort_weight,
                packages: vec![],
            })
            .collect())
    }
}
