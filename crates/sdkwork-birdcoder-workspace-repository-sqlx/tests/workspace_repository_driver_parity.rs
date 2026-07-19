use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqliteWorkspaceRepository;
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_birdcoder_workspace_service::domain::commands::{
    CreateWorkspaceRequest, UpdateWorkspaceRequest, UpsertWorkspaceMemberRequest,
};
use sdkwork_birdcoder_workspace_service::domain::models::{ListPagination, WorkspaceScopedQuery};
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_birdcoder_workspace_service::ports::repository::WorkspaceRepository;
use serde_json::json;
use sqlx::any::AnyPoolOptions;
use sqlx::postgres::PgPoolOptions;
use sqlx::AnyPool;
use time::format_description::well_known::Iso8601;
use time::OffsetDateTime;
use uuid::Uuid;

const SQLITE_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/sqlite/0001_birdcoder_baseline.sql");
const POSTGRES_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/postgres/0001_birdcoder_baseline.sql");

fn context() -> WorkspaceContext {
    WorkspaceContext {
        tenant_id: "100001".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "200001".to_owned(),
    }
}

fn create_request() -> CreateWorkspaceRequest {
    CreateWorkspaceRequest {
        name: "Driver parity workspace".to_owned(),
        description: Some("Created by the repository parity test".to_owned()),
        tenant_id: Some("100001".to_owned()),
        organization_id: Some("0".to_owned()),
        data_scope: Some("PRIVATE".to_owned()),
        code: Some("driver-parity".to_owned()),
        title: Some("Driver parity".to_owned()),
        owner_id: None,
        leader_id: Some("200001".to_owned()),
        created_by_user_id: Some("200001".to_owned()),
        icon: Some("workspace".to_owned()),
        color: Some("#336699".to_owned()),
        entity_type: Some("development".to_owned()),
        start_time: Some("2026-07-19T00:00:00Z".to_owned()),
        end_time: Some("2026-08-19T00:00:00Z".to_owned()),
        max_members: Some(10),
        current_members: Some(1),
        member_count: Some(1),
        max_storage: Some("4096".to_owned()),
        used_storage: Some("64".to_owned()),
        settings: Some(json!({"reviewMode": "strict"})),
        is_public: Some(true),
        is_template: Some(false),
    }
}

fn update_request() -> UpdateWorkspaceRequest {
    UpdateWorkspaceRequest {
        name: Some("Updated driver parity workspace".to_owned()),
        description: Some("Updated through the portable query builder".to_owned()),
        data_scope: Some("ORGANIZATION".to_owned()),
        code: Some("driver-parity-updated".to_owned()),
        title: Some("Updated driver parity".to_owned()),
        owner_id: Some("200001".to_owned()),
        leader_id: Some("200001".to_owned()),
        icon: Some("folder".to_owned()),
        color: Some("#224466".to_owned()),
        entity_type: Some("development".to_owned()),
        start_time: Some("2026-07-20T00:00:00Z".to_owned()),
        end_time: Some("2026-09-20T00:00:00Z".to_owned()),
        max_members: Some(20),
        current_members: Some(2),
        member_count: Some(2),
        max_storage: Some("8192".to_owned()),
        used_storage: Some("128".to_owned()),
        settings: Some(json!({"reviewMode": "balanced"})),
        is_public: Some(false),
        is_template: Some(true),
        status: Some("active".to_owned()),
    }
}

fn timestamp_matches(actual: Option<&str>, expected: &str) -> bool {
    let Some(actual) = actual else {
        return false;
    };
    let Ok(actual) = OffsetDateTime::parse(actual, &Iso8601::DEFAULT) else {
        return false;
    };
    let Ok(expected) = OffsetDateTime::parse(expected, &Iso8601::DEFAULT) else {
        return false;
    };
    actual == expected
}

