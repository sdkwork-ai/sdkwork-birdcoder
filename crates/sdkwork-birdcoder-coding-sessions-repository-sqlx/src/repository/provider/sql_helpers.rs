use sqlx::Row;

use super::string_helpers::{
    data_scope_name_from_storage_value, normalize_data_scope,
    project_status_name_from_storage_value, project_type_name_from_storage_value,
};

fn value_to_string(value: Option<i64>) -> Option<String> {
    value.map(|integer| integer.to_string())
}

fn optional_string_from_row(
    row: &sqlx::any::AnyRow,
    index: usize,
    column_name: &str,
) -> Result<Option<String>, String> {
    if let Ok(value) = row.try_get::<Option<String>, _>(index) {
        return Ok(value);
    }
    if let Ok(value) = row.try_get::<Option<i64>, _>(index) {
        return Ok(value_to_string(value));
    }
    if let Ok(value) = row.try_get::<Option<f64>, _>(index) {
        return Ok(value.map(|real| {
            if real.fract() == 0.0 {
                (real as i64).to_string()
            } else {
                real.to_string()
            }
        }));
    }
    Err(format!(
        "sqlite column {column_name} could not be normalized as optional string"
    ))
}

pub fn sqlx_row_required_string_value(
    row: &sqlx::any::AnyRow,
    index: usize,
    column_name: &str,
) -> Result<String, String> {
    optional_string_from_row(row, index, column_name)?
        .ok_or_else(|| format!("sqlite column {column_name} could not be normalized as string"))
}

pub fn sqlx_row_optional_string_value(
    row: &sqlx::any::AnyRow,
    index: usize,
    column_name: &str,
) -> Result<Option<String>, String> {
    optional_string_from_row(row, index, column_name)
}

pub fn sqlx_row_optional_data_scope_value(
    row: &sqlx::any::AnyRow,
    index: usize,
    column_name: &str,
) -> Result<Option<String>, String> {
    if let Ok(Some(value)) = row.try_get::<Option<i64>, _>(index) {
        return data_scope_name_from_storage_value(value)
            .map(str::to_owned)
            .ok_or_else(|| {
                format!("sqlite column {column_name} could not be normalized as PlusDataScope")
            })
            .map(Some);
    }
    if let Ok(Some(value)) = row.try_get::<Option<f64>, _>(index) {
        if value.fract() == 0.0 {
            return data_scope_name_from_storage_value(value as i64)
                .map(str::to_owned)
                .ok_or_else(|| {
                    format!("sqlite column {column_name} could not be normalized as PlusDataScope")
                })
                .map(Some);
        }
        return Err(format!(
            "sqlite column {column_name} could not be normalized as PlusDataScope"
        ));
    }
    if let Ok(Some(text)) = row.try_get::<Option<String>, _>(index) {
        return normalize_data_scope(Some(text)).map_err(|message| message.to_string());
    }
    Ok(None)
}

pub fn sqlx_row_optional_project_type_value(
    row: &sqlx::any::AnyRow,
    index: usize,
    column_name: &str,
) -> Result<Option<String>, String> {
    if let Ok(value) = row.try_get::<Option<i64>, _>(index) {
        return Ok(value.and_then(|v| project_type_name_from_storage_value(v).map(str::to_owned)));
    }
    if let Ok(value) = row.try_get::<Option<f64>, _>(index) {
        return Ok(value.and_then(|v| {
            if v.fract() == 0.0 {
                project_type_name_from_storage_value(v as i64).map(str::to_owned)
            } else {
                None
            }
        }));
    }
    if let Ok(Some(raw)) = row.try_get::<Option<String>, _>(index) {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Ok(None);
        }
        return Ok(trimmed
            .parse::<i64>()
            .ok()
            .and_then(project_type_name_from_storage_value)
            .map(str::to_owned)
            .or(Some(raw)));
    }

    Err(format!(
        "sqlite column {column_name} could not be normalized as project type"
    ))
}

pub fn sqlx_row_required_project_status_value(
    row: &sqlx::any::AnyRow,
    index: usize,
    column_name: &str,
) -> Result<String, String> {
    if let Ok(Some(value)) = row.try_get::<Option<i64>, _>(index) {
        return project_status_name_from_storage_value(value)
            .map(str::to_owned)
            .ok_or_else(|| format!("sqlite column {column_name} has unsupported project status"));
    }
    if let Ok(Some(value)) = row.try_get::<Option<f64>, _>(index) {
        if value.fract() == 0.0 {
            return project_status_name_from_storage_value(value as i64)
                .map(str::to_owned)
                .ok_or_else(|| {
                    format!("sqlite column {column_name} has unsupported project status")
                });
        }
    }
    if let Ok(Some(raw)) = row.try_get::<Option<String>, _>(index) {
        let trimmed = raw.trim();
        if let Ok(value) = trimmed.parse::<i64>() {
            return Ok(project_status_name_from_storage_value(value)
                .unwrap_or("PLANNING")
                .to_owned());
        }
        if trimmed.is_empty() {
            return Ok("PLANNING".to_owned());
        }
        return Ok(raw);
    }

    Err(format!(
        "sqlite column {column_name} could not be normalized as project status"
    ))
}
