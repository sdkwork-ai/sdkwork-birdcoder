use rusqlite::Connection;

use crate::bootstrap::config::BirdServerConfig;

pub fn ensure_schema(config: &BirdServerConfig) -> Result<(), Box<dyn std::error::Error>> {
    let conn = Connection::open(&config.sqlite_file)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

    let stmts: Vec<&str> = sdkwork_birdcoder_coding_sessions_repository_sqlite::db::schema::SCHEMA_SQL
        .split(';')
        .filter(|s| !s.trim().is_empty())
        .collect();
    for stmt in stmts {
        conn.execute(stmt, [])
            .map_err(|e| format!("intelligence coding sessions schema: {e}"))?;
    }

    sdkwork_birdcoder_workspace_repository_sqlite::db::schema::initialize_schema(&conn)
        .map_err(|e| format!("platform workspace schema: {e}"))?;

    sdkwork_birdcoder_skill_packages_repository_sqlite::db::schema::initialize_schema(&conn)
        .map_err(|e| format!("ecosystem skill packages schema: {e}"))?;

    sdkwork_birdcoder_model_config_repository_sqlite::db::schema::initialize_schema(&conn)
        .map_err(|e| format!("runtime model config schema: {e}"))?;

    sdkwork_birdcoder_membership_repository_sqlite::db::schema::initialize_schema(&conn)
        .map_err(|e| format!("commerce membership schema: {e}"))?;

    Ok(())
}

