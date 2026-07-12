use sqlx::{AnyPool, Row};

use sdkwork_birdcoder_document_service::domain::models::DocumentPayload;
use sdkwork_birdcoder_document_service::service::document_service::{
    DocumentListQuery, DocumentRepository,
};
use sdkwork_birdcoder_errors::require_scoped_tenant_id;
use sdkwork_birdcoder_project_service::pagination::clamp_list_page_size;
use sdkwork_birdcoder_sqlx_repository_pool::dialect::{any_sql, IS_NOT_DELETED};

#[derive(Clone)]
pub struct SqliteDocumentRepository {
    pool: AnyPool,
}

impl SqliteDocumentRepository {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }

    fn require_tenant_id(tenant_id: Option<&str>) -> Result<i64, String> {
        let Some(value) = tenant_id else {
            return Err("a valid tenant scope is required".to_owned());
        };
        require_scoped_tenant_id(value)
            .map_err(|_| "a valid tenant scope is required".to_owned())
    }

    fn map_row(row: &sqlx::any::AnyRow) -> Result<DocumentPayload, sqlx::Error> {
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
        query: &DocumentListQuery,
    ) -> Result<sdkwork_birdcoder_document_service::service::document_service::DocumentListPage, String> {
        let tenant_id = Self::require_tenant_id(tenant_id)?;
        let (offset, limit) = clamp_list_page_size(query.offset, query.page_size);
        let filter_sql = format!(
            " WHERE (?1 IS NULL OR project_id = ?1) AND {IS_NOT_DELETED} AND tenant_id = ?2"
        );

        let count_sql = format!(
            "SELECT COUNT(*) AS total FROM studio_project_document{filter_sql}"
        );
        let total = sqlx::query_scalar::<_, i64>(&any_sql(&count_sql))
            .bind(project_id)
            .bind(tenant_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| e.to_string())? as usize;

        let list_sql = format!(
            "SELECT id, uuid, tenant_id, organization_id, created_at, updated_at, project_id, document_kind, title, slug, body_ref, status \
             FROM studio_project_document{filter_sql} ORDER BY created_at DESC LIMIT ?3 OFFSET ?4"
        );

        let rows = sqlx::query(&any_sql(&list_sql))
            .bind(project_id)
            .bind(tenant_id)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        let items = rows
            .iter()
            .map(Self::map_row)
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        Ok(sdkwork_birdcoder_document_service::service::document_service::DocumentListPage {
            items,
            total,
        })
    }

    async fn find_document_by_id(
        &self,
        document_id: &str,
        tenant_id: Option<&str>,
    ) -> Result<Option<DocumentPayload>, String> {
        let tenant_id = Self::require_tenant_id(tenant_id)?;
        let sql = format!(
            "SELECT id, uuid, tenant_id, organization_id, created_at, updated_at, project_id, document_kind, title, slug, body_ref, status \
             FROM studio_project_document WHERE id = ?1 AND {IS_NOT_DELETED} AND tenant_id = ?2"
        );

        let row = sqlx::query(&any_sql(&sql))
            .bind(document_id)
            .bind(tenant_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| e.to_string())?;

        row.as_ref()
            .map(Self::map_row)
            .transpose()
            .map_err(|e| e.to_string())
    }
}
