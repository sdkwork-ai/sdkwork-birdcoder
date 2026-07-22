use std::collections::BTreeMap;

use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::coding_session_repository::SqliteCodingSessionRepository;
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::models::{
    CodingSessionDiscoveryScope, CodingSessionListQuery, DiscoveredNativeSessionInput,
};
use sdkwork_birdcoder_coding_sessions_service::native_session_types::NativeSessionAttributesPayload;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use sqlx::any::AnyPoolOptions;
use uuid::Uuid;

const SQLITE_SCHEMA: &str = include_str!("../../../database/ddl/generated/sqlite_schema.sql");

fn context() -> CodingSessionContext {
    CodingSessionContext {
        tenant_id: "7".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "42".to_owned(),
        session_id: "native-materialization-test".to_owned(),
    }
}

fn scope(project_id: &str, runtime_location_id: &str) -> CodingSessionDiscoveryScope {
    CodingSessionDiscoveryScope {
        workspace_id: "101".to_owned(),
        project_id: project_id.to_owned(),
        runtime_location_id: runtime_location_id.to_owned(),
    }
}

fn discovered_session(
    engine_id: &str,
    native_session_id: &str,
    title: &str,
    sort_timestamp: i64,
    metadata_revision: i64,
) -> DiscoveredNativeSessionInput {
    let mut metadata = BTreeMap::new();
    metadata.insert(
        "revision".to_owned(),
        serde_json::Value::Number(metadata_revision.into()),
    );
    DiscoveredNativeSessionInput {
        title: title.to_owned(),
        status: "active".to_owned(),
        host_mode: "server".to_owned(),
        engine_id: engine_id.to_owned(),
        model_id: "provider-model-v1".to_owned(),
        native_session_id: native_session_id.to_owned(),
        created_at: "2026-07-20T01:00:00Z".to_owned(),
        updated_at: "2026-07-20T02:00:00Z".to_owned(),
        last_turn_at: Some("2026-07-20T01:59:00Z".to_owned()),
        sort_timestamp,
        transcript_updated_at: Some("2026-07-20T02:00:00Z".to_owned()),
        native_attributes: NativeSessionAttributesPayload {
            session_tree_id: Some(format!("tree-{native_session_id}")),
            title: Some(title.to_owned()),
            preview: Some(format!("preview-{metadata_revision}")),
            source: Some("provider-history".to_owned()),
            provider_version: Some("1.0.0".to_owned()),
            model_provider: Some("provider".to_owned()),
            project_id: Some("provider-project".to_owned()),
            cwd: Some("C:/private/provider-project".to_owned()),
            git_branch: Some("main".to_owned()),
            agent_name: Some(engine_id.to_owned()),
            is_ephemeral: false,
            is_sidechain: metadata_revision > 1,
            metadata,
            ..NativeSessionAttributesPayload::default()
        },
    }
}

