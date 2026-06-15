use rusqlite::Connection;

use super::payload_types::{ProjectPayload, WorkspacePayload};
use super::sql_helpers::{
    sqlite_row_optional_data_scope_value, sqlite_row_optional_project_type_value,
    sqlite_row_optional_string_value, sqlite_row_required_project_status_value,
    sqlite_row_required_string_value,
};
use super::string_helpers::{
    decode_optional_sqlite_bool, normalize_optional_storage_timestamp_value,
    optional_long_integer_json_string, parse_optional_json_value, parse_project_root_path_from_config_data,
    resolve_effective_user_authority,
};

pub fn load_provider_workspace_payloads(
    connection: &Connection,
) -> Result<Vec<WorkspacePayload>, String> {
    fn read_workspace_payload(row: &rusqlite::Row<'_>) -> rusqlite::Result<WorkspacePayload> {
        let owner_id = sqlite_row_optional_string_value(row, 8, "workspaces.owner_id")?;
        let leader_id = sqlite_row_optional_string_value(row, 9, "workspaces.leader_id")?;
        let created_by_user_id =
            sqlite_row_optional_string_value(row, 10, "workspaces.created_by_user_id")?;
        let settings_json: Option<String> = row.get(22)?;
        let (owner_id, leader_id, created_by_user_id) = resolve_effective_user_authority(
            owner_id.as_deref(),
            leader_id.as_deref(),
            created_by_user_id.as_deref(),
            None,
            None,
            None,
        );
        let settings = parse_optional_json_value(settings_json, "workspace settings_json")
            .map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    22,
                    rusqlite::types::Type::Text,
                    Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
                )
            })?;
        Ok(WorkspacePayload {
            id: sqlite_row_required_string_value(row, 0, "workspaces.id")?,
            uuid: row.get(1)?,
            tenant_id: sqlite_row_optional_string_value(row, 2, "workspaces.tenant_id")?,
            organization_id: sqlite_row_optional_string_value(
                row,
                3,
                "workspaces.organization_id",
            )?,
            data_scope: sqlite_row_optional_data_scope_value(row, 25, "workspaces.data_scope")?,
            name: row.get(4)?,
            code: row.get(5)?,
            title: row.get(6)?,
            description: row.get(7)?,
            icon: row.get(11)?,
            color: row.get(12)?,
            owner_id: Some(owner_id),
            leader_id: Some(leader_id),
            created_by_user_id: Some(created_by_user_id),
            entity_type: row.get(14)?,
            start_time: row.get(15)?,
            end_time: row.get(16)?,
            max_members: row.get(17)?,
            current_members: row.get(18)?,
            member_count: row
                .get::<_, Option<i64>>(19)?
                .map(|value| value.max(0) as usize),
            max_storage: optional_long_integer_json_string(row.get(20)?),
            used_storage: optional_long_integer_json_string(row.get(21)?),
            settings,
            is_public: decode_optional_sqlite_bool(row.get(23)?),
            is_template: decode_optional_sqlite_bool(row.get(24)?),
            status: row.get(13)?,
            viewer_role: None,
        })
    }

    let mut statement = connection
        .prepare(
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
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare workspaces query failed: {error}"))?;
    let rows = statement
        .query_map([], read_workspace_payload)
        .map_err(|error| format!("query workspaces failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read workspaces row failed: {error}"))?);
    }
    Ok(records)
}

pub fn load_provider_project_payloads(
    connection: &Connection,
) -> Result<Vec<ProjectPayload>, String> {
    fn read_project_payload(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectPayload> {
        let config_data: Option<String> = row.get(10)?;
        let root_path = parse_project_root_path_from_config_data(config_data).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                10,
                rusqlite::types::Type::Text,
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
            )
        })?;
        let leader_id = sqlite_row_optional_string_value(row, 13, "projects.leader_id")?;
        let author: Option<String> = row.get(14)?;
        let cover_image_json: Option<String> = row.get(21)?;
        let created_at: Option<String> = row.get(24)?;
        let updated_at: Option<String> = row.get(25)?;
        let user_id = sqlite_row_optional_string_value(row, 27, "projects.user_id")?;
        let parent_metadata_json: Option<String> = row.get(30)?;
        let effective_user_id = user_id
            .clone()
            .or_else(|| author.clone())
            .unwrap_or_else(|| super::constants::BOOTSTRAP_WORKSPACE_OWNER_USER_ID.to_owned());
        let effective_leader_id = leader_id.unwrap_or_else(|| effective_user_id.clone());
        let cover_image = parse_optional_json_value(cover_image_json, "project cover_image")
            .map_err(|error| {
                rusqlite::Error::FromSqlConversionFailure(
                    21,
                    rusqlite::types::Type::Text,
                    Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
                )
            })?;
        let parent_metadata =
            parse_optional_json_value(parent_metadata_json, "project parent_metadata").map_err(
                |error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        30,
                        rusqlite::types::Type::Text,
                        Box::new(std::io::Error::new(std::io::ErrorKind::InvalidData, error)),
                    )
                },
            )?;
        Ok(ProjectPayload {
            created_at: normalize_optional_storage_timestamp_value(created_at),
            id: sqlite_row_required_string_value(row, 0, "projects.id")?,
            uuid: row.get(1)?,
            tenant_id: sqlite_row_optional_string_value(row, 2, "projects.tenant_id")?,
            organization_id: sqlite_row_optional_string_value(row, 3, "projects.organization_id")?,
            data_scope: sqlite_row_optional_data_scope_value(row, 26, "projects.data_scope")?,
            workspace_id: sqlite_row_required_string_value(row, 4, "projects.workspace_id")?,
            workspace_uuid: row.get(5)?,
            user_id: Some(effective_user_id.clone()),
            parent_id: sqlite_row_optional_string_value(row, 28, "projects.parent_id")?,
            parent_uuid: row.get(29)?,
            parent_metadata,
            code: row.get(6)?,
            title: row.get(7)?,
            name: row.get(8)?,
            description: row.get(9)?,
            root_path,
            site_path: row.get(11)?,
            domain_prefix: row.get(12)?,
            owner_id: Some(effective_user_id.clone()),
            leader_id: Some(effective_leader_id),
            created_by_user_id: Some(effective_user_id.clone()),
            author: author.or(Some(effective_user_id)),
            file_id: sqlite_row_optional_string_value(row, 15, "projects.file_id")?,
            conversation_id: sqlite_row_optional_string_value(row, 16, "projects.conversation_id")?,
            entity_type: sqlite_row_optional_project_type_value(row, 17, "projects.type")?,
            start_time: row.get(18)?,
            end_time: row.get(19)?,
            budget_amount: optional_long_integer_json_string(row.get(20)?),
            cover_image,
            is_template: decode_optional_sqlite_bool(row.get(22)?),
            collaborator_count: None,
            status: sqlite_row_required_project_status_value(row, 23, "projects.status")?,
            updated_at: normalize_optional_storage_timestamp_value(updated_at),
            viewer_role: None,
        })
    }

    let mut statement = connection
        .prepare(
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
            WHERE projects.is_deleted = 0
            ORDER BY projects.updated_at DESC, projects.id ASC
            "#,
        )
        .map_err(|error| format!("prepare projects query failed: {error}"))?;
    let rows = statement
        .query_map([], read_project_payload)
        .map_err(|error| format!("query projects failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read projects row failed: {error}"))?);
    }
    Ok(records)
}
