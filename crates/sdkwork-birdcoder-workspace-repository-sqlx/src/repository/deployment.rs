use sdkwork_birdcoder_deployment_service::context::DeploymentContext;
use sdkwork_birdcoder_deployment_service::error::DeploymentError;
use sdkwork_birdcoder_errors::require_scoped_tenant_id;
use sqlx::AnyPool;

use crate::db::columns::audit_event;
use crate::db::columns::deployment_record;
use crate::db::columns::deployment_target;
use crate::db::columns::governance_policy;
use crate::db::columns::release_record;
use crate::db::rows::{
    AuditEventRow, DeploymentRecordRow, DeploymentTargetRow, GovernancePolicyRow, ReleaseRecordRow,
};
use crate::mapper::row_mapper;
use sdkwork_birdcoder_deployment_service::domain::results::{
    AuditPayload, DeploymentPayload, DeploymentTargetPayload, PolicyPayload, ReleasePayload,
};

#[derive(Clone)]
pub struct SqliteDeploymentRepository {
    pool: AnyPool,
}

impl SqliteDeploymentRepository {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }
}

fn append_required_tenant_filter(
    ctx: &DeploymentContext,
    tenant_column: &str,
    sql: &mut String,
) -> Result<i64, DeploymentError> {
    let tenant_id = require_scoped_tenant_id(&ctx.tenant_id).map_err(|_| {
        DeploymentError::Forbidden("A valid tenant scope is required.".to_owned())
    })?;
    sql.push_str(&format!(" AND {tenant_column} = ?"));
    Ok(tenant_id)
}

