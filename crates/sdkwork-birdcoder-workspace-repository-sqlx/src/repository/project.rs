use sdkwork_birdcoder_project_service::context::ProjectContext;
use sqlx::{Any, AnyPool, QueryBuilder};
use uuid::Uuid;

use crate::db::columns::project as col;
use crate::db::columns::project_collaborator as collab_col;
use crate::db::columns::workspace as workspace_col;
use crate::db::columns::workspace_member as workspace_member_col;
use crate::db::rows::{ProjectCollaboratorRow, ProjectRow};
use crate::mapper::row_mapper;
use crate::repository::scope::{
    project_scoped_organization_id, project_scoped_tenant_id, project_scoped_user_id,
};
use sdkwork_birdcoder_project_service::business_code::build_project_business_code;
use sdkwork_birdcoder_project_service::domain::commands::{
    CreateProjectRequest, UpdateProjectRequest, UpsertProjectCollaboratorRequest,
};
use sdkwork_birdcoder_project_service::domain::results::{
    ProjectCollaboratorPayload, ProjectPayload,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_sqlx_repository_pool::dialect::{inserted_row_id, SET_SOFT_DELETED};

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

    fn scoped_user_id(ctx: &ProjectContext) -> Result<i64, ProjectError> {
        project_scoped_user_id(ctx)
    }

    fn parse_positive_id(value: &str, field_name: &str) -> Result<i64, ProjectError> {
        let parsed = value
            .parse::<i64>()
            .map_err(|_| ProjectError::InvalidInput(format!("invalid {field_name}: {value}")))?;
        if parsed <= 0 {
            return Err(ProjectError::InvalidInput(format!(
                "invalid {field_name}: {value}"
            )));
        }
        Ok(parsed)
    }

    fn workspace_access_predicate(workspace_alias: &str) -> String {
        format!(
            "({workspace_alias}.{owner_id} = ? OR EXISTS (\
                SELECT 1 FROM {member_table} m \
                WHERE m.{member_workspace_id} = {workspace_alias}.{workspace_id} \
                  AND m.{member_tenant_id} = {workspace_alias}.{workspace_tenant_id} \
                  AND m.{member_organization_id} = {workspace_alias}.{workspace_organization_id} \
                  AND m.{member_user_id} = ? \
                  AND m.{member_is_deleted} = 0 \
                  AND LOWER(m.{member_status}) = 'active'\
            ))",
            owner_id = workspace_col::OWNER_ID,
            member_table = workspace_member_col::TABLE,
            member_workspace_id = workspace_member_col::WORKSPACE_ID,
            workspace_id = workspace_col::ID,
            member_tenant_id = workspace_member_col::TENANT_ID,
            workspace_tenant_id = workspace_col::TENANT_ID,
            member_organization_id = workspace_member_col::ORGANIZATION_ID,
            workspace_organization_id = workspace_col::ORGANIZATION_ID,
            member_user_id = workspace_member_col::USER_ID,
            member_is_deleted = workspace_member_col::IS_DELETED,
            member_status = workspace_member_col::STATUS,
        )
    }

    fn project_read_access_predicate(project_alias: &str) -> String {
        format!(
            "({project_alias}.{project_user_id} = ? OR EXISTS (\
                SELECT 1 FROM {collaborator_table} c \
                WHERE c.{collaborator_project_id} = {project_alias}.{project_id} \
                  AND c.{collaborator_tenant_id} = {project_alias}.{project_tenant_id} \
                  AND c.{collaborator_organization_id} = {project_alias}.{project_organization_id} \
                  AND c.{collaborator_user_id} = ? \
                  AND c.{collaborator_is_deleted} = 0 \
                  AND LOWER(c.{collaborator_status}) = 'active'\
            ))",
            project_user_id = col::USER_ID,
            collaborator_table = collab_col::TABLE,
            collaborator_project_id = collab_col::PROJECT_ID,
            project_id = col::ID,
            collaborator_tenant_id = collab_col::TENANT_ID,
            project_tenant_id = col::TENANT_ID,
            collaborator_organization_id = collab_col::ORGANIZATION_ID,
            project_organization_id = col::ORGANIZATION_ID,
            collaborator_user_id = collab_col::USER_ID,
            collaborator_is_deleted = collab_col::IS_DELETED,
            collaborator_status = collab_col::STATUS,
        )
    }

    fn project_write_access_predicate(project_alias: &str) -> String {
        format!(
            "({project_alias}.{project_user_id} = ? OR EXISTS (\
                SELECT 1 FROM {collaborator_table} c \
                WHERE c.{collaborator_project_id} = {project_alias}.{project_id} \
                  AND c.{collaborator_tenant_id} = {project_alias}.{project_tenant_id} \
                  AND c.{collaborator_organization_id} = {project_alias}.{project_organization_id} \
                  AND c.{collaborator_user_id} = ? \
                  AND c.{collaborator_is_deleted} = 0 \
                  AND LOWER(c.{collaborator_status}) = 'active' \
                  AND LOWER(c.{collaborator_role}) IN ('owner', 'admin')\
            ))",
            project_user_id = col::USER_ID,
            collaborator_table = collab_col::TABLE,
            collaborator_project_id = collab_col::PROJECT_ID,
            project_id = col::ID,
            collaborator_tenant_id = collab_col::TENANT_ID,
            project_tenant_id = col::TENANT_ID,
            collaborator_organization_id = collab_col::ORGANIZATION_ID,
            project_organization_id = col::ORGANIZATION_ID,
            collaborator_user_id = collab_col::USER_ID,
            collaborator_is_deleted = collab_col::IS_DELETED,
            collaborator_status = collab_col::STATUS,
            collaborator_role = collab_col::ROLE,
        )
    }

    fn project_manage_access_predicate(project_alias: &str) -> String {
        Self::project_write_access_predicate(project_alias)
    }

    fn normalize_collaborator_role(value: Option<&str>) -> Result<&'static str, ProjectError> {
        let value = value.unwrap_or("member").trim();
        if value.len() > 32 {
            return Err(ProjectError::InvalidInput(
                "invalid collaborator role.".to_owned(),
            ));
        }
        if value.eq_ignore_ascii_case("owner") {
            Ok("owner")
        } else if value.eq_ignore_ascii_case("admin") {
            Ok("admin")
        } else if value.eq_ignore_ascii_case("member") {
            Ok("member")
        } else if value.eq_ignore_ascii_case("viewer") {
            Ok("viewer")
        } else {
            Err(ProjectError::InvalidInput(
                "role must be owner, admin, member, or viewer.".to_owned(),
            ))
        }
    }

    fn normalize_collaborator_status(value: Option<&str>) -> Result<&'static str, ProjectError> {
        let value = value.unwrap_or("active").trim();
        if value.len() > 32 {
            return Err(ProjectError::InvalidInput(
                "invalid collaborator status.".to_owned(),
            ));
        }
        if value.eq_ignore_ascii_case("invited") {
            Ok("invited")
        } else if value.eq_ignore_ascii_case("active") {
            Ok("active")
        } else if value.eq_ignore_ascii_case("suspended") {
            Ok("suspended")
        } else {
            Err(ProjectError::InvalidInput(
                "status must be invited, active, or suspended.".to_owned(),
            ))
        }
    }

    async fn ensure_project_access(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
        access_predicate: String,
    ) -> Result<(), ProjectError> {
        let project_id = Self::parse_positive_id(project_id, "project_id")?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let organization_id = project_scoped_organization_id(ctx)?;
        let user_id = Self::scoped_user_id(ctx)?;
        let sql = format!(
            "SELECT 1 FROM {table} p WHERE p.{id} = ? \
             AND p.{tenant_id_column} = ? \
             AND p.{organization_id_column} = ? \
             AND p.{is_deleted} = 0 \
             AND {access_predicate}",
            table = col::TABLE,
            id = col::ID,
            tenant_id_column = col::TENANT_ID,
            organization_id_column = col::ORGANIZATION_ID,
            is_deleted = col::IS_DELETED,
        );
        let found = sqlx::query_scalar::<_, i64>(&sql)
            .bind(project_id)
            .bind(tenant_id)
            .bind(organization_id)
            .bind(user_id)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|error| ProjectError::Repository(error.to_string()))?;

        if found.is_none() {
            return Err(ProjectError::NotFound("project not found".to_owned()));
        }
        Ok(())
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
        let id_num = Self::parse_positive_id(id, "project_id")?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let organization_id = project_scoped_organization_id(ctx)?;
        let user_id = Self::scoped_user_id(ctx)?;
        let access_predicate = Self::project_read_access_predicate("p");
        let sql = format!(
            "SELECT p.* FROM {table} p WHERE p.{id} = ? \
             AND p.{tenant_id_column} = ? \
             AND p.{organization_id_column} = ? \
             AND p.{is_deleted} = 0 \
             AND {access_predicate}",
            table = col::TABLE,
            id = col::ID,
            tenant_id_column = col::TENANT_ID,
            organization_id_column = col::ORGANIZATION_ID,
            is_deleted = col::IS_DELETED,
        );

        let row = sqlx::query(&sql)
            .bind(id_num)
            .bind(tenant_id)
            .bind(organization_id)
            .bind(user_id)
            .bind(user_id)
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
        user_id: Option<&str>,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<ProjectPayload>, usize), ProjectError> {
        let wid = Self::parse_positive_id(workspace_id, "workspace_id")?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let organization_id = project_scoped_organization_id(ctx)?;
        let authenticated_user_id = Self::scoped_user_id(ctx)?;
        let requested_user_id = user_id
            .map(|value| Self::parse_positive_id(value, "user_id"))
            .transpose()?;

        // PAGINATION_SPEC.md §2/§5: push `LIMIT`/`OFFSET` and filter
        // predicates down to SQL — never collect-then-slice in process
        // memory. The route strictly validates page/page_size before service
        let access_predicate = Self::project_read_access_predicate("p");
        let mut where_clause = format!(
            "p.{workspace_id_column} = ? \
             AND p.{tenant_id_column} = ? \
             AND p.{organization_id_column} = ? \
             AND p.{is_deleted} = 0 \
             AND {access_predicate}",
            workspace_id_column = col::WORKSPACE_ID,
            tenant_id_column = col::TENANT_ID,
            organization_id_column = col::ORGANIZATION_ID,
            is_deleted = col::IS_DELETED,
        );
        if requested_user_id.is_some() {
            where_clause.push_str(&format!(" AND p.{} = ?", col::USER_ID));
        }
        let sql = format!(
            "SELECT p.* FROM {table} p WHERE {where_clause} ORDER BY p.{id} DESC LIMIT ? OFFSET ?",
            table = col::TABLE,
            id = col::ID,
        );

        let mut q = sqlx::query(&sql)
            .bind(wid)
            .bind(tenant_id)
            .bind(organization_id)
            .bind(authenticated_user_id)
            .bind(authenticated_user_id);
        if let Some(requested_user_id) = requested_user_id {
            q = q.bind(requested_user_id);
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
        let count_sql = format!(
            "SELECT COUNT(*) FROM {table} p WHERE {where_clause}",
            table = col::TABLE,
        );
        let mut count_q = sqlx::query_scalar::<_, i64>(&count_sql)
            .bind(wid)
            .bind(tenant_id)
            .bind(organization_id)
            .bind(authenticated_user_id)
            .bind(authenticated_user_id);
        if let Some(requested_user_id) = requested_user_id {
            count_q = count_q.bind(requested_user_id);
        }
        let total: i64 = count_q
            .fetch_one(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        Ok((items, total.max(0) as usize))
    }

    async fn ensure_workspace_access(
        &self,
        ctx: &ProjectContext,
        workspace_id: &str,
    ) -> Result<(), ProjectError> {
        let workspace_id = Self::parse_positive_id(workspace_id, "workspace_id")?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let organization_id = project_scoped_organization_id(ctx)?;
        let user_id = Self::scoped_user_id(ctx)?;
        let access_predicate = Self::workspace_access_predicate("w");
        let sql = format!(
            "SELECT 1 FROM {table} w WHERE w.{id} = ? \
             AND w.{tenant_id_column} = ? \
             AND w.{organization_id_column} = ? \
             AND w.{is_deleted} = 0 \
             AND {access_predicate}",
            table = workspace_col::TABLE,
            id = workspace_col::ID,
            tenant_id_column = workspace_col::TENANT_ID,
            organization_id_column = workspace_col::ORGANIZATION_ID,
            is_deleted = workspace_col::IS_DELETED,
        );
        let found = sqlx::query_scalar::<_, i64>(&sql)
            .bind(workspace_id)
            .bind(tenant_id)
            .bind(organization_id)
            .bind(user_id)
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|error| ProjectError::Repository(error.to_string()))?;

        if found.is_none() {
            return Err(ProjectError::NotFound("workspace not found".to_owned()));
        }
        Ok(())
    }

    async fn ensure_project_write_access(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        self.ensure_project_access(ctx, project_id, Self::project_write_access_predicate("p"))
            .await
    }

    async fn ensure_project_manage_access(
        &self,
        ctx: &ProjectContext,
        project_id: &str,
    ) -> Result<(), ProjectError> {
        self.ensure_project_access(ctx, project_id, Self::project_manage_access_predicate("p"))
            .await
    }

    async fn create_project(
        &self,
        ctx: &ProjectContext,
        req: &CreateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        self.ensure_workspace_access(ctx, &req.workspace_id).await?;

        let now = Self::now_iso();
        let uuid = Uuid::new_v4().to_string();
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let organization_id = project_scoped_organization_id(ctx)?;
        let user_id = Self::scoped_user_id(ctx)?;
        let workspace_id = Self::parse_positive_id(&req.workspace_id, "workspace_id")?;
        let code = build_project_business_code(uuid.as_str(), req.name.as_str(), None);

        let id_row = sqlx::query(&format!(
            "INSERT INTO {t} (uuid, created_at, updated_at, v, tenant_id, organization_id, data_scope, user_id, name, title, code, type, description, status, workspace_id, is_deleted, is_template) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
            t = col::TABLE,
        ))
        .bind(&uuid)
        .bind(&now)
        .bind(&now)
        .bind(0i64)
        .bind(tenant_id)
        .bind(organization_id)
        .bind(1i64)
        .bind(user_id)
        .bind(&req.name)
        .bind(&req.name)
        .bind(code)
        .bind(0i64)
        .bind(req.description.as_deref())
        .bind(0i64)
        .bind(workspace_id)
        .bind(0i64)
        .bind(0i64)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| ProjectError::Repository(e.to_string()))?;

        let id = inserted_row_id(&id_row).map_err(|e| ProjectError::Repository(e.to_string()))?;
        self.find_project_by_id(ctx, &id.to_string())
            .await?
            .ok_or_else(|| ProjectError::NotFound("project not found".to_owned()))
    }

    async fn update_project(
        &self,
        ctx: &ProjectContext,
        id: &str,
        req: &UpdateProjectRequest,
    ) -> Result<ProjectPayload, ProjectError> {
        let id_num = Self::parse_positive_id(id, "project_id")?;
        self.ensure_project_write_access(ctx, id).await?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let organization_id = project_scoped_organization_id(ctx)?;
        let user_id = Self::scoped_user_id(ctx)?;
        let now = Self::now_iso();

        let mut builder: QueryBuilder<Any> =
            QueryBuilder::new(format!("UPDATE {} SET ", col::TABLE));
        {
            let mut sep = builder.separated(", ");
            sep.push(format!("{} = ", col::UPDATED_AT));
            sep.push_bind_unseparated(&now);

            if let Some(name) = req.name.as_deref() {
                sep.push(format!("{} = ", col::NAME));
                sep.push_bind_unseparated(name);
            }
            if let Some(description) = req.description.as_deref() {
                sep.push(format!("{} = ", col::DESCRIPTION));
                sep.push_bind_unseparated(description);
            }
            if let Some(status) = req.status.as_deref() {
                let status_code = match status.trim().to_ascii_lowercase().as_str() {
                    "active" => 0i64,
                    "archived" => 1i64,
                    _ => {
                        return Err(ProjectError::InvalidInput(
                            "status must be active or archived.".to_owned(),
                        ));
                    }
                };
                sep.push(format!("{} = ", col::STATUS));
                sep.push_bind_unseparated(status_code);
            }
        }

        builder.push(format!(" WHERE {} = ", col::ID));
        builder.push_bind(id_num);
        builder.push(format!(" AND {} = ", col::TENANT_ID));
        builder.push_bind(tenant_id);
        builder.push(format!(" AND {} = ", col::ORGANIZATION_ID));
        builder.push_bind(organization_id);
        builder.push(format!(" AND {} IS NOT TRUE AND ", col::IS_DELETED));
        builder.push(Self::project_write_access_predicate(col::TABLE));
        builder.push_bind(user_id);
        builder.push_bind(user_id);

        let result = builder
            .build()
            .execute(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(ProjectError::NotFound("project not found".to_owned()));
        }

        self.find_project_by_id(ctx, id)
            .await?
            .ok_or_else(|| ProjectError::NotFound("project not found".to_owned()))
    }

    async fn delete_project(&self, ctx: &ProjectContext, id: &str) -> Result<(), ProjectError> {
        let id_num = Self::parse_positive_id(id, "project_id")?;
        self.ensure_project_write_access(ctx, id).await?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let organization_id = project_scoped_organization_id(ctx)?;
        let user_id = Self::scoped_user_id(ctx)?;
        let now = Self::now_iso();
        let access_predicate = Self::project_write_access_predicate(col::TABLE);
        let sql = format!(
            "UPDATE {table} SET {soft_deleted}, {updated_at} = ? \
             WHERE {id} = ? AND {tenant_id_column} = ? \
             AND {organization_id_column} = ? AND {is_deleted} IS NOT TRUE \
             AND {access_predicate}",
            table = col::TABLE,
            soft_deleted = SET_SOFT_DELETED,
            updated_at = col::UPDATED_AT,
            id = col::ID,
            tenant_id_column = col::TENANT_ID,
            organization_id_column = col::ORGANIZATION_ID,
            is_deleted = col::IS_DELETED,
        );

        let result = sqlx::query(&sql)
            .bind(&now)
            .bind(id_num)
            .bind(tenant_id)
            .bind(organization_id)
            .bind(user_id)
            .bind(user_id)
            .execute(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(ProjectError::NotFound("project not found".to_owned()));
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
        self.ensure_project_access(ctx, project_id, Self::project_read_access_predicate("p"))
            .await?;
        let pid = Self::parse_positive_id(project_id, "project_id")?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let organization_id = project_scoped_organization_id(ctx)?;
        // PAGINATION_SPEC.md §2/§5: push LIMIT/OFFSET to SQL.
        let rows = sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {} IS NOT TRUE ORDER BY {} DESC LIMIT ? OFFSET ?",
            collab_col::TABLE,
            collab_col::PROJECT_ID,
            collab_col::TENANT_ID,
            collab_col::ORGANIZATION_ID,
            collab_col::IS_DELETED,
            collab_col::ID,
        ))
        .bind(pid)
        .bind(tenant_id)
        .bind(organization_id)
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
            "SELECT COUNT(*) FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {} IS NOT TRUE",
            collab_col::TABLE,
            collab_col::PROJECT_ID,
            collab_col::TENANT_ID,
            collab_col::ORGANIZATION_ID,
            collab_col::IS_DELETED,
        ))
        .bind(pid)
        .bind(tenant_id)
        .bind(organization_id)
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
        self.ensure_project_manage_access(ctx, project_id).await?;
        let project = self
            .find_project_by_id(ctx, project_id)
            .await?
            .ok_or_else(|| ProjectError::NotFound("project not found".to_owned()))?;
        let pid = Self::parse_positive_id(project_id, "project_id")?;
        let uid = Self::parse_positive_id(&req.user_id, "user_id")?;
        let now = Self::now_iso();
        let uuid = Uuid::new_v4().to_string();
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let organization_id = project_scoped_organization_id(ctx)?;
        let actor_user_id = Self::scoped_user_id(ctx)?;
        let workspace_id = Self::parse_positive_id(&project.workspace_id, "workspace_id")?;
        let role = Self::normalize_collaborator_role(req.role.as_deref())?;
        let status = Self::normalize_collaborator_status(req.status.as_deref())?;

        let existing: Option<i64> = sqlx::query_scalar(&format!(
            "SELECT {} FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} IS NOT TRUE",
            collab_col::ID,
            collab_col::TABLE,
            collab_col::PROJECT_ID,
            collab_col::TENANT_ID,
            collab_col::ORGANIZATION_ID,
            collab_col::USER_ID,
            collab_col::IS_DELETED,
        ))
        .bind(pid)
        .bind(tenant_id)
        .bind(organization_id)
        .bind(uid)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| ProjectError::Repository(e.to_string()))?;

        if let Some(existing_id) = existing {
            let result = sqlx::query(&format!(
                "UPDATE {} SET {} = ?, {} = ?, {} = ?, {} = ? WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} IS NOT TRUE",
                collab_col::TABLE,
                collab_col::ROLE,
                collab_col::STATUS,
                collab_col::GRANTED_BY_USER_ID,
                collab_col::UPDATED_AT,
                collab_col::ID,
                collab_col::TENANT_ID,
                collab_col::ORGANIZATION_ID,
                collab_col::PROJECT_ID,
                collab_col::USER_ID,
                collab_col::IS_DELETED,
            ))
            .bind(role)
            .bind(status)
            .bind(actor_user_id)
            .bind(&now)
            .bind(existing_id)
            .bind(tenant_id)
            .bind(organization_id)
            .bind(pid)
            .bind(uid)
            .execute(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
            if result.rows_affected() == 0 {
                return Err(ProjectError::NotFound(
                    "project collaborator not found".to_owned(),
                ));
            }
            let row = sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} IS NOT TRUE",
                collab_col::TABLE,
                collab_col::ID,
                collab_col::TENANT_ID,
                collab_col::ORGANIZATION_ID,
                collab_col::PROJECT_ID,
                collab_col::USER_ID,
                collab_col::IS_DELETED,
            ))
            .bind(existing_id)
            .bind(tenant_id)
            .bind(organization_id)
            .bind(pid)
            .bind(uid)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;
            let r = ProjectCollaboratorRow::from_row(&row)
                .map_err(|e| ProjectError::Repository(e.to_string()))?;
            Ok(row_mapper::project_collaborator_row_to_payload(&r))
        } else {
            let id_row = sqlx::query(&format!(
                "INSERT INTO {t} (uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted, project_id, workspace_id, user_id, role, created_by_user_id, granted_by_user_id, status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id",
                t = collab_col::TABLE,
            ))
            .bind(&uuid)
            .bind(tenant_id)
            .bind(organization_id)
            .bind(&now)
            .bind(&now)
            .bind(0i64)
            .bind(0i64)
            .bind(pid)
            .bind(workspace_id)
            .bind(uid)
            .bind(role)
            .bind(actor_user_id)
            .bind(actor_user_id)
            .bind(status)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| ProjectError::Repository(e.to_string()))?;

            let new_id =
                inserted_row_id(&id_row).map_err(|e| ProjectError::Repository(e.to_string()))?;
            let row = sqlx::query(&format!(
                "SELECT * FROM {} WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} IS NOT TRUE",
                collab_col::TABLE,
                collab_col::ID,
                collab_col::TENANT_ID,
                collab_col::ORGANIZATION_ID,
                collab_col::PROJECT_ID,
                collab_col::USER_ID,
                collab_col::IS_DELETED,
            ))
            .bind(new_id)
            .bind(tenant_id)
            .bind(organization_id)
            .bind(pid)
            .bind(uid)
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
        ctx: &ProjectContext,
        project_id: &str,
        user_id: &str,
    ) -> Result<(), ProjectError> {
        self.ensure_project_manage_access(ctx, project_id).await?;

        let project_id = Self::parse_positive_id(project_id, "project_id")?;
        let user_id = Self::parse_positive_id(user_id, "user_id")?;
        let tenant_id = project_scoped_tenant_id(ctx)?;
        let organization_id = project_scoped_organization_id(ctx)?;
        let now = Self::now_iso();
        let result = sqlx::query(&format!(
            "UPDATE {} SET {}, {} = ? WHERE {} = ? AND {} = ? AND {} = ? AND {} = ? AND {} IS NOT TRUE",
            collab_col::TABLE,
            SET_SOFT_DELETED,
            collab_col::UPDATED_AT,
            collab_col::PROJECT_ID,
            collab_col::USER_ID,
            collab_col::TENANT_ID,
            collab_col::ORGANIZATION_ID,
            collab_col::IS_DELETED,
        ))
        .bind(&now)
        .bind(project_id)
        .bind(user_id)
        .bind(tenant_id)
        .bind(organization_id)
        .execute(&self.pool)
        .await
        .map_err(|e| ProjectError::Repository(e.to_string()))?;
        if result.rows_affected() == 0 {
            return Err(ProjectError::NotFound(
                "project collaborator not found".to_owned(),
            ));
        }
        Ok(())
    }
}
