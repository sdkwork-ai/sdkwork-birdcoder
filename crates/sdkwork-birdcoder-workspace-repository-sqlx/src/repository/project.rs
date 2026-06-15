use std::sync::Mutex;

use rusqlite::{params, Connection};
use uuid::Uuid;

use crate::db::columns::project as col;
use crate::db::columns::project_collaborator as collab_col;
use crate::db::rows::{ProjectCollaboratorRow, ProjectRow};
use crate::mapper::row_mapper;
use sdkwork_birdcoder_project_service::context::SessionContext;
use sdkwork_birdcoder_project_service::domain::commands::{
    CreateProjectRequest, UpdateProjectRequest, UpsertProjectCollaboratorRequest,
};
use sdkwork_birdcoder_project_service::domain::results::{ProjectCollaboratorPayload, ProjectPayload};
use sdkwork_birdcoder_project_service::error::ProjectError;

pub struct SqliteProjectRepository {
    conn: Mutex<Connection>,
}

impl SqliteProjectRepository {
    pub fn new(conn: Connection) -> Self {
        Self {
            conn: Mutex::new(conn),
        }
    }

    fn now_iso() -> String {
        time::OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
    }
}

#[async_trait::async_trait]
impl sdkwork_birdcoder_project_service::ports::repository::ProjectRepository
    for SqliteProjectRepository
{
    async fn find_project_by_id(
        &self,
        _ctx: &SessionContext,
        id: &str,
    ) -> Result<Option<ProjectPayload>, ProjectError> {
        let conn = self.conn.lock().map_err(|e| {
            ProjectError::Repository(format!("lock error: {e}"))
        })?;
        let id_num: i64 = id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid id: {id}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                col::TABLE,
                col::ID,
                col::IS_DELETED,
            ))
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        let row = stmt
            .query_row(params![id_num], |r| Ok(ProjectRow::from_row(r)))
            .optional()
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        match row {
            Some(Ok(r)) => Ok(Some(row_mapper::project_row_to_payload(&r))),
            Some(Err(e)) => Err(ProjectError::Repository(e.to_string())),
            None => Ok(None),
        }
    }

    async fn list_projects_by_workspace(
        &self,
        _ctx: &SessionContext,
        workspace_id: &str,
    ) -> Result<Vec<ProjectPayload>, ProjectError> {
        let conn = self.conn.lock().map_err(|e| {
            ProjectError::Repository(format!("lock error: {e}"))
        })?;
        let wid: i64 = workspace_id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                col::TABLE,
                col::WORKSPACE_ID,
                col::IS_DELETED,
            ))
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map(params![wid], |r| Ok(ProjectRow::from_row(r)))
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| ProjectError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::project_row_to_payload(&r)),
                Err(e) => return Err(ProjectError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    async fn create_project(
        &self,
        ctx: &SessionContext,
        req: &CreateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        let conn = self.conn.lock().map_err(|e| {
            ProjectError::Repository(format!("lock error: {e}"))
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
        let workspace_id: i64 = req.workspace_id.parse().unwrap_or(0);
        let entity_type: i64 = req
            .entity_type
            .as_deref()
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);
        let status: i64 = req
            .status
            .as_deref()
            .unwrap_or("0")
            .parse()
            .unwrap_or(0);
        let parent_metadata = req
            .parent_metadata
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());
        let cover_image = req
            .cover_image
            .as_ref()
            .and_then(|v| serde_json::to_string(v).ok());

        conn.execute(
            &format!(
                "INSERT INTO {t} (uuid, created_at, updated_at, v, tenant_id, organization_id, data_scope, parent_id, parent_uuid, parent_metadata, user_id, name, title, cover_image, author, code, type, site_path, domain_prefix, description, status, workspace_id, workspace_uuid, is_deleted, is_template) VALUES (?1,?2,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24)",
                t = col::TABLE,
            ),
            params![
                uuid,
                now,
                0i64,
                tenant_id,
                organization_id,
                data_scope,
                req.parent_id.as_deref().and_then(|s| s.parse::<i64>().ok()),
                req.parent_uuid,
                parent_metadata,
                req.user_id.as_deref().and_then(|s| s.parse::<i64>().ok()),
                req.name,
                req.title.as_deref().unwrap_or(&req.name),
                cover_image,
                req.author,
                req.code.as_deref().unwrap_or(""),
                entity_type,
                req.site_path,
                req.domain_prefix,
                req.description,
                status,
                workspace_id,
                req.workspace_uuid,
                0i64,
                req.is_template.map(|b| if b { 1i64 } else { 0i64 }).unwrap_or(0),
            ],
        )
        .map_err(|e| ProjectError::Repository(e.to_string()))?;

        let id = conn.last_insert_rowid();
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1",
                col::TABLE,
                col::ID,
            ))
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        let row = stmt
            .query_row(params![id], |r| Ok(ProjectRow::from_row(r)))
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        match row {
            Ok(r) => Ok(row_mapper::project_row_to_payload(&r)),
            Err(e) => Err(ProjectError::Repository(e.to_string())),
        }
    }

    async fn update_project(
        &self,
        _ctx: &SessionContext,
        id: &str,
        req: &UpdateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        let conn = self.conn.lock().map_err(|e| {
            ProjectError::Repository(format!("lock error: {e}"))
        })?;
        let id_num: i64 = id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid id: {id}"))
        })?;
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

        add_opt!(req.name, col::NAME);
        add_opt!(req.description, col::DESCRIPTION);
        add_opt!(req.code, col::CODE);
        add_opt!(req.title, col::TITLE);
        add_opt!(req.author, col::AUTHOR);
        add_opt!(req.site_path, col::SITE_PATH);
        add_opt!(req.domain_prefix, col::DOMAIN_PREFIX);
        add_opt!(req.parent_uuid, col::PARENT_UUID);
        add_opt!(req.root_path, col::SITE_PATH);

        if let Some(ref v) = req.entity_type {
            if let Ok(n) = v.parse::<i64>() {
                sets.push(format!("{} = ?{}", col::TYPE, idx));
                param_values.push(Box::new(n));
                idx += 1;
            }
        }
        if let Some(ref v) = req.status {
            if let Ok(n) = v.parse::<i64>() {
                sets.push(format!("{} = ?{}", col::STATUS, idx));
                param_values.push(Box::new(n));
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
        if let Some(ref v) = req.user_id {
            if let Ok(n) = v.parse::<i64>() {
                sets.push(format!("{} = ?{}", col::USER_ID, idx));
                param_values.push(Box::new(n));
                idx += 1;
            }
        }
        if let Some(ref v) = req.parent_id {
            if let Ok(n) = v.parse::<i64>() {
                sets.push(format!("{} = ?{}", col::PARENT_ID, idx));
                param_values.push(Box::new(n));
                idx += 1;
            }
        }
        if let Some(ref v) = req.file_id {
            if let Ok(n) = v.parse::<i64>() {
                sets.push(format!("{} = ?{}", col::FILE_ID, idx));
                param_values.push(Box::new(n));
                idx += 1;
            }
        }
        if let Some(ref v) = req.conversation_id {
            if let Ok(n) = v.parse::<i64>() {
                sets.push(format!("{} = ?{}", col::CONVERSATION_ID, idx));
                param_values.push(Box::new(n));
                idx += 1;
            }
        }
        if let Some(ref v) = req.budget_amount {
            if let Ok(n) = v.parse::<i64>() {
                sets.push(format!("{} = ?{}", col::BUDGET_AMOUNT, idx));
                param_values.push(Box::new(n));
                idx += 1;
            }
        }
        if let Some(v) = req.is_template {
            sets.push(format!("{} = ?{}", col::IS_TEMPLATE, idx));
            param_values.push(Box::new(if v { 1i64 } else { 0i64 }));
            idx += 1;
        }
        if let Some(ref v) = req.cover_image {
            if let Ok(json) = serde_json::to_string(v) {
                sets.push(format!("{} = ?{}", col::COVER_IMAGE, idx));
                param_values.push(Box::new(json));
                idx += 1;
            }
        }
        if let Some(ref v) = req.parent_metadata {
            if let Ok(json) = serde_json::to_string(v) {
                sets.push(format!("{} = ?{}", col::PARENT_METADATA, idx));
                param_values.push(Box::new(json));
                idx += 1;
            }
        }

        let sql = format!(
            "UPDATE {} SET {} WHERE {} = ?{}",
            col::TABLE,
            sets.join(", "),
            col::ID,
            idx,
        );
        param_values.push(Box::new(id_num));
        let params_refs: Vec<&dyn rusqlite::types::ToSql> =
            param_values.iter().map(|p| p.as_ref()).collect();
        conn.execute(&sql, params_refs.as_slice())
            .map_err(|e| ProjectError::Repository(e.to_string()))?;

        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1",
                col::TABLE,
                col::ID,
            ))
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        let row = stmt
            .query_row(params![id_num], |r| Ok(ProjectRow::from_row(r)))
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        match row {
            Ok(r) => Ok(row_mapper::project_row_to_payload(&r)),
            Err(e) => Err(ProjectError::Repository(e.to_string())),
        }
    }

    async fn delete_project(
        &self,
        _ctx: &SessionContext,
        id: &str,
    ) -> Result<(), ProjectError> {
        let conn = self.conn.lock().map_err(|e| {
            ProjectError::Repository(format!("lock error: {e}"))
        })?;
        let id_num: i64 = id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid id: {id}"))
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
        .map_err(|e| ProjectError::Repository(e.to_string()))?;
        Ok(())
    }

    async fn list_project_collaborators(
        &self,
        _ctx: &SessionContext,
        project_id: &str,
    ) -> Result<Vec<ProjectCollaboratorPayload>, ProjectError> {
        let conn = self.conn.lock().map_err(|e| {
            ProjectError::Repository(format!("lock error: {e}"))
        })?;
        let pid: i64 = project_id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid project_id: {project_id}"))
        })?;
        let mut stmt = conn
            .prepare(&format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                collab_col::TABLE,
                collab_col::PROJECT_ID,
                collab_col::IS_DELETED,
            ))
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        let rows = stmt
            .query_map(params![pid], |r| Ok(ProjectCollaboratorRow::from_row(r)))
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        let mut result = Vec::new();
        for row in rows {
            match row.map_err(|e| ProjectError::Repository(e.to_string()))? {
                Ok(r) => result.push(row_mapper::project_collaborator_row_to_payload(&r)),
                Err(e) => return Err(ProjectError::Repository(e.to_string())),
            }
        }
        Ok(result)
    }

    async fn upsert_project_collaborator(
        &self,
        ctx: &SessionContext,
        project_id: &str,
        req: &UpsertProjectCollaboratorRequest,
    ) -> Result<ProjectCollaboratorPayload, ProjectError> {
        let conn = self.conn.lock().map_err(|e| {
            ProjectError::Repository(format!("lock error: {e}"))
        })?;
        let pid: i64 = project_id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid project_id: {project_id}"))
        })?;
        let uid: i64 = req
            .user_id
            .as_deref()
            .unwrap_or(&ctx.user_id)
            .parse()
            .map_err(|_| ProjectError::InvalidInput("invalid user_id".into()))?;
        let now = Self::now_iso();
        let uuid = Uuid::new_v4().to_string();
        let tenant_id: i64 = ctx.tenant_id.parse().unwrap_or(0);
        let role = req.role.as_deref().unwrap_or("member");
        let status = req.status.as_deref().unwrap_or("active");

        let existing = conn
            .prepare(&format!(
                "SELECT {} FROM {} WHERE {} = ?1 AND {} = ?2 AND {} = 0",
                collab_col::ID,
                collab_col::TABLE,
                collab_col::PROJECT_ID,
                collab_col::USER_ID,
                collab_col::IS_DELETED,
            ))
            .map_err(|e| ProjectError::Repository(e.to_string()))?
            .query_row(params![pid, uid], |r| r.get::<_, i64>(0))
            .ok();

        if let Some(existing_id) = existing {
            conn.execute(
                &format!(
                    "UPDATE {} SET {} = ?1, {} = ?2, {} = ?3 WHERE {} = ?4",
                    collab_col::TABLE,
                    collab_col::ROLE,
                    collab_col::STATUS,
                    collab_col::UPDATED_AT,
                    collab_col::ID,
                ),
                params![role, status, now, existing_id],
            )
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
            let mut stmt = conn
                .prepare(&format!(
                    "SELECT * FROM {} WHERE {} = ?1",
                    collab_col::TABLE,
                    collab_col::ID,
                ))
                .map_err(|e| ProjectError::Repository(e.to_string()))?;
            let row = stmt
                .query_row(params![existing_id], |r| {
                    Ok(ProjectCollaboratorRow::from_row(r))
                })
                .map_err(|e| ProjectError::Repository(e.to_string()))?;
            match row {
                Ok(r) => Ok(row_mapper::project_collaborator_row_to_payload(&r)),
                Err(e) => Err(ProjectError::Repository(e.to_string())),
            }
        } else {
            let wid: i64 = req
                .team_id
                .as_deref()
                .unwrap_or("0")
                .parse()
                .unwrap_or(0);
            conn.execute(
                &format!(
                    "INSERT INTO {t} (uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, project_id, workspace_id, user_id, team_id, role, created_by_user_id, granted_by_user_id, status) VALUES (?1,?2,?3,?4,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14)",
                    t = collab_col::TABLE,
                ),
                params![
                    uuid,
                    tenant_id,
                    0i64,
                    now,
                    0i64,
                    0i64,
                    pid,
                    wid,
                    uid,
                    req.team_id.as_deref().and_then(|s| s.parse::<i64>().ok()),
                    role,
                    req.created_by_user_id.as_deref().and_then(|s| s.parse::<i64>().ok()),
                    req.granted_by_user_id.as_deref().and_then(|s| s.parse::<i64>().ok()),
                    status,
                ],
            )
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
            let new_id = conn.last_insert_rowid();
            let mut stmt = conn
                .prepare(&format!(
                    "SELECT * FROM {} WHERE {} = ?1",
                    collab_col::TABLE,
                    collab_col::ID,
                ))
                .map_err(|e| ProjectError::Repository(e.to_string()))?;
            let row = stmt
                .query_row(params![new_id], |r| Ok(ProjectCollaboratorRow::from_row(r)))
                .map_err(|e| ProjectError::Repository(e.to_string()))?;
            match row {
                Ok(r) => Ok(row_mapper::project_collaborator_row_to_payload(&r)),
                Err(e) => Err(ProjectError::Repository(e.to_string())),
            }
        }
    }

    async fn remove_project_collaborator(
        &self,
        _ctx: &SessionContext,
        project_id: &str,
        user_id: &str,
    ) -> Result<(), ProjectError> {
        let conn = self.conn.lock().map_err(|e| {
            ProjectError::Repository(format!("lock error: {e}"))
        })?;
        let pid: i64 = project_id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid project_id: {project_id}"))
        })?;
        let uid: i64 = user_id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid user_id: {user_id}"))
        })?;
        let now = Self::now_iso();
        conn.execute(
            &format!(
                "UPDATE {} SET {} = 1, {} = ?1 WHERE {} = ?2 AND {} = ?3",
                collab_col::TABLE,
                collab_col::IS_DELETED,
                collab_col::UPDATED_AT,
                collab_col::PROJECT_ID,
                collab_col::USER_ID,
            ),
            params![now, pid, uid],
        )
        .map_err(|e| ProjectError::Repository(e.to_string()))?;
        Ok(())
    }
}

use rusqlite::OptionalExtension;

