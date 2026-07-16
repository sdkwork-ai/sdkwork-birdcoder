use std::collections::BTreeSet;

use sqlx::{any::AnyPoolOptions, AnyPool, Row as _};

const SQLITE_SCHEMA: &str = include_str!("../../../database/ddl/generated/sqlite_schema.sql");
const POSTGRES_SCHEMA: &str = include_str!("../../../database/ddl/generated/postgres_schema.sql");
const DURABLE_EVENT_SEQUENCE_INDEX_DDL: &str =
    "CREATE UNIQUE INDEX IF NOT EXISTS uk_ai_coding_session_event_scope_sequence\n\
     ON ai_coding_session_event(tenant_id, user_id, coding_session_id, sequence_no)\n\
     WHERE is_deleted IS NOT TRUE;";

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

#[tokio::test]
async fn generated_sqlite_schema_preserves_provider_native_session_attributes() {
    let pool = sqlite_pool().await;
    sqlx::raw_sql(SQLITE_SCHEMA)
        .execute(&pool)
        .await
        .expect("apply generated SQLite schema");

    let table_info = sqlx::query("PRAGMA table_info(ai_coding_session)")
        .fetch_all(&pool)
        .await
        .expect("read coding-session columns");
    let column_names = table_info
        .iter()
        .map(|row| row.try_get::<String, _>("name").expect("column name"))
        .collect::<BTreeSet<_>>();
    for required_column in [
        "native_session_tree_id",
        "native_parent_session_id",
        "native_forked_from_session_id",
        "native_title",
        "native_preview",
        "native_source",
        "provider_version",
        "model_provider",
        "native_project_id",
        "native_cwd",
        "runtime_location_id",
        "native_git_branch",
        "native_git_commit",
        "native_git_repository_url",
        "native_agent_name",
        "native_agent_role",
        "native_is_ephemeral",
        "native_is_sidechain",
        "native_schema_version",
        "native_metadata_json",
    ] {
        assert!(
            column_names.contains(required_column),
            "ai_coding_session must contain {required_column}"
        );
    }

    sqlx::query(
        "INSERT INTO ai_coding_session (
             id, tenant_id, user_id, created_at, updated_at, workspace_id, project_id, runtime_location_id,
             title, status, entry_surface, engine_id, model_id, native_session_id,
             native_session_tree_id, native_parent_session_id,
             native_forked_from_session_id, native_title, native_preview, native_source,
             provider_version, model_provider, native_project_id, native_cwd,
             native_git_branch, native_git_commit, native_git_repository_url,
             native_agent_name, native_agent_role, native_is_ephemeral,
             native_is_sidechain, native_schema_version, native_metadata_json
         ) VALUES (
             'codex-session', 7, 42, '2026-07-15T00:00:00Z', '2026-07-15T00:01:00Z',
             'workspace-1', 'birdcoder-project', 'runtime-location-1', 'Native Codex title', 'active', 'code',
             'codex', 'gpt-5.4', 'same-provider-id', 'codex-tree', 'codex-parent',
             'codex-fork', 'Native Codex title', 'First user request', 'vscode',
             '0.144.3', 'openai', 'provider-project', 'E:/workspace/project', 'main',
             'abc123', 'https://example.invalid/repository.git', 'worker-1', 'reviewer',
             1, 0, 1, '{\"futureField\":{\"nested\":true}}'
         )",
    )
    .execute(&pool)
    .await
    .expect("insert complete Codex session attributes");

    sqlx::query(
        "INSERT INTO ai_coding_session (
             id, tenant_id, user_id, created_at, updated_at, workspace_id, project_id, runtime_location_id,
             title, status, entry_surface, engine_id, model_id, native_session_id
         ) VALUES (
             'gemini-session', 7, 42, '2026-07-15T00:00:00Z', '2026-07-15T00:01:00Z',
             'workspace-1', 'birdcoder-project', 'runtime-location-1', 'Gemini session', 'active', 'code',
             'gemini', 'gemini-2.5-pro', 'same-provider-id'
         )",
    )
    .execute(&pool)
    .await
    .expect("the same native id must remain valid for another provider");

    let duplicate = sqlx::query(
        "INSERT INTO ai_coding_session (
             id, tenant_id, user_id, created_at, updated_at, workspace_id, project_id, runtime_location_id,
             title, status, entry_surface, engine_id, model_id, native_session_id
         ) VALUES (
             'codex-duplicate', 7, 42, '2026-07-15T00:00:00Z', '2026-07-15T00:01:00Z',
             'workspace-1', 'birdcoder-project', 'runtime-location-1', 'Duplicate', 'active', 'code',
             'codex', 'gpt-5.4', 'same-provider-id'
         )",
    )
    .execute(&pool)
    .await;
    assert!(
        duplicate.is_err(),
        "one provider native session must not be mirrored twice"
    );

    let row = sqlx::query(
        "SELECT project_id, native_project_id, model_id, model_provider,
                native_session_tree_id, native_parent_session_id,
                native_forked_from_session_id, native_title, native_preview,
                native_source, provider_version, native_cwd, native_git_branch,
                native_git_commit, native_git_repository_url, native_agent_name,
                native_agent_role, native_is_ephemeral, native_is_sidechain,
                native_schema_version, native_metadata_json
         FROM ai_coding_session WHERE id = 'codex-session'",
    )
    .fetch_one(&pool)
    .await
    .expect("read complete Codex session attributes");
    assert_eq!(
        row.try_get::<String, _>("project_id").unwrap(),
        "birdcoder-project"
    );
    assert_eq!(
        row.try_get::<String, _>("native_project_id").unwrap(),
        "provider-project"
    );
    assert_eq!(row.try_get::<String, _>("model_id").unwrap(), "gpt-5.4");
    assert_eq!(
        row.try_get::<String, _>("model_provider").unwrap(),
        "openai"
    );
    assert_eq!(row.try_get::<i64, _>("native_is_ephemeral").unwrap(), 1);
    assert_eq!(row.try_get::<i64, _>("native_is_sidechain").unwrap(), 0);
    assert_eq!(row.try_get::<i64, _>("native_schema_version").unwrap(), 1);
    let metadata = row.try_get::<String, _>("native_metadata_json").unwrap();
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&metadata).unwrap()["futureField"]["nested"],
        true
    );
}

