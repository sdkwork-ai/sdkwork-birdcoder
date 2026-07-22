use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_birdcoder_workspace_service::domain::commands::{
    CreateWorkspaceRequest, UpdateWorkspaceRequest,
};
use sdkwork_birdcoder_workspace_service::domain::models::WorkspaceScopedQuery;
use sdkwork_birdcoder_workspace_service::domain::results::WorkspacePayload;
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_birdcoder_workspace_service::ports::repository::WorkspaceRepository;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_database_sqlx::DatabasePool;
use sdkwork_utils_rust::{datetime::now, id::uuid};
use sqlx::{FromRow, PgPool, SqlitePool};

#[derive(Clone)]
enum WorkspacePool {
    Postgres(PgPool),
    Sqlite(SqlitePool),
}

#[derive(Clone)]
pub struct SqlxWorkspaceRepository {
    pool: WorkspacePool,
    id_generator: SnowflakeIdGenerator,
}

#[derive(FromRow)]
struct WorkspaceRecord {
    id: i64,
    uuid: String,
    tenant_id: i64,
    organization_id: i64,
    owner_user_id: i64,
    created_by_user_id: i64,
    code: String,
    name: String,
    description: Option<String>,
    icon_url: Option<String>,
    color: Option<String>,
    visibility: String,
    status: String,
    version: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, Copy)]
struct WorkspaceScope {
    tenant_id: i64,
    organization_id: i64,
    user_id: i64,
}

impl SqlxWorkspaceRepository {
    pub fn new(pool: DatabasePool, id_generator: SnowflakeIdGenerator) -> Self {
        let pool = match pool {
            DatabasePool::Postgres(pool, _) => WorkspacePool::Postgres(pool),
            DatabasePool::Sqlite(pool, _) => WorkspacePool::Sqlite(pool),
        };
        Self { pool, id_generator }
    }

    pub fn from_postgres(pool: PgPool, id_generator: SnowflakeIdGenerator) -> Self {
        Self {
            pool: WorkspacePool::Postgres(pool),
            id_generator,
        }
    }

    pub fn from_sqlite(pool: SqlitePool, id_generator: SnowflakeIdGenerator) -> Self {
        Self {
            pool: WorkspacePool::Sqlite(pool),
            id_generator,
        }
    }

    fn next_id(&self) -> Result<i64, WorkspaceError> {
        self.id_generator.generate().map_err(|error| {
            WorkspaceError::Internal(format!("Snowflake id generation failed: {error}"))
        })
    }
}

