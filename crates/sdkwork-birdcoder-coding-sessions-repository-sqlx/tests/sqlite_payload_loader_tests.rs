use sdkwork_database_config::{DatabaseConfig, DatabaseEngine, DeploymentMode};
use sdkwork_database_sqlx::create_any_pool_from_config;

use sdkwork_birdcoder_coding_sessions_repository_sqlx::db::schema::PROVIDER_AUTHORITY_SCHEMA;
use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::provider::constants::*;
use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::provider::loader::{
    load_provider_project_payloads, load_provider_workspace_payloads,
};
use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::provider::string_helpers::{
    build_project_config_data, project_status_storage_value, project_type_storage_value,
};

#[tokio::test]
async fn sqlite_provider_payload_loaders_normalize_integer_java_long_columns() {
    sqlx::any::install_default_drivers();
    let pool = create_any_pool_from_config(DatabaseConfig {
        engine: DatabaseEngine::Sqlite,
        url: "sqlite::memory:".to_string(),
        mode: DeploymentMode::Standalone,
        max_connections: 1,
        ..DatabaseConfig::default()
    })
    .await
    .expect("open in-memory provider authority");
    sqlx::raw_sql(PROVIDER_AUTHORITY_SCHEMA)
        .execute(&pool)
        .await
        .expect("create sqlite provider authority schema");
    sqlx::query(
        r#"
            INSERT INTO studio_workspace AS workspaces (
                id, uuid, tenant_id, organization_id, data_scope, created_at, updated_at,
                version, is_deleted, name, code, title, description, owner_id, leader_id,
                created_by_user_id, type, settings_json, is_public, is_template, status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
            "#,
    )
    .bind(101_i64)
    .bind("workspace-integer-uuid")
    .bind(0_i64)
    .bind(0_i64)
    .bind(SQLITE_DEFAULT_PRIVATE_DATA_SCOPE_VALUE)
    .bind("2026-04-24T00:00:00Z")
    .bind("2026-04-24T00:00:00Z")
    .bind("Integer workspace")
    .bind("integer.workspace")
    .bind("Integer workspace")
    .bind("Workspace row with Java Long columns")
    .bind(1001_i64)
    .bind(1002_i64)
    .bind(1003_i64)
    .bind("DEFAULT")
    .bind("{}")
    .bind("active")
    .execute(&pool)
    .await
    .expect("insert integer workspace row");
    sqlx::query(
        r#"
            INSERT INTO studio_project AS projects (
                id, uuid, created_at, updated_at, v, tenant_id, organization_id, data_scope,
                parent_id, parent_uuid, parent_metadata, user_id, name, title, cover_image,
                author, file_id, code, type, site_path, domain_prefix, description, status,
                conversation_id, workspace_id, workspace_uuid, leader_id, start_time, end_time,
                budget_amount, is_deleted, is_template
            )
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, 0, 0)
            "#,
    )
    .bind(201_i64)
    .bind("project-integer-uuid")
    .bind("2026-04-24T00:00:01Z")
    .bind("2026-04-24T00:00:01Z")
    .bind(0_i64)
    .bind(0_i64)
    .bind(SQLITE_DEFAULT_PRIVATE_DATA_SCOPE_VALUE)
    .bind(0_i64)
    .bind(DEFAULT_TREE_ROOT_UUID)
    .bind("{}")
    .bind(1004_i64)
    .bind("Integer project")
    .bind("Integer project")
    .bind("1003")
    .bind(3001_i64)
    .bind("integer.project")
    .bind(project_type_storage_value(Some("SDK")))
    .bind("/integer-project")
    .bind("integer-project")
    .bind("Project row with Java Long columns")
    .bind(project_status_storage_value(Some("active")))
    .bind(4001_i64)
    .bind(101_i64)
    .bind("workspace-integer-uuid")
    .bind(1002_i64)
    .execute(&pool)
    .await
    .expect("insert integer project row");
    sqlx::query(
        r#"
            INSERT INTO studio_project_content (
                id, uuid, created_at, updated_at, v, tenant_id, organization_id, data_scope,
                user_id, parent_id, project_id, project_uuid, config_data, content_data,
                metadata, content_version, content_hash
            )
            VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, '1.0', NULL)
            "#,
    )
    .bind(202_i64)
    .bind("project-integer-content-uuid")
    .bind("2026-04-24T00:00:01Z")
    .bind("2026-04-24T00:00:01Z")
    .bind(0_i64)
    .bind(0_i64)
    .bind(SQLITE_DEFAULT_PRIVATE_DATA_SCOPE_VALUE)
    .bind(1004_i64)
    .bind(0_i64)
    .bind(201_i64)
    .bind("project-integer-uuid")
    .bind(build_project_config_data(Some(
        "D:/workspace/integer-project",
    )))
    .execute(&pool)
    .await
    .expect("insert integer project content row");

    let workspaces = load_provider_workspace_payloads(&pool)
        .await
        .expect("load workspace payloads");
    let projects = load_provider_project_payloads(&pool)
        .await
        .expect("load project payloads");

    assert_eq!(workspaces.len(), 1);
    assert_eq!(workspaces[0].id, "101");
    assert_eq!(workspaces[0].tenant_id.as_deref(), Some("0"));
    assert_eq!(workspaces[0].organization_id.as_deref(), Some("0"));
    assert_eq!(workspaces[0].data_scope.as_deref(), Some("PRIVATE"));
    assert_eq!(workspaces[0].owner_id.as_deref(), Some("1001"));
    assert_eq!(workspaces[0].leader_id.as_deref(), Some("1002"));
    assert_eq!(workspaces[0].created_by_user_id.as_deref(), Some("1003"));

    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0].id, "201");
    assert_eq!(projects[0].workspace_id, "101");
    assert_eq!(projects[0].tenant_id.as_deref(), Some("0"));
    assert_eq!(projects[0].organization_id.as_deref(), Some("0"));
    assert_eq!(projects[0].data_scope.as_deref(), Some("PRIVATE"));
    assert_eq!(projects[0].user_id.as_deref(), Some("1004"));
    assert_eq!(projects[0].parent_id.as_deref(), Some("0"));
    assert_eq!(projects[0].file_id.as_deref(), Some("3001"));
    assert_eq!(projects[0].conversation_id.as_deref(), Some("4001"));
    assert_eq!(
        projects[0].root_path.as_deref(),
        Some("D:/workspace/integer-project")
    );
    assert_eq!(projects[0].owner_id.as_deref(), Some("1004"));
    assert_eq!(projects[0].leader_id.as_deref(), Some("1002"));
    assert_eq!(projects[0].created_by_user_id.as_deref(), Some("1004"));
}
