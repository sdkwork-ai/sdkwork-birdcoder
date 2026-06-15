use std::sync::Mutex;

use rusqlite::{params, Connection};

use crate::db::columns::audit_event;
use crate::db::columns::deployment_record;
use crate::db::columns::deployment_target;
use crate::db::columns::governance_policy;
use crate::db::columns::release_record;
use crate::db::rows::{AuditEventRow, DeploymentRecordRow, DeploymentTargetRow, GovernancePolicyRow, ReleaseRecordRow};
use crate::mapper::row_mapper;
use sdkwork_birdcoder_deployment_service::context::SessionContext;
use sdkwork_birdcoder_deployment_service::domain::results::{
    AuditPayload, DeploymentPayload, DeploymentTargetPayload, PolicyPayload, ReleasePayload,
};
use sdkwork_birdcoder_deployment_service::error::DeploymentError;

pub struct SqliteDeploymentRepository {
    conn: Mutex<Connection>,
}

impl SqliteDeploymentRepository {
    pub fn new(conn: Connection) -> Self {
        Self {
            conn: Mutex::new(conn),
        }
    }
}

#[async_trait::async_trait]
impl sdkwork_birdcoder_deployment_service::ports::repository::DeploymentRepository
    for SqliteDeploymentRepository
{
    async fn find_deployment_by_id(
        &self,
        _ctx: &SessionContext,
        id: &str,
    ) -> Result<Option<DeploymentPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                deployment_record::TABLE,
                deployment_record::ID,
                deployment_record::IS_DELETED,
            ))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let row = stmt
            .query_row(params![id], |r| Ok(DeploymentRecordRow::from_row(r)))
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
        _ctx: &SessionContext,
        project_id: &str,
    ) -> Result<Vec<DeploymentPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                deployment_record::TABLE,
                deployment_record::PROJECT_ID,
                deployment_record::IS_DELETED,
            ))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map(params![project_id], |r| {
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
        _ctx: &SessionContext,
        id: &str,
    ) -> Result<Option<DeploymentTargetPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                deployment_target::TABLE,
                deployment_target::ID,
                deployment_target::IS_DELETED,
            ))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let row = stmt
            .query_row(params![id], |r| Ok(DeploymentTargetRow::from_row(r)))
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
        _ctx: &SessionContext,
        project_id: &str,
    ) -> Result<Vec<DeploymentTargetPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                deployment_target::TABLE,
                deployment_target::PROJECT_ID,
                deployment_target::IS_DELETED,
            ))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map(params![project_id], |r| {
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
        _ctx: &SessionContext,
        id: &str,
    ) -> Result<Option<ReleasePayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                release_record::TABLE,
                release_record::ID,
                release_record::IS_DELETED,
            ))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let row = stmt
            .query_row(params![id], |r| Ok(ReleaseRecordRow::from_row(r)))
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
        _ctx: &SessionContext,
        project_id: &str,
    ) -> Result<Vec<ReleasePayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT r.* FROM {} r INNER JOIN {} d ON r.{} = d.{} WHERE d.{} = ?1 AND r.{} = 0 AND d.{} = 0",
                release_record::TABLE,
                deployment_record::TABLE,
                release_record::ID,
                deployment_record::RELEASE_RECORD_ID,
                deployment_record::PROJECT_ID,
                release_record::IS_DELETED,
                deployment_record::IS_DELETED,
            ))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map(params![project_id], |r| {
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
        _ctx: &SessionContext,
        scope_type: &str,
        scope_id: &str,
    ) -> Result<Vec<AuditPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = ?2 AND {} = 0",
                audit_event::TABLE,
                audit_event::SCOPE_TYPE,
                audit_event::SCOPE_ID,
                audit_event::IS_DELETED,
            ))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map(params![scope_type, scope_id], |r| {
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
        _ctx: &SessionContext,
        scope_type: &str,
        scope_id: &str,
    ) -> Result<Vec<PolicyPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = ?2 AND {} = 0",
                governance_policy::TABLE,
                governance_policy::SCOPE_TYPE,
                governance_policy::SCOPE_ID,
                governance_policy::IS_DELETED,
            ))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map(params![scope_type, scope_id], |r| {
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
        ctx: &SessionContext,
    ) -> Result<Vec<DeploymentPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = 0",
                deployment_record::TABLE,
                deployment_record::IS_DELETED,
            ))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map([], |r| Ok(DeploymentRecordRow::from_row(r)))
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
        ctx: &SessionContext,
    ) -> Result<Vec<DeploymentTargetPayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = 0",
                deployment_target::TABLE,
                deployment_target::IS_DELETED,
            ))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map([], |r| Ok(DeploymentTargetRow::from_row(r)))
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
        ctx: &SessionContext,
    ) -> Result<Vec<ReleasePayload>, DeploymentError> {
        let conn = self.conn.lock().map_err(|e| {
            DeploymentError::Repository(format!("lock error: {e}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = 0",
                release_record::TABLE,
                release_record::IS_DELETED,
            ))
            .map_err(|e| DeploymentError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map([], |r| Ok(ReleaseRecordRow::from_row(r)))
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
        _ctx: &SessionContext,
        _target: &DeploymentTargetPayload,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn create_release(
        &self,
        _ctx: &SessionContext,
        _release: &ReleasePayload,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn create_deployment(
        &self,
        _ctx: &SessionContext,
        _deployment: &DeploymentPayload,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }

    async fn create_audit_event(
        &self,
        _ctx: &SessionContext,
        _event: &AuditPayload,
    ) -> Result<(), DeploymentError> {
        Ok(())
    }
}

use rusqlite::OptionalExtension;

