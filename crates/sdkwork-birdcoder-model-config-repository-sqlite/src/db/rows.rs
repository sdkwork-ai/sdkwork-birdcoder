use rusqlite::Row;

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
    pub fn from_row(row: &Row<'_>) -> rusqlite::Result<Self> {
        Ok(Self {
            id: row.get("id")?,
            config_key: row.get("config_key")?,
            config_json: row.get("config_json")?,
            schema_version: row.get("schema_version")?,
            source: row.get("source")?,
            updated_at: row.get("updated_at")?,
            created_at: row.get("created_at")?,
        })
    }
}
