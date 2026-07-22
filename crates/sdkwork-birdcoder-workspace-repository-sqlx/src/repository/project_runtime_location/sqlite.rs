use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::runtime_location::{
    NewProjectRuntimeLocation, NewProjectRuntimeLocationPreference,
    ProjectRuntimeLocationAuditEntry, ProjectRuntimeLocationPreferencePayload,
    ProjectRuntimeLocationRebind, ProjectRuntimeLocationUpdate,
    ProjectRuntimeLocationVerificationRequest, RuntimeLocationIdempotency,
    StoredProjectRuntimeLocation, TrustedProjectRuntimeLocationVerification, HEALTH_STATUS_HEALTHY,
    HEALTH_STATUS_PENDING, HEALTH_STATUS_REVOKED,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_utils_rust::id::uuid;
use sqlx::sqlite::SqliteRow;
use sqlx::{Row, Sqlite, SqlitePool, Transaction};

use super::common::{
    map_sqlx_error, map_write_error, next_id, page_window, positive_id, precondition_miss,
    scope, supports_capability, timestamps, validate_audit, validate_idempotency,
    validate_new_location, validate_preference, validate_rebind, validate_update,
    validate_verification, IdempotencyReservation, RuntimeLocationScope, RESOURCE_KIND_LOCATION,
    RESOURCE_KIND_PREFERENCE,
};

const LOCATION_COLUMNS: &str = r#"
l.id, l.uuid, l.tenant_id, l.organization_id, l.project_id, l.registered_by_user_id,
l.runtime_target_id, l.runtime_target_kind, l.location_kind, l.path_flavor, l.display_name,
l.encrypted_absolute_path, l.path_encryption_key_id, l.path_fingerprint,
l.terminal_available, l.git_available, l.build_available, l.filesystem_available,
l.health_status, l.last_verified_at, l.last_seen_at, l.verified_by_user_id,
l.version, l.created_at, l.updated_at
"#;

const PREFERENCE_COLUMNS: &str = r#"
p.id, p.project_id, p.subject_user_id, p.capability, p.runtime_location_id,
p.version, p.created_at, p.updated_at
"#;

pub(super) async fn list(
    pool: &SqlitePool,
    context: &ProjectContext,
    project_id: &str,
    offset: usize,
    limit: usize,
) -> Result<(Vec<StoredProjectRuntimeLocation>, usize), ProjectError> {
    let scope = scope(context, project_id)?;
    let (offset, limit) = page_window(offset, limit)?;
    let sql = format!(
        r#"
SELECT {LOCATION_COLUMNS}
FROM studio_project_runtime_location l
JOIN studio_project p ON p.id = l.project_id AND p.is_deleted = 0
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE l.tenant_id = ? AND l.organization_id = ? AND l.project_id = ? AND l.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
ORDER BY l.updated_at DESC, l.id DESC LIMIT ? OFFSET ?
"#,
    );
    let rows = sqlx::query(&sql)
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(scope.user_id)
        .bind(scope.user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(map_sqlx_error)?;
    let items = rows
        .into_iter()
        .map(map_location_row)
        .collect::<Result<Vec<_>, _>>()?;
    let total: i64 = sqlx::query_scalar(
        r#"
SELECT COUNT(*)
FROM studio_project_runtime_location l
JOIN studio_project p ON p.id = l.project_id AND p.is_deleted = 0
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE l.tenant_id = ? AND l.organization_id = ? AND l.project_id = ? AND l.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
"#,
    )
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(scope.user_id)
    .bind(scope.user_id)
    .fetch_one(pool)
    .await
    .map_err(map_sqlx_error)?;
    Ok((items, usize::try_from(total).unwrap_or(usize::MAX)))
}

pub(super) async fn find(
    pool: &SqlitePool,
    context: &ProjectContext,
    project_id: &str,
    runtime_location_id: &str,
) -> Result<Option<StoredProjectRuntimeLocation>, ProjectError> {
    let scope = scope(context, project_id)?;
    let location_id = positive_id(runtime_location_id, "runtime_location_id")?;
    let sql = format!(
        r#"
SELECT {LOCATION_COLUMNS}
FROM studio_project_runtime_location l
JOIN studio_project p ON p.id = l.project_id AND p.is_deleted = 0
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE l.id = ? AND l.tenant_id = ? AND l.organization_id = ? AND l.project_id = ?
  AND l.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
"#,
    );
    map_optional_location(
        sqlx::query(&sql)
            .bind(location_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .fetch_optional(pool)
            .await
            .map_err(map_sqlx_error)?,
    )
}

pub(super) async fn register(
    pool: &SqlitePool,
    id_generator: &SnowflakeIdGenerator,
    context: &ProjectContext,
    location: &NewProjectRuntimeLocation,
    audit: &ProjectRuntimeLocationAuditEntry,
) -> Result<StoredProjectRuntimeLocation, ProjectError> {
    validate_new_location(location)?;
    validate_audit(audit)?;
    let scope = scope(context, &location.project_id)?;
    let location_id = next_id(id_generator)?;
    let (now, expires_at) = timestamps();
    let mut transaction = pool.begin().await.map_err(map_sqlx_error)?;
    ensure_project_write_access(&mut transaction, scope).await?;
    match reserve_idempotency(
        &mut transaction,
        id_generator,
        scope,
        location.idempotency.as_ref(),
        RESOURCE_KIND_LOCATION,
        &location_id.to_string(),
        Some(0),
        &now,
        &expires_at,
    )
    .await?
    {
        IdempotencyReservation::Replay { resource_id } => {
            let value = fetch_location(&mut transaction, scope, &resource_id)
                .await?
                .ok_or_else(|| ProjectError::Conflict("Idempotent runtime location is unavailable.".to_owned()))?;
            transaction.commit().await.map_err(map_sqlx_error)?;
            return Ok(value);
        }
        IdempotencyReservation::Reserved => {}
    }

    sqlx::query(
        r#"
INSERT INTO studio_project_runtime_location (
    id, uuid, tenant_id, organization_id, project_id, registered_by_user_id,
    runtime_target_id, runtime_target_kind, location_kind, path_flavor, display_name,
    encrypted_absolute_path, path_encryption_key_id, path_fingerprint,
    terminal_available, git_available, build_available, filesystem_available,
    health_status, version, created_at, updated_at, is_deleted
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0)
"#,
    )
    .bind(location_id)
    .bind(&location.uuid)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(scope.user_id)
    .bind(&location.runtime_target_id)
    .bind(&location.runtime_target_kind)
    .bind(&location.location_kind)
    .bind(&location.path_flavor)
    .bind(&location.display_name)
    .bind(&location.encrypted_absolute_path)
    .bind(&location.path_encryption_key_id)
    .bind(&location.path_fingerprint)
    .bind(location.terminal_available)
    .bind(location.git_available)
    .bind(location.build_available)
    .bind(location.filesystem_available)
    .bind(HEALTH_STATUS_PENDING)
    .bind(&now)
    .bind(&now)
    .execute(&mut *transaction)
    .await
    .map_err(map_write_error)?;
    append_audit(
        &mut transaction,
        id_generator,
        scope,
        Some(location_id),
        audit,
        None,
        Some(0),
        &now,
    )
    .await?;
    let value = fetch_location(&mut transaction, scope, &location_id.to_string())
        .await?
        .ok_or_else(|| ProjectError::Internal("Created runtime location is unavailable.".to_owned()))?;
    transaction.commit().await.map_err(map_sqlx_error)?;
    Ok(value)
}

pub(super) async fn update(
    pool: &SqlitePool,
    id_generator: &SnowflakeIdGenerator,
    context: &ProjectContext,
    project_id: &str,
    runtime_location_id: &str,
    update: &ProjectRuntimeLocationUpdate,
    audit: &ProjectRuntimeLocationAuditEntry,
) -> Result<StoredProjectRuntimeLocation, ProjectError> {
    validate_update(update)?;
    let display_name = update.display_name.clone();
    let expected_version = update.expected_version;
    mutate_location(
        pool,
        id_generator,
        context,
        project_id,
        runtime_location_id,
        expected_version,
        update.idempotency.as_ref(),
        audit,
        |transaction, scope, location_id, now| {
            Box::pin(async move {
                sqlx::query(
                    r#"
UPDATE studio_project_runtime_location
SET display_name = ?, updated_at = ?, version = version + 1
WHERE id = ? AND tenant_id = ? AND organization_id = ? AND project_id = ?
  AND version = ? AND is_deleted = 0
"#,
                )
                .bind(display_name.as_deref())
                .bind(now)
                .bind(location_id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.project_id)
                .bind(expected_version)
                .execute(&mut **transaction)
                .await
                .map_err(map_write_error)
                .map(|result| result.rows_affected())
            })
        },
    )
    .await
}

pub(super) async fn rebind(
    pool: &SqlitePool,
    id_generator: &SnowflakeIdGenerator,
    context: &ProjectContext,
    project_id: &str,
    runtime_location_id: &str,
    rebind: &ProjectRuntimeLocationRebind,
    audit: &ProjectRuntimeLocationAuditEntry,
) -> Result<StoredProjectRuntimeLocation, ProjectError> {
    validate_rebind(rebind)?;
    let rebind = rebind.clone();
    let expected_version = rebind.expected_version;
    let idempotency = rebind.idempotency.clone();
    mutate_location(
        pool,
        id_generator,
        context,
        project_id,
        runtime_location_id,
        expected_version,
        idempotency.as_ref(),
        audit,
        |transaction, scope, location_id, now| {
            Box::pin(async move {
                sqlx::query(
                    r#"
UPDATE studio_project_runtime_location
SET path_flavor = ?, display_name = ?, encrypted_absolute_path = ?,
    path_encryption_key_id = ?, path_fingerprint = ?,
    terminal_available = 0, git_available = 0, build_available = 0,
    filesystem_available = 0, health_status = ?, last_verified_at = NULL,
    last_seen_at = NULL, verified_by_user_id = NULL,
    updated_at = ?, version = version + 1
WHERE id = ? AND tenant_id = ? AND organization_id = ? AND project_id = ?
  AND version = ? AND is_deleted = 0
"#,
                )
                .bind(&rebind.path_flavor)
                .bind(&rebind.display_name)
                .bind(&rebind.encrypted_absolute_path)
                .bind(&rebind.path_encryption_key_id)
                .bind(&rebind.path_fingerprint)
                .bind(HEALTH_STATUS_PENDING)
                .bind(now)
                .bind(location_id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.project_id)
                .bind(rebind.expected_version)
                .execute(&mut **transaction)
                .await
                .map_err(map_write_error)
                .map(|result| result.rows_affected())
            })
        },
    )
    .await
}

pub(super) async fn request_verification(
    pool: &SqlitePool,
    id_generator: &SnowflakeIdGenerator,
    context: &ProjectContext,
    project_id: &str,
    runtime_location_id: &str,
    request: &ProjectRuntimeLocationVerificationRequest,
    audit: &ProjectRuntimeLocationAuditEntry,
) -> Result<StoredProjectRuntimeLocation, ProjectError> {
    validate_idempotency(&request.idempotency)?;
    let request = request.clone();
    let expected_version = request.expected_version;
    let idempotency = request.idempotency.clone();
    mutate_location(
        pool,
        id_generator,
        context,
        project_id,
        runtime_location_id,
        expected_version,
        Some(&idempotency),
        audit,
        |transaction, scope, location_id, now| {
            Box::pin(async move {
                sqlx::query(
                    r#"
UPDATE studio_project_runtime_location
SET terminal_available = 0, git_available = 0, build_available = 0,
    filesystem_available = 0, health_status = ?, verified_by_user_id = NULL,
    updated_at = ?, version = version + 1
WHERE id = ? AND tenant_id = ? AND organization_id = ? AND project_id = ?
  AND version = ? AND is_deleted = 0
"#,
                )
                .bind(HEALTH_STATUS_PENDING)
                .bind(now)
                .bind(location_id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.project_id)
                .bind(request.expected_version)
                .execute(&mut **transaction)
                .await
                .map_err(map_write_error)
                .map(|result| result.rows_affected())
            })
        },
    )
    .await
}

pub(super) async fn record_verification(
    pool: &SqlitePool,
    id_generator: &SnowflakeIdGenerator,
    context: &ProjectContext,
    project_id: &str,
    runtime_location_id: &str,
    verification: &TrustedProjectRuntimeLocationVerification,
    audit: &ProjectRuntimeLocationAuditEntry,
) -> Result<StoredProjectRuntimeLocation, ProjectError> {
    validate_verification(verification)?;
    let scope = scope(context, project_id)?;
    let location_id = positive_id(runtime_location_id, "runtime_location_id")?;
    let (now, expires_at) = timestamps();
    let mut transaction = pool.begin().await.map_err(map_sqlx_error)?;
    ensure_project_write_access(&mut transaction, scope).await?;
    let current = fetch_location(&mut transaction, scope, runtime_location_id)
        .await?
        .ok_or_else(|| ProjectError::NotFound("Project runtime location was not found.".to_owned()))?;
    if current.runtime_target_id != verification.runtime_target_id {
        return Err(ProjectError::Forbidden(
            "The runtime target does not own this project location.".to_owned(),
        ));
    }
    match reserve_idempotency(
        &mut transaction,
        id_generator,
        scope,
        verification.idempotency.as_ref(),
        RESOURCE_KIND_LOCATION,
        runtime_location_id,
        Some(verification.expected_version + 1),
        &now,
        &expires_at,
    )
    .await?
    {
        IdempotencyReservation::Replay { resource_id } => {
            let value = fetch_location(&mut transaction, scope, &resource_id)
                .await?
                .ok_or_else(|| ProjectError::Conflict("Idempotent runtime location is unavailable.".to_owned()))?;
            transaction.commit().await.map_err(map_sqlx_error)?;
            return Ok(value);
        }
        IdempotencyReservation::Reserved => {}
    }
    if current.version != verification.expected_version {
        return Err(precondition_miss());
    }
    let revoked = verification.health_status == HEALTH_STATUS_REVOKED;
    let result = sqlx::query(
        r#"
UPDATE studio_project_runtime_location
SET health_status = ?, terminal_available = ?, git_available = ?, build_available = ?,
    filesystem_available = ?, last_verified_at = ?, last_seen_at = ?,
    verified_by_user_id = ?, updated_at = ?, version = version + 1
WHERE id = ? AND tenant_id = ? AND organization_id = ? AND project_id = ?
  AND version = ? AND is_deleted = 0
"#,
    )
    .bind(&verification.health_status)
    .bind(!revoked && verification.terminal_available)
    .bind(!revoked && verification.git_available)
    .bind(!revoked && verification.build_available)
    .bind(!revoked && verification.filesystem_available)
    .bind(&now)
    .bind(&now)
    .bind(scope.user_id)
    .bind(&now)
    .bind(location_id)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(verification.expected_version)
    .execute(&mut *transaction)
    .await
    .map_err(map_write_error)?;
    if result.rows_affected() != 1 {
        return Err(precondition_miss());
    }
    append_audit(
        &mut transaction,
        id_generator,
        scope,
        Some(location_id),
        audit,
        Some(verification.expected_version),
        Some(verification.expected_version + 1),
        &now,
    )
    .await?;
    let value = fetch_location(&mut transaction, scope, runtime_location_id)
        .await?
        .ok_or_else(|| ProjectError::Internal("Verified runtime location is unavailable.".to_owned()))?;
    transaction.commit().await.map_err(map_sqlx_error)?;
    Ok(value)
}

pub(super) async fn delete(
    pool: &SqlitePool,
    id_generator: &SnowflakeIdGenerator,
    context: &ProjectContext,
    project_id: &str,
    runtime_location_id: &str,
    expected_version: i64,
    audit: &ProjectRuntimeLocationAuditEntry,
) -> Result<(), ProjectError> {
    if expected_version < 0 {
        return Err(ProjectError::InvalidInput("If-Match is invalid.".to_owned()));
    }
    validate_audit(audit)?;
    let scope = scope(context, project_id)?;
    let location_id = positive_id(runtime_location_id, "runtime_location_id")?;
    let (now, _) = timestamps();
    let mut transaction = pool.begin().await.map_err(map_sqlx_error)?;
    ensure_project_write_access(&mut transaction, scope).await?;
    let current = fetch_location(&mut transaction, scope, runtime_location_id)
        .await?
        .ok_or_else(|| ProjectError::NotFound("Project runtime location was not found.".to_owned()))?;
    if current.version != expected_version {
        return Err(precondition_miss());
    }
    sqlx::query(
        r#"
UPDATE studio_project_runtime_location_preference
SET is_deleted = 1, updated_at = ?, version = version + 1
WHERE tenant_id = ? AND organization_id = ? AND project_id = ?
  AND runtime_location_id = ? AND is_deleted = 0
"#,
    )
    .bind(&now)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(location_id)
    .execute(&mut *transaction)
    .await
    .map_err(map_write_error)?;
    let result = sqlx::query(
        r#"
UPDATE studio_project_runtime_location
SET health_status = ?, terminal_available = 0, git_available = 0,
    build_available = 0, filesystem_available = 0, is_deleted = 1,
    updated_at = ?, version = version + 1
WHERE id = ? AND tenant_id = ? AND organization_id = ? AND project_id = ?
  AND version = ? AND is_deleted = 0
"#,
    )
    .bind(HEALTH_STATUS_REVOKED)
    .bind(&now)
    .bind(location_id)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(expected_version)
    .execute(&mut *transaction)
    .await
    .map_err(map_write_error)?;
    if result.rows_affected() != 1 {
        return Err(precondition_miss());
    }
    append_audit(
        &mut transaction,
        id_generator,
        scope,
        Some(location_id),
        audit,
        Some(expected_version),
        Some(expected_version + 1),
        &now,
    )
    .await?;
    transaction.commit().await.map_err(map_sqlx_error)?;
    Ok(())
}

pub(super) async fn get_preference(
    pool: &SqlitePool,
    context: &ProjectContext,
    project_id: &str,
    capability: &str,
) -> Result<Option<ProjectRuntimeLocationPreferencePayload>, ProjectError> {
    let scope = scope(context, project_id)?;
    let sql = format!(
        r#"
SELECT {PREFERENCE_COLUMNS}
FROM studio_project_runtime_location_preference p
JOIN studio_project_runtime_location l ON l.id = p.runtime_location_id AND l.is_deleted = 0
JOIN studio_project project ON project.id = p.project_id AND project.is_deleted = 0
JOIN studio_workspace w ON w.id = project.workspace_id AND w.is_deleted = 0
WHERE p.tenant_id = ? AND p.organization_id = ? AND p.project_id = ?
  AND p.subject_user_id = ? AND p.capability = ? AND p.is_deleted = 0
  AND (project.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
"#,
    );
    map_optional_preference(
        sqlx::query(&sql)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .bind(scope.user_id)
            .bind(capability)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .fetch_optional(pool)
            .await
            .map_err(map_sqlx_error)?,
    )
}

pub(super) async fn list_preferences(
    pool: &SqlitePool,
    context: &ProjectContext,
    project_id: &str,
    offset: usize,
    limit: usize,
) -> Result<(Vec<ProjectRuntimeLocationPreferencePayload>, usize), ProjectError> {
    let scope = scope(context, project_id)?;
    let (offset, limit) = page_window(offset, limit)?;
    let sql = format!(
        r#"
SELECT {PREFERENCE_COLUMNS}
FROM studio_project_runtime_location_preference p
JOIN studio_project_runtime_location l ON l.id = p.runtime_location_id AND l.is_deleted = 0
JOIN studio_project project ON project.id = p.project_id AND project.is_deleted = 0
JOIN studio_workspace w ON w.id = project.workspace_id AND w.is_deleted = 0
WHERE p.tenant_id = ? AND p.organization_id = ? AND p.project_id = ?
  AND p.subject_user_id = ? AND p.is_deleted = 0
  AND (project.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
ORDER BY p.updated_at DESC, p.id DESC LIMIT ? OFFSET ?
"#,
    );
    let rows = sqlx::query(&sql)
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(scope.user_id)
        .bind(scope.user_id)
        .bind(scope.user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(map_sqlx_error)?;
    let items = rows
        .into_iter()
        .map(map_preference_row)
        .collect::<Result<Vec<_>, _>>()?;
    let total: i64 = sqlx::query_scalar(
        r#"
SELECT COUNT(*)
FROM studio_project_runtime_location_preference p
JOIN studio_project_runtime_location l ON l.id = p.runtime_location_id AND l.is_deleted = 0
JOIN studio_project project ON project.id = p.project_id AND project.is_deleted = 0
JOIN studio_workspace w ON w.id = project.workspace_id AND w.is_deleted = 0
WHERE p.tenant_id = ? AND p.organization_id = ? AND p.project_id = ?
  AND p.subject_user_id = ? AND p.is_deleted = 0
  AND (project.owner_user_id = ? OR w.owner_user_id = ? OR w.visibility = 'organization')
"#,
    )
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(scope.user_id)
    .bind(scope.user_id)
    .bind(scope.user_id)
    .fetch_one(pool)
    .await
    .map_err(map_sqlx_error)?;
    Ok((items, usize::try_from(total).unwrap_or(usize::MAX)))
}

pub(super) async fn upsert_preference(
    pool: &SqlitePool,
    id_generator: &SnowflakeIdGenerator,
    context: &ProjectContext,
    preference: &NewProjectRuntimeLocationPreference,
    audit: &ProjectRuntimeLocationAuditEntry,
) -> Result<ProjectRuntimeLocationPreferencePayload, ProjectError> {
    validate_preference(preference)?;
    validate_audit(audit)?;
    let scope = scope(context, &preference.project_id)?;
    let location_id = positive_id(&preference.runtime_location_id, "runtime_location_id")?;
    let (now, expires_at) = timestamps();
    let mut transaction = pool.begin().await.map_err(map_sqlx_error)?;
    ensure_project_write_access(&mut transaction, scope).await?;
    ensure_location_supports(&mut transaction, scope, location_id, &preference.capability).await?;
    let current = fetch_current_preference(&mut transaction, scope, &preference.capability).await?;
    let preference_id = match &current {
        Some(value) => positive_id(&value.id, "preference_id")?,
        None => next_id(id_generator)?,
    };
    match reserve_idempotency(
        &mut transaction,
        id_generator,
        scope,
        preference.idempotency.as_ref(),
        RESOURCE_KIND_PREFERENCE,
        &preference_id.to_string(),
        current.as_ref().map_or(Some(0), |value| {
            value.version.parse::<i64>().ok().map(|version| version + 1)
        }),
        &now,
        &expires_at,
    )
    .await?
    {
        IdempotencyReservation::Replay { resource_id } => {
            let value = fetch_preference(&mut transaction, scope, &resource_id)
                .await?
                .ok_or_else(|| ProjectError::Conflict("Idempotent runtime-location preference is unavailable.".to_owned()))?;
            transaction.commit().await.map_err(map_sqlx_error)?;
            return Ok(value);
        }
        IdempotencyReservation::Reserved => {}
    }

    let (previous_version, new_version) = if let Some(current) = current {
        let current_version = current.version.parse::<i64>().map_err(|_| {
            ProjectError::Internal("Stored runtime-location preference version is invalid.".to_owned())
        })?;
        let expected = preference.expected_version.ok_or_else(|| {
            ProjectError::PreconditionRequired(
                "If-Match is required to replace a runtime-location preference.".to_owned(),
            )
        })?;
        if expected != current_version {
            return Err(ProjectError::PreconditionFailed(
                "Runtime-location preference version does not match If-Match.".to_owned(),
            ));
        }
        let result = sqlx::query(
            r#"
UPDATE studio_project_runtime_location_preference
SET runtime_location_id = ?, updated_at = ?, version = version + 1
WHERE id = ? AND tenant_id = ? AND organization_id = ? AND project_id = ?
  AND subject_user_id = ? AND version = ? AND is_deleted = 0
"#,
        )
        .bind(location_id)
        .bind(&now)
        .bind(preference_id)
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(scope.user_id)
        .bind(expected)
        .execute(&mut *transaction)
        .await
        .map_err(map_write_error)?;
        if result.rows_affected() != 1 {
            return Err(ProjectError::PreconditionFailed(
                "Runtime-location preference was modified concurrently.".to_owned(),
            ));
        }
        (Some(expected), Some(expected + 1))
    } else {
        if preference.expected_version.is_some() {
            return Err(ProjectError::PreconditionFailed(
                "If-Match must be omitted when creating a runtime-location preference.".to_owned(),
            ));
        }
        sqlx::query(
            r#"
INSERT INTO studio_project_runtime_location_preference (
    id, uuid, tenant_id, organization_id, project_id, subject_user_id,
    capability, runtime_location_id, version, created_at, updated_at, is_deleted
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0)
"#,
        )
        .bind(preference_id)
        .bind(uuid())
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(scope.user_id)
        .bind(&preference.capability)
        .bind(location_id)
        .bind(&now)
        .bind(&now)
        .execute(&mut *transaction)
        .await
        .map_err(map_write_error)?;
        (None, Some(0))
    };
    append_audit(
        &mut transaction,
        id_generator,
        scope,
        Some(location_id),
        audit,
        previous_version,
        new_version,
        &now,
    )
    .await?;
    let value = fetch_preference(&mut transaction, scope, &preference_id.to_string())
        .await?
        .ok_or_else(|| ProjectError::Internal("Runtime-location preference is unavailable.".to_owned()))?;
    transaction.commit().await.map_err(map_sqlx_error)?;
    Ok(value)
}

#[allow(clippy::too_many_arguments)]
async fn mutate_location<'a, F>(
    pool: &SqlitePool,
    id_generator: &SnowflakeIdGenerator,
    context: &ProjectContext,
    project_id: &str,
    runtime_location_id: &str,
    expected_version: i64,
    idempotency: Option<&RuntimeLocationIdempotency>,
    audit: &ProjectRuntimeLocationAuditEntry,
    mutation: F,
) -> Result<StoredProjectRuntimeLocation, ProjectError>
where
    F: for<'t> FnOnce(
        &'t mut Transaction<'_, Sqlite>,
        RuntimeLocationScope,
        i64,
        &'t str,
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = Result<u64, ProjectError>> + Send + 't>,
    >,
{
    validate_audit(audit)?;
    if expected_version < 0 {
        return Err(ProjectError::InvalidInput("If-Match is invalid.".to_owned()));
    }
    let scope = scope(context, project_id)?;
    let location_id = positive_id(runtime_location_id, "runtime_location_id")?;
    let (now, expires_at) = timestamps();
    let mut transaction = pool.begin().await.map_err(map_sqlx_error)?;
    ensure_project_write_access(&mut transaction, scope).await?;
    let current = fetch_location(&mut transaction, scope, runtime_location_id)
        .await?
        .ok_or_else(|| ProjectError::NotFound("Project runtime location was not found.".to_owned()))?;
    match reserve_idempotency(
        &mut transaction,
        id_generator,
        scope,
        idempotency,
        RESOURCE_KIND_LOCATION,
        runtime_location_id,
        Some(expected_version + 1),
        &now,
        &expires_at,
    )
    .await?
    {
        IdempotencyReservation::Replay { resource_id } => {
            let value = fetch_location(&mut transaction, scope, &resource_id)
                .await?
                .ok_or_else(|| ProjectError::Conflict("Idempotent runtime location is unavailable.".to_owned()))?;
            transaction.commit().await.map_err(map_sqlx_error)?;
            return Ok(value);
        }
        IdempotencyReservation::Reserved => {}
    }
    if current.version != expected_version {
        return Err(precondition_miss());
    }
    if mutation(&mut transaction, scope, location_id, &now).await? != 1 {
        return Err(precondition_miss());
    }
    append_audit(
        &mut transaction,
        id_generator,
        scope,
        Some(location_id),
        audit,
        Some(expected_version),
        Some(expected_version + 1),
        &now,
    )
    .await?;
    let value = fetch_location(&mut transaction, scope, runtime_location_id)
        .await?
        .ok_or_else(|| ProjectError::Internal("Updated runtime location is unavailable.".to_owned()))?;
    transaction.commit().await.map_err(map_sqlx_error)?;
    Ok(value)
}

async fn ensure_project_write_access(
    transaction: &mut Transaction<'_, Sqlite>,
    scope: RuntimeLocationScope,
) -> Result<(), ProjectError> {
    let exists = sqlx::query_scalar::<_, i64>(
        r#"
SELECT p.id FROM studio_project p
JOIN studio_workspace w ON w.id = p.workspace_id AND w.is_deleted = 0
WHERE p.id = ? AND p.tenant_id = ? AND p.organization_id = ? AND p.is_deleted = 0
  AND (p.owner_user_id = ? OR w.owner_user_id = ?)
"#,
    )
    .bind(scope.project_id)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.user_id)
    .bind(scope.user_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(map_sqlx_error)?;
    if exists.is_none() {
        return Err(ProjectError::NotFound(
            "Project was not found in the authenticated write scope.".to_owned(),
        ));
    }
    Ok(())
}

async fn fetch_location(
    transaction: &mut Transaction<'_, Sqlite>,
    scope: RuntimeLocationScope,
    runtime_location_id: &str,
) -> Result<Option<StoredProjectRuntimeLocation>, ProjectError> {
    let location_id = positive_id(runtime_location_id, "runtime_location_id")?;
    let sql = format!(
        r#"
SELECT {LOCATION_COLUMNS}
FROM studio_project_runtime_location l
WHERE l.id = ? AND l.tenant_id = ? AND l.organization_id = ? AND l.project_id = ?
  AND l.is_deleted = 0
"#,
    );
    map_optional_location(
        sqlx::query(&sql)
            .bind(location_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .fetch_optional(&mut **transaction)
            .await
            .map_err(map_sqlx_error)?,
    )
}

async fn fetch_current_preference(
    transaction: &mut Transaction<'_, Sqlite>,
    scope: RuntimeLocationScope,
    capability: &str,
) -> Result<Option<ProjectRuntimeLocationPreferencePayload>, ProjectError> {
    let sql = format!(
        r#"
SELECT {PREFERENCE_COLUMNS}
FROM studio_project_runtime_location_preference p
WHERE p.tenant_id = ? AND p.organization_id = ? AND p.project_id = ?
  AND p.subject_user_id = ? AND p.capability = ? AND p.is_deleted = 0
"#,
    );
    map_optional_preference(
        sqlx::query(&sql)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .bind(scope.user_id)
            .bind(capability)
            .fetch_optional(&mut **transaction)
            .await
            .map_err(map_sqlx_error)?,
    )
}

async fn fetch_preference(
    transaction: &mut Transaction<'_, Sqlite>,
    scope: RuntimeLocationScope,
    preference_id: &str,
) -> Result<Option<ProjectRuntimeLocationPreferencePayload>, ProjectError> {
    let preference_id = positive_id(preference_id, "preference_id")?;
    let sql = format!(
        r#"
SELECT {PREFERENCE_COLUMNS}
FROM studio_project_runtime_location_preference p
WHERE p.id = ? AND p.tenant_id = ? AND p.organization_id = ? AND p.project_id = ?
  AND p.subject_user_id = ? AND p.is_deleted = 0
"#,
    );
    map_optional_preference(
        sqlx::query(&sql)
            .bind(preference_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .bind(scope.user_id)
            .fetch_optional(&mut **transaction)
            .await
            .map_err(map_sqlx_error)?,
    )
}

async fn ensure_location_supports(
    transaction: &mut Transaction<'_, Sqlite>,
    scope: RuntimeLocationScope,
    location_id: i64,
    capability: &str,
) -> Result<(), ProjectError> {
    let row = sqlx::query(
        r#"
SELECT health_status, terminal_available, git_available, build_available, filesystem_available
FROM studio_project_runtime_location
WHERE id = ? AND tenant_id = ? AND organization_id = ? AND project_id = ? AND is_deleted = 0
"#,
    )
    .bind(location_id)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(map_sqlx_error)?
    .ok_or_else(|| ProjectError::NotFound("Project runtime location was not found.".to_owned()))?;
    let healthy: String = row.try_get("health_status").map_err(map_sqlx_error)?;
    let supported = supports_capability(
        capability,
        row.try_get("terminal_available").map_err(map_sqlx_error)?,
        row.try_get("git_available").map_err(map_sqlx_error)?,
        row.try_get("build_available").map_err(map_sqlx_error)?,
        row.try_get("filesystem_available").map_err(map_sqlx_error)?,
    );
    if healthy != HEALTH_STATUS_HEALTHY || !supported {
        return Err(ProjectError::Conflict(
            "The selected runtime location is not verified for the requested capability.".to_owned(),
        ));
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn reserve_idempotency(
    transaction: &mut Transaction<'_, Sqlite>,
    id_generator: &SnowflakeIdGenerator,
    scope: RuntimeLocationScope,
    idempotency: Option<&RuntimeLocationIdempotency>,
    resource_kind: &str,
    resource_id: &str,
    resource_version: Option<i64>,
    now: &str,
    expires_at: &str,
) -> Result<IdempotencyReservation, ProjectError> {
    let Some(idempotency) = idempotency else {
        return Ok(IdempotencyReservation::Reserved);
    };
    validate_idempotency(idempotency)?;
    sqlx::query(
        r#"
DELETE FROM studio_project_runtime_location_idempotency
WHERE tenant_id = ? AND organization_id = ? AND project_id = ? AND subject_user_id = ?
  AND operation_kind = ? AND idempotency_key_hash = ? AND expires_at <= ?
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
    .map_err(map_write_error)?;
    let inserted = sqlx::query(
        r#"
INSERT INTO studio_project_runtime_location_idempotency (
    id, tenant_id, organization_id, project_id, subject_user_id, operation_kind,
    idempotency_key_hash, request_fingerprint, resource_kind, resource_id,
    resource_version, created_at, expires_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING
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
    .bind(resource_kind)
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
    let row = sqlx::query(
        r#"
SELECT request_fingerprint, resource_kind, resource_id
FROM studio_project_runtime_location_idempotency
WHERE tenant_id = ? AND organization_id = ? AND project_id = ? AND subject_user_id = ?
  AND operation_kind = ? AND idempotency_key_hash = ?
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
    .ok_or_else(|| ProjectError::Conflict("Runtime-location idempotency reservation is in progress.".to_owned()))?;
    let fingerprint: String = row.try_get("request_fingerprint").map_err(map_sqlx_error)?;
    let existing_kind: String = row.try_get("resource_kind").map_err(map_sqlx_error)?;
    if fingerprint != idempotency.request_fingerprint || existing_kind != resource_kind {
        return Err(ProjectError::Conflict(
            "Idempotency-Key was already used with a different request.".to_owned(),
        ));
    }
    Ok(IdempotencyReservation::Replay {
        resource_id: row.try_get("resource_id").map_err(map_sqlx_error)?,
    })
}

#[allow(clippy::too_many_arguments)]
async fn append_audit(
    transaction: &mut Transaction<'_, Sqlite>,
    id_generator: &SnowflakeIdGenerator,
    scope: RuntimeLocationScope,
    location_id: Option<i64>,
    audit: &ProjectRuntimeLocationAuditEntry,
    previous_version: Option<i64>,
    new_version: Option<i64>,
    occurred_at: &str,
) -> Result<(), ProjectError> {
    sqlx::query(
        r#"
INSERT INTO studio_project_runtime_location_audit (
    id, tenant_id, organization_id, project_id, runtime_location_id, actor_user_id,
    action, result, reason_code, trace_id, previous_version, new_version,
    redacted_metadata_json, occurred_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"#,
    )
    .bind(next_id(id_generator)?)
    .bind(scope.tenant_id)
    .bind(scope.organization_id)
    .bind(scope.project_id)
    .bind(location_id)
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

fn map_optional_location(
    row: Option<SqliteRow>,
) -> Result<Option<StoredProjectRuntimeLocation>, ProjectError> {
    row.map(map_location_row).transpose()
}

fn map_location_row(row: SqliteRow) -> Result<StoredProjectRuntimeLocation, ProjectError> {
    Ok(StoredProjectRuntimeLocation {
        id: row.try_get::<i64, _>("id").map_err(map_sqlx_error)?.to_string(),
        uuid: row.try_get("uuid").map_err(map_sqlx_error)?,
        tenant_id: row.try_get::<i64, _>("tenant_id").map_err(map_sqlx_error)?.to_string(),
        organization_id: row.try_get::<i64, _>("organization_id").map_err(map_sqlx_error)?.to_string(),
        project_id: row.try_get::<i64, _>("project_id").map_err(map_sqlx_error)?.to_string(),
        registered_by_user_id: row.try_get::<i64, _>("registered_by_user_id").map_err(map_sqlx_error)?.to_string(),
        runtime_target_id: row.try_get("runtime_target_id").map_err(map_sqlx_error)?,
        runtime_target_kind: row.try_get("runtime_target_kind").map_err(map_sqlx_error)?,
        location_kind: row.try_get("location_kind").map_err(map_sqlx_error)?,
        path_flavor: row.try_get("path_flavor").map_err(map_sqlx_error)?,
        display_name: row.try_get("display_name").map_err(map_sqlx_error)?,
        encrypted_absolute_path: row.try_get("encrypted_absolute_path").map_err(map_sqlx_error)?,
        path_encryption_key_id: row.try_get("path_encryption_key_id").map_err(map_sqlx_error)?,
        path_fingerprint: row.try_get("path_fingerprint").map_err(map_sqlx_error)?,
        terminal_available: row.try_get("terminal_available").map_err(map_sqlx_error)?,
        git_available: row.try_get("git_available").map_err(map_sqlx_error)?,
        build_available: row.try_get("build_available").map_err(map_sqlx_error)?,
        filesystem_available: row.try_get("filesystem_available").map_err(map_sqlx_error)?,
        health_status: row.try_get("health_status").map_err(map_sqlx_error)?,
        last_verified_at: row.try_get("last_verified_at").map_err(map_sqlx_error)?,
        last_seen_at: row.try_get("last_seen_at").map_err(map_sqlx_error)?,
        verified_by_user_id: row.try_get::<Option<i64>, _>("verified_by_user_id").map_err(map_sqlx_error)?.map(|value| value.to_string()),
        version: row.try_get("version").map_err(map_sqlx_error)?,
        created_at: row.try_get("created_at").map_err(map_sqlx_error)?,
        updated_at: row.try_get("updated_at").map_err(map_sqlx_error)?,
    })
}

fn map_optional_preference(
    row: Option<SqliteRow>,
) -> Result<Option<ProjectRuntimeLocationPreferencePayload>, ProjectError> {
    row.map(map_preference_row).transpose()
}

fn map_preference_row(
    row: SqliteRow,
) -> Result<ProjectRuntimeLocationPreferencePayload, ProjectError> {
    Ok(ProjectRuntimeLocationPreferencePayload {
        id: row.try_get::<i64, _>("id").map_err(map_sqlx_error)?.to_string(),
        project_id: row.try_get::<i64, _>("project_id").map_err(map_sqlx_error)?.to_string(),
        subject_user_id: row.try_get::<i64, _>("subject_user_id").map_err(map_sqlx_error)?.to_string(),
        capability: row.try_get("capability").map_err(map_sqlx_error)?,
        runtime_location_id: row.try_get::<i64, _>("runtime_location_id").map_err(map_sqlx_error)?.to_string(),
        version: row.try_get::<i64, _>("version").map_err(map_sqlx_error)?.to_string(),
        created_at: row.try_get("created_at").map_err(map_sqlx_error)?,
        updated_at: row.try_get("updated_at").map_err(map_sqlx_error)?,
    })
}
