use std::sync::Arc;

use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_database_sqlx::DatabasePool;

use sdkwork_birdcoder_workspace_repository_sqlx::repository::project::SqlxProjectRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project_document_binding::SqlxProjectDocumentBindingRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project_runtime_location::SqlxProjectRuntimeLocationRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project_sandbox_binding::SqlxProjectSandboxBindingRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqlxWorkspaceRepository;

#[derive(Clone)]
pub struct Repositories {
    pub workspace: Arc<SqlxWorkspaceRepository>,
    pub project: Arc<SqlxProjectRepository>,
    pub document_binding: Arc<SqlxProjectDocumentBindingRepository>,
    pub sandbox_binding: Arc<SqlxProjectSandboxBindingRepository>,
    pub runtime_location: Arc<SqlxProjectRuntimeLocationRepository>,
}

pub fn wire_repositories(
    pool: DatabasePool,
    id_generator: SnowflakeIdGenerator,
) -> Repositories {
    Repositories {
        workspace: Arc::new(SqlxWorkspaceRepository::new(
            pool.clone(),
            id_generator.clone(),
        )),
        project: Arc::new(SqlxProjectRepository::new(
            pool.clone(),
            id_generator.clone(),
        )),
        document_binding: Arc::new(SqlxProjectDocumentBindingRepository::new(
            pool.clone(),
            id_generator.clone(),
        )),
        sandbox_binding: Arc::new(SqlxProjectSandboxBindingRepository::new(
            pool.clone(),
            id_generator.clone(),
        )),
        runtime_location: Arc::new(SqlxProjectRuntimeLocationRepository::new(
            pool,
            id_generator,
        )),
    }
}
