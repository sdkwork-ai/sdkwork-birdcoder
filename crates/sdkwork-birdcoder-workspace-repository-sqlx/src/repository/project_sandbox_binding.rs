mod common;
mod postgres;
mod sqlite;

use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::sandbox_binding::{
    NewProjectSandboxBinding, ProjectSandboxBindingAuditEntry, ProjectSandboxBindingPayload,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::sandbox_binding_repository::ProjectSandboxBindingRepository;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_database_sqlx::DatabasePool;
use sqlx::{PgPool, SqlitePool};

#[derive(Clone)]
enum SandboxBindingPool {
    Postgres(PgPool),
    Sqlite(SqlitePool),
}

/// SQLx adapter for BirdCoder-owned project-to-Drive-sandbox references.
///
/// The adapter keeps engine-specific SQL behind one repository port while the
/// process-wide Snowflake generator remains the only authority for BIGINT ids.
#[derive(Clone)]
pub struct SqlxProjectSandboxBindingRepository {
    pool: SandboxBindingPool,
    id_generator: SnowflakeIdGenerator,
}

impl SqlxProjectSandboxBindingRepository {
    pub fn new(pool: DatabasePool, id_generator: SnowflakeIdGenerator) -> Self {
        let pool = match pool {
            DatabasePool::Postgres(pool, _) => SandboxBindingPool::Postgres(pool),
            DatabasePool::Sqlite(pool, _) => SandboxBindingPool::Sqlite(pool),
        };
        Self { pool, id_generator }
    }

    pub fn from_postgres(pool: PgPool, id_generator: SnowflakeIdGenerator) -> Self {
        Self {
            pool: SandboxBindingPool::Postgres(pool),
            id_generator,
        }
    }

    pub fn from_sqlite(pool: SqlitePool, id_generator: SnowflakeIdGenerator) -> Self {
        Self {
            pool: SandboxBindingPool::Sqlite(pool),
            id_generator,
        }
    }
}

#[async_trait::async_trait]
impl ProjectSandboxBindingRepository for SqlxProjectSandboxBindingRepository {
    async fn get_sandbox_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
    ) -> Result<Option<ProjectSandboxBindingPayload>, ProjectError> {
        match &self.pool {
            SandboxBindingPool::Postgres(pool) => postgres::get(pool, context, project_id).await,
            SandboxBindingPool::Sqlite(pool) => sqlite::get(pool, context, project_id).await,
        }
    }

    async fn upsert_sandbox_binding(
        &self,
        context: &ProjectContext,
        binding: &NewProjectSandboxBinding,
        audit: &ProjectSandboxBindingAuditEntry,
    ) -> Result<ProjectSandboxBindingPayload, ProjectError> {
        match &self.pool {
            SandboxBindingPool::Postgres(pool) => {
                postgres::upsert(pool, &self.id_generator, context, binding, audit).await
            }
            SandboxBindingPool::Sqlite(pool) => {
                sqlite::upsert(pool, &self.id_generator, context, binding, audit).await
            }
        }
    }

    async fn delete_sandbox_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
        expected_version: i64,
        audit: &ProjectSandboxBindingAuditEntry,
    ) -> Result<(), ProjectError> {
        match &self.pool {
            SandboxBindingPool::Postgres(pool) => {
                postgres::delete(
                    pool,
                    &self.id_generator,
                    context,
                    project_id,
                    expected_version,
                    audit,
                )
                .await
            }
            SandboxBindingPool::Sqlite(pool) => {
                sqlite::delete(
                    pool,
                    &self.id_generator,
                    context,
                    project_id,
                    expected_version,
                    audit,
                )
                .await
            }
        }
    }
}