#[tokio::test]
async fn discovered_native_sessions_materialize_idempotently_with_stable_logical_ids() {
    sqlx::any::install_default_drivers();
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open native materialization SQLite database");
    sqlx::raw_sql(SQLITE_SCHEMA)
        .execute(&pool)
        .await
        .expect("apply generated SQLite schema");
    sqlx::query(
        "INSERT INTO studio_workspace \
         (id, uuid, created_at, updated_at, tenant_id, organization_id, name, title, code, type, owner_id, status, is_deleted) \
         VALUES (101, NULL, ?, ?, 7, 0, 'Native sessions', 'Native sessions', 'native-sessions', 'team', 42, 'active', 0)",
    )
    .bind("2026-07-20T00:00:00Z")
    .bind("2026-07-20T00:00:00Z")
    .execute(&pool)
    .await
    .expect("seed scoped workspace");

    let repository = SqliteCodingSessionRepository::new(pool.clone());
    let context = context();
    let initial_scope = scope("project-initial", "runtime-initial");
    let initial = discovered_session("codex", "native-codex-1", "Initial title", 100, 1);
    repository
        .upsert_discovered_native_sessions(&context, &initial_scope, std::slice::from_ref(&initial))
        .await
        .expect("materialize first provider session");

    let initial_page = repository
        .list_sessions(
            &context,
            &CodingSessionListQuery {
                project_id: Some(initial_scope.project_id.clone()),
                runtime_location_id: Some(initial_scope.runtime_location_id.clone()),
                workspace_id: Some(initial_scope.workspace_id.clone()),
                page_size: Some(20),
                offset: Some(0),
                ..CodingSessionListQuery::default()
            },
        )
        .await
        .expect("list first materialized provider session");
    assert_eq!(initial_page.total, 1);
    let logical_id = initial_page.items[0].id.clone();
    Uuid::parse_str(&logical_id).expect("provider session gets a BirdCoder logical UUID");

    let updated_scope = scope("project-updated", "runtime-updated");
    let mut updated = discovered_session("codex", "native-codex-1", "Updated title", 200, 2);
    updated.status = "completed".to_owned();
    updated.host_mode = "desktop".to_owned();
    updated.model_id = "provider-model-v2".to_owned();
    updated.updated_at = "2026-07-20T03:00:00Z".to_owned();
    updated.last_turn_at = Some("2026-07-20T02:59:00Z".to_owned());
    updated.transcript_updated_at = Some("2026-07-20T03:00:00Z".to_owned());
    updated.native_attributes.provider_version = Some("2.0.0".to_owned());

    repository
        .upsert_discovered_native_sessions(&context, &updated_scope, &[updated.clone()])
        .await
        .expect("repeat provider materialization updates the durable record");

    let session_version_after_update: i64 =
        sqlx::query_scalar("SELECT version FROM ai_coding_session WHERE id = ?")
            .bind(&logical_id)
            .fetch_one(&pool)
            .await
            .expect("read updated session version");
    let runtime_version_after_update: i64 = sqlx::query_scalar(
        "SELECT version FROM ai_coding_session_runtime WHERE coding_session_id = ?",
    )
    .bind(&logical_id)
    .fetch_one(&pool)
    .await
    .expect("read updated runtime version");
    repository
        .upsert_discovered_native_sessions(&context, &updated_scope, &[updated.clone()])
        .await
        .expect("apply identical provider snapshot as a no-op");
    let repeated_versions: (i64, i64) = (
        sqlx::query_scalar("SELECT version FROM ai_coding_session WHERE id = ?")
            .bind(&logical_id)
            .fetch_one(&pool)
            .await
            .expect("read repeated session version"),
        sqlx::query_scalar(
            "SELECT version FROM ai_coding_session_runtime WHERE coding_session_id = ?",
        )
        .bind(&logical_id)
        .fetch_one(&pool)
        .await
        .expect("read repeated runtime version"),
    );
    assert_eq!(
        repeated_versions,
        (session_version_after_update, runtime_version_after_update)
    );

    let mut stale = initial.clone();
    stale.title = "Stale title".to_owned();
    stale.sort_timestamp = 50;
    repository
        .upsert_discovered_native_sessions(&context, &initial_scope, &[stale])
        .await
        .expect("ignore an older provider snapshot");
    let stale_result: (String, i64, i64) = (
        sqlx::query_scalar("SELECT title FROM ai_coding_session WHERE id = ?")
            .bind(&logical_id)
            .fetch_one(&pool)
            .await
            .expect("read title after stale snapshot"),
        sqlx::query_scalar("SELECT version FROM ai_coding_session WHERE id = ?")
            .bind(&logical_id)
            .fetch_one(&pool)
            .await
            .expect("read session version after stale snapshot"),
        sqlx::query_scalar(
            "SELECT version FROM ai_coding_session_runtime WHERE coding_session_id = ?",
        )
        .bind(&logical_id)
        .fetch_one(&pool)
        .await
        .expect("read runtime version after stale snapshot"),
    );
    assert_eq!(stale_result.0, "Updated title");
    assert_eq!(
        (stale_result.1, stale_result.2),
        (session_version_after_update, runtime_version_after_update)
    );

    let old_scope_page = repository
        .list_sessions(
            &context,
            &CodingSessionListQuery {
                project_id: Some(initial_scope.project_id.clone()),
                runtime_location_id: Some(initial_scope.runtime_location_id.clone()),
                workspace_id: Some(initial_scope.workspace_id.clone()),
                page_size: Some(20),
                offset: Some(0),
                ..CodingSessionListQuery::default()
            },
        )
        .await
        .expect("list old provider scope");
    assert_eq!(old_scope_page.total, 0);

    let updated_page = repository
        .list_sessions(
            &context,
            &CodingSessionListQuery {
                project_id: Some(updated_scope.project_id.clone()),
                runtime_location_id: Some(updated_scope.runtime_location_id.clone()),
                workspace_id: Some(updated_scope.workspace_id.clone()),
                page_size: Some(20),
                offset: Some(0),
                ..CodingSessionListQuery::default()
            },
        )
        .await
        .expect("list updated provider scope");
    assert_eq!(updated_page.total, 1);
    assert_eq!(updated_page.items[0].id, logical_id);
    assert_eq!(updated_page.items[0].title, "Updated title");
    assert_eq!(updated_page.items[0].status, "completed");
    assert_eq!(updated_page.items[0].host_mode, "desktop");
    assert_eq!(updated_page.items[0].model_id, "provider-model-v2");
    assert_eq!(
        updated_page.items[0].runtime_status.as_deref(),
        Some("completed")
    );
    assert_eq!(
        updated_page.items[0]
            .native_attributes
            .metadata
            .get("revision")
            .and_then(serde_json::Value::as_i64),
        Some(2)
    );
    assert!(updated_page.items[0].native_attributes.is_sidechain);
    assert_eq!(
        updated_page.items[0].native_attributes.cwd.as_deref(),
        Some("C:/private/provider-project")
    );

    let duplicate_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_coding_session \
         WHERE tenant_id = 7 AND user_id = 42 AND engine_id = 'codex' \
           AND native_session_id = 'native-codex-1' AND is_deleted IS NOT TRUE",
    )
    .fetch_one(&pool)
    .await
    .expect("count provider identity rows");
    assert_eq!(duplicate_count, 1);
    let runtime_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM ai_coding_session_runtime \
         WHERE coding_session_id = ? AND is_deleted IS NOT TRUE",
    )
    .bind(&logical_id)
    .fetch_one(&pool)
    .await
    .expect("count synchronized runtime rows");
    assert_eq!(runtime_count, 1);

    let second = discovered_session("claude-code", "native-claude-1", "Claude session", 150, 1);
    repository
        .upsert_discovered_native_sessions(
            &context,
            &updated_scope,
            &[updated.clone(), second.clone()],
        )
        .await
        .expect("materialize a complete two-provider snapshot");
    repository
        .upsert_discovered_native_sessions(&context, &updated_scope, &[updated, second])
        .await
        .expect("repeat complete provider snapshot without duplicates");

    let first_page = repository
        .list_sessions(
            &context,
            &CodingSessionListQuery {
                project_id: Some(updated_scope.project_id.clone()),
                runtime_location_id: Some(updated_scope.runtime_location_id.clone()),
                workspace_id: Some(updated_scope.workspace_id.clone()),
                page_size: Some(1),
                offset: Some(0),
                ..CodingSessionListQuery::default()
            },
        )
        .await
        .expect("list first materialized page");
    let second_page = repository
        .list_sessions(
            &context,
            &CodingSessionListQuery {
                project_id: Some(updated_scope.project_id),
                runtime_location_id: Some(updated_scope.runtime_location_id),
                workspace_id: Some(updated_scope.workspace_id),
                page_size: Some(1),
                offset: Some(1),
                ..CodingSessionListQuery::default()
            },
        )
        .await
        .expect("list second materialized page");
    assert_eq!(first_page.total, 2);
    assert_eq!(second_page.total, 2);
    assert_eq!(first_page.items.len(), 1);
    assert_eq!(second_page.items.len(), 1);
    assert_ne!(first_page.items[0].id, second_page.items[0].id);
    assert!(first_page
        .items
        .iter()
        .chain(&second_page.items)
        .any(|item| { item.engine_id == "codex" && item.id == logical_id }));
}
