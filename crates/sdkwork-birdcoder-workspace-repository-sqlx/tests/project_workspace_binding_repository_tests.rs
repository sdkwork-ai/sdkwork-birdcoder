use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::workspace_binding::{
    NewProjectWorkspaceBinding, ProjectWorkspaceBindingAuditEntry,
    ProjectWorkspaceBindingIdempotency,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::workspace_binding_repository::ProjectWorkspaceBindingRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::db::schema::ALL_TABLES_DDL;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project_workspace_binding::SqliteProjectWorkspaceBindingRepository;
use sqlx::{any::AnyPoolOptions, AnyPool, Row};
use uuid::Uuid;

async fn setup() -> (
    SqliteProjectWorkspaceBindingRepository,
    AnyPool,
    ProjectContext,
) {
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
        SqliteProjectWorkspaceBindingRepository::new(pool.clone()),
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

fn audit(action: &str) -> ProjectWorkspaceBindingAuditEntry {
    ProjectWorkspaceBindingAuditEntry {
        action: action.to_owned(),
        result: "accepted".to_owned(),
        trace_id: Some("trace-workspace-binding-repository".to_owned()),
        redacted_metadata_json: serde_json::json!({ "event": action }).to_string(),
    }
}

fn idempotency(key: char, fingerprint: char) -> ProjectWorkspaceBindingIdempotency {
    let key_nibble = format!("{:x}", (key as u32) % 16);
    let fingerprint_nibble = format!("{:x}", (fingerprint as u32) % 16);
    ProjectWorkspaceBindingIdempotency {
        operation: "upsert".to_owned(),
        key_hash: key_nibble.repeat(64),
        request_fingerprint: fingerprint_nibble.repeat(64),
    }
}

fn binding(
    project_id: &str,
    sandbox_id: &str,
    logical_path: &str,
    expected_version: Option<i64>,
    idempotency: ProjectWorkspaceBindingIdempotency,
) -> NewProjectWorkspaceBinding {
    NewProjectWorkspaceBinding {
        id: Uuid::new_v4().to_string(),
        uuid: Uuid::new_v4().to_string(),
        project_id: project_id.to_owned(),
        sandbox_id: sandbox_id.to_owned(),
        root_entry_id: format!("entry:{sandbox_id}"),
        logical_path: logical_path.to_owned(),
        lifecycle_status: "active".to_owned(),
        expected_version,
        idempotency,
    }
}

#[tokio::test]
async fn upsert_is_idempotent_and_compare_and_swaps_existing_binding() {
    let (repository, pool, context) = setup().await;
    let first = binding("1", "sandbox:first", "src", None, idempotency('a', 'b'));
    let created = repository
        .upsert_workspace_binding(&context, &first, &audit("project.workspace_binding.upsert"))
        .await
        .expect("create workspace binding");
    assert_eq!(created.project_id, "1");
    assert_eq!(created.sandbox_id, "sandbox:first");
    assert_eq!(created.logical_path, "src");
    assert_eq!(created.version, "0");

    let replay_input = binding("1", "sandbox:first", "src", None, idempotency('a', 'b'));
    let replay = repository
        .upsert_workspace_binding(
            &context,
            &replay_input,
            &audit("project.workspace_binding.upsert"),
        )
        .await
        .expect("replay workspace-binding create");
    assert_eq!(replay.id, created.id);
    assert_eq!(replay.version, "0");

    let conflicting_replay = binding("1", "sandbox:changed", "src", None, idempotency('a', 'c'));
    let conflict = repository
        .upsert_workspace_binding(
            &context,
            &conflicting_replay,
            &audit("project.workspace_binding.upsert"),
        )
        .await;
    assert!(matches!(conflict, Err(ProjectError::Conflict(_))));

    let missing_if_match = binding(
        "1",
        "sandbox:second",
        "source files",
        None,
        idempotency('d', 'd'),
    );
    let missing_precondition = repository
        .upsert_workspace_binding(
            &context,
            &missing_if_match,
            &audit("project.workspace_binding.upsert"),
        )
        .await;
    assert!(matches!(
        missing_precondition,
        Err(ProjectError::PreconditionRequired(_))
    ));

    let stale = binding(
        "1",
        "sandbox:second",
        "source files",
        Some(7),
        idempotency('e', 'e'),
    );
    let stale_result = repository
        .upsert_workspace_binding(&context, &stale, &audit("project.workspace_binding.upsert"))
        .await;
    assert!(matches!(
        stale_result,
        Err(ProjectError::PreconditionFailed(_))
    ));

    let update = binding(
        "1",
        "sandbox:second",
        " source files / feature ",
        Some(0),
        idempotency('f', 'f'),
    );
    let updated = repository
        .upsert_workspace_binding(
            &context,
            &update,
            &audit("project.workspace_binding.upsert"),
        )
        .await
        .expect("update workspace binding");
    assert_eq!(updated.id, created.id);
    assert_eq!(updated.sandbox_id, "sandbox:second");
    assert_eq!(updated.logical_path, " source files / feature ");
    assert_eq!(updated.version, "1");

    let update_replay = repository
        .upsert_workspace_binding(
            &context,
            &update,
            &audit("project.workspace_binding.upsert"),
        )
        .await
        .expect("replay workspace-binding update");
    assert_eq!(update_replay.id, created.id);
    assert_eq!(update_replay.version, "1");

    let binding_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM studio_project_workspace_binding")
            .fetch_one(&pool)
            .await
            .expect("count workspace bindings");
    assert_eq!(binding_count, 1);
    let audit_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM ops_project_workspace_binding_audit")
            .fetch_one(&pool)
            .await
            .expect("count workspace-binding audit rows");
    assert_eq!(
        audit_count, 2,
        "idempotent replays must not duplicate audits"
    );
    let idempotency_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM studio_project_workspace_binding_idempotency")
            .fetch_one(&pool)
            .await
            .expect("count workspace-binding idempotency rows");
    assert_eq!(
        idempotency_count, 2,
        "failed preconditions and conflicts must roll back reservations"
    );
}

#[tokio::test]
async fn delete_tombstones_binding_and_enforces_tenant_and_version_scope() {
    let (repository, pool, context) = setup().await;
    let created = repository
        .upsert_workspace_binding(
            &context,
            &binding("1", "sandbox:first", "", None, idempotency('a', 'a')),
            &audit("project.workspace_binding.upsert"),
        )
        .await
        .expect("create workspace binding");

    let other_tenant = ProjectContext {
        tenant_id: "100002".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "200001".to_owned(),
    };
    assert!(repository
        .get_workspace_binding(&other_tenant, "1")
        .await
        .expect("read other tenant")
        .is_none());
    let other_user = ProjectContext {
        tenant_id: "100001".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "200002".to_owned(),
    };
    assert!(repository
        .get_workspace_binding(&other_user, "1")
        .await
        .expect("read unauthorized user")
        .is_none());

    let stale = repository
        .delete_workspace_binding(&context, "1", 7, &audit("project.workspace_binding.delete"))
        .await;
    assert!(matches!(stale, Err(ProjectError::PreconditionFailed(_))));

    repository
        .delete_workspace_binding(&context, "1", 0, &audit("project.workspace_binding.delete"))
        .await
        .expect("delete workspace binding");
    assert!(repository
        .get_workspace_binding(&context, "1")
        .await
        .expect("read deleted binding")
        .is_none());

    let row = sqlx::query(
        "SELECT lifecycle_status, version, is_deleted FROM studio_project_workspace_binding WHERE id = ?",
    )
    .bind(&created.id)
    .fetch_one(&pool)
    .await
    .expect("read tombstoned binding");
    assert_eq!(row.get::<String, _>("lifecycle_status"), "revoked");
    assert_eq!(row.get::<i64, _>("version"), 1);
    assert_eq!(row.get::<i64, _>("is_deleted"), 1);

    let audit_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM ops_project_workspace_binding_audit")
            .fetch_one(&pool)
            .await
            .expect("count workspace-binding audits");
    assert_eq!(audit_count, 2);
}

#[tokio::test]
async fn persistence_validation_rejects_unsafe_paths_and_protected_audit_keys_atomically() {
    let (repository, pool, context) = setup().await;
    let unsafe_binding = binding(
        "1",
        " sandbox:first",
        "src/../private",
        None,
        idempotency('a', 'a'),
    );
    let unsafe_result = repository
        .upsert_workspace_binding(
            &context,
            &unsafe_binding,
            &audit("project.workspace_binding.upsert"),
        )
        .await;
    assert!(matches!(unsafe_result, Err(ProjectError::InvalidInput(_))));

    let protected_audit = ProjectWorkspaceBindingAuditEntry {
        action: "project.workspace_binding.upsert".to_owned(),
        result: "accepted".to_owned(),
        trace_id: Some("trace-protected-audit".to_owned()),
        redacted_metadata_json: serde_json::json!({
            "details": [{ "providerRoot": "C:\\private" }],
        })
        .to_string(),
    };
    let protected_result = repository
        .upsert_workspace_binding(
            &context,
            &binding("1", "sandbox:first", "src", None, idempotency('b', 'b')),
            &protected_audit,
        )
        .await;
    assert!(matches!(
        protected_result,
        Err(ProjectError::InvalidInput(_))
    ));

    for table in [
        "studio_project_workspace_binding",
        "studio_project_workspace_binding_idempotency",
        "ops_project_workspace_binding_audit",
    ] {
        let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(&pool)
            .await
            .expect("count rolled-back workspace-binding rows");
        assert_eq!(
            count, 0,
            "{table} must remain unchanged after validation failure"
        );
    }
}
