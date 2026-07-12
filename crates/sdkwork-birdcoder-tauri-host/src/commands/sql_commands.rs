use rusqlite::{
    hooks::{AuthAction, AuthContext, Authorization},
    params_from_iter,
    types::Value as SqlValue,
    types::ValueRef,
};
use serde::{Deserialize, Serialize};
use serde_json::{Map as JsonMap, Number as JsonNumber, Value as JsonValue};
use std::collections::HashSet;
use std::sync::OnceLock;
use tauri::AppHandle;

use crate::host::state::open_database;

/// Embedded copy of `database/contract/prefix-registry.json` so the prefix
/// whitelist is fixed at compile time and cannot be tampered with at runtime.
const PREFIX_REGISTRY_JSON: &str =
    include_str!("../../../../database/contract/prefix-registry.json");

static REGISTERED_TABLE_PREFIXES: OnceLock<HashSet<String>> = OnceLock::new();

const MAX_LOCAL_SQL_PLAN_STATEMENTS: usize = 2_048;
const MAX_LOCAL_SQL_STATEMENT_BYTES: usize = 64 * 1_024;
const MAX_LOCAL_SQL_PARAMS_PER_STATEMENT: usize = 2_048;
const MAX_LOCAL_SQL_RESULT_ROWS: usize = 10_000;
const MAX_LOCAL_SQL_RESULT_BYTES: usize = 32 * 1_024 * 1_024;

#[derive(Deserialize)]
struct PrefixRegistry {
    prefixes: Vec<PrefixEntry>,
}

#[derive(Deserialize)]
struct PrefixEntry {
    prefix: String,
}

/// Returns the set of registered table-name prefixes loaded once from the
/// embedded `prefix-registry.json`. Table names that do not start with one of
/// these prefixes are rejected by the SQL plan validator.
fn registered_table_prefixes() -> &'static HashSet<String> {
    REGISTERED_TABLE_PREFIXES.get_or_init(|| {
        let registry: PrefixRegistry = serde_json::from_str(PREFIX_REGISTRY_JSON)
            .expect("embedded prefix-registry.json must be valid");
        registry
            .prefixes
            .into_iter()
            .map(|entry| entry.prefix)
            .collect()
    })
}

/// Checks that a table name starts with one of the registered prefixes from
/// `database/contract/prefix-registry.json`. This replaces the previous
/// heuristic identifier-only check with a strict prefix whitelist.
fn is_registered_table_name(table_name: &str) -> bool {
    let prefixes = registered_table_prefixes();
    prefixes
        .iter()
        .any(|prefix| table_name.starts_with(prefix.as_str()))
}

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

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum LocalSqlPlanKind {
    Migration,
    MigrationHistoryUpsert,
    TableList,
    CodingSessionListByProjectIds,
    ProjectContentListByProjectIds,
    ProjectListByWorkspaceIds,
    ProjectCountByWorkspaceIds,
    CodingSessionMessagesBySessionIds,
    CodingSessionCountFiltered,
    CodingSessionListFiltered,
    CodingSessionMessageMetadataBySessionIds,
    CodingSessionMessagesDeleteByProjectIds,
    CodingSessionMessagesDeleteBySessionIds,
    CodingSessionDeleteByProjectIds,
    TableCount,
    TableFindById,
    TableUpsert,
    TableDelete,
    TableClear,
}

impl LocalSqlPlanKind {
    fn parse(value: &str) -> Option<Self> {
        match value {
            "migration" => Some(Self::Migration),
            "migration-history-upsert" => Some(Self::MigrationHistoryUpsert),
            "table-list" => Some(Self::TableList),
            "coding-session-list-by-project-ids" => Some(Self::CodingSessionListByProjectIds),
            "project-content-list-by-project-ids" => Some(Self::ProjectContentListByProjectIds),
            "project-list-by-workspace-ids" => Some(Self::ProjectListByWorkspaceIds),
            "project-count-by-workspace-ids" => Some(Self::ProjectCountByWorkspaceIds),
            "coding-session-messages-by-session-ids" => {
                Some(Self::CodingSessionMessagesBySessionIds)
            }
            "coding-session-count-filtered" => Some(Self::CodingSessionCountFiltered),
            "coding-session-list-filtered" => Some(Self::CodingSessionListFiltered),
            "coding-session-message-metadata-by-session-ids" => {
                Some(Self::CodingSessionMessageMetadataBySessionIds)
            }
            "coding-session-messages-delete-by-project-ids" => {
                Some(Self::CodingSessionMessagesDeleteByProjectIds)
            }
            "coding-session-messages-delete-by-session-ids" => {
                Some(Self::CodingSessionMessagesDeleteBySessionIds)
            }
            "coding-session-delete-by-project-ids" => Some(Self::CodingSessionDeleteByProjectIds),
            "table-count" => Some(Self::TableCount),
            "table-find-by-id" => Some(Self::TableFindById),
            "table-upsert" => Some(Self::TableUpsert),
            "table-delete" => Some(Self::TableDelete),
            "table-clear" => Some(Self::TableClear),
            _ => None,
        }
    }

