use crate::repository::provider::constants::BOOTSTRAP_WORKSPACE_OWNER_USER_ID;

pub fn normalize_required_string(value: String) -> Option<String> {
    let normalized = value.trim().to_owned();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

pub fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(normalize_required_string)
}

pub fn optional_long_integer_json_string(value: Option<i64>) -> Option<String> {
    value.map(|entry| entry.to_string())
}

pub fn parse_optional_json_value(
    raw: Option<String>,
    context: &str,
) -> Result<Option<serde_json::Value>, String> {
    match normalize_optional_string(raw) {
        Some(raw) => parse_json_value(&raw, context).map(Some),
        None => Ok(None),
    }
}

fn parse_json_value(raw: &str, context: &str) -> Result<serde_json::Value, String> {
    serde_json::from_str(raw).map_err(|error| format!("parse {context} json failed: {error}"))
}

pub fn decode_optional_sqlite_bool(value: Option<i64>) -> Option<bool> {
    value.map(|entry| entry != 0)
}

pub fn normalize_optional_storage_timestamp_value(value: Option<String>) -> Option<String> {
    value.and_then(|timestamp| normalize_storage_timestamp_value(timestamp.as_str()))
}

fn normalize_storage_timestamp_value(timestamp: &str) -> Option<String> {
    parse_storage_timestamp_millis(timestamp).map(storage_timestamp_from_millis)
}

fn parse_storage_timestamp_millis(timestamp: &str) -> Option<i64> {
    let trimmed = timestamp.trim();
    if trimmed.is_empty() {
        return None;
    }
    if let Ok(millis) = trimmed.parse::<i64>() {
        if millis > 0 {
            return Some(millis);
        }
    }
    if let Ok(parsed) = time::OffsetDateTime::parse(
        trimmed,
        &time::format_description::well_known::Iso8601::DEFAULT,
    ) {
        return Some(parsed.unix_timestamp() * 1000 + parsed.millisecond() as i64);
    }
    None
}

fn storage_timestamp_from_millis(value: i64) -> String {
    if value <= 0 {
        return "1970-01-01T00:00:00Z".to_owned();
    }
    let seconds = value / 1000;
    let millis = value % 1000;
    if let Ok(datetime) = time::OffsetDateTime::from_unix_timestamp(seconds) {
        let nanos = (millis * 1_000_000) as u32;
        let datetime = datetime.replace_nanosecond(nanos).unwrap_or(datetime);
        datetime
            .format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
    } else {
        "1970-01-01T00:00:00Z".to_owned()
    }
}

pub fn normalize_optional_identifier(value: Option<&str>) -> Option<String> {
    value.and_then(|candidate| normalize_required_string(candidate.to_owned()))
}

pub fn resolve_effective_user_authority(
    owner_id: Option<&str>,
    leader_id: Option<&str>,
    created_by_user_id: Option<&str>,
    fallback_owner_id: Option<&str>,
    fallback_leader_id: Option<&str>,
    fallback_created_by_user_id: Option<&str>,
) -> (String, String, String) {
    let owner_id = normalize_optional_identifier(owner_id)
        .or_else(|| normalize_optional_identifier(created_by_user_id))
        .or_else(|| normalize_optional_identifier(fallback_owner_id))
        .or_else(|| normalize_optional_identifier(fallback_created_by_user_id))
        .unwrap_or_else(|| BOOTSTRAP_WORKSPACE_OWNER_USER_ID.to_owned());
    let leader_id = normalize_optional_identifier(leader_id)
        .or_else(|| normalize_optional_identifier(fallback_leader_id))
        .unwrap_or_else(|| owner_id.clone());
    let created_by_user_id = normalize_optional_identifier(created_by_user_id)
        .or_else(|| normalize_optional_identifier(fallback_created_by_user_id))
        .unwrap_or_else(|| owner_id.clone());
    (owner_id, leader_id, created_by_user_id)
}

pub fn parse_project_root_path_from_config_data(
    raw: Option<String>,
) -> Result<Option<String>, String> {
    let Some(config_data) = parse_optional_json_value(raw, "project content config_data")? else {
        return Ok(None);
    };
    let Some(config) = config_data.as_object() else {
        return Ok(None);
    };
    Ok(config
        .get("rootPath")
        .or_else(|| config.get("root_path"))
        .and_then(|value| value.as_str())
        .and_then(|value| normalize_optional_string(Some(value.to_owned()))))
}

