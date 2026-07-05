use sqlx::{AnyPool, Row};

use sdkwork_birdcoder_app_templates_service::domain::models::AppTemplatePayload;
use sdkwork_birdcoder_app_templates_service::service::app_template_service::AppTemplateRepository;

const SOFT_DELETE: &str = "is_deleted IS NOT TRUE";

#[derive(Clone)]
pub struct SqliteAppTemplateRepository {
    pool: AnyPool,
}

impl SqliteAppTemplateRepository {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl AppTemplateRepository for SqliteAppTemplateRepository {
    async fn list_templates(&self) -> Result<Vec<AppTemplatePayload>, String> {
        let sql = format!(
            r#"
            SELECT
                t.id,
                t.uuid,
                t.tenant_id,
                t.organization_id,
                t.created_at,
                t.updated_at,
                t.slug,
                t.name,
                t.category,
                t.status,
                v.id AS version_id,
                v.version_label,
                COALESCE(p.preset_key, '') AS preset_key,
                COALESCE(p.description_text, '') AS description_text
            FROM studio_app_template t
            INNER JOIN studio_app_template_version v
                ON v.app_template_id = t.id
                AND v.{SOFT_DELETE}
            LEFT JOIN studio_app_template_preset p
                ON p.app_template_version_id = v.id
                AND p.{SOFT_DELETE}
            WHERE t.{SOFT_DELETE}
                AND v.id = (
                    SELECT v2.id
                    FROM studio_app_template_version v2
                    WHERE v2.app_template_id = t.id
                        AND v2.{SOFT_DELETE}
                    ORDER BY v2.created_at DESC
                    LIMIT 1
                )
            ORDER BY t.slug
            LIMIT 200
            "#,
        );
        let rows = sqlx::query(&sql)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        let mut templates = Vec::with_capacity(rows.len());
        for row in rows {
            let version_id: String = row.try_get("version_id").map_err(|error| error.to_string())?;
            let target_profiles = list_target_profiles(&self.pool, &version_id).await?;
            templates.push(map_template_row(row, target_profiles)?);
        }

        Ok(templates)
    }

    async fn find_template_by_id(&self, template_id: &str) -> Result<Option<AppTemplatePayload>, String> {
        let sql = format!(
            r#"
            SELECT
                t.id,
                t.uuid,
                t.tenant_id,
                t.organization_id,
                t.created_at,
                t.updated_at,
                t.slug,
                t.name,
                t.category,
                t.status,
                v.id AS version_id,
                v.version_label,
                COALESCE(p.preset_key, '') AS preset_key,
                COALESCE(p.description_text, '') AS description_text
            FROM studio_app_template t
            INNER JOIN studio_app_template_version v
                ON v.app_template_id = t.id
                AND v.{SOFT_DELETE}
            LEFT JOIN studio_app_template_preset p
                ON p.app_template_version_id = v.id
                AND p.{SOFT_DELETE}
            WHERE t.{SOFT_DELETE}
                AND t.id = ?1
                AND v.id = (
                    SELECT v2.id
                    FROM studio_app_template_version v2
                    WHERE v2.app_template_id = t.id
                        AND v2.{SOFT_DELETE}
                    ORDER BY v2.created_at DESC
                    LIMIT 1
                )
            LIMIT 1
            "#,
        );
        let row = sqlx::query(&sql)
        .bind(template_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| error.to_string())?;

        let Some(row) = row else {
            return Ok(None);
        };

        let version_id: String = row.try_get("version_id").map_err(|error| error.to_string())?;
        let target_profiles = list_target_profiles(&self.pool, &version_id).await?;
        Ok(Some(map_template_row(row, target_profiles)?))
    }
}

async fn list_target_profiles(pool: &AnyPool, version_id: &str) -> Result<Vec<String>, String> {
    let sql = format!(
        r#"
        SELECT profile_key
        FROM studio_app_template_target_profile
        WHERE app_template_version_id = ?1
            AND {SOFT_DELETE}
        ORDER BY profile_key
        LIMIT 200
        "#,
    );
    let rows = sqlx::query(&sql)
    .bind(version_id)
    .fetch_all(pool)
    .await
    .map_err(|error| error.to_string())?;

    rows.iter()
        .map(|row| row.try_get::<String, _>("profile_key").map_err(|error| error.to_string()))
        .collect()
}

fn map_template_row(row: sqlx::any::AnyRow, target_profiles: Vec<String>) -> Result<AppTemplatePayload, String> {
    Ok(AppTemplatePayload {
        id: row.try_get("id").map_err(|error| error.to_string())?,
        uuid: row.try_get("uuid").ok(),
        tenant_id: row
            .try_get::<i64, _>("tenant_id")
            .ok()
            .map(|value| value.to_string()),
        organization_id: row
            .try_get::<i64, _>("organization_id")
            .ok()
            .map(|value| value.to_string()),
        created_at: row.try_get("created_at").ok(),
        updated_at: row.try_get("updated_at").ok(),
        slug: row.try_get("slug").map_err(|error| error.to_string())?,
        name: row.try_get("name").map_err(|error| error.to_string())?,
        description: row.try_get("description_text").unwrap_or_default(),
        icon: None,
        author: None,
        version_id: row.try_get("version_id").map_err(|error| error.to_string())?,
        version_label: row.try_get("version_label").map_err(|error| error.to_string())?,
        preset_key: row.try_get("preset_key").unwrap_or_default(),
        category: row.try_get("category").map_err(|error| error.to_string())?,
        tags: Vec::new(),
        target_profiles,
        downloads: None,
        stars: None,
        status: row.try_get("status").map_err(|error| error.to_string())?,
    })
}
