use sqlx::AnyPool;
use uuid::Uuid;

use crate::db::columns::team as col;
use crate::db::columns::team_member as member_col;
use crate::db::rows::{TeamMemberRow, TeamRow};
use crate::mapper::row_mapper;
use crate::repository::scope::{scoped_tenant_id, scoped_user_id};
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_birdcoder_workspace_service::domain::results::{TeamMemberPayload, TeamPayload};
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;

#[derive(Clone)]
pub struct SqliteTeamRepository {
    pool: AnyPool,
}

impl SqliteTeamRepository {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
    }

    fn now_iso() -> String {
        time::OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
    }

    pub async fn find_team_by_id(
        &self,
        ctx: &WorkspaceContext,
        id: &str,
    ) -> Result<Option<TeamPayload>, WorkspaceError> {
        let id_num: i64 = id
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput(format!("invalid id: {id}")))?;
        let tenant_id = scoped_tenant_id(ctx)?;
        let sql = format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0 AND {} = ?",
            col::TABLE,
            col::ID,
            col::IS_DELETED,
            col::TENANT_ID,
        );

        let row = sqlx::query(&sql)
            .bind(id_num)
            .bind(tenant_id)
            .fetch_optional(&self.pool)
            .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        match row {
            Some(row) => {
                let r = TeamRow::from_row(&row)
                    .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
                Ok(Some(row_mapper::team_row_to_payload(&r)))
            }
            None => Ok(None),
        }
    }

    pub async fn list_teams_by_workspace(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
    ) -> Result<Vec<TeamPayload>, WorkspaceError> {
        let wid: i64 = workspace_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
        })?;
        let tenant_id = scoped_tenant_id(ctx)?;
        let sql = format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0 AND {} = ?",
            col::TABLE,
            col::WORKSPACE_ID,
            col::IS_DELETED,
            col::TENANT_ID,
        );

        let rows = sqlx::query(&sql)
            .bind(wid)
            .bind(tenant_id)
            .fetch_all(&self.pool)
            .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        rows.iter()
            .map(|row| {
                TeamRow::from_row(row)
                    .map(|r| row_mapper::team_row_to_payload(&r))
                    .map_err(|e| WorkspaceError::Repository(e.to_string()))
            })
            .collect()
    }

    pub async fn list_teams(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: Option<&str>,
        user_id: Option<&str>,
    ) -> Result<Vec<TeamPayload>, WorkspaceError> {
        let tenant_id = scoped_tenant_id(ctx)?;
        let uid = user_id
            .map(|value| {
                value.parse::<i64>().map_err(|_| {
                    WorkspaceError::InvalidInput(format!("invalid user_id: {value}"))
                })
            })
            .transpose()?;

        if let Some(workspace_id) = workspace_id {
            let wid: i64 = workspace_id.parse().map_err(|_| {
                WorkspaceError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
            })?;
            let mut sql = format!(
                "SELECT t.* FROM {} t WHERE t.{} = ? AND t.{} = 0 AND t.{} = ?",
                col::TABLE,
                col::WORKSPACE_ID,
                col::IS_DELETED,
                col::TENANT_ID,
            );
            if let Some(parsed) = uid {
                sql.push_str(&format!(
                    " AND (t.{} = ? OR EXISTS (SELECT 1 FROM {} m WHERE m.{} = t.{} AND m.{} = ? AND m.{} = 0))",
                    col::OWNER_ID,
                    member_col::TABLE,
                    member_col::TEAM_ID,
                    col::ID,
                    member_col::USER_ID,
                    member_col::IS_DELETED,
                ));
                let mut query = sqlx::query(&sql).bind(wid).bind(tenant_id).bind(parsed).bind(parsed);
                return Self::collect_team_rows(query.fetch_all(&self.pool).await);
            }

            let query = sqlx::query(&sql).bind(wid).bind(tenant_id);
            return Self::collect_team_rows(query.fetch_all(&self.pool).await);
        }

        let mut sql = format!(
            "SELECT t.* FROM {} t WHERE t.{} = 0 AND t.{} = ?",
            col::TABLE,
            col::IS_DELETED,
            col::TENANT_ID,
        );

        if let Some(parsed) = uid {
            sql.push_str(&format!(
                " AND (t.{} = ? OR EXISTS (SELECT 1 FROM {} m WHERE m.{} = t.{} AND m.{} = ? AND m.{} = 0))",
                col::OWNER_ID,
                member_col::TABLE,
                member_col::TEAM_ID,
                col::ID,
                member_col::USER_ID,
                member_col::IS_DELETED,
            ));
            let mut query = sqlx::query(&sql).bind(tenant_id).bind(parsed).bind(parsed);
            return Self::collect_team_rows(query.fetch_all(&self.pool).await);
        }

        let query = sqlx::query(&sql).bind(tenant_id);
        Self::collect_team_rows(query.fetch_all(&self.pool).await)
    }

    fn collect_team_rows(
        rows: Result<Vec<sqlx::any::AnyRow>, sqlx::Error>,
    ) -> Result<Vec<TeamPayload>, WorkspaceError> {
        let rows = rows.map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        rows.iter()
            .map(|row| {
                TeamRow::from_row(row)
                    .map(|r| row_mapper::team_row_to_payload(&r))
                    .map_err(|e| WorkspaceError::Repository(e.to_string()))
            })
            .collect()
    }

    pub async fn create_team(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: &str,
        name: &str,
        description: Option<&str>,
    ) -> Result<TeamPayload, WorkspaceError> {
        let now = Self::now_iso();
        let uuid = Uuid::new_v4().to_string();
        let tenant_id = scoped_tenant_id(ctx)?;
        let wid: i64 = workspace_id.parse().map_err(|_| {
            WorkspaceError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
        })?;
        let owner_id = scoped_user_id(ctx)?;

        let result = sqlx::query(&format!(
            "INSERT INTO {t} (uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, workspace_id, name, description, owner_id, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            t = col::TABLE,
        ))
        .bind(&uuid)
        .bind(tenant_id)
        .bind(0i64)
        .bind(&now)
        .bind(&now)
        .bind(0i64)
        .bind(0i64)
        .bind(wid)
        .bind(name)
        .bind(description)
        .bind(owner_id)
        .bind("active")
        .execute(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        let id = result.last_insert_id();
        let row = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ?",
            col::TABLE,
            col::ID,
        ))
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let r = TeamRow::from_row(&row).map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        Ok(row_mapper::team_row_to_payload(&r))
    }

    pub async fn delete_team(&self, ctx: &WorkspaceContext, id: &str) -> Result<(), WorkspaceError> {
        let id_num: i64 = id
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput(format!("invalid id: {id}")))?;
        if self.find_team_by_id(ctx, id).await?.is_none() {
            return Err(WorkspaceError::NotFound(format!("team {id} not found")));
        }
        let now = Self::now_iso();
        sqlx::query(&format!(
            "UPDATE {} SET {} = 1, {} = ? WHERE {} = ?",
            col::TABLE,
            col::IS_DELETED,
            col::UPDATED_AT,
            col::ID,
        ))
        .bind(&now)
        .bind(id_num)
        .execute(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        Ok(())
    }

    pub async fn list_team_members(
        &self,
        ctx: &WorkspaceContext,
        team_id: &str,
    ) -> Result<Vec<TeamMemberPayload>, WorkspaceError> {
        if self.find_team_by_id(ctx, team_id).await?.is_none() {
            return Err(WorkspaceError::NotFound(format!("team {team_id} not found")));
        }
        let tid: i64 = team_id
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput(format!("invalid team_id: {team_id}")))?;
        let rows = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0",
            member_col::TABLE,
            member_col::TEAM_ID,
            member_col::IS_DELETED,
        ))
        .bind(tid)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        rows.iter()
            .map(|row| {
                TeamMemberRow::from_row(row)
                    .map(|r| row_mapper::team_member_row_to_payload(&r))
                    .map_err(|e| WorkspaceError::Repository(e.to_string()))
            })
            .collect()
    }

    pub async fn add_team_member(
        &self,
        ctx: &WorkspaceContext,
        team_id: &str,
        user_id: &str,
        role: &str,
    ) -> Result<TeamMemberPayload, WorkspaceError> {
        if self.find_team_by_id(ctx, team_id).await?.is_none() {
            return Err(WorkspaceError::NotFound(format!("team {team_id} not found")));
        }
        let tid: i64 = team_id
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput(format!("invalid team_id: {team_id}")))?;
        let uid: i64 = user_id
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput(format!("invalid user_id: {user_id}")))?;
        let now = Self::now_iso();
        let uuid = Uuid::new_v4().to_string();
        let tenant_id = scoped_tenant_id(ctx)?;
        let created_by = scoped_user_id(ctx)?;

        let result = sqlx::query(&format!(
            "INSERT INTO {t} (uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, team_id, user_id, role, created_by_user_id, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            t = member_col::TABLE,
        ))
        .bind(&uuid)
        .bind(tenant_id)
        .bind(0i64)
        .bind(&now)
        .bind(&now)
        .bind(0i64)
        .bind(0i64)
        .bind(tid)
        .bind(uid)
        .bind(role)
        .bind(created_by)
        .bind("active")
        .execute(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;

        let new_id = result.last_insert_id();
        let row = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ?",
            member_col::TABLE,
            member_col::ID,
        ))
        .bind(new_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        let r = TeamMemberRow::from_row(&row)
            .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        Ok(row_mapper::team_member_row_to_payload(&r))
    }

    pub async fn remove_team_member(
        &self,
        ctx: &WorkspaceContext,
        team_id: &str,
        user_id: &str,
    ) -> Result<(), WorkspaceError> {
        if self.find_team_by_id(ctx, team_id).await?.is_none() {
            return Err(WorkspaceError::NotFound(format!("team {team_id} not found")));
        }
        let tid: i64 = team_id
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput(format!("invalid team_id: {team_id}")))?;
        let uid: i64 = user_id
            .parse()
            .map_err(|_| WorkspaceError::InvalidInput(format!("invalid user_id: {user_id}")))?;
        let now = Self::now_iso();
        sqlx::query(&format!(
            "UPDATE {} SET {} = 1, {} = ? WHERE {} = ? AND {} = ?",
            member_col::TABLE,
            member_col::IS_DELETED,
            member_col::UPDATED_AT,
            member_col::TEAM_ID,
            member_col::USER_ID,
        ))
        .bind(&now)
        .bind(tid)
        .bind(uid)
        .execute(&self.pool)
        .await
        .map_err(|e| WorkspaceError::Repository(e.to_string()))?;
        Ok(())
    }
}

#[async_trait::async_trait]
impl sdkwork_birdcoder_workspace_service::ports::team::TeamRepository for SqliteTeamRepository {
    async fn list_teams(
        &self,
        ctx: &WorkspaceContext,
        workspace_id: Option<&str>,
        user_id: Option<&str>,
    ) -> Result<Vec<TeamPayload>, WorkspaceError> {
        SqliteTeamRepository::list_teams(self, ctx, workspace_id, user_id).await
    }

    async fn list_team_members(
        &self,
        ctx: &WorkspaceContext,
        team_id: &str,
    ) -> Result<Vec<TeamMemberPayload>, WorkspaceError> {
        SqliteTeamRepository::list_team_members(self, ctx, team_id).await
    }
}