#[async_trait::async_trait]
impl WorkspaceRepository for SqlxWorkspaceRepository {
    async fn find_workspace_by_id(
        &self,
        context: &WorkspaceContext,
        id: &str,
    ) -> Result<Option<WorkspacePayload>, WorkspaceError> {
        let scope = workspace_scope(context)?;
        let id = positive_id(id, "workspace_id")?;
        let record = match &self.pool {
            WorkspacePool::Sqlite(pool) => {
                sqlx::query_as::<_, WorkspaceRecord>(SQLITE_SELECT_WORKSPACE)
                    .bind(id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .fetch_optional(pool)
                    .await
            }
            WorkspacePool::Postgres(pool) => {
                sqlx::query_as::<_, WorkspaceRecord>(POSTGRES_SELECT_WORKSPACE)
                    .bind(id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .fetch_optional(pool)
                    .await
            }
        }
        .map_err(repository_error)?;
        Ok(record.map(WorkspaceRecord::into_payload))
    }

    async fn list_workspaces(
        &self,
        context: &WorkspaceContext,
        query: &WorkspaceScopedQuery,
    ) -> Result<(Vec<WorkspacePayload>, usize), WorkspaceError> {
        let scope = workspace_scope(context)?;
        if query.user_id.as_deref().is_some_and(|value| value != context.user_id) {
            return Err(WorkspaceError::Forbidden(
                "Workspace listing is limited to the authenticated user.".to_owned(),
            ));
        }
        let (offset, limit) = query.pagination.normalize(20, 200);
        let (records, total) = match &self.pool {
            WorkspacePool::Sqlite(pool) => {
                let records = sqlx::query_as::<_, WorkspaceRecord>(SQLITE_LIST_WORKSPACES)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(pool)
                    .await
                    .map_err(repository_error)?;
                let total = sqlx::query_scalar::<_, i64>(SQLITE_COUNT_WORKSPACES)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .fetch_one(pool)
                    .await
                    .map_err(repository_error)?;
                (records, total)
            }
            WorkspacePool::Postgres(pool) => {
                let records = sqlx::query_as::<_, WorkspaceRecord>(POSTGRES_LIST_WORKSPACES)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(pool)
                    .await
                    .map_err(repository_error)?;
                let total = sqlx::query_scalar::<_, i64>(POSTGRES_COUNT_WORKSPACES)
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
            .map_err(|_| WorkspaceError::Internal("Workspace count overflowed usize.".to_owned()))?;
        Ok((
            records
                .into_iter()
                .map(WorkspaceRecord::into_payload)
                .collect(),
            total,
        ))
    }

    async fn create_workspace(
        &self,
        context: &WorkspaceContext,
        request: &CreateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        let scope = workspace_scope(context)?;
        let id = self.next_id()?;
        let code = request
            .code
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| format!("workspace-{id}"));
        let visibility = request.visibility.as_deref().unwrap_or("private").trim();
        let timestamp = now().to_rfc3339();
        let record_uuid = uuid();
        let result = match &self.pool {
            WorkspacePool::Sqlite(pool) => sqlx::query(SQLITE_INSERT_WORKSPACE)
                .bind(id)
                .bind(&record_uuid)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .bind(&code)
                .bind(request.name.trim())
                .bind(request.description.as_deref().map(str::trim))
                .bind(request.icon_url.as_deref().map(str::trim))
                .bind(request.color.as_deref().map(str::trim))
                .bind(visibility)
                .bind(&timestamp)
                .bind(&timestamp)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
            WorkspacePool::Postgres(pool) => sqlx::query(POSTGRES_INSERT_WORKSPACE)
                .bind(id)
                .bind(&record_uuid)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .bind(&code)
                .bind(request.name.trim())
                .bind(request.description.as_deref().map(str::trim))
                .bind(request.icon_url.as_deref().map(str::trim))
                .bind(request.color.as_deref().map(str::trim))
                .bind(visibility)
                .bind(&timestamp)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
        };
        result.map_err(write_error)?;
        self.find_workspace_by_id(context, &id.to_string())
            .await?
            .ok_or_else(|| WorkspaceError::Internal("Created workspace was not readable.".to_owned()))
    }

    async fn update_workspace(
        &self,
        context: &WorkspaceContext,
        id: &str,
        request: &UpdateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        let scope = workspace_scope(context)?;
        let id = positive_id(id, "workspace_id")?;
        let timestamp = now().to_rfc3339();
        let result = match &self.pool {
            WorkspacePool::Sqlite(pool) => sqlx::query(SQLITE_UPDATE_WORKSPACE)
                .bind(request.code.as_deref().map(str::trim))
                .bind(request.name.as_deref().map(str::trim))
                .bind(request.description.as_deref().map(str::trim))
                .bind(request.icon_url.as_deref().map(str::trim))
                .bind(request.color.as_deref().map(str::trim))
                .bind(request.visibility.as_deref().map(str::trim))
                .bind(request.status.as_deref().map(str::trim))
                .bind(&timestamp)
                .bind(id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .bind(request.expected_version)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
            WorkspacePool::Postgres(pool) => sqlx::query(POSTGRES_UPDATE_WORKSPACE)
                .bind(request.code.as_deref().map(str::trim))
                .bind(request.name.as_deref().map(str::trim))
                .bind(request.description.as_deref().map(str::trim))
                .bind(request.icon_url.as_deref().map(str::trim))
                .bind(request.color.as_deref().map(str::trim))
                .bind(request.visibility.as_deref().map(str::trim))
                .bind(request.status.as_deref().map(str::trim))
                .bind(&timestamp)
                .bind(id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .bind(request.expected_version)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
        }
        .map_err(write_error)?;
        if result == 0 {
            return Err(WorkspaceError::PreconditionFailed(
                "Workspace version no longer matches If-Match.".to_owned(),
            ));
        }
        self.find_workspace_by_id(context, &id.to_string())
            .await?
            .ok_or_else(|| WorkspaceError::Internal("Updated workspace was not readable.".to_owned()))
    }

    async fn delete_workspace(
        &self,
        context: &WorkspaceContext,
        id: &str,
        expected_version: i64,
    ) -> Result<(), WorkspaceError> {
        let scope = workspace_scope(context)?;
        let id = positive_id(id, "workspace_id")?;
        let child_count = match &self.pool {
            WorkspacePool::Sqlite(pool) => sqlx::query_scalar::<_, i64>(SQLITE_COUNT_ACTIVE_PROJECTS)
                .bind(id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .fetch_one(pool)
                .await,
            WorkspacePool::Postgres(pool) => sqlx::query_scalar::<_, i64>(POSTGRES_COUNT_ACTIVE_PROJECTS)
                .bind(id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .fetch_one(pool)
                .await,
        }
        .map_err(repository_error)?;
        if child_count > 0 {
            return Err(WorkspaceError::Conflict(
                "Workspace cannot be deleted while it contains active projects.".to_owned(),
            ));
        }
        let timestamp = now().to_rfc3339();
        let result = match &self.pool {
            WorkspacePool::Sqlite(pool) => sqlx::query(SQLITE_DELETE_WORKSPACE)
                .bind(&timestamp)
                .bind(id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .bind(expected_version)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
            WorkspacePool::Postgres(pool) => sqlx::query(POSTGRES_DELETE_WORKSPACE)
                .bind(&timestamp)
                .bind(id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .bind(expected_version)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
        }
        .map_err(write_error)?;
        if result == 0 {
            return Err(WorkspaceError::PreconditionFailed(
                "Workspace version no longer matches If-Match.".to_owned(),
            ));
        }
        Ok(())
    }

    async fn ensure_workspace_access(
        &self,
        context: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<(), WorkspaceError> {
        if self
            .find_workspace_by_id(context, workspace_id)
            .await?
            .is_none()
        {
            return Err(WorkspaceError::NotFound(
                "Workspace was not found in the authenticated scope.".to_owned(),
            ));
        }
        Ok(())
    }
}

impl WorkspaceRecord {
    fn into_payload(self) -> WorkspacePayload {
        WorkspacePayload {
            id: self.id.to_string(),
            uuid: self.uuid,
            tenant_id: self.tenant_id.to_string(),
            organization_id: self.organization_id.to_string(),
            owner_user_id: self.owner_user_id.to_string(),
            created_by_user_id: self.created_by_user_id.to_string(),
            code: self.code,
            name: self.name,
            description: self.description,
            icon_url: self.icon_url,
            color: self.color,
            visibility: self.visibility,
            status: self.status,
            version: self.version.to_string(),
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

fn workspace_scope(context: &WorkspaceContext) -> Result<WorkspaceScope, WorkspaceError> {
    Ok(WorkspaceScope {
        tenant_id: positive_id(&context.tenant_id, "tenant_id")?,
        organization_id: non_negative_id(&context.organization_id, "organization_id")?,
        user_id: positive_id(&context.user_id, "user_id")?,
    })
}

fn positive_id(value: &str, field: &str) -> Result<i64, WorkspaceError> {
    let value = value
        .parse::<i64>()
        .map_err(|_| WorkspaceError::InvalidInput(format!("invalid {field}")))?;
    if value <= 0 {
        return Err(WorkspaceError::InvalidInput(format!("invalid {field}")));
    }
    Ok(value)
}

fn non_negative_id(value: &str, field: &str) -> Result<i64, WorkspaceError> {
    let value = value
        .parse::<i64>()
        .map_err(|_| WorkspaceError::InvalidInput(format!("invalid {field}")))?;
    if value < 0 {
        return Err(WorkspaceError::InvalidInput(format!("invalid {field}")));
    }
    Ok(value)
}

fn repository_error(error: sqlx::Error) -> WorkspaceError {
    WorkspaceError::Repository(error.to_string())
}

fn write_error(error: sqlx::Error) -> WorkspaceError {
    let message = error.to_string();
    let normalized = message.to_ascii_lowercase();
    if normalized.contains("unique") || normalized.contains("duplicate") {
        WorkspaceError::Conflict("Workspace code already exists in this scope.".to_owned())
    } else {
        WorkspaceError::Repository(message)
    }
}

const SQLITE_SELECT_WORKSPACE: &str = r#"
SELECT id, uuid, tenant_id, organization_id, owner_user_id, created_by_user_id,
       code, name, description, icon_url, color, visibility, status, version,
       created_at, updated_at
FROM studio_workspace
WHERE id = ? AND tenant_id = ? AND organization_id = ? AND is_deleted = 0
  AND (owner_user_id = ? OR visibility = 'organization')
"#;
const POSTGRES_SELECT_WORKSPACE: &str = r#"
SELECT id, uuid::text AS uuid, tenant_id, organization_id, owner_user_id, created_by_user_id,
       code, name, description, icon_url, color, visibility, status, version,
       created_at::text AS created_at, updated_at::text AS updated_at
FROM studio_workspace
WHERE id = $1 AND tenant_id = $2 AND organization_id = $3 AND is_deleted = FALSE
  AND (owner_user_id = $4 OR visibility = 'organization')
"#;
const SQLITE_LIST_WORKSPACES: &str = r#"
SELECT id, uuid, tenant_id, organization_id, owner_user_id, created_by_user_id,
       code, name, description, icon_url, color, visibility, status, version,
       created_at, updated_at
FROM studio_workspace
WHERE tenant_id = ? AND organization_id = ? AND is_deleted = 0
  AND (owner_user_id = ? OR visibility = 'organization')
ORDER BY updated_at DESC, id DESC LIMIT ? OFFSET ?
"#;
const POSTGRES_LIST_WORKSPACES: &str = r#"
SELECT id, uuid::text AS uuid, tenant_id, organization_id, owner_user_id, created_by_user_id,
       code, name, description, icon_url, color, visibility, status, version,
       created_at::text AS created_at, updated_at::text AS updated_at
FROM studio_workspace
WHERE tenant_id = $1 AND organization_id = $2 AND is_deleted = FALSE
  AND (owner_user_id = $3 OR visibility = 'organization')
ORDER BY updated_at DESC, id DESC LIMIT $4 OFFSET $5
"#;
const SQLITE_COUNT_WORKSPACES: &str = "SELECT COUNT(*) FROM studio_workspace WHERE tenant_id = ? AND organization_id = ? AND is_deleted = 0 AND (owner_user_id = ? OR visibility = 'organization')";
const POSTGRES_COUNT_WORKSPACES: &str = "SELECT COUNT(*) FROM studio_workspace WHERE tenant_id = $1 AND organization_id = $2 AND is_deleted = FALSE AND (owner_user_id = $3 OR visibility = 'organization')";
const SQLITE_INSERT_WORKSPACE: &str = r#"
INSERT INTO studio_workspace (
    id, uuid, tenant_id, organization_id, owner_user_id, created_by_user_id,
    code, name, description, icon_url, color, visibility, status, version,
    created_at, updated_at, is_deleted
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, 0)
"#;
const POSTGRES_INSERT_WORKSPACE: &str = r#"
INSERT INTO studio_workspace (
    id, uuid, tenant_id, organization_id, owner_user_id, created_by_user_id,
    code, name, description, icon_url, color, visibility, status, version,
    created_at, updated_at, is_deleted
) VALUES ($1, CAST($2 AS UUID), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', 0,
          CAST($13 AS TIMESTAMPTZ), CAST($13 AS TIMESTAMPTZ), FALSE)
"#;
const SQLITE_UPDATE_WORKSPACE: &str = r#"
UPDATE studio_workspace SET
    code = COALESCE(?, code), name = COALESCE(?, name),
    description = COALESCE(?, description), icon_url = COALESCE(?, icon_url),
    color = COALESCE(?, color), visibility = COALESCE(?, visibility),
    status = COALESCE(?, status), updated_at = ?, version = version + 1
WHERE id = ? AND tenant_id = ? AND organization_id = ? AND owner_user_id = ?
  AND version = ? AND is_deleted = 0
"#;
const POSTGRES_UPDATE_WORKSPACE: &str = r#"
UPDATE studio_workspace SET
    code = COALESCE($1, code), name = COALESCE($2, name),
    description = COALESCE($3, description), icon_url = COALESCE($4, icon_url),
    color = COALESCE($5, color), visibility = COALESCE($6, visibility),
    status = COALESCE($7, status), updated_at = CAST($8 AS TIMESTAMPTZ), version = version + 1
WHERE id = $9 AND tenant_id = $10 AND organization_id = $11 AND owner_user_id = $12
  AND version = $13 AND is_deleted = FALSE
"#;
const SQLITE_COUNT_ACTIVE_PROJECTS: &str = "SELECT COUNT(*) FROM studio_project WHERE workspace_id = ? AND tenant_id = ? AND organization_id = ? AND is_deleted = 0";
const POSTGRES_COUNT_ACTIVE_PROJECTS: &str = "SELECT COUNT(*) FROM studio_project WHERE workspace_id = $1 AND tenant_id = $2 AND organization_id = $3 AND is_deleted = FALSE";
const SQLITE_DELETE_WORKSPACE: &str = "UPDATE studio_workspace SET status = 'archived', is_deleted = 1, updated_at = ?, version = version + 1 WHERE id = ? AND tenant_id = ? AND organization_id = ? AND owner_user_id = ? AND version = ? AND is_deleted = 0";
const POSTGRES_DELETE_WORKSPACE: &str = "UPDATE studio_workspace SET status = 'archived', is_deleted = TRUE, updated_at = CAST($1 AS TIMESTAMPTZ), version = version + 1 WHERE id = $2 AND tenant_id = $3 AND organization_id = $4 AND owner_user_id = $5 AND version = $6 AND is_deleted = FALSE";
