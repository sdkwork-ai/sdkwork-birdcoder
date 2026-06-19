use sqlx::SqlitePool;

use crate::db::columns;
use crate::db::rows::{MembershipPackageRow, MembershipRow, PackageGroupRow};
use crate::error::RepositoryError;

pub async fn get_current_membership(
    pool: &SqlitePool,
    tenant_id: Option<i64>,
    owner_user_id: &str,
) -> Result<MembershipRow, RepositoryError> {
    let mut sql = format!(
        "SELECT {} FROM {} WHERE owner_user_id = ?1 AND is_deleted = 0",
        ALL_MEMBERSHIP_COLUMNS,
        columns::membership::TABLE,
    );
    let scoped_tenant_id = tenant_id.filter(|value| *value > 0);
    if scoped_tenant_id.is_some() {
        sql.push_str(&format!(" AND {} = ?2", columns::membership::TENANT_ID));
    }
    sql.push_str(" ORDER BY created_at DESC LIMIT 1");

    let row = if let Some(tenant_id) = scoped_tenant_id {
        sqlx::query(&sql)
            .bind(owner_user_id)
            .bind(tenant_id)
            .fetch_optional(pool)
            .await?
    } else {
        sqlx::query(&sql)
            .bind(owner_user_id)
            .fetch_optional(pool)
            .await?
    };

    let Some(row) = row else {
        return Err(RepositoryError::NotFound(format!(
            "membership for user {owner_user_id} not found"
        )));
    };
    MembershipRow::from_row(&row).map_err(Into::into)
}

pub async fn list_package_groups(pool: &SqlitePool) -> Result<Vec<PackageGroupRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE is_deleted = 0 ORDER BY sort_weight",
        ALL_GROUP_COLUMNS,
        columns::package_group::TABLE,
    );
    let rows = sqlx::query(&sql).fetch_all(pool).await?;
    rows.iter()
        .map(PackageGroupRow::from_row)
        .collect::<Result<Vec<_>, _>>()
        .map_err(Into::into)
}

pub async fn list_packages_by_group(
    pool: &SqlitePool,
    group_id: &str,
) -> Result<Vec<MembershipPackageRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE group_id = ?1 AND is_deleted = 0 ORDER BY sort_weight",
        ALL_PACKAGE_COLUMNS,
        columns::membership_package::TABLE,
    );
    let rows = sqlx::query(&sql).bind(group_id).fetch_all(pool).await?;
    rows.iter()
        .map(MembershipPackageRow::from_row)
        .collect::<Result<Vec<_>, _>>()
        .map_err(Into::into)
}

const ALL_MEMBERSHIP_COLUMNS: &str =
    "id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, owner_user_id, plan_id, plan_name, status, started_at, expires_at, remaining_days, total_days, total_spent, points, growth_value, upgrade_growth_value";

const ALL_GROUP_COLUMNS: &str =
    "id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, name, description, sort_weight";

const ALL_PACKAGE_COLUMNS: &str =
    "id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, group_id, name, description, price, original_price, point_amount, duration_days, plan_name, sort_weight, recommended";
