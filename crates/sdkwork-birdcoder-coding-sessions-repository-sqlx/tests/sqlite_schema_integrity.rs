use sqlx::{any::AnyPoolOptions, AnyPool};

const SQLITE_SCHEMA: &str = include_str!("../../../database/ddl/generated/sqlite_schema.sql");

async fn sqlite_pool() -> AnyPool {
    sqlx::any::install_default_drivers();
    AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open SQLite schema integrity database")
}

#[tokio::test]
async fn generated_sqlite_schema_enforces_session_foreign_keys() {
    let pool = sqlite_pool().await;
    sqlx::raw_sql(SQLITE_SCHEMA)
        .execute(&pool)
        .await
        .expect("apply generated SQLite schema");

    let foreign_key_violations: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM pragma_foreign_key_check")
            .fetch_one(&pool)
            .await
            .expect("check generated SQLite foreign keys");
    assert_eq!(foreign_key_violations, 0);

    let orphan_result = sqlx::query(
        "INSERT INTO ai_coding_session_message \
         (id, tenant_id, organization_id, user_id, created_at, updated_at, coding_session_id, role, content, metadata_json) \
         VALUES ('orphan', 7, 0, 42, ?, ?, 'missing-session', 'user', 'x', '{}')",
    )
    .bind("2026-07-14T00:00:00Z")
    .bind("2026-07-14T00:00:00Z")
    .execute(&pool)
    .await;
    assert!(
        orphan_result.is_err(),
        "SQLite must reject orphan session messages"
    );
}
