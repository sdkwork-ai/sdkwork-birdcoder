use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::commands::{
    CreateProjectRequest, UpdateProjectRequest,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::repository::ProjectRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project::SqlxProjectRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqlxWorkspaceRepository;
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_birdcoder_workspace_service::domain::commands::CreateWorkspaceRequest;
use sdkwork_birdcoder_workspace_service::ports::repository::WorkspaceRepository;
use sdkwork_database_id::SnowflakeIdGenerator;
use sdkwork_utils_rust::uuid;
use sqlx::postgres::PgPoolOptions;
use sqlx::sqlite::SqlitePoolOptions;
use sqlx::SqlitePool;

const SQLITE_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/sqlite/0001_birdcoder_baseline.sql");
const POSTGRES_BASELINE: &str =
    include_str!("../../../database/ddl/baseline/postgres/0001_birdcoder_baseline.sql");

fn workspace_context() -> WorkspaceContext {
    WorkspaceContext {
        tenant_id: "100001".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "200001".to_owned(),
    }
}

fn project_context() -> ProjectContext {
    ProjectContext {
        tenant_id: "100001".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "200001".to_owned(),
    }
}

async fn create_workspace(repository: &SqlxWorkspaceRepository) -> String {
    repository
        .create_workspace(
            &workspace_context(),
            &CreateWorkspaceRequest {
                name: "Primary workspace".to_owned(),
                description: None,
                code: Some("primary-workspace".to_owned()),
                icon_url: None,
                color: None,
                visibility: Some("organization".to_owned()),
            },
        )
        .await
        .expect("create workspace")
        .id
}

async fn exercise_repository(
    workspace_repository: SqlxWorkspaceRepository,
    project_repository: SqlxProjectRepository,
) -> Result<(), ProjectError> {
    let context = project_context();
    let workspace_id = create_workspace(&workspace_repository).await;
    let created = project_repository
        .create_project(
            &context,
            &CreateProjectRequest {
                workspace_id: workspace_id.clone(),
                name: "BirdCoder core".to_owned(),
                description: Some("Canonical coding workbench project".to_owned()),
                code: Some("birdcoder-core".to_owned()),
                project_kind: Some("coding".to_owned()),
                default_agent_project_id: Some("project.primary".to_owned()),
            },
        )
        .await?;
    assert!(created.id.parse::<i64>().is_ok());
    assert_eq!(created.workspace_id, workspace_id);
    assert_eq!(created.default_agent_project_id.as_deref(), Some("project.primary"));
    assert_eq!(created.version, "0");

    let (items, total) = project_repository
        .list_projects_by_workspace(&context, &workspace_id, None, 0, 20)
        .await?;
    assert_eq!(total, 1);
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].id, created.id);
    assert!(matches!(
        project_repository
            .list_projects_by_workspace(
                &context,
                &workspace_id,
                Some("200002"),
                0,
                20,
            )
            .await,
        Err(ProjectError::Forbidden(_))
    ));

    let organization_reader = ProjectContext {
        user_id: "200002".to_owned(),
        ..context.clone()
    };
    assert!(project_repository
        .find_project_by_id(&organization_reader, &created.id)
        .await?
        .is_some());
    assert!(matches!(
        project_repository
            .ensure_project_write_access(&organization_reader, &created.id)
            .await,
        Err(ProjectError::NotFound(_))
    ));
    let isolated_organization = ProjectContext {
        organization_id: "1".to_owned(),
        ..organization_reader
    };
    assert!(project_repository
        .find_project_by_id(&isolated_organization, &created.id)
        .await?
        .is_none());

    let updated = project_repository
        .update_project(
            &context,
            &created.id,
            &UpdateProjectRequest {
                name: Some("BirdCoder core v2".to_owned()),
                description: None,
                code: None,
                project_kind: None,
                default_agent_project_id: Some("project.v2".to_owned()),
                status: None,
                expected_version: 0,
            },
        )
        .await?;
    assert_eq!(updated.name, "BirdCoder core v2");
    assert_eq!(updated.version, "1");
    assert!(matches!(
        project_repository
            .update_project(
                &context,
                &created.id,
                &UpdateProjectRequest {
                    name: Some("stale".to_owned()),
                    description: None,
                    code: None,
                    project_kind: None,
                    default_agent_project_id: None,
                    status: None,
                    expected_version: 0,
                },
            )
            .await,
        Err(ProjectError::PreconditionFailed(_))
    ));

    project_repository
        .delete_project(&context, &created.id, 1)
        .await?;
    assert!(project_repository
        .find_project_by_id(&context, &created.id)
        .await?
        .is_none());
    Ok(())
}

