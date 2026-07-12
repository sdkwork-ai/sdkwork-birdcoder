use sqlx::AnyPool;

use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_errors::{require_scoped_tenant_id, require_scoped_user_id};
use sdkwork_birdcoder_sqlx_repository_pool::dialect::{any_sql, IS_NOT_DELETED};

use crate::db::columns;
use crate::error::RepositoryError;

pub fn parse_scoped_tenant_id(ctx: &CodingSessionContext) -> Result<i64, RepositoryError> {
    require_scoped_tenant_id(&ctx.tenant_id)
        .map_err(|_| RepositoryError::Query("a valid tenant scope is required".to_string()))
}

pub fn parse_scoped_user_id(ctx: &CodingSessionContext) -> Result<i64, RepositoryError> {
    require_scoped_user_id(&ctx.user_id)
        .map_err(|_| RepositoryError::Query("a valid user scope is required".to_string()))
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct SessionOwnerScope {
    pub tenant_id: i64,
    pub user_id: i64,
}

pub fn session_owner_scope(
    ctx: &CodingSessionContext,
) -> Result<SessionOwnerScope, RepositoryError> {
    Ok(SessionOwnerScope {
        tenant_id: parse_scoped_tenant_id(ctx)?,
        user_id: parse_scoped_user_id(ctx)?,
    })
}

pub fn append_session_owner_scope_sql(
    ctx: &CodingSessionContext,
    session_alias: &str,
    sql: &mut String,
) -> Result<SessionOwnerScope, RepositoryError> {
    let scope = session_owner_scope(ctx)?;
    sql.push_str(&format!(
        " AND EXISTS (SELECT 1 FROM studio_workspace w WHERE CAST(w.id AS TEXT) = {session_alias}.workspace_id AND w.tenant_id = ? AND w.{IS_NOT_DELETED}) \
         AND {session_alias}.user_id = ?"
    ));
    Ok(scope)
}

pub async fn ensure_workspace_in_tenant_scope(
    pool: &AnyPool,
    ctx: &CodingSessionContext,
    workspace_id: &str,
) -> Result<(), RepositoryError> {
    let tenant_id = parse_scoped_tenant_id(ctx)?;
    let workspace_id = workspace_id.trim();
    if workspace_id.is_empty() {
        return Err(RepositoryError::NotFound("workspace not found".into()));
    }
    let sql = any_sql(&format!(
        "SELECT 1 FROM studio_workspace WHERE CAST(id AS TEXT) = ?1 AND tenant_id = ?2 AND {IS_NOT_DELETED}",
    ));
    let row = sqlx::query(&sql)
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
    pool: &AnyPool,
    ctx: &CodingSessionContext,
    session_id: &str,
) -> Result<(), RepositoryError> {
    ensure_session_in_tenant_scope_on_executor(pool, ctx, session_id).await
}

pub async fn ensure_session_in_tenant_scope_in_transaction(
    tx: &mut sqlx::Transaction<'_, sqlx::Any>,
    ctx: &CodingSessionContext,
    session_id: &str,
) -> Result<(), RepositoryError> {
    ensure_session_in_tenant_scope_on_executor(&mut **tx, ctx, session_id).await
}

async fn ensure_session_in_tenant_scope_on_executor<'e, E>(
    executor: E,
    ctx: &CodingSessionContext,
    session_id: &str,
) -> Result<(), RepositoryError>
where
    E: sqlx::Executor<'e, Database = sqlx::Any>,
{
    let mut sql = format!(
        "SELECT 1 FROM {} s WHERE s.{} = ? AND s.{IS_NOT_DELETED}",
        columns::session::TABLE,
        columns::session::ID,
    );
    let scope = append_session_owner_scope_sql(ctx, "s", &mut sql)?;
    let row = sqlx::query(&sql)
        .bind(session_id)
        .bind(scope.tenant_id)
        .bind(scope.user_id)
        .fetch_optional(executor)
        .await?;
    if row.is_none() {
        return Err(RepositoryError::NotFound(format!(
            "session {session_id} not found"
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use sqlx::any::AnyPoolOptions;

    use super::*;

    #[tokio::test]
    async fn workspace_scope_accepts_an_active_workspace_for_the_current_tenant() {
        sqlx::any::install_default_drivers();
        let pool = AnyPoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("open in-memory sqlite pool");
        sqlx::query(
            "CREATE TABLE studio_workspace (\
                id INTEGER PRIMARY KEY, \
                tenant_id INTEGER NOT NULL, \
                is_deleted INTEGER NOT NULL DEFAULT 0\
            )",
        )
        .execute(&pool)
        .await
        .expect("create workspace table");
        sqlx::query("INSERT INTO studio_workspace (id, tenant_id, is_deleted) VALUES (101, 1, 0)")
            .execute(&pool)
            .await
            .expect("seed active workspace");

        let context = CodingSessionContext {
            tenant_id: "1".to_owned(),
            user_id: "1".to_owned(),
            session_id: "scope-test".to_owned(),
        };

        ensure_workspace_in_tenant_scope(&pool, &context, "101")
            .await
            .expect("accept an active workspace belonging to the current tenant");
    }
}
