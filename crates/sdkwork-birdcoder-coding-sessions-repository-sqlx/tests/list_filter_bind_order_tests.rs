use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionListQuery;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use sqlx::{any::AnyPoolOptions, AnyPool};

async fn create_test_schema(pool: &AnyPool) {
    for statement in [
        "CREATE TABLE studio_workspace (\
             id INTEGER PRIMARY KEY, \
             tenant_id INTEGER NOT NULL, \
             is_deleted INTEGER NOT NULL DEFAULT 0\
         )",
        "CREATE TABLE ai_coding_session (\
             id TEXT PRIMARY KEY, \
             uuid TEXT NULL, \
             created_at TEXT NOT NULL, \
             updated_at TEXT NOT NULL, \
             version INTEGER NOT NULL, \
             is_deleted INTEGER NOT NULL DEFAULT 0, \
             user_id INTEGER NOT NULL, \
             workspace_id TEXT NOT NULL, \
             project_id TEXT NOT NULL, \
             title TEXT NOT NULL, \
             status TEXT NOT NULL, \
             entry_surface TEXT NOT NULL, \
             host_mode TEXT NOT NULL, \
             engine_id TEXT NOT NULL, \
             model_id TEXT NOT NULL, \
             last_turn_at TEXT NULL, \
             native_session_id TEXT NULL, \
             sort_timestamp INTEGER NULL, \
             transcript_updated_at TEXT NULL, \
             pinned INTEGER NOT NULL DEFAULT 0, \
             archived INTEGER NOT NULL DEFAULT 0, \
             unread INTEGER NOT NULL DEFAULT 0\
         )",
        "CREATE TABLE ai_coding_session_runtime (\
             id TEXT PRIMARY KEY, \
             coding_session_id TEXT NOT NULL, \
             status TEXT NOT NULL, \
             created_at TEXT NOT NULL, \
             is_deleted INTEGER NOT NULL DEFAULT 0\
         )",
    ] {
        sqlx::query(statement)
            .execute(pool)
            .await
            .expect("create list-filter bind-order test table");
    }
}

async fn insert_session(
    pool: &AnyPool,
    id: &str,
    workspace_id: &str,
    project_id: &str,
    engine_id: &str,
    sort_timestamp: i64,
) {
    sqlx::query(
        "INSERT INTO ai_coding_session (\
             id, uuid, created_at, updated_at, version, is_deleted, user_id, workspace_id, \
             project_id, title, status, entry_surface, host_mode, engine_id, model_id, \
             last_turn_at, native_session_id, sort_timestamp, transcript_updated_at, \
             pinned, archived, unread\
         ) VALUES (?, NULL, '2026-07-11T00:00:00Z', '2026-07-11T00:00:00Z', 1, 0, 42, \
             ?, ?, ?, 'active', 'pc', 'local', ?, 'gpt-5', \
             NULL, NULL, ?, NULL, 0, 0, 0)",
    )
    .bind(id)
    .bind(workspace_id)
    .bind(project_id)
    .bind(id)
    .bind(engine_id)
    .bind(sort_timestamp)
    .execute(pool)
    .await
    .expect("seed coding session");
}

#[tokio::test]
async fn list_sessions_binds_domain_filters_before_tenant_scope() {
    sqlx::any::install_default_drivers();
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open list-filter bind-order database");
    create_test_schema(&pool).await;

    for (workspace_id, tenant_id) in [(101_i64, 7_i64), (102, 7), (201, 8)] {
        sqlx::query("INSERT INTO studio_workspace (id, tenant_id, is_deleted) VALUES (?, ?, 0)")
            .bind(workspace_id)
            .bind(tenant_id)
            .execute(&pool)
            .await
            .expect("seed scoped workspace");
    }

    insert_session(&pool, "target-session", "101", "project-match", "codex", 5).await;
    insert_session(
        &pool,
        "same-tenant-engine-miss",
        "101",
        "project-match",
        "claude",
        4,
    )
    .await;
    insert_session(
        &pool,
        "same-tenant-project-miss",
        "101",
        "project-other",
        "codex",
        3,
    )
    .await;
    insert_session(
        &pool,
        "same-tenant-workspace-miss",
        "102",
        "project-match",
        "codex",
        2,
    )
    .await;
    insert_session(
        &pool,
        "other-tenant-domain-match",
        "201",
        "project-match",
        "codex",
        1,
    )
    .await;

    let repository = SqliteCodingSessionRepository::new(pool);
    let page = repository
        .list_sessions(
            &CodingSessionContext {
                tenant_id: "7".to_owned(),
                user_id: "42".to_owned(),
                session_id: "bind-order-request".to_owned(),
            },
            &CodingSessionListQuery {
                engine_id: Some("codex".to_owned()),
                project_id: Some("project-match".to_owned()),
                workspace_id: Some("101".to_owned()),
                page_size: Some(10),
                offset: Some(0),
            },
        )
        .await
        .expect("list filtered coding sessions");

    assert_eq!(page.total, 1);
    assert_eq!(page.items.len(), 1);
    assert_eq!(page.items[0].id, "target-session");
    assert!(page
        .items
        .iter()
        .all(|session| session.id != "other-tenant-domain-match"));
}
