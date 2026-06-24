use sqlx::AnyPool;

use crate::db::columns;
use crate::db::rows::ModelConfigRow;
use crate::error::RepositoryError;

const DEFAULT_CONFIG_KEY: &str = "default";

pub async fn get_model_config(pool: &AnyPool) -> Result<ModelConfigRow, RepositoryError> {
    let sql = format!(
        "SELECT id, config_key, config_json, schema_version, source, updated_at, created_at FROM {} WHERE config_key = ?1",
        columns::model_config::TABLE,
    );
    let row = sqlx::query(&sql)
        .bind(DEFAULT_CONFIG_KEY)
        .fetch_optional(pool)
        .await?;

    let Some(row) = row else {
        return Err(RepositoryError::NotFound("model config not found".to_string()));
    };
    ModelConfigRow::from_row(&row).map_err(Into::into)
}

pub async fn upsert_model_config(
    pool: &AnyPool,
    row: &ModelConfigRow,
) -> Result<(), RepositoryError> {
    let sql = format!(
        "INSERT INTO {} (id, config_key, config_json, schema_version, source, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) ON CONFLICT(config_key) DO UPDATE SET config_json = excluded.config_json, schema_version = excluded.schema_version, source = excluded.source, updated_at = excluded.updated_at",
        columns::model_config::TABLE,
    );
    sqlx::query(&sql)
        .bind(&row.id)
        .bind(&row.config_key)
        .bind(&row.config_json)
        .bind(row.schema_version)
        .bind(&row.source)
        .bind(&row.updated_at)
        .bind(&row.created_at)
        .execute(pool)
        .await?;
    Ok(())
}
