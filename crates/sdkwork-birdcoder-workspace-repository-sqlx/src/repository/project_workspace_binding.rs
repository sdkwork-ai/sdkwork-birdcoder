use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::workspace_binding::{
    NewProjectWorkspaceBinding, ProjectWorkspaceBindingAuditEntry,
    ProjectWorkspaceBindingIdempotency, ProjectWorkspaceBindingPayload,
    PROJECT_WORKSPACE_BINDING_LIFECYCLE_ACTIVE, PROJECT_WORKSPACE_BINDING_LIFECYCLE_REVOKED,
    PROJECT_WORKSPACE_BINDING_OPERATION_UPSERT,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::workspace_binding_repository::ProjectWorkspaceBindingRepository;
use sdkwork_birdcoder_project_service::service::project_workspace_binding_service::canonical_logical_path;
use sdkwork_birdcoder_sqlx_repository_pool::dialect::qualified_is_not_deleted;
use sdkwork_utils_rust::uuid;
use sqlx::{Any, AnyPool, Row, Transaction};
use time::{Duration, OffsetDateTime};

use crate::db::columns::project as project_col;
use crate::db::columns::project_collaborator as collaborator_col;
use crate::db::columns::project_workspace_binding as binding_col;
use crate::db::columns::project_workspace_binding_audit as audit_col;
use crate::db::columns::project_workspace_binding_idempotency as idempotency_col;
use crate::db::rows::ProjectWorkspaceBindingRow;
use crate::repository::scope::{
    project_scoped_organization_id, project_scoped_tenant_id, project_scoped_user_id,
};

const IDEMPOTENCY_RETENTION_HOURS: i64 = 24;

#[derive(Clone)]
pub struct SqliteProjectWorkspaceBindingRepository {
    pool: AnyPool,
}

#[derive(Clone, Copy)]
struct BindingScope {
    tenant_id: i64,
    organization_id: i64,
    user_id: i64,
    project_id: i64,
}

enum IdempotencyReservation {
    Reserved,
    Replay { resource_id: String },
}

impl SqliteProjectWorkspaceBindingRepository {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }

    fn scope(context: &ProjectContext, project_id: &str) -> Result<BindingScope, ProjectError> {
        Ok(BindingScope {
            tenant_id: project_scoped_tenant_id(context)?,
            organization_id: project_scoped_organization_id(context)?,
            user_id: project_scoped_user_id(context)?,
            project_id: parse_positive_id(project_id, "project_id")?,
        })
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
        let connection = self.pool.acquire().await.map_err(map_sqlx_error)?;
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

    fn project_access_predicate(binding_alias: &str, write: bool) -> String {
        let collaborator_role = if write {
            format!(
                " AND LOWER(c.{}) IN ('owner', 'admin')",
                collaborator_col::ROLE
            )
        } else {
            String::new()
        };
        format!(
            "EXISTS (SELECT 1 FROM {project_table} p WHERE p.{project_id} = {binding_alias}.{binding_project_id} \
             AND p.{project_tenant_id} = {binding_alias}.{binding_tenant_id} \
             AND p.{project_organization_id} = {binding_alias}.{binding_organization_id} \
             AND {project_not_deleted} \
             AND (p.{project_user_id} = ? OR EXISTS (SELECT 1 FROM {collaborator_table} c \
                 WHERE c.{collaborator_project_id} = p.{project_id} \
                   AND c.{collaborator_tenant_id} = p.{project_tenant_id} \
                   AND c.{collaborator_organization_id} = p.{project_organization_id} \
                   AND c.{collaborator_user_id} = ? AND {collaborator_not_deleted} \
                   AND LOWER(c.{collaborator_status}) = 'active'{collaborator_role})))",
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
            binding_project_id = binding_col::PROJECT_ID,
            binding_tenant_id = binding_col::TENANT_ID,
            binding_organization_id = binding_col::ORGANIZATION_ID,
        )
    }

    async fn ensure_project_write_access_on_tx(
        tx: &mut Transaction<'_, Any>,
        scope: BindingScope,
    ) -> Result<(), ProjectError> {
        let role = format!(
            " AND LOWER(c.{}) IN ('owner', 'admin')",
            collaborator_col::ROLE
        );
        let sql = format!(
            "SELECT 1 FROM {project_table} p WHERE p.{project_id} = ? \
             AND p.{tenant_id} = ? AND p.{organization_id} = ? AND {project_not_deleted} \
             AND (p.{user_id} = ? OR EXISTS (SELECT 1 FROM {collaborator_table} c \
                 WHERE c.{collaborator_project_id} = p.{project_id} \
                   AND c.{collaborator_tenant_id} = p.{tenant_id} \
                   AND c.{collaborator_organization_id} = p.{organization_id} \
                   AND c.{collaborator_user_id} = ? AND {collaborator_not_deleted} \
                   AND LOWER(c.{collaborator_status}) = 'active'{role}))",
            project_table = project_col::TABLE,
            project_id = project_col::ID,
            tenant_id = project_col::TENANT_ID,
            organization_id = project_col::ORGANIZATION_ID,
            project_not_deleted = qualified_is_not_deleted("p"),
            user_id = project_col::USER_ID,
            collaborator_table = collaborator_col::TABLE,
            collaborator_project_id = collaborator_col::PROJECT_ID,
            collaborator_tenant_id = collaborator_col::TENANT_ID,
            collaborator_organization_id = collaborator_col::ORGANIZATION_ID,
            collaborator_user_id = collaborator_col::USER_ID,
            collaborator_not_deleted = qualified_is_not_deleted("c"),
            collaborator_status = collaborator_col::STATUS,
        );
        let found = sqlx::query_scalar::<_, i64>(&sql)
            .bind(scope.project_id)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .fetch_optional(&mut **tx)
            .await
            .map_err(map_sqlx_error)?;
        if found.is_none() {
            return Err(ProjectError::NotFound("Project was not found.".to_owned()));
        }
        Ok(())
    }

    async fn fetch_binding_on_pool(
        &self,
        scope: BindingScope,
    ) -> Result<Option<ProjectWorkspaceBindingPayload>, ProjectError> {
        let sql = select_binding_sql(Self::project_access_predicate("b", false));
        fetch_binding(
            sqlx::query(&sql)
                .bind(scope.project_id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(map_sqlx_error)?,
        )
    }

    async fn fetch_binding_on_tx(
        tx: &mut Transaction<'_, Any>,
        scope: BindingScope,
        write: bool,
    ) -> Result<Option<ProjectWorkspaceBindingPayload>, ProjectError> {
        let sql = select_binding_sql(Self::project_access_predicate("b", write));
        fetch_binding(
            sqlx::query(&sql)
                .bind(scope.project_id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .fetch_optional(&mut **tx)
                .await
                .map_err(map_sqlx_error)?,
        )
    }

    async fn reserve_idempotency(
        tx: &mut Transaction<'_, Any>,
        scope: BindingScope,
        idempotency: &ProjectWorkspaceBindingIdempotency,
        resource_id: &str,
        resource_version: Option<i64>,
        now: &str,
        expires_at: &str,
        is_postgres: bool,
    ) -> Result<IdempotencyReservation, ProjectError> {
        validate_idempotency(idempotency)?;
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
            "INSERT INTO {table} ({id}, {uuid}, {tenant_id}, {organization_id}, {project_id}, \
             {subject_user_id}, {operation_kind}, {key_hash}, {request_fingerprint}, {resource_id}, \
             {resource_version}, {created_at}, {expires_at}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \
             {created}, {expires}) ON CONFLICT DO NOTHING",
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
            resource_id = idempotency_col::RESOURCE_ID,
            resource_version = idempotency_col::RESOURCE_VERSION,
            created_at = idempotency_col::CREATED_AT,
            expires_at = idempotency_col::EXPIRES_AT,
            created = Self::timestamp_expression(is_postgres),
            expires = Self::timestamp_expression(is_postgres),
        ))
        .bind(uuid())
        .bind(uuid())
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
        .ok_or_else(|| {
            ProjectError::Conflict(
                "Workspace-binding idempotency reservation is unavailable.".to_owned(),
            )
        })?;
        let fingerprint: String = existing
            .try_get(idempotency_col::REQUEST_FINGERPRINT)
            .map_err(map_sqlx_error)?;
        if fingerprint != idempotency.request_fingerprint {
            return Err(ProjectError::Conflict(
                "Idempotency-Key was already used with a different request.".to_owned(),
            ));
        }
        Ok(IdempotencyReservation::Replay {
            resource_id: existing
                .try_get(idempotency_col::RESOURCE_ID)
                .map_err(map_sqlx_error)?,
        })
    }

    async fn append_audit(
        tx: &mut Transaction<'_, Any>,
        scope: BindingScope,
        binding_id: &str,
        audit: &ProjectWorkspaceBindingAuditEntry,
        now: &str,
        is_postgres: bool,
    ) -> Result<(), ProjectError> {
        validate_audit(audit)?;
        sqlx::query(&format!(
            "INSERT INTO {table} ({id}, {uuid}, {tenant_id}, {organization_id}, {project_id}, \
             {binding_id}, {actor_user_id}, {action}, {result}, {trace_id}, {occurred_at}, {metadata}) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, {occurred}, {metadata_value})",
            table = audit_col::TABLE,
            id = audit_col::ID,
            uuid = audit_col::UUID,
            tenant_id = audit_col::TENANT_ID,
            organization_id = audit_col::ORGANIZATION_ID,
            project_id = audit_col::PROJECT_ID,
            binding_id = audit_col::WORKSPACE_BINDING_ID,
            actor_user_id = audit_col::ACTOR_USER_ID,
            action = audit_col::ACTION,
            result = audit_col::RESULT,
            trace_id = audit_col::TRACE_ID,
            occurred_at = audit_col::OCCURRED_AT,
            metadata = audit_col::REDACTED_METADATA_JSON,
            occurred = Self::timestamp_expression(is_postgres),
            metadata_value = Self::metadata_expression(is_postgres),
        ))
        .bind(uuid())
        .bind(uuid())
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(binding_id)
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
}

#[async_trait::async_trait]
impl ProjectWorkspaceBindingRepository for SqliteProjectWorkspaceBindingRepository {
    async fn get_workspace_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
    ) -> Result<Option<ProjectWorkspaceBindingPayload>, ProjectError> {
        self.fetch_binding_on_pool(Self::scope(context, project_id)?)
            .await
    }

    async fn upsert_workspace_binding(
        &self,
        context: &ProjectContext,
        binding: &NewProjectWorkspaceBinding,
        audit: &ProjectWorkspaceBindingAuditEntry,
    ) -> Result<ProjectWorkspaceBindingPayload, ProjectError> {
        validate_binding(binding)?;
        let scope = Self::scope(context, &binding.project_id)?;
        let is_postgres = self.is_postgres().await?;
        let now = Self::now_iso();
        let expires_at = Self::expiry_iso();
        let mut tx = self.pool.begin().await.map_err(map_sqlx_error)?;
        Self::ensure_project_write_access_on_tx(&mut tx, scope).await?;
        let current = Self::fetch_binding_on_tx(&mut tx, scope, true).await?;
        let resource_id = current
            .as_ref()
            .map(|value| value.id.as_str())
            .unwrap_or(&binding.id);
        match Self::reserve_idempotency(
            &mut tx,
            scope,
            &binding.idempotency,
            resource_id,
            current
                .as_ref()
                .and_then(|value| value.version.parse::<i64>().ok()),
            &now,
            &expires_at,
            is_postgres,
        )
        .await?
        {
            IdempotencyReservation::Replay { resource_id } => {
                let value = Self::fetch_binding_on_tx(&mut tx, scope, false)
                    .await?
                    .filter(|value| value.id == resource_id)
                    .ok_or_else(|| {
                        ProjectError::Conflict(
                            "Idempotent workspace binding is no longer available.".to_owned(),
                        )
                    })?;
                tx.commit().await.map_err(map_sqlx_error)?;
                return Ok(value);
            }
            IdempotencyReservation::Reserved => {}
        }

        let binding_id = if let Some(current) = current {
            let expected_version = binding.expected_version.ok_or_else(|| {
                ProjectError::PreconditionRequired(
                    "If-Match is required to replace an existing project workspace binding."
                        .to_owned(),
                )
            })?;
            let current_version = parse_version(&current.version)?;
            if current_version != expected_version {
                return Err(ProjectError::PreconditionFailed(
                    "Workspace-binding version does not match If-Match.".to_owned(),
                ));
            }
            let sql = format!(
                "UPDATE {table} SET {sandbox_id} = ?, {root_entry_id} = ?, {logical_path} = ?, \
                 {lifecycle_status} = ?, {updated_by} = ?, {updated_at} = {timestamp}, \
                 {version} = {version} + 1 WHERE {id} = ? AND {tenant_id} = ? \
                 AND {organization_id} = ? AND {project_id} = ? AND {version} = ? \
                 AND {not_deleted} AND {access}",
                table = binding_col::TABLE,
                sandbox_id = binding_col::SANDBOX_ID,
                root_entry_id = binding_col::ROOT_ENTRY_ID,
                logical_path = binding_col::LOGICAL_PATH,
                lifecycle_status = binding_col::LIFECYCLE_STATUS,
                updated_by = binding_col::UPDATED_BY_USER_ID,
                updated_at = binding_col::UPDATED_AT,
                timestamp = Self::timestamp_expression(is_postgres),
                version = binding_col::VERSION,
                id = binding_col::ID,
                tenant_id = binding_col::TENANT_ID,
                organization_id = binding_col::ORGANIZATION_ID,
                project_id = binding_col::PROJECT_ID,
                not_deleted = qualified_is_not_deleted("studio_project_workspace_binding"),
                access = Self::project_access_predicate(binding_col::TABLE, true),
            );
            let result = sqlx::query(&sql)
                .bind(&binding.sandbox_id)
                .bind(&binding.root_entry_id)
                .bind(&binding.logical_path)
                .bind(&binding.lifecycle_status)
                .bind(scope.user_id)
                .bind(&now)
                .bind(&current.id)
                .bind(scope.tenant_id)
                .bind(scope.organization_id)
                .bind(scope.project_id)
                .bind(expected_version)
                .bind(scope.user_id)
                .bind(scope.user_id)
                .execute(&mut *tx)
                .await
                .map_err(map_write_error)?;
            if result.rows_affected() != 1 {
                return Err(ProjectError::PreconditionFailed(
                    "Workspace-binding version does not match If-Match.".to_owned(),
                ));
            }
            current.id
        } else {
            if binding.expected_version.is_some() {
                return Err(ProjectError::PreconditionFailed(
                    "Project workspace binding does not exist for the supplied If-Match."
                        .to_owned(),
                ));
            }
            sqlx::query(&format!(
                "INSERT INTO {table} ({id}, {uuid}, {tenant_id}, {organization_id}, {project_id}, \
                 {sandbox_id}, {root_entry_id}, {logical_path}, {lifecycle_status}, {created_by}, \
                 {updated_by}, {version}, {created_at}, {updated_at}, {is_deleted}) \
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, {created}, {updated}, FALSE)",
                table = binding_col::TABLE,
                id = binding_col::ID,
                uuid = binding_col::UUID,
                tenant_id = binding_col::TENANT_ID,
                organization_id = binding_col::ORGANIZATION_ID,
                project_id = binding_col::PROJECT_ID,
                sandbox_id = binding_col::SANDBOX_ID,
                root_entry_id = binding_col::ROOT_ENTRY_ID,
                logical_path = binding_col::LOGICAL_PATH,
                lifecycle_status = binding_col::LIFECYCLE_STATUS,
                created_by = binding_col::CREATED_BY_USER_ID,
                updated_by = binding_col::UPDATED_BY_USER_ID,
                version = binding_col::VERSION,
                created_at = binding_col::CREATED_AT,
                updated_at = binding_col::UPDATED_AT,
                is_deleted = binding_col::IS_DELETED,
                created = Self::timestamp_expression(is_postgres),
                updated = Self::timestamp_expression(is_postgres),
            ))
            .bind(&binding.id)
            .bind(&binding.uuid)
            .bind(scope.tenant_id)
            .bind(scope.organization_id)
            .bind(scope.project_id)
            .bind(&binding.sandbox_id)
            .bind(&binding.root_entry_id)
            .bind(&binding.logical_path)
            .bind(&binding.lifecycle_status)
            .bind(scope.user_id)
            .bind(scope.user_id)
            .bind(&now)
            .bind(&now)
            .execute(&mut *tx)
            .await
            .map_err(map_write_error)?;
            binding.id.clone()
        };

        Self::append_audit(&mut tx, scope, &binding_id, audit, &now, is_postgres).await?;
        let value = Self::fetch_binding_on_tx(&mut tx, scope, false)
            .await?
            .filter(|value| value.id == binding_id)
            .ok_or_else(|| {
                ProjectError::Internal(
                    "Persisted project workspace binding is unavailable.".to_owned(),
                )
            })?;
        tx.commit().await.map_err(map_sqlx_error)?;
        Ok(value)
    }

    async fn delete_workspace_binding(
        &self,
        context: &ProjectContext,
        project_id: &str,
        expected_version: i64,
        audit: &ProjectWorkspaceBindingAuditEntry,
    ) -> Result<(), ProjectError> {
        if expected_version < 0 {
            return Err(ProjectError::InvalidInput(
                "Workspace-binding version must be non-negative.".to_owned(),
            ));
        }
        let scope = Self::scope(context, project_id)?;
        let is_postgres = self.is_postgres().await?;
        let now = Self::now_iso();
        let mut tx = self.pool.begin().await.map_err(map_sqlx_error)?;
        Self::ensure_project_write_access_on_tx(&mut tx, scope).await?;
        let current = Self::fetch_binding_on_tx(&mut tx, scope, true)
            .await?
            .ok_or_else(|| {
                ProjectError::NotFound("Project workspace binding was not found.".to_owned())
            })?;
        if parse_version(&current.version)? != expected_version {
            return Err(ProjectError::PreconditionFailed(
                "Workspace-binding version does not match If-Match.".to_owned(),
            ));
        }
        let result = sqlx::query(&format!(
            "UPDATE {table} SET {lifecycle_status} = ?, {updated_by} = ?, {is_deleted} = TRUE, \
             {updated_at} = {timestamp}, {version} = {version} + 1 WHERE {id} = ? \
             AND {tenant_id} = ? AND {organization_id} = ? AND {project_id} = ? \
             AND {version} = ? AND {not_deleted} AND {access}",
            table = binding_col::TABLE,
            lifecycle_status = binding_col::LIFECYCLE_STATUS,
            updated_by = binding_col::UPDATED_BY_USER_ID,
            is_deleted = binding_col::IS_DELETED,
            updated_at = binding_col::UPDATED_AT,
            timestamp = Self::timestamp_expression(is_postgres),
            version = binding_col::VERSION,
            id = binding_col::ID,
            tenant_id = binding_col::TENANT_ID,
            organization_id = binding_col::ORGANIZATION_ID,
            project_id = binding_col::PROJECT_ID,
            not_deleted = qualified_is_not_deleted(binding_col::TABLE),
            access = Self::project_access_predicate(binding_col::TABLE, true),
        ))
        .bind(PROJECT_WORKSPACE_BINDING_LIFECYCLE_REVOKED)
        .bind(scope.user_id)
        .bind(&now)
        .bind(&current.id)
        .bind(scope.tenant_id)
        .bind(scope.organization_id)
        .bind(scope.project_id)
        .bind(expected_version)
        .bind(scope.user_id)
        .bind(scope.user_id)
        .execute(&mut *tx)
        .await
        .map_err(map_write_error)?;
        if result.rows_affected() != 1 {
            return Err(ProjectError::PreconditionFailed(
                "Workspace-binding version does not match If-Match.".to_owned(),
            ));
        }
        Self::append_audit(&mut tx, scope, &current.id, audit, &now, is_postgres).await?;
        tx.commit().await.map_err(map_sqlx_error)?;
        Ok(())
    }
}

fn select_binding_sql(access: String) -> String {
    format!(
        "SELECT b.* FROM {table} b WHERE b.{project_id} = ? AND b.{tenant_id} = ? \
         AND b.{organization_id} = ? AND {not_deleted} AND {access}",
        table = binding_col::TABLE,
        project_id = binding_col::PROJECT_ID,
        tenant_id = binding_col::TENANT_ID,
        organization_id = binding_col::ORGANIZATION_ID,
        not_deleted = qualified_is_not_deleted("b"),
    )
}

fn fetch_binding(
    row: Option<sqlx::any::AnyRow>,
) -> Result<Option<ProjectWorkspaceBindingPayload>, ProjectError> {
    row.map(|value| {
        ProjectWorkspaceBindingRow::from_row(&value)
            .map(binding_payload)
            .map_err(map_sqlx_error)
    })
    .transpose()
}

fn binding_payload(row: ProjectWorkspaceBindingRow) -> ProjectWorkspaceBindingPayload {
    ProjectWorkspaceBindingPayload {
        id: row.id,
        project_id: row.project_id.to_string(),
        sandbox_id: row.sandbox_id,
        root_entry_id: row.root_entry_id,
        logical_path: row.logical_path,
        lifecycle_status: row.lifecycle_status,
        version: row.version.to_string(),
        created_at: row.created_at,
        updated_at: row.updated_at,
    }
}

fn validate_binding(binding: &NewProjectWorkspaceBinding) -> Result<(), ProjectError> {
    if binding.id.trim().is_empty()
        || binding.uuid.trim().is_empty()
        || !is_safe_opaque_id(&binding.sandbox_id)
        || !is_safe_opaque_id(&binding.root_entry_id)
        || binding.lifecycle_status != PROJECT_WORKSPACE_BINDING_LIFECYCLE_ACTIVE
        || binding.expected_version.is_some_and(|version| version < 0)
        || canonical_logical_path(&binding.logical_path).is_err()
    {
        return Err(ProjectError::InvalidInput(
            "Project workspace binding persistence input is invalid.".to_owned(),
        ));
    }
    validate_idempotency(&binding.idempotency)
}

fn validate_idempotency(
    idempotency: &ProjectWorkspaceBindingIdempotency,
) -> Result<(), ProjectError> {
    if idempotency.operation != PROJECT_WORKSPACE_BINDING_OPERATION_UPSERT
        || !is_hex(&idempotency.key_hash, 64)
        || !is_hex(&idempotency.request_fingerprint, 64)
    {
        return Err(ProjectError::InvalidInput(
            "Workspace-binding idempotency input is invalid.".to_owned(),
        ));
    }
    Ok(())
}

fn validate_audit(audit: &ProjectWorkspaceBindingAuditEntry) -> Result<(), ProjectError> {
    if audit.action.trim().is_empty()
        || audit.action.len() > 160
        || audit.result.trim().is_empty()
        || audit.result.len() > 64
        || audit.redacted_metadata_json.len() > 4096
    {
        return Err(ProjectError::InvalidInput(
            "Workspace-binding audit input is invalid.".to_owned(),
        ));
    }
    let value: serde_json::Value =
        serde_json::from_str(&audit.redacted_metadata_json).map_err(|_| {
            ProjectError::InvalidInput("Workspace-binding audit metadata is invalid.".to_owned())
        })?;
    if !value.is_object() {
        return Err(ProjectError::InvalidInput(
            "Workspace-binding audit metadata must be an object.".to_owned(),
        ));
    }
    if contains_protected_audit_key(&value) {
        return Err(ProjectError::InvalidInput(
            "Workspace-binding audit metadata contains a protected field.".to_owned(),
        ));
    }
    Ok(())
}

fn is_safe_opaque_id(value: &str) -> bool {
    !value.is_empty()
        && value.trim() == value
        && value.len() <= 512
        && !value.chars().any(char::is_control)
}

fn contains_protected_audit_key(value: &serde_json::Value) -> bool {
    const PROTECTED_KEYS: &[&str] = &[
        "absolutepath",
        "accesstoken",
        "authorization",
        "authtoken",
        "browserhandle",
        "filesystemhandle",
        "idempotencykey",
        "physicalpath",
        "privateroot",
        "providerroot",
        "providerrootref",
        "refreshtoken",
        "tauripath",
    ];

    match value {
        serde_json::Value::Object(fields) => fields.iter().any(|(key, nested)| {
            let normalized = key
                .chars()
                .filter(|character| character.is_ascii_alphanumeric())
                .flat_map(char::to_lowercase)
                .collect::<String>();
            PROTECTED_KEYS.contains(&normalized.as_str()) || contains_protected_audit_key(nested)
        }),
        serde_json::Value::Array(items) => items.iter().any(contains_protected_audit_key),
        _ => false,
    }
}

fn parse_positive_id(value: &str, field: &str) -> Result<i64, ProjectError> {
    let parsed = value
        .parse::<i64>()
        .map_err(|_| ProjectError::InvalidInput(format!("invalid {field}")))?;
    if parsed <= 0 {
        return Err(ProjectError::InvalidInput(format!("invalid {field}")));
    }
    Ok(parsed)
}

fn parse_version(value: &str) -> Result<i64, ProjectError> {
    value.parse::<i64>().map_err(|_| {
        ProjectError::Internal("Stored workspace-binding version is invalid.".to_owned())
    })
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
        ProjectError::Conflict(
            "Project workspace binding conflicts with an existing record.".to_owned(),
        )
    } else {
        ProjectError::Repository(error.to_string())
    }
}
