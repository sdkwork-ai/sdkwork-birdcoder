use sdkwork_birdcoder_project_service::context::ProjectContext;
use sqlx::{Any, AnyPool, QueryBuilder};
use uuid::Uuid;

use crate::db::columns::project as col;
use crate::db::columns::project_collaborator as collab_col;
use crate::db::rows::{ProjectCollaboratorRow, ProjectRow};
use crate::mapper::row_mapper;
use crate::repository::scope::project_scoped_tenant_id;
use sdkwork_birdcoder_project_service::domain::commands::{
    CreateProjectRequest, UpdateProjectRequest, UpsertProjectCollaboratorRequest,
};
use sdkwork_birdcoder_project_service::domain::results::{ProjectCollaboratorPayload, ProjectPayload};
use sdkwork_birdcoder_project_service::error::ProjectError;

#[derive(Clone)]
pub struct SqliteProjectRepository {
    pool: AnyPool,
}

impl SqliteProjectRepository {
    pub fn new(pool: AnyPool) -> Self {
        Self { pool }
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
        ctx: &ProjectContext,
        id: &str,
    ) -> Result<Option<ProjectPayload>, ProjectError> {
        let id_num: i64 = id
            .parse()
            .map_err(|_| ProjectError::InvalidInput(format!("invalid id: {id}")))?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
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
        .map_err(|e| ProjectError::Repository(e.to_string()))?;

        match row {
            Some(row) => {
                let r = ProjectRow::from_row(&row)
                    .map_err(|e| ProjectError::Repository(e.to_string()))?;
                Ok(Some(row_mapper::project_row_to_payload(&r)))
            }
            None => Ok(None),
        }
    }

