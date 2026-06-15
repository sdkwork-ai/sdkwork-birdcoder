use rusqlite::Connection;

use crate::db::columns;
use crate::db::rows::ModelConfigRow;
use crate::error::RepositoryError;

const DEFAULT_CONFIG_KEY: &str = "default";

pub fn get_model_config(conn: &Connection) -> Result<ModelConfigRow, RepositoryError> {
    let sql = format!(
        "SELECT id, config_key, config_json, schema_version, source, updated_at, created_at FROM {} WHERE config_key = ?1",
        columns::model_config::TABLE,
    );
    conn.query_row(&sql, [DEFAULT_CONFIG_KEY], |row| ModelConfigRow::from_row(row))
        .map_err(|e| match e {
            rusqlite::Error::QueryReturnedNoRows => {
                RepositoryError::NotFound("model config not found".to_string())
            }
            other => RepositoryError::Database(other.to_string()),
        })
}

pub fn upsert_model_config(
    conn: &Connection,
    row: &ModelConfigRow,
) -> Result<(), RepositoryError> {
    let sql = format!(
        "INSERT INTO {} (id, config_key, config_json, schema_version, source, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(config_key) DO UPDATE SET config_json = excluded.config_json, schema_version = excluded.schema_version, source = excluded.source, updated_at = excluded.updated_at",
        columns::model_config::TABLE,
    );
    conn.execute(
        &sql,
        rusqlite::params![
            row.id,
            row.config_key,
            row.config_json,
            row.schema_version,
            row.source,
            row.updated_at,
            row.created_at,
        ],
    )?;
    Ok(())
}
