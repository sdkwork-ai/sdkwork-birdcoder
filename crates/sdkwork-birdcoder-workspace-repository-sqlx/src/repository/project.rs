use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::commands::{
    CreateProjectRequest, UpdateProjectRequest,
};
use sdkwork_birdcoder_project_service::domain::results::ProjectPayload;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::repository::ProjectRepository;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_database_sqlx::DatabasePool;
use sdkwork_utils_rust::{datetime::now, id::uuid};
use sqlx::{FromRow, PgPool, SqlitePool};

#[derive(Clone)]
enum ProjectPool {
    Postgres(PgPool),
    Sqlite(SqlitePool),
}

#[derive(Clone)]
pub struct SqlxProjectRepository {
    pool: ProjectPool,
    id_generator: SnowflakeIdGenerator,
}

#[derive(FromRow)]
struct ProjectRecord {
    id: i64,
    uuid: String,
    tenant_id: i64,
    organization_id: i64,
    workspace_id: i64,
    owner_user_id: i64,
    created_by_user_id: i64,
    code: String,
    name: String,
    description: Option<String>,
    project_kind: String,
    default_agent_project_id: Option<String>,
    status: String,
    version: i64,
    created_at: String,
    updated_at: String,
}

#[derive(Clone, Copy)]
struct ProjectScope {
    tenant_id: i64,
    organization_id: i64,
    user_id: i64,
}

impl SqlxProjectRepository {
    pub fn new(pool: DatabasePool, id_generator: SnowflakeIdGenerator) -> Self {
        let pool = match pool {
            DatabasePool::Postgres(pool, _) => ProjectPool::Postgres(pool),
            DatabasePool::Sqlite(pool, _) => ProjectPool::Sqlite(pool),
        };
        Self { pool, id_generator }
    }

    pub fn from_postgres(pool: PgPool, id_generator: SnowflakeIdGenerator) -> Self {
        Self {
            pool: ProjectPool::Postgres(pool),
            id_generator,
        }
    }

    pub fn from_sqlite(pool: SqlitePool, id_generator: SnowflakeIdGenerator) -> Self {
        Self {
            pool: ProjectPool::Sqlite(pool),
            id_generator,
        }
    }

    fn next_id(&self) -> Result<i64, ProjectError> {
        self.id_generator.generate().map_err(|error| {
            ProjectError::Internal(format!("Snowflake id generation failed: {error}"))
        })
    }
}

