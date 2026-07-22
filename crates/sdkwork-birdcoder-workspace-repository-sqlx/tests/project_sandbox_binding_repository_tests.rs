use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::sandbox_binding::{
    NewProjectSandboxBinding, ProjectSandboxBindingAuditEntry,
    ProjectSandboxBindingIdempotency,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::sandbox_binding_repository::ProjectSandboxBindingRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project_sandbox_binding::SqlxProjectSandboxBindingRepository;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_utils_rust::uuid;
use sqlx::{sqlite::SqlitePoolOptions, Row, SqlitePool};

const SQLITE_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/sqlite/0001_birdcoder_baseline.sql");

async fn setup() -> (
    SqlxProjectSandboxBindingRepository,
    SqlitePool,
    ProjectContext,
) {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("open SQLite database");
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .expect("enable foreign keys");
    sqlx::raw_sql(SQLITE_BASELINE)
        .execute(&pool)
        .await
        .expect("apply canonical BirdCoder baseline");
    seed_project(&pool, 1, 100001, 0, 200001, "primary").await;
    let generator = SnowflakeIdGenerator::new(7).expect("construct test Snowflake generator");
    (
        SqlxProjectSandboxBindingRepository::from_sqlite(pool.clone(), generator),
        pool,
        ProjectContext {
            tenant_id: "100001".to_owned(),
            organization_id: "0".to_owned(),
            user_id: "200001".to_owned(),
        },
    )
}

async fn seed_project(
    pool: &SqlitePool,
    id: i64,
    tenant_id: i64,
    organization_id: i64,
    owner_id: i64,
    suffix: &str,
) {
    let workspace_id = id + 10_000;
    sqlx::query(
        r#"
INSERT INTO studio_workspace (
    id, uuid, tenant_id, organization_id, owner_user_id, created_by_user_id,
    code, name, description, icon_url, color, visibility, status, version,
    created_at, updated_at, is_deleted
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 'private', 'active', 0, ?, ?, 0)
"#,
    )
    .bind(workspace_id)
    .bind(uuid())
    .bind(tenant_id)
    .bind(organization_id)
    .bind(owner_id)
    .bind(owner_id)
    .bind(format!("workspace-{suffix}"))
    .bind(format!("Workspace {suffix}"))
    .bind("2026-01-01T00:00:00Z")
    .bind("2026-01-01T00:00:00Z")
    .execute(pool)
    .await
    .expect("seed workspace");

    sqlx::query(
        r#"
INSERT INTO studio_project (
    id, uuid, tenant_id, organization_id, workspace_id, owner_user_id,
    created_by_user_id, code, name, description, project_kind,
    default_agent_project_id, status, version, created_at, updated_at, is_deleted
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'coding', NULL, 'active', 0, ?, ?, 0)
"#,
    )
    .bind(id)
    .bind(uuid())
    .bind(tenant_id)
    .bind(organization_id)
    .bind(workspace_id)
    .bind(owner_id)
    .bind(owner_id)
    .bind(format!("project-{suffix}"))
    .bind(format!("Project {suffix}"))
    .bind("2026-01-01T00:00:00Z")
    .bind("2026-01-01T00:00:00Z")
    .execute(pool)
    .await
    .expect("seed project");
}

fn audit(action: &str) -> ProjectSandboxBindingAuditEntry {
    ProjectSandboxBindingAuditEntry {
        action: action.to_owned(),
        result: "succeeded".to_owned(),
        reason_code: None,
        trace_id: Some("trace-sandbox-binding-repository".to_owned()),
        redacted_metadata_json: serde_json::json!({ "event": action }).to_string(),
    }
}

fn idempotency(key: char, fingerprint: char) -> ProjectSandboxBindingIdempotency {
    let key_nibble = format!("{:x}", (key as u32) % 16);
    let fingerprint_nibble = format!("{:x}", (fingerprint as u32) % 16);
    ProjectSandboxBindingIdempotency {
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
    idempotency: ProjectSandboxBindingIdempotency,
) -> NewProjectSandboxBinding {
    NewProjectSandboxBinding {
        project_id: project_id.to_owned(),
        sandbox_id: sandbox_id.to_owned(),
        root_entry_id: format!("entry:{sandbox_id}"),
        logical_path: logical_path.to_owned(),
        status: "active".to_owned(),
        expected_version,
        idempotency,
    }
}

#[tokio::test]
async fn upsert_is_idempotent_and_compare_and_swaps_existing_binding() {
    let (repository, pool, context) = setup().await;
    let first = binding("1", "sandbox:first", "src", None, idempotency('a', 'b'));
    let created = repository
        .upsert_sandbox_binding(&context, &first, &audit("project.sandbox_binding.upsert"))
        .await
        .expect("create sandbox binding");
    assert_eq!(created.project_id, "1");
    assert_eq!(created.sandbox_id, "sandbox:first");
    assert_eq!(created.logical_path, "src");
    assert_eq!(created.status, "active");
    assert_eq!(created.version, "0");
    assert!(created.id.parse::<i64>().is_ok(), "id must be decimal Snowflake text");

    let replay_input = binding("1", "sandbox:first", "src", None, idempotency('a', 'b'));
    let replay = repository
        .upsert_sandbox_binding(
            &context,
            &replay_input,
            &audit("project.sandbox_binding.upsert"),
        )
        .await
        .expect("replay sandbox-binding create");
    assert_eq!(replay.id, created.id);
    assert_eq!(replay.version, "0");

    let conflicting_replay = binding("1", "sandbox:changed", "src", None, idempotency('a', 'c'));
    let conflict = repository
        .upsert_sandbox_binding(
            &context,
            &conflicting_replay,
            &audit("project.sandbox_binding.upsert"),
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
        .upsert_sandbox_binding(
            &context,
            &missing_if_match,
            &audit("project.sandbox_binding.upsert"),
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
        .upsert_sandbox_binding(&context, &stale, &audit("project.sandbox_binding.upsert"))
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
        .upsert_sandbox_binding(
            &context,
            &update,
            &audit("project.sandbox_binding.upsert"),
        )
        .await
        .expect("update sandbox binding");
    assert_eq!(updated.id, created.id);
    assert_eq!(updated.sandbox_id, "sandbox:second");
    assert_eq!(updated.logical_path, " source files / feature ");
    assert_eq!(updated.version, "1");

    let update_replay = repository
        .upsert_sandbox_binding(
            &context,
            &update,
            &audit("project.sandbox_binding.upsert"),
        )
        .await
        .expect("replay sandbox-binding update");
    assert_eq!(update_replay.id, created.id);
    assert_eq!(update_replay.version, "1");

    let binding_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM studio_project_sandbox_binding")
            .fetch_one(&pool)
            .await
            .expect("count sandbox bindings");
    assert_eq!(binding_count, 1);
    let audit_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM studio_project_sandbox_binding_audit")
            .fetch_one(&pool)
            .await
            .expect("count sandbox-binding audit rows");
    assert_eq!(audit_count, 2, "idempotent replays must not duplicate audits");
    let audit_versions = sqlx::query(
        "SELECT result, previous_version, new_version FROM studio_project_sandbox_binding_audit ORDER BY occurred_at, id",
    )
    .fetch_all(&pool)
    .await
    .expect("read audit versions");
    assert_eq!(audit_versions[0].get::<String, _>("result"), "succeeded");
    assert_eq!(audit_versions[0].get::<Option<i64>, _>("previous_version"), None);
    assert_eq!(audit_versions[0].get::<Option<i64>, _>("new_version"), Some(0));
    assert_eq!(audit_versions[1].get::<Option<i64>, _>("previous_version"), Some(0));
    assert_eq!(audit_versions[1].get::<Option<i64>, _>("new_version"), Some(1));
    let idempotency_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM studio_project_sandbox_binding_idempotency",
    )
    .fetch_one(&pool)
    .await
    .expect("count sandbox-binding idempotency rows");
    assert_eq!(
        idempotency_count, 2,
        "failed preconditions and conflicts must roll back reservations"
    );
}

#[tokio::test]
async fn delete_tombstones_binding_and_enforces_tenant_owner_and_version_scope() {
    let (repository, pool, context) = setup().await;
    let created = repository
        .upsert_sandbox_binding(
            &context,
            &binding("1", "sandbox:first", "", None, idempotency('a', 'a')),
            &audit("project.sandbox_binding.upsert"),
        )
        .await
        .expect("create sandbox binding");

    let other_tenant = ProjectContext {
        tenant_id: "100002".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "200001".to_owned(),
    };
    assert!(repository
        .get_sandbox_binding(&other_tenant, "1")
        .await
        .expect("read other tenant")
        .is_none());
    let other_user = ProjectContext {
        tenant_id: "100001".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "200002".to_owned(),
    };
    assert!(repository
        .get_sandbox_binding(&other_user, "1")
        .await
        .expect("read unauthorized user")
        .is_none());

    let stale = repository
        .delete_sandbox_binding(&context, "1", 7, &audit("project.sandbox_binding.delete"))
        .await;
    assert!(matches!(stale, Err(ProjectError::PreconditionFailed(_))));

    repository
        .delete_sandbox_binding(&context, "1", 0, &audit("project.sandbox_binding.delete"))
        .await
        .expect("delete sandbox binding");
    assert!(repository
        .get_sandbox_binding(&context, "1")
        .await
        .expect("read deleted binding")
        .is_none());

    let row = sqlx::query(
        "SELECT status, version, is_deleted FROM studio_project_sandbox_binding WHERE id = ?",
    )
    .bind(created.id.parse::<i64>().expect("parse binding id"))
    .fetch_one(&pool)
    .await
    .expect("read tombstoned binding");
    assert_eq!(row.get::<String, _>("status"), "revoked");
    assert_eq!(row.get::<i64, _>("version"), 1);
    assert_eq!(row.get::<i64, _>("is_deleted"), 1);

    let audit = sqlx::query(
        "SELECT previous_version, new_version FROM studio_project_sandbox_binding_audit ORDER BY occurred_at DESC, id DESC LIMIT 1",
    )
    .fetch_one(&pool)
    .await
    .expect("read delete audit");
    assert_eq!(audit.get::<Option<i64>, _>("previous_version"), Some(0));
    assert_eq!(audit.get::<Option<i64>, _>("new_version"), Some(1));
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
        .upsert_sandbox_binding(
            &context,
            &unsafe_binding,
            &audit("project.sandbox_binding.upsert"),
        )
        .await;
    assert!(matches!(unsafe_result, Err(ProjectError::InvalidInput(_))));

    let protected_audit = ProjectSandboxBindingAuditEntry {
        action: "project.sandbox_binding.upsert".to_owned(),
        result: "succeeded".to_owned(),
        reason_code: None,
        trace_id: Some("trace-protected-audit".to_owned()),
        redacted_metadata_json: serde_json::json!({
            "details": [{ "providerRoot": "C:\\private" }],
        })
        .to_string(),
    };
    let protected_result = repository
        .upsert_sandbox_binding(
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
        "studio_project_sandbox_binding",
        "studio_project_sandbox_binding_idempotency",
        "studio_project_sandbox_binding_audit",
    ] {
        let count: i64 = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(&pool)
            .await
            .expect("count rolled-back sandbox-binding rows");
        assert_eq!(count, 0, "{table} must remain unchanged after validation failure");
    }
}