    fn expected_intent(self) -> &'static str {
        match self {
            Self::TableList
            | Self::CodingSessionListByProjectIds
            | Self::ProjectContentListByProjectIds
            | Self::ProjectListByWorkspaceIds
            | Self::ProjectCountByWorkspaceIds
            | Self::CodingSessionMessagesBySessionIds
            | Self::CodingSessionCountFiltered
            | Self::CodingSessionListFiltered
            | Self::CodingSessionMessageMetadataBySessionIds
            | Self::TableCount
            | Self::TableFindById => "read",
            Self::Migration
            | Self::MigrationHistoryUpsert
            | Self::CodingSessionMessagesDeleteByProjectIds
            | Self::CodingSessionMessagesDeleteBySessionIds
            | Self::CodingSessionDeleteByProjectIds
            | Self::TableUpsert
            | Self::TableDelete
            | Self::TableClear => "write",
        }
    }

    fn allows_empty_statements(self) -> bool {
        self == Self::TableUpsert
    }

    fn allows_multiple_statements(self) -> bool {
        matches!(self, Self::Migration | Self::TableUpsert)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum LocalSqlStatementKind {
    Select,
    Insert,
    Delete,
    CreateTable,
    CreateIndex,
}

#[derive(Debug)]
struct ValidatedLocalSqlStatement {
    kind: LocalSqlStatementKind,
    sql: String,
}

#[derive(Debug)]
struct ScannedLocalSql {
    contains_string_literal: bool,
    normalized_sql: String,
    tokens: Vec<String>,
}

#[derive(Clone)]
struct LocalSqlAuthorizationProfile {
    allowed_tables: HashSet<String>,
    plan_kind: LocalSqlPlanKind,
    statement_kind: LocalSqlStatementKind,
}

struct LocalSqlAuthorizerGuard<'connection> {
    connection: &'connection rusqlite::Connection,
}

