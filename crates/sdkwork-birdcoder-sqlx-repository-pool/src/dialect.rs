//! Cross-engine SQL helpers for BirdCoder `sqlx::AnyPool` repositories.
//!
//! PostgreSQL uses `BOOLEAN` for `is_deleted`; SQLite uses `INTEGER`. Predicate
//! `is_deleted IS NOT TRUE` is valid on both engines.

/// Portable soft-delete filter for `WHERE` clauses.
pub const IS_NOT_DELETED: &str = "is_deleted IS NOT TRUE";

/// Portable soft-delete filter with a table alias or qualifier (`s.is_deleted IS NOT TRUE`).
pub fn qualified_is_not_deleted(qualifier: &str) -> String {
    format!("{qualifier}.is_deleted IS NOT TRUE")
}

/// Portable soft-delete assignment for `UPDATE` clauses (SQLite + PostgreSQL).
pub const SET_SOFT_DELETED: &str = "is_deleted = TRUE";

/// Portable active-row literal for `INSERT` bind parameters (`0` on SQLite, `false` on PG).
pub const INSERT_NOT_DELETED: i64 = 0;

/// Portable SQL for `sqlx::query` against `AnyPool` (normalizes `?1` placeholders).
pub fn any_sql(template: &str) -> String {
    prepare_sql(template)
}

/// Normalize SQL templates for `sqlx::AnyPool` execution.
pub fn prepare_sql(template: &str) -> String {
    normalize_any_placeholders(template)
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
}
