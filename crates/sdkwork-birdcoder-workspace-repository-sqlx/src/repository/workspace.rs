use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::db::columns::workspace as col;
use crate::db::columns::workspace_member as member_col;
use crate::db::rows::{WorkspaceMemberRow, WorkspaceRow};
use crate::mapper::row_mapper;
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_birdcoder_workspace_service::domain::commands::{
    CreateWorkspaceRequest, UpdateWorkspaceRequest, UpsertWorkspaceMemberRequest,
};
use sdkwork_birdcoder_workspace_service::domain::models::WorkspaceScopedQuery;
use sdkwork_birdcoder_workspace_service::domain::results::{WorkspaceMemberPayload, WorkspacePayload};
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;

pub struct SqliteWorkspaceRepository {
    conn: Arc<Mutex<Connection>>,
}

impl SqliteWorkspaceRepository {
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
}

#[async_trait::async_trait]
impl sdkwork_birdcoder_workspace_service::ports::repository::WorkspaceRepository
    for SqliteWorkspaceRepository
{
    async fn find_workspace_by_id(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
    ) -> Result<Option<WorkspacePayload>, WorkspaceError> {
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
            .query_row(params_refs.as_slice(), |r| Ok(WorkspaceRow::from_row(r)))
            .optional()
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        match row {
            Some(Ok(r)) => Ok(Some(row_mapper::workspace_row_to_payload(&r))),
            Some(Err(e)) => Err(WorkspaceError::Repository(e.to_string())),
            None => Ok(None),
        }
    }

    async fn list_workspaces(
        &self,
        ctx: &WorkspaceContext,
        query: &WorkspaceScopedQuery,
    ) -> Result<Vec<WorkspacePayload>, WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = 0",
            col::TABLE,
            col::IS_DELETED,
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        if let Ok(tenant_id) = ctx.tenant_id.parse::<i64>() {
            if tenant_id > 0 {
                sql += &format!(" AND {} = ?{}", col::TENANT_ID, param_values.len() + 1);
                param_values.push(Box::new(tenant_id));
            }
        }
        if let Some(ref uid) = query.user_id {
            sql += &format!(" AND {} = ?{}", col::OWNER_ID, param_values.len() + 1);
            param_values.push(Box::new(uid.clone()));
        }
        if let Some(ref wid) = query.workspace_id {
            sql += &format!(" AND {} = ?{}", col::ID, param_values.len() + 1);
            param_values.push(Box::new(wid.clone()));
        }
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();
        let rows = stmt
            .query_map(params_refs.as_slice(), |r| Ok(WorkspaceRow::from_row(r)))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| WorkspaceError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::workspace_row_to_payload(&r)),
                Err(e) => return Err(WorkspaceError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    async fn create_workspace(
        &self,
        ctx: &WorkspaceContext,
        req: &CreateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let now = Self::now_iso();
        let uuid = Uuid::new_v4().to_string();
        let tenant_id: i64 = req
            .tenant_id
            .as_deref()
            .unwrap_or(&ctx.tenant_id)
            .parse()
            .unwrap_or(0);
        let organization_id: i64 = req
            .organization_id
            .as_deref()
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);
        let data_scope: i64 = req
            .data_scope
            .as_deref()
            .unwrap_or("1")
            .parse()
            .unwrap_or(1);
        let owner_id: i64 = req
            .owner_id
            .as_deref()
            .unwrap_or(&ctx.user_id)
            .parse()
            .unwrap_or(0);
        let settings_json = req
            .settings
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());

        conn.execute(
            &format!(
                "INSERT INTO {t} (uuid, tenant_id, organization_id, data_scope, created_at, updated_at, version, is_deleted, name, code, title, description, owner_id, leader_id, created_by_user_id, icon, color, type, start_time, end_time, max_members, settings_json, is_public, is_template, status) VALUES (?1,?2,?3,?4,?5,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24)",
                t = col::TABLE,
            ),
            params![
                uuid,
                tenant_id,
                organization_id,
                data_scope,
                now,
                0i64,
                0i64,
                req.name,
                req.code,
                req.title,
                req.description,
                owner_id,
                req.leader_id.as_deref().and_then(|s| s.parse::<i64>().ok()),
                req.created_by_user_id.as_deref().and_then(|s| s.parse::<i64>().ok()),
                req.icon,
                req.color,
                req.entity_type,
                req.start_time,
                req.end_time,
                req.max_members,
                settings_json,
                req.is_public.map(|b| if b { 1i64 } else { 0 }),
                req.is_template.map(|b| if b { 1i64 } else { 0 }),
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
            .query_row(params![id], |r| Ok(WorkspaceRow::from_row(r)))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        match row {
            Ok(r) => Ok(row_mapper::workspace_row_to_payload(&r)),
            Err(e) => Err(WorkspaceError::Repository(e.to_string())),
        }
    }

    async fn update_workspace(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
        req: &UpdateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let id_num: i64 = id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid id: {id}"))
        })?;
        let tenant_id = ctx.tenant_id.parse::<i64>().ok().filter(|value| *value > 0);
        let now = Self::now_iso();
        let mut sets = vec![format!("{} = ?1", col::UPDATED_AT)];
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(now)];
        let mut idx = 2;

        macro_rules! add_opt {
            ($field:expr, $col:expr) => {
                if let Some(ref v) = $field {
                    sets.push(format!("{} = ?{}", $col, idx));
                    param_values.push(Box::new(v.clone()));
                    idx += 1;
                }
            };
        }
        macro_rules! add_opt_i64 {
            ($field:expr, $col:expr) => {
                if let Some(v) = $field {
                    sets.push(format!("{} = ?{}", $col, idx));
                    param_values.push(Box::new(v));
                    idx += 1;
                }
            };
        }
        macro_rules! add_opt_bool {
            ($field:expr, $col:expr) => {
                if let Some(v) = $field {
                    sets.push(format!("{} = ?{}", $col, idx));
                    param_values.push(Box::new(if v { 1i64 } else { 0i64 }));
                    idx += 1;
                }
            };
        }

        add_opt!(req.name, col::NAME);
        add_opt!(req.description, col::DESCRIPTION);
        add_opt!(req.code, col::CODE);
        add_opt!(req.title, col::TITLE);
        add_opt!(req.icon, col::ICON);
        add_opt!(req.color, col::COLOR);
        add_opt!(req.entity_type, col::TYPE);
        add_opt!(req.start_time, col::START_TIME);
        add_opt!(req.end_time, col::END_TIME);
        add_opt_i64!(req.max_members, col::MAX_MEMBERS);
        add_opt_i64!(req.current_members, col::CURRENT_MEMBERS);
        add_opt_i64!(req.member_count, col::MEMBER_COUNT);
        add_opt!(req.status, col::STATUS);
        add_opt_bool!(req.is_public, col::IS_PUBLIC);
        add_opt_bool!(req.is_template, col::IS_TEMPLATE);

        if let Some(ref settings) = req.settings {
            if let Ok(json) = serde_json::to_string(settings) {
                sets.push(format!("{} = ?{}", col::SETTINGS_JSON, idx));
                param_values.push(Box::new(json));
                idx += 1;
            }
        }
        if let Some(ref v) = req.data_scope {
            if let Ok(n) = v.parse::<i64>() {
                sets.push(format!("{} = ?{}", col::DATA_SCOPE, idx));
                param_values.push(Box::new(n));
                idx += 1;
            }
        }
        if let Some(ref v) = req.owner_id {
            if let Ok(n) = v.parse::<i64>() {
                sets.push(format!("{} = ?{}", col::OWNER_ID, idx));
                param_values.push(Box::new(n));
                idx += 1;
            }
        }
        if let Some(ref v) = req.leader_id {
            if let Ok(n) = v.parse::<i64>() {
                sets.push(format!("{} = ?{}", col::LEADER_ID, idx));
                param_values.push(Box::new(n));
                idx += 1;
            }
        }

        let sql = format!(
            "UPDATE {} SET {} WHERE {} = ?{}{}",
            col::TABLE,
            sets.join(", "),
            col::ID,
            idx,
            tenant_id
                .map(|_value| format!(" AND {} = ?{}", col::TENANT_ID, idx + 1))
                .unwrap_or_default(),
        );
        param_values.push(Box::new(id_num));
        if let Some(tenant_id) = tenant_id {
            param_values.push(Box::new(tenant_id));
        }
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();
        let updated = conn
            .execute(&sql, params_refs.as_slice())
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        if updated == 0 {
            return Err(WorkspaceError::NotFound(format!("workspace {id} not found")));
        }

        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1",
                col::TABLE,
                col::ID,
            ))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let row = stmt
            .query_row(params![id_num], |r| Ok(WorkspaceRow::from_row(r)))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        match row {
            Ok(r) => Ok(row_mapper::workspace_row_to_payload(&r)),
            Err(e) => Err(WorkspaceError::Repository(e.to_string())),
        }
    }

    async fn delete_workspace(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
    ) -> Result<(), WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let id_num: i64 = id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid id: {id}"))
        })?;
        let tenant_id = ctx.tenant_id.parse::<i64>().ok().filter(|value| *value > 0);
        let now = Self::now_iso();
        let mut sql = format!(
            "UPDATE {} SET {} = 1, {} = ?1 WHERE {} = ?2",
            col::TABLE,
            col::IS_DELETED,
            col::UPDATED_AT,
            col::ID,
        );
        let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> =
            vec![Box::new(now), Box::new(id_num)];
        if let Some(tenant_id) = tenant_id {
            sql.push_str(&format!(" AND {} = ?3", col::TENANT_ID));
            param_values.push(Box::new(tenant_id));
        }
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();
        let updated = conn
            .execute(&sql, params_refs.as_slice())
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        if updated == 0 {
            return Err(WorkspaceError::NotFound(format!("workspace {id} not found")));
        }
        Ok(())
    }

    async fn list_workspace_members(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<Vec<WorkspaceMemberPayload>, WorkspaceError> {
        if self
            .find_workspace_by_id(ctx, workspace_id)
            .await?
            .is_none()
        {
            return Err(WorkspaceError::NotFound(format!(
                "workspace {workspace_id} not found"
            )));
        }
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let wid: i64 = workspace_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                member_col::TABLE,
                member_col::WORKSPACE_ID,
                member_col::IS_DELETED,
            ))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map(params![wid], |r| Ok(WorkspaceMemberRow::from_row(r)))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| WorkspaceError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::workspace_member_row_to_payload(&r)),
                Err(e) => return Err(WorkspaceError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    async fn upsert_workspace_member(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        req: &UpsertWorkspaceMemberRequest,
    ) -> Result<WorkspaceMemberPayload, WorkspaceError> {
        if self
            .find_workspace_by_id(ctx, workspace_id)
            .await?
            .is_none()
        {
            return Err(WorkspaceError::NotFound(format!(
                "workspace {workspace_id} not found"
            )));
        }
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let wid: i64 = workspace_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
        })?;
        let uid: i64 = req
            .user_id
            .as_deref()
            .unwrap_or(&ctx.user_id)
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput("invalid user_id".into()))?;
        let now = Self::now_iso();
        let uuid = Uuid::new_v4().to_string();
        let tenant_id: i64 = ctx.tenant_id.parse().unwrap_or(0);
        let role = req.role.as_deref().unwrap_or("member");
        let status = req.status.as_deref().unwrap_or("active");

        let existing = conn
            .prepare(&format!(
                "SELECT {} FROM {} WHERE {} = ?1 AND {} = ?2 AND {} = 0",
                member_col::ID,
                member_col::TABLE,
                member_col::WORKSPACE_ID,
                member_col::USER_ID,
                member_col::IS_DELETED,
            ))
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?
            .query_row(params![wid, uid], |r| r.get::<_, i64>(0))
            .ok();

        if let Some(existing_id) = existing {
            conn.execute(
                &format!(
                    "UPDATE {} SET {} = ?1, {} = ?2, {} = ?3 WHERE {} = ?4",
                    member_col::TABLE,
                    member_col::ROLE,
                    member_col::STATUS,
                    member_col::UPDATED_AT,
                    member_col::ID,
                ),
                params![role, status, now, existing_id],
            )
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
            let mut stmt = conn
                .prepare(&format!(
                    "SELECT * FROM {} WHERE {} = ?1",
                    member_col::TABLE,
                    member_col::ID,
                ))
                .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
            let row = stmt
                .query_row(params![existing_id], |r| {
                    Ok(WorkspaceMemberRow::from_row(r))
                })
                .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
            match row {
                Ok(r) => Ok(row_mapper::workspace_member_row_to_payload(&r)),
                Err(e) => Err(WorkspaceError::Repository(e.to_string())),
            }
        } else {
            conn.execute(
                &format!(
                    "INSERT INTO {t} (uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, workspace_id, user_id, team_id, role, created_by_user_id, granted_by_user_id, status) VALUES (?1,?2,?3,?4,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13)",
                    t = member_col::TABLE,
                ),
                params![
                    uuid,
                    tenant_id,
                    0i64,
                    now,
                    0i64,
                    0i64,
                    wid,
                    uid,
                    req.team_id.as_deref().and_then(|s| s.parse::<i64>().ok()),
                    role,
                    req.created_by_user_id.as_deref().and_then(|s| s.parse::<i64>().ok()),
                    req.granted_by_user_id.as_deref().and_then(|s| s.parse::<i64>().ok()),
                    status,
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
                .query_row(params![new_id], |r| Ok(WorkspaceMemberRow::from_row(r)))
                .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
            match row {
                Ok(r) => Ok(row_mapper::workspace_member_row_to_payload(&r)),
                Err(e) => Err(WorkspaceError::Repository(e.to_string())),
            }
        }
    }

    async fn remove_workspace_member(
        &self,
        _ctx: &WorkspaceContext,
        workspace_id: &str,
        user_id: &str,
    ) -> Result<(), WorkspaceError> {
        let conn = self.conn.lock().map_err(|e| {
            WorkspaceError::Repository(format!("lock error: {e}"))
        })?;
        let wid: i64 = workspace_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
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
                member_col::WORKSPACE_ID,
                member_col::USER_ID,
            ),
            params![now, wid, uid],
        )
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        Ok(())
    }
}

use rusqlite::OptionalExtension;
