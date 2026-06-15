use crate::db::rows::ModelConfigRow;

pub fn config_row_to_json(row: &ModelConfigRow) -> serde_json::Value {
    serde_json::from_str(&row.config_json).unwrap_or(serde_json::Value::Null)
}