    async fn list_projects_by_workspace(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
        root_path: Option<&str>,
        user_id: Option<&str>,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectPayload>, usize), ProjectError> {
        let wid: i64 = workspace_id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid workspace_id: {workspace_id}"))
        })?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let uid = user_id
            .map(|value| {
                value.parse::<i64>().map_err(|_| {
                    ProjectError::InvalidInput(format!("invalid user_id: {value}"))
                })
            })
            .transpose()?;

        // PAGINATION_SPEC.md §2/§5: push `LIMIT`/`OFFSET` and filter
        // predicates down to SQL — never collect-then-slice in process
        // memory. Default page_size=20, max=200 is enforced at the route
        // layer via `clamp_list_page_size`. `root_path` maps to the
        // `site_path` column (see `update_project`).
        let mut sql = format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0 AND {} = ?",
            col::TABLE,
            col::WORKSPACE_ID,
            col::IS_DELETED,
            col::TENANT_ID,
        );
        if root_path.is_some() {
            sql.push_str(&format!(" AND {} = ?", col::SITE_PATH));
        }
        if uid.is_some() {
            sql.push_str(&format!(" AND {} = ?", col::USER_ID));
        }
        // Append LIMIT/OFFSET last so bind order stays: workspace_id,
        // tenant_id, [site_path], [user_id], limit, offset.
        sql.push_str(" ORDER BY id DESC LIMIT ? OFFSET ?");

        let mut q = sqlx::query(&sql).bind(wid).bind(tenant_id);
        if let Some(rp) = root_path {
            q = q.bind(rp);
        }
        if let Some(parsed_uid) = uid {
            q = q.bind(parsed_uid);
        }
        q = q.bind(limit as i64).bind(offset as i64);

        let rows = q
            .fetch_all(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;

        let items: Vec<ProjectPayload> = rows
            .iter()
            .map(|row| {
                ProjectRow::from_row(row)
                    .map(|r| row_mapper::project_row_to_payload(&r))
                    .map_err(|e| ProjectError::Repository(e.to_string()))
            })
            .collect::<Result<_, _>>()?;

        // Total count via a parallel COUNT(*) using the same WHERE
        // predicates (minus the LIMIT/OFFSET). This keeps
        // `pageInfo.totalItems` accurate without materializing the full
        // result set.
        let mut count_sql = format!(
            "SELECT COUNT(*) FROM {} WHERE {} = ? AND {} = 0 AND {} = ?",
            col::TABLE,
            col::WORKSPACE_ID,
            col::IS_DELETED,
            col::TENANT_ID,
        );
        if root_path.is_some() {
            count_sql.push_str(&format!(" AND {} = ?", col::SITE_PATH));
        }
        if uid.is_some() {
            count_sql.push_str(&format!(" AND {} = ?", col::USER_ID));
        }
        let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql)
            .bind(wid)
            .bind(tenant_id);
        if let Some(rp) = root_path {
            count_q = count_q.bind(rp);
        }
        if let Some(parsed_uid) = uid {
            count_q = count_q.bind(parsed_uid);
        }
        let total: i64 = count_q
            .fetch_one(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        Ok((items, total.max(0) as usize))
    }

    async fn create_project(
        &self,
        ctx: &ProjectContext,
        req: &CreateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        let now = Self::now_iso();
        let uuid = Uuid::new_v4().to_string();
        let tenant_id = project_scoped_tenant_id(ctx)?;
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
        let workspace_id: i64 = req.workspace_id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid workspace_id: {}", req.workspace_id))
        })?;
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
        let parent_id = req.parent_id.as_deref().and_then(|s| s.parse::<i64>().ok());
        let user_id = req.user_id.as_deref().and_then(|s| s.parse::<i64>().ok());
        let title = req.title.as_deref().unwrap_or(&req.name);
        let code = req.code.as_deref().unwrap_or("");
        let is_template = req.is_template.map(|b| if b { 1i64 } else { 0i64 }).unwrap_or(0);

        let result = sqlx::query(&format!(
            "INSERT INTO {t} (uuid, created_at, updated_at, v, tenant_id, organization_id, data_scope, parent_id, parent_uuid, parent_metadata, user_id, name, title, cover_image, author, code, type, site_path, domain_prefix, description, status, workspace_id, workspace_uuid, is_deleted, is_template) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            t = col::TABLE,
        ))
        .bind(&uuid)
        .bind(&now)
        .bind(&now)
        .bind(0i64)
        .bind(tenant_id)
        .bind(organization_id)
        .bind(data_scope)
        .bind(parent_id)
        .bind(&req.parent_uuid)
        .bind(&parent_metadata)
        .bind(user_id)
        .bind(&req.name)
        .bind(title)
        .bind(&cover_image)
        .bind(&req.author)
        .bind(code)
        .bind(entity_type)
        .bind(&req.site_path)
        .bind(&req.domain_prefix)
        .bind(&req.description)
        .bind(status)
        .bind(workspace_id)
        .bind(&req.workspace_uuid)
        .bind(0i64)
        .bind(is_template)
        .execute(&self.pool)
        .await
        .map_err(|e| ProjectError::Repository(e.to_string()))?;

        let id = result.last_insert_id();
        let row = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ?",
            col::TABLE,
            col::ID,
        ))
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ProjectError::Repository(e.to_string()))?;
        let r = ProjectRow::from_row(&row).map_err(|e| ProjectError::Repository(e.to_string()))?;
        Ok(row_mapper::project_row_to_payload(&r))
    }

    async fn update_project(
        &self,
        ctx: &ProjectContext,
        id: &str,
        req: &UpdateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        let id_num: i64 = id
            .parse()
            .map_err(|_| ProjectError::InvalidInput(format!("invalid id: {id}")))?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let now = Self::now_iso();

        let mut builder: QueryBuilder<Any> =
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
                    sep.push(format!("{} = ", col::TYPE));
                    sep.push_bind_unseparated(n);
                }
            }
            if let Some(ref v) = req.status {
                if let Ok(n) = v.parse::<i64>() {
                    sep.push(format!("{} = ", col::STATUS));
                    sep.push_bind_unseparated(n);
                }
            }
            if let Some(ref v) = req.data_scope {
                if let Ok(n) = v.parse::<i64>() {
                    sep.push(format!("{} = ", col::DATA_SCOPE));
                    sep.push_bind_unseparated(n);
                }
            }
            if let Some(ref v) = req.user_id {
                if let Ok(n) = v.parse::<i64>() {
                    sep.push(format!("{} = ", col::USER_ID));
                    sep.push_bind_unseparated(n);
                }
            }
            if let Some(ref v) = req.parent_id {
                if let Ok(n) = v.parse::<i64>() {
                    sep.push(format!("{} = ", col::PARENT_ID));
                    sep.push_bind_unseparated(n);
                }
            }
            if let Some(ref v) = req.file_id {
                if let Ok(n) = v.parse::<i64>() {
                    sep.push(format!("{} = ", col::FILE_ID));
                    sep.push_bind_unseparated(n);
                }
            }
            if let Some(ref v) = req.conversation_id {
                if let Ok(n) = v.parse::<i64>() {
                    sep.push(format!("{} = ", col::CONVERSATION_ID));
                    sep.push_bind_unseparated(n);
                }
            }
            if let Some(ref v) = req.budget_amount {
                if let Ok(n) = v.parse::<i64>() {
                    sep.push(format!("{} = ", col::BUDGET_AMOUNT));
                    sep.push_bind_unseparated(n);
                }
            }
            if let Some(v) = req.is_template {
                sep.push(format!("{} = ", col::IS_TEMPLATE));
                sep.push_bind_unseparated(if v { 1i64 } else { 0i64 });
            }
            if let Some(ref v) = req.cover_image {
                if let Ok(json) = serde_json::to_string(v) {
                    sep.push(format!("{} = ", col::COVER_IMAGE));
                    sep.push_bind_unseparated(json);
                }
            }
            if let Some(ref v) = req.parent_metadata {
                if let Ok(json) = serde_json::to_string(v) {
                    sep.push(format!("{} = ", col::PARENT_METADATA));
                    sep.push_bind_unseparated(json);
                }
            }
        }

        builder.push(format!(" WHERE {} = ", col::ID));
        builder.push_bind(id_num);
        builder.push(format!(" AND {} = ", col::TENANT_ID));
        builder.push_bind(tenant_id);

        let result = builder
            .build()
            .execute(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(ProjectError::NotFound(format!("project {id} not found")));
        }

        let row = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ?",
            col::TABLE,
            col::ID,
        ))
        .bind(id_num)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ProjectError::Repository(e.to_string()))?;
        let r = ProjectRow::from_row(&row).map_err(|e| ProjectError::Repository(e.to_string()))?;
        Ok(row_mapper::project_row_to_payload(&r))
    }

    async fn delete_project(&self, ctx: &ProjectContext, id: &str) -> Result<(), ProjectError> {
        let id_num: i64 = id
            .parse()
            .map_err(|_| ProjectError::InvalidInput(format!("invalid id: {id}")))?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let now = Self::now_iso();
        let sql = format!(
            "UPDATE {} SET {} = 1, {} = ? WHERE {} = ? AND {} = ?",
            col::TABLE,
            col::IS_DELETED,
            col::UPDATED_AT,
            col::ID,
            col::TENANT_ID,
        );

        let result = sqlx::query(&sql)
            .bind(&now)
            .bind(id_num)
            .bind(tenant_id)
            .execute(&self.pool)
            .await
        .map_err(|e| ProjectError::Repository(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(ProjectError::NotFound(format!("project {id} not found")));
        }
        Ok(())
    }

    async fn list_project_collaborators(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectCollaboratorPayload>, usize), ProjectError> {
        if self.find_project_by_id(ctx, project_id).await?.is_none() {
            return Err(ProjectError::NotFound(format!(
                "project {project_id} not found"
            )));
        }
        let pid: i64 = project_id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid project_id: {project_id}"))
        })?;
        // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
        let rows = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = 0 ORDER BY {} DESC LIMIT ? OFFSET ?",
            collab_col::TABLE,
            collab_col::PROJECT_ID,
            collab_col::IS_DELETED,
            collab_col::ID,
        ))
        .bind(pid)
        .bind(limit as i64)
        .bind(offset as i64)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| ProjectError::Repository(e.to_string()))?;

        let items: Vec<ProjectCollaboratorPayload> = rows
            .iter()
            .map(|row| {
                ProjectCollaboratorRow::from_row(row)
                    .map(|r| row_mapper::project_collaborator_row_to_payload(&r))
                    .map_err(|e| ProjectError::Repository(e.to_string()))
            })
            .collect::<Result<_, _>>()?;

        let total: i64 = sqlx::query_scalar(&format!(
            "SELECT COUNT(*) FROM {} WHERE {} = ? AND {} = 0",
            collab_col::TABLE,
            collab_col::PROJECT_ID,
            collab_col::IS_DELETED,
        ))
        .bind(pid)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ProjectError::Repository(e.to_string()))?;
        Ok((items, total.max(0) as usize))
    }

    async fn upsert_project_collaborator(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        req: &UpsertProjectCollaboratorRequest,
    ) -> Result<ProjectCollaboratorPayload, ProjectError> {
        if self.find_project_by_id(ctx, project_id).await?.is_none() {
            return Err(ProjectError::NotFound(format!(
                "project {project_id} not found"
            )));
        }
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
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let role = req.role.as_deref().unwrap_or("member");
        let status = req.status.as_deref().unwrap_or("active");

        let existing: Option<i64> = sqlx::query_scalar(&format!(
            "SELECT {} FROM {} WHERE {} = ? AND {} = ? AND {} = 0",
            collab_col::ID,
            collab_col::TABLE,
            collab_col::PROJECT_ID,
            collab_col::USER_ID,
            collab_col::IS_DELETED,
        ))
        .bind(pid)
        .bind(uid)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ProjectError::Repository(e.to_string()))?;

        if let Some(existing_id) = existing {
            sqlx::query(&format!(
                "UPDATE {} SET {} = ?, {} = ?, {} = ? WHERE {} = ?",
                collab_col::TABLE,
                collab_col::ROLE,
                collab_col::STATUS,
                collab_col::UPDATED_AT,
                collab_col::ID,
            ))
            .bind(role)
            .bind(status)
            .bind(&now)
            .bind(existing_id)
            .execute(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
            let row = sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ?",
                collab_col::TABLE,
                collab_col::ID,
            ))
            .bind(existing_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
            let r = ProjectCollaboratorRow::from_row(&row)
                .map_err(|e| ProjectError::Repository(e.to_string()))?;
            Ok(row_mapper::project_collaborator_row_to_payload(&r))
        } else {
            let wid: i64 = req
                .team_id
                .as_deref()
                .unwrap_or("0")
                .parse()
                .unwrap_or(0);
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
                "INSERT INTO {t} (uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, project_id, workspace_id, user_id, team_id, role, created_by_user_id, granted_by_user_id, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                t = collab_col::TABLE,
            ))
            .bind(&uuid)
            .bind(tenant_id)
            .bind(0i64)
            .bind(&now)
            .bind(&now)
            .bind(0i64)
            .bind(0i64)
            .bind(pid)
            .bind(wid)
            .bind(uid)
            .bind(team_id)
            .bind(role)
            .bind(created_by)
            .bind(granted_by)
            .bind(status)
            .execute(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;

            let new_id = result.last_insert_id();
            let row = sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ?",
                collab_col::TABLE,
                collab_col::ID,
            ))
            .bind(new_id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
            let r = ProjectCollaboratorRow::from_row(&row)
                .map_err(|e| ProjectError::Repository(e.to_string()))?;
            Ok(row_mapper::project_collaborator_row_to_payload(&r))
        }
    }

    async fn remove_project_collaborator(
        &self,
        _ctx: &ProjectContext,
        project_id: &str,
        user_id: &str,
    ) -> Result<(), ProjectError> {
        let pid: i64 = project_id.parse().map_err(|_| {
            ProjectError::InvalidInput(format!("invalid project_id: {project_id}"))
        })?;
        let uid: i64 = user_id
            .parse()
            .map_err(|_| ProjectError::InvalidInput(format!("invalid user_id: {user_id}")))?;
        let now = Self::now_iso();
        sqlx::query(&format!(
            "UPDATE {} SET {} = 1, {} = ? WHERE {} = ? AND {} = ?",
            collab_col::TABLE,
            collab_col::IS_DELETED,
            collab_col::UPDATED_AT,
            collab_col::PROJECT_ID,
            collab_col::USER_ID,
        ))
        .bind(&now)
        .bind(pid)
        .bind(uid)
        .execute(&self.pool)
        .await
        .map_err(|e| ProjectError::Repository(e.to_string()))?;
        Ok(())
    }
}
