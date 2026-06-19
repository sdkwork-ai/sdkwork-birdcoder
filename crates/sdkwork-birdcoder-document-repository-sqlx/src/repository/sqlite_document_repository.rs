use sqlx::{Row, SqlitePool};

use sdkwork_birdcoder_document_service::domain::models::DocumentPayload;
use sdkwork_birdcoder_document_service::service::document_service::DocumentRepository;

#[derive(Clone)]
pub struct SqliteDocumentRepository {
    pool: SqlitePool,
}

impl SqliteDocumentRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    fn map_row(row: &sqlx::sqlite::SqliteRow) -> Result<DocumentPayload, sqlx::Error> {
        Ok(DocumentPayload {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            tenant_id: row
                .try_get::<Option<i64>, _>("tenant_id")?
                .map(|value| value.to_string()),
            organization_id: row
                .try_get::<Option<i64>, _>("organization_id")?
                .map(|value| value.to_string()),
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            project_id: row.try_get("project_id")?,
            document_kind: row.try_get("document_kind")?,
            title: row.try_get("title")?,
            slug: row.try_get("slug")?,
            body_ref: row.try_get("body_ref")?,
            status: row.try_get("status")?,
        })
    }
}

#[async_trait::async_trait]
impl DocumentRepository for SqliteDocumentRepository {
    async fn list_documents(
        &self,
        project_id: Option<&str>,
        tenant_id: Option<&str>,
    ) -> Result<Vec<DocumentPayload>, String> {
        let tenant_id = tenant_id
            .and_then(|value| value.parse::<i64>().ok())
            .filter(|value| *value > 0);
        let mut sql = String::from(
            "SELECT id, uuid, tenant_id, organization_id, created_at, updated_at, project_id, document_kind, title, slug, body_ref, status \
             FROM studio_project_document WHERE (?1 IS NULL OR project_id = ?1) AND is_deleted = 0",
        );
        if tenant_id.is_some() {
            sql.push_str(" AND tenant_id = ?2");
        }
        sql.push_str(" ORDER BY created_at DESC");

        let rows = if let Some(tenant_id) = tenant_id {
            sqlx::query(&sql)
                .bind(project_id)
                .bind(tenant_id)
                .fetch_all(&self.pool)
                .await
        } else {
            sqlx::query(&sql)
                .bind(project_id)
                .fetch_all(&self.pool)
                .await
        }
        .map_err(|e| e.to_string())?;

        rows.iter()
            .map(Self::map_row)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())
    }

    async fn find_document_by_id(
        &self,
        document_id: &str,
        tenant_id: Option<&str>,
    ) -> Result<Option<DocumentPayload>, String> {
        let tenant_id = tenant_id
            .and_then(|value| value.parse::<i64>().ok())
            .filter(|value| *value > 0);
        let mut sql = String::from(
            "SELECT id, uuid, tenant_id, organization_id, created_at, updated_at, project_id, document_kind, title, slug, body_ref, status \
             FROM studio_project_document WHERE id = ?1 AND is_deleted = 0",
        );
        if tenant_id.is_some() {
            sql.push_str(" AND tenant_id = ?2");
        }

        let row = if let Some(tenant_id) = tenant_id {
            sqlx::query(&sql)
                .bind(document_id)
                .bind(tenant_id)
                .fetch_optional(&self.pool)
                .await
        } else {
            sqlx::query(&sql)
                .bind(document_id)
                .fetch_optional(&self.pool)
                .await
        }
        .map_err(|e| e.to_string())?;

        row.as_ref()
            .map(Self::map_row)
            .transpose()
            .map_err(|e| e.to_string())
    }
}
