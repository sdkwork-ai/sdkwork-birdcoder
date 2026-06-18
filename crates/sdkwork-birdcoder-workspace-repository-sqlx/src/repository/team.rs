use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::db::columns::team as col;
use crate::db::columns::team_member as member_col;
use crate::db::rows::{TeamMemberRow, TeamRow};
use crate::mapper::row_mapper;
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_birdcoder_workspace_service::domain::results::{TeamMemberPayload, TeamPayload};
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;

pub struct SqliteTeamRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteTeamRepository {
    pub fn new(conn: Connection) -> Self {
        Self {
            conn: Arc::new(Mutex::new(conn)),
        }
    }

    pub fn with_shared(conn: Arc<Mutex<Connection>>) -> Self {
        Self { conn }
    }

    fn now_iso() -> String {
        time::OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
    }

    pub fn find_team_by_id(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
    ) -> Result<Option<TeamPayload>, WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let id_num: i64 = id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid id: {id}"))
        })?;
        let tenant_id = ctx.tenant_id.parse::<i64>().ok().filter(|value| *value > 0);
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
            col::TABLE,
            col::ID,
            col::IS_DELETED,
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(id_num)];
        if let Some(tenant_id) = tenant_id {
            sql += &format!(" AND {} = ?2", col::TENANT_ID);
            param_values.push(Box::new(tenant_id));
        }
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();
        let row = stmt
            .query_row(params_refs.as_slice(), |r| Ok(TeamRow::from_row(r)))
            .optional()
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        match row {
            Some(Ok(r)) => Ok(Some(row_mapper::team_row_to_payload(&r))),
            Some(Err(e)) => Err(WorkspaceError::Repository(e.to_string())),
            None => Ok(None),
        }
    }

    pub fn list_teams_by_workspace(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<Vec<TeamPayload>, WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let wid: i64 = workspace_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
        })?;
        let tenant_id = ctx.tenant_id.parse::<i64>().ok().filter(|value| *value > 0);
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
            col::TABLE,
            col::WORKSPACE_ID,
            col::IS_DELETED,
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(wid)];
        if let Some(tenant_id) = tenant_id {
            sql += &format!(" AND {} = ?2", col::TENANT_ID);
            param_values.push(Box::new(tenant_id));
        }
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();
        let rows = stmt
            .query_map(params_refs.as_slice(), |r| Ok(TeamRow::from_row(r)))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| WorkspaceError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::team_row_to_payload(&r)),
                Err(e) => return Err(WorkspaceError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    pub fn create_team(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        name: &str,
        description: Option<&str>,
    ) -> Result<TeamPayload, WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let now = Self::now_iso();
        let uuid = Uuid::new_v4().to_string();
        let tenant_id: i64 = ctx.tenant_id.parse().unwrap_or(0);
        let wid: i64 = workspace_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
        })?;
        let owner_id: i64 = ctx.user_id.parse().unwrap_or(0);

        conn.execute(
            &format!(
                "INSERT INTO {t} (uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, workspace_id, name, description, owner_id, status) VALUES (?1,?2,?3,?4,?4,?5,?6,?7,?8,?9,?10,?11)",
                t = col::TABLE,
            ),
            params![
                uuid,
                tenant_id,
                0i64,
                now,
                0i64,
                0i64,
                wid,
                name,
                description,
                owner_id,
                "active",
            ],
        )
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        let id = conn.last_insert_rowid();
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1",
                col::TABLE,
                col::ID,
            ))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let row = stmt
            .query_row(params![id], |r| Ok(TeamRow::from_row(r)))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        match row {
            Ok(r) => Ok(row_mapper::team_row_to_payload(&r)),
            Err(e) => Err(WorkspaceError::Repository(e.to_string())),
        }
    }

    pub fn delete_team(
        &self,
        _ctx: &WorkspaceContext,
        id: &str,
    ) -> Result<(), WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let id_num: i64 = id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid id: {id}"))
        })?;
        let now = Self::now_iso();
        conn.execute(
            &format!(
                "UPDATE {} SET {} = 1, {} = ?1 WHERE {} = ?2",
                col::TABLE,
                col::IS_DELETED,
                col::UPDATED_AT,
                col::ID,
            ),
            params![now, id_num],
        )
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        Ok(())
    }

    pub fn list_team_members(
        &self,
        _ctx: &WorkspaceContext,
        team_id: &str,
    ) -> Result<Vec<TeamMemberPayload>, WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let tid: i64 = team_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid team_id: {team_id}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                member_col::TABLE,
                member_col::TEAM_ID,
                member_col::IS_DELETED,
            ))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map(params![tid], |r| Ok(TeamMemberRow::from_row(r)))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| WorkspaceError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::team_member_row_to_payload(&r)),
                Err(e) => return Err(WorkspaceError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    pub fn add_team_member(
        &self,
        ctx: &WorkspaceContext,
        team_id: &str,
        user_id: &str,
        role: &str,
    ) -> Result<TeamMemberPayload, WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let tid: i64 = team_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid team_id: {team_id}"))
        })?;
        let uid: i64 = user_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid user_id: {user_id}"))
        })?;
        let now = Self::now_iso();
        let uuid = Uuid::new_v4().to_string();
        let tenant_id: i64 = ctx.tenant_id.parse().unwrap_or(0);
        let created_by: i64 = ctx.user_id.parse().unwrap_or(0);

        conn.execute(
            &format!(
                "INSERT INTO {t} (uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, team_id, user_id, role, created_by_user_id, status) VALUES (?1,?2,?3,?4,?4,?5,?6,?7,?8,?9,?10,?11)",
                t = member_col::TABLE,
            ),
            params![
                uuid,
                tenant_id,
                0i64,
                now,
                0i64,
                0i64,
                tid,
                uid,
                role,
                created_by,
                "active",
            ],
        )
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        let new_id = conn.last_insert_rowid();
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1",
                member_col::TABLE,
                member_col::ID,
            ))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let row = stmt
            .query_row(params![new_id], |r| Ok(TeamMemberRow::from_row(r)))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        match row {
            Ok(r) => Ok(row_mapper::team_member_row_to_payload(&r)),
            Err(e) => Err(WorkspaceError::Repository(e.to_string())),
        }
    }

    pub fn remove_team_member(
        &self,
        _ctx: &WorkspaceContext,
        team_id: &str,
        user_id: &str,
    ) -> Result<(), WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let tid: i64 = team_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid team_id: {team_id}"))
        })?;
        let uid: i64 = user_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid user_id: {user_id}"))
        })?;
        let now = Self::now_iso();
        conn.execute(
            &format!(
                "UPDATE {} SET {} = 1, {} = ?1 WHERE {} = ?2 AND {} = ?3",
                member_col::TABLE,
                member_col::IS_DELETED,
                member_col::UPDATED_AT,
                member_col::TEAM_ID,
                member_col::USER_ID,
            ),
            params![now, tid, uid],
        )
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        Ok(())
    }
}

use rusqlite::OptionalExtension;
