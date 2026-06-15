use std::path::Path;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqliteWorkspaceRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project::SqliteProjectRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::deployment::SqliteDeploymentRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::team::SqliteTeamRepository;

pub struct Repositories {
    pub coding_session: Arc<SqliteCodingSessionRepository>,
    pub workspace: Arc<SqliteWorkspaceRepository>,
    pub project: Arc<SqliteProjectRepository>,
    pub deployment: Arc<SqliteDeploymentRepository>,
    pub team: Arc<SqliteTeamRepository>,
    pub skill_package_conn: Arc<Mutex<Connection>>,
    pub model_config_conn: Arc<Mutex<Connection>>,
    pub membership_conn: Arc<Mutex<Connection>>,
}

fn open_rw(db_path: &Path) -> Connection {
    let conn = Connection::open(db_path).expect("open sqlite connection");
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .expect("set pragmas");
    conn
}

pub fn wire_repositories(db_path: &Path) -> Repositories {
    Repositories {
        coding_session: Arc::new(SqliteCodingSessionRepository::new(open_rw(db_path))),
        workspace: Arc::new(SqliteWorkspaceRepository::new(open_rw(db_path))),
        project: Arc::new(SqliteProjectRepository::new(open_rw(db_path))),
        deployment: Arc::new(SqliteDeploymentRepository::new(open_rw(db_path))),
        team: Arc::new(SqliteTeamRepository::new(open_rw(db_path))),
        skill_package_conn: Arc::new(Mutex::new(open_rw(db_path))),
        model_config_conn: Arc::new(Mutex::new(open_rw(db_path))),
        membership_conn: Arc::new(Mutex::new(open_rw(db_path))),
    }
}


