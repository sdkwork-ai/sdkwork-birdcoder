use sqlx::SqlitePool;
use time::format_description::well_known::Iso8601;
use uuid::Uuid;

use sdkwork_birdcoder_skill_packages_service::domain::models::{
    SkillInstallationPayload, SkillPackagePayload,
};
use sdkwork_birdcoder_skill_packages_service::service::skill_package_service::SkillPackageRepository;

use crate::db::rows::SkillInstallationRow;
use crate::repository::skill_package_repository;

#[derive(Clone)]
pub struct SqliteSkillPackageRepository {
    pool: SqlitePool,
}

impl SqliteSkillPackageRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    fn now_iso() -> String {
        time::OffsetDateTime::now_utc()
            .format(&Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
    }

    fn map_installation(row: SkillInstallationRow, package_id: String) -> SkillInstallationPayload {
        SkillInstallationPayload {
            id: row.id,
            uuid: row.uuid,
            tenant_id: Some(row.tenant_id.to_string()),
            organization_id: Some(row.organization_id.to_string()),
            created_at: Some(row.created_at),
            updated_at: Some(row.updated_at),
            package_id,
            scope_id: row.scope_id,
            scope_type: row.scope_type,
            status: row.status,
            version_id: row.skill_version_id,
            installed_at: row.installed_at,
        }
    }
}

#[async_trait::async_trait]
impl SkillPackageRepository for SqliteSkillPackageRepository {
    async fn list_packages(
        &self,
        _workspace_id: Option<&str>,
    ) -> Result<Vec<SkillPackagePayload>, String> {
        let rows = skill_package_repository::list_skill_packages(&self.pool)
            .await
            .map_err(|e| e.to_string())?;
        Ok(rows
            .into_iter()
            .map(|row| SkillPackagePayload {
                id: row.id,
                uuid: row.uuid,
                tenant_id: Some(row.tenant_id.to_string()),
                organization_id: Some(row.organization_id.to_string()),
                created_at: Some(row.created_at),
                updated_at: Some(row.updated_at),
                name: row.slug.clone(),
                slug: row.slug,
                description: String::new(),
                icon: None,
                author: None,
                version_id: String::new(),
                version_label: String::new(),
                install_count: None,
                long_description: None,
                source_uri: Some(row.source_uri),
                installed: false,
                skills: vec![],
            })
            .collect())
    }

    async fn find_latest_version(
        &self,
        package_id: &str,
    ) -> Result<Option<(String, String)>, String> {
        let versions = skill_package_repository::list_skill_versions_by_package(&self.pool, package_id)
            .await
            .map_err(|e| e.to_string())?;
        Ok(versions
            .first()
            .map(|version| (version.id.clone(), version.version_label.clone())))
    }

    async fn find_existing_installation(
        &self,
        scope_type: &str,
        scope_id: &str,
        package_id: &str,
    ) -> Result<Option<SkillInstallationPayload>, String> {
        let found = skill_package_repository::find_skill_installation_for_scope(
            &self.pool,
            scope_type,
            scope_id,
            package_id,
        )
        .await
        .map_err(|e| e.to_string())?;
        Ok(found.map(|(row, package_id)| Self::map_installation(row, package_id)))
    }

    async fn create_installation(
        &self,
        package_id: &str,
        version_id: &str,
        scope_type: &str,
        scope_id: &str,
    ) -> Result<SkillInstallationPayload, String> {
        let package = skill_package_repository::get_skill_package_by_id(&self.pool, package_id)
            .await
            .map_err(|e| e.to_string())?;
        let now = Self::now_iso();
        let row = SkillInstallationRow {
            id: Uuid::new_v4().to_string(),
            uuid: Some(Uuid::new_v4().to_string()),
            tenant_id: package.tenant_id,
            organization_id: package.organization_id,
            created_at: now.clone(),
            updated_at: now.clone(),
            version: 1,
            is_deleted: 0,
            scope_type: scope_type.to_string(),
            scope_id: scope_id.to_string(),
            skill_version_id: version_id.to_string(),
            status: "installed".to_string(),
            installed_at: now,
        };
        skill_package_repository::insert_skill_installation(&self.pool, &row)
            .await
            .map_err(|e| e.to_string())?;
        Ok(Self::map_installation(row, package_id.to_string()))
    }

    async fn scope_exists(&self, scope_type: &str, scope_id: &str) -> Result<bool, String> {
        skill_package_repository::scope_exists(&self.pool, scope_type, scope_id)
            .await
            .map_err(|e| e.to_string())
    }
}