impl Drop for LocalSqlAuthorizerGuard<'_> {
    fn drop(&mut self) {
        self.connection
            .authorizer(None::<fn(AuthContext<'_>) -> Authorization>);
    }
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

fn is_safe_local_sql_identifier(value: &str) -> bool {
    !value.is_empty()
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_')
}

fn read_local_sql_plan_meta(
    plan: &LocalSqlPlan,
) -> Result<&serde_json::Map<String, JsonValue>, String> {
    plan.meta
        .as_ref()
        .and_then(JsonValue::as_object)
        .ok_or_else(|| "local SQL plan metadata is required".to_string())
}

fn read_local_sql_plan_kind(plan: &LocalSqlPlan) -> Result<LocalSqlPlanKind, String> {
    let kind = read_local_sql_plan_meta(plan)?
        .get("kind")
        .and_then(JsonValue::as_str)
        .ok_or_else(|| "local SQL plan metadata must include kind".to_string())?;
    LocalSqlPlanKind::parse(kind)
        .ok_or_else(|| "local SQL plan metadata contains an unsupported kind".to_string())
}

fn read_required_meta_table_name(
    meta: &serde_json::Map<String, JsonValue>,
    field_name: &str,
) -> Result<String, String> {
    meta.get(field_name)
        .and_then(JsonValue::as_str)
        .map(str::to_string)
        .ok_or_else(|| format!("local SQL plan metadata must include {field_name}"))
}

fn read_local_sql_plan_allowed_tables(
    plan: &LocalSqlPlan,
    plan_kind: LocalSqlPlanKind,
) -> Result<Vec<String>, String> {
    let meta = read_local_sql_plan_meta(plan)?;
    let mut table_names = if plan_kind == LocalSqlPlanKind::Migration {
        let values = meta
            .get("tableNames")
            .and_then(JsonValue::as_array)
            .ok_or_else(|| "local SQL migration metadata must include tableNames".to_string())?;
        values
            .iter()
            .map(|value| {
                value.as_str().map(str::to_string).ok_or_else(|| {
                    "local SQL migration tableNames must contain only strings".to_string()
                })
            })
            .collect::<Result<Vec<_>, _>>()?
    } else {
        vec![read_required_meta_table_name(meta, "tableName")?]
    };
    if plan_kind == LocalSqlPlanKind::CodingSessionMessagesDeleteByProjectIds {
        table_names.push(read_required_meta_table_name(meta, "sessionTableName")?);
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
    // Enforce strict prefix whitelist: every declared table name must start
    // with a prefix registered in database/contract/prefix-registry.json.
    // This replaces the previous heuristic that only checked character safety.
    if table_names
        .iter()
        .any(|table_name| !is_registered_table_name(table_name))
    {
        return Err(
            "local SQL plan metadata contains a table name with an unregistered prefix".to_string(),
        );
    }
    table_names.sort();
    table_names.dedup();
    Ok(table_names)
}

fn scan_local_sql(sql: &str) -> Result<ScannedLocalSql, String> {
    let trimmed_sql = sql.trim();
    if trimmed_sql.is_empty() {
        return Err("local SQL plan contains an empty statement".to_string());
    }
    if trimmed_sql.len() > MAX_LOCAL_SQL_STATEMENT_BYTES {
        return Err("local SQL plan statement exceeds the size limit".to_string());
    }

    let bytes = trimmed_sql.as_bytes();
    let mut index = 0_usize;
    let mut terminator_index = None;
    let mut contains_string_literal = false;
    let mut tokens = Vec::new();

    while index < bytes.len() {
        match bytes[index] {
            b'\'' => {
                contains_string_literal = true;
                index += 1;
                let mut terminated = false;
                while index < bytes.len() {
                    if bytes[index] == b'\'' {
                        if index + 1 < bytes.len() && bytes[index + 1] == b'\'' {
                            index += 2;
                            continue;
                        }
                        index += 1;
                        terminated = true;
                        break;
                    }
                    index += 1;
                }
                if !terminated {
                    return Err(
                        "local SQL plan contains an unterminated string literal".to_string()
                    );
                }
            }
            b'"' | b'`' | b'[' => {
                return Err("local SQL plan statements must use unquoted identifiers".to_string());
            }
            b'-' if index + 1 < bytes.len() && bytes[index + 1] == b'-' => {
                return Err("local SQL plan statements must not contain comments".to_string());
            }
            b'/' if index + 1 < bytes.len() && bytes[index + 1] == b'*' => {
                return Err("local SQL plan statements must not contain comments".to_string());
            }
            b';' => {
                if terminator_index.is_some() || !trimmed_sql[index + 1..].trim().is_empty() {
                    return Err(
                        "local SQL plan statements must contain exactly one SQL statement"
                            .to_string(),
                    );
                }
                terminator_index = Some(index);
                index += 1;
            }
            byte if byte == b'_' || byte.is_ascii_alphabetic() => {
                let token_start = index;
                index += 1;
                while index < bytes.len()
                    && (bytes[index] == b'_' || bytes[index].is_ascii_alphanumeric())
                {
                    index += 1;
                }
                tokens.push(trimmed_sql[token_start..index].to_ascii_uppercase());
            }
            0 => {
                return Err("local SQL plan statements must not contain NUL bytes".to_string());
            }
            _ => index += 1,
        }
    }

    let normalized_sql = terminator_index
        .map(|terminator| trimmed_sql[..terminator].trim())
        .unwrap_or(trimmed_sql)
        .to_string();
    if normalized_sql.is_empty() {
        return Err("local SQL plan contains an empty statement".to_string());
    }
    Ok(ScannedLocalSql {
        contains_string_literal,
        normalized_sql,
        tokens,
    })
}

fn validate_local_sql_statement(
    sql: &str,
    plan_kind: LocalSqlPlanKind,
) -> Result<ValidatedLocalSqlStatement, String> {
    let scanned = scan_local_sql(sql)?;
    for forbidden_token in [
        "ALTER",
        "ANALYZE",
        "ATTACH",
        "DETACH",
        "DROP",
        "JOIN",
        "PRAGMA",
        "REINDEX",
        "TEMP",
        "TEMPORARY",
        "TRANSACTION",
        "TRIGGER",
        "UNION",
        "VACUUM",
        "VIEW",
        "VIRTUAL",
        "WITH",
    ] {
        if scanned.tokens.iter().any(|token| token == forbidden_token) {
            return Err(format!(
                "local SQL plan statement contains forbidden token {forbidden_token}"
            ));
        }
    }
    let statement_kind = match scanned.tokens.as_slice() {
        [first, ..] if first == "SELECT" => LocalSqlStatementKind::Select,
        [first, ..] if first == "INSERT" => LocalSqlStatementKind::Insert,
        [first, ..] if first == "DELETE" => LocalSqlStatementKind::Delete,
        [first, second, ..] if first == "CREATE" && second == "TABLE" => {
            LocalSqlStatementKind::CreateTable
        }
        [first, second, ..] if first == "CREATE" && second == "INDEX" => {
            LocalSqlStatementKind::CreateIndex
        }
        [first, second, third, ..]
            if first == "CREATE" && second == "UNIQUE" && third == "INDEX" =>
        {
            LocalSqlStatementKind::CreateIndex
        }
        _ => {
            return Err("local SQL plan statement type is not allowed".to_string());
        }
    };
    let statement_matches_plan = match plan_kind {
        LocalSqlPlanKind::Migration => matches!(
            statement_kind,
            LocalSqlStatementKind::CreateTable | LocalSqlStatementKind::CreateIndex
        ),
        LocalSqlPlanKind::MigrationHistoryUpsert | LocalSqlPlanKind::TableUpsert => {
            statement_kind == LocalSqlStatementKind::Insert
        }
        LocalSqlPlanKind::CodingSessionMessagesDeleteByProjectIds
        | LocalSqlPlanKind::CodingSessionMessagesDeleteBySessionIds
        | LocalSqlPlanKind::CodingSessionDeleteByProjectIds
        | LocalSqlPlanKind::TableDelete
        | LocalSqlPlanKind::TableClear => statement_kind == LocalSqlStatementKind::Delete,
        LocalSqlPlanKind::TableList
        | LocalSqlPlanKind::CodingSessionListByProjectIds
        | LocalSqlPlanKind::ProjectContentListByProjectIds
        | LocalSqlPlanKind::ProjectListByWorkspaceIds
        | LocalSqlPlanKind::ProjectCountByWorkspaceIds
        | LocalSqlPlanKind::CodingSessionMessagesBySessionIds
        | LocalSqlPlanKind::CodingSessionCountFiltered
        | LocalSqlPlanKind::CodingSessionListFiltered
        | LocalSqlPlanKind::CodingSessionMessageMetadataBySessionIds
        | LocalSqlPlanKind::TableCount
        | LocalSqlPlanKind::TableFindById => statement_kind == LocalSqlStatementKind::Select,
    };
    if !statement_matches_plan {
        return Err("local SQL plan statement does not match its metadata kind".to_string());
    }
    if plan_kind != LocalSqlPlanKind::Migration && scanned.contains_string_literal {
        return Err(
            "local SQL plan values must use bound parameters instead of SQL literals".to_string(),
        );
    }
    Ok(ValidatedLocalSqlStatement {
        kind: statement_kind,
        sql: scanned.normalized_sql,
    })
}

fn is_allowed_local_sql_table(table_name: &str, allowed_tables: &HashSet<String>) -> bool {
    allowed_tables.contains(&table_name.to_ascii_lowercase())
}

fn is_sqlite_schema_table(table_name: &str) -> bool {
    table_name.eq_ignore_ascii_case("sqlite_master")
        || table_name.eq_ignore_ascii_case("sqlite_schema")
}

fn is_allowed_local_sql_index_name(index_name: &str) -> bool {
    is_safe_local_sql_identifier(index_name)
        && (index_name.starts_with("idx_") || index_name.starts_with("uk_"))
}

fn is_sqlite_autoindex_for_table(index_name: &str, table_name: &str) -> bool {
    let prefix = format!("sqlite_autoindex_{table_name}_");
    let Some(suffix) = index_name.strip_prefix(&prefix) else {
        return false;
    };
    !suffix.is_empty() && suffix.chars().all(|character| character.is_ascii_digit())
}

fn authorize_local_sql_action(
    context: AuthContext<'_>,
    profile: &LocalSqlAuthorizationProfile,
) -> Authorization {
    if context
        .database_name
        .is_some_and(|database_name| !database_name.eq_ignore_ascii_case("main"))
        || context.accessor.is_some()
    {
        return Authorization::Deny;
    }

    let allow_schema_write = matches!(
        profile.statement_kind,
        LocalSqlStatementKind::CreateTable | LocalSqlStatementKind::CreateIndex
    );
    match context.action {
        AuthAction::Select => match profile.statement_kind {
            LocalSqlStatementKind::Select | LocalSqlStatementKind::Delete => Authorization::Allow,
            _ => Authorization::Deny,
        },
        AuthAction::Read { table_name, .. } => {
            if is_allowed_local_sql_table(table_name, &profile.allowed_tables)
                || (allow_schema_write && is_sqlite_schema_table(table_name))
            {
                Authorization::Allow
            } else {
                Authorization::Deny
            }
        }
        AuthAction::Insert { table_name } => {
            let allowed_insert = profile.statement_kind == LocalSqlStatementKind::Insert
                && is_allowed_local_sql_table(table_name, &profile.allowed_tables);
            if allowed_insert || (allow_schema_write && is_sqlite_schema_table(table_name)) {
                Authorization::Allow
            } else {
                Authorization::Deny
            }
        }
        AuthAction::Update { table_name, .. } => {
            let allowed_upsert = profile.plan_kind == LocalSqlPlanKind::TableUpsert
                && is_allowed_local_sql_table(table_name, &profile.allowed_tables);
            if allowed_upsert || (allow_schema_write && is_sqlite_schema_table(table_name)) {
                Authorization::Allow
            } else {
                Authorization::Deny
            }
        }
        AuthAction::Delete { table_name } => {
            if profile.statement_kind == LocalSqlStatementKind::Delete
                && is_allowed_local_sql_table(table_name, &profile.allowed_tables)
            {
                Authorization::Allow
            } else {
                Authorization::Deny
            }
        }
        AuthAction::CreateTable { table_name } => {
            if profile.statement_kind == LocalSqlStatementKind::CreateTable
                && is_allowed_local_sql_table(table_name, &profile.allowed_tables)
            {
                Authorization::Allow
            } else {
                Authorization::Deny
            }
        }
        AuthAction::CreateIndex {
            index_name,
            table_name,
        } => {
            let table_is_allowed = is_allowed_local_sql_table(table_name, &profile.allowed_tables);
            let explicit_index_is_allowed = profile.statement_kind
                == LocalSqlStatementKind::CreateIndex
                && is_allowed_local_sql_index_name(index_name);
            let table_autoindex_is_allowed = profile.statement_kind
                == LocalSqlStatementKind::CreateTable
                && is_sqlite_autoindex_for_table(index_name, table_name);
            if table_is_allowed && (explicit_index_is_allowed || table_autoindex_is_allowed) {
                Authorization::Allow
            } else {
                Authorization::Deny
            }
        }
        AuthAction::Function { function_name } => {
            let allowed_function = matches!(profile.statement_kind, LocalSqlStatementKind::Select)
                && ["count", "like", "max"]
                    .iter()
                    .any(|allowed| function_name.eq_ignore_ascii_case(allowed));
            if allowed_function {
                Authorization::Allow
            } else {
                Authorization::Deny
            }
        }
        AuthAction::Reindex { index_name } => {
            if profile.statement_kind == LocalSqlStatementKind::CreateIndex
                && is_allowed_local_sql_index_name(index_name)
            {
                Authorization::Allow
            } else {
                Authorization::Deny
            }
        }
        _ => Authorization::Deny,
    }
}

fn install_local_sql_authorizer<'connection>(
    connection: &'connection rusqlite::Connection,
    allowed_tables: &[String],
    plan_kind: LocalSqlPlanKind,
    statement_kind: LocalSqlStatementKind,
) -> LocalSqlAuthorizerGuard<'connection> {
    let profile = LocalSqlAuthorizationProfile {
        allowed_tables: allowed_tables
            .iter()
            .map(|table_name| table_name.to_ascii_lowercase())
            .collect(),
        plan_kind,
        statement_kind,
    };
    connection.authorizer(Some(move |context: AuthContext<'_>| -> Authorization {
        authorize_local_sql_action(context, &profile)
    }));
    LocalSqlAuthorizerGuard { connection }
}

