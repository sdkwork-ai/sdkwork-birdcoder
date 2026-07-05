use sqlx::{AnyPool, Row};

use sdkwork_birdcoder_sqlx_repository_pool::dialect::{IS_NOT_DELETED, qualified_is_not_deleted};

use super::payload_types::{ProjectPayload, WorkspacePayload};
use super::sql_helpers::{
    sqlx_row_optional_data_scope_value, sqlx_row_optional_project_type_value,
    sqlx_row_optional_string_value, sqlx_row_required_project_status_value,
    sqlx_row_required_string_value,
};
use super::string_helpers::{
    decode_optional_sqlite_bool, normalize_optional_storage_timestamp_value,
    optional_long_integer_json_string, parse_optional_json_value, parse_project_root_path_from_config_data,
    resolve_effective_user_authority,
};

pub async fn load_provider_workspace_payloads(
    pool: &AnyPool,
) -> Result<Vec<WorkspacePayload>, String> {
    let sql = format!(
        r#"
            SELECT
                id,
                uuid,
                tenant_id,
                organization_id,
                name,
                code,
                title,
                description,
                owner_id,
                leader_id,
                created_by_user_id,
                icon,
                color,
                status,
                type,
                start_time,
                end_time,
                max_members,
                current_members,
                member_count,
                max_storage,
                used_storage,
                settings_json,
                is_public,
                is_template
                ,
                data_scope
            FROM studio_workspace AS workspaces
            WHERE {IS_NOT_DELETED}
            ORDER BY updated_at DESC, id ASC
            LIMIT 500
            "#,
    );
    let rows = sqlx::query(&sql)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("query workspaces failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        let owner_id = sqlx_row_optional_string_value(&row, 8, "workspaces.owner_id")?;
        let leader_id = sqlx_row_optional_string_value(&row, 9, "workspaces.leader_id")?;
        let created_by_user_id =
            sqlx_row_optional_string_value(&row, 10, "workspaces.created_by_user_id")?;
        let settings_json: Option<String> = row
            .try_get(22)
            .map_err(|error| format!("read workspaces.settings_json failed: {error}"))?;
        let (owner_id, leader_id, created_by_user_id) = resolve_effective_user_authority(
            owner_id.as_deref(),
            leader_id.as_deref(),
            created_by_user_id.as_deref(),
            None,
            None,
            None,
        );
        let settings = parse_optional_json_value(settings_json, "workspace settings_json")?;
        records.push(WorkspacePayload {
            id: sqlx_row_required_string_value(&row, 0, "workspaces.id")?,
            uuid: row
                .try_get(1)
                .map_err(|error| format!("read workspaces.uuid failed: {error}"))?,
            tenant_id: sqlx_row_optional_string_value(&row, 2, "workspaces.tenant_id")?,
            organization_id: sqlx_row_optional_string_value(&row, 3, "workspaces.organization_id")?,
            data_scope: sqlx_row_optional_data_scope_value(&row, 25, "workspaces.data_scope")?,
            name: row
                .try_get(4)
                .map_err(|error| format!("read workspaces.name failed: {error}"))?,
            code: row
                .try_get(5)
                .map_err(|error| format!("read workspaces.code failed: {error}"))?,
            title: row
                .try_get(6)
                .map_err(|error| format!("read workspaces.title failed: {error}"))?,
            description: row
                .try_get(7)
                .map_err(|error| format!("read workspaces.description failed: {error}"))?,
            icon: row
                .try_get(11)
                .map_err(|error| format!("read workspaces.icon failed: {error}"))?,
            color: row
                .try_get(12)
                .map_err(|error| format!("read workspaces.color failed: {error}"))?,
            owner_id: Some(owner_id),
            leader_id: Some(leader_id),
            created_by_user_id: Some(created_by_user_id),
            entity_type: row
                .try_get(14)
                .map_err(|error| format!("read workspaces.type failed: {error}"))?,
            start_time: row
                .try_get(15)
                .map_err(|error| format!("read workspaces.start_time failed: {error}"))?,
            end_time: row
                .try_get(16)
                .map_err(|error| format!("read workspaces.end_time failed: {error}"))?,
            max_members: row
                .try_get(17)
                .map_err(|error| format!("read workspaces.max_members failed: {error}"))?,
            current_members: row
                .try_get(18)
                .map_err(|error| format!("read workspaces.current_members failed: {error}"))?,
            member_count: row
                .try_get::<Option<i64>, _>(19)
                .map_err(|error| format!("read workspaces.member_count failed: {error}"))?
                .map(|value| value.max(0) as usize),
            max_storage: optional_long_integer_json_string(
                row.try_get(20)
                    .map_err(|error| format!("read workspaces.max_storage failed: {error}"))?,
            ),
            used_storage: optional_long_integer_json_string(
                row.try_get(21)
                    .map_err(|error| format!("read workspaces.used_storage failed: {error}"))?,
            ),
            settings,
            is_public: decode_optional_sqlite_bool(
                row.try_get(23)
                    .map_err(|error| format!("read workspaces.is_public failed: {error}"))?,
            ),
            is_template: decode_optional_sqlite_bool(
                row.try_get(24)
                    .map_err(|error| format!("read workspaces.is_template failed: {error}"))?,
            ),
            status: row
                .try_get(13)
                .map_err(|error| format!("read workspaces.status failed: {error}"))?,
            viewer_role: None,
        });
    }
    Ok(records)
}

