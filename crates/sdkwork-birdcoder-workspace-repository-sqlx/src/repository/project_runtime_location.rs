use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::runtime_location::{
    NewProjectRuntimeLocation, NewProjectRuntimeLocationPreference,
    ProjectRuntimeLocationAuditEntry, ProjectRuntimeLocationPreferencePayload,
    ProjectRuntimeLocationRebind, ProjectRuntimeLocationUpdate,
    ProjectRuntimeLocationVerificationRequest, RuntimeLocationIdempotency, StoredProjectRuntimeLocation,
    TrustedProjectRuntimeLocationVerification, HEALTH_STATUS_PENDING_VERIFICATION,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::runtime_location_repository::ProjectRuntimeLocationRepository;
use sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted;
use sqlx::{Any, AnyPool, Row, Transaction};
use time::{Duration, OffsetDateTime};
use uuid::Uuid;

use crate::db::columns::project as project_col;
use crate::db::columns::project_collaborator as collaborator_col;
use crate::db::columns::project_runtime_location as location_col;
use crate::db::columns::project_runtime_location_audit as audit_col;
use crate::db::columns::project_runtime_location_idempotency as idempotency_col;
use crate::db::columns::project_runtime_location_preference as preference_col;
use crate::db::rows::{ProjectRuntimeLocationPreferenceRow, ProjectRuntimeLocationRow};
use crate::repository::scope::{
    project_scoped_organization_id, project_scoped_tenant_id, project_scoped_user_id,
};

const IDEMPOTENCY_RETENTION_HOURS: i64 = 24;
const RESOURCE_KIND_LOCATION: &str = "runtime_location";
const RESOURCE_KIND_PREFERENCE: &str = "runtime_location_preference";

#[derive(Clone)]
pub struct SqliteProjectRuntimeLocationRepository {
    pool: AnyPool,
}

#[derive(Clone, Copy)]
struct RuntimeLocationScope {
    tenant_id: i64,
    organization_id: i64,
    user_id: i64,
    project_id: i64,
}

enum IdempotencyReservation {
    Reserved,
    Replay { resource_id: String },
}

impl SqliteProjectRuntimeLocationRepository {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }

    fn now_iso() -> String {
        OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
    }

    fn expiry_iso() -> String {
        (OffsetDateTime::now_utc() + Duration::hours(IDEMPOTENCY_RETENTION_HOURS))
            .format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-02T00:00:00Z".to_owned())
    }

    async fn is_postgres(&self) -> Result<bool, ProjectError> {
        let connection = self
            .pool
            .acquire()
            .await
            .map_err(map_sqlx_error)?;
        Ok(connection.backend_name().eq_ignore_ascii_case("PostgreSQL"))
    }

    fn timestamp_expression(is_postgres: bool) -> &'static str {
        if is_postgres {
            "CAST(? AS TIMESTAMPTZ)"
        } else {
            "?"
        }
    }

    fn metadata_expression(is_postgres: bool) -> &'static str {
        if is_postgres {
            "CAST(? AS JSONB)"
        } else {
            "?"
        }
    }

    fn scope(context: &ProjectContext, project_id: &str) -> Result<RuntimeLocationScope, ProjectError> {
        Ok(RuntimeLocationScope {
            tenant_id: project_scoped_tenant_id(context)?,
            organization_id: project_scoped_organization_id(context)?,
            user_id: project_scoped_user_id(context)?,
            project_id: parse_positive_id(project_id, "project_id")?,
        })
    }

    fn project_read_access_predicate(location_alias: &str) -> String {
        format!(
            "EXISTS (SELECT 1 FROM {project_table} p WHERE p.{project_id} = {location_alias}.{location_project_id} \
             AND p.{project_tenant_id} = {location_alias}.{location_tenant_id} \
             AND p.{project_organization_id} = {location_alias}.{location_organization_id} \
             AND {project_not_deleted} \
             AND (p.{project_user_id} = ? OR EXISTS (SELECT 1 FROM {collaborator_table} c \
                 WHERE c.{collaborator_project_id} = p.{project_id} \
                   AND c.{collaborator_tenant_id} = p.{project_tenant_id} \
                   AND c.{collaborator_organization_id} = p.{project_organization_id} \
                   AND c.{collaborator_user_id} = ? \
                   AND {collaborator_not_deleted} \
                   AND LOWER(c.{collaborator_status}) = 'active')))",
            project_table = project_col::TABLE,
            project_id = project_col::ID,
            project_tenant_id = project_col::TENANT_ID,
            project_organization_id = project_col::ORGANIZATION_ID,
            project_not_deleted = qualified_is_not_deleted("p"),
            project_user_id = project_col::USER_ID,
            collaborator_table = collaborator_col::TABLE,
            collaborator_project_id = collaborator_col::PROJECT_ID,
            collaborator_tenant_id = collaborator_col::TENANT_ID,
            collaborator_organization_id = collaborator_col::ORGANIZATION_ID,
            collaborator_user_id = collaborator_col::USER_ID,
            collaborator_not_deleted = qualified_is_not_deleted("c"),
            collaborator_status = collaborator_col::STATUS,
            location_project_id = location_col::PROJECT_ID,
            location_tenant_id = location_col::TENANT_ID,
            location_organization_id = location_col::ORGANIZATION_ID,
        )
    }

    fn project_write_access_predicate(location_alias: &str) -> String {
        format!(
            "EXISTS (SELECT 1 FROM {project_table} p WHERE p.{project_id} = {location_alias}.{location_project_id} \
             AND p.{project_tenant_id} = {location_alias}.{location_tenant_id} \
             AND p.{project_organization_id} = {location_alias}.{location_organization_id} \
             AND {project_not_deleted} \
             AND (p.{project_user_id} = ? OR EXISTS (SELECT 1 FROM {collaborator_table} c \
                 WHERE c.{collaborator_project_id} = p.{project_id} \
                   AND c.{collaborator_tenant_id} = p.{project_tenant_id} \
                   AND c.{collaborator_organization_id} = p.{project_organization_id} \
                   AND c.{collaborator_user_id} = ? \
                   AND {collaborator_not_deleted} \
                   AND LOWER(c.{collaborator_status}) = 'active' \
                   AND LOWER(c.{collaborator_role}) IN ('owner', 'admin'))))",
            project_table = project_col::TABLE,
            project_id = project_col::ID,
            project_tenant_id = project_col::TENANT_ID,
            project_organization_id = project_col::ORGANIZATION_ID,
            project_not_deleted = qualified_is_not_deleted("p"),
            project_user_id = project_col::USER_ID,
            collaborator_table = collaborator_col::TABLE,
            collaborator_project_id = collaborator_col::PROJECT_ID,
            collaborator_tenant_id = collaborator_col::TENANT_ID,
            collaborator_organization_id = collaborator_col::ORGANIZATION_ID,
            collaborator_user_id = collaborator_col::USER_ID,
            collaborator_not_deleted = qualified_is_not_deleted("c"),
            collaborator_status = collaborator_col::STATUS,
            collaborator_role = collaborator_col::ROLE,
            location_project_id = location_col::PROJECT_ID,
            location_tenant_id = location_col::TENANT_ID,
            location_organization_id = location_col::ORGANIZATION_ID,
        )
    }

    async fn fetch_location_with_read_access(
        tx: &mut Transaction<'_, Any>,
        scope: RuntimeLocationScope,
        runtime_location_id: &str,
    ) -> Result<Option<StoredProjectRuntimeLocation>, ProjectError> {
        let sql = format!(
            "SELECT l.* FROM {table} l WHERE l.{id} = ? AND l.{project_id} = ? \
             AND l.{tenant_id} = ? AND l.{organization_id} = ? AND {not_deleted} \
             AND {access}",
            table = location_col::TABLE,
            id = location_col::ID,
            project_id = location_col::PROJECT_ID,
            tenant_id = location_col::TENANT_ID,
            organization_id = location_col::ORGANIZATION_ID,
            not_deleted = qualified_is_not_deleted("l"),
            access = Self::project_read_access_predicate("l"),
        );
        let row = sqlx::query(&sql)
            .bind(runtime_location_id)
            .bind(scope.project_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .fetch_optional(&mut **tx)
            .await
            .map_err(map_sqlx_error)?;
        row.map(|value| {
            ProjectRuntimeLocationRow::from_row(&value)
                .map(|row| stored_location_from_row(&row))
                .map_err(map_sqlx_error)
        })
        .transpose()
    }

    async fn fetch_location_with_read_access_on_pool(
        &self,
        scope: RuntimeLocationScope,
        runtime_location_id: &str,
    ) -> Result<Option<StoredProjectRuntimeLocation>, ProjectError> {
        let sql = format!(
            "SELECT l.* FROM {table} l WHERE l.{id} = ? AND l.{project_id} = ? \
             AND l.{tenant_id} = ? AND l.{organization_id} = ? AND {not_deleted} \
             AND {access}",
            table = location_col::TABLE,
            id = location_col::ID,
            project_id = location_col::PROJECT_ID,
            tenant_id = location_col::TENANT_ID,
            organization_id = location_col::ORGANIZATION_ID,
            not_deleted = qualified_is_not_deleted("l"),
            access = Self::project_read_access_predicate("l"),
        );
        let row = sqlx::query(&sql)
            .bind(runtime_location_id)
            .bind(scope.project_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sqlx_error)?;
        row.map(|value| {
            ProjectRuntimeLocationRow::from_row(&value)
                .map(|row| stored_location_from_row(&row))
                .map_err(map_sqlx_error)
        })
        .transpose()
    }

    async fn reserve_idempotency(
        tx: &mut Transaction<'_, Any>,
        scope: RuntimeLocationScope,
        idempotency: Option<&RuntimeLocationIdempotency>,
        resource_kind: &str,
        resource_id: &str,
        resource_version: Option<i64>,
        now: &str,
        expires_at: &str,
        is_postgres: bool,
    ) -> Result<IdempotencyReservation, ProjectError> {
        let Some(idempotency) = idempotency else {
            return Ok(IdempotencyReservation::Reserved);
        };
        validate_idempotency(idempotency)?;
        // Expiry is bounded data retention. The unique index makes this delete
        // and following reservation safe across retries for the same scope.
        sqlx::query(&format!(
            "DELETE FROM {table} WHERE {tenant_id} = ? AND {organization_id} = ? \
             AND {project_id} = ? AND {subject_user_id} = ? AND {operation_kind} = ? \
             AND {key_hash} = ? AND {expires_at} <= {timestamp}",
            table = idempotency_col::TABLE,
            tenant_id = idempotency_col::TENANT_ID,
            organization_id = idempotency_col::ORGANIZATION_ID,
            project_id = idempotency_col::PROJECT_ID,
            subject_user_id = idempotency_col::SUBJECT_USER_ID,
            operation_kind = idempotency_col::OPERATION_KIND,
            key_hash = idempotency_col::IDEMPOTENCY_KEY_HASH,
            expires_at = idempotency_col::EXPIRES_AT,
            timestamp = Self::timestamp_expression(is_postgres),
        ))
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(scope.user_id)
        .bind(&idempotency.operation)
        .bind(&idempotency.key_hash)
        .bind(now)
        .execute(&mut **tx)
        .await
        .map_err(map_sqlx_error)?;

        let insert = sqlx::query(&format!(
            "INSERT INTO {table} ({id}, {uuid}, {tenant_id}, {organization_id}, {project_id}, {subject_user_id}, \
             {operation_kind}, {key_hash}, {request_fingerprint}, {resource_kind}, {resource_id}, {resource_version}, \
             {created_at}, {expires_at}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, {created}, {expires}) ON CONFLICT DO NOTHING",
            table = idempotency_col::TABLE,
            id = idempotency_col::ID,
            uuid = idempotency_col::UUID,
            tenant_id = idempotency_col::TENANT_ID,
            organization_id = idempotency_col::ORGANIZATION_ID,
            project_id = idempotency_col::PROJECT_ID,
            subject_user_id = idempotency_col::SUBJECT_USER_ID,
            operation_kind = idempotency_col::OPERATION_KIND,
            key_hash = idempotency_col::IDEMPOTENCY_KEY_HASH,
            request_fingerprint = idempotency_col::REQUEST_FINGERPRINT,
            resource_kind = idempotency_col::RESOURCE_KIND,
            resource_id = idempotency_col::RESOURCE_ID,
            resource_version = idempotency_col::RESOURCE_VERSION,
            created_at = idempotency_col::CREATED_AT,
            expires_at = idempotency_col::EXPIRES_AT,
            created = Self::timestamp_expression(is_postgres),
            expires = Self::timestamp_expression(is_postgres),
        ))
        .bind(Uuid::new_v4().to_string())
        .bind(Uuid::new_v4().to_string())
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
        .execute(&mut **tx)
        .await
        .map_err(map_write_error)?;
        if insert.rows_affected() == 1 {
            return Ok(IdempotencyReservation::Reserved);
        }

        let existing = sqlx::query(&format!(
            "SELECT {request_fingerprint}, {resource_id} FROM {table} WHERE {tenant_id} = ? \
             AND {organization_id} = ? AND {project_id} = ? AND {subject_user_id} = ? \
             AND {operation_kind} = ? AND {key_hash} = ?",
            request_fingerprint = idempotency_col::REQUEST_FINGERPRINT,
            resource_id = idempotency_col::RESOURCE_ID,
            table = idempotency_col::TABLE,
            tenant_id = idempotency_col::TENANT_ID,
            organization_id = idempotency_col::ORGANIZATION_ID,
            project_id = idempotency_col::PROJECT_ID,
            subject_user_id = idempotency_col::SUBJECT_USER_ID,
            operation_kind = idempotency_col::OPERATION_KIND,
            key_hash = idempotency_col::IDEMPOTENCY_KEY_HASH,
        ))
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(scope.user_id)
        .bind(&idempotency.operation)
        .bind(&idempotency.key_hash)
        .fetch_optional(&mut **tx)
        .await
        .map_err(map_sqlx_error)?
        .ok_or_else(|| ProjectError::Conflict("Runtime-location idempotency reservation is in progress.".to_owned()))?;
        let existing_fingerprint: String = existing
            .try_get(idempotency_col::REQUEST_FINGERPRINT)
            .map_err(map_sqlx_error)?;
        if existing_fingerprint != idempotency.request_fingerprint {
            return Err(ProjectError::Conflict(
                "Idempotency-Key was already used with a different request.".to_owned(),
            ));
        }
        let existing_resource_id: String = existing
            .try_get(idempotency_col::RESOURCE_ID)
            .map_err(map_sqlx_error)?;
        Ok(IdempotencyReservation::Replay {
            resource_id: existing_resource_id,
        })
    }

    async fn append_audit(
        tx: &mut Transaction<'_, Any>,
        scope: RuntimeLocationScope,
        runtime_location_id: Option<&str>,
        audit: &ProjectRuntimeLocationAuditEntry,
        now: &str,
        is_postgres: bool,
    ) -> Result<(), ProjectError> {
        validate_audit_entry(audit)?;
        sqlx::query(&format!(
            "INSERT INTO {table} ({id}, {uuid}, {tenant_id}, {organization_id}, {project_id}, {runtime_location_id}, \
             {actor_user_id}, {action}, {result}, {trace_id}, {occurred_at}, {metadata}) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, {occurred_at_value}, {metadata_value})",
            table = audit_col::TABLE,
            id = audit_col::ID,
            uuid = audit_col::UUID,
            tenant_id = audit_col::TENANT_ID,
            organization_id = audit_col::ORGANIZATION_ID,
            project_id = audit_col::PROJECT_ID,
            runtime_location_id = audit_col::RUNTIME_LOCATION_ID,
            actor_user_id = audit_col::ACTOR_USER_ID,
            action = audit_col::ACTION,
            result = audit_col::RESULT,
            trace_id = audit_col::TRACE_ID,
            occurred_at = audit_col::OCCURRED_AT,
            metadata = audit_col::REDACTED_METADATA_JSON,
            occurred_at_value = Self::timestamp_expression(is_postgres),
            metadata_value = Self::metadata_expression(is_postgres),
        ))
        .bind(Uuid::new_v4().to_string())
        .bind(Uuid::new_v4().to_string())
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(runtime_location_id)
        .bind(scope.user_id)
        .bind(&audit.action)
        .bind(&audit.result)
        .bind(&audit.trace_id)
        .bind(now)
        .bind(&audit.redacted_metadata_json)
        .execute(&mut **tx)
        .await
        .map_err(map_write_error)?;
        Ok(())
    }

    async fn fetch_preference_on_tx(
        tx: &mut Transaction<'_, Any>,
        scope: RuntimeLocationScope,
        preference_id: &str,
    ) -> Result<Option<ProjectRuntimeLocationPreferencePayload>, ProjectError> {
        let sql = format!(
            "SELECT p.* FROM {table} p WHERE p.{id} = ? AND p.{tenant_id} = ? \
             AND p.{organization_id} = ? AND p.{project_id} = ? AND p.{subject_user_id} = ? \
             AND {not_deleted}",
            table = preference_col::TABLE,
            id = preference_col::ID,
            tenant_id = preference_col::TENANT_ID,
            organization_id = preference_col::ORGANIZATION_ID,
            project_id = preference_col::PROJECT_ID,
            subject_user_id = preference_col::SUBJECT_USER_ID,
            not_deleted = qualified_is_not_deleted("p"),
        );
        let row = sqlx::query(&sql)
            .bind(preference_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .bind(scope.user_id)
            .fetch_optional(&mut **tx)
            .await
            .map_err(map_sqlx_error)?;
        row.map(|value| {
            ProjectRuntimeLocationPreferenceRow::from_row(&value)
                .map(|row| preference_from_row(&row))
                .map_err(map_sqlx_error)
        })
        .transpose()
    }

    async fn fetch_current_preference_on_tx(
        tx: &mut Transaction<'_, Any>,
        scope: RuntimeLocationScope,
        capability: &str,
    ) -> Result<Option<ProjectRuntimeLocationPreferencePayload>, ProjectError> {
        let sql = format!(
            "SELECT p.* FROM {table} p WHERE p.{tenant_id} = ? AND p.{organization_id} = ? \
             AND p.{project_id} = ? AND p.{subject_user_id} = ? AND p.{capability} = ? \
             AND {not_deleted}",
            table = preference_col::TABLE,
            tenant_id = preference_col::TENANT_ID,
            organization_id = preference_col::ORGANIZATION_ID,
            project_id = preference_col::PROJECT_ID,
            subject_user_id = preference_col::SUBJECT_USER_ID,
            capability = preference_col::CAPABILITY,
            not_deleted = qualified_is_not_deleted("p"),
        );
        let row = sqlx::query(&sql)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .bind(scope.user_id)
            .bind(capability)
            .fetch_optional(&mut **tx)
            .await
            .map_err(map_sqlx_error)?;
        row.map(|value| {
            ProjectRuntimeLocationPreferenceRow::from_row(&value)
                .map(|row| preference_from_row(&row))
                .map_err(map_sqlx_error)
        })
        .transpose()
    }
}

#[async_trait::async_trait]
impl ProjectRuntimeLocationRepository for SqliteProjectRuntimeLocationRepository {
    async fn list_runtime_locations(
        &self,
        context: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<StoredProjectRuntimeLocation>, usize), ProjectError> {
        let scope = Self::scope(context, project_id)?;
        let access = Self::project_read_access_predicate("l");
        let where_clause = format!(
            "l.{project_id} = ? AND l.{tenant_id} = ? AND l.{organization_id} = ? \
             AND {not_deleted} AND {access}",
            project_id = location_col::PROJECT_ID,
            tenant_id = location_col::TENANT_ID,
            organization_id = location_col::ORGANIZATION_ID,
            not_deleted = qualified_is_not_deleted("l"),
        );
        let list_sql = format!(
            "SELECT l.* FROM {table} l WHERE {where_clause} ORDER BY l.{created_at} DESC, l.{id} DESC LIMIT ? OFFSET ?",
            table = location_col::TABLE,
            created_at = location_col::CREATED_AT,
            id = location_col::ID,
        );
        let rows = sqlx::query(&list_sql)
            .bind(scope.project_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await
            .map_err(map_sqlx_error)?;
        let items = rows
            .iter()
            .map(|row| {
                ProjectRuntimeLocationRow::from_row(row)
                    .map(|value| stored_location_from_row(&value))
                    .map_err(map_sqlx_error)
            })
            .collect::<Result<Vec<_>, _>>()?;
        let count_sql = format!(
            "SELECT COUNT(*) FROM {table} l WHERE {where_clause}",
            table = location_col::TABLE,
        );
        let total: i64 = sqlx::query_scalar(&count_sql)
            .bind(scope.project_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .fetch_one(&self.pool)
            .await
            .map_err(map_sqlx_error)?;
        Ok((items, total.max(0) as usize))
    }

    async fn find_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
    ) -> Result<Option<StoredProjectRuntimeLocation>, ProjectError> {
        let scope = Self::scope(context, project_id)?;
        self.fetch_location_with_read_access_on_pool(scope, runtime_location_id)
            .await
    }

    async fn register_runtime_location(
        &self,
        context: &ProjectContext,
        location: &NewProjectRuntimeLocation,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError> {
        let scope = Self::scope(context, &location.project_id)?;
        validate_new_location(location)?;
        let is_postgres = self.is_postgres().await?;
        let now = Self::now_iso();
        let expires_at = Self::expiry_iso();
        let mut tx = self.pool.begin().await.map_err(map_sqlx_error)?;
        match Self::reserve_idempotency(
            &mut tx,
            scope,
            location.idempotency.as_ref(),
            RESOURCE_KIND_LOCATION,
            &location.id,
            Some(0),
            &now,
            &expires_at,
            is_postgres,
        )
        .await?
        {
            IdempotencyReservation::Replay { resource_id } => {
                let value = Self::fetch_location_with_read_access(&mut tx, scope, &resource_id)
                    .await?
                    .ok_or_else(|| ProjectError::Conflict("Idempotent runtime-location resource is unavailable.".to_owned()))?;
                tx.commit().await.map_err(map_sqlx_error)?;
                return Ok(value);
            }
            IdempotencyReservation::Reserved => {}
        }
        let timestamp = Self::timestamp_expression(is_postgres);
        let sql = format!(
            "INSERT INTO {table} ({id}, {uuid}, {tenant_id}, {organization_id}, {project_id}, {registered_by_user_id}, \
             {runtime_target_id}, {runtime_target_kind}, {location_kind}, {path_flavor}, {root_locator}, {display_name}, \
             {encrypted_absolute_path}, {path_key_id}, {path_fingerprint}, {terminal_available}, {git_available}, \
             {build_available}, {file_system_available}, {health_status}, {last_verified_at}, {last_seen_at}, \
             {verified_by_user_id}, {git_repository_url}, {git_remote_name}, {git_branch}, {git_commit}, {git_worktree_key}, \
             {version}, {created_at}, {updated_at}, {is_deleted}) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, FALSE, FALSE, FALSE, ?, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 0, {timestamp}, {timestamp}, FALSE)",
            table = location_col::TABLE,
            id = location_col::ID,
            uuid = location_col::UUID,
            tenant_id = location_col::TENANT_ID,
            organization_id = location_col::ORGANIZATION_ID,
            project_id = location_col::PROJECT_ID,
            registered_by_user_id = location_col::REGISTERED_BY_USER_ID,
            runtime_target_id = location_col::RUNTIME_TARGET_ID,
            runtime_target_kind = location_col::RUNTIME_TARGET_KIND,
            location_kind = location_col::LOCATION_KIND,
            path_flavor = location_col::PATH_FLAVOR,
            root_locator = location_col::ROOT_LOCATOR,
            display_name = location_col::DISPLAY_NAME,
            encrypted_absolute_path = location_col::ENCRYPTED_ABSOLUTE_PATH,
            path_key_id = location_col::PATH_ENCRYPTION_KEY_ID,
            path_fingerprint = location_col::PATH_FINGERPRINT,
            terminal_available = location_col::TERMINAL_AVAILABLE,
            git_available = location_col::GIT_AVAILABLE,
            build_available = location_col::BUILD_AVAILABLE,
            file_system_available = location_col::FILE_SYSTEM_AVAILABLE,
            health_status = location_col::HEALTH_STATUS,
            last_verified_at = location_col::LAST_VERIFIED_AT,
            last_seen_at = location_col::LAST_SEEN_AT,
            verified_by_user_id = location_col::VERIFIED_BY_USER_ID,
            git_repository_url = location_col::GIT_REPOSITORY_URL,
            git_remote_name = location_col::GIT_REMOTE_NAME,
            git_branch = location_col::GIT_BRANCH,
            git_commit = location_col::GIT_COMMIT,
            git_worktree_key = location_col::GIT_WORKTREE_KEY,
            version = location_col::VERSION,
            created_at = location_col::CREATED_AT,
            updated_at = location_col::UPDATED_AT,
            is_deleted = location_col::IS_DELETED,
        );
        sqlx::query(&sql)
            .bind(&location.id)
            .bind(&location.uuid)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .bind(scope.user_id)
            .bind(&location.runtime_target_id)
            .bind(&location.runtime_target_kind)
            .bind(&location.location_kind)
            .bind(&location.path_flavor)
            .bind(&location.root_locator)
            .bind(&location.display_name)
            .bind(&location.encrypted_absolute_path)
            .bind(&location.path_encryption_key_id)
            .bind(&location.path_fingerprint)
            .bind(HEALTH_STATUS_PENDING_VERIFICATION)
            .bind(&now)
            .bind(&now)
            .execute(&mut *tx)
            .await
            .map_err(map_write_error)?;
        Self::append_audit(&mut tx, scope, Some(&location.id), audit, &now, is_postgres).await?;
        let value = Self::fetch_location_with_read_access(&mut tx, scope, &location.id)
            .await?
            .ok_or_else(|| ProjectError::Internal("Created runtime location is unavailable.".to_owned()))?;
        tx.commit().await.map_err(map_sqlx_error)?;
        Ok(value)
    }

    async fn update_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        update: &ProjectRuntimeLocationUpdate,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError> {
        let scope = Self::scope(context, project_id)?;
        validate_update(update)?;
        let is_postgres = self.is_postgres().await?;
        let now = Self::now_iso();
        let expires_at = Self::expiry_iso();
        let mut tx = self.pool.begin().await.map_err(map_sqlx_error)?;
        match Self::reserve_idempotency(
            &mut tx,
            scope,
            update.idempotency.as_ref(),
            RESOURCE_KIND_LOCATION,
            runtime_location_id,
            Some(update.expected_version),
            &now,
            &expires_at,
            is_postgres,
        )
        .await?
        {
            IdempotencyReservation::Replay { resource_id } => {
                let value = Self::fetch_location_with_read_access(&mut tx, scope, &resource_id)
                    .await?
                    .ok_or_else(|| ProjectError::Conflict("Idempotent runtime-location resource is unavailable.".to_owned()))?;
                tx.commit().await.map_err(map_sqlx_error)?;
                return Ok(value);
            }
            IdempotencyReservation::Reserved => {}
        }
        let display_name = update.display_name.as_deref().ok_or_else(|| {
            ProjectError::InvalidInput("displayName is required for this update.".to_owned())
        })?;
        let sql = format!(
            "UPDATE {table} SET {display_name_column} = ?, {updated_at} = {timestamp}, {version} = {version} + 1 \
             WHERE {id} = ? AND {project_id} = ? AND {tenant_id} = ? AND {organization_id} = ? \
             AND {version} = ? AND {not_deleted} AND {access}",
            table = location_col::TABLE,
            display_name_column = location_col::DISPLAY_NAME,
            updated_at = location_col::UPDATED_AT,
            timestamp = Self::timestamp_expression(is_postgres),
            version = location_col::VERSION,
            id = location_col::ID,
            project_id = location_col::PROJECT_ID,
            tenant_id = location_col::TENANT_ID,
            organization_id = location_col::ORGANIZATION_ID,
            not_deleted = qualified_is_not_deleted(location_col::TABLE),
            access = Self::project_write_access_predicate(location_col::TABLE),
        );
        let result = sqlx::query(&sql)
            .bind(display_name)
            .bind(&now)
            .bind(runtime_location_id)
            .bind(scope.project_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(update.expected_version)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .execute(&mut *tx)
            .await
            .map_err(map_write_error)?;
        if result.rows_affected() != 1 {
            return Err(location_write_miss(
                Self::fetch_location_with_read_access(&mut tx, scope, runtime_location_id).await?,
            ));
        }
        Self::append_audit(&mut tx, scope, Some(runtime_location_id), audit, &now, is_postgres).await?;
        let value = Self::fetch_location_with_read_access(&mut tx, scope, runtime_location_id)
            .await?
            .ok_or_else(|| ProjectError::Internal("Updated runtime location is unavailable.".to_owned()))?;
        tx.commit().await.map_err(map_sqlx_error)?;
        Ok(value)
    }

    async fn rebind_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        rebind: &ProjectRuntimeLocationRebind,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError> {
        let scope = Self::scope(context, project_id)?;
        validate_rebind(rebind)?;
        let is_postgres = self.is_postgres().await?;
        let now = Self::now_iso();
        let expires_at = Self::expiry_iso();
        let mut tx = self.pool.begin().await.map_err(map_sqlx_error)?;
        match Self::reserve_idempotency(
            &mut tx,
            scope,
            rebind.idempotency.as_ref(),
            RESOURCE_KIND_LOCATION,
            runtime_location_id,
            Some(rebind.expected_version),
            &now,
            &expires_at,
            is_postgres,
        )
        .await?
        {
            IdempotencyReservation::Replay { resource_id } => {
                let value = Self::fetch_location_with_read_access(&mut tx, scope, &resource_id)
                    .await?
                    .ok_or_else(|| ProjectError::Conflict("Idempotent runtime-location resource is unavailable.".to_owned()))?;
                tx.commit().await.map_err(map_sqlx_error)?;
                return Ok(value);
            }
            IdempotencyReservation::Reserved => {}
        }
        let sql = format!(
            "UPDATE {table} SET {path_flavor} = ?, {root_locator} = ?, {display_name} = ?, \
             {encrypted_absolute_path} = ?, {path_key_id} = ?, {path_fingerprint} = ?, \
             {terminal_available} = FALSE, {git_available} = FALSE, {build_available} = FALSE, \
             {file_system_available} = FALSE, {health_status} = ?, {last_verified_at} = NULL, {last_seen_at} = NULL, \
             {verified_by_user_id} = NULL, {git_repository_url} = NULL, {git_remote_name} = NULL, {git_branch} = NULL, \
             {git_commit} = NULL, {git_worktree_key} = NULL, {updated_at} = {timestamp}, {version} = {version} + 1 \
             WHERE {id} = ? AND {project_id} = ? AND {tenant_id} = ? AND {organization_id} = ? \
             AND {version} = ? AND {not_deleted} AND {access}",
            table = location_col::TABLE,
            path_flavor = location_col::PATH_FLAVOR,
            root_locator = location_col::ROOT_LOCATOR,
            display_name = location_col::DISPLAY_NAME,
            encrypted_absolute_path = location_col::ENCRYPTED_ABSOLUTE_PATH,
            path_key_id = location_col::PATH_ENCRYPTION_KEY_ID,
            path_fingerprint = location_col::PATH_FINGERPRINT,
            terminal_available = location_col::TERMINAL_AVAILABLE,
            git_available = location_col::GIT_AVAILABLE,
            build_available = location_col::BUILD_AVAILABLE,
            file_system_available = location_col::FILE_SYSTEM_AVAILABLE,
            health_status = location_col::HEALTH_STATUS,
            last_verified_at = location_col::LAST_VERIFIED_AT,
            last_seen_at = location_col::LAST_SEEN_AT,
            verified_by_user_id = location_col::VERIFIED_BY_USER_ID,
            git_repository_url = location_col::GIT_REPOSITORY_URL,
            git_remote_name = location_col::GIT_REMOTE_NAME,
            git_branch = location_col::GIT_BRANCH,
            git_commit = location_col::GIT_COMMIT,
            git_worktree_key = location_col::GIT_WORKTREE_KEY,
            updated_at = location_col::UPDATED_AT,
            timestamp = Self::timestamp_expression(is_postgres),
            version = location_col::VERSION,
            id = location_col::ID,
            project_id = location_col::PROJECT_ID,
            tenant_id = location_col::TENANT_ID,
            organization_id = location_col::ORGANIZATION_ID,
            not_deleted = qualified_is_not_deleted(location_col::TABLE),
            access = Self::project_write_access_predicate(location_col::TABLE),
        );
        let result = sqlx::query(&sql)
            .bind(&rebind.path_flavor)
            .bind(&rebind.root_locator)
            .bind(&rebind.display_name)
            .bind(&rebind.encrypted_absolute_path)
            .bind(&rebind.path_encryption_key_id)
            .bind(&rebind.path_fingerprint)
            .bind(HEALTH_STATUS_PENDING_VERIFICATION)
            .bind(&now)
            .bind(runtime_location_id)
            .bind(scope.project_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(rebind.expected_version)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .execute(&mut *tx)
            .await
            .map_err(map_write_error)?;
        if result.rows_affected() != 1 {
            return Err(location_write_miss(
                Self::fetch_location_with_read_access(&mut tx, scope, runtime_location_id).await?,
            ));
        }
        Self::append_audit(&mut tx, scope, Some(runtime_location_id), audit, &now, is_postgres).await?;
        let value = Self::fetch_location_with_read_access(&mut tx, scope, runtime_location_id)
            .await?
            .ok_or_else(|| ProjectError::Internal("Rebound runtime location is unavailable.".to_owned()))?;
        tx.commit().await.map_err(map_sqlx_error)?;
        Ok(value)
    }

    async fn record_runtime_location_verification(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        verification: &TrustedProjectRuntimeLocationVerification,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError> {
        let scope = Self::scope(context, project_id)?;
        validate_verification(verification)?;
        let is_postgres = self.is_postgres().await?;
        let now = Self::now_iso();
        let expires_at = Self::expiry_iso();
        let mut tx = self.pool.begin().await.map_err(map_sqlx_error)?;
        match Self::reserve_idempotency(
            &mut tx,
            scope,
            verification.idempotency.as_ref(),
            RESOURCE_KIND_LOCATION,
            runtime_location_id,
            Some(verification.expected_version),
            &now,
            &expires_at,
            is_postgres,
        )
        .await?
        {
            IdempotencyReservation::Replay { resource_id } => {
                let value = Self::fetch_location_with_read_access(&mut tx, scope, &resource_id)
                    .await?
                    .ok_or_else(|| ProjectError::Conflict("Idempotent runtime-location resource is unavailable.".to_owned()))?;
                tx.commit().await.map_err(map_sqlx_error)?;
                return Ok(value);
            }
            IdempotencyReservation::Reserved => {}
        }
        let sql = format!(
            "UPDATE {table} SET {health_status} = ?, {terminal_available} = ?, {git_available} = ?, \
             {build_available} = ?, {file_system_available} = ?, {last_verified_at} = {timestamp}, \
             {last_seen_at} = {timestamp}, {verified_by_user_id} = ?, {git_repository_url} = ?, \
             {git_remote_name} = ?, {git_branch} = ?, {git_commit} = ?, {git_worktree_key} = ?, \
             {updated_at} = {timestamp}, {version} = {version} + 1 \
             WHERE {id} = ? AND {project_id} = ? AND {tenant_id} = ? AND {organization_id} = ? \
             AND {runtime_target_id} = ? AND {version} = ? AND {not_deleted} AND {access}",
            table = location_col::TABLE,
            health_status = location_col::HEALTH_STATUS,
            terminal_available = location_col::TERMINAL_AVAILABLE,
            git_available = location_col::GIT_AVAILABLE,
            build_available = location_col::BUILD_AVAILABLE,
            file_system_available = location_col::FILE_SYSTEM_AVAILABLE,
            last_verified_at = location_col::LAST_VERIFIED_AT,
            last_seen_at = location_col::LAST_SEEN_AT,
            verified_by_user_id = location_col::VERIFIED_BY_USER_ID,
            git_repository_url = location_col::GIT_REPOSITORY_URL,
            git_remote_name = location_col::GIT_REMOTE_NAME,
            git_branch = location_col::GIT_BRANCH,
            git_commit = location_col::GIT_COMMIT,
            git_worktree_key = location_col::GIT_WORKTREE_KEY,
            updated_at = location_col::UPDATED_AT,
            timestamp = Self::timestamp_expression(is_postgres),
            version = location_col::VERSION,
            id = location_col::ID,
            project_id = location_col::PROJECT_ID,
            tenant_id = location_col::TENANT_ID,
            organization_id = location_col::ORGANIZATION_ID,
            runtime_target_id = location_col::RUNTIME_TARGET_ID,
            not_deleted = qualified_is_not_deleted(location_col::TABLE),
            access = Self::project_write_access_predicate(location_col::TABLE),
        );
        let result = sqlx::query(&sql)
            .bind(&verification.health_status)
            .bind(verification.terminal_available)
            .bind(verification.git_available)
            .bind(verification.build_available)
            .bind(verification.file_system_available)
            .bind(&now)
            .bind(&now)
            .bind(scope.user_id)
            .bind(&verification.git_repository_url)
            .bind(&verification.git_remote_name)
            .bind(&verification.git_branch)
            .bind(&verification.git_commit)
            .bind(&verification.git_worktree_key)
            .bind(&now)
            .bind(runtime_location_id)
            .bind(scope.project_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(&verification.runtime_target_id)
            .bind(verification.expected_version)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .execute(&mut *tx)
            .await
            .map_err(map_write_error)?;
        if result.rows_affected() != 1 {
            return Err(location_write_miss(
                Self::fetch_location_with_read_access(&mut tx, scope, runtime_location_id).await?,
            ));
        }
        Self::append_audit(&mut tx, scope, Some(runtime_location_id), audit, &now, is_postgres).await?;
        let value = Self::fetch_location_with_read_access(&mut tx, scope, runtime_location_id)
            .await?
            .ok_or_else(|| ProjectError::Internal("Verified runtime location is unavailable.".to_owned()))?;
        tx.commit().await.map_err(map_sqlx_error)?;
        Ok(value)
    }

    async fn request_runtime_location_verification(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        request: &ProjectRuntimeLocationVerificationRequest,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<StoredProjectRuntimeLocation, ProjectError> {
        let scope = Self::scope(context, project_id)?;
        if request.expected_version < 0 {
            return Err(ProjectError::InvalidInput(
                "Runtime-location verification version is invalid.".to_owned(),
            ));
        }
        validate_idempotency(&request.idempotency)?;
        let is_postgres = self.is_postgres().await?;
        let now = Self::now_iso();
        let expires_at = Self::expiry_iso();
        let mut tx = self.pool.begin().await.map_err(map_sqlx_error)?;
        match Self::reserve_idempotency(
            &mut tx,
            scope,
            Some(&request.idempotency),
            RESOURCE_KIND_LOCATION,
            runtime_location_id,
            Some(request.expected_version),
            &now,
            &expires_at,
            is_postgres,
        )
        .await?
        {
            IdempotencyReservation::Replay { resource_id } => {
                let value = Self::fetch_location_with_read_access(&mut tx, scope, &resource_id)
                    .await?
                    .ok_or_else(|| ProjectError::Conflict("Idempotent runtime-location resource is unavailable.".to_owned()))?;
                tx.commit().await.map_err(map_sqlx_error)?;
                return Ok(value);
            }
            IdempotencyReservation::Reserved => {}
        }
        let location = Self::fetch_location_with_read_access(&mut tx, scope, runtime_location_id)
            .await?
            .ok_or_else(|| ProjectError::NotFound("Project runtime location was not found.".to_owned()))?;
        if location.version != request.expected_version {
            return Err(ProjectError::PreconditionFailed(
                "Runtime-location version does not match If-Match.".to_owned(),
            ));
        }
        Self::append_audit(&mut tx, scope, Some(runtime_location_id), audit, &now, is_postgres).await?;
        tx.commit().await.map_err(map_sqlx_error)?;
        Ok(location)
    }

    async fn delete_runtime_location(
        &self,
        context: &ProjectContext,
        project_id: &str,
        runtime_location_id: &str,
        expected_version: i64,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<(), ProjectError> {
        let scope = Self::scope(context, project_id)?;
        if expected_version < 0 {
            return Err(ProjectError::InvalidInput("Runtime-location version is invalid.".to_owned()));
        }
        let is_postgres = self.is_postgres().await?;
        let now = Self::now_iso();
        let mut tx = self.pool.begin().await.map_err(map_sqlx_error)?;
        let sql = format!(
            "UPDATE {table} SET {is_deleted} = TRUE, {updated_at} = {timestamp}, {version} = {version} + 1 \
             WHERE {id} = ? AND {project_id} = ? AND {tenant_id} = ? AND {organization_id} = ? \
             AND {version} = ? AND {not_deleted} AND {access}",
            table = location_col::TABLE,
            is_deleted = location_col::IS_DELETED,
            updated_at = location_col::UPDATED_AT,
            timestamp = Self::timestamp_expression(is_postgres),
            version = location_col::VERSION,
            id = location_col::ID,
            project_id = location_col::PROJECT_ID,
            tenant_id = location_col::TENANT_ID,
            organization_id = location_col::ORGANIZATION_ID,
            not_deleted = qualified_is_not_deleted(location_col::TABLE),
            access = Self::project_write_access_predicate(location_col::TABLE),
        );
        let result = sqlx::query(&sql)
            .bind(&now)
            .bind(runtime_location_id)
            .bind(scope.project_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(expected_version)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .execute(&mut *tx)
            .await
            .map_err(map_write_error)?;
        if result.rows_affected() != 1 {
            return Err(location_write_miss(
                Self::fetch_location_with_read_access(&mut tx, scope, runtime_location_id).await?,
            ));
        }
        // Preferences must never continue selecting a deleted location.
        sqlx::query(&format!(
            "UPDATE {table} SET {is_deleted} = TRUE, {updated_at} = {timestamp}, {version} = {version} + 1 \
             WHERE {tenant_id} = ? AND {organization_id} = ? AND {project_id} = ? \
             AND {runtime_location_id} = ? AND {not_deleted}",
            table = preference_col::TABLE,
            is_deleted = preference_col::IS_DELETED,
            updated_at = preference_col::UPDATED_AT,
            timestamp = Self::timestamp_expression(is_postgres),
            version = preference_col::VERSION,
            tenant_id = preference_col::TENANT_ID,
            organization_id = preference_col::ORGANIZATION_ID,
            project_id = preference_col::PROJECT_ID,
            runtime_location_id = preference_col::RUNTIME_LOCATION_ID,
            not_deleted = qualified_is_not_deleted(preference_col::TABLE),
        ))
        .bind(&now)
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(runtime_location_id)
        .execute(&mut *tx)
        .await
        .map_err(map_write_error)?;
        Self::append_audit(&mut tx, scope, Some(runtime_location_id), audit, &now, is_postgres).await?;
        tx.commit().await.map_err(map_sqlx_error)?;
        Ok(())
    }

    async fn get_runtime_location_preference(
        &self,
        context: &ProjectContext,
        project_id: &str,
        capability: &str,
    ) -> Result<Option<ProjectRuntimeLocationPreferencePayload>, ProjectError> {
        let scope = Self::scope(context, project_id)?;
        let access = Self::project_read_access_predicate("l");
        let sql = format!(
            "SELECT p.* FROM {preference_table} p INNER JOIN {location_table} l \
             ON l.{location_id} = p.{runtime_location_id} AND l.{location_project_id} = p.{project_id} \
             WHERE p.{tenant_id} = ? AND p.{organization_id} = ? AND p.{project_id} = ? \
             AND p.{subject_user_id} = ? AND p.{capability} = ? AND {preference_not_deleted} \
             AND {location_not_deleted} AND {access}",
            preference_table = preference_col::TABLE,
            location_table = location_col::TABLE,
            location_id = location_col::ID,
            runtime_location_id = preference_col::RUNTIME_LOCATION_ID,
            location_project_id = location_col::PROJECT_ID,
            project_id = preference_col::PROJECT_ID,
            tenant_id = preference_col::TENANT_ID,
            organization_id = preference_col::ORGANIZATION_ID,
            subject_user_id = preference_col::SUBJECT_USER_ID,
            capability = preference_col::CAPABILITY,
            preference_not_deleted = qualified_is_not_deleted("p"),
            location_not_deleted = qualified_is_not_deleted("l"),
        );
        let row = sqlx::query(&sql)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .bind(scope.user_id)
            .bind(capability)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(map_sqlx_error)?;
        row.map(|value| {
            ProjectRuntimeLocationPreferenceRow::from_row(&value)
                .map(|row| preference_from_row(&row))
                .map_err(map_sqlx_error)
        })
        .transpose()
    }

    async fn list_runtime_location_preferences(
        &self,
        context: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectRuntimeLocationPreferencePayload>, usize), ProjectError> {
        let scope = Self::scope(context, project_id)?;
        let access = Self::project_read_access_predicate("l");
        let where_clause = format!(
            "p.{tenant_id} = ? AND p.{organization_id} = ? AND p.{project_id} = ? \
             AND p.{subject_user_id} = ? AND {preference_not_deleted} AND {location_not_deleted} \
             AND {access}",
            tenant_id = preference_col::TENANT_ID,
            organization_id = preference_col::ORGANIZATION_ID,
            project_id = preference_col::PROJECT_ID,
            subject_user_id = preference_col::SUBJECT_USER_ID,
            preference_not_deleted = qualified_is_not_deleted("p"),
            location_not_deleted = qualified_is_not_deleted("l"),
        );
        let list_sql = format!(
            "SELECT p.* FROM {preference_table} p INNER JOIN {location_table} l \
             ON l.{location_id} = p.{runtime_location_id} AND l.{location_project_id} = p.{project_id} \
             WHERE {where_clause} ORDER BY p.{updated_at} DESC, p.{id} DESC LIMIT ? OFFSET ?",
            preference_table = preference_col::TABLE,
            location_table = location_col::TABLE,
            location_id = location_col::ID,
            runtime_location_id = preference_col::RUNTIME_LOCATION_ID,
            location_project_id = location_col::PROJECT_ID,
            project_id = preference_col::PROJECT_ID,
            updated_at = preference_col::UPDATED_AT,
            id = preference_col::ID,
        );
        let rows = sqlx::query(&list_sql)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .bind(limit as i64)
            .bind(offset as i64)
            .fetch_all(&self.pool)
            .await
            .map_err(map_sqlx_error)?;
        let items = rows
            .iter()
            .map(|row| {
                ProjectRuntimeLocationPreferenceRow::from_row(row)
                    .map(|value| preference_from_row(&value))
                    .map_err(map_sqlx_error)
            })
            .collect::<Result<Vec<_>, _>>()?;
        let count_sql = format!(
            "SELECT COUNT(*) FROM {preference_table} p INNER JOIN {location_table} l \
             ON l.{location_id} = p.{runtime_location_id} AND l.{location_project_id} = p.{project_id} \
             WHERE {where_clause}",
            preference_table = preference_col::TABLE,
            location_table = location_col::TABLE,
            location_id = location_col::ID,
            runtime_location_id = preference_col::RUNTIME_LOCATION_ID,
            location_project_id = location_col::PROJECT_ID,
            project_id = preference_col::PROJECT_ID,
        );
        let total: i64 = sqlx::query_scalar(&count_sql)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .fetch_one(&self.pool)
            .await
            .map_err(map_sqlx_error)?;
        Ok((items, total.max(0) as usize))
    }

    async fn upsert_runtime_location_preference(
        &self,
        context: &ProjectContext,
        preference: &NewProjectRuntimeLocationPreference,
        audit: &ProjectRuntimeLocationAuditEntry,
    ) -> Result<ProjectRuntimeLocationPreferencePayload, ProjectError> {
        let scope = Self::scope(context, &preference.project_id)?;
        validate_preference(preference)?;
        let is_postgres = self.is_postgres().await?;
        let now = Self::now_iso();
        let expires_at = Self::expiry_iso();
        let mut tx = self.pool.begin().await.map_err(map_sqlx_error)?;
        let current = Self::fetch_current_preference_on_tx(&mut tx, scope, &preference.capability).await?;
        let resource_id = current
            .as_ref()
            .map(|value| value.id.as_str())
            .unwrap_or(preference.id.as_str())
            .to_owned();
        if let Some(current) = current.as_ref() {
            let expected = preference.expected_version.ok_or_else(|| {
                ProjectError::PreconditionFailed("If-Match is required to replace an existing runtime-location preference.".to_owned())
            })?;
            if expected != parse_version(&current.version)? {
                return Err(ProjectError::PreconditionFailed(
                    "Runtime-location preference version does not match If-Match.".to_owned(),
                ));
            }
        } else if preference.expected_version.is_some() {
            return Err(ProjectError::PreconditionFailed(
                "If-Match must be omitted when creating a runtime-location preference.".to_owned(),
            ));
        }
        match Self::reserve_idempotency(
            &mut tx,
            scope,
            preference.idempotency.as_ref(),
            RESOURCE_KIND_PREFERENCE,
            &resource_id,
            preference.expected_version,
            &now,
            &expires_at,
            is_postgres,
        )
        .await?
        {
            IdempotencyReservation::Replay { resource_id } => {
                let value = Self::fetch_preference_on_tx(&mut tx, scope, &resource_id)
                    .await?
                    .ok_or_else(|| ProjectError::Conflict("Idempotent runtime-location preference is unavailable.".to_owned()))?;
                tx.commit().await.map_err(map_sqlx_error)?;
                return Ok(value);
            }
            IdempotencyReservation::Reserved => {}
        }
        let value = if let Some(current) = current {
            let expected_version = preference.expected_version.expect("validated existing preference");
            let sql = format!(
                "UPDATE {table} SET {runtime_location_id} = ?, {updated_at} = {timestamp}, {version} = {version} + 1 \
                 WHERE {id} = ? AND {tenant_id} = ? AND {organization_id} = ? AND {project_id} = ? \
                 AND {subject_user_id} = ? AND {version} = ? AND {not_deleted}",
                table = preference_col::TABLE,
                runtime_location_id = preference_col::RUNTIME_LOCATION_ID,
                updated_at = preference_col::UPDATED_AT,
                timestamp = Self::timestamp_expression(is_postgres),
                version = preference_col::VERSION,
                id = preference_col::ID,
                tenant_id = preference_col::TENANT_ID,
                organization_id = preference_col::ORGANIZATION_ID,
                project_id = preference_col::PROJECT_ID,
                subject_user_id = preference_col::SUBJECT_USER_ID,
                not_deleted = qualified_is_not_deleted(preference_col::TABLE),
            );
            let result = sqlx::query(&sql)
                .bind(&preference.runtime_location_id)
                .bind(&now)
                .bind(&current.id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.project_id)
                .bind(scope.user_id)
                .bind(expected_version)
                .execute(&mut *tx)
                .await
                .map_err(map_write_error)?;
            if result.rows_affected() != 1 {
                return Err(ProjectError::PreconditionFailed(
                    "Runtime-location preference was modified concurrently.".to_owned(),
                ));
            }
            Self::fetch_preference_on_tx(&mut tx, scope, &current.id)
                .await?
                .ok_or_else(|| ProjectError::Internal("Updated runtime-location preference is unavailable.".to_owned()))?
        } else {
            let timestamp = Self::timestamp_expression(is_postgres);
            let sql = format!(
                "INSERT INTO {table} ({id}, {uuid}, {tenant_id}, {organization_id}, {project_id}, {subject_user_id}, \
                 {capability}, {runtime_location_id}, {version}, {created_at}, {updated_at}, {is_deleted}) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, {timestamp}, {timestamp}, FALSE)",
                table = preference_col::TABLE,
                id = preference_col::ID,
                uuid = preference_col::UUID,
                tenant_id = preference_col::TENANT_ID,
                organization_id = preference_col::ORGANIZATION_ID,
                project_id = preference_col::PROJECT_ID,
                subject_user_id = preference_col::SUBJECT_USER_ID,
                capability = preference_col::CAPABILITY,
                runtime_location_id = preference_col::RUNTIME_LOCATION_ID,
                version = preference_col::VERSION,
                created_at = preference_col::CREATED_AT,
                updated_at = preference_col::UPDATED_AT,
                is_deleted = preference_col::IS_DELETED,
            );
            sqlx::query(&sql)
                .bind(&preference.id)
                .bind(&preference.uuid)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.project_id)
                .bind(scope.user_id)
                .bind(&preference.capability)
                .bind(&preference.runtime_location_id)
                .bind(&now)
                .bind(&now)
                .execute(&mut *tx)
                .await
                .map_err(map_write_error)?;
            Self::fetch_preference_on_tx(&mut tx, scope, &preference.id)
                .await?
                .ok_or_else(|| ProjectError::Internal("Created runtime-location preference is unavailable.".to_owned()))?
        };
        Self::append_audit(
            &mut tx,
            scope,
            Some(&preference.runtime_location_id),
            audit,
            &now,
            is_postgres,
        )
        .await?;
        tx.commit().await.map_err(map_sqlx_error)?;
        Ok(value)
    }
}

fn parse_positive_id(value: &str, field: &str) -> Result<i64, ProjectError> {
    let value = value
        .parse::<i64>()
        .map_err(|_| ProjectError::InvalidInput(format!("invalid {field}")))?;
    if value <= 0 {
        return Err(ProjectError::InvalidInput(format!("invalid {field}")));
    }
    Ok(value)
}

fn stored_location_from_row(row: &ProjectRuntimeLocationRow) -> StoredProjectRuntimeLocation {
    StoredProjectRuntimeLocation {
        id: row.id.clone(),
        uuid: row.uuid.clone(),
        tenant_id: row.tenant_id.to_string(),
        organization_id: row.organization_id.to_string(),
        project_id: row.project_id.to_string(),
        registered_by_user_id: row.registered_by_user_id.to_string(),
        runtime_target_id: row.runtime_target_id.clone(),
        runtime_target_kind: row.runtime_target_kind.clone(),
        location_kind: row.location_kind.clone(),
        path_flavor: row.path_flavor.clone(),
        root_locator: row.root_locator.clone(),
        display_name: row.display_name.clone(),
        encrypted_absolute_path: row.encrypted_absolute_path.clone(),
        path_encryption_key_id: row.path_encryption_key_id.clone(),
        path_fingerprint: row.path_fingerprint.clone(),
        terminal_available: row.terminal_available,
        git_available: row.git_available,
        build_available: row.build_available,
        file_system_available: row.file_system_available,
        health_status: row.health_status.clone(),
        last_verified_at: row.last_verified_at.clone(),
        last_seen_at: row.last_seen_at.clone(),
        verified_by_user_id: row.verified_by_user_id.map(|value| value.to_string()),
        git_repository_url: row.git_repository_url.clone(),
        git_remote_name: row.git_remote_name.clone(),
        git_branch: row.git_branch.clone(),
        git_commit: row.git_commit.clone(),
        git_worktree_key: row.git_worktree_key.clone(),
        version: row.version,
        created_at: row.created_at.clone(),
        updated_at: row.updated_at.clone(),
    }
}

fn preference_from_row(row: &ProjectRuntimeLocationPreferenceRow) -> ProjectRuntimeLocationPreferencePayload {
    ProjectRuntimeLocationPreferencePayload {
        id: row.id.clone(),
        project_id: row.project_id.to_string(),
        subject_user_id: row.subject_user_id.to_string(),
        capability: row.capability.clone(),
        runtime_location_id: row.runtime_location_id.clone(),
        version: row.version.to_string(),
        created_at: row.created_at.clone(),
        updated_at: row.updated_at.clone(),
    }
}

fn parse_version(value: &str) -> Result<i64, ProjectError> {
    value
        .parse::<i64>()
        .map_err(|_| ProjectError::Internal("Stored runtime-location version is invalid.".to_owned()))
}

fn location_write_miss(existing: Option<StoredProjectRuntimeLocation>) -> ProjectError {
    if existing.is_some() {
        ProjectError::PreconditionFailed("Runtime-location version does not match If-Match.".to_owned())
    } else {
        ProjectError::NotFound("Project runtime location was not found.".to_owned())
    }
}

fn validate_new_location(location: &NewProjectRuntimeLocation) -> Result<(), ProjectError> {
    if location.id.trim().is_empty()
        || location.uuid.trim().is_empty()
        || location.runtime_target_id.trim().is_empty()
        || location.encrypted_absolute_path.trim().is_empty()
        || location.path_encryption_key_id.trim().is_empty()
        || !is_hex(&location.path_fingerprint, 64)
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location persistence input is invalid.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_update(update: &ProjectRuntimeLocationUpdate) -> Result<(), ProjectError> {
    if update.expected_version < 0 || update.display_name.as_deref().is_none_or(str::is_empty) {
        return Err(ProjectError::InvalidInput(
            "Runtime-location update input is invalid.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_rebind(rebind: &ProjectRuntimeLocationRebind) -> Result<(), ProjectError> {
    if rebind.expected_version < 0
        || rebind.path_flavor.trim().is_empty()
        || rebind.root_locator.trim().is_empty()
        || rebind.display_name.trim().is_empty()
        || rebind.encrypted_absolute_path.trim().is_empty()
        || rebind.path_encryption_key_id.trim().is_empty()
        || !is_hex(&rebind.path_fingerprint, 64)
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location rebind input is invalid.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_verification(
    verification: &TrustedProjectRuntimeLocationVerification,
) -> Result<(), ProjectError> {
    if verification.expected_version < 0 || verification.runtime_target_id.trim().is_empty() {
        return Err(ProjectError::InvalidInput(
            "Runtime-location verification input is invalid.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_preference(preference: &NewProjectRuntimeLocationPreference) -> Result<(), ProjectError> {
    if preference.id.trim().is_empty()
        || preference.uuid.trim().is_empty()
        || preference.runtime_location_id.trim().is_empty()
        || !matches!(preference.capability.as_str(), "terminal" | "git" | "build" | "file_system")
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location preference input is invalid.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_idempotency(idempotency: &RuntimeLocationIdempotency) -> Result<(), ProjectError> {
    if idempotency.operation.trim().is_empty()
        || !is_hex(&idempotency.key_hash, 64)
        || !is_hex(&idempotency.request_fingerprint, 64)
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location idempotency input is invalid.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_audit_entry(audit: &ProjectRuntimeLocationAuditEntry) -> Result<(), ProjectError> {
    if audit.action.trim().is_empty()
        || audit.action.len() > 160
        || audit.result.trim().is_empty()
        || audit.result.len() > 64
        || audit.redacted_metadata_json.len() > 4096
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location audit input is invalid.".to_owned(),
        ));
    }
    let value: serde_json::Value = serde_json::from_str(&audit.redacted_metadata_json).map_err(|_| {
        ProjectError::InvalidInput("Runtime-location audit metadata is invalid.".to_owned())
    })?;
    if !value.is_object() {
        return Err(ProjectError::InvalidInput(
            "Runtime-location audit metadata must be an object.".to_owned(),
        ));
    }
    let lower = audit.redacted_metadata_json.to_ascii_lowercase();
    if [
        "absolute_path",
        "encrypted_absolute_path",
        "ciphertext",
        "path_fingerprint",
        "path_encryption",
        "idempotency-key",
        "authorization",
        "access-token",
    ]
    .iter()
    .any(|forbidden| lower.contains(forbidden))
    {
        return Err(ProjectError::InvalidInput(
            "Runtime-location audit metadata contains a protected field.".to_owned(),
        ));
    }
    Ok(())
}

fn is_hex(value: &str, length: usize) -> bool {
    value.len() == length && value.bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn map_sqlx_error(error: sqlx::Error) -> ProjectError {
    ProjectError::Repository(error.to_string())
}

fn map_write_error(error: sqlx::Error) -> ProjectError {
    let text = error.to_string().to_ascii_lowercase();
    if text.contains("unique") || text.contains("duplicate") || text.contains("constraint") {
        ProjectError::Conflict("Runtime-location state conflicts with an existing record.".to_owned())
    } else {
        ProjectError::Repository(error.to_string())
    }
}
