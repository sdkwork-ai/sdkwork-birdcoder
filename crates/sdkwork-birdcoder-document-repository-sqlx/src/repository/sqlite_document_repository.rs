use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use sdkwork_birdcoder_document_service::domain::models::DocumentPayload;
use sdkwork_birdcoder_document_service::service::document_service::DocumentRepository;

#[derive(Clone)]
pub struct SqliteDocumentRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteDocumentRepository {
    pub fn new(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }
}

impl DocumentRepository for SqliteDocumentRepository {
    fn list_documents(
        &self,
        project_id: Option<&str>,
        tenant_id: Option<&str>,
    ) -> Result<Vec<DocumentPayload>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tenant_id = tenant_id
            .and_then(|value| value.parse::<i64>().ok())
            .filter(|value| *value > 0);
        let mut sql = String::from(
            "SELECT id, uuid, tenant_id, organization_id, created_at, updated_at, project_id, document_kind, title, slug, body_ref, status \
             FROM studio_project_document WHERE (?1 IS NULL OR project_id = ?1) AND is_deleted = 0",
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> =
            vec![Box::new(project_id.map(str::to_string))];
        if let Some(tenant_id) = tenant_id {
            sql.push_str(&format!(" AND tenant_id = ?{}", params.len() + 1));
            params.push(Box::new(tenant_id));
        }
        sql.push_str(" ORDER BY created_at DESC");

        let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let rows = stmt
            .query_map(params_ref.as_slice(), |row| {
                Ok(DocumentPayload {
                    id: row.get(0)?,
                    uuid: row.get::<_, Option<String>>(1)?,
                    tenant_id: row.get::<_, Option<i64>>(2)?.map(|v| v.to_string()),
                    organization_id: row.get::<_, Option<i64>>(3)?.map(|v| v.to_string()),
                    created_at: row.get::<_, Option<String>>(4)?,
                    updated_at: row.get::<_, Option<String>>(5)?,
                    project_id: row.get(6)?,
                    document_kind: row.get(7)?,
                    title: row.get(8)?,
                    slug: row.get(9)?,
                    body_ref: row.get(10)?,
                    status: row.get(11)?,
                })
            })
            .map_err(|e| e.to_string())?;

        rows.collect::<Result<Vec<DocumentPayload>, _>>()
            .map_err(|e: rusqlite::Error| e.to_string())
    }

    fn find_document_by_id(
        &self,
        document_id: &str,
        tenant_id: Option<&str>,
    ) -> Result<Option<DocumentPayload>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let tenant_id = tenant_id
            .and_then(|value| value.parse::<i64>().ok())
            .filter(|value| *value > 0);
        let mut sql = String::from(
            "SELECT id, uuid, tenant_id, organization_id, created_at, updated_at, project_id, document_kind, title, slug, body_ref, status \
             FROM studio_project_document WHERE id = ?1 AND is_deleted = 0",
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> =
            vec![Box::new(document_id.to_string())];
        if let Some(tenant_id) = tenant_id {
            sql.push_str(&format!(" AND tenant_id = ?{}", params.len() + 1));
            params.push(Box::new(tenant_id));
        }

        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let result = conn.query_row(&sql, params_ref.as_slice(), |row| {
            Ok(DocumentPayload {
                id: row.get(0)?,
                uuid: row.get::<_, Option<String>>(1)?,
                tenant_id: row.get::<_, Option<i64>>(2)?.map(|v| v.to_string()),
                organization_id: row.get::<_, Option<i64>>(3)?.map(|v| v.to_string()),
                created_at: row.get::<_, Option<String>>(4)?,
                updated_at: row.get::<_, Option<String>>(5)?,
                project_id: row.get(6)?,
                document_kind: row.get(7)?,
                title: row.get(8)?,
                slug: row.get(9)?,
                body_ref: row.get(10)?,
                status: row.get(11)?,
            })
        });

        match result {
            Ok(doc) => Ok(Some(doc)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.to_string()),
        }
    }
}
