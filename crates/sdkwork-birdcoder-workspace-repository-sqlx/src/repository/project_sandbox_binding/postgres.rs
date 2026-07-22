use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::sandbox_binding::{
    NewProjectSandboxBinding, ProjectSandboxBindingAuditEntry, ProjectSandboxBindingIdempotency,
    ProjectSandboxBindingPayload, PROJECT_SANDBOX_BINDING_STATUS_REVOKED,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_utils_rust::uuid;
use sqlx::postgres::PgRow;
use sqlx::{PgPool, Postgres, Row, Transaction};

use super::common::{
    binding_scope, map_sqlx_error, map_write_error, mutation_times, next_id, parse_version,
    validate_audit, validate_binding, BindingScope, IdempotencyReservation, StoredBinding,
};

const SELECT_BINDING: &str = r#"
SELECT b.id, b.project_id, b.sandbox_id, b.root_entry_id, b.logical_path,
       b.status, b.version,
       TO_CHAR(b.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS created_at,
       TO_CHAR(b.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS updated_at
FROM studio_project_sandbox_binding b
JOIN studio_project p
  ON p.id = b.project_id
 AND p.tenant_id = b.tenant_id
 AND p.organization_id = b.organization_id
 AND p.is_deleted = FALSE
WHERE b.project_id = $1
  AND b.tenant_id = $2
  AND b.organization_id = $3
  AND b.is_deleted = FALSE
  AND p.owner_user_id = $4
"#;

pub(super) async fn get(
    pool: &PgPool,
    context: &ProjectContext,
    project_id: &str,
) -> Result<Option<ProjectSandboxBindingPayload>, ProjectError> {
    let scope = binding_scope(context, project_id)?;
    let row = sqlx::query(SELECT_BINDING)
        .bind(scope.project_id)
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.user_id)
        .fetch_optional(pool)
        .await
        .map_err(map_sqlx_error)?;
    map_optional_row(row)
}

pub(super) async fn upsert(
    pool: &PgPool,
    id_generator: &SnowflakeIdGenerator,
    context: &ProjectContext,
    binding: &NewProjectSandboxBinding,
    audit: &ProjectSandboxBindingAuditEntry,
) -> Result<ProjectSandboxBindingPayload, ProjectError> {
    validate_binding(binding)?;
    validate_audit(audit)?;
    let scope = binding_scope(context, &binding.project_id)?;
    let (now, expires_at) = mutation_times();
    let mut transaction = pool.begin().await.map_err(map_sqlx_error)?;
    ensure_project_owner(&mut transaction, scope).await?;
    let current = fetch_on_transaction(&mut transaction, scope).await?;
    let candidate_id = match &current {
        Some(value) => parse_version(&value.id)?,
        None => next_id(id_generator)?,
    };
    let resource_id = candidate_id.to_string();
    let resource_version = current
        .as_ref()
        .map(|value| parse_version(&value.version))
        .transpose()?;

    match reserve_idempotency(
        &mut transaction,
        id_generator,
        scope,
        &binding.idempotency,
        &resource_id,
        resource_version,
        &now,
        &expires_at,
    )
    .await?
    {
        IdempotencyReservation::Replay { resource_id } => {
            let value = fetch_on_transaction(&mut transaction, scope)
                .await?
                .filter(|value| value.id == resource_id)
                .ok_or_else(|| {
                    ProjectError::Conflict(
                        "Idempotent sandbox binding is no longer available.".to_owned(),
                    )
                })?;
            transaction.commit().await.map_err(map_sqlx_error)?;
            return Ok(value);
        }
        IdempotencyReservation::Reserved => {}
    }

    let (binding_id, previous_version, new_version) = if let Some(current) = current {
        let expected_version = binding.expected_version.ok_or_else(|| {
            ProjectError::PreconditionRequired(
                "If-Match is required to replace an existing project sandbox binding.".to_owned(),
            )
        })?;
        let current_version = parse_version(&current.version)?;
        if current_version != expected_version {
            return Err(version_mismatch());
        }
        let result = sqlx::query(
            r#"
UPDATE studio_project_sandbox_binding
SET sandbox_id = $1, root_entry_id = $2, logical_path = $3, status = $4,
    updated_by_user_id = $5, updated_at = CAST($6 AS TIMESTAMPTZ), version = version + 1
WHERE id = $7 AND tenant_id = $8 AND organization_id = $9 AND project_id = $10
  AND version = $11 AND is_deleted = FALSE
  AND EXISTS (
      SELECT 1 FROM studio_project p
      WHERE p.id = studio_project_sandbox_binding.project_id
        AND p.tenant_id = studio_project_sandbox_binding.tenant_id
        AND p.organization_id = studio_project_sandbox_binding.organization_id
        AND p.owner_user_id = $12 AND p.is_deleted = FALSE
  )
"#,
        )
        .bind(&binding.sandbox_id)
        .bind(&binding.root_entry_id)
        .bind(&binding.logical_path)
        .bind(&binding.status)
        .bind(scope.user_id)
        .bind(&now)
        .bind(candidate_id)
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(expected_version)
        .bind(scope.user_id)
        .execute(&mut *transaction)
        .await
        .map_err(map_write_error)?;
        if result.rows_affected() != 1 {
            return Err(version_mismatch());
        }
        (candidate_id, Some(current_version), current_version + 1)
    } else {
        if binding.expected_version.is_some() {
            return Err(ProjectError::PreconditionFailed(
                "Project sandbox binding does not exist for the supplied If-Match.".to_owned(),
            ));
        }
        sqlx::query(
            r#"
INSERT INTO studio_project_sandbox_binding (
    id, uuid, tenant_id, organization_id, project_id, sandbox_id, root_entry_id,
    logical_path, status, created_by_user_id, updated_by_user_id, version,
    created_at, updated_at, is_deleted
) VALUES (
    $1, CAST($2 AS UUID), $3, $4, $5, $6, $7, $8, $9, $10, $11, 0,
    CAST($12 AS TIMESTAMPTZ), CAST($13 AS TIMESTAMPTZ), FALSE
)
"#,
        )
        .bind(candidate_id)
        .bind(uuid())
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(&binding.sandbox_id)
        .bind(&binding.root_entry_id)
        .bind(&binding.logical_path)
        .bind(&binding.status)
        .bind(scope.user_id)
        .bind(scope.user_id)
        .bind(&now)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(map_write_error)?;
        (candidate_id, None, 0)
    };

    update_reserved_resource_version(
        &mut transaction,
        scope,
        &binding.idempotency,
        new_version,
    )
    .await?;
    append_audit(
        &mut transaction,
        id_generator,
        scope,
        binding_id,
        audit,
        previous_version,
        Some(new_version),
        &now,
    )
    .await?;
    let value = fetch_on_transaction(&mut transaction, scope)
        .await?
        .filter(|value| value.id == binding_id.to_string())
        .ok_or_else(|| {
            ProjectError::Internal("Persisted project sandbox binding is unavailable.".to_owned())
        })?;
    transaction.commit().await.map_err(map_sqlx_error)?;
    Ok(value)
}

pub(super) async fn delete(
    pool: &PgPool,
    id_generator: &SnowflakeIdGenerator,
    context: &ProjectContext,
    project_id: &str,
    expected_version: i64,
    audit: &ProjectSandboxBindingAuditEntry,
) -> Result<(), ProjectError> {
    if expected_version < 0 {
        return Err(ProjectError::InvalidInput(
            "Sandbox-binding version must be non-negative.".to_owned(),
        ));
    }
    validate_audit(audit)?;
    let scope = binding_scope(context, project_id)?;
    let (now, _) = mutation_times();
    let mut transaction = pool.begin().await.map_err(map_sqlx_error)?;
    ensure_project_owner(&mut transaction, scope).await?;
    let current = fetch_on_transaction(&mut transaction, scope)
        .await?
        .ok_or_else(|| {
            ProjectError::NotFound("Project sandbox binding was not found.".to_owned())
        })?;
    let current_version = parse_version(&current.version)?;
    if current_version != expected_version {
        return Err(version_mismatch());
    }
    let binding_id = parse_version(&current.id)?;
    let result = sqlx::query(
        r#"
UPDATE studio_project_sandbox_binding
SET status = $1, updated_by_user_id = $2, is_deleted = TRUE,
    updated_at = CAST($3 AS TIMESTAMPTZ), version = version + 1
WHERE id = $4 AND tenant_id = $5 AND organization_id = $6 AND project_id = $7
  AND version = $8 AND is_deleted = FALSE
"#,
    )
    .bind(PROJECT_SANDBOX_BINDING_STATUS_REVOKED)
    .bind(scope.user_id)
    .bind(&now)
    .bind(binding_id)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(expected_version)
    .execute(&mut *transaction)
    .await
    .map_err(map_write_error)?;
    if result.rows_affected() != 1 {
        return Err(version_mismatch());
    }
    append_audit(
        &mut transaction,
        id_generator,
        scope,
        binding_id,
        audit,
        Some(current_version),
        Some(current_version + 1),
        &now,
    )
    .await?;
    transaction.commit().await.map_err(map_sqlx_error)?;
    Ok(())
}

async fn ensure_project_owner(
    transaction: &mut Transaction<'_, Postgres>,
    scope: BindingScope,
) -> Result<(), ProjectError> {
    let found = sqlx::query_scalar::<_, i64>(
        "SELECT 1 FROM studio_project WHERE id = $1 AND tenant_id = $2 AND organization_id = $3 AND owner_user_id = $4 AND is_deleted = FALSE FOR UPDATE",
    )
    .bind(scope.project_id)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.user_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(map_sqlx_error)?;
    if found.is_none() {
        return Err(ProjectError::NotFound("Project was not found.".to_owned()));
    }
    Ok(())
}

async fn fetch_on_transaction(
    transaction: &mut Transaction<'_, Postgres>,
    scope: BindingScope,
) -> Result<Option<ProjectSandboxBindingPayload>, ProjectError> {
    let row = sqlx::query(SELECT_BINDING)
        .bind(scope.project_id)
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.user_id)
        .fetch_optional(&mut **transaction)
        .await
        .map_err(map_sqlx_error)?;
    map_optional_row(row)
}

#[allow(clippy::too_many_arguments)]
async fn reserve_idempotency(
    transaction: &mut Transaction<'_, Postgres>,
    id_generator: &SnowflakeIdGenerator,
    scope: BindingScope,
    idempotency: &ProjectSandboxBindingIdempotency,
    resource_id: &str,
    resource_version: Option<i64>,
    now: &str,
    expires_at: &str,
) -> Result<IdempotencyReservation, ProjectError> {
    sqlx::query(
        r#"
DELETE FROM studio_project_sandbox_binding_idempotency
WHERE tenant_id = $1 AND organization_id = $2 AND project_id = $3
  AND subject_user_id = $4 AND operation_kind = $5 AND idempotency_key_hash = $6
  AND expires_at <= CAST($7 AS TIMESTAMPTZ)
"#,
    )
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(scope.user_id)
    .bind(&idempotency.operation)
    .bind(&idempotency.key_hash)
    .bind(now)
    .execute(&mut **transaction)
    .await
    .map_err(map_sqlx_error)?;

    let inserted = sqlx::query(
        r#"
INSERT INTO studio_project_sandbox_binding_idempotency (
    id, tenant_id, organization_id, project_id, subject_user_id, operation_kind,
    idempotency_key_hash, request_fingerprint, resource_id, resource_version,
    created_at, expires_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
    CAST($11 AS TIMESTAMPTZ), CAST($12 AS TIMESTAMPTZ)
)
ON CONFLICT DO NOTHING
"#,
    )
    .bind(next_id(id_generator)?)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(scope.user_id)
    .bind(&idempotency.operation)
    .bind(&idempotency.key_hash)
    .bind(&idempotency.request_fingerprint)
    .bind(resource_id)
    .bind(resource_version)
    .bind(now)
    .bind(expires_at)
    .execute(&mut **transaction)
    .await
    .map_err(map_write_error)?;
    if inserted.rows_affected() == 1 {
        return Ok(IdempotencyReservation::Reserved);
    }

    let existing = sqlx::query(
        r#"
SELECT request_fingerprint, resource_id
FROM studio_project_sandbox_binding_idempotency
WHERE tenant_id = $1 AND organization_id = $2 AND project_id = $3
  AND subject_user_id = $4 AND operation_kind = $5 AND idempotency_key_hash = $6
"#,
    )
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(scope.user_id)
    .bind(&idempotency.operation)
    .bind(&idempotency.key_hash)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(map_sqlx_error)?
    .ok_or_else(|| {
        ProjectError::Conflict("Sandbox-binding idempotency reservation is unavailable.".to_owned())
    })?;
    let fingerprint: String = existing.try_get("request_fingerprint").map_err(map_sqlx_error)?;
    if fingerprint != idempotency.request_fingerprint {
        return Err(ProjectError::Conflict(
            "Idempotency-Key was already used with a different request.".to_owned(),
        ));
    }
    Ok(IdempotencyReservation::Replay {
        resource_id: existing.try_get("resource_id").map_err(map_sqlx_error)?,
    })
}

async fn update_reserved_resource_version(
    transaction: &mut Transaction<'_, Postgres>,
    scope: BindingScope,
    idempotency: &ProjectSandboxBindingIdempotency,
    resource_version: i64,
) -> Result<(), ProjectError> {
    sqlx::query(
        r#"
UPDATE studio_project_sandbox_binding_idempotency
SET resource_version = $1
WHERE tenant_id = $2 AND organization_id = $3 AND project_id = $4
  AND subject_user_id = $5 AND operation_kind = $6 AND idempotency_key_hash = $7
"#,
    )
    .bind(resource_version)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(scope.user_id)
    .bind(&idempotency.operation)
    .bind(&idempotency.key_hash)
    .execute(&mut **transaction)
    .await
    .map_err(map_write_error)?;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn append_audit(
    transaction: &mut Transaction<'_, Postgres>,
    id_generator: &SnowflakeIdGenerator,
    scope: BindingScope,
    binding_id: i64,
    audit: &ProjectSandboxBindingAuditEntry,
    previous_version: Option<i64>,
    new_version: Option<i64>,
    occurred_at: &str,
) -> Result<(), ProjectError> {
    sqlx::query(
        r#"
INSERT INTO studio_project_sandbox_binding_audit (
    id, tenant_id, organization_id, project_id, sandbox_binding_id, actor_user_id,
    action, result, reason_code, trace_id, previous_version, new_version,
    redacted_metadata_json, occurred_at
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
    CAST($13 AS JSONB), CAST($14 AS TIMESTAMPTZ)
)
"#,
    )
    .bind(next_id(id_generator)?)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(binding_id)
    .bind(scope.user_id)
    .bind(&audit.action)
    .bind(&audit.result)
    .bind(&audit.reason_code)
    .bind(&audit.trace_id)
    .bind(previous_version)
    .bind(new_version)
    .bind(&audit.redacted_metadata_json)
    .bind(occurred_at)
    .execute(&mut **transaction)
    .await
    .map_err(map_write_error)?;
    Ok(())
}

fn map_optional_row(
    row: Option<PgRow>,
) -> Result<Option<ProjectSandboxBindingPayload>, ProjectError> {
    row.map(map_row).transpose()
}

fn map_row(row: PgRow) -> Result<ProjectSandboxBindingPayload, ProjectError> {
    Ok(StoredBinding {
        id: row.try_get("id").map_err(map_sqlx_error)?,
        project_id: row.try_get("project_id").map_err(map_sqlx_error)?,
        sandbox_id: row.try_get("sandbox_id").map_err(map_sqlx_error)?,
        root_entry_id: row.try_get("root_entry_id").map_err(map_sqlx_error)?,
        logical_path: row.try_get("logical_path").map_err(map_sqlx_error)?,
        status: row.try_get("status").map_err(map_sqlx_error)?,
        version: row.try_get("version").map_err(map_sqlx_error)?,
        created_at: row.try_get("created_at").map_err(map_sqlx_error)?,
        updated_at: row.try_get("updated_at").map_err(map_sqlx_error)?,
    }
    .into_payload())
}

fn version_mismatch() -> ProjectError {
    ProjectError::PreconditionFailed(
        "Sandbox-binding version does not match If-Match.".to_owned(),
    )
}