fn sqlite_value_size(value: ValueRef<'_>) -> usize {
    match value {
        ValueRef::Null => 0,
        ValueRef::Integer(_) | ValueRef::Real(_) => std::mem::size_of::<i64>(),
        ValueRef::Text(value) | ValueRef::Blob(value) => value.len(),
    }
}

fn execute_local_sql_statement(
    connection: &rusqlite::Connection,
    statement: &LocalSqlPlanStatement,
    allowed_tables: &[String],
    plan_kind: LocalSqlPlanKind,
) -> Result<LocalSqlExecutionResult, String> {
    if statement.params.len() > MAX_LOCAL_SQL_PARAMS_PER_STATEMENT {
        return Err("local SQL plan statement exceeds the parameter limit".to_string());
    }
    let validated = validate_local_sql_statement(&statement.sql, plan_kind)?;
    let params: Vec<SqlValue> = statement
        .params
        .iter()
        .map(json_value_to_sql_value)
        .collect();
    let _authorizer =
        install_local_sql_authorizer(connection, allowed_tables, plan_kind, validated.kind);
    if validated.kind == LocalSqlStatementKind::Select {
        let mut prepared_statement = connection
            .prepare(&validated.sql)
            .map_err(|_| "failed to prepare validated local SQL read".to_string())?;
        let column_names: Vec<String> = prepared_statement
            .column_names()
            .iter()
            .map(|column_name| column_name.to_string())
            .collect();
        let mut rows = prepared_statement
            .query(params_from_iter(params.iter()))
            .map_err(|_| "failed to query validated local SQL read".to_string())?;
        let mut mapped_rows = Vec::new();
        let mut mapped_result_bytes = 0_usize;
        while let Some(row) = rows
            .next()
            .map_err(|_| "failed to read validated local SQL row".to_string())?
        {
            if mapped_rows.len() >= MAX_LOCAL_SQL_RESULT_ROWS {
                return Err("local SQL query result exceeds the row limit".to_string());
            }
            let mut mapped_row = JsonMap::new();
            for (column_index, column_name) in column_names.iter().enumerate() {
                let value = row
                    .get_ref(column_index)
                    .map_err(|_| "failed to read validated local SQL column".to_string())?;
                mapped_result_bytes = mapped_result_bytes
                    .saturating_add(column_name.len())
                    .saturating_add(sqlite_value_size(value));
                if mapped_result_bytes > MAX_LOCAL_SQL_RESULT_BYTES {
                    return Err("local SQL query result exceeds the byte limit".to_string());
                }
                mapped_row.insert(column_name.clone(), sqlite_value_to_json(value));
            }
            mapped_rows.push(mapped_row);
        }
        return Ok(LocalSqlExecutionResult {
            affected_row_count: 0,
            rows: Some(mapped_rows),
        });
    }
    let affected_row_count = connection
        .execute(&validated.sql, params_from_iter(params.iter()))
        .map_err(|_| "failed to execute validated local SQL write".to_string())?;
    Ok(LocalSqlExecutionResult {
        affected_row_count,
        rows: None,
    })
}