pub async fn load_provider_project_payloads(
    pool: &AnyPool,
) -> Result<Vec<ProjectPayload>, String> {
    let project_deleted = qualified_is_not_deleted("projects");
    let sql = format!(
        r#"
            SELECT
                projects.id,
                projects.uuid,
                projects.tenant_id,
                projects.organization_id,
                projects.workspace_id,
                projects.workspace_uuid,
                projects.code,
                projects.title,
                projects.name,
                projects.description,
                project_contents.config_data,
                projects.site_path,
                projects.domain_prefix,
                projects.leader_id,
                projects.author,
                projects.file_id,
                projects.conversation_id,
                projects.type,
                projects.start_time,
                projects.end_time,
                projects.budget_amount,
                projects.cover_image,
                projects.is_template,
                projects.status,
                projects.created_at,
                projects.updated_at,
                projects.data_scope,
                projects.user_id,
                projects.parent_id,
                projects.parent_uuid,
                projects.parent_metadata
            FROM studio_project AS projects
            LEFT JOIN studio_project_content AS project_contents
              ON project_contents.project_id = projects.id
            WHERE {project_deleted}
            ORDER BY projects.updated_at DESC, projects.id ASC
            LIMIT 1000
            "#,
    );
    let rows = sqlx::query(&sql)
    .fetch_all(pool)
    .await
    .map_err(|error| format!("query projects failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        let config_data: Option<String> = row
            .try_get(10)
            .map_err(|error| format!("read projects.config_data failed: {error}"))?;
        let root_path = parse_project_root_path_from_config_data(config_data)?;
        let leader_id = sqlx_row_optional_string_value(&row, 13, "projects.leader_id")?;
        let author: Option<String> = row
            .try_get(14)
            .map_err(|error| format!("read projects.author failed: {error}"))?;
        let cover_image_json: Option<String> = row
            .try_get(21)
            .map_err(|error| format!("read projects.cover_image failed: {error}"))?;
        let created_at: Option<String> = row
            .try_get(24)
            .map_err(|error| format!("read projects.created_at failed: {error}"))?;
        let updated_at: Option<String> = row
            .try_get(25)
            .map_err(|error| format!("read projects.updated_at failed: {error}"))?;
        let user_id = sqlx_row_optional_string_value(&row, 27, "projects.user_id")?;
        let parent_metadata_json: Option<String> = row
            .try_get(30)
            .map_err(|error| format!("read projects.parent_metadata failed: {error}"))?;
        let effective_user_id = user_id
            .clone()
            .or_else(|| author.clone())
            .unwrap_or_else(|| super::constants::BOOTSTRAP_WORKSPACE_OWNER_USER_ID.to_owned());
        let effective_leader_id = leader_id.unwrap_or_else(|| effective_user_id.clone());
        let cover_image = parse_optional_json_value(cover_image_json, "project cover_image")?;
        let parent_metadata =
            parse_optional_json_value(parent_metadata_json, "project parent_metadata")?;
        records.push(ProjectPayload {
            created_at: normalize_optional_storage_timestamp_value(created_at),
            id: sqlx_row_required_string_value(&row, 0, "projects.id")?,
            uuid: row
                .try_get(1)
                .map_err(|error| format!("read projects.uuid failed: {error}"))?,
            tenant_id: sqlx_row_optional_string_value(&row, 2, "projects.tenant_id")?,
            organization_id: sqlx_row_optional_string_value(&row, 3, "projects.organization_id")?,
            data_scope: sqlx_row_optional_data_scope_value(&row, 26, "projects.data_scope")?,
            workspace_id: sqlx_row_required_string_value(&row, 4, "projects.workspace_id")?,
            workspace_uuid: row
                .try_get(5)
                .map_err(|error| format!("read projects.workspace_uuid failed: {error}"))?,
            user_id: Some(effective_user_id.clone()),
            parent_id: sqlx_row_optional_string_value(&row, 28, "projects.parent_id")?,
            parent_uuid: row
                .try_get(29)
                .map_err(|error| format!("read projects.parent_uuid failed: {error}"))?,
            parent_metadata,
            code: row
                .try_get(6)
                .map_err(|error| format!("read projects.code failed: {error}"))?,
            title: row
                .try_get(7)
                .map_err(|error| format!("read projects.title failed: {error}"))?,
            name: row
                .try_get(8)
                .map_err(|error| format!("read projects.name failed: {error}"))?,
            description: row
                .try_get(9)
                .map_err(|error| format!("read projects.description failed: {error}"))?,
            root_path,
            site_path: row
                .try_get(11)
                .map_err(|error| format!("read projects.site_path failed: {error}"))?,
            domain_prefix: row
                .try_get(12)
                .map_err(|error| format!("read projects.domain_prefix failed: {error}"))?,
            owner_id: Some(effective_user_id.clone()),
            leader_id: Some(effective_leader_id),
            created_by_user_id: Some(effective_user_id.clone()),
            author: author.or(Some(effective_user_id)),
            file_id: sqlx_row_optional_string_value(&row, 15, "projects.file_id")?,
            conversation_id: sqlx_row_optional_string_value(&row, 16, "projects.conversation_id")?,
            entity_type: sqlx_row_optional_project_type_value(&row, 17, "projects.type")?,
            start_time: row
                .try_get(18)
                .map_err(|error| format!("read projects.start_time failed: {error}"))?,
            end_time: row
                .try_get(19)
                .map_err(|error| format!("read projects.end_time failed: {error}"))?,
            budget_amount: optional_long_integer_json_string(
                row.try_get(20)
                    .map_err(|error| format!("read projects.budget_amount failed: {error}"))?,
            ),
            cover_image,
            is_template: decode_optional_sqlite_bool(
                row.try_get(22)
                    .map_err(|error| format!("read projects.is_template failed: {error}"))?,
            ),
            collaborator_count: None,
            status: sqlx_row_required_project_status_value(&row, 23, "projects.status")?,
            updated_at: normalize_optional_storage_timestamp_value(updated_at),
            viewer_role: None,
        });
    }
    Ok(records)
}
