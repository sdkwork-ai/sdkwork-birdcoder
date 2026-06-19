use sqlx::Row;

#[derive(Clone, Debug)]
pub struct SkillPackageRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub slug: String,
    pub source_uri: String,
    pub status: String,
    pub manifest_json: String,
}

impl SkillPackageRow {
    pub fn from_row(row: &sqlx::sqlite::SqliteRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row.try_get("is_deleted")?,
            slug: row.try_get("slug")?,
            source_uri: row.try_get("source_uri")?,
            status: row.try_get("status")?,
            manifest_json: row.try_get("manifest_json")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct SkillVersionRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub skill_package_id: String,
    pub version_label: String,
    pub manifest_json: String,
    pub status: String,
}

impl SkillVersionRow {
    pub fn from_row(row: &sqlx::sqlite::SqliteRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row.try_get("is_deleted")?,
            skill_package_id: row.try_get("skill_package_id")?,
            version_label: row.try_get("version_label")?,
            manifest_json: row.try_get("manifest_json")?,
            status: row.try_get("status")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct SkillCapabilityRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub skill_version_id: String,
    pub capability_key: String,
    pub description_text: String,
    pub payload_json: String,
}

impl SkillCapabilityRow {
    pub fn from_row(row: &sqlx::sqlite::SqliteRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row.try_get("is_deleted")?,
            skill_version_id: row.try_get("skill_version_id")?,
            capability_key: row.try_get("capability_key")?,
            description_text: row.try_get("description_text")?,
            payload_json: row.try_get("payload_json")?,
        })
    }
}

#[derive(Clone, Debug)]
pub struct SkillInstallationRow {
    pub id: String,
    pub uuid: Option<String>,
    pub tenant_id: i64,
    pub organization_id: i64,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub scope_type: String,
    pub scope_id: String,
    pub skill_version_id: String,
    pub status: String,
    pub installed_at: String,
}

impl SkillInstallationRow {
    pub fn from_row(row: &sqlx::sqlite::SqliteRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row.try_get("tenant_id")?,
            organization_id: row.try_get("organization_id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row.try_get("is_deleted")?,
            scope_type: row.try_get("scope_type")?,
            scope_id: row.try_get("scope_id")?,
            skill_version_id: row.try_get("skill_version_id")?,
            status: row.try_get("status")?,
            installed_at: row.try_get("installed_at")?,
        })
    }
}