async fn sqlite_repositories(
    pool: &SqlitePool,
    node_id: u16,
) -> (SqlxWorkspaceRepository, SqlxProjectRepository) {
    let generator = SnowflakeIdGenerator::new(node_id).expect("construct Snowflake generator");
    (
        SqlxWorkspaceRepository::from_sqlite(pool.clone(), generator.clone()),
        SqlxProjectRepository::from_sqlite(pool.clone(), generator),
    )
}

#[tokio::test]
async fn sqlite_project_repository_matches_the_canonical_baseline() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("connect SQLite");
    sqlx::raw_sql(SQLITE_BASELINE)
        .execute(&pool)
        .await
        .expect("apply canonical SQLite baseline");
    let (workspace_repository, project_repository) = sqlite_repositories(&pool, 13).await;
    exercise_repository(workspace_repository, project_repository)
        .await
        .expect("exercise SQLite project repository");
}

#[tokio::test]
async fn project_delete_rejects_active_owned_bindings() {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("connect SQLite");
    sqlx::raw_sql(SQLITE_BASELINE)
        .execute(&pool)
        .await
        .expect("apply canonical SQLite baseline");
    let (workspace_repository, project_repository) = sqlite_repositories(&pool, 14).await;
    let workspace_id = create_workspace(&workspace_repository).await;
    let project = project_repository
        .create_project(
            &project_context(),
            &CreateProjectRequest {
                workspace_id,
                name: "Bound project".to_owned(),
                description: None,
                code: Some("bound-project".to_owned()),
                project_kind: Some("coding".to_owned()),
                default_agent_project_id: None,
            },
        )
        .await
        .expect("create project");
    sqlx::query(
        r#"
INSERT INTO studio_project_document_binding (
    id, uuid, tenant_id, organization_id, project_id, document_id,
    binding_kind, created_by_user_id, version, created_at, updated_at, is_deleted
) VALUES (?, ?, 100001, 0, ?, 'document-primary', 'specification', 200001, 0, ?, ?, 0)
"#,
    )
    .bind(9_000_001_i64)
    .bind(uuid())
    .bind(project.id.parse::<i64>().expect("numeric project id"))
    .bind("2026-01-01T00:00:00.000Z")
    .bind("2026-01-01T00:00:00.000Z")
    .execute(&pool)
    .await
    .expect("seed project document binding");
    assert!(matches!(
        project_repository
            .delete_project(&project_context(), &project.id, 0)
            .await,
        Err(ProjectError::Conflict(_))
    ));
}

#[tokio::test]
#[ignore = "requires SDKWORK_BIRDCODER_POSTGRES_TEST_URL"]
async fn postgres_project_repository_matches_the_canonical_baseline() {
    let database_url = std::env::var("SDKWORK_BIRDCODER_POSTGRES_TEST_URL")
        .expect("SDKWORK_BIRDCODER_POSTGRES_TEST_URL must be set");
    let schema = format!("birdcoder_project_test_{}", uuid().replace('-', ""));
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
        let generator = SnowflakeIdGenerator::new(15).map_err(|error| error.to_string())?;
        exercise_repository(
            SqlxWorkspaceRepository::from_postgres(pool.clone(), generator.clone()),
            SqlxProjectRepository::from_postgres(pool.clone(), generator),
        )
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
    result.expect("exercise PostgreSQL project repository");
}
