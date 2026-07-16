use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::runtime_location::{
    NewProjectRuntimeLocation, NewProjectRuntimeLocationPreference,
    ProjectRuntimeLocationAuditEntry, ProjectRuntimeLocationRebind, RuntimeLocationIdempotency,
    HEALTH_STATUS_PENDING_VERIFICATION,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::runtime_location_repository::ProjectRuntimeLocationRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::db::schema::ALL_TABLES_DDL;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project_runtime_location::SqliteProjectRuntimeLocationRepository;
use sqlx::{any::AnyPoolOptions, AnyPool};
use uuid::Uuid;

async fn setup() -> (SqliteProjectRuntimeLocationRepository, AnyPool, ProjectContext) {
    sqlx::any::install_default_drivers();
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open SQLite database");
    sqlx::raw_sql(ALL_TABLES_DDL)
        .execute(&pool)
        .await
        .expect("apply test schema");
    seed_project(&pool, 1, 100001, 0, 200001, "primary").await;
    (
        SqliteProjectRuntimeLocationRepository::new(pool.clone()),
        pool,
        ProjectContext {
            tenant_id: "100001".to_owned(),
            organization_id: "0".to_owned(),
            user_id: "200001".to_owned(),
        },
    )
}

async fn seed_project(
    pool: &AnyPool,
    id: i64,
    tenant_id: i64,
    organization_id: i64,
    owner_id: i64,
    suffix: &str,
) {
    sqlx::query(
        "INSERT INTO studio_project (id, uuid, created_at, updated_at, v, tenant_id, organization_id, data_scope, user_id, name, title, code, type, status, is_deleted, is_template) \
         VALUES (?, ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z', 0, ?, ?, 1, ?, ?, ?, ?, 0, 0, 0, 0)",
    )
    .bind(id)
    .bind(Uuid::new_v4().to_string())
    .bind(tenant_id)
    .bind(organization_id)
    .bind(owner_id)
    .bind(format!("project-{suffix}"))
    .bind(format!("Project {suffix}"))
    .bind(format!("code-{suffix}"))
    .execute(pool)
    .await
    .expect("seed project");
}

fn audit() -> ProjectRuntimeLocationAuditEntry {
    ProjectRuntimeLocationAuditEntry {
        action: "runtime_location.test".to_owned(),
        result: "accepted".to_owned(),
        trace_id: Some("trace-test".to_owned()),
        redacted_metadata_json: r#"{"event":"runtime_location.test"}"#.to_owned(),
    }
}

fn idempotency(operation: &str, key: char, fingerprint: char) -> RuntimeLocationIdempotency {
    let key_nibble = format!("{:x}", (key as u32) % 16);
    let fingerprint_nibble = format!("{:x}", (fingerprint as u32) % 16);
    RuntimeLocationIdempotency {
        operation: operation.to_owned(),
        key_hash: key_nibble.repeat(64),
        request_fingerprint: fingerprint_nibble.repeat(64),
    }
}

fn location(
    project_id: &str,
    target: &str,
    path_fingerprint: char,
    idempotency: Option<RuntimeLocationIdempotency>,
) -> NewProjectRuntimeLocation {
    NewProjectRuntimeLocation {
        id: Uuid::new_v4().to_string(),
        uuid: Uuid::new_v4().to_string(),
        project_id: project_id.to_owned(),
        runtime_target_id: target.to_owned(),
        runtime_target_kind: "desktop_device".to_owned(),
        location_kind: "desktop_checkout".to_owned(),
        path_flavor: "windows".to_owned(),
        root_locator: "desktop-root".to_owned(),
        display_name: "Project".to_owned(),
        encrypted_absolute_path: "ciphertext".to_owned(),
        path_encryption_key_id: "test-key-v1".to_owned(),
        path_fingerprint: path_fingerprint.to_string().repeat(64),
        terminal_available: false,
        git_available: false,
        build_available: false,
        file_system_available: false,
        git_repository_url: None,
        git_remote_name: None,
        git_branch: None,
        git_commit: None,
        git_worktree_key: None,
        idempotency,
    }
}

#[tokio::test]
async fn register_replays_same_idempotency_key_and_rejects_changed_request() {
    let (repository, pool, context) = setup().await;
    let first = location("1", "desktop-a", 'a', Some(idempotency("create", 'k', 'r')));
    let created = repository
        .register_runtime_location(&context, &first, &audit())
        .await
        .expect("create location");

    let retry = location("1", "desktop-a", 'a', Some(idempotency("create", 'k', 'r')));
    let replay = repository
        .register_runtime_location(&context, &retry, &audit())
        .await
        .expect("replay same create");
    assert_eq!(replay.id, created.id);

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM studio_project_runtime_location")
        .fetch_one(&pool)
        .await
        .expect("count locations");
    assert_eq!(count, 1);
    let audit_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM ops_project_runtime_location_audit")
        .fetch_one(&pool)
        .await
        .expect("count audit rows");
    assert_eq!(audit_count, 1, "replay must not append another audit fact");

    let changed = location("1", "desktop-a", 'b', Some(idempotency("create", 'k', 's')));
    let error = match repository
        .register_runtime_location(&context, &changed, &audit())
        .await
    {
        Ok(_) => panic!("same key with different request must conflict"),
        Err(error) => error,
    };
    assert!(matches!(error, ProjectError::Conflict(_)));
}

#[tokio::test]
async fn rebind_uses_compare_and_swap_and_resets_execution_claims() {
    let (repository, _pool, context) = setup().await;
    let created = repository
        .register_runtime_location(
            &context,
            &location("1", "desktop-a", 'a', Some(idempotency("create", 'a', 'a'))),
            &audit(),
        )
        .await
        .expect("create location");
    let rebind = ProjectRuntimeLocationRebind {
        expected_version: created.version,
        path_flavor: "windows".to_owned(),
        root_locator: "desktop-root-rebound".to_owned(),
        display_name: "Rebound".to_owned(),
        encrypted_absolute_path: "new-ciphertext".to_owned(),
        path_encryption_key_id: "test-key-v1".to_owned(),
        path_fingerprint: "b".repeat(64),
        idempotency: Some(idempotency("rebind", 'b', 'b')),
    };
    let rebound = repository
        .rebind_runtime_location(&context, "1", &created.id, &rebind, &audit())
        .await
        .expect("rebind location");
    assert_eq!(rebound.version, created.version + 1);
    assert_eq!(rebound.health_status, HEALTH_STATUS_PENDING_VERIFICATION);
    assert!(!rebound.terminal_available);
    assert_eq!(rebound.path_fingerprint, "b".repeat(64));

    let replay = repository
        .rebind_runtime_location(&context, "1", &created.id, &rebind, &audit())
        .await
        .expect("replay rebind");
    assert_eq!(replay.version, rebound.version);

    let stale = ProjectRuntimeLocationRebind {
        idempotency: Some(idempotency("rebind", 'c', 'c')),
        path_fingerprint: "c".repeat(64),
        ..rebind
    };
    let error = match repository
        .rebind_runtime_location(&context, "1", &created.id, &stale, &audit())
        .await
    {
        Ok(_) => panic!("stale version must fail precondition"),
        Err(error) => error,
    };
    assert!(matches!(error, ProjectError::PreconditionFailed(_)));
}

#[tokio::test]
async fn list_uses_sql_window_and_tenant_acl() {
    let (repository, pool, context) = setup().await;
    for (fingerprint, key) in [('a', 'a'), ('b', 'b'), ('c', 'c')] {
        repository
            .register_runtime_location(
                &context,
                &location("1", "desktop-a", fingerprint, Some(idempotency("create", key, key))),
                &audit(),
            )
            .await
            .expect("register test location");
    }
    seed_project(&pool, 2, 100002, 0, 200002, "other-tenant").await;
    let other_context = ProjectContext {
        tenant_id: "100002".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "200002".to_owned(),
    };
    repository
        .register_runtime_location(
            &other_context,
            &location("2", "desktop-a", 'd', Some(idempotency("create", 'd', 'd'))),
            &audit(),
        )
        .await
        .expect("register other tenant location");

    let (page, total) = repository
        .list_runtime_locations(&context, "1", 1, 1)
        .await
        .expect("list page");
    assert_eq!(total, 3);
    assert_eq!(page.len(), 1);
    assert!(page.iter().all(|item| item.tenant_id == "100001"));
}

#[tokio::test]
async fn invalid_audit_rolls_back_location_and_preference_is_soft_deleted_with_location() {
    let (repository, pool, context) = setup().await;
    let invalid_audit = ProjectRuntimeLocationAuditEntry {
        redacted_metadata_json: r#"{"absolute_path":"forbidden"}"#.to_owned(),
        ..audit()
    };
    let error = match repository
        .register_runtime_location(
            &context,
            &location("1", "desktop-a", 'a', Some(idempotency("create", 'a', 'a'))),
            &invalid_audit,
        )
        .await
    {
        Ok(_) => panic!("invalid audit must roll back"),
        Err(error) => error,
    };
    assert!(matches!(error, ProjectError::InvalidInput(_)));
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM studio_project_runtime_location")
        .fetch_one(&pool)
        .await
        .expect("count rolled-back locations");
    assert_eq!(count, 0);

    let created = repository
        .register_runtime_location(
            &context,
            &location("1", "desktop-a", 'b', Some(idempotency("create", 'b', 'b'))),
            &audit(),
        )
        .await
        .expect("create location");
    let preference = NewProjectRuntimeLocationPreference {
        id: Uuid::new_v4().to_string(),
        uuid: Uuid::new_v4().to_string(),
        project_id: "1".to_owned(),
        capability: "terminal".to_owned(),
        runtime_location_id: created.id.clone(),
        expected_version: None,
        idempotency: Some(idempotency("preference", 'p', 'p')),
    };
    let stored_preference = repository
        .upsert_runtime_location_preference(&context, &preference, &audit())
        .await
        .expect("create preference");
    repository
        .delete_runtime_location(&context, "1", &created.id, created.version, &audit())
        .await
        .expect("delete location");
    assert!(repository
        .get_runtime_location_preference(&context, "1", "terminal")
        .await
        .expect("read preference")
        .is_none());
    let deleted: i64 = sqlx::query_scalar(
        "SELECT is_deleted FROM studio_project_runtime_location_preference WHERE id = ?",
    )
    .bind(&stored_preference.id)
    .fetch_one(&pool)
    .await
    .expect("read soft-delete flag");
    assert_eq!(deleted, 1);
}