#[tokio::test]
async fn generated_sqlite_schema_indexes_and_guards_durable_event_sequences() {
    for (engine, schema) in [("sqlite", SQLITE_SCHEMA), ("postgres", POSTGRES_SCHEMA)] {
        assert!(
            schema.contains(DURABLE_EVENT_SEQUENCE_INDEX_DDL),
            "generated {engine} DDL must contain the canonical durable event sequence index",
        );
    }

    let pool = sqlite_pool().await;
    sqlx::raw_sql(SQLITE_SCHEMA)
        .execute(&pool)
        .await
        .expect("apply generated SQLite schema");

    let replay_plan = sqlx::query(
        "EXPLAIN QUERY PLAN \
         SELECT * FROM ai_coding_session_event \
         WHERE tenant_id = ? AND user_id = ? AND coding_session_id = ? \
           AND is_deleted IS NOT TRUE AND sequence_no > ? AND sequence_no <= ? \
         ORDER BY sequence_no ASC LIMIT ?",
    )
    .bind(7_i64)
    .bind(42_i64)
    .bind("session-1")
    .bind(10_i64)
    .bind(100_i64)
    .bind(21_i64)
    .fetch_all(&pool)
    .await
    .expect("explain durable replay query");
    let replay_plan = replay_plan
        .iter()
        .map(|row| row.try_get::<String, _>("detail").expect("plan detail"))
        .collect::<Vec<_>>();
    assert!(
        replay_plan
            .iter()
            .any(|detail| detail.contains("uk_ai_coding_session_event_scope_sequence")),
        "durable replay must use the owner-scoped sequence index; plan={replay_plan:?}",
    );
    assert!(
        replay_plan
            .iter()
            .any(|detail| { detail.contains("sequence_no>?") && detail.contains("sequence_no<?") }),
        "durable replay must constrain both sequence bounds in the index; plan={replay_plan:?}",
    );
    assert!(
        replay_plan
            .iter()
            .all(|detail| !detail.contains("USE TEMP B-TREE FOR ORDER BY")),
        "durable replay ordering must come from the sequence index; plan={replay_plan:?}",
    );

    let allocator_plan = sqlx::query(
        "EXPLAIN QUERY PLAN \
         SELECT COALESCE(MAX(sequence_no), 0) FROM ai_coding_session_event \
         WHERE tenant_id = ? AND user_id = ? AND coding_session_id = ? \
           AND is_deleted IS NOT TRUE",
    )
    .bind(7_i64)
    .bind(42_i64)
    .bind("session-1")
    .fetch_all(&pool)
    .await
    .expect("explain durable sequence allocator query");
    let allocator_plan = allocator_plan
        .iter()
        .map(|row| row.try_get::<String, _>("detail").expect("plan detail"))
        .collect::<Vec<_>>();
    assert!(
        allocator_plan
            .iter()
            .any(|detail| detail.contains("uk_ai_coding_session_event_scope_sequence")),
        "durable sequence allocation must use the owner-scoped sequence index; plan={allocator_plan:?}",
    );

    sqlx::query(
        "INSERT INTO studio_workspace \
         (id, tenant_id, created_at, updated_at, name, owner_id, status) \
         VALUES (101, 7, '2026-07-16T00:00:00Z', '2026-07-16T00:00:00Z', \
                 'Sequence workspace', 42, 'active')",
    )
    .execute(&pool)
    .await
    .expect("seed sequence workspace");
    sqlx::query(
        "INSERT INTO ai_coding_session \
         (id, tenant_id, user_id, created_at, updated_at, workspace_id, project_id, title, \
          status, entry_surface, engine_id, model_id) \
         VALUES ('session-1', 7, 42, '2026-07-16T00:00:00Z', '2026-07-16T00:00:00Z', \
                 '101', 'project-1', 'Sequence session', 'active', 'pc', 'codex', 'gpt-5-codex')",
    )
    .execute(&pool)
    .await
    .expect("seed sequence session");
    sqlx::query(
        "INSERT INTO ai_coding_session_event \
         (id, tenant_id, user_id, created_at, updated_at, coding_session_id, event_kind, \
          sequence_no, payload_json) \
         VALUES ('event-1', 7, 42, '2026-07-16T00:00:00Z', '2026-07-16T00:00:00Z', \
                 'session-1', 'message.delta', 1, '{}')",
    )
    .execute(&pool)
    .await
    .expect("seed the first active durable event");
    let duplicate = sqlx::query(
        "INSERT INTO ai_coding_session_event \
         (id, tenant_id, user_id, created_at, updated_at, coding_session_id, event_kind, \
          sequence_no, payload_json) \
         VALUES ('event-2', 7, 42, '2026-07-16T00:00:01Z', '2026-07-16T00:00:01Z', \
                 'session-1', 'message.delta', 1, '{}')",
    )
    .execute(&pool)
    .await;
    assert!(
        duplicate.is_err(),
        "the database must reject duplicate active event sequences in one owner/session stream",
    );
}
