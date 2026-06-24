use sqlx::Row;

#[derive(Clone, Debug)]
pub struct ModelConfigRow {
    pub id: String,
    pub config_key: String,
    pub config_json: String,
    pub schema_version: i64,
    pub source: String,
    pub updated_at: String,
    pub created_at: String,
}

impl ModelConfigRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            config_key: row.try_get("config_key")?,
            config_json: row.try_get("config_json")?,
            schema_version: row.try_get("schema_version")?,
            source: row.try_get("source")?,
            updated_at: row.try_get("updated_at")?,
            created_at: row.try_get("created_at")?,
        })
    }
}