pub fn normalize_data_scope(value: Option<String>) -> Result<Option<String>, &'static str> {
    let Some(scope) = normalize_optional_string(value) else {
        return Ok(None);
    };
    let normalized_scope = match scope.to_ascii_uppercase().as_str() {
        "0" | "DEFAULT" => "DEFAULT",
        "1" | "PRIVATE" => "PRIVATE",
        "2" | "ORGANIZATION" => "ORGANIZATION",
        "3" | "TENANT" => "TENANT",
        "4" | "PUBLIC" => "PUBLIC",
        _ => {
            return Err(
                "dataScope must be DEFAULT, PRIVATE, ORGANIZATION, TENANT, PUBLIC, or 0-4.",
            )
        }
    };

    Ok(Some(normalized_scope.to_owned()))
}

pub fn data_scope_storage_value(value: &str) -> i64 {
    match value.to_ascii_uppercase().as_str() {
        "0" | "DEFAULT" => 0,
        "2" | "ORGANIZATION" => 2,
        "3" | "TENANT" => 3,
        "4" | "PUBLIC" => 4,
        _ => super::constants::SQLITE_DEFAULT_PRIVATE_DATA_SCOPE_VALUE,
    }
}

pub fn data_scope_name_from_storage_value(value: i64) -> Option<&'static str> {
    match value {
        0 => Some("DEFAULT"),
        1 => Some("PRIVATE"),
        2 => Some("ORGANIZATION"),
        3 => Some("TENANT"),
        4 => Some("PUBLIC"),
        _ => None,
    }
}

pub fn project_type_storage_value(value: Option<&str>) -> i64 {
    match value.map(str::trim).filter(|value| !value.is_empty()) {
        Some("0" | "NONE") => 0,
        Some("2" | "PPT") => 2,
        Some("3" | "APP_HTML") => 3,
        Some("4" | "APP_VUE") => 4,
        Some("5" | "APP_FLUTTER") => 5,
        Some("6" | "APP_UNIAPP") => 6,
        Some("7" | "APP_REACT" | "APP") => 7,
        Some("8" | "APP_UNITY") => 8,
        Some("30" | "VIDEO") => 30,
        Some("40" | "POSTER") => 40,
        Some(value) => value.parse::<i64>().unwrap_or(1),
        None => 1,
    }
}

pub fn project_type_name_from_storage_value(value: i64) -> Option<&'static str> {
    match value {
        0 => Some("NONE"),
        1 => Some("SDK"),
        2 => Some("PPT"),
        3 => Some("APP_HTML"),
        4 => Some("APP_VUE"),
        5 => Some("APP_FLUTTER"),
        6 => Some("APP_UNIAPP"),
        7 => Some("APP_REACT"),
        8 => Some("APP_UNITY"),
        30 => Some("VIDEO"),
        40 => Some("POSTER"),
        _ => None,
    }
}

pub fn project_status_storage_value(value: Option<&str>) -> i64 {
    match value.map(str::trim).filter(|value| !value.is_empty()) {
        Some("2" | "IN_PROGRESS" | "active" | "ACTIVE") => 2,
        Some("3" | "SUSPENDED" | "PAUSED" | "paused") => 3,
        Some("4" | "COMPLETED") => 4,
        Some("5" | "CANCELED" | "CANCELLED" | "archived" | "ARCHIVED") => 5,
        Some(value) => value.parse::<i64>().unwrap_or(1),
        None => 1,
    }
}

pub fn project_status_name_from_storage_value(value: i64) -> Option<&'static str> {
    match value {
        1 => Some("PLANNING"),
        2 => Some("IN_PROGRESS"),
        3 => Some("SUSPENDED"),
        4 => Some("COMPLETED"),
        5 => Some("CANCELED"),
        _ => None,
    }
}

pub fn build_project_config_data(root_path: Option<&str>) -> Option<String> {
    root_path
        .and_then(|value| normalize_optional_string(Some(value.to_owned())))
        .map(|value| serde_json::json!({ "rootPath": value }).to_string())
}
