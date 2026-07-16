use std::collections::BTreeMap;

use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionListQuery;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use sqlx::any::AnyPoolOptions;

#[tokio::test]
async fn list_sessions_returns_each_sessions_latest_runtime_status() {
    sqlx::any::install_default_drivers();
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open coding-session runtime-status database");

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
            .execute(&pool)
            .await
            .expect("create runtime-status test table");
    }

    sqlx::query("INSERT INTO studio_workspace (id, tenant_id, is_deleted) VALUES (101, 7, 0)")
        .execute(&pool)
        .await
        .expect("seed scoped workspace");

    for (id, title, sort_timestamp) in [
        ("session-a", "Session A", 2_i64),
        ("session-b", "Session B", 1_i64),
    ] {
        sqlx::query(
            "INSERT INTO ai_coding_session (\
                 id, uuid, created_at, updated_at, version, is_deleted, user_id, workspace_id, \
                 project_id, title, status, entry_surface, host_mode, engine_id, model_id, \
                 last_turn_at, native_session_id, sort_timestamp, transcript_updated_at, \
                 pinned, archived, unread\
             ) VALUES (?, NULL, '2026-07-10T00:00:00Z', '2026-07-10T00:00:00Z', 1, 0, 42, \
                 '101', 'project-1', ?, 'active', 'pc', 'local', 'codex', 'gpt-5', \
                 NULL, NULL, ?, NULL, 0, 0, 0)",
        )
        .bind(id)
        .bind(title)
        .bind(sort_timestamp)
        .execute(&pool)
        .await
        .expect("seed coding session");
    }

    for (id, session_id, status, created_at) in [
        ("runtime-a1", "session-a", "queued", "2026-07-10T00:00:01Z"),
        ("runtime-a2", "session-a", "running", "2026-07-10T00:00:02Z"),
        (
            "runtime-b1",
            "session-b",
            "completed",
            "2026-07-10T00:00:03Z",
        ),
    ] {
        sqlx::query(
            "INSERT INTO ai_coding_session_runtime \
             (id, coding_session_id, status, created_at, is_deleted) VALUES (?, ?, ?, ?, 0)",
        )
        .bind(id)
        .bind(session_id)
        .bind(status)
        .bind(created_at)
        .execute(&pool)
        .await
        .expect("seed coding-session runtime");
    }

    let repository = SqliteCodingSessionRepository::new(pool);
    let page = repository
        .list_sessions(
            &CodingSessionContext {
                tenant_id: "7".to_owned(),
                organization_id: "0".to_owned(),
                user_id: "42".to_owned(),
                session_id: "request-session".to_owned(),
            },
            &CodingSessionListQuery {
                page_size: Some(20),
                offset: Some(0),
                ..CodingSessionListQuery::default()
            },
        )
        .await
        .expect("list coding sessions");

    let statuses = page
        .items
        .into_iter()
        .map(|session| (session.id, session.runtime_status))
        .collect::<BTreeMap<_, _>>();
    assert_eq!(statuses["session-a"].as_deref(), Some("running"));
    assert_eq!(statuses["session-b"].as_deref(), Some("completed"));
}

#[tokio::test]
async fn list_sessions_does_not_evaluate_runtime_status_for_sessions_outside_the_page() {
    sqlx::any::install_default_drivers();
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open paged runtime-status database");

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
        "CREATE TABLE runtime_status_source (\
             id TEXT PRIMARY KEY, \
             coding_session_id TEXT NOT NULL, \
             status TEXT NOT NULL, \
             created_at TEXT NOT NULL, \
             is_deleted INTEGER NOT NULL DEFAULT 0\
         )",
        "CREATE VIEW ai_coding_session_runtime AS \
         SELECT id, coding_session_id, \
                CASE WHEN coding_session_id = 'session-off-page' \
                     THEN abs(-9223372036854775808) ELSE status END AS status, \
                created_at, is_deleted \
         FROM runtime_status_source",
    ] {
        sqlx::query(statement)
            .execute(&pool)
            .await
            .expect("create paged runtime-status test object");
    }

    sqlx::query("INSERT INTO studio_workspace (id, tenant_id, is_deleted) VALUES (101, 7, 0)")
        .execute(&pool)
        .await
        .expect("seed scoped workspace");

    for (id, title, sort_timestamp) in [
        ("session-on-page", "On page", 2_i64),
        ("session-off-page", "Off page", 1_i64),
    ] {
        sqlx::query(
            "INSERT INTO ai_coding_session (\
                 id, uuid, created_at, updated_at, version, is_deleted, user_id, workspace_id, \
                 project_id, title, status, entry_surface, host_mode, engine_id, model_id, \
                 last_turn_at, native_session_id, sort_timestamp, transcript_updated_at, \
                 pinned, archived, unread\
             ) VALUES (?, NULL, '2026-07-10T00:00:00Z', '2026-07-10T00:00:00Z', 1, 0, 42, \
                 '101', 'project-1', ?, 'active', 'pc', 'local', 'codex', 'gpt-5', \
                 NULL, NULL, ?, NULL, 0, 0, 0)",
        )
        .bind(id)
        .bind(title)
        .bind(sort_timestamp)
        .execute(&pool)
        .await
        .expect("seed paged coding session");
    }

    for (id, session_id, status) in [
        ("runtime-on-page", "session-on-page", "running"),
        ("runtime-off-page", "session-off-page", "poison"),
    ] {
        sqlx::query(
            "INSERT INTO runtime_status_source \
             (id, coding_session_id, status, created_at, is_deleted) \
             VALUES (?, ?, ?, '2026-07-10T00:00:01Z', 0)",
        )
        .bind(id)
        .bind(session_id)
        .bind(status)
        .execute(&pool)
        .await
        .expect("seed paged coding-session runtime");
    }

    let repository = SqliteCodingSessionRepository::new(pool);
    let page = repository
        .list_sessions(
            &CodingSessionContext {
                tenant_id: "7".to_owned(),
                organization_id: "0".to_owned(),
                user_id: "42".to_owned(),
                session_id: "paged-request-session".to_owned(),
            },
            &CodingSessionListQuery {
                page_size: Some(1),
                offset: Some(0),
                ..CodingSessionListQuery::default()
            },
        )
        .await
        .expect("page query must not evaluate runtime status for off-page sessions");

    assert_eq!(page.total, 2);
    assert_eq!(page.items.len(), 1);
    assert_eq!(page.items[0].id, "session-on-page");
    assert_eq!(page.items[0].runtime_status.as_deref(), Some("running"));
}
