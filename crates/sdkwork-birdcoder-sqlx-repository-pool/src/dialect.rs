//! Cross-engine SQL helpers for BirdCoder `sqlx::AnyPool` repositories.
//!
//! PostgreSQL uses `BOOLEAN` for `is_deleted`; SQLite uses `INTEGER`. Predicate
//! `is_deleted IS NOT TRUE` is valid on both engines.

use sqlx::Row;

/// Portable soft-delete filter for `WHERE` clauses.
pub const IS_NOT_DELETED: &str = "is_deleted IS NOT TRUE";

/// Portable soft-delete filter with a table alias or qualifier (`s.is_deleted IS NOT TRUE`).
pub fn qualified_is_not_deleted(qualifier: &str) -> String {
    format!("{qualifier}.is_deleted IS NOT TRUE")
}

/// Portable soft-delete assignment for `UPDATE` clauses (SQLite + PostgreSQL).
pub const SET_SOFT_DELETED: &str = "is_deleted = TRUE";

/// Portable truth test for boolean flags (`is_public`, `resumable`, etc.).
pub fn qualified_is_true(column: &str) -> String {
    format!("{column} IS TRUE")
}

/// Portable active-row literal for `INSERT` bind parameters (`0` on SQLite, `false` on PG).
pub const INSERT_NOT_DELETED: i64 = 0;

/// Reads a boolean column from an `AnyRow` (PostgreSQL `BOOLEAN` or SQLite `INTEGER`).
pub fn row_get_bool(row: &sqlx::any::AnyRow, column: &str) -> Result<bool, sqlx::Error> {
    if let Ok(value) = row.try_get::<bool, _>(column) {
        return Ok(value);
    }
    let value: i64 = row.try_get(column)?;
    Ok(value != 0)
}

/// Reads a boolean column as `0`/`1` for legacy row structs that store flags as `i64`.
pub fn row_get_bool_as_i64(row: &sqlx::any::AnyRow, column: &str) -> Result<i64, sqlx::Error> {
    Ok(if row_get_bool(row, column)? { 1 } else { 0 })
}

/// Portable SQL for `sqlx::query` against `AnyPool` (normalizes `?1` placeholders).
pub fn any_sql(template: &str) -> String {
    prepare_sql(template)
}

/// Normalize SQL templates for `sqlx::AnyPool` execution.
pub fn prepare_sql(template: &str) -> String {
    normalize_any_placeholders(template)
}

/// Portable suffix for insert-id retrieval (SQLite 3.35+ and PostgreSQL).
pub const SQL_RETURNING_ID: &str = " RETURNING id";

/// Appends [`SQL_RETURNING_ID`] to an `INSERT` statement for cross-engine id reads.
pub fn sql_with_returning_id(insert_sql: &str) -> String {
    format!("{insert_sql}{SQL_RETURNING_ID}")
}

/// Reads the `id` column from a `RETURNING id` row.
pub fn inserted_row_id(row: &sqlx::any::AnyRow) -> Result<i64, sqlx::Error> {
    row.try_get("id")
}

/// Rewrite SQLite-style `?1`, `?2` placeholders to sequential `?` for `Any` queries.
pub fn normalize_any_placeholders(template: &str) -> String {
    let mut out = String::with_capacity(template.len());
    let mut chars = template.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '?' && chars.peek().is_some_and(|next| next.is_ascii_digit()) {
            while chars.peek().is_some_and(|next| next.is_ascii_digit()) {
                chars.next();
            }
            out.push('?');
            continue;
        }
        out.push(ch);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_numbered_placeholders() {
        assert_eq!(
            normalize_any_placeholders("SELECT * FROM t WHERE id = ?1 AND tenant_id = ?2"),
            "SELECT * FROM t WHERE id = ? AND tenant_id = ?",
        );
    }

    #[test]
    fn sql_with_returning_id_suffix() {
        assert_eq!(
            sql_with_returning_id("INSERT INTO t (name) VALUES (?)"),
            "INSERT INTO t (name) VALUES (?) RETURNING id",
        );
    }

    #[test]
    fn qualified_is_true_predicate() {
        assert_eq!(qualified_is_true("is_public"), "is_public IS TRUE");
    }
}
