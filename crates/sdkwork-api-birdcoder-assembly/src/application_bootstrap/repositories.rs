use std::sync::Arc;

use sdkwork_database_id::{NodeLease, SnowflakeIdGenerator};
use sdkwork_database_sqlx::DatabasePool;
use sqlx::AnyPool;

use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_document_repository_sqlx::SqliteDocumentRepository;
use sdkwork_birdcoder_skill_packages_repository_sqlx::SqliteSkillPackageRepository;
use sdkwork_birdcoder_sqlx_repository_pool::birdcoder_repository_any_pool;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::deployment::SqliteDeploymentRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project::SqliteProjectRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project_sandbox_binding::SqlxProjectSandboxBindingRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::team::SqliteTeamRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqliteWorkspaceRepository;

#[derive(Clone)]
pub struct Repositories {
    pub any_pool: AnyPool,
    pub coding_session: Arc<SqliteCodingSessionRepository>,
    pub workspace: Arc<SqliteWorkspaceRepository>,
    pub project: Arc<SqliteProjectRepository>,
    pub sandbox_binding: Arc<SqlxProjectSandboxBindingRepository>,
    pub deployment: Arc<SqliteDeploymentRepository>,
    pub team: Arc<SqliteTeamRepository>,
    pub document: Arc<SqliteDocumentRepository>,
    pub skill_package: Arc<SqliteSkillPackageRepository>,
    pub id_node_lease: NodeLease,
}

pub async fn wire_repositories(
    pool: Arc<DatabasePool>,
    id_generator: SnowflakeIdGenerator,
    id_node_lease: NodeLease,
) -> Result<Repositories, String> {
    let any_pool = birdcoder_repository_any_pool(pool.as_ref()).await?;

    Ok(Repositories {
        any_pool: any_pool.clone(),
        coding_session: Arc::new(SqliteCodingSessionRepository::new(any_pool.clone())),
        workspace: Arc::new(SqliteWorkspaceRepository::new(any_pool.clone())),
        project: Arc::new(SqliteProjectRepository::new(any_pool.clone())),
        sandbox_binding: Arc::new(SqlxProjectSandboxBindingRepository::new(
            pool.as_ref().clone(),
            id_generator,
        )),
        deployment: Arc::new(SqliteDeploymentRepository::new(any_pool.clone())),
        team: Arc::new(SqliteTeamRepository::new(any_pool.clone())),
        document: Arc::new(SqliteDocumentRepository::new(any_pool.clone())),
        skill_package: Arc::new(SqliteSkillPackageRepository::new(any_pool)),
        id_node_lease,
    })
}
