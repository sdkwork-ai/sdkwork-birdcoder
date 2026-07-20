use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::commands::{
    CreateProjectRequest, UpdateProjectRequest, UpsertProjectCollaboratorRequest,
};
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::ports::repository::ProjectRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::project::SqliteProjectRepository;
use sdkwork_birdcoder_workspace_repository_sqlx::repository::workspace::SqliteWorkspaceRepository;
use sdkwork_birdcoder_workspace_service::context::WorkspaceContext;
use sdkwork_birdcoder_workspace_service::domain::commands::CreateWorkspaceRequest;
use sdkwork_birdcoder_workspace_service::ports::repository::WorkspaceRepository;
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

fn project_context() -> ProjectContext {
    ProjectContext {
        tenant_id: "100001".to_owned(),
        organization_id: "0".to_owned(),
        user_id: "200001".to_owned(),
    }
}

fn workspace_context() -> WorkspaceContext {
    let context = project_context();
    WorkspaceContext {
        tenant_id: context.tenant_id,
        organization_id: context.organization_id,
        user_id: context.user_id,
    }
}

fn workspace_request() -> CreateWorkspaceRequest {
    CreateWorkspaceRequest {
        name: "Project parity workspace".to_owned(),
        description: Some("Workspace for project repository parity".to_owned()),
        tenant_id: Some("100001".to_owned()),
        organization_id: Some("0".to_owned()),
        data_scope: Some("PRIVATE".to_owned()),
        code: Some("project-parity-workspace".to_owned()),
        title: Some("Project parity workspace".to_owned()),
        owner_id: None,
        leader_id: None,
        created_by_user_id: Some("200001".to_owned()),
        icon: None,
        color: None,
        entity_type: Some("development".to_owned()),
        start_time: None,
        end_time: None,
        max_members: None,
        current_members: None,
        member_count: None,
        max_storage: None,
        used_storage: None,
        settings: None,
        is_public: Some(false),
        is_template: Some(false),
    }
}

fn timestamp_is_valid(value: Option<&str>) -> bool {
    value.is_some_and(|value| OffsetDateTime::parse(value, &Iso8601::DEFAULT).is_ok())
}

