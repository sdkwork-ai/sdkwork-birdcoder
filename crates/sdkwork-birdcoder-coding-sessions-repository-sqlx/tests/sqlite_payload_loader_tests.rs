use rusqlite::{params, Connection};

use sdkwork_birdcoder_coding_sessions_repository_sqlx::db::schema::PROVIDER_AUTHORITY_SCHEMA;
use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::provider::constants::*;
use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::provider::loader::{
    load_provider_project_payloads, load_provider_workspace_payloads,
};
use sdkwork_birdcoder_coding_sessions_repository_sqlx::repository::provider::string_helpers::{
    build_project_config_data, project_status_storage_value, project_type_storage_value,
};

#[test]
fn sqlite_provider_payload_loaders_normalize_integer_java_long_columns() {
    let connection = Connection::open_in_memory().expect("open in-memory provider authority");
    connection
        .execute_batch(PROVIDER_AUTHORITY_SCHEMA)
        .expect("create sqlite provider authority schema");
    connection
        .execute(
            r#"
            INSERT INTO studio_workspace AS workspaces (
                id, uuid, tenant_id, organization_id, data_scope, created_at, updated_at,
                version, is_deleted, name, code, title, description, owner_id, leader_id,
                created_by_user_id, type, settings_json, is_public, is_template, status
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 0, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, 0, 0, ?17)
            "#,
            params![
                101_i64,
                "workspace-integer-uuid",
                0_i64,
                0_i64,
                SQLITE_DEFAULT_PRIVATE_DATA_SCOPE_VALUE,
                "2026-04-24T00:00:00Z",
                "2026-04-24T00:00:00Z",
                "Integer workspace",
                "integer.workspace",
                "Integer workspace",
                "Workspace row with Java Long columns",
                1001_i64,
                1002_i64,
                1003_i64,
                "DEFAULT",
                "{}",
                "active",
            ],
        )
        .expect("insert integer workspace row");
    connection
        .execute(
            r#"
            INSERT INTO studio_project AS projects (
                id, uuid, created_at, updated_at, v, tenant_id, organization_id, data_scope,
                parent_id, parent_uuid, parent_metadata, user_id, name, title, cover_image,
                author, file_id, code, type, site_path, domain_prefix, description, status,
                conversation_id, workspace_id, workspace_uuid, leader_id, start_time, end_time,
                budget_amount, is_deleted, is_template
            )
            VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, NULL, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, NULL, NULL, NULL, 0, 0)
            "#,
            params![
                201_i64,
                "project-integer-uuid",
                "2026-04-24T00:00:01Z",
                "2026-04-24T00:00:01Z",
                0_i64,
                0_i64,
                SQLITE_DEFAULT_PRIVATE_DATA_SCOPE_VALUE,
                0_i64,
                DEFAULT_TREE_ROOT_UUID,
                "{}",
                1004_i64,
                "Integer project",
                "Integer project",
                "1003",
                3001_i64,
                "integer.project",
                project_type_storage_value(Some("SDK")),
                "/integer-project",
                "integer-project",
                "Project row with Java Long columns",
                project_status_storage_value(Some("active")),
                4001_i64,
                101_i64,
                "workspace-integer-uuid",
                1002_i64,
            ],
        )
        .expect("insert integer project row");
    connection
        .execute(
            r#"
            INSERT INTO studio_project_content (
                id, uuid, created_at, updated_at, v, tenant_id, organization_id, data_scope,
                user_id, parent_id, project_id, project_uuid, config_data, content_data,
                metadata, content_version, content_hash
            )
            VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, NULL, NULL, '1.0', NULL)
            "#,
            params![
                202_i64,
                "project-integer-content-uuid",
                "2026-04-24T00:00:01Z",
                "2026-04-24T00:00:01Z",
                0_i64,
                0_i64,
                SQLITE_DEFAULT_PRIVATE_DATA_SCOPE_VALUE,
                1004_i64,
                0_i64,
                201_i64,
                "project-integer-uuid",
                build_project_config_data(Some("D:/workspace/integer-project")),
            ],
        )
        .expect("insert integer project content row");

    let workspaces =
        load_provider_workspace_payloads(&connection).expect("load workspace payloads");
    let projects = load_provider_project_payloads(&connection).expect("load project payloads");

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


