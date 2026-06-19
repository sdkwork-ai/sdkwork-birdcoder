use sqlx::SqlitePool;

use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;

use crate::db::columns;
use crate::error::RepositoryError;

pub fn parse_scoped_tenant_id(ctx: &CodingSessionContext) -> Option<i64> {
    ctx.tenant_id
        .parse::<i64>()
        .ok()
        .filter(|tenant_id| *tenant_id > 0)
}

pub fn append_session_tenant_scope_sql(
    ctx: &CodingSessionContext,
    session_alias: &str,
    sql: &mut String,
) -> Option<i64> {
    let tenant_id = parse_scoped_tenant_id(ctx)?;
    sql.push_str(&format!(
        " AND EXISTS (SELECT 1 FROM studio_workspace w WHERE CAST(w.id AS TEXT) = {session_alias}.workspace_id AND w.tenant_id = ? AND w.is_deleted = 0)"
    ));
    Some(tenant_id)
}

pub async fn ensure_workspace_in_tenant_scope(
    pool: &SqlitePool,
    ctx: &CodingSessionContext,
    workspace_id: &str,
) -> Result<(), RepositoryError> {
    let Some(tenant_id) = parse_scoped_tenant_id(ctx) else {
        return Ok(());
    };
    let workspace_id = workspace_id.trim();
    if workspace_id.is_empty() {
        return Err(RepositoryError::NotFound("workspace not found".into()));
    }
    let row = sqlx::query(
        "SELECT 1 FROM studio_workspace WHERE CAST(id AS TEXT) = ?1 AND tenant_id = ?2 AND is_deleted = 0",
    )
    .bind(workspace_id)
    .bind(tenant_id)
    .fetch_optional(pool)
    .await?;
    if row.is_none() {
        return Err(RepositoryError::NotFound(format!(
            "workspace {workspace_id} not found"
        )));
    }
    Ok(())
}

pub async fn ensure_session_in_tenant_scope(
    pool: &SqlitePool,
    ctx: &CodingSessionContext,
    session_id: &str,
) -> Result<(), RepositoryError> {
    if parse_scoped_tenant_id(ctx).is_none() {
        return Ok(());
    }
    let mut sql = format!(
        "SELECT 1 FROM {} s WHERE s.{} = ? AND s.{} = 0",
        columns::session::TABLE,
        columns::session::ID,
        columns::session::IS_DELETED,
    );
    let tenant_id = append_session_tenant_scope_sql(ctx, "s", &mut sql);
    let mut query = sqlx::query(&sql).bind(session_id);
    if let Some(tenant_id) = tenant_id {
        query = query.bind(tenant_id);
    }
    let row = query.fetch_optional(pool).await?;
    if row.is_none() {
        return Err(RepositoryError::NotFound(format!(
            "session {session_id} not found"
        )));
    }
    Ok(())
}