#[async_trait::async_trait]
impl ProjectRepository for SqlxProjectRepository {
    async fn find_project_by_id(
        &self,
        context: &ProjectContext,
        id: &str,
    ) -> Result<Option<ProjectPayload>, ProjectError> {
        let scope = project_scope(context)?;
        let id = positive_id(id, "project_id")?;
        let record = match &self.pool {
            ProjectPool::Sqlite(pool) => sqlx::query_as::<_, ProjectRecord>(SQLITE_SELECT_PROJECT)
                .bind(id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .fetch_optional(pool)
                .await,
            ProjectPool::Postgres(pool) => {
                sqlx::query_as::<_, ProjectRecord>(POSTGRES_SELECT_PROJECT)
                    .bind(id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .fetch_optional(pool)
                    .await
            }
        }
        .map_err(repository_error)?;
        Ok(record.map(ProjectRecord::into_payload))
    }

    async fn ensure_workspace_access(
        &self,
        context: &ProjectContext,
        workspace_id: &str,
    ) -> Result<(), ProjectError> {
        let scope = project_scope(context)?;
        let workspace_id = positive_id(workspace_id, "workspace_id")?;
        let exists = match &self.pool {
            ProjectPool::Sqlite(pool) => sqlx::query_scalar::<_, i64>(SQLITE_WORKSPACE_ACCESS)
                .bind(workspace_id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .fetch_optional(pool)
                .await,
            ProjectPool::Postgres(pool) => sqlx::query_scalar::<_, i64>(POSTGRES_WORKSPACE_ACCESS)
                .bind(workspace_id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .fetch_optional(pool)
                .await,
        }
        .map_err(repository_error)?;
        if exists.is_none() {
            return Err(ProjectError::NotFound(
                "Workspace was not found in the authenticated scope.".to_owned(),
            ));
        }
        Ok(())
    }

    async fn ensure_project_write_access(
        &self,
        context: &ProjectContext,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        let scope = project_scope(context)?;
        let project_id = positive_id(project_id, "project_id")?;
        let exists = match &self.pool {
            ProjectPool::Sqlite(pool) => sqlx::query_scalar::<_, i64>(SQLITE_PROJECT_WRITE_ACCESS)
                .bind(project_id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .fetch_optional(pool)
                .await,
            ProjectPool::Postgres(pool) => sqlx::query_scalar::<_, i64>(POSTGRES_PROJECT_WRITE_ACCESS)
                .bind(project_id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .fetch_optional(pool)
                .await,
        }
        .map_err(repository_error)?;
        if exists.is_none() {
            return Err(ProjectError::NotFound(
                "Project was not found in the authenticated write scope.".to_owned(),
            ));
        }
        Ok(())
    }

    async fn list_projects_by_workspace(
        &self,
        context: &ProjectContext,
        workspace_id: &str,
        user_id: Option<&str>,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectPayload>, usize), ProjectError> {
        if user_id.is_some_and(|value| value != context.user_id) {
            return Err(ProjectError::Forbidden(
                "Project listing is limited to the authenticated user.".to_owned(),
            ));
        }
        let scope = project_scope(context)?;
        let workspace_id = positive_id(workspace_id, "workspace_id")?;
        let offset = i64::try_from(offset)
            .map_err(|_| ProjectError::InvalidInput("offset is too large.".to_owned()))?;
        let limit = i64::try_from(limit.min(200))
            .map_err(|_| ProjectError::InvalidInput("limit is too large.".to_owned()))?;
        let (records, total) = match &self.pool {
            ProjectPool::Sqlite(pool) => {
                let records = sqlx::query_as::<_, ProjectRecord>(SQLITE_LIST_PROJECTS)
                    .bind(workspace_id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .bind(scope.user_id)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(pool)
                    .await
                    .map_err(repository_error)?;
                let total = sqlx::query_scalar::<_, i64>(SQLITE_COUNT_PROJECTS)
                    .bind(workspace_id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .bind(scope.user_id)
                    .fetch_one(pool)
                    .await
                    .map_err(repository_error)?;
                (records, total)
            }
            ProjectPool::Postgres(pool) => {
                let records = sqlx::query_as::<_, ProjectRecord>(POSTGRES_LIST_PROJECTS)
                    .bind(workspace_id)
                    .bind(scope.tenant_id)
                    .bind(scope.organization_id)
                    .bind(scope.user_id)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(pool)
                    .await
                    .map_err(repository_error)?;
                let total = sqlx::query_scalar::<_, i64>(POSTGRES_COUNT_PROJECTS)
                    .bind(workspace_id)
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
            .map_err(|_| ProjectError::Internal("Project count overflowed usize.".to_owned()))?;
        Ok((
            records
                .into_iter()
                .map(ProjectRecord::into_payload)
                .collect(),
            total,
        ))
    }

    async fn create_project(
        &self,
        context: &ProjectContext,
        request: &CreateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        let scope = project_scope(context)?;
        let workspace_id = positive_id(&request.workspace_id, "workspace_id")?;
        let id = self.next_id()?;
        let code = request
            .code
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| format!("project-{id}"));
        let project_kind = request.project_kind.as_deref().unwrap_or("code").trim();
        let record_uuid = uuid();
        let timestamp = now().to_rfc3339();
        let result = match &self.pool {
            ProjectPool::Sqlite(pool) => sqlx::query(SQLITE_INSERT_PROJECT)
                .bind(id)
                .bind(&record_uuid)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(workspace_id)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .bind(&code)
                .bind(request.name.trim())
                .bind(request.description.as_deref().map(str::trim))
                .bind(project_kind)
                .bind(request.default_agent_project_id.as_deref())
                .bind(&timestamp)
                .bind(&timestamp)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
            ProjectPool::Postgres(pool) => sqlx::query(POSTGRES_INSERT_PROJECT)
                .bind(id)
                .bind(&record_uuid)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(workspace_id)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .bind(&code)
                .bind(request.name.trim())
                .bind(request.description.as_deref().map(str::trim))
                .bind(project_kind)
                .bind(request.default_agent_project_id.as_deref())
                .bind(&timestamp)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
        };
        result.map_err(write_error)?;
        self.find_project_by_id(context, &id.to_string())
            .await?
            .ok_or_else(|| ProjectError::Internal("Created project was not readable.".to_owned()))
    }

    async fn update_project(
        &self,
        context: &ProjectContext,
        id: &str,
        request: &UpdateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        let scope = project_scope(context)?;
        let id = positive_id(id, "project_id")?;
        let timestamp = now().to_rfc3339();
        let result = match &self.pool {
            ProjectPool::Sqlite(pool) => sqlx::query(SQLITE_UPDATE_PROJECT)
                .bind(request.code.as_deref().map(str::trim))
                .bind(request.name.as_deref().map(str::trim))
                .bind(request.description.as_deref().map(str::trim))
                .bind(request.project_kind.as_deref().map(str::trim))
                .bind(request.default_agent_project_id.as_deref())
                .bind(request.status.as_deref().map(str::trim))
                .bind(&timestamp)
                .bind(id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(request.expected_version)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
            ProjectPool::Postgres(pool) => sqlx::query(POSTGRES_UPDATE_PROJECT)
                .bind(request.code.as_deref().map(str::trim))
                .bind(request.name.as_deref().map(str::trim))
                .bind(request.description.as_deref().map(str::trim))
                .bind(request.project_kind.as_deref().map(str::trim))
                .bind(request.default_agent_project_id.as_deref())
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
            return Err(ProjectError::PreconditionFailed(
                "Project version no longer matches If-Match.".to_owned(),
            ));
        }
        self.find_project_by_id(context, &id.to_string())
            .await?
            .ok_or_else(|| ProjectError::Internal("Updated project was not readable.".to_owned()))
    }

    async fn delete_project(
        &self,
        context: &ProjectContext,
        id: &str,
        expected_version: i64,
    ) -> Result<(), ProjectError> {
        let scope = project_scope(context)?;
        let id = positive_id(id, "project_id")?;
        let dependent_count = match &self.pool {
            ProjectPool::Sqlite(pool) => sqlx::query_scalar::<_, i64>(SQLITE_COUNT_PROJECT_DEPENDENCIES)
                .bind(id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .fetch_one(pool)
                .await,
            ProjectPool::Postgres(pool) => sqlx::query_scalar::<_, i64>(POSTGRES_COUNT_PROJECT_DEPENDENCIES)
                .bind(id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .fetch_one(pool)
                .await,
        }
        .map_err(repository_error)?;
        if dependent_count > 0 {
            return Err(ProjectError::Conflict(
                "Project cannot be deleted while document, runtime-location, or sandbox bindings are active."
                    .to_owned(),
            ));
        }
        let timestamp = now().to_rfc3339();
        let result = match &self.pool {
            ProjectPool::Sqlite(pool) => sqlx::query(SQLITE_DELETE_PROJECT)
                .bind(&timestamp)
                .bind(id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(expected_version)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .execute(pool)
                .await
                .map(|result| result.rows_affected()),
            ProjectPool::Postgres(pool) => sqlx::query(POSTGRES_DELETE_PROJECT)
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
            return Err(ProjectError::PreconditionFailed(
                "Project version no longer matches If-Match.".to_owned(),
            ));
        }
        Ok(())
    }
}

impl ProjectRecord {
    fn into_payload(self) -> ProjectPayload {
        ProjectPayload {
            id: self.id.to_string(),
            uuid: self.uuid,
            tenant_id: self.tenant_id.to_string(),
            organization_id: self.organization_id.to_string(),
            workspace_id: self.workspace_id.to_string(),
            owner_user_id: self.owner_user_id.to_string(),
            created_by_user_id: self.created_by_user_id.to_string(),
            code: self.code,
            name: self.name,
            description: self.description,
            project_kind: self.project_kind,
            default_agent_project_id: self.default_agent_project_id,
            status: self.status,
            version: self.version.to_string(),
            created_at: self.created_at,
            updated_at: self.updated_at,
        }
    }
}

fn project_scope(context: &ProjectContext) -> Result<ProjectScope, ProjectError> {
    Ok(ProjectScope {
        tenant_id: positive_id(&context.tenant_id, "tenant_id")?,
        organization_id: non_negative_id(&context.organization_id, "organization_id")?,
        user_id: positive_id(&context.user_id, "user_id")?,
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

fn write_error(error: sqlx::Error) -> ProjectError {
    let message = error.to_string();
    let normalized = message.to_ascii_lowercase();
    if normalized.contains("unique") || normalized.contains("duplicate") {
        ProjectError::Conflict(
            "Project code or Agents project binding already exists in this scope.".to_owned(),
        )
    } else {
        ProjectError::Repository(message)
    }
}

const SQLITE_SELECT_PROJECT: &str = r#"
SELECT p.id, p.uuid, p.tenant_id, p.organization_id, p.workspace_id,
       p.owner_user_id, p.created_by_user_id, p.code, p.name, p.description,
       p.project_kind, p.default_agent_project_id, p.status, p.version,
       p.created_at, p.updated_at
FROM studio_project p
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE p.id = ? AND p.tenant_id = ? AND p.organization_id = ? AND p.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
"#;
const POSTGRES_SELECT_PROJECT: &str = r#"
SELECT p.id, p.uuid::text AS uuid, p.tenant_id, p.organization_id, p.workspace_id,
       p.owner_user_id, p.created_by_user_id, p.code, p.name, p.description,
       p.project_kind, p.default_agent_project_id, p.status, p.version,
       p.created_at::text AS created_at, p.updated_at::text AS updated_at
FROM studio_project p
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = FALSE
WHERE p.id = $1 AND p.tenant_id = $2 AND p.organization_id = $3 AND p.is_deleted = FALSE
  AND (p.owner_user_id = $4 OR w.owner_user_id = $4 OR w.visibility = 'organization')
"#;
const SQLITE_WORKSPACE_ACCESS: &str = "SELECT id FROM studio_workspace WHERE id = ? AND tenant_id = ? AND organization_id = ? AND is_deleted = 0 AND (owner_user_id = ? OR visibility = 'organization')";
const POSTGRES_WORKSPACE_ACCESS: &str = "SELECT id FROM studio_workspace WHERE id = $1 AND tenant_id = $2 AND organization_id = $3 AND is_deleted = FALSE AND (owner_user_id = $4 OR visibility = 'organization')";
const SQLITE_PROJECT_WRITE_ACCESS: &str = r#"
SELECT p.id FROM studio_project p
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE p.id = ? AND p.tenant_id = ? AND p.organization_id = ? AND p.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ?)
"#;
const POSTGRES_PROJECT_WRITE_ACCESS: &str = r#"
SELECT p.id FROM studio_project p
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = FALSE
WHERE p.id = $1 AND p.tenant_id = $2 AND p.organization_id = $3 AND p.is_deleted = FALSE
  AND (p.owner_user_id = $4 OR w.owner_user_id = $4)
"#;
const SQLITE_LIST_PROJECTS: &str = r#"
SELECT p.id, p.uuid, p.tenant_id, p.organization_id, p.workspace_id,
       p.owner_user_id, p.created_by_user_id, p.code, p.name, p.description,
       p.project_kind, p.default_agent_project_id, p.status, p.version,
       p.created_at, p.updated_at
FROM studio_project p
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE p.workspace_id = ? AND p.tenant_id = ? AND p.organization_id = ? AND p.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
ORDER BY p.updated_at DESC, p.id DESC LIMIT ? OFFSET ?
"#;
const POSTGRES_LIST_PROJECTS: &str = r#"
SELECT p.id, p.uuid::text AS uuid, p.tenant_id, p.organization_id, p.workspace_id,
       p.owner_user_id, p.created_by_user_id, p.code, p.name, p.description,
       p.project_kind, p.default_agent_project_id, p.status, p.version,
       p.created_at::text AS created_at, p.updated_at::text AS updated_at
FROM studio_project p
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = FALSE
WHERE p.workspace_id = $1 AND p.tenant_id = $2 AND p.organization_id = $3 AND p.is_deleted = FALSE
  AND (p.owner_user_id = $4 OR w.owner_user_id = $4 OR w.visibility = 'organization')
ORDER BY p.updated_at DESC, p.id DESC LIMIT $5 OFFSET $6
"#;
const SQLITE_COUNT_PROJECTS: &str = r#"
SELECT COUNT(*) FROM studio_project p
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE p.workspace_id = ? AND p.tenant_id = ? AND p.organization_id = ? AND p.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
"#;
const POSTGRES_COUNT_PROJECTS: &str = r#"
SELECT COUNT(*) FROM studio_project p
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = FALSE
WHERE p.workspace_id = $1 AND p.tenant_id = $2 AND p.organization_id = $3 AND p.is_deleted = FALSE
  AND (p.owner_user_id = $4 OR w.owner_user_id = $4 OR w.visibility = 'organization')
"#;
const SQLITE_INSERT_PROJECT: &str = r#"
INSERT INTO studio_project (
    id, uuid, tenant_id, organization_id, workspace_id, owner_user_id, created_by_user_id,
    code, name, description, project_kind, default_agent_project_id, status, version,
    created_at, updated_at, is_deleted
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, ?, ?, 0)
"#;
const POSTGRES_INSERT_PROJECT: &str = r#"
INSERT INTO studio_project (
    id, uuid, tenant_id, organization_id, workspace_id, owner_user_id, created_by_user_id,
    code, name, description, project_kind, default_agent_project_id, status, version,
    created_at, updated_at, is_deleted
) VALUES ($1, CAST($2 AS UUID), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', 0,
          CAST($13 AS TIMESTAMPTZ), CAST($13 AS TIMESTAMPTZ), FALSE)
"#;
const SQLITE_UPDATE_PROJECT: &str = r#"
UPDATE studio_project SET
    code = COALESCE(?, code), name = COALESCE(?, name), description = COALESCE(?, description),
    project_kind = COALESCE(?, project_kind),
    default_agent_project_id = COALESCE(?, default_agent_project_id),
    status = COALESCE(?, status), updated_at = ?, version = version + 1
WHERE id = ? AND tenant_id = ? AND organization_id = ? AND version = ? AND is_deleted = 0
  AND (owner_user_id = ? OR EXISTS (
      SELECT 1 FROM studio_workspace w
      WHERE w.id = studio_project.workspace_id AND w.owner_user_id = ? AND w.is_deleted = 0
  ))
"#;
const POSTGRES_UPDATE_PROJECT: &str = r#"
UPDATE studio_project SET
    code = COALESCE($1, code), name = COALESCE($2, name), description = COALESCE($3, description),
    project_kind = COALESCE($4, project_kind),
    default_agent_project_id = COALESCE($5, default_agent_project_id),
    status = COALESCE($6, status), updated_at = CAST($7 AS TIMESTAMPTZ), version = version + 1
WHERE id = $8 AND tenant_id = $9 AND organization_id = $10 AND version = $12 AND is_deleted = FALSE
  AND (owner_user_id = $11 OR EXISTS (
      SELECT 1 FROM studio_workspace w
      WHERE w.id = studio_project.workspace_id AND w.owner_user_id = $11 AND w.is_deleted = FALSE
  ))
"#;
const SQLITE_COUNT_PROJECT_DEPENDENCIES: &str = r#"
SELECT
  (SELECT COUNT(*) FROM studio_project_document_binding WHERE project_id = ?1 AND tenant_id = ?2 AND organization_id = ?3 AND is_deleted = 0) +
  (SELECT COUNT(*) FROM studio_project_runtime_location WHERE project_id = ?1 AND tenant_id = ?2 AND organization_id = ?3 AND is_deleted = 0) +
  (SELECT COUNT(*) FROM studio_project_sandbox_binding WHERE project_id = ?1 AND tenant_id = ?2 AND organization_id = ?3 AND is_deleted = 0)
"#;
const POSTGRES_COUNT_PROJECT_DEPENDENCIES: &str = r#"
SELECT
  (SELECT COUNT(*) FROM studio_project_document_binding WHERE project_id = $1 AND tenant_id = $2 AND organization_id = $3 AND is_deleted = FALSE) +
  (SELECT COUNT(*) FROM studio_project_runtime_location WHERE project_id = $1 AND tenant_id = $2 AND organization_id = $3 AND is_deleted = FALSE) +
  (SELECT COUNT(*) FROM studio_project_sandbox_binding WHERE project_id = $1 AND tenant_id = $2 AND organization_id = $3 AND is_deleted = FALSE)
"#;
const SQLITE_DELETE_PROJECT: &str = r#"
UPDATE studio_project SET status = 'archived', is_deleted = 1, updated_at = ?, version = version + 1
WHERE id = ? AND tenant_id = ? AND organization_id = ? AND version = ? AND is_deleted = 0
  AND (owner_user_id = ? OR EXISTS (
      SELECT 1 FROM studio_workspace w
      WHERE w.id = studio_project.workspace_id AND w.owner_user_id = ? AND w.is_deleted = 0
  ))
"#;
const POSTGRES_DELETE_PROJECT: &str = r#"
UPDATE studio_project SET status = 'archived', is_deleted = TRUE,
    updated_at = CAST($1 AS TIMESTAMPTZ), version = version + 1
WHERE id = $2 AND tenant_id = $3 AND organization_id = $4 AND version = $6 AND is_deleted = FALSE
  AND (owner_user_id = $5 OR EXISTS (
      SELECT 1 FROM studio_workspace w
      WHERE w.id = studio_project.workspace_id AND w.owner_user_id = $5 AND w.is_deleted = FALSE
  ))
"#;
