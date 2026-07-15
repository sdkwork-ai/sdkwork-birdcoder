use std::env;

use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionListQuery;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use sqlx::{any::AnyPoolOptions, AnyPool};
use uuid::Uuid;

const POSTGRES_SCHEMA: &str = include_str!("../../../database/ddl/generated/postgres_schema.sql");

fn postgres_dsn() -> Option<String> {
    [
        "BIRDCODER_POSTGRESQL_DSN",
        "SDKWORK_BIRDCODER_DATABASE_URL",
        "DATABASE_URL",
    ]
    .into_iter()
    .find_map(|name| env::var(name).ok().filter(|value| !value.trim().is_empty()))
}

async fn set_search_path(pool: &AnyPool, schema: &str) {
    sqlx::query(&format!("SET search_path TO {schema}"))
        .execute(pool)
        .await
        .expect("set isolated PostgreSQL search path");
}

#[tokio::test]
async fn production_repository_supports_postgresql_schema_transactions_and_scope() {
    let Some(dsn) = postgres_dsn() else {
        eprintln!(
            "PostgreSQL live repository test skipped because no authorized DSN is configured"
        );
        return;
    };

    sqlx::any::install_default_drivers();
    let admin_pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect(&dsn)
        .await
        .expect("connect PostgreSQL live smoke database");
    let schema = format!("birdcoder_smoke_{}", Uuid::new_v4().simple());
    sqlx::query(&format!("CREATE SCHEMA {schema}"))
        .execute(&admin_pool)
        .await
        .expect("create isolated PostgreSQL smoke schema");

    let test_result = async {
        let pool = AnyPoolOptions::new()
            .max_connections(1)
            .connect(&dsn)
            .await
            .expect("connect isolated PostgreSQL repository pool");
        set_search_path(&pool, &schema).await;
        sqlx::raw_sql(POSTGRES_SCHEMA)
            .execute(&pool)
            .await
            .expect("apply generated PostgreSQL schema");

        sqlx::query(
            "INSERT INTO studio_workspace \
             (id, uuid, created_at, updated_at, tenant_id, organization_id, name, title, code, type, owner_id, status, is_deleted) \
             VALUES (?, ?::uuid, ?::timestamptz, ?::timestamptz, ?, 0, ?, ?, ?, 'team', ?, ?, FALSE)",
        )
        .bind(101_i64)
        .bind(Uuid::new_v4().to_string())
        .bind("2026-07-14T00:00:00Z")
        .bind("2026-07-14T00:00:00Z")
        .bind(7_i64)
        .bind("PostgreSQL smoke workspace")
        .bind("PostgreSQL smoke workspace")
        .bind("postgresql-smoke")
        .bind(42_i64)
        .bind("active")
        .execute(&pool)
        .await
        .expect("seed PostgreSQL workspace");

        for (id, tenant_id, user_id, sort_timestamp) in [
            ("postgres-session-owned", 7_i64, 42_i64, 2_i64),
            ("postgres-session-other-tenant", 8_i64, 42_i64, 1_i64),
        ] {
            sqlx::query(
                "INSERT INTO ai_coding_session \
                 (id, tenant_id, organization_id, user_id, created_at, updated_at, workspace_id, project_id, title, status, entry_surface, host_mode, engine_id, model_id, sort_timestamp) \
                 VALUES (?, ?, 0, ?, ?, ?, '101', 'project-smoke', ?, 'active', 'pc', 'server', 'codex', 'gpt-5', ?)",
            )
            .bind(id)
            .bind(tenant_id)
            .bind(user_id)
            .bind("2026-07-14T00:00:00Z")
            .bind("2026-07-14T00:00:00Z")
            .bind(id)
            .bind(sort_timestamp)
            .execute(&pool)
            .await
            .expect("seed PostgreSQL coding session");
        }

        let repository = SqliteCodingSessionRepository::new(pool.clone());
        let page = repository
            .list_sessions(
                &CodingSessionContext {
                    tenant_id: "7".to_owned(),
                    user_id: "42".to_owned(),
                    session_id: "postgres-live-smoke".to_owned(),
                },
                &CodingSessionListQuery {
                    engine_id: Some("codex".to_owned()),
                    project_id: Some("project-smoke".to_owned()),
                    workspace_id: Some("101".to_owned()),
                    page_size: Some(20),
                    offset: Some(0),
                },
            )
            .await
            .expect("list sessions through production PostgreSQL repository");
        assert_eq!(page.total, 1);
        assert_eq!(page.items[0].id, "postgres-session-owned");

        let mut transaction = pool.begin().await.expect("begin PostgreSQL transaction");
        sqlx::query("UPDATE ai_coding_session SET title = ? WHERE id = ?")
            .bind("uncommitted")
            .bind("postgres-session-owned")
            .execute(&mut *transaction)
            .await
            .expect("write inside PostgreSQL transaction");
        transaction.rollback().await.expect("rollback PostgreSQL transaction");
        let title: String = sqlx::query_scalar(
            "SELECT title FROM ai_coding_session WHERE id = ?",
        )
        .bind("postgres-session-owned")
        .fetch_one(&pool)
        .await
        .expect("read title after rollback");
        assert_ne!(title, "uncommitted");

        let orphan_result = sqlx::query(
            "INSERT INTO ai_coding_session_message \
             (id, tenant_id, organization_id, user_id, created_at, updated_at, coding_session_id, role, content, metadata_json) \
             VALUES ('orphan', 7, 0, 42, ?, ?, 'missing-session', 'user', 'x', '{}')",
        )
        .bind("2026-07-14T00:00:00Z")
        .bind("2026-07-14T00:00:00Z")
        .execute(&pool)
        .await;
        assert!(orphan_result.is_err(), "PostgreSQL must reject orphan session messages");
    }
    .await;

    sqlx::query(&format!("DROP SCHEMA {schema} CASCADE"))
        .execute(&admin_pool)
        .await
        .expect("drop isolated PostgreSQL smoke schema");
    test_result
}
