use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::runtime_location::{
    NewProjectRuntimeLocation, NewProjectRuntimeLocationPreference,
    ProjectRuntimeLocationAuditEntry, ProjectRuntimeLocationRebind,
    ProjectRuntimeLocationUpdate, ProjectRuntimeLocationVerificationRequest,
    RuntimeLocationIdempotency, TrustedProjectRuntimeLocationVerification,
    HEALTH_STATUS_HEALTHY, HEALTH_STATUS_PENDING,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::runtime_location_repository::ProjectRuntimeLocationRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project_runtime_location::SqlxProjectRuntimeLocationRepository;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_utils_rust::uuid;
use sqlx::postgres::PgPoolOptions;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::{PgPool, SqlitePool};

const SQLITE_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/sqlite/0001_birdcoder_baseline.sql");
const POSTGRES_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/postgres/0001_birdcoder_baseline.sql");

const TENANT_ID: i64 = 100_001;
const ORGANIZATION_ID: i64 = 0;
const OWNER_ID: i64 = 200_001;
const PROJECT_ID: i64 = 300_001;
const WORKSPACE_ID: i64 = 400_001;

fn owner_context() -> ProjectContext {
    ProjectContext {
        tenant_id: TENANT_ID.to_string(),
        organization_id: ORGANIZATION_ID.to_string(),
        user_id: OWNER_ID.to_string(),
    }
}

fn idempotency(operation: &str, key: char, fingerprint: char) -> RuntimeLocationIdempotency {
    RuntimeLocationIdempotency {
        operation: operation.to_owned(),
        key_hash: key.to_string().repeat(64),
        request_fingerprint: fingerprint.to_string().repeat(64),
    }
}

fn audit(action: &str) -> ProjectRuntimeLocationAuditEntry {
    ProjectRuntimeLocationAuditEntry {
        action: action.to_owned(),
        result: "succeeded".to_owned(),
        reason_code: None,
        trace_id: Some(format!("trace-{action}")),
        redacted_metadata_json: format!(r#"{{"event":"{action}"}}"#),
    }
}

fn new_location(idempotency: RuntimeLocationIdempotency) -> NewProjectRuntimeLocation {
    NewProjectRuntimeLocation {
        uuid: uuid(),
        project_id: PROJECT_ID.to_string(),
        runtime_target_id: "desktop-primary".to_owned(),
        runtime_target_kind: "desktop".to_owned(),
        location_kind: "local_directory".to_owned(),
        path_flavor: "windows".to_owned(),
        display_name: "Primary checkout".to_owned(),
        encrypted_absolute_path: "ciphertext-v1".to_owned(),
        path_encryption_key_id: "runtime-location-v1".to_owned(),
        path_fingerprint: "a".repeat(64),
        terminal_available: false,
        git_available: false,
        build_available: false,
        filesystem_available: false,
        idempotency: Some(idempotency),
    }
}

async fn exercise_repository(
    repository: SqlxProjectRuntimeLocationRepository,
) -> Result<(), ProjectError> {
    let context = owner_context();
    let registration = new_location(idempotency("create", 'a', 'a'));
    let created = repository
        .register_runtime_location(&context, &registration, &audit("runtime_location.create"))
        .await?;
    assert!(created.id.parse::<i64>().is_ok());
    assert_eq!(created.health_status, HEALTH_STATUS_PENDING);
    assert_eq!(created.version, 0);
    assert!(!created.filesystem_available);

    let replay = repository
        .register_runtime_location(&context, &registration, &audit("runtime_location.create"))
        .await?;
    assert_eq!(replay.id, created.id);
    let (items, total) = repository
        .list_runtime_locations(&context, &PROJECT_ID.to_string(), 0, 20)
        .await?;
    assert_eq!(total, 1);
    assert_eq!(items.len(), 1);

    let conflicting_registration = new_location(idempotency("create", 'a', 'b'));
    assert!(matches!(
        repository
            .register_runtime_location(
                &context,
                &conflicting_registration,
                &audit("runtime_location.create")
            )
            .await,
        Err(ProjectError::Conflict(_))
    ));

    let updated = repository
        .update_runtime_location(
            &context,
            &PROJECT_ID.to_string(),
            &created.id,
            &ProjectRuntimeLocationUpdate {
                expected_version: 0,
                display_name: Some("Primary desktop".to_owned()),
                idempotency: Some(idempotency("update", 'b', 'b')),
            },
            &audit("runtime_location.update"),
        )
        .await?;
    assert_eq!(updated.display_name, "Primary desktop");
    assert_eq!(updated.version, 1);

    let requested = repository
        .request_runtime_location_verification(
            &context,
            &PROJECT_ID.to_string(),
            &created.id,
            &ProjectRuntimeLocationVerificationRequest {
                expected_version: 1,
                idempotency: idempotency("verify", 'c', 'c'),
            },
            &audit("runtime_location.verify.request"),
        )
        .await?;
    assert_eq!(requested.health_status, HEALTH_STATUS_PENDING);
    assert_eq!(requested.version, 2);

    let verified = repository
        .record_runtime_location_verification(
            &context,
            &PROJECT_ID.to_string(),
            &created.id,
            &TrustedProjectRuntimeLocationVerification {
                expected_version: 2,
                runtime_target_id: "desktop-primary".to_owned(),
                health_status: HEALTH_STATUS_HEALTHY.to_owned(),
                terminal_available: true,
                git_available: true,
                build_available: true,
                filesystem_available: true,
                idempotency: Some(idempotency("verify-result", 'd', 'd')),
            },
            &audit("runtime_location.verify"),
        )
        .await?;
    assert_eq!(verified.version, 3);
    assert!(verified.filesystem_available);
    assert!(verified.last_verified_at.is_some());

    let preference_input = NewProjectRuntimeLocationPreference {
        project_id: PROJECT_ID.to_string(),
        capability: "filesystem".to_owned(),
        runtime_location_id: created.id.clone(),
        expected_version: None,
        idempotency: Some(idempotency("preference", 'e', 'e')),
    };
    let preference = repository
        .upsert_runtime_location_preference(
            &context,
            &preference_input,
            &audit("runtime_location.preference"),
        )
        .await?;
    assert_eq!(preference.version, "0");
    let preference_replay = repository
        .upsert_runtime_location_preference(
            &context,
            &preference_input,
            &audit("runtime_location.preference"),
        )
        .await?;
    assert_eq!(preference_replay.id, preference.id);

    let replaced_preference = repository
        .upsert_runtime_location_preference(
            &context,
            &NewProjectRuntimeLocationPreference {
                project_id: PROJECT_ID.to_string(),
                capability: "filesystem".to_owned(),
                runtime_location_id: created.id.clone(),
                expected_version: Some(0),
                idempotency: Some(idempotency("preference", 'f', 'f')),
            },
            &audit("runtime_location.preference"),
        )
        .await?;
    assert_eq!(replaced_preference.version, "1");

    let stale_rebind = repository
        .rebind_runtime_location(
            &context,
            &PROJECT_ID.to_string(),
            &created.id,
            &ProjectRuntimeLocationRebind {
                expected_version: 2,
                path_flavor: "windows".to_owned(),
                display_name: "Stale checkout".to_owned(),
                encrypted_absolute_path: "ciphertext-stale".to_owned(),
                path_encryption_key_id: "runtime-location-v1".to_owned(),
                path_fingerprint: "b".repeat(64),
                idempotency: Some(idempotency("rebind", '1', '1')),
            },
            &audit("runtime_location.rebind"),
        )
        .await;
    assert!(matches!(stale_rebind, Err(ProjectError::PreconditionFailed(_))));

    let rebound = repository
        .rebind_runtime_location(
            &context,
            &PROJECT_ID.to_string(),
            &created.id,
            &ProjectRuntimeLocationRebind {
                expected_version: 3,
                path_flavor: "windows".to_owned(),
                display_name: "Rebound checkout".to_owned(),
                encrypted_absolute_path: "ciphertext-v2".to_owned(),
                path_encryption_key_id: "runtime-location-v2".to_owned(),
                path_fingerprint: "b".repeat(64),
                idempotency: Some(idempotency("rebind", '2', '2')),
            },
            &audit("runtime_location.rebind"),
        )
        .await?;
    assert_eq!(rebound.version, 4);
    assert_eq!(rebound.health_status, HEALTH_STATUS_PENDING);
    assert!(!rebound.filesystem_available);

    repository
        .delete_runtime_location(
            &context,
            &PROJECT_ID.to_string(),
            &created.id,
            4,
            &audit("runtime_location.delete"),
        )
        .await?;
    assert!(repository
        .find_runtime_location(&context, &PROJECT_ID.to_string(), &created.id)
        .await?
        .is_none());
    assert!(repository
        .get_runtime_location_preference(&context, &PROJECT_ID.to_string(), "filesystem")
        .await?
        .is_none());
    Ok(())
}

async fn seed_sqlite(pool: &SqlitePool) {
    sqlx::query(
        r#"
INSERT INTO studio_workspace (
    id, uuid, tenant_id, organization_id, owner_user_id, created_by_user_id,
    code, name, visibility, status, version, created_at, updated_at, is_deleted
) VALUES (?, ?, ?, ?, ?, ?, 'workspace-primary', 'Primary workspace',
          'organization', 'active', 0, ?, ?, 0)
"#,
    )
    .bind(WORKSPACE_ID)
    .bind(uuid())
    .bind(TENANT_ID)
    .bind(ORGANIZATION_ID)
    .bind(OWNER_ID)
    .bind(OWNER_ID)
    .bind("2026-01-01T00:00:00.000Z")
    .bind("2026-01-01T00:00:00.000Z")
    .execute(pool)
    .await
    .expect("seed SQLite workspace");
    sqlx::query(
        r#"
INSERT INTO studio_project (
    id, uuid, tenant_id, organization_id, workspace_id, owner_user_id,
    created_by_user_id, code, name, project_kind, status, version,
    created_at, updated_at, is_deleted
) VALUES (?, ?, ?, ?, ?, ?, ?, 'project-primary', 'Primary project', 'coding',
          'active', 0, ?, ?, 0)
"#,
    )
    .bind(PROJECT_ID)
    .bind(uuid())
    .bind(TENANT_ID)
    .bind(ORGANIZATION_ID)
    .bind(WORKSPACE_ID)
    .bind(OWNER_ID)
    .bind(OWNER_ID)
    .bind("2026-01-01T00:00:00.000Z")
    .bind("2026-01-01T00:00:00.000Z")
    .execute(pool)
    .await
    .expect("seed SQLite project");
}

async fn seed_postgres(pool: &PgPool) {
    sqlx::query(
        r#"
INSERT INTO studio_workspace (
    id, uuid, tenant_id, organization_id, owner_user_id, created_by_user_id,
    code, name, visibility, status, version, created_at, updated_at, is_deleted
) VALUES ($1, CAST($2 AS UUID), $3, $4, $5, $5, 'workspace-primary',
          'Primary workspace', 'organization', 'active', 0,
          CAST($6 AS TIMESTAMPTZ), CAST($6 AS TIMESTAMPTZ), FALSE)
"#,
    )
    .bind(WORKSPACE_ID)
    .bind(uuid())
    .bind(TENANT_ID)
    .bind(ORGANIZATION_ID)
    .bind(OWNER_ID)
    .bind("2026-01-01T00:00:00.000Z")
    .execute(pool)
    .await
    .expect("seed PostgreSQL workspace");
    sqlx::query(
        r#"
INSERT INTO studio_project (
    id, uuid, tenant_id, organization_id, workspace_id, owner_user_id,
    created_by_user_id, code, name, project_kind, status, version,
    created_at, updated_at, is_deleted
) VALUES ($1, CAST($2 AS UUID), $3, $4, $5, $6, $6, 'project-primary',
          'Primary project', 'coding', 'active', 0,
          CAST($7 AS TIMESTAMPTZ), CAST($7 AS TIMESTAMPTZ), FALSE)
"#,
    )
    .bind(PROJECT_ID)
    .bind(uuid())
    .bind(TENANT_ID)
    .bind(ORGANIZATION_ID)
    .bind(WORKSPACE_ID)
    .bind(OWNER_ID)
    .bind("2026-01-01T00:00:00.000Z")
    .execute(pool)
    .await
    .expect("seed PostgreSQL project");
}

#[tokio::test]
async fn sqlite_runtime_location_repository_matches_the_canonical_baseline() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("connect SQLite");
    sqlx::query("PRAGMA foreign_keys = ON")
        .execute(&pool)
        .await
        .expect("enable SQLite foreign keys");
    sqlx::raw_sql(SQLITE_BASELINE)
        .execute(&pool)
        .await
        .expect("apply canonical SQLite baseline");
    seed_sqlite(&pool).await;
    let generator = SnowflakeIdGenerator::new(17).expect("construct Snowflake generator");
    exercise_repository(SqlxProjectRuntimeLocationRepository::from_sqlite(
        pool.clone(),
        generator,
    ))
    .await
    .expect("exercise SQLite runtime-location repository");
    let audit_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM studio_project_runtime_location_audit")
            .fetch_one(&pool)
            .await
            .expect("count SQLite audits");
    assert_eq!(audit_count, 8);
}

#[tokio::test]
#[ignore = "requires SDKWORK_BIRDCODER_POSTGRES_TEST_URL"]
async fn postgres_runtime_location_repository_matches_the_canonical_baseline() {
    let database_url = std::env::var("SDKWORK_BIRDCODER_POSTGRES_TEST_URL")
        .expect("SDKWORK_BIRDCODER_POSTGRES_TEST_URL must be set");
    let schema = format!("birdcoder_runtime_location_test_{}", uuid().replace('-', ""));
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("connect PostgreSQL");
    sqlx::query(&format!(r#"CREATE SCHEMA "{schema}""#))
        .execute(&pool)
        .await
        .expect("create PostgreSQL test schema");
    sqlx::query(&format!(r#"SET search_path TO "{schema}""#))
        .execute(&pool)
        .await
        .expect("select PostgreSQL test schema");
    let result = async {
        sqlx::raw_sql(POSTGRES_BASELINE)
            .execute(&pool)
            .await
            .map_err(|error| error.to_string())?;
        seed_postgres(&pool).await;
        let generator = SnowflakeIdGenerator::new(18).map_err(|error| error.to_string())?;
        exercise_repository(SqlxProjectRuntimeLocationRepository::from_postgres(
            pool.clone(),
            generator,
        ))
        .await
        .map_err(|error| error.to_string())
    }
    .await;
    sqlx::query("SET search_path TO public")
        .execute(&pool)
        .await
        .expect("restore PostgreSQL search path");
    sqlx::query(&format!(r#"DROP SCHEMA "{schema}" CASCADE"#))
        .execute(&pool)
        .await
        .expect("drop PostgreSQL test schema");
    result.expect("exercise PostgreSQL runtime-location repository");
}
