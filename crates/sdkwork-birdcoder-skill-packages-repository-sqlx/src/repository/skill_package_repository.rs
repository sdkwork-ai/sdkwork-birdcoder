use sqlx::{AnyPool, Row};

use sdkwork_birdcoder_sqlx_repository_pool::dialect::{any_sql, IS_NOT_DELETED, qualified_is_not_deleted};

use crate::db::columns;
use crate::db::rows::{SkillCapabilityRow, SkillInstallationRow, SkillPackageRow, SkillVersionRow};
use crate::error::RepositoryError;

const CATALOG_PAGE_LIMIT: i64 = 200;
const CAPABILITY_CATALOG_LIMIT: i64 = 500;

pub async fn count_skill_packages(pool: &AnyPool) -> Result<i64, RepositoryError> {
    let sql = format!(
        "SELECT COUNT(*) AS total FROM {} WHERE {IS_NOT_DELETED}",
        columns::skill_package::TABLE,
    );
    let row = sqlx::query(&any_sql(&sql)).fetch_one(pool).await?;
    row.try_get::<i64, _>("total").map_err(Into::into)
}

pub async fn list_skill_packages(
    pool: &AnyPool,
    offset: i64,
    limit: i64,
) -> Result<Vec<SkillPackageRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE {IS_NOT_DELETED} ORDER BY slug LIMIT ?1 OFFSET ?2",
        ALL_PACKAGE_COLUMNS,
        columns::skill_package::TABLE,
    );
    let rows = sqlx::query(&any_sql(&sql))
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;
    rows.iter()
        .map(SkillPackageRow::from_row)
        .collect::<Result<Vec<_>, _>>()
        .map_err(Into::into)
}

pub async fn get_skill_package_by_id(
    pool: &AnyPool,
    id: &str,
) -> Result<SkillPackageRow, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE id = ?1 AND {IS_NOT_DELETED}",
        ALL_PACKAGE_COLUMNS,
        columns::skill_package::TABLE,
    );
    let row = sqlx::query(&any_sql(&sql))
        .bind(id)
        .fetch_optional(pool)
        .await?;

    let Some(row) = row else {
        return Err(RepositoryError::NotFound(format!("skill package {id} not found")));
    };
    SkillPackageRow::from_row(&row).map_err(Into::into)
}

pub async fn list_skill_versions_by_package(
    pool: &AnyPool,
    package_id: &str,
) -> Result<Vec<SkillVersionRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE skill_package_id = ?1 AND {IS_NOT_DELETED} \
         ORDER BY created_at DESC LIMIT {CATALOG_PAGE_LIMIT}",
        ALL_VERSION_COLUMNS,
        columns::skill_version::TABLE,
    );
    let rows = sqlx::query(&any_sql(&sql)).bind(package_id).fetch_all(pool).await?;
    rows.iter()
        .map(SkillVersionRow::from_row)
        .collect::<Result<Vec<_>, _>>()
        .map_err(Into::into)
}

pub async fn list_skill_capabilities_by_version(
    pool: &AnyPool,
    version_id: &str,
) -> Result<Vec<SkillCapabilityRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE skill_version_id = ?1 AND {IS_NOT_DELETED} \
         LIMIT {CATALOG_PAGE_LIMIT}",
        ALL_CAPABILITY_COLUMNS,
        columns::skill_capability::TABLE,
    );
    let rows = sqlx::query(&any_sql(&sql)).bind(version_id).fetch_all(pool).await?;
    rows.iter()
        .map(SkillCapabilityRow::from_row)
        .collect::<Result<Vec<_>, _>>()
        .map_err(Into::into)
}

pub async fn list_all_skill_capabilities(
    pool: &AnyPool,
) -> Result<Vec<SkillCapabilityRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE {IS_NOT_DELETED} LIMIT {CAPABILITY_CATALOG_LIMIT}",
        ALL_CAPABILITY_COLUMNS,
        columns::skill_capability::TABLE,
    );
    let rows = sqlx::query(&any_sql(&sql)).fetch_all(pool).await?;
    rows.iter()
        .map(SkillCapabilityRow::from_row)
        .collect::<Result<Vec<_>, _>>()
        .map_err(Into::into)
}

