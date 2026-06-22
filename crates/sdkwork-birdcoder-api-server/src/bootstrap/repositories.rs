use std::sync::Arc;

use sdkwork_database_sqlx::DatabasePool;
use sqlx::SqlitePool;

use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_document_repository_sqlx::SqliteDocumentRepository;
use sdkwork_birdcoder_membership_repository_sqlx::SqliteMembershipRepository;
use sdkwork_birdcoder_skill_packages_repository_sqlx::SqliteSkillPackageRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::deployment::SqliteDeploymentRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project::SqliteProjectRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::team::SqliteTeamRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqliteWorkspaceRepository;

use crate::bootstrap::database::require_sqlite_pool;

#[derive(Clone)]
pub struct Repositories {
    pub sqlite_pool: SqlitePool,
    pub coding_session: Arc<SqliteCodingSessionRepository>,
    pub workspace: Arc<SqliteWorkspaceRepository>,
    pub project: Arc<SqliteProjectRepository>,
    pub deployment: Arc<SqliteDeploymentRepository>,
    pub team: Arc<SqliteTeamRepository>,
    pub document: Arc<SqliteDocumentRepository>,
    pub skill_package: Arc<SqliteSkillPackageRepository>,
    pub membership: Arc<SqliteMembershipRepository>,
}

pub fn wire_repositories(pool: Arc<DatabasePool>) -> Result<Repositories, String> {
    let sqlite = require_sqlite_pool(&pool).map_err(|_| {
        "BirdCoder product repositories require SQLite. \
         Configure SDKWORK_BIRDCODER_DATABASE_ENGINE=sqlite or omit PostgreSQL until postgres repository support is available."
            .to_string()
    })?;
    Ok(Repositories {
        sqlite_pool: sqlite.clone(),
        coding_session: Arc::new(SqliteCodingSessionRepository::new(sqlite.clone())),
        workspace: Arc::new(SqliteWorkspaceRepository::new(sqlite.clone())),
        project: Arc::new(SqliteProjectRepository::new(sqlite.clone())),
        deployment: Arc::new(SqliteDeploymentRepository::new(sqlite.clone())),
        team: Arc::new(SqliteTeamRepository::new(sqlite.clone())),
        document: Arc::new(SqliteDocumentRepository::new(sqlite.clone())),
        skill_package: Arc::new(SqliteSkillPackageRepository::new(sqlite.clone())),
        membership: Arc::new(SqliteMembershipRepository::new(sqlite)),
    })
}