async fn exercise_project_repository(pool: AnyPool) -> Result<(), String> {
    let workspace_repository = SqliteWorkspaceRepository::new(pool.clone());
    let workspace = workspace_repository
        .create_workspace(&workspace_context(), &workspace_request())
        .await
        .map_err(|error| format!("create workspace: {error}"))?;

    let repository = SqliteProjectRepository::new(pool);
    let context = project_context();
    let created = repository
        .create_project(
            &context,
            &CreateProjectRequest {
                workspace_id: workspace.id.clone(),
                name: "Driver parity project".to_owned(),
                description: Some("Created by the project parity test".to_owned()),
            },
        )
        .await
        .map_err(|error| format!("create project: {error}"))?;

    if created
        .uuid
        .as_deref()
        .is_none_or(|value| Uuid::parse_str(value).is_err())
        || created.workspace_id != workspace.id
        || created.user_id.as_deref() != Some("200001")
        || created.is_template != Some(false)
        || !timestamp_is_valid(created.created_at.as_deref())
        || !timestamp_is_valid(created.updated_at.as_deref())
    {
        return Err("created project lost typed persistence fields".to_owned());
    }

    let (listed, total) = repository
        .list_projects_by_workspace(&context, &workspace.id, None, 0, 20)
        .await
        .map_err(|error| format!("list projects: {error}"))?;
    if total != 1 || listed.len() != 1 || listed[0].id != created.id {
        return Err("created project was not returned by the scoped list".to_owned());
    }

    let found = repository
        .find_project_by_id(&context, &created.id)
        .await
        .map_err(|error| format!("find project: {error}"))?;
    if found.as_ref().map(|project| project.id.as_str()) != Some(created.id.as_str()) {
        return Err("created project was not returned by id".to_owned());
    }

    let other_organization = ProjectContext {
        organization_id: "300001".to_owned(),
        ..context.clone()
    };
    if repository
        .find_project_by_id(&other_organization, &created.id)
        .await
        .map_err(|error| format!("find project from another organization: {error}"))?
        .is_some()
    {
        return Err("project leaked across organization scope".to_owned());
    }
    if !matches!(
        repository
            .ensure_project_write_access(&other_organization, &created.id)
            .await,
        Err(ProjectError::NotFound(_))
    ) {
        return Err("project write access did not enforce organization scope".to_owned());
    }

    let updated = repository
        .update_project(
            &context,
            &created.id,
            &UpdateProjectRequest {
                name: Some("Updated driver parity project".to_owned()),
                description: Some("Updated through the portable query builder".to_owned()),
                status: Some("archived".to_owned()),
            },
        )
        .await
        .map_err(|error| format!("update project: {error}"))?;
    if updated.name != "Updated driver parity project"
        || updated.description.as_deref() != Some("Updated through the portable query builder")
        || updated.status != "archived"
        || !timestamp_is_valid(updated.updated_at.as_deref())
    {
        return Err("updated project lost typed persistence fields".to_owned());
    }

    let collaborator_request = UpsertProjectCollaboratorRequest {
        user_id: "200002".to_owned(),
        role: Some("viewer".to_owned()),
        status: Some("active".to_owned()),
    };
    let collaborator = repository
        .upsert_project_collaborator(&context, &created.id, &collaborator_request)
        .await
        .map_err(|error| format!("create project collaborator: {error}"))?;
    if collaborator.user_id != "200002"
        || collaborator.role != "viewer"
        || collaborator.organization_id.as_deref() != Some("0")
        || !timestamp_is_valid(collaborator.created_at.as_deref())
    {
        return Err("created project collaborator lost typed persistence fields".to_owned());
    }

    let collaborator = repository
        .upsert_project_collaborator(
            &context,
            &created.id,
            &UpsertProjectCollaboratorRequest {
                user_id: "200002".to_owned(),
                role: Some("admin".to_owned()),
                status: Some("active".to_owned()),
            },
        )
        .await
        .map_err(|error| format!("update project collaborator: {error}"))?;
    if collaborator.role != "admin" || !timestamp_is_valid(collaborator.updated_at.as_deref()) {
        return Err("updated project collaborator lost typed persistence fields".to_owned());
    }

    let (collaborators, collaborator_total) = repository
        .list_project_collaborators(&context, &created.id, 0, 20)
        .await
        .map_err(|error| format!("list project collaborators: {error}"))?;
    if collaborator_total != 1 || collaborators.len() != 1 {
        return Err("project collaborator was not returned by the scoped list".to_owned());
    }

    let collaborator_context = ProjectContext {
        user_id: "200002".to_owned(),
        ..context.clone()
    };
    if repository
        .find_project_by_id(&collaborator_context, &created.id)
        .await
        .map_err(|error| format!("find project as collaborator: {error}"))?
        .is_none()
    {
        return Err("active project collaborator could not read the project".to_owned());
    }

    repository
        .remove_project_collaborator(&context, &created.id, "200002")
        .await
        .map_err(|error| format!("remove project collaborator: {error}"))?;
    let (_, collaborator_total) = repository
        .list_project_collaborators(&context, &created.id, 0, 20)
        .await
        .map_err(|error| format!("list removed project collaborator: {error}"))?;
    if collaborator_total != 0 {
        return Err("soft-deleted project collaborator remained visible".to_owned());
    }

    repository
        .delete_project(&context, &created.id)
        .await
        .map_err(|error| format!("delete project: {error}"))?;
    if repository
        .find_project_by_id(&context, &created.id)
        .await
        .map_err(|error| format!("find deleted project: {error}"))?
        .is_some()
    {
        return Err("soft-deleted project remained visible".to_owned());
    }

    Ok(())
}

#[tokio::test]
async fn sqlite_project_repository_preserves_typed_fields() {
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

    exercise_project_repository(pool.clone())
        .await
        .expect("exercise SQLite project repository");
    pool.close().await;
}

#[tokio::test]
#[ignore = "requires SDKWORK_BIRDCODER_POSTGRES_TEST_URL"]
async fn postgres_project_repository_preserves_typed_fields() {
    sqlx::any::install_default_drivers();
    let database_url = std::env::var("SDKWORK_BIRDCODER_POSTGRES_TEST_URL")
        .expect("SDKWORK_BIRDCODER_POSTGRES_TEST_URL must be set");
    let schema = format!("birdcoder_project_test_{}", Uuid::new_v4().simple());
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
        exercise_project_repository(pool.clone()).await
    }
    .await;

    pool.close().await;
    sqlx::query(&format!("DROP SCHEMA \"{schema}\" CASCADE"))
        .execute(&admin_pool)
        .await
        .expect("remove isolated PostgreSQL schema");
    admin_pool.close().await;
    result.expect("exercise PostgreSQL project repository");
}