pub async fn list_skill_installations(
    pool: &AnyPool,
) -> Result<Vec<SkillInstallationRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE {IS_NOT_DELETED} LIMIT {CATALOG_PAGE_LIMIT}",
        ALL_INSTALLATION_COLUMNS,
        columns::skill_installation::TABLE,
    );
    let rows = sqlx::query(&any_sql(&sql)).fetch_all(pool).await?;
    rows.iter()
        .map(SkillInstallationRow::from_row)
        .collect::<Result<Vec<_>, _>>()
        .map_err(Into::into)
}

pub async fn insert_skill_installation(
    pool: &AnyPool,
    row: &SkillInstallationRow,
) -> Result<(), RepositoryError> {
    let sql = format!(
        "INSERT INTO {} (id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, scope_type, scope_id, skill_version_id, status, installed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        columns::skill_installation::TABLE,
    );
    sqlx::query(&any_sql(&sql))
        .bind(&row.id)
        .bind(&row.uuid)
        .bind(row.tenant_id)
        .bind(row.organization_id)
        .bind(&row.created_at)
        .bind(&row.updated_at)
        .bind(row.version)
        .bind(row.is_deleted)
        .bind(&row.scope_type)
        .bind(&row.scope_id)
        .bind(&row.skill_version_id)
        .bind(&row.status)
        .bind(&row.installed_at)
        .execute(pool)
        .await?;
    Ok(())
}

const ALL_PACKAGE_COLUMNS: &str =
    "id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, slug, source_uri, status, manifest_json";

const ALL_VERSION_COLUMNS: &str =
    "id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, skill_package_id, version_label, manifest_json, status";

const ALL_CAPABILITY_COLUMNS: &str =
    "id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, skill_version_id, capability_key, description_text, payload_json";

const ALL_INSTALLATION_COLUMNS: &str =
    "id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, scope_type, scope_id, skill_version_id, status, installed_at";

pub async fn find_skill_installation_for_scope(
    pool: &AnyPool,
    scope_type: &str,
    scope_id: &str,
    package_id: &str,
) -> Result<Option<(SkillInstallationRow, String)>, RepositoryError> {
    let installation_columns = ALL_INSTALLATION_COLUMNS
        .split(", ")
        .map(|column| format!("i.{column}"))
        .collect::<Vec<_>>()
        .join(", ");
    let installation_deleted = qualified_is_not_deleted("i");
    let version_deleted = qualified_is_not_deleted("v");
    let sql = format!(
        "SELECT {installation_columns}, v.skill_package_id \
         FROM {} i \
         INNER JOIN {} v ON v.id = i.skill_version_id \
         WHERE i.scope_type = ?1 AND i.scope_id = ?2 AND v.skill_package_id = ?3 \
           AND {installation_deleted} AND {version_deleted} \
         ORDER BY i.installed_at DESC LIMIT 1",
        columns::skill_installation::TABLE,
        columns::skill_version::TABLE,
    );
    let row = sqlx::query(&any_sql(&sql))
        .bind(scope_type)
        .bind(scope_id)
        .bind(package_id)
        .fetch_optional(pool)
        .await?;

    let Some(row) = row else {
        return Ok(None);
    };
    let installation = SkillInstallationRow::from_row(&row)?;
    let package_id: String = row.try_get("skill_package_id")?;
    Ok(Some((installation, package_id)))
}

pub async fn scope_exists(
    pool: &AnyPool,
    scope_type: &str,
    scope_id: &str,
    tenant_id: i64,
) -> Result<bool, RepositoryError> {
    let table = if scope_type == "workspace" {
        "studio_workspace"
    } else if scope_type == "project" {
        "studio_project"
    } else {
        return Ok(false);
    };
    let sql = format!(
        "SELECT 1 FROM {table} WHERE id = ?1 AND tenant_id = ?2 AND {IS_NOT_DELETED} LIMIT 1"
    );
    let row = sqlx::query(&any_sql(&sql))
        .bind(scope_id)
        .bind(tenant_id)
        .fetch_optional(pool)
        .await?;
    Ok(row.is_some())
}
