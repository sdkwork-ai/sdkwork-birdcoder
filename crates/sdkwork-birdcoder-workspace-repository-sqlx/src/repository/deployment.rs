use sdkwork_birdcoder_deployment_service::context::DeploymentContext;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use crate::db::columns::audit_event;
use crate::db::columns::deployment_record;
use crate::db::columns::deployment_target;
use crate::db::columns::governance_policy;
use crate::db::columns::release_record;
use crate::db::rows::{AuditEventRow, DeploymentRecordRow, DeploymentTargetRow, GovernancePolicyRow, ReleaseRecordRow};
use crate::mapper::row_mapper;
use sdkwork_birdcoder_deployment_service::domain::results::{
    AuditPayload, DeploymentPayload, DeploymentTargetPayload, PolicyPayload, ReleasePayload,
};
use sdkwork_birdcoder_deployment_service::error::DeploymentError;

pub struct SqliteDeploymentRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteDeploymentRepository {
    pub fn new(conn: Connection) -> Self {
        Self {
            conn: Arc::new(Mutex::new(conn)),
        }
    }

    pub fn with_shared(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }
}

fn append_tenant_filter(
    ctx: &DeploymentContext,
    tenant_column: &str,
    sql: &mut String,
    params: &mut Vec<Box<dyn rusqlite::types::ToSql>>,
) {
    if let Some(tenant_id) = ctx.tenant_id.parse::<i64>().ok().filter(|id| *id > 0) {
        sql.push_str(&format!(" AND {tenant_column} = ?{}", params.len() + 1));
        params.push(Box::new(tenant_id));
    }
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
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
            deployment_record::TABLE,
            deployment_record::ID,
            deployment_record::IS_DELETED,
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(id.to_string())];
        append_tenant_filter(ctx, deployment_record::TENANT_ID, &mut sql, &mut params);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let row = stmt
            .query_row(params_ref.as_slice(), |r| Ok(DeploymentRecordRow::from_row(r)))
            .optional()
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        match row {
            Some(Ok(r)) => Ok(Some(row_mapper::deployment_record_row_to_payload(&r))),
            Some(Err(e)) => Err(DeploymentError::Repository(e.to_string())),
            None => Ok(None),
        }
    }

    async fn list_deployments_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
    ) -> Result<Vec<DeploymentPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
            deployment_record::TABLE,
            deployment_record::PROJECT_ID,
            deployment_record::IS_DELETED,
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(project_id.to_string())];
        append_tenant_filter(ctx, deployment_record::TENANT_ID, &mut sql, &mut params);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let rows = stmt
            .query_map(params_ref.as_slice(), |r| {
                Ok(DeploymentRecordRow::from_row(r))
            })
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| DeploymentError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::deployment_record_row_to_payload(&r)),
                Err(e) => return Err(DeploymentError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    async fn find_deployment_target_by_id(
        &self,
        ctx: &DeploymentContext,
        id: &str,
    ) -> Result<Option<DeploymentTargetPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
            deployment_target::TABLE,
            deployment_target::ID,
            deployment_target::IS_DELETED,
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(id.to_string())];
        append_tenant_filter(ctx, deployment_target::TENANT_ID, &mut sql, &mut params);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let row = stmt
            .query_row(params_ref.as_slice(), |r| Ok(DeploymentTargetRow::from_row(r)))
            .optional()
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        match row {
            Some(Ok(r)) => Ok(Some(row_mapper::deployment_target_row_to_payload(&r))),
            Some(Err(e)) => Err(DeploymentError::Repository(e.to_string())),
            None => Ok(None),
        }
    }

    async fn list_deployment_targets_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
    ) -> Result<Vec<DeploymentTargetPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
            deployment_target::TABLE,
            deployment_target::PROJECT_ID,
            deployment_target::IS_DELETED,
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(project_id.to_string())];
        append_tenant_filter(ctx, deployment_target::TENANT_ID, &mut sql, &mut params);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let rows = stmt
            .query_map(params_ref.as_slice(), |r| {
                Ok(DeploymentTargetRow::from_row(r))
            })
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| DeploymentError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::deployment_target_row_to_payload(&r)),
                Err(e) => return Err(DeploymentError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    async fn find_release_by_id(
        &self,
        ctx: &DeploymentContext,
        id: &str,
    ) -> Result<Option<ReleasePayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
            release_record::TABLE,
            release_record::ID,
            release_record::IS_DELETED,
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(id.to_string())];
        append_tenant_filter(ctx, release_record::TENANT_ID, &mut sql, &mut params);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let row = stmt
            .query_row(params_ref.as_slice(), |r| Ok(ReleaseRecordRow::from_row(r)))
            .optional()
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        match row {
            Some(Ok(r)) => Ok(Some(row_mapper::release_record_row_to_payload(&r))),
            Some(Err(e)) => Err(DeploymentError::Repository(e.to_string())),
            None => Ok(None),
        }
    }

    async fn list_releases_by_project(
        &self,
        ctx: &DeploymentContext,
        project_id: &str,
    ) -> Result<Vec<ReleasePayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT r.* FROM {} r INNER JOIN {} d ON r.{} = d.{} WHERE d.{} = ?1 AND r.{} = 0 AND d.{} = 0",
            release_record::TABLE,
            deployment_record::TABLE,
            release_record::ID,
            deployment_record::RELEASE_RECORD_ID,
            deployment_record::PROJECT_ID,
            release_record::IS_DELETED,
            deployment_record::IS_DELETED,
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(project_id.to_string())];
        append_tenant_filter(ctx, &format!("d.{}", deployment_record::TENANT_ID), &mut sql, &mut params);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let rows = stmt
            .query_map(params_ref.as_slice(), |r| {
                Ok(ReleaseRecordRow::from_row(r))
            })
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| DeploymentError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::release_record_row_to_payload(&r)),
                Err(e) => return Err(DeploymentError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    async fn list_audit_logs(
        &self,
        ctx: &DeploymentContext,
        scope_type: &str,
        scope_id: &str,
    ) -> Result<Vec<AuditPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ?1 AND {} = ?2 AND {} = 0",
            audit_event::TABLE,
            audit_event::SCOPE_TYPE,
            audit_event::SCOPE_ID,
            audit_event::IS_DELETED,
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
            Box::new(scope_type.to_string()),
            Box::new(scope_id.to_string()),
        ];
        append_tenant_filter(ctx, audit_event::TENANT_ID, &mut sql, &mut params);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let rows = stmt
            .query_map(params_ref.as_slice(), |r| {
                Ok(AuditEventRow::from_row(r))
            })
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| DeploymentError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::audit_event_row_to_payload(&r)),
                Err(e) => return Err(DeploymentError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    async fn list_policies(
        &self,
        ctx: &DeploymentContext,
        scope_type: &str,
        scope_id: &str,
    ) -> Result<Vec<PolicyPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ?1 AND {} = ?2 AND {} = 0",
            governance_policy::TABLE,
            governance_policy::SCOPE_TYPE,
            governance_policy::SCOPE_ID,
            governance_policy::IS_DELETED,
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
            Box::new(scope_type.to_string()),
            Box::new(scope_id.to_string()),
        ];
        append_tenant_filter(ctx, governance_policy::TENANT_ID, &mut sql, &mut params);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let rows = stmt
            .query_map(params_ref.as_slice(), |r| {
                Ok(GovernancePolicyRow::from_row(r))
            })
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| DeploymentError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::governance_policy_row_to_payload(&r)),
                Err(e) => return Err(DeploymentError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    async fn list_deployments(
        &self,
        ctx: &DeploymentContext,
    ) -> Result<Vec<DeploymentPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = 0",
            deployment_record::TABLE,
            deployment_record::IS_DELETED,
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        append_tenant_filter(ctx, deployment_record::TENANT_ID, &mut sql, &mut params);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let rows = stmt
            .query_map(params_ref.as_slice(), |r| Ok(DeploymentRecordRow::from_row(r)))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| DeploymentError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::deployment_record_row_to_payload(&r)),
                Err(e) => return Err(DeploymentError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    async fn list_deployment_targets(
        &self,
        ctx: &DeploymentContext,
    ) -> Result<Vec<DeploymentTargetPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = 0",
            deployment_target::TABLE,
            deployment_target::IS_DELETED,
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        append_tenant_filter(ctx, deployment_target::TENANT_ID, &mut sql, &mut params);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let rows = stmt
            .query_map(params_ref.as_slice(), |r| Ok(DeploymentTargetRow::from_row(r)))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| DeploymentError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::deployment_target_row_to_payload(&r)),
                Err(e) => return Err(DeploymentError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    async fn list_releases(
        &self,
        ctx: &DeploymentContext,
    ) -> Result<Vec<ReleasePayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = 0",
            release_record::TABLE,
            release_record::IS_DELETED,
        );
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        append_tenant_filter(ctx, release_record::TENANT_ID, &mut sql, &mut params);
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let params_ref: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|param| param.as_ref()).collect();
        let rows = stmt
            .query_map(params_ref.as_slice(), |r| Ok(ReleaseRecordRow::from_row(r)))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| DeploymentError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::release_record_row_to_payload(&r)),
                Err(e) => return Err(DeploymentError::Repository(e.to_string())),
            }
        }
        Ok(result)
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

use rusqlite::OptionalExtension;
