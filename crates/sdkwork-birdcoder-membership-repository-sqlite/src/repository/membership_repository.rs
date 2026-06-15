use rusqlite::Connection;

use crate::db::columns;
use crate::db::rows::{MembershipBenefitRow, MembershipPackageRow, MembershipRow, PackageGroupRow};
use crate::error::RepositoryError;

pub fn get_current_membership(
    conn: &Connection,
    owner_user_id: &str,
) -> Result<MembershipRow, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE owner_user_id = ?1 AND is_deleted = 0 ORDER BY created_at DESC LIMIT 1",
        ALL_MEMBERSHIP_COLUMNS,
        columns::membership::TABLE,
    );
    conn.query_row(&sql, [owner_user_id], |row| MembershipRow::from_row(row))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                RepositoryError::NotFound(format!(
                    "membership for user {owner_user_id} not found"
                ))
            }
            other => RepositoryError::Database(other.to_string()),
        })
}

pub fn list_membership_benefits(
    conn: &Connection,
    membership_id: &str,
) -> Result<Vec<MembershipBenefitRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE membership_id = ?1 AND is_deleted = 0",
        ALL_BENEFIT_COLUMNS,
        columns::membership_benefit::TABLE,
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([membership_id], |row| MembershipBenefitRow::from_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn list_package_groups(conn: &Connection) -> Result<Vec<PackageGroupRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE is_deleted = 0 ORDER BY sort_weight",
        ALL_GROUP_COLUMNS,
        columns::package_group::TABLE,
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([], |row| PackageGroupRow::from_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn list_packages_by_group(
    conn: &Connection,
    group_id: &str,
) -> Result<Vec<MembershipPackageRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE group_id = ?1 AND is_deleted = 0 ORDER BY sort_weight",
        ALL_PACKAGE_COLUMNS,
        columns::membership_package::TABLE,
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([group_id], |row| MembershipPackageRow::from_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn list_all_packages(conn: &Connection) -> Result<Vec<MembershipPackageRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE is_deleted = 0 ORDER BY sort_weight",
        ALL_PACKAGE_COLUMNS,
        columns::membership_package::TABLE,
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([], |row| MembershipPackageRow::from_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

const ALL_MEMBERSHIP_COLUMNS: &str =
    "id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, owner_user_id, plan_id, plan_name, status, started_at, expires_at, remaining_days, total_days, total_spent, points, growth_value, upgrade_growth_value";

const ALL_BENEFIT_COLUMNS: &str =
    "id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, membership_id, name, benefit_key, benefit_type, description, icon, claimed, usage_limit, used_count";

const ALL_GROUP_COLUMNS: &str =
    "id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, name, description, sort_weight";

const ALL_PACKAGE_COLUMNS: &str =
    "id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, group_id, name, description, price, original_price, point_amount, duration_days, plan_name, sort_weight, recommended";
