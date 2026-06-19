use sqlx::{QueryBuilder, Sqlite, SqlitePool};
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

#[derive(Clone)]
pub struct SqliteWorkspaceRepository {
    pool: SqlitePool,
}

impl SqliteWorkspaceRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
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
        let id_num: i64 = id
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput(format!("invalid id: {id}")))?;
        let tenant_id = ctx.tenant_id.parse::<i64>().ok().filter(|value| *value > 0);
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0",
            col::TABLE,
            col::ID,
            col::IS_DELETED,
        );
        if tenant_id.is_some() {
            sql.push_str(&format!(" AND {} = ?", col::TENANT_ID));
        }

        let row = if let Some(tenant_id) = tenant_id {
            sqlx::query(&sql)
                .bind(id_num)
                .bind(tenant_id)
                .fetch_optional(&self.pool)
                .await
        } else {
            sqlx::query(&sql)
                .bind(id_num)
                .fetch_optional(&self.pool)
                .await
        }
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        match row {
            Some(row) => {
                let r = WorkspaceRow::from_row(&row)
                    .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
                Ok(Some(row_mapper::workspace_row_to_payload(&r)))
            }
            None => Ok(None),
        }
    }

    async fn list_workspaces(
        &self,
        ctx: &WorkspaceContext,
        query: &WorkspaceScopedQuery,
    ) -> Result<Vec<WorkspacePayload>, WorkspaceError> {
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = 0",
            col::TABLE,
            col::IS_DELETED,
        );
        let tenant_id = ctx.tenant_id.parse::<i64>().ok().filter(|value| *value > 0);
        if tenant_id.is_some() {
            sql.push_str(&format!(" AND {} = ?", col::TENANT_ID));
        }
        if query.user_id.is_some() {
            sql.push_str(&format!(" AND {} = ?", col::OWNER_ID));
        }
        if query.workspace_id.is_some() {
            sql.push_str(&format!(" AND {} = ?", col::ID));
        }

        let mut q = sqlx::query(&sql);
        if let Some(tenant_id) = tenant_id {
            q = q.bind(tenant_id);
        }
        if let Some(ref uid) = query.user_id {
            q = q.bind(uid.as_str());
        }
        if let Some(ref wid) = query.workspace_id {
            q = q.bind(wid.as_str());
        }

        let rows = q
            .fetch_all(&self.pool)
            .await
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        rows.iter()
            .map(|row| {
                WorkspaceRow::from_row(row)
                    .map(|r| row_mapper::workspace_row_to_payload(&r))
                    .map_err(|e| WorkspaceError::Repository(e.to_string()))
            })
            .collect()
    }

    async fn create_workspace(
        &self,
        ctx: &WorkspaceContext,
        req: &CreateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
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
        let leader_id = req.leader_id.as_deref().and_then(|s| s.parse::<i64>().ok());
        let created_by = req
            .created_by_user_id
            .as_deref()
            .and_then(|s| s.parse::<i64>().ok());
        let is_public = req.is_public.map(|b| if b { 1i64 } else { 0 });
        let is_template = req.is_template.map(|b| if b { 1i64 } else { 0 });

        let result = sqlx::query(&format!(
            "INSERT INTO {t} (uuid, tenant_id, organization_id, data_scope, created_at, updated_at, version, is_deleted, name, code, title, description, owner_id, leader_id, created_by_user_id, icon, color, type, start_time, end_time, max_members, settings_json, is_public, is_template, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            t = col::TABLE,
        ))
        .bind(&uuid)
        .bind(tenant_id)
        .bind(organization_id)
        .bind(data_scope)
        .bind(&now)
        .bind(&now)
        .bind(0i64)
        .bind(0i64)
        .bind(&req.name)
        .bind(&req.code)
        .bind(&req.title)
        .bind(&req.description)
        .bind(owner_id)
        .bind(leader_id)
        .bind(created_by)
        .bind(&req.icon)
        .bind(&req.color)
        .bind(&req.entity_type)
        .bind(&req.start_time)
        .bind(&req.end_time)
        .bind(req.max_members)
        .bind(&settings_json)
        .bind(is_public)
        .bind(is_template)
        .bind("active")
        .execute(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        let id = result.last_insert_rowid();
        let row = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ?",
            col::TABLE,
            col::ID,
        ))
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let r = WorkspaceRow::from_row(&row)
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        Ok(row_mapper::workspace_row_to_payload(&r))
    }

    async fn update_workspace(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
        req: &UpdateWorkspaceRequest,
    ) -> Result<WorkspacePayload, WorkspaceError> {
        let id_num: i64 = id
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput(format!("invalid id: {id}")))?;
        let tenant_id = ctx.tenant_id.parse::<i64>().ok().filter(|value| *value > 0);
        let now = Self::now_iso();

        let mut builder: QueryBuilder<Sqlite> =
            QueryBuilder::new(format!("UPDATE {} SET ", col::TABLE));
        {
            let mut sep = builder.separated(", ");
            sep.push(format!("{} = ", col::UPDATED_AT));
            sep.push_bind_unseparated(&now);

            macro_rules! add_opt {
                ($field:expr, $col:expr) => {
                    if let Some(ref v) = $field {
                        sep.push(format!("{} = ", $col));
                        sep.push_bind_unseparated(v.as_str());
                    }
                };
            }
            macro_rules! add_opt_i64 {
                ($field:expr, $col:expr) => {
                    if let Some(v) = $field {
                        sep.push(format!("{} = ", $col));
                        sep.push_bind_unseparated(v);
                    }
                };
            }
            macro_rules! add_opt_bool {
                ($field:expr, $col:expr) => {
                    if let Some(v) = $field {
                        sep.push(format!("{} = ", $col));
                        sep.push_bind_unseparated(if v { 1i64 } else { 0i64 });
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
                    sep.push(format!("{} = ", col::SETTINGS_JSON));
                    sep.push_bind_unseparated(json);
                }
            }
            if let Some(ref v) = req.data_scope {
                if let Ok(n) = v.parse::<i64>() {
                    sep.push(format!("{} = ", col::DATA_SCOPE));
                    sep.push_bind_unseparated(n);
                }
            }
            if let Some(ref v) = req.owner_id {
                if let Ok(n) = v.parse::<i64>() {
                    sep.push(format!("{} = ", col::OWNER_ID));
                    sep.push_bind_unseparated(n);
                }
            }
            if let Some(ref v) = req.leader_id {
                if let Ok(n) = v.parse::<i64>() {
                    sep.push(format!("{} = ", col::LEADER_ID));
                    sep.push_bind_unseparated(n);
                }
            }
        }

        builder.push(format!(" WHERE {} = ", col::ID));
        builder.push_bind(id_num);
        if let Some(tenant_id) = tenant_id {
            builder.push(format!(" AND {} = ", col::TENANT_ID));
            builder.push_bind(tenant_id);
        }

        let result = builder
            .build()
            .execute(&self.pool)
            .await
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(WorkspaceError::NotFound(format!("workspace {id} not found")));
        }

        let row = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ?",
            col::TABLE,
            col::ID,
        ))
        .bind(id_num)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let r = WorkspaceRow::from_row(&row)
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        Ok(row_mapper::workspace_row_to_payload(&r))
    }

    async fn delete_workspace(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
    ) -> Result<(), WorkspaceError> {
        let id_num: i64 = id
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput(format!("invalid id: {id}")))?;
        let tenant_id = ctx.tenant_id.parse::<i64>().ok().filter(|value| *value > 0);
        let now = Self::now_iso();
        let mut sql = format!(
            "UPDATE {} SET {} = 1, {} = ? WHERE {} = ?",
            col::TABLE,
            col::IS_DELETED,
            col::UPDATED_AT,
            col::ID,
        );
        if tenant_id.is_some() {
            sql.push_str(&format!(" AND {} = ?", col::TENANT_ID));
        }

        let result = if let Some(tenant_id) = tenant_id {
            sqlx::query(&sql)
                .bind(&now)
                .bind(id_num)
                .bind(tenant_id)
                .execute(&self.pool)
                .await
        } else {
            sqlx::query(&sql)
                .bind(&now)
                .bind(id_num)
                .execute(&self.pool)
                .await
        }
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(WorkspaceError::NotFound(format!("workspace {id} not found")));
        }
        Ok(())
    }

    async fn list_workspace_members(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<Vec<WorkspaceMemberPayload>, WorkspaceError> {
        if self.find_workspace_by_id(ctx, workspace_id).await?.is_none() {
            return Err(WorkspaceError::NotFound(format!(
                "workspace {workspace_id} not found"
            )));
        }
        let wid: i64 = workspace_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
        })?;
        let rows = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0",
            member_col::TABLE,
            member_col::WORKSPACE_ID,
            member_col::IS_DELETED,
        ))
        .bind(wid)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        rows.iter()
            .map(|row| {
                WorkspaceMemberRow::from_row(row)
                    .map(|r| row_mapper::workspace_member_row_to_payload(&r))
                    .map_err(|e| WorkspaceError::Repository(e.to_string()))
            })
            .collect()
    }

    async fn upsert_workspace_member(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        req: &UpsertWorkspaceMemberRequest,
    ) -> Result<WorkspaceMemberPayload, WorkspaceError> {
        if self.find_workspace_by_id(ctx, workspace_id).await?.is_none() {
            return Err(WorkspaceError::NotFound(format!(
                "workspace {workspace_id} not found"
            )));
        }
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

        let existing: Option<i64> = sqlx::query_scalar(&format!(
            "SELECT {} FROM {} WHERE {} = ? AND {} = ? AND {} = 0",
            member_col::ID,
            member_col::TABLE,
            member_col::WORKSPACE_ID,
            member_col::USER_ID,
            member_col::IS_DELETED,
        ))
        .bind(wid)
        .bind(uid)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        if let Some(existing_id) = existing {
            sqlx::query(&format!(
                "UPDATE {} SET {} = ?, {} = ?, {} = ? WHERE {} = ?",
                member_col::TABLE,
                member_col::ROLE,
                member_col::STATUS,
                member_col::UPDATED_AT,
                member_col::ID,
            ))
            .bind(role)
            .bind(status)
            .bind(&now)
            .bind(existing_id)
            .execute(&self.pool)
            .await
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
            let row = sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ?",
                member_col::TABLE,
                member_col::ID,
            ))
            .bind(existing_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
            let r = WorkspaceMemberRow::from_row(&row)
                .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
            Ok(row_mapper::workspace_member_row_to_payload(&r))
        } else {
            let team_id = req.team_id.as_deref().and_then(|s| s.parse::<i64>().ok());
            let created_by = req
                .created_by_user_id
                .as_deref()
                .and_then(|s| s.parse::<i64>().ok());
            let granted_by = req
                .granted_by_user_id
                .as_deref()
                .and_then(|s| s.parse::<i64>().ok());

            let result = sqlx::query(&format!(
                "INSERT INTO {t} (uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, workspace_id, user_id, team_id, role, created_by_user_id, granted_by_user_id, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                t = member_col::TABLE,
            ))
            .bind(&uuid)
            .bind(tenant_id)
            .bind(0i64)
            .bind(&now)
            .bind(&now)
            .bind(0i64)
            .bind(0i64)
            .bind(wid)
            .bind(uid)
            .bind(team_id)
            .bind(role)
            .bind(created_by)
            .bind(granted_by)
            .bind(status)
            .execute(&self.pool)
            .await
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

            let new_id = result.last_insert_rowid();
            let row = sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ?",
                member_col::TABLE,
                member_col::ID,
            ))
            .bind(new_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
            let r = WorkspaceMemberRow::from_row(&row)
                .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
            Ok(row_mapper::workspace_member_row_to_payload(&r))
        }
    }

    async fn remove_workspace_member(
        &self,
        _ctx: &WorkspaceContext,
        workspace_id: &str,
        user_id: &str,
    ) -> Result<(), WorkspaceError> {
        let wid: i64 = workspace_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
        })?;
        let uid: i64 = user_id
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput(format!("invalid user_id: {user_id}")))?;
        let now = Self::now_iso();
        sqlx::query(&format!(
            "UPDATE {} SET {} = 1, {} = ? WHERE {} = ? AND {} = ?",
            member_col::TABLE,
            member_col::IS_DELETED,
            member_col::UPDATED_AT,
            member_col::WORKSPACE_ID,
            member_col::USER_ID,
        ))
        .bind(&now)
        .bind(wid)
        .bind(uid)
        .execute(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        Ok(())
    }
}
