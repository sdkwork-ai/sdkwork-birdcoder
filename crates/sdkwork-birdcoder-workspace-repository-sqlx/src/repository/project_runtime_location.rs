mod common;
mod postgres;
mod sqlite;

use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::runtime_location::{
    NewProjectRuntimeLocation, NewProjectRuntimeLocationPreference,
    ProjectRuntimeLocationAuditEntry, ProjectRuntimeLocationPreferencePayload,
    ProjectRuntimeLocationRebind, ProjectRuntimeLocationUpdate,
    ProjectRuntimeLocationVerificationRequest, StoredProjectRuntimeLocation,
    TrustedProjectRuntimeLocationVerification,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::runtime_location_repository::ProjectRuntimeLocationRepository;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_database_sqlx::DatabasePool;
use sqlx::{PgPool, SqlitePool};

#[derive(Clone)]
enum RuntimeLocationPool {
    Postgres(PgPool),
    Sqlite(SqlitePool),
}

/// SQLx adapter for BirdCoder-owned project runtime locations.
///
/// Database-engine details remain private to the adapter and all BIGINT
/// identities come from the process-wide Snowflake generator.
#[derive(Clone)]
pub struct SqlxProjectRuntimeLocationRepository {
    pool: RuntimeLocationPool,
    id_generator: SnowflakeIdGenerator,
}

impl SqlxProjectRuntimeLocationRepository {
    pub fn new(pool: DatabasePool, id_generator: SnowflakeIdGenerator) -> Self {
        let pool = match pool {
            DatabasePool::Postgres(pool, _) => RuntimeLocationPool::Postgres(pool),
            DatabasePool::Sqlite(pool, _) => RuntimeLocationPool::Sqlite(pool),
        };
        Self { pool, id_generator }
    }

    pub fn from_postgres(pool: PgPool, id_generator: SnowflakeIdGenerator) -> Self {
        Self {
            pool: RuntimeLocationPool::Postgres(pool),
            id_generator,
        }
    }

    pub fn from_sqlite(pool: SqlitePool, id_generator: SnowflakeIdGenerator) -> Self {
        Self {
            pool: RuntimeLocationPool::Sqlite(pool),
            id_generator,
        }
    }
}

#[async_trait::async_trait]
impl ProjectRuntimeLocationRepository for SqlxProjectRuntimeLocationRepository {
    async fn list_runtime_locations(
        &self,
        context: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<StoredProjectRuntimeLocation>, usize), ProjectError> {
        match &self.pool {
            RuntimeLocationPool::Postgres(pool) => {
                postgres::list(pool, context, project_id, offset, limit).await
            }
            RuntimeLocationPool::Sqlite(pool) => {
                sqlite::list(pool, context, project_id, offset, limit).await
            }
        }
    }

    async fn find_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
    ) -> Result<Option<StoredProjectRuntimeLocation>, ProjectError> {
        match &self.pool {
            RuntimeLocationPool::Postgres(pool) => {
                postgres::find(pool, context, project_id, runtime_location_id).await
            }
            RuntimeLocationPool::Sqlite(pool) => {
                sqlite::find(pool, context, project_id, runtime_location_id).await
            }
        }
    }

    async fn register_runtime_location(
        &self,
        context: &ProjectContext,
        location: &NewProjectRuntimeLocation,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError> {
        match &self.pool {
            RuntimeLocationPool::Postgres(pool) => {
                postgres::register(pool, &self.id_generator, context, location, audit).await
            }
            RuntimeLocationPool::Sqlite(pool) => {
                sqlite::register(pool, &self.id_generator, context, location, audit).await
            }
        }
    }

    async fn update_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        update: &ProjectRuntimeLocationUpdate,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError> {
        match &self.pool {
            RuntimeLocationPool::Postgres(pool) => {
                postgres::update(pool, &self.id_generator, context, project_id, runtime_location_id, update, audit).await
            }
            RuntimeLocationPool::Sqlite(pool) => {
                sqlite::update(pool, &self.id_generator, context, project_id, runtime_location_id, update, audit).await
            }
        }
    }

    async fn rebind_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        rebind: &ProjectRuntimeLocationRebind,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError> {
        match &self.pool {
            RuntimeLocationPool::Postgres(pool) => {
                postgres::rebind(pool, &self.id_generator, context, project_id, runtime_location_id, rebind, audit).await
            }
            RuntimeLocationPool::Sqlite(pool) => {
                sqlite::rebind(pool, &self.id_generator, context, project_id, runtime_location_id, rebind, audit).await
            }
        }
    }

    async fn record_runtime_location_verification(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        verification: &TrustedProjectRuntimeLocationVerification,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError> {
        match &self.pool {
            RuntimeLocationPool::Postgres(pool) => {
                postgres::record_verification(pool, &self.id_generator, context, project_id, runtime_location_id, verification, audit).await
            }
            RuntimeLocationPool::Sqlite(pool) => {
                sqlite::record_verification(pool, &self.id_generator, context, project_id, runtime_location_id, verification, audit).await
            }
        }
    }

    async fn request_runtime_location_verification(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        request: &ProjectRuntimeLocationVerificationRequest,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError> {
        match &self.pool {
            RuntimeLocationPool::Postgres(pool) => {
                postgres::request_verification(pool, &self.id_generator, context, project_id, runtime_location_id, request, audit).await
            }
            RuntimeLocationPool::Sqlite(pool) => {
                sqlite::request_verification(pool, &self.id_generator, context, project_id, runtime_location_id, request, audit).await
            }
        }
    }

    async fn delete_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        expected_version: i64,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<(), ProjectError> {
        match &self.pool {
            RuntimeLocationPool::Postgres(pool) => {
                postgres::delete(pool, &self.id_generator, context, project_id, runtime_location_id, expected_version, audit).await
            }
            RuntimeLocationPool::Sqlite(pool) => {
                sqlite::delete(pool, &self.id_generator, context, project_id, runtime_location_id, expected_version, audit).await
            }
        }
    }

    async fn get_runtime_location_preference(
        &self,
        context: &ProjectContext,
        project_id: &str,
        capability: &str,
    ) -> Result<Option<ProjectRuntimeLocationPreferencePayload>, ProjectError> {
        match &self.pool {
            RuntimeLocationPool::Postgres(pool) => postgres::get_preference(pool, context, project_id, capability).await,
            RuntimeLocationPool::Sqlite(pool) => sqlite::get_preference(pool, context, project_id, capability).await,
        }
    }

    async fn list_runtime_location_preferences(
        &self,
        context: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectRuntimeLocationPreferencePayload>, usize), ProjectError> {
        match &self.pool {
            RuntimeLocationPool::Postgres(pool) => postgres::list_preferences(pool, context, project_id, offset, limit).await,
            RuntimeLocationPool::Sqlite(pool) => sqlite::list_preferences(pool, context, project_id, offset, limit).await,
        }
    }

    async fn upsert_runtime_location_preference(
        &self,
        context: &ProjectContext,
        preference: &NewProjectRuntimeLocationPreference,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<ProjectRuntimeLocationPreferencePayload, ProjectError> {
        match &self.pool {
            RuntimeLocationPool::Postgres(pool) => postgres::upsert_preference(pool, &self.id_generator, context, preference, audit).await,
            RuntimeLocationPool::Sqlite(pool) => sqlite::upsert_preference(pool, &self.id_generator, context, preference, audit).await,
        }
    }
}
