use rusqlite::{params_from_iter, types::Value as SqlValue, types::ValueRef};
use serde::{Deserialize, Serialize};
use serde_json::{Map as JsonMap, Number as JsonNumber, Value as JsonValue};
use tauri::AppHandle;

use crate::host::state::open_database;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSqlPlanStatement {
    pub sql: String,
    #[serde(default)]
    pub params: Vec<JsonValue>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSqlPlan {
    pub provider_id: String,
    #[allow(dead_code)]
    pub intent: String,
    #[serde(default)]
    pub meta: Option<JsonValue>,
    #[serde(default)]
    pub statements: Vec<LocalSqlPlanStatement>,
    pub transactional: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalSqlExecutionResult {
    pub affected_row_count: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rows: Option<Vec<JsonMap<String, JsonValue>>>,
}

fn json_value_to_sql_value(value: &JsonValue) -> SqlValue {
    match value {
        JsonValue::Null => SqlValue::Null,
        JsonValue::Bool(value) => SqlValue::Integer(if *value { 1 } else { 0 }),
        JsonValue::Number(value) => {
            if let Some(integer_value) = value.as_i64() {
                SqlValue::Integer(integer_value)
            } else if let Some(unsigned_value) = value.as_u64() {
                match i64::try_from(unsigned_value) {
                    Ok(integer_value) => SqlValue::Integer(integer_value),
                    Err(_) => SqlValue::Text(unsigned_value.to_string()),
                }
            } else if let Some(real_value) = value.as_f64() {
                SqlValue::Real(real_value)
            } else {
                SqlValue::Null
            }
        }
        JsonValue::String(value) => SqlValue::Text(value.clone()),
        JsonValue::Array(_) | JsonValue::Object(_) => SqlValue::Text(value.to_string()),
    }
}

fn sqlite_value_to_json(value: ValueRef<'_>) -> JsonValue {
    match value {
        ValueRef::Null => JsonValue::Null,
        ValueRef::Integer(value) => JsonValue::String(value.to_string()),
        ValueRef::Real(value) => JsonNumber::from_f64(value)
            .map(JsonValue::Number)
            .unwrap_or(JsonValue::Null),
        ValueRef::Text(value) => JsonValue::String(String::from_utf8_lossy(value).to_string()),
        ValueRef::Blob(value) => JsonValue::String(String::from_utf8_lossy(value).to_string()),
    }
}

fn normalize_local_sql(sql: &str) -> String {
    sql.trim().trim_end_matches(';').trim().to_string()
}

fn is_local_sql_read_statement(sql: &str) -> bool {
    normalize_local_sql(sql)
        .to_ascii_uppercase()
        .starts_with("SELECT ")
}

fn is_safe_local_sql_identifier(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
}

fn read_local_sql_plan_meta_kind(plan: &LocalSqlPlan) -> Option<&str> {
    plan.meta
        .as_ref()
        .and_then(JsonValue::as_object)
        .and_then(|meta| meta.get("kind"))
        .and_then(JsonValue::as_str)
}

fn read_local_sql_plan_allowed_tables(plan: &LocalSqlPlan) -> Result<Vec<String>, String> {
    let Some(meta) = plan.meta.as_ref().and_then(JsonValue::as_object) else {
        return if plan.statements.is_empty() {
            Ok(Vec::new())
        } else {
            Err("local SQL plan metadata is required for non-empty plans".to_string())
        };
    };
    let table_names = if read_local_sql_plan_meta_kind(plan) == Some("migration") {
        meta.get("tableNames")
            .and_then(JsonValue::as_array)
            .map(|values| {
                values
                    .iter()
                    .filter_map(JsonValue::as_str)
                    .map(str::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default()
    } else {
        meta.get("tableName")
            .and_then(JsonValue::as_str)
            .map(|table_name| vec![table_name.to_string()])
            .unwrap_or_default()
    };
    if plan.statements.is_empty() {
        return Ok(table_names);
    }
    if table_names.is_empty() {
        return Err("local SQL plan metadata must include tableName or tableNames".to_string());
    }
    if table_names
        .iter()
        .any(|table_name| !is_safe_local_sql_identifier(table_name))
    {
        return Err("local SQL plan metadata contains an unsafe table name".to_string());
    }
    Ok(table_names)
}

fn normalize_sql_for_table_match(sql: &str) -> String {
    sql.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_ascii_uppercase()
}

fn local_sql_mentions_allowed_table(sql: &str, allowed_tables: &[String]) -> bool {
    let normalized_sql = normalize_sql_for_table_match(sql);
    let padded_sql = format!(" {normalized_sql} ");
    allowed_tables.iter().any(|table_name| {
        let table_name = table_name.to_ascii_uppercase();
        [
            format!(" FROM {table_name} "),
            format!(" INTO {table_name} "),
            format!(" UPDATE {table_name} "),
            format!(" DELETE FROM {table_name} "),
            format!(" TABLE {table_name} "),
            format!(" TABLE IF NOT EXISTS {table_name} "),
            format!(" ON {table_name} "),
        ]
        .iter()
        .any(|pattern| padded_sql.contains(pattern))
    })
}

fn validate_local_sql_statement(
    sql: &str,
    allowed_tables: &[String],
    allow_create: bool,
) -> Result<String, String> {
    let normalized_sql = normalize_local_sql(sql);
    if normalized_sql.is_empty() {
        return Err("local SQL plan contains an empty statement".to_string());
    }
    if normalized_sql.contains(';') {
        return Err("local SQL plan statements must contain exactly one SQL statement".to_string());
    }
    let upper_sql = normalized_sql.to_ascii_uppercase();
    let allowed_prefixes = ["SELECT ", "INSERT ", "UPDATE ", "DELETE ", "CREATE "];
    if !allowed_prefixes
        .iter()
        .any(|prefix| upper_sql.starts_with(prefix))
    {
        return Err(format!(
            "local SQL plan statement is not allowed: {}",
            upper_sql.split_whitespace().next().unwrap_or("<empty>")
        ));
    }
    if upper_sql.starts_with("CREATE ") && !allow_create {
        return Err("local SQL CREATE statements are only allowed for migration plans".to_string());
    }
    for forbidden_token in ["ATTACH", "DETACH", "DROP", "PRAGMA", "UNION", "VACUUM"] {
        if upper_sql
            .split(|character: char| !character.is_ascii_alphanumeric() && character != '_')
            .any(|token| token == forbidden_token)
        {
            return Err(format!(
                "local SQL plan statement contains forbidden token {forbidden_token}"
            ));
        }
    }
    if !local_sql_mentions_allowed_table(&normalized_sql, allowed_tables) {
        return Err(
            "local SQL plan statement does not target its declared table metadata".to_string(),
        );
    }
    Ok(normalized_sql)
}

fn execute_local_sql_statement(
    connection: &rusqlite::Connection,
    statement: &LocalSqlPlanStatement,
    allowed_tables: &[String],
    allow_create: bool,
) -> Result<(usize, Option<Vec<JsonMap<String, JsonValue>>>), String> {
    let sql = validate_local_sql_statement(&statement.sql, allowed_tables, allow_create)?;
    let params: Vec<SqlValue> = statement
        .params
        .iter()
        .map(json_value_to_sql_value)
        .collect();
    if is_local_sql_read_statement(&sql) {
        let mut prepared_statement = connection
            .prepare(&sql)
            .map_err(|error| format!("failed to prepare local SQL read: {error}"))?;
        let column_names: Vec<String> = prepared_statement
            .column_names()
            .iter()
            .map(|column_name| column_name.to_string())
            .collect();
        let mut rows = prepared_statement
            .query(params_from_iter(params.iter()))
            .map_err(|error| format!("failed to query local SQL read: {error}"))?;
        let mut mapped_rows = Vec::new();
        while let Some(row) = rows
            .next()
            .map_err(|error| format!("failed to read local SQL row: {error}"))?
        {
            let mut mapped_row = JsonMap::new();
            for (column_index, column_name) in column_names.iter().enumerate() {
                let value = row
                    .get_ref(column_index)
                    .map_err(|error| format!("failed to read local SQL column: {error}"))?;
                mapped_row.insert(column_name.clone(), sqlite_value_to_json(value));
            }
            mapped_rows.push(mapped_row);
        }
        return Ok((0, Some(mapped_rows)));
    }
    let affected_row_count = connection
        .execute(&sql, params_from_iter(params.iter()))
        .map_err(|error| format!("failed to execute local SQL write: {error}"))?;
    Ok((affected_row_count, None))
}

fn execute_local_sql_plan(
    connection: &mut rusqlite::Connection,
    plan: &LocalSqlPlan,
) -> Result<LocalSqlExecutionResult, String> {
    if plan.provider_id != "sqlite" {
        return Err(format!(
            "local SQL bridge only supports sqlite plans, received {}",
            plan.provider_id
        ));
    }
    let allowed_tables = read_local_sql_plan_allowed_tables(plan)?;
    let allow_create = read_local_sql_plan_meta_kind(plan) == Some("migration");
    let mut affected_row_count = 0_usize;
    let mut rows = None;
    if plan.transactional {
        let transaction = connection
            .transaction()
            .map_err(|error| format!("failed to start local SQL transaction: {error}"))?;
        for statement in &plan.statements {
            let (statement_affected_row_count, statement_rows) = execute_local_sql_statement(
                &transaction,
                statement,
                &allowed_tables,
                allow_create,
            )?;
            affected_row_count += statement_affected_row_count;
            if statement_rows.is_some() {
                rows = statement_rows;
            }
        }
        transaction
            .commit()
            .map_err(|error| format!("failed to commit local SQL transaction: {error}"))?;
    } else {
        for statement in &plan.statements {
            let (statement_affected_row_count, statement_rows) =
                execute_local_sql_statement(connection, statement, &allowed_tables, allow_create)?;
            affected_row_count += statement_affected_row_count;
            if statement_rows.is_some() {
                rows = statement_rows;
            }
        }
    }
    Ok(LocalSqlExecutionResult {
        affected_row_count,
        rows,
    })
}

#[tauri::command]
pub async fn local_sql_execute_plan(
    app: AppHandle,
    plan: LocalSqlPlan,
) -> Result<LocalSqlExecutionResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut connection = open_database(&app)?;
        execute_local_sql_plan(&mut connection, &plan)
    })
    .await
    .map_err(|error| format!("failed to join local SQL execution task: {error}"))?
}
