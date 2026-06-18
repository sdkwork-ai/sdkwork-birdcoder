use rusqlite::Connection;

use crate::db::columns;
use crate::db::rows::{SkillCapabilityRow, SkillInstallationRow, SkillPackageRow, SkillVersionRow};
use crate::error::RepositoryError;

pub fn list_skill_packages(conn: &Connection) -> Result<Vec<SkillPackageRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE is_deleted = 0 ORDER BY slug",
        ALL_PACKAGE_COLUMNS,
        columns::skill_package::TABLE,
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([], |row| SkillPackageRow::from_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get_skill_package_by_id(
    conn: &Connection,
    id: &str,
) -> Result<SkillPackageRow, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE id = ?1 AND is_deleted = 0",
        ALL_PACKAGE_COLUMNS,
        columns::skill_package::TABLE,
    );
    conn.query_row(&sql, [id], |row| SkillPackageRow::from_row(row))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                RepositoryError::NotFound(format!("skill package {id} not found"))
            }
            other => RepositoryError::Database(other.to_string()),
        })
}

pub fn list_skill_versions_by_package(
    conn: &Connection,
    package_id: &str,
) -> Result<Vec<SkillVersionRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE skill_package_id = ?1 AND is_deleted = 0 ORDER BY created_at DESC",
        ALL_VERSION_COLUMNS,
        columns::skill_version::TABLE,
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([package_id], |row| SkillVersionRow::from_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn list_skill_capabilities_by_version(
    conn: &Connection,
    version_id: &str,
) -> Result<Vec<SkillCapabilityRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE skill_version_id = ?1 AND is_deleted = 0",
        ALL_CAPABILITY_COLUMNS,
        columns::skill_capability::TABLE,
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([version_id], |row| SkillCapabilityRow::from_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn list_all_skill_capabilities(
    conn: &Connection,
) -> Result<Vec<SkillCapabilityRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE is_deleted = 0",
        ALL_CAPABILITY_COLUMNS,
        columns::skill_capability::TABLE,
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([], |row| SkillCapabilityRow::from_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn list_skill_installations(
    conn: &Connection,
) -> Result<Vec<SkillInstallationRow>, RepositoryError> {
    let sql = format!(
        "SELECT {} FROM {} WHERE is_deleted = 0",
        ALL_INSTALLATION_COLUMNS,
        columns::skill_installation::TABLE,
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map([], |row| SkillInstallationRow::from_row(row))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn insert_skill_installation(
    conn: &Connection,
    row: &SkillInstallationRow,
) -> Result<(), RepositoryError> {
    let sql = format!(
        "INSERT INTO {} (id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, scope_type, scope_id, skill_version_id, status, installed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        columns::skill_installation::TABLE,
    );
    conn.execute(
        &sql,
        rusqlite::params![
            row.id,
            row.uuid,
            row.tenant_id,
            row.organization_id,
            row.created_at,
            row.updated_at,
            row.version,
            row.is_deleted,
            row.scope_type,
            row.scope_id,
            row.skill_version_id,
            row.status,
            row.installed_at,
        ],
    )?;
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

pub fn find_skill_installation_for_scope(
    conn: &Connection,
    scope_type: &str,
    scope_id: &str,
    package_id: &str,
) -> Result<Option<(SkillInstallationRow, String)>, RepositoryError> {
    let installation_columns = ALL_INSTALLATION_COLUMNS
        .split(", ")
        .map(|column| format!("i.{column}"))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "SELECT {installation_columns}, v.skill_package_id \
         FROM {} i \
         INNER JOIN {} v ON v.id = i.skill_version_id \
         WHERE i.scope_type = ?1 AND i.scope_id = ?2 AND v.skill_package_id = ?3 \
           AND i.is_deleted = 0 AND v.is_deleted = 0 \
         ORDER BY i.installed_at DESC LIMIT 1",
        columns::skill_installation::TABLE,
        columns::skill_version::TABLE,
    );
    let result = conn.query_row(&sql, [scope_type, scope_id, package_id], |row| {
        let installation = SkillInstallationRow {
            id: row.get(0)?,
            uuid: row.get(1)?,
            tenant_id: row.get(2)?,
            organization_id: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
            version: row.get(6)?,
            is_deleted: row.get(7)?,
            scope_type: row.get(8)?,
            scope_id: row.get(9)?,
            skill_version_id: row.get(10)?,
            status: row.get(11)?,
            installed_at: row.get(12)?,
        };
        Ok((installation, row.get(13)?))
    });
    match result {
        Ok(value) => Ok(Some(value)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(other) => Err(RepositoryError::Database(other.to_string())),
    }
}

pub fn scope_exists(conn: &Connection, scope_type: &str, scope_id: &str) -> Result<bool, RepositoryError> {
    let table = if scope_type == "workspace" {
        "studio_workspace"
    } else if scope_type == "project" {
        "studio_project"
    } else {
        return Ok(false);
    };
    let sql = format!("SELECT 1 FROM {table} WHERE id = ?1 AND is_deleted = 0 LIMIT 1");
    let result = conn.query_row(&sql, [scope_id], |_| Ok(()));
    match result {
        Ok(()) => Ok(true),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(false),
        Err(other) => Err(RepositoryError::Database(other.to_string())),
    }
}
