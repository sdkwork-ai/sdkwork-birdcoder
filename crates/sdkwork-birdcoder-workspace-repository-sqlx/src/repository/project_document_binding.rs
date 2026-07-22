use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::document_binding::{
    NewProjectDocumentBinding, ProjectDocumentBindingPayload,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::document_binding_repository::ProjectDocumentBindingRepository;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_database_sqlx::DatabasePool;
use sdkwork_utils_rust::{datetime::now, id::uuid};
use sqlx::{FromRow, PgPool, SqlitePool};

#[derive(Clone)]
enum DocumentBindingPool {
    Postgres(PgPool),
    Sqlite(SqlitePool),
}

#[derive(Clone)]
pub struct SqlxProjectDocumentBindingRepository {
    pool: DocumentBindingPool,
    id_generator: SnowflakeIdGenerator,
}

#[derive(FromRow)]
struct DocumentBindingRecord {
    id: i64,
    uuid: String,
    project_id: i64,
    document_id: String,
    binding_kind: String,
    version: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, Copy)]
struct BindingScope {
    tenant_id: i64,
    organization_id: i64,
    user_id: i64,
    project_id: i64,
}

impl SqlxProjectDocumentBindingRepository {
    pub fn new(pool: DatabasePool, id_generator: SnowflakeIdGenerator) -> Self {
        let pool = match pool {
            DatabasePool::Postgres(pool, _) => DocumentBindingPool::Postgres(pool),
            DatabasePool::Sqlite(pool, _) => DocumentBindingPool::Sqlite(pool),
        };
        Self { pool, id_generator }
    }

    pub fn from_postgres(pool: PgPool, id_generator: SnowflakeIdGenerator) -> Self {
        Self {
            pool: DocumentBindingPool::Postgres(pool),
            id_generator,
        }
    }

    pub fn from_sqlite(pool: SqlitePool, id_generator: SnowflakeIdGenerator) -> Self {
        Self {
            pool: DocumentBindingPool::Sqlite(pool),
            id_generator,
        }
    }

    fn next_id(&self) -> Result<i64, ProjectError> {
        self.id_generator.generate().map_err(|error| {
            ProjectError::Internal(format!("Snowflake id generation failed: {error}"))
        })
    }

