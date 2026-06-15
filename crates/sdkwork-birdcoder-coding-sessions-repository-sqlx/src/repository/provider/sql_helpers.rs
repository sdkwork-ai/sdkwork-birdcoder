use rusqlite::types::ValueRef;

use super::string_helpers::{
    data_scope_name_from_storage_value, normalize_data_scope,
    project_status_name_from_storage_value, project_type_name_from_storage_value,
};

pub fn sqlite_value_ref_to_string(value: ValueRef<'_>) -> Option<String> {
    match value {
        ValueRef::Null => None,
        ValueRef::Integer(integer) => Some(integer.to_string()),
        ValueRef::Real(real) => {
            if real.fract() == 0.0 {
                Some((real as i64).to_string())
            } else {
                Some(real.to_string())
            }
        }
        ValueRef::Text(text) => Some(String::from_utf8_lossy(text).into_owned()),
        ValueRef::Blob(_) => None,
    }
}

pub fn sqlite_row_required_string_value(
    row: &rusqlite::Row<'_>,
    index: usize,
    column_name: &str,
) -> rusqlite::Result<String> {
    let value = row.get_ref(index)?;
    let data_type = value.data_type();
    sqlite_value_ref_to_string(value).ok_or_else(|| {
        rusqlite::Error::FromSqlConversionFailure(
            index,
            data_type,
            Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("sqlite column {column_name} could not be normalized as string"),
            )),
        )
    })
}

pub fn sqlite_row_optional_string_value(
    row: &rusqlite::Row<'_>,
    index: usize,
    column_name: &str,
) -> rusqlite::Result<Option<String>> {
    let value = row.get_ref(index)?;
    let data_type = value.data_type();
    match value {
        ValueRef::Null => Ok(None),
        _ => sqlite_value_ref_to_string(value).map(Some).ok_or_else(|| {
            rusqlite::Error::FromSqlConversionFailure(
                index,
                data_type,
                Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!(
                        "sqlite column {column_name} could not be normalized as optional string"
                    ),
                )),
            )
        }),
    }
}

pub fn sqlite_row_optional_data_scope_value(
    row: &rusqlite::Row<'_>,
    index: usize,
    column_name: &str,
) -> rusqlite::Result<Option<String>> {
    let value = row.get_ref(index)?;
    let data_type = value.data_type();
    let normalized_value = match value {
        ValueRef::Null => return Ok(None),
        ValueRef::Integer(value) => data_scope_name_from_storage_value(value).map(str::to_owned),
        ValueRef::Real(value) if value.fract() == 0.0 => {
            data_scope_name_from_storage_value(value as i64).map(str::to_owned)
        }
        ValueRef::Text(text) => normalize_data_scope(Some(
            String::from_utf8_lossy(text).into_owned(),
        ))
        .map_err(|message| {
            rusqlite::Error::FromSqlConversionFailure(
                index,
                data_type,
                Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    message,
                )),
            )
        })?,
        ValueRef::Blob(_) | ValueRef::Real(_) => None,
    };

    normalized_value
        .ok_or_else(|| {
            rusqlite::Error::FromSqlConversionFailure(
                index,
                data_type,
                Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!(
                        "sqlite column {column_name} could not be normalized as PlusDataScope"
                    ),
                )),
            )
        })
        .map(Some)
}

pub fn sqlite_row_optional_project_type_value(
    row: &rusqlite::Row<'_>,
    index: usize,
    column_name: &str,
) -> rusqlite::Result<Option<String>> {
    let value = row.get_ref(index)?;
    let data_type = value.data_type();
    match value {
        ValueRef::Null => Ok(None),
        ValueRef::Integer(value) => {
            Ok(project_type_name_from_storage_value(value).map(str::to_owned))
        }
        ValueRef::Real(value) if value.fract() == 0.0 => {
            Ok(project_type_name_from_storage_value(value as i64).map(str::to_owned))
        }
        ValueRef::Text(text) => {
            let raw = String::from_utf8_lossy(text).into_owned();
            let trimmed = raw.trim();
            if trimmed.is_empty() {
                Ok(None)
            } else {
                Ok(trimmed
                    .parse::<i64>()
                    .ok()
                    .and_then(project_type_name_from_storage_value)
                    .map(str::to_owned)
                    .or_else(|| Some(raw)))
            }
        }
        ValueRef::Blob(_) | ValueRef::Real(_) => Err(rusqlite::Error::FromSqlConversionFailure(
            index,
            data_type,
            Box::new(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                format!("sqlite column {column_name} could not be normalized as project type"),
            )),
        )),
    }
}

pub fn sqlite_row_required_project_status_value(
    row: &rusqlite::Row<'_>,
    index: usize,
    column_name: &str,
) -> rusqlite::Result<String> {
    let value = row.get_ref(index)?;
    let data_type = value.data_type();
    match value {
        ValueRef::Integer(value) => project_status_name_from_storage_value(value)
            .map(str::to_owned)
            .ok_or_else(|| {
                rusqlite::Error::FromSqlConversionFailure(
                    index,
                    data_type,
                    Box::new(std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        format!("sqlite column {column_name} has unsupported project status"),
                    )),
                )
            }),
        ValueRef::Real(value) if value.fract() == 0.0 => {
            project_status_name_from_storage_value(value as i64)
                .map(str::to_owned)
                .ok_or_else(|| {
                    rusqlite::Error::FromSqlConversionFailure(
                        index,
                        data_type,
                        Box::new(std::io::Error::new(
                            std::io::ErrorKind::InvalidData,
                            format!("sqlite column {column_name} has unsupported project status"),
                        )),
                    )
                })
        }
        ValueRef::Text(text) => {
            let raw = String::from_utf8_lossy(text).into_owned();
            let trimmed = raw.trim();
            if let Ok(value) = trimmed.parse::<i64>() {
                Ok(project_status_name_from_storage_value(value)
                    .unwrap_or("PLANNING")
                    .to_owned())
            } else if trimmed.is_empty() {
                Ok("PLANNING".to_owned())
            } else {
                Ok(raw)
            }
        }
        ValueRef::Null | ValueRef::Blob(_) | ValueRef::Real(_) => {
            Err(rusqlite::Error::FromSqlConversionFailure(
                index,
                data_type,
                Box::new(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!(
                        "sqlite column {column_name} could not be normalized as project status"
                    ),
                )),
            ))
        }
    }
}
