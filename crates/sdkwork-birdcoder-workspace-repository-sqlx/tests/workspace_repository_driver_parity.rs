use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqlxWorkspaceRepository;
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_birdcoder_workspace_service::domain::commands::{
    CreateWorkspaceRequest, UpdateWorkspaceRequest,
};
use sdkwork_birdcoder_workspace_service::domain::models::{
    ListPagination, WorkspaceScopedQuery,
};
use sdkwork_birdcoder_workspace_service::error::WorkspaceError;
use sdkwork_birdcoder_workspace_service::ports::repository::WorkspaceRepository;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_utils_rust::uuid;
use sqlx::postgres::PgPoolOptions;
use sqlx::sqlite::SqlitePoolOptions;

const SQLITE_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/sqlite/0001_birdcoder_baseline.sql");
const POSTGRES_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/postgres/0001_birdcoder_baseline.sql");

fn owner_context() -> WorkspaceContext {
    WorkspaceContext {
        tenant_id: "100001".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "200001".to_owned(),
    }
}

fn create_request() -> CreateWorkspaceRequest {
    CreateWorkspaceRequest {
        name: "Primary workspace".to_owned(),
        description: Some("Canonical workbench workspace".to_owned()),
        code: Some("primary-workspace".to_owned()),
        icon_url: Some("https://assets.example.com/workspace.png".to_owned()),
        color: Some("#1264a3".to_owned()),
        visibility: Some("organization".to_owned()),
    }
}

async fn exercise_repository(repository: SqlxWorkspaceRepository) -> Result<(), WorkspaceError> {
    let context = owner_context();
    let created = repository
        .create_workspace(&context, &create_request())
        .await?;
    assert!(created.id.parse::<i64>().is_ok());
    assert_eq!(created.owner_user_id, context.user_id);
    assert_eq!(created.visibility, "organization");
    assert_eq!(created.version, "0");

    let query = WorkspaceScopedQuery {
        user_id: Some(context.user_id.clone()),
        pagination: ListPagination {
            offset: Some(0),
            page_size: Some(20),
        },
    };
    let (items, total) = repository.list_workspaces(&context, &query).await?;
    assert_eq!(total, 1);
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].id, created.id);

    let organization_reader = WorkspaceContext {
        user_id: "200002".to_owned(),
        ..context.clone()
    };
    assert!(repository
        .find_workspace_by_id(&organization_reader, &created.id)
        .await?
        .is_some());
    let isolated_tenant = WorkspaceContext {
        tenant_id: "100002".to_owned(),
        ..organization_reader
    };
    assert!(repository
        .find_workspace_by_id(&isolated_tenant, &created.id)
        .await?
        .is_none());

    let updated = repository
        .update_workspace(
            &context,
            &created.id,
            &UpdateWorkspaceRequest {
                name: Some("Primary workspace v2".to_owned()),
                description: None,
                code: None,
                icon_url: None,
                color: Some("#0b8043".to_owned()),
                visibility: None,
                status: None,
                expected_version: 0,
            },
        )
        .await?;
    assert_eq!(updated.name, "Primary workspace v2");
    assert_eq!(updated.version, "1");
    assert!(matches!(
        repository
            .update_workspace(
                &context,
                &created.id,
                &UpdateWorkspaceRequest {
                    name: Some("stale".to_owned()),
                    description: None,
                    code: None,
                    icon_url: None,
                    color: None,
                    visibility: None,
                    status: None,
                    expected_version: 0,
                },
            )
            .await,
        Err(WorkspaceError::PreconditionFailed(_))
    ));

    repository.delete_workspace(&context, &created.id, 1).await?;
    assert!(repository
        .find_workspace_by_id(&context, &created.id)
        .await?
        .is_none());
    Ok(())
}

#[tokio::test]
async fn sqlite_workspace_repository_matches_the_canonical_baseline() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("connect SQLite");
    sqlx::raw_sql(SQLITE_BASELINE)
        .execute(&pool)
        .await
        .expect("apply canonical SQLite baseline");
    let generator = SnowflakeIdGenerator::new(11).expect("construct Snowflake generator");
    exercise_repository(SqlxWorkspaceRepository::from_sqlite(pool, generator))
        .await
        .expect("exercise SQLite workspace repository");
}

#[tokio::test]
#[ignore = "requires SDKWORK_BIRDCODER_POSTGRES_TEST_URL"]
async fn postgres_workspace_repository_matches_the_canonical_baseline() {
    let database_url = std::env::var("SDKWORK_BIRDCODER_POSTGRES_TEST_URL")
        .expect("SDKWORK_BIRDCODER_POSTGRES_TEST_URL must be set");
    let schema = format!("birdcoder_workspace_test_{}", uuid().replace('-', ""));
    let pool = PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("connect PostgreSQL");
    sqlx::query(&format!(r#"CREATE SCHEMA "{schema}""#))
        .execute(&pool)
        .await
        .expect("create PostgreSQL test schema");
    sqlx::query(&format!(r#"SET search_path TO "{schema}""#))
        .execute(&pool)
        .await
        .expect("select PostgreSQL test schema");
    let result = async {
        sqlx::raw_sql(POSTGRES_BASELINE)
            .execute(&pool)
            .await
            .map_err(|error| error.to_string())?;
        let generator = SnowflakeIdGenerator::new(12).map_err(|error| error.to_string())?;
        exercise_repository(SqlxWorkspaceRepository::from_postgres(
            pool.clone(),
            generator,
        ))
        .await
        .map_err(|error| error.to_string())
    }
    .await;
    sqlx::query("SET search_path TO public")
        .execute(&pool)
        .await
        .expect("restore PostgreSQL search path");
    sqlx::query(&format!(r#"DROP SCHEMA "{schema}" CASCADE"#))
        .execute(&pool)
        .await
        .expect("drop PostgreSQL test schema");
    result.expect("exercise PostgreSQL workspace repository");
}