    async fn find_by_natural_key(
        &self,
        context: &ProjectContext,
        binding: &NewProjectDocumentBinding,
    ) -> Result<Option<ProjectDocumentBindingPayload>, ProjectError> {
        let scope = binding_scope(context, &binding.project_id)?;
        let record = match &self.pool {
            DocumentBindingPool::Sqlite(pool) => {
                sqlx::query_as::<_, DocumentBindingRecord>(SQLITE_SELECT_BY_NATURAL_KEY)
                    .bind(scope.project_id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .bind(scope.user_id)
                    .bind(&binding.document_id)
                    .bind(&binding.binding_kind)
                    .fetch_optional(pool)
                    .await
            }
            DocumentBindingPool::Postgres(pool) => {
                sqlx::query_as::<_, DocumentBindingRecord>(POSTGRES_SELECT_BY_NATURAL_KEY)
                    .bind(scope.project_id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .bind(&binding.document_id)
                    .bind(&binding.binding_kind)
                    .fetch_optional(pool)
                    .await
            }
        }
        .map_err(repository_error)?;
        Ok(record.map(DocumentBindingRecord::into_payload))
    }
}

#[async_trait::async_trait]
impl ProjectDocumentBindingRepository for SqlxProjectDocumentBindingRepository {
    async fn get_document_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
        binding_id: &str,
    ) -> Result<Option<ProjectDocumentBindingPayload>, ProjectError> {
        let scope = binding_scope(context, project_id)?;
        let binding_id = positive_id(binding_id, "binding_id")?;
        let record = match &self.pool {
            DocumentBindingPool::Sqlite(pool) => {
                sqlx::query_as::<_, DocumentBindingRecord>(SQLITE_SELECT_BINDING)
                    .bind(binding_id)
                    .bind(scope.project_id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .bind(scope.user_id)
                    .fetch_optional(pool)
                    .await
            }
            DocumentBindingPool::Postgres(pool) => {
                sqlx::query_as::<_, DocumentBindingRecord>(POSTGRES_SELECT_BINDING)
                    .bind(binding_id)
                    .bind(scope.project_id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .fetch_optional(pool)
                    .await
            }
        }
        .map_err(repository_error)?;
        Ok(record.map(DocumentBindingRecord::into_payload))
    }

    async fn list_document_bindings(
        &self,
        context: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectDocumentBindingPayload>, usize), ProjectError> {
        let scope = binding_scope(context, project_id)?;
        let offset = i64::try_from(offset)
            .map_err(|_| ProjectError::InvalidInput("offset is too large.".to_owned()))?;
        let limit = i64::try_from(limit.min(200))
            .map_err(|_| ProjectError::InvalidInput("limit is too large.".to_owned()))?;
        let (records, total) = match &self.pool {
            DocumentBindingPool::Sqlite(pool) => {
                let records = sqlx::query_as::<_, DocumentBindingRecord>(SQLITE_LIST_BINDINGS)
                    .bind(scope.project_id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .bind(scope.user_id)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(pool)
                    .await
                    .map_err(repository_error)?;
                let total = sqlx::query_scalar::<_, i64>(SQLITE_COUNT_BINDINGS)
                    .bind(scope.project_id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .bind(scope.user_id)
                    .fetch_one(pool)
                    .await
                    .map_err(repository_error)?;
                (records, total)
            }
            DocumentBindingPool::Postgres(pool) => {
                let records = sqlx::query_as::<_, DocumentBindingRecord>(POSTGRES_LIST_BINDINGS)
                    .bind(scope.project_id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(pool)
                    .await
                    .map_err(repository_error)?;
                let total = sqlx::query_scalar::<_, i64>(POSTGRES_COUNT_BINDINGS)
                    .bind(scope.project_id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .fetch_one(pool)
                    .await
                    .map_err(repository_error)?;
                (records, total)
            }
        };
        let total = usize::try_from(total)
            .map_err(|_| ProjectError::Internal("Binding count overflowed usize.".to_owned()))?;
        Ok((
            records
                .into_iter()
                .map(DocumentBindingRecord::into_payload)
                .collect(),
            total,
        ))
    }

    async fn upsert_document_binding(
        &self,
        context: &ProjectContext,
        binding: &NewProjectDocumentBinding,
    ) -> Result<ProjectDocumentBindingPayload, ProjectError> {
        if let Some(existing) = self.find_by_natural_key(context, binding).await? {
            return Ok(existing);
        }
        let scope = binding_scope(context, &binding.project_id)?;
        let id = self.next_id()?;
        let record_uuid = uuid();
        let timestamp = now().to_rfc3339();
        let result = match &self.pool {
            DocumentBindingPool::Sqlite(pool) => sqlx::query(SQLITE_INSERT_BINDING)
                .bind(id)
                .bind(&record_uuid)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.project_id)
                .bind(&binding.document_id)
                .bind(&binding.binding_kind)
                .bind(scope.user_id)
                .bind(&timestamp)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
            DocumentBindingPool::Postgres(pool) => sqlx::query(POSTGRES_INSERT_BINDING)
                .bind(id)
                .bind(&record_uuid)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.project_id)
                .bind(&binding.document_id)
                .bind(&binding.binding_kind)
                .bind(scope.user_id)
                .bind(&timestamp)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
        };
        match result {
            Ok(1) => self
                .get_document_binding(context, &binding.project_id, &id.to_string())
                .await?
                .ok_or_else(|| {
                    ProjectError::Internal("Created document binding was not readable.".to_owned())
                }),
            Ok(_) => Err(ProjectError::NotFound(
                "Project was not found in the authenticated write scope.".to_owned(),
            )),
            Err(error) if is_unique_violation(&error) => self
                .find_by_natural_key(context, binding)
                .await?
                .ok_or_else(|| ProjectError::Conflict("Document binding already exists.".to_owned())),
            Err(error) => Err(repository_error(error)),
        }
    }

    async fn delete_document_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
        binding_id: &str,
        expected_version: i64,
    ) -> Result<(), ProjectError> {
        let scope = binding_scope(context, project_id)?;
        let binding_id = positive_id(binding_id, "binding_id")?;
        let timestamp = now().to_rfc3339();
        let result = match &self.pool {
            DocumentBindingPool::Sqlite(pool) => sqlx::query(SQLITE_DELETE_BINDING)
                .bind(&timestamp)
                .bind(binding_id)
                .bind(scope.project_id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(expected_version)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
            DocumentBindingPool::Postgres(pool) => sqlx::query(POSTGRES_DELETE_BINDING)
                .bind(&timestamp)
                .bind(binding_id)
                .bind(scope.project_id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(expected_version)
                .bind(scope.user_id)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
        }
        .map_err(repository_error)?;
        if result == 0 {
            return Err(ProjectError::PreconditionFailed(
                "Document-binding version no longer matches If-Match.".to_owned(),
            ));
        }
        Ok(())
    }
}

impl DocumentBindingRecord {
    fn into_payload(self) -> ProjectDocumentBindingPayload {
        ProjectDocumentBindingPayload {
            id: self.id.to_string(),
            uuid: self.uuid,
            project_id: self.project_id.to_string(),
            document_id: self.document_id,
            binding_kind: self.binding_kind,
            version: self.version.to_string(),
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

fn binding_scope(context: &ProjectContext, project_id: &str) -> Result<BindingScope, ProjectError> {
    Ok(BindingScope {
        tenant_id: positive_id(&context.tenant_id, "tenant_id")?,
        organization_id: non_negative_id(&context.organization_id, "organization_id")?,
        user_id: positive_id(&context.user_id, "user_id")?,
        project_id: positive_id(project_id, "project_id")?,
    })
}

fn positive_id(value: &str, field: &str) -> Result<i64, ProjectError> {
    let value = value
        .parse::<i64>()
        .map_err(|_| ProjectError::InvalidInput(format!("invalid {field}")))?;
    if value <= 0 {
        return Err(ProjectError::InvalidInput(format!("invalid {field}")));
    }
    Ok(value)
}

fn non_negative_id(value: &str, field: &str) -> Result<i64, ProjectError> {
    let value = value
        .parse::<i64>()
        .map_err(|_| ProjectError::InvalidInput(format!("invalid {field}")))?;
    if value < 0 {
        return Err(ProjectError::InvalidInput(format!("invalid {field}")));
    }
    Ok(value)
}

fn repository_error(error: sqlx::Error) -> ProjectError {
    ProjectError::Repository(error.to_string())
}

fn is_unique_violation(error: &sqlx::Error) -> bool {
    let message = error.to_string().to_ascii_lowercase();
    message.contains("unique") || message.contains("duplicate")
}

const SQLITE_SELECT_BINDING: &str = r#"
SELECT b.id, b.uuid, b.project_id, b.document_id, b.binding_kind, b.version,
       b.created_at, b.updated_at
FROM studio_project_document_binding b
JOIN studio_project p ON p.id = b.project_id AND p.is_deleted = 0
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE b.id = ? AND b.project_id = ? AND b.tenant_id = ? AND b.organization_id = ?
  AND b.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
"#;
const POSTGRES_SELECT_BINDING: &str = r#"
SELECT b.id, b.uuid::text AS uuid, b.project_id, b.document_id, b.binding_kind, b.version,
       b.created_at::text AS created_at, b.updated_at::text AS updated_at
FROM studio_project_document_binding b
JOIN studio_project p ON p.id = b.project_id AND p.is_deleted = FALSE
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = FALSE
WHERE b.id = $1 AND b.project_id = $2 AND b.tenant_id = $3 AND b.organization_id = $4
  AND b.is_deleted = FALSE
  AND (p.owner_user_id = $5 OR w.owner_user_id = $5 OR w.visibility = 'organization')
"#;
const SQLITE_SELECT_BY_NATURAL_KEY: &str = r#"
SELECT b.id, b.uuid, b.project_id, b.document_id, b.binding_kind, b.version,
       b.created_at, b.updated_at
FROM studio_project_document_binding b
JOIN studio_project p ON p.id = b.project_id AND p.is_deleted = 0
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE b.project_id = ? AND b.tenant_id = ? AND b.organization_id = ? AND b.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ?)
  AND b.document_id = ? AND b.binding_kind = ?
"#;
const POSTGRES_SELECT_BY_NATURAL_KEY: &str = r#"
SELECT b.id, b.uuid::text AS uuid, b.project_id, b.document_id, b.binding_kind, b.version,
       b.created_at::text AS created_at, b.updated_at::text AS updated_at
FROM studio_project_document_binding b
JOIN studio_project p ON p.id = b.project_id AND p.is_deleted = FALSE
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = FALSE
WHERE b.project_id = $1 AND b.tenant_id = $2 AND b.organization_id = $3 AND b.is_deleted = FALSE
  AND (p.owner_user_id = $4 OR w.owner_user_id = $4)
  AND b.document_id = $5 AND b.binding_kind = $6
"#;
const SQLITE_LIST_BINDINGS: &str = r#"
SELECT b.id, b.uuid, b.project_id, b.document_id, b.binding_kind, b.version,
       b.created_at, b.updated_at
FROM studio_project_document_binding b
JOIN studio_project p ON p.id = b.project_id AND p.is_deleted = 0
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE b.project_id = ? AND b.tenant_id = ? AND b.organization_id = ? AND b.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
ORDER BY b.created_at DESC, b.id DESC LIMIT ? OFFSET ?
"#;
const POSTGRES_LIST_BINDINGS: &str = r#"
SELECT b.id, b.uuid::text AS uuid, b.project_id, b.document_id, b.binding_kind, b.version,
       b.created_at::text AS created_at, b.updated_at::text AS updated_at
FROM studio_project_document_binding b
JOIN studio_project p ON p.id = b.project_id AND p.is_deleted = FALSE
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = FALSE
WHERE b.project_id = $1 AND b.tenant_id = $2 AND b.organization_id = $3 AND b.is_deleted = FALSE
  AND (p.owner_user_id = $4 OR w.owner_user_id = $4 OR w.visibility = 'organization')
ORDER BY b.created_at DESC, b.id DESC LIMIT $5 OFFSET $6
"#;
const SQLITE_COUNT_BINDINGS: &str = r#"
SELECT COUNT(*)
FROM studio_project_document_binding b
JOIN studio_project p ON p.id = b.project_id AND p.is_deleted = 0
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE b.project_id = ? AND b.tenant_id = ? AND b.organization_id = ? AND b.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
"#;
const POSTGRES_COUNT_BINDINGS: &str = r#"
SELECT COUNT(*)
FROM studio_project_document_binding b
JOIN studio_project p ON p.id = b.project_id AND p.is_deleted = FALSE
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = FALSE
WHERE b.project_id = $1 AND b.tenant_id = $2 AND b.organization_id = $3 AND b.is_deleted = FALSE
  AND (p.owner_user_id = $4 OR w.owner_user_id = $4 OR w.visibility = 'organization')
"#;
const SQLITE_INSERT_BINDING: &str = r#"
INSERT INTO studio_project_document_binding (
    id, uuid, tenant_id, organization_id, project_id, document_id, binding_kind,
    created_by_user_id, version, created_at, updated_at, is_deleted
)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, ?9, ?9, 0
FROM studio_project p
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE p.id = ?5 AND p.tenant_id = ?3 AND p.organization_id = ?4 AND p.is_deleted = 0
  AND (p.owner_user_id = ?8 OR w.owner_user_id = ?8)
"#;
const POSTGRES_INSERT_BINDING: &str = r#"
INSERT INTO studio_project_document_binding (
    id, uuid, tenant_id, organization_id, project_id, document_id, binding_kind,
    created_by_user_id, version, created_at, updated_at, is_deleted
)
SELECT $1, CAST($2 AS UUID), $3, $4, p.id, $6, $7, $8, 0,
       CAST($9 AS TIMESTAMPTZ), CAST($9 AS TIMESTAMPTZ), FALSE
FROM studio_project p
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = FALSE
WHERE p.id = $5 AND p.tenant_id = $3 AND p.organization_id = $4 AND p.is_deleted = FALSE
  AND (p.owner_user_id = $8 OR w.owner_user_id = $8)
"#;
const SQLITE_DELETE_BINDING: &str = r#"
UPDATE studio_project_document_binding SET is_deleted = 1, updated_at = ?, version = version + 1
WHERE id = ? AND project_id = ? AND tenant_id = ? AND organization_id = ?
  AND version = ? AND is_deleted = 0
  AND EXISTS (
    SELECT 1 FROM studio_project p
    JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
    WHERE p.id = studio_project_document_binding.project_id AND p.is_deleted = 0
      AND (p.owner_user_id = ? OR w.owner_user_id = ?)
  )
"#;
const POSTGRES_DELETE_BINDING: &str = r#"
UPDATE studio_project_document_binding SET is_deleted = TRUE,
    updated_at = CAST($1 AS TIMESTAMPTZ), version = version + 1
WHERE id = $2 AND project_id = $3 AND tenant_id = $4 AND organization_id = $5
  AND version = $6 AND is_deleted = FALSE
  AND EXISTS (
    SELECT 1 FROM studio_project p
    JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = FALSE
    WHERE p.id = studio_project_document_binding.project_id AND p.is_deleted = FALSE
      AND (p.owner_user_id = $7 OR w.owner_user_id = $7)
  )
"#;