fn execute_local_sql_plan(
    connection: &mut rusqlite::Connection,
    plan: &LocalSqlPlan,
) -> Result<LocalSqlExecutionResult, String> {
    if plan.provider_id != "sqlite" {
        return Err("local SQL bridge only supports sqlite plans".to_string());
    }
    if plan.statements.len() > MAX_LOCAL_SQL_PLAN_STATEMENTS {
        return Err("local SQL plan exceeds the statement limit".to_string());
    }
    let plan_kind = read_local_sql_plan_kind(plan)?;
    if plan.intent != plan_kind.expected_intent() {
        return Err("local SQL plan intent does not match its metadata kind".to_string());
    }
    if plan.statements.is_empty() && !plan_kind.allows_empty_statements() {
        return Err("local SQL plan kind requires at least one statement".to_string());
    }
    if plan.statements.len() > 1 && !plan_kind.allows_multiple_statements() {
        return Err("local SQL plan kind requires exactly one statement".to_string());
    }
    let should_be_transactional = plan.intent == "write" && !plan.statements.is_empty();
    if plan.transactional != should_be_transactional {
        return Err("local SQL plan transaction mode does not match its intent".to_string());
    }
    let allowed_tables = read_local_sql_plan_allowed_tables(plan, plan_kind)?;
    let mut affected_row_count = 0_usize;
    let mut rows = None;
    if plan.transactional {
        let transaction = connection
            .transaction()
            .map_err(|_| "failed to start local SQL transaction".to_string())?;
        for statement in &plan.statements {
            let statement_result =
                execute_local_sql_statement(&transaction, statement, &allowed_tables, plan_kind)?;
            affected_row_count += statement_result.affected_row_count;
            if statement_result.rows.is_some() {
                rows = statement_result.rows;
            }
        }
        transaction
            .commit()
            .map_err(|_| "failed to commit local SQL transaction".to_string())?;
    } else {
        for statement in &plan.statements {
            let statement_result =
                execute_local_sql_statement(connection, statement, &allowed_tables, plan_kind)?;
            affected_row_count += statement_result.affected_row_count;
            if statement_result.rows.is_some() {
                rows = statement_result.rows;
            }
        }
    }
    Ok(LocalSqlExecutionResult {
        affected_row_count,
        rows,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn plan(
        intent: &str,
        meta: JsonValue,
        statements: Vec<LocalSqlPlanStatement>,
        transactional: bool,
    ) -> LocalSqlPlan {
        LocalSqlPlan {
            provider_id: "sqlite".to_string(),
            intent: intent.to_string(),
            meta: Some(meta),
            statements,
            transactional,
        }
    }

    #[test]
    fn rejects_comment_based_table_reference_bypass() {
        let error = validate_local_sql_statement(
            "SELECT * FROM ai_coding_session JOIN/* hidden */ops_audit_event ON 1 = 1;",
            LocalSqlPlanKind::TableList,
        )
        .expect_err("comments must be rejected before SQL authorization");
        assert!(error.contains("comments"));
    }

    #[test]
    fn sqlite_authorizer_rejects_undeclared_table_reads() {
        let connection = rusqlite::Connection::open_in_memory().expect("in-memory sqlite");
        connection
            .execute_batch(
                "CREATE TABLE ai_coding_session (id TEXT PRIMARY KEY);\n\
                 CREATE TABLE ops_audit_event (id TEXT PRIMARY KEY);",
            )
            .expect("test schema");
        let statement = LocalSqlPlanStatement {
            sql: "SELECT * FROM ai_coding_session, ops_audit_event;".to_string(),
            params: Vec::new(),
        };

        let result = execute_local_sql_statement(
            &connection,
            &statement,
            &["ai_coding_session".to_string()],
            LocalSqlPlanKind::TableList,
        );

        assert!(result.is_err(), "undeclared table reads must be denied");
    }

    #[test]
    fn rejects_read_intent_for_write_plan_kind() {
        let mut connection = rusqlite::Connection::open_in_memory().expect("in-memory sqlite");
        connection
            .execute_batch("CREATE TABLE ai_coding_session (id TEXT PRIMARY KEY);")
            .expect("test schema");
        let plan = plan(
            "read",
            json!({ "kind": "table-delete", "tableName": "ai_coding_session" }),
            vec![LocalSqlPlanStatement {
                sql: "DELETE FROM ai_coding_session WHERE id = ?1;".to_string(),
                params: vec![json!("session-1")],
            }],
            false,
        );

        let error = execute_local_sql_plan(&mut connection, &plan)
            .expect_err("read intent must not authorize writes");
        assert!(error.contains("intent"));
    }

    #[test]
    fn allows_registered_table_and_index_migration() {
        let mut connection = rusqlite::Connection::open_in_memory().expect("in-memory sqlite");
        let plan = plan(
            "write",
            json!({
                "kind": "migration",
                "migrationIds": ["runtime-test-v1"],
                "tableNames": ["ops_terminal_execution"]
            }),
            vec![
                LocalSqlPlanStatement {
                    sql: "CREATE TABLE IF NOT EXISTS ops_terminal_execution (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'ACTIVE');".to_string(),
                    params: Vec::new(),
                },
                LocalSqlPlanStatement {
                    sql: "CREATE INDEX IF NOT EXISTS idx_ops_terminal_execution_status ON ops_terminal_execution (status);".to_string(),
                    params: Vec::new(),
                },
            ],
            true,
        );

        execute_local_sql_plan(&mut connection, &plan).expect("valid migration plan");
        let index_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_ops_terminal_execution_status'",
                [],
                |row| row.get(0),
            )
            .expect("created index count");
        assert_eq!(index_count, 1);
    }

    #[test]
    fn allows_parameterized_upsert_with_conflict_update() {
        let mut connection = rusqlite::Connection::open_in_memory().expect("in-memory sqlite");
        connection
            .execute_batch(
                "CREATE TABLE ai_coding_session (id TEXT PRIMARY KEY, status TEXT NOT NULL);",
            )
            .expect("test schema");
        connection
            .execute(
                "INSERT INTO ai_coding_session (id, status) VALUES (?1, ?2)",
                ["session-1", "pending"],
            )
            .expect("seed row");
        let plan = plan(
            "write",
            json!({ "kind": "table-upsert", "tableName": "ai_coding_session" }),
            vec![LocalSqlPlanStatement {
                sql: "INSERT INTO ai_coding_session (id, status) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET status = excluded.status;".to_string(),
                params: vec![json!("session-1"), json!("completed")],
            }],
            true,
        );

        execute_local_sql_plan(&mut connection, &plan).expect("valid upsert plan");
        let status: String = connection
            .query_row(
                "SELECT status FROM ai_coding_session WHERE id = 'session-1'",
                [],
                |row| row.get(0),
            )
            .expect("updated status");
        assert_eq!(status, "completed");
    }

    #[test]
    fn allows_declared_secondary_table_for_project_session_delete() {
        let mut connection = rusqlite::Connection::open_in_memory().expect("in-memory sqlite");
        connection
            .execute_batch(
                "CREATE TABLE ai_coding_session (id TEXT PRIMARY KEY, project_id TEXT NOT NULL);\n\
                 CREATE TABLE ai_coding_session_message (id TEXT PRIMARY KEY, coding_session_id TEXT NOT NULL);\n\
                 INSERT INTO ai_coding_session (id, project_id) VALUES ('session-1', 'project-1');\n\
                 INSERT INTO ai_coding_session_message (id, coding_session_id) VALUES ('message-1', 'session-1');",
            )
            .expect("test schema");
        let plan = plan(
            "write",
            json!({
                "kind": "coding-session-messages-delete-by-project-ids",
                "projectIds": ["project-1"],
                "sessionTableName": "ai_coding_session",
                "tableName": "ai_coding_session_message"
            }),
            vec![LocalSqlPlanStatement {
                sql: "DELETE FROM ai_coding_session_message WHERE coding_session_id IN (SELECT id FROM ai_coding_session WHERE project_id IN (?1));".to_string(),
                params: vec![json!("project-1")],
            }],
            true,
        );

        execute_local_sql_plan(&mut connection, &plan).expect("valid two-table delete plan");
        let message_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM ai_coding_session_message",
                [],
                |row| row.get(0),
            )
            .expect("remaining message count");
        assert_eq!(message_count, 0);
    }

    #[test]
    fn rejects_inline_literals_outside_migrations() {
        let error = validate_local_sql_statement(
            "SELECT * FROM ai_coding_session WHERE id = 'session-1';",
            LocalSqlPlanKind::TableFindById,
        )
        .expect_err("renderer values must be bound parameters");
        assert!(error.contains("bound parameters"));
    }

    #[test]
    fn rejects_multiple_trailing_statement_terminators() {
        let error = validate_local_sql_statement(
            "SELECT * FROM ai_coding_session;;",
            LocalSqlPlanKind::TableList,
        )
        .expect_err("multiple terminators must not be normalized away");
        assert!(error.contains("exactly one SQL statement"));
    }
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
