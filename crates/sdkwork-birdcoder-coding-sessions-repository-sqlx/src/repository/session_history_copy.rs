use std::collections::BTreeMap;

use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_sqlx_repository_pool::dialect::IS_NOT_DELETED;
use sqlx::{Executor, Row};
use time::OffsetDateTime;
use uuid::Uuid;

use crate::db::columns;
use crate::db::rows::*;
use crate::error::{map_sqlx_error, RepositoryError};
use crate::repository::sqlx_helpers::ensure_session_in_tenant_scope;

fn now_iso() -> String {
    OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Iso8601::DEFAULT)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
}

pub async fn copy_session_history_on<'c, E>(
    pool: &sqlx::AnyPool,
    executor: E,
    ctx: &CodingSessionContext,
    source_session_id: &str,
    target_session_id: &str,
) -> Result<usize, CodingSessionError>
where
    E: Executor<'c, Database = sqlx::Any>,
{
    ensure_session_in_tenant_scope(pool, ctx, source_session_id).await?;
    ensure_session_in_tenant_scope(pool, ctx, target_session_id).await?;

    let now = now_iso();
    let mut total_copied: usize = 0;

    let source_messages = map_sqlx_error(
        sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {IS_NOT_DELETED} ORDER BY {} ASC",
            columns::message::TABLE,
            columns::message::CODING_SESSION_ID,
            columns::message::CREATED_AT,
        ))
        .bind(source_session_id)
        .fetch_all(&executor)
        .await,
    )?;

    for row in &source_messages {
        let new_id = Uuid::new_v4().to_string();
        let turn_id: Option<String> = row.try_get(columns::message::TURN_ID).ok().flatten();
        let role: String = row.try_get(columns::message::ROLE).unwrap_or_default();
        let content: String = row.try_get(columns::message::CONTENT).unwrap_or_default();
        let metadata_json: String = row.try_get(columns::message::METADATA_JSON).unwrap_or_default();
        let timestamp_ms: Option<i64> = row.try_get(columns::message::TIMESTAMP_MS).ok().flatten();
        let name: Option<String> = row.try_get(columns::message::NAME).ok().flatten();
        let tool_calls_json: Option<String> =
            row.try_get(columns::message::TOOL_CALLS_JSON).ok().flatten();
        let tool_call_id: Option<String> =
            row.try_get(columns::message::TOOL_CALL_ID).ok().flatten();
        let file_changes_json: Option<String> =
            row.try_get(columns::message::FILE_CHANGES_JSON).ok().flatten();
        let commands_json: Option<String> =
            row.try_get(columns::message::COMMANDS_JSON).ok().flatten();
        let task_progress_json: Option<String> =
            row.try_get(columns::message::TASK_PROGRESS_JSON).ok().flatten();

        map_sqlx_error(
            sqlx::query(&format!(
                "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                 VALUES (?, NULL, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                columns::message::TABLE,
                columns::message::ID,
                columns::message::UUID,
                columns::message::CREATED_AT,
                columns::message::UPDATED_AT,
                columns::message::VERSION,
                columns::message::IS_DELETED,
                columns::message::CODING_SESSION_ID,
                columns::message::TURN_ID,
                columns::message::ROLE,
                columns::message::CONTENT,
                columns::message::METADATA_JSON,
                columns::message::TIMESTAMP_MS,
                columns::message::NAME,
                columns::message::TOOL_CALLS_JSON,
                columns::message::TOOL_CALL_ID,
                columns::message::FILE_CHANGES_JSON,
                columns::message::COMMANDS_JSON,
                columns::message::TASK_PROGRESS_JSON,
            ))
            .bind(&new_id)
            .bind(&now)
            .bind(&now)
            .bind(target_session_id)
            .bind(&turn_id)
            .bind(&role)
            .bind(&content)
            .bind(&metadata_json)
            .bind(timestamp_ms)
            .bind(&name)
            .bind(&tool_calls_json)
            .bind(&tool_call_id)
            .bind(&file_changes_json)
            .bind(&commands_json)
            .bind(&task_progress_json)
            .execute(&executor)
            .await,
        )?;
        total_copied += 1;
    }

    let source_turns = map_sqlx_error(
        sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {IS_NOT_DELETED} ORDER BY {} ASC",
            columns::turn::TABLE,
            columns::turn::CODING_SESSION_ID,
            columns::turn::CREATED_AT,
        ))
        .bind(source_session_id)
        .fetch_all(&executor)
        .await,
    )?;

    for row in &source_turns {
        let new_id = Uuid::new_v4().to_string();
        let runtime_id: Option<String> = row.try_get(columns::turn::RUNTIME_ID).ok().flatten();
        let request_kind: String = row.try_get(columns::turn::REQUEST_KIND).unwrap_or_default();
        let status: String = row.try_get(columns::turn::STATUS).unwrap_or_default();
        let input_summary: String = row.try_get(columns::turn::INPUT_SUMMARY).unwrap_or_default();
        let started_at: Option<String> = row.try_get(columns::turn::STARTED_AT).ok().flatten();
        let completed_at: Option<String> = row.try_get(columns::turn::COMPLETED_AT).ok().flatten();

        map_sqlx_error(
            sqlx::query(&format!(
                "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                 VALUES (?, NULL, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?, ?)",
                columns::turn::TABLE,
                columns::turn::ID,
                columns::turn::UUID,
                columns::turn::CREATED_AT,
                columns::turn::UPDATED_AT,
                columns::turn::VERSION,
                columns::turn::IS_DELETED,
                columns::turn::CODING_SESSION_ID,
                columns::turn::RUNTIME_ID,
                columns::turn::REQUEST_KIND,
                columns::turn::STATUS,
                columns::turn::INPUT_SUMMARY,
                columns::turn::STARTED_AT,
                columns::turn::COMPLETED_AT,
            ))
            .bind(&new_id)
            .bind(&now)
            .bind(&now)
            .bind(target_session_id)
            .bind(&runtime_id)
            .bind(&request_kind)
            .bind(&status)
            .bind(&input_summary)
            .bind(&started_at)
            .bind(&completed_at)
            .execute(&executor)
            .await,
        )?;
        total_copied += 1;
    }

    let source_events = map_sqlx_error(
        sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {IS_NOT_DELETED} ORDER BY {} ASC",
            columns::event::TABLE,
            columns::event::CODING_SESSION_ID,
            columns::event::SEQUENCE_NO,
        ))
        .bind(source_session_id)
        .fetch_all(&executor)
        .await,
    )?;

    for row in &source_events {
        let new_id = Uuid::new_v4().to_string();
        let turn_id: Option<String> = row.try_get(columns::event::TURN_ID).ok().flatten();
        let runtime_id: Option<String> = row.try_get(columns::event::RUNTIME_ID).ok().flatten();
        let event_kind: String = row.try_get(columns::event::EVENT_KIND).unwrap_or_default();
        let sequence_no: i32 = row.try_get(columns::event::SEQUENCE_NO).unwrap_or(0);
        let payload_json: String = row.try_get(columns::event::PAYLOAD_JSON).unwrap_or_default();

        map_sqlx_error(
            sqlx::query(&format!(
                "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                 VALUES (?, NULL, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)",
                columns::event::TABLE,
                columns::event::ID,
                columns::event::UUID,
                columns::event::CREATED_AT,
                columns::event::UPDATED_AT,
                columns::event::VERSION,
                columns::event::IS_DELETED,
                columns::event::CODING_SESSION_ID,
                columns::event::TURN_ID,
                columns::event::RUNTIME_ID,
                columns::event::EVENT_KIND,
                columns::event::SEQUENCE_NO,
                columns::event::PAYLOAD_JSON,
            ))
            .bind(&new_id)
            .bind(&now)
            .bind(&now)
            .bind(target_session_id)
            .bind(&turn_id)
            .bind(&runtime_id)
            .bind(&event_kind)
            .bind(sequence_no)
            .bind(&payload_json)
            .execute(&executor)
            .await,
        )?;
        total_copied += 1;
    }

    let source_artifacts = map_sqlx_error(
        sqlx::query(&format!(
            "SELECT * FROM {} WHERE {} = ? AND {IS_NOT_DELETED} ORDER BY {} ASC",
            columns::artifact::TABLE,
            columns::artifact::CODING_SESSION_ID,
            columns::artifact::CREATED_AT,
        ))
        .bind(source_session_id)
        .fetch_all(&executor)
        .await,
    )?;

    for row in &source_artifacts {
        let new_id = Uuid::new_v4().to_string();
        let turn_id: Option<String> = row.try_get(columns::artifact::TURN_ID).ok().flatten();
        let artifact_kind: String =
            row.try_get(columns::artifact::ARTIFACT_KIND).unwrap_or_default();
        let title: String = row.try_get(columns::artifact::TITLE).unwrap_or_default();
        let blob_ref: Option<String> = row.try_get(columns::artifact::BLOB_REF).ok().flatten();
        let metadata_json: String =
            row.try_get(columns::artifact::METADATA_JSON).unwrap_or_default();

        map_sqlx_error(
            sqlx::query(&format!(
                "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                 VALUES (?, NULL, ?, ?, 0, 0, ?, ?, ?, ?, ?, ?)",
                columns::artifact::TABLE,
                columns::artifact::ID,
                columns::artifact::UUID,
                columns::artifact::CREATED_AT,
                columns::artifact::UPDATED_AT,
                columns::artifact::VERSION,
                columns::artifact::IS_DELETED,
                columns::artifact::CODING_SESSION_ID,
                columns::artifact::TURN_ID,
                columns::artifact::ARTIFACT_KIND,
                columns::artifact::TITLE,
                columns::artifact::BLOB_REF,
                columns::artifact::METADATA_JSON,
            ))
            .bind(&new_id)
            .bind(&now)
            .bind(&now)
            .bind(target_session_id)
            .bind(&turn_id)
            .bind(&artifact_kind)
            .bind(&title)
            .bind(&blob_ref)
            .bind(&metadata_json)
            .execute(&executor)
            .await,
        )?;
        total_copied += 1;
    }

    Ok(total_copied)
}