#[async_trait::async_trait]
impl sdkwork_birdcoder_deployment_service::ports::repository::DeploymentRepository
    for SqliteDeploymentRepository
{
    async fn find_deployment_by_id(
        &self,
        ctx: &DeploymentContext,
        id: &str,
    ) -> Result<Option<DeploymentPayload>, DeploymentError> {
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0",
            deployment_record::TABLE,
            deployment_record::ID,
            deployment_record::IS_DELETED,
        );
        let tenant_id = append_required_tenant_filter(ctx, deployment_record::TENANT_ID, &mut sql)?;

        let row = sqlx::query(&sql)
            .bind(id)
            .bind(tenant_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;

        match row {
            Some(row) => {
                let r = DeploymentRecordRow::from_row(&row)
                    .map_err(|e| DeploymentError::Repository(e.to_string()))?;
                Ok(Some(row_mapper::deployment_record_row_to_payload(&r)))
            }
            None => Ok(None),
        }
    }

    async fn list_deployments_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentPayload>, usize), DeploymentError> {
        let tenant_id = require_scoped_tenant_id(&ctx.tenant_id).map_err(|_| {
            DeploymentError::Forbidden("A valid tenant scope is required.".to_owned())
        })?;
        // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
        let rows = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0 AND {} = ? ORDER BY id DESC LIMIT ? OFFSET ?",
            deployment_record::TABLE,
            deployment_record::PROJECT_ID,
            deployment_record::IS_DELETED,
            deployment_record::TENANT_ID,
        ))
        .bind(project_id)
        .bind(tenant_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;

        let items: Vec<DeploymentPayload> = rows
            .iter()
            .map(|row| {
                DeploymentRecordRow::from_row(row)
                    .map(|r| row_mapper::deployment_record_row_to_payload(&r))
                    .map_err(|e| DeploymentError::Repository(e.to_string()))
            })
            .collect::<Result<_, _>>()?;

        let total: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} WHERE {} = ? AND {} = 0 AND {} = ?",
            deployment_record::TABLE,
            deployment_record::PROJECT_ID,
            deployment_record::IS_DELETED,
            deployment_record::TENANT_ID,
        ))
        .bind(project_id)
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        Ok((items, total.max(0) as usize))
    }

    async fn find_deployment_target_by_id(
        &self,
        ctx: &DeploymentContext,
        id: &str,
    ) -> Result<Option<DeploymentTargetPayload>, DeploymentError> {
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0",
            deployment_target::TABLE,
            deployment_target::ID,
            deployment_target::IS_DELETED,
        );
        let tenant_id = append_required_tenant_filter(ctx, deployment_target::TENANT_ID, &mut sql)?;

        let row = sqlx::query(&sql)
            .bind(id)
            .bind(tenant_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;

        match row {
            Some(row) => {
                let r = DeploymentTargetRow::from_row(&row)
                    .map_err(|e| DeploymentError::Repository(e.to_string()))?;
                Ok(Some(row_mapper::deployment_target_row_to_payload(&r)))
            }
            None => Ok(None),
        }
    }

    async fn list_deployment_targets_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentTargetPayload>, usize), DeploymentError> {
        let tenant_id = require_scoped_tenant_id(&ctx.tenant_id).map_err(|_| {
            DeploymentError::Forbidden("A valid tenant scope is required.".to_owned())
        })?;
        // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
        let rows = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0 AND {} = ? ORDER BY id DESC LIMIT ? OFFSET ?",
            deployment_target::TABLE,
            deployment_target::PROJECT_ID,
            deployment_target::IS_DELETED,
            deployment_target::TENANT_ID,
        ))
        .bind(project_id)
        .bind(tenant_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;

        let items: Vec<DeploymentTargetPayload> = rows
            .iter()
            .map(|row| {
                DeploymentTargetRow::from_row(row)
                    .map(|r| row_mapper::deployment_target_row_to_payload(&r))
                    .map_err(|e| DeploymentError::Repository(e.to_string()))
            })
            .collect::<Result<_, _>>()?;

        let total: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} WHERE {} = ? AND {} = 0 AND {} = ?",
            deployment_target::TABLE,
            deployment_target::PROJECT_ID,
            deployment_target::IS_DELETED,
            deployment_target::TENANT_ID,
        ))
        .bind(project_id)
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        Ok((items, total.max(0) as usize))
    }

    async fn find_release_by_id(
        &self,
        ctx: &DeploymentContext,
        id: &str,
    ) -> Result<Option<ReleasePayload>, DeploymentError> {
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0",
            release_record::TABLE,
            release_record::ID,
            release_record::IS_DELETED,
        );
        let tenant_id = append_required_tenant_filter(ctx, release_record::TENANT_ID, &mut sql)?;

        let row = sqlx::query(&sql)
            .bind(id)
            .bind(tenant_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;

        match row {
            Some(row) => {
                let r = ReleaseRecordRow::from_row(&row)
                    .map_err(|e| DeploymentError::Repository(e.to_string()))?;
                Ok(Some(row_mapper::release_record_row_to_payload(&r)))
            }
            None => Ok(None),
        }
    }

    async fn list_releases_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ReleasePayload>, usize), DeploymentError> {
        let tenant_id = require_scoped_tenant_id(&ctx.tenant_id).map_err(|_| {
            DeploymentError::Forbidden("A valid tenant scope is required.".to_owned())
        })?;
        // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL. Bind order:
        // project_id, tenant_id, limit, offset.
        let rows = sqlx::query(&format!(
            "SELECT r.* FROM {} r INNER JOIN {} d ON r.{} = d.{} WHERE d.{} = ? AND r.{} = 0 AND d.{} = 0 AND d.{} = ? ORDER BY r.{} DESC LIMIT ? OFFSET ?",
            release_record::TABLE,
            deployment_record::TABLE,
            release_record::ID,
            deployment_record::RELEASE_RECORD_ID,
            deployment_record::PROJECT_ID,
            release_record::IS_DELETED,
            deployment_record::IS_DELETED,
            deployment_record::TENANT_ID,
            release_record::ID,
        ))
        .bind(project_id)
        .bind(tenant_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;

        let items: Vec<ReleasePayload> = rows
            .iter()
            .map(|row| {
                ReleaseRecordRow::from_row(row)
                    .map(|r| row_mapper::release_record_row_to_payload(&r))
                    .map_err(|e| DeploymentError::Repository(e.to_string()))
            })
            .collect::<Result<_, _>>()?;

        let total: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} r INNER JOIN {} d ON r.{} = d.{} WHERE d.{} = ? AND r.{} = 0 AND d.{} = 0 AND d.{} = ?",
            release_record::TABLE,
            deployment_record::TABLE,
            release_record::ID,
            deployment_record::RELEASE_RECORD_ID,
            deployment_record::PROJECT_ID,
            release_record::IS_DELETED,
            deployment_record::IS_DELETED,
            deployment_record::TENANT_ID,
        ))
        .bind(project_id)
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        Ok((items, total.max(0) as usize))
    }

    async fn list_audit_logs(
        &self,
        ctx: &DeploymentContext,
        scope_type: &str,
        scope_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<AuditPayload>, usize), DeploymentError> {
        let tenant_id = require_scoped_tenant_id(&ctx.tenant_id).map_err(|_| {
            DeploymentError::Forbidden("A valid tenant scope is required.".to_owned())
        })?;
        // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
        let rows = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = ? AND {} = 0 AND {} = ? ORDER BY id DESC LIMIT ? OFFSET ?",
            audit_event::TABLE,
            audit_event::SCOPE_TYPE,
            audit_event::SCOPE_ID,
            audit_event::IS_DELETED,
            audit_event::TENANT_ID,
        ))
        .bind(scope_type)
        .bind(scope_id)
        .bind(tenant_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;

        let items: Vec<AuditPayload> = rows
            .iter()
            .map(|row| {
                AuditEventRow::from_row(row)
                    .map(|r| row_mapper::audit_event_row_to_payload(&r))
                    .map_err(|e| DeploymentError::Repository(e.to_string()))
            })
            .collect::<Result<_, _>>()?;

        let total: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} WHERE {} = ? AND {} = ? AND {} = 0 AND {} = ?",
            audit_event::TABLE,
            audit_event::SCOPE_TYPE,
            audit_event::SCOPE_ID,
            audit_event::IS_DELETED,
            audit_event::TENANT_ID,
        ))
        .bind(scope_type)
        .bind(scope_id)
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        Ok((items, total.max(0) as usize))
    }

    async fn list_policies(
        &self,
        ctx: &DeploymentContext,
        scope_type: &str,
        scope_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<PolicyPayload>, usize), DeploymentError> {
        let tenant_id = require_scoped_tenant_id(&ctx.tenant_id).map_err(|_| {
            DeploymentError::Forbidden("A valid tenant scope is required.".to_owned())
        })?;
        // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
        let rows = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = ? AND {} = 0 AND {} = ? ORDER BY id DESC LIMIT ? OFFSET ?",
            governance_policy::TABLE,
            governance_policy::SCOPE_TYPE,
            governance_policy::SCOPE_ID,
            governance_policy::IS_DELETED,
            governance_policy::TENANT_ID,
        ))
        .bind(scope_type)
        .bind(scope_id)
        .bind(tenant_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;

        let items: Vec<PolicyPayload> = rows
            .iter()
            .map(|row| {
                GovernancePolicyRow::from_row(row)
                    .map(|r| row_mapper::governance_policy_row_to_payload(&r))
                    .map_err(|e| DeploymentError::Repository(e.to_string()))
            })
            .collect::<Result<_, _>>()?;

        let total: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} WHERE {} = ? AND {} = ? AND {} = 0 AND {} = ?",
            governance_policy::TABLE,
            governance_policy::SCOPE_TYPE,
            governance_policy::SCOPE_ID,
            governance_policy::IS_DELETED,
            governance_policy::TENANT_ID,
        ))
        .bind(scope_type)
        .bind(scope_id)
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        Ok((items, total.max(0) as usize))
    }

    async fn list_deployments(
        &self,
        ctx: &DeploymentContext,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentPayload>, usize), DeploymentError> {
        let tenant_id = require_scoped_tenant_id(&ctx.tenant_id).map_err(|_| {
            DeploymentError::Forbidden("A valid tenant scope is required.".to_owned())
        })?;
        // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
        let rows = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = 0 AND {} = ? ORDER BY id DESC LIMIT ? OFFSET ?",
            deployment_record::TABLE,
            deployment_record::IS_DELETED,
            deployment_record::TENANT_ID,
        ))
        .bind(tenant_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;

        let items: Vec<DeploymentPayload> = rows
            .iter()
            .map(|row| {
                DeploymentRecordRow::from_row(row)
                    .map(|r| row_mapper::deployment_record_row_to_payload(&r))
                    .map_err(|e| DeploymentError::Repository(e.to_string()))
            })
            .collect::<Result<_, _>>()?;

        let total: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} WHERE {} = 0 AND {} = ?",
            deployment_record::TABLE,
            deployment_record::IS_DELETED,
            deployment_record::TENANT_ID,
        ))
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        Ok((items, total.max(0) as usize))
    }

    async fn list_deployment_targets(
        &self,
        ctx: &DeploymentContext,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<DeploymentTargetPayload>, usize), DeploymentError> {
        let tenant_id = require_scoped_tenant_id(&ctx.tenant_id).map_err(|_| {
            DeploymentError::Forbidden("A valid tenant scope is required.".to_owned())
        })?;
        // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
        let rows = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = 0 AND {} = ? ORDER BY id DESC LIMIT ? OFFSET ?",
            deployment_target::TABLE,
            deployment_target::IS_DELETED,
            deployment_target::TENANT_ID,
        ))
        .bind(tenant_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;

        let items: Vec<DeploymentTargetPayload> = rows
            .iter()
            .map(|row| {
                DeploymentTargetRow::from_row(row)
                    .map(|r| row_mapper::deployment_target_row_to_payload(&r))
                    .map_err(|e| DeploymentError::Repository(e.to_string()))
            })
            .collect::<Result<_, _>>()?;

        let total: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} WHERE {} = 0 AND {} = ?",
            deployment_target::TABLE,
            deployment_target::IS_DELETED,
            deployment_target::TENANT_ID,
        ))
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        Ok((items, total.max(0) as usize))
    }

    async fn list_releases(
        &self,
        ctx: &DeploymentContext,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ReleasePayload>, usize), DeploymentError> {
        let tenant_id = require_scoped_tenant_id(&ctx.tenant_id).map_err(|_| {
            DeploymentError::Forbidden("A valid tenant scope is required.".to_owned())
        })?;
        // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
        let rows = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = 0 AND {} = ? ORDER BY id DESC LIMIT ? OFFSET ?",
            release_record::TABLE,
            release_record::IS_DELETED,
            release_record::TENANT_ID,
        ))
        .bind(tenant_id)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;

        let items: Vec<ReleasePayload> = rows
            .iter()
            .map(|row| {
                ReleaseRecordRow::from_row(row)
                    .map(|r| row_mapper::release_record_row_to_payload(&r))
                    .map_err(|e| DeploymentError::Repository(e.to_string()))
            })
            .collect::<Result<_, _>>()?;

        let total: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} WHERE {} = 0 AND {} = ?",
            release_record::TABLE,
            release_record::IS_DELETED,
            release_record::TENANT_ID,
        ))
        .bind(tenant_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        Ok((items, total.max(0) as usize))
    }

    async fn create_deployment_target(
        &self,
        _ctx: &DeploymentContext,
        _target: &DeploymentTargetPayload,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn create_release(
        &self,
        _ctx: &DeploymentContext,
        _release: &ReleasePayload,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn create_deployment(
        &self,
        _ctx: &DeploymentContext,
        _deployment: &DeploymentPayload,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn create_audit_event(
        &self,
        _ctx: &DeploymentContext,
        _event: &AuditPayload,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }
}
