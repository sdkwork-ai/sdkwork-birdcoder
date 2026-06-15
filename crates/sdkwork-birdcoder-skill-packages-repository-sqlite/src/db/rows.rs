use rusqlite::Row;

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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            slug: row.get("slug")?,
            source_uri: row.get("source_uri")?,
            status: row.get("status")?,
            manifest_json: row.get("manifest_json")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            skill_package_id: row.get("skill_package_id")?,
            version_label: row.get("version_label")?,
            manifest_json: row.get("manifest_json")?,
            status: row.get("status")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            skill_version_id: row.get("skill_version_id")?,
            capability_key: row.get("capability_key")?,
            description_text: row.get("description_text")?,
            payload_json: row.get("payload_json")?,
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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            uuid: row.get("uuid")?,
            tenant_id: row.get("tenant_id")?,
            organization_id: row.get("organization_id")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            version: row.get("version")?,
            is_deleted: row.get("is_deleted")?,
            scope_type: row.get("scope_type")?,
            scope_id: row.get("scope_id")?,
            skill_version_id: row.get("skill_version_id")?,
            status: row.get("status")?,
            installed_at: row.get("installed_at")?,
        })
    }
}