async fn exercise_workspace_repository(pool: AnyPool) -> Result<(), String> {
    let repository = SqliteWorkspaceRepository::new(pool);
    let context = context();
    let created = repository
        .create_workspace(&context, &create_request())
        .await
        .map_err(|error| format!("create workspace: {error}"))?;

    if created
        .uuid
        .as_deref()
        .is_none_or(|value| Uuid::parse_str(value).is_err())
    {
        return Err("created workspace must expose its UUID".to_owned());
    }
    if created.settings != Some(json!({"reviewMode": "strict"}))
        || !timestamp_matches(created.start_time.as_deref(), "2026-07-19T00:00:00Z")
        || !timestamp_matches(created.end_time.as_deref(), "2026-08-19T00:00:00Z")
        || created.current_members != Some(1)
        || created.member_count != Some(1)
        || created.max_storage.as_deref() != Some("4096")
        || created.used_storage.as_deref() != Some("64")
        || created.is_public != Some(true)
        || created.is_template != Some(false)
    {
        return Err("created workspace lost typed persistence fields".to_owned());
    }

    let query = WorkspaceScopedQuery {
        root_path: None,
        user_id: Some(context.user_id.clone()),
        workspace_id: Some(created.id.clone()),
        pagination: ListPagination {
            offset: Some(0),
            page_size: Some(20),
        },
    };
    let (listed, total) = repository
        .list_workspaces(&context, &query)
        .await
        .map_err(|error| format!("list workspaces: {error}"))?;
    if total != 1 || listed.len() != 1 {
        return Err("created workspace was not returned by the scoped list".to_owned());
    }

    let other_organization = WorkspaceContext {
        organization_id: "300001".to_owned(),
        ..context.clone()
    };
    if repository
        .find_workspace_by_id(&other_organization, &created.id)
        .await
        .map_err(|error| format!("find workspace from another organization: {error}"))?
        .is_some()
    {
        return Err("workspace leaked across organization scope".to_owned());
    }
    if !matches!(
        repository
            .ensure_workspace_access(&other_organization, &created.id)
            .await,
        Err(WorkspaceError::NotFound(_))
    ) {
        return Err("workspace access did not enforce organization scope".to_owned());
    }

    let updated = repository
        .update_workspace(&context, &created.id, &update_request())
        .await
        .map_err(|error| format!("update workspace: {error}"))?;
    if updated.name != "Updated driver parity workspace"
        || updated.settings != Some(json!({"reviewMode": "balanced"}))
        || !timestamp_matches(updated.start_time.as_deref(), "2026-07-20T00:00:00Z")
        || !timestamp_matches(updated.end_time.as_deref(), "2026-09-20T00:00:00Z")
        || updated.current_members != Some(2)
        || updated.member_count != Some(2)
        || updated.max_storage.as_deref() != Some("8192")
        || updated.used_storage.as_deref() != Some("128")
        || updated.is_public != Some(false)
        || updated.is_template != Some(true)
    {
        return Err("updated workspace lost typed persistence fields".to_owned());
    }

    let member = repository
        .upsert_workspace_member(
            &context,
            &created.id,
            &UpsertWorkspaceMemberRequest {
                user_id: Some("200002".to_owned()),
                email: None,
                team_id: None,
                role: Some("member".to_owned()),
                status: Some("active".to_owned()),
                created_by_user_id: Some(context.user_id.clone()),
                granted_by_user_id: Some(context.user_id.clone()),
            },
        )
        .await
        .map_err(|error| format!("upsert workspace member: {error}"))?;
    if member.organization_id.as_deref() != Some("0") || member.created_at.is_none() {
        return Err("workspace member lost scope or timestamp fields".to_owned());
    }

    let member_context = WorkspaceContext {
        user_id: "200002".to_owned(),
        ..context.clone()
    };
    repository
        .ensure_workspace_access(&member_context, &created.id)
        .await
        .map_err(|error| format!("workspace member access: {error}"))?;

    let (members, member_total) = repository
        .list_workspace_members(&context, &created.id, 0, 20)
        .await
        .map_err(|error| format!("list workspace members: {error}"))?;
    if member_total != 1 || members.len() != 1 {
        return Err("workspace member was not returned by the scoped list".to_owned());
    }

    repository
        .remove_workspace_member(&context, &created.id, "200002")
        .await
        .map_err(|error| format!("remove workspace member: {error}"))?;
    repository
        .delete_workspace(&context, &created.id)
        .await
        .map_err(|error| format!("delete workspace: {error}"))?;
    if repository
        .find_workspace_by_id(&context, &created.id)
        .await
        .map_err(|error| format!("find deleted workspace: {error}"))?
        .is_some()
    {
        return Err("soft-deleted workspace remained visible".to_owned());
    }

    Ok(())
}

#[tokio::test]
async fn sqlite_workspace_repository_preserves_typed_fields() {
    sqlx::any::install_default_drivers();
    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("connect SQLite");
    sqlx::raw_sql(SQLITE_BASELINE)
        .execute(&pool)
        .await
        .expect("apply SQLite baseline");

    exercise_workspace_repository(pool.clone())
        .await
        .expect("exercise SQLite workspace repository");
    pool.close().await;
}

#[tokio::test]
#[ignore = "requires SDKWORK_BIRDCODER_POSTGRES_TEST_URL"]
async fn postgres_workspace_repository_preserves_typed_fields() {
    sqlx::any::install_default_drivers();
    let database_url = std::env::var("SDKWORK_BIRDCODER_POSTGRES_TEST_URL")
        .expect("SDKWORK_BIRDCODER_POSTGRES_TEST_URL must be set");
    let schema = format!("birdcoder_workspace_test_{}", Uuid::new_v4().simple());
    let admin_pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("connect PostgreSQL admin pool");
    sqlx::query(&format!("CREATE SCHEMA \"{schema}\""))
        .execute(&admin_pool)
        .await
        .expect("create isolated PostgreSQL schema");

    let pool = AnyPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("connect PostgreSQL AnyPool");
    sqlx::query(&format!("SET search_path TO \"{schema}\""))
        .execute(&pool)
        .await
        .expect("select isolated PostgreSQL schema");
    let result = async {
        sqlx::raw_sql(POSTGRES_BASELINE)
            .execute(&pool)
            .await
            .map_err(|error| error.to_string())?;
        exercise_workspace_repository(pool.clone()).await
    }
    .await;

    pool.close().await;
    sqlx::query(&format!("DROP SCHEMA \"{schema}\" CASCADE"))
        .execute(&admin_pool)
        .await
        .expect("remove isolated PostgreSQL schema");
    admin_pool.close().await;
    result.expect("exercise PostgreSQL workspace repository");
}
