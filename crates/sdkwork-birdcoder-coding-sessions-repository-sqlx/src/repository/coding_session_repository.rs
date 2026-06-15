use std::collections::BTreeMap;
use std::sync::Mutex;

use rusqlite::{params, Connection};
use sdkwork_birdcoder_coding_sessions_service::context::SessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::commands::{
    CreateCodingSessionInput,
    CreateCodingSessionTurnInput,
    EditCodingSessionMessageInput,
    ForkCodingSessionInput,
    SubmitApprovalDecisionInput,
    SubmitUserQuestionAnswerInput,
    UpdateCodingSessionInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionListQuery;
use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    ApprovalDecisionPayload,
    CodingSessionArtifactPayload,
    CodingSessionCheckpointPayload,
    CodingSessionEventPayload,
    CodingSessionPayload,
    CodingSessionTurnPayload,
    OperationPayload,
    UserQuestionAnswerPayload,
};
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::ports::repository::CodingSessionRepository;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::db::columns;
use crate::db::rows::*;
use crate::error::RepositoryError;
use crate::mapper::row_mapper;

pub struct SqliteCodingSessionRepository {
    conn: Mutex<Connection>,
}

impl SqliteCodingSessionRepository {
    pub fn new(conn: Connection) -> Self {
        Self {
            conn: Mutex::new(conn),
        }
    }

    fn with_conn<F, T>(&self, f: F) -> Result<T, RepositoryError>
    where
        F: FnOnce(&Connection) -> Result<T, RepositoryError>,
    {
        let conn = self.conn.lock().map_err(|e| RepositoryError::Connection(e.to_string()))?;
        f(&conn)
    }

    fn now_iso() -> String {
        OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
    }
}

#[async_trait::async_trait]
impl CodingSessionRepository for SqliteCodingSessionRepository {
    async fn list_sessions(
        &self,
        _ctx: &SessionContext,
        query: &CodingSessionListQuery,
    ) -> Result<Vec<CodingSessionPayload>, CodingSessionError> {
        self.with_conn(|conn| {
            let mut sql = String::from(
                "SELECT s.*, r.status AS runtime_status FROM ai_coding_session s \
                 LEFT JOIN (SELECT coding_session_id, status FROM ai_coding_session_runtime \
                 WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT 1) r \
                 ON r.coding_session_id = s.id \
                 WHERE s.is_deleted = 0",
            );
            let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

            if let Some(ref engine_id) = query.engine_id {
                sql.push_str(&format!(" AND s.{} = ?{}", columns::session::ENGINE_ID, param_values.len() + 1));
                param_values.push(Box::new(engine_id.clone()));
            }
            if let Some(ref project_id) = query.project_id {
                sql.push_str(&format!(" AND s.{} = ?{}", columns::session::PROJECT_ID, param_values.len() + 1));
                param_values.push(Box::new(project_id.clone()));
            }
            if let Some(ref workspace_id) = query.workspace_id {
                sql.push_str(&format!(" AND s.{} = ?{}", columns::session::WORKSPACE_ID, param_values.len() + 1));
                param_values.push(Box::new(workspace_id.clone()));
            }

            sql.push_str(" ORDER BY s.sort_timestamp DESC");

            if let Some(limit) = query.limit {
                sql.push_str(&format!(" LIMIT {}", limit));
            }
            if let Some(offset) = query.offset {
                sql.push_str(&format!(" OFFSET {}", offset));
            }

            let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
            let mut stmt = conn.prepare(&sql).map_err(|e| RepositoryError::Query(e.to_string()))?;
            let rows = stmt
                .query_map(params_ref.as_slice(), |row| {
                    Ok(SessionRow {
                        id: row.get(0)?,
                        uuid: row.get(1)?,
                        created_at: row.get(2)?,
                        updated_at: row.get(3)?,
                        version: row.get(4)?,
                        is_deleted: row.get(5)?,
                        workspace_id: row.get(6)?,
                        project_id: row.get(7)?,
                        title: row.get(8)?,
                        status: row.get(9)?,
                        entry_surface: row.get(10)?,
                        host_mode: row.get(11)?,
                        engine_id: row.get(12)?,
                        model_id: row.get(13)?,
                        last_turn_at: row.get(14)?,
                        native_session_id: row.get(15)?,
                        sort_timestamp: row.get(16)?,
                        transcript_updated_at: row.get(17)?,
                        pinned: row.get(18)?,
                        archived: row.get(19)?,
                        unread: row.get(20)?,
                    })
                })
                .map_err(|e| RepositoryError::Query(e.to_string()))?;

            let mut result = Vec::new();
            for row in rows {
                let r = row.map_err(|e| RepositoryError::Query(e.to_string()))?;
                let runtime_status: Option<String> = None;
                result.push(row_mapper::session_row_to_payload(r, runtime_status));
            }
            Ok(result)
        })
        .map_err(CodingSessionError::from)
    }

    async fn get_session(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let session_id = session_id.to_string();
        self.with_conn(|conn| {
            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                columns::session::TABLE,
                columns::session::ID,
                columns::session::IS_DELETED,
            );
            let row = conn
                .query_row(&sql, params![session_id], |row| {
                    Ok(SessionRow {
                        id: row.get(0)?,
                        uuid: row.get(1)?,
                        created_at: row.get(2)?,
                        updated_at: row.get(3)?,
                        version: row.get(4)?,
                        is_deleted: row.get(5)?,
                        workspace_id: row.get(6)?,
                        project_id: row.get(7)?,
                        title: row.get(8)?,
                        status: row.get(9)?,
                        entry_surface: row.get(10)?,
                        host_mode: row.get(11)?,
                        engine_id: row.get(12)?,
                        model_id: row.get(13)?,
                        last_turn_at: row.get(14)?,
                        native_session_id: row.get(15)?,
                        sort_timestamp: row.get(16)?,
                        transcript_updated_at: row.get(17)?,
                        pinned: row.get(18)?,
                        archived: row.get(19)?,
                        unread: row.get(20)?,
                    })
                })
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => {
                        RepositoryError::NotFound(format!("session {session_id} not found"))
                    }
                    _ => RepositoryError::Query(e.to_string()),
                })?;

            let runtime_status: Option<String> = conn
                .query_row(
                    &format!(
                        "SELECT {} FROM {} WHERE {} = ?1 AND {} = 0 ORDER BY {} DESC LIMIT 1",
                        columns::runtime::STATUS,
                        columns::runtime::TABLE,
                        columns::runtime::CODING_SESSION_ID,
                        columns::runtime::IS_DELETED,
                        columns::runtime::CREATED_AT,
                    ),
                    params![session_id],
                    |row| row.get(0),
                )
                .ok();

            Ok(row_mapper::session_row_to_payload(row, runtime_status))
        })
        .map_err(CodingSessionError::from)
    }

    async fn create_session(
        &self,
        _ctx: &SessionContext,
        input: &CreateCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let now = Self::now_iso();
        let id = Uuid::new_v4().to_string();
        let workspace_id = input.workspace_id.clone();
        let project_id = input.project_id.clone();
        let title = input.title.clone();
        let host_mode = input.host_mode.clone();
        let engine_id = input.engine_id.clone();
        let model_id = input.model_id.clone();
        let now2 = now.clone();
        let id2 = id.clone();

        self.with_conn(|conn| {
            conn.execute(
                &format!(
                    "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                    columns::session::TABLE,
                    columns::session::ID,
                    columns::session::UUID,
                    columns::session::CREATED_AT,
                    columns::session::UPDATED_AT,
                    columns::session::VERSION,
                    columns::session::IS_DELETED,
                    columns::session::WORKSPACE_ID,
                    columns::session::PROJECT_ID,
                    columns::session::TITLE,
                    columns::session::STATUS,
                    columns::session::ENTRY_SURFACE,
                    columns::session::HOST_MODE,
                    columns::session::ENGINE_ID,
                    columns::session::MODEL_ID,
                    columns::session::SORT_TIMESTAMP,
                ),
                params![
                    id2,
                    None::<String>,
                    now,
                    now2,
                    0i64,
                    0i64,
                    workspace_id,
                    project_id,
                    title,
                    "active",
                    "unknown",
                    host_mode,
                    engine_id,
                    model_id,
                    OffsetDateTime::now_utc().unix_timestamp(),
                ],
            )
            .map_err(|e| RepositoryError::Insert(e.to_string()))?;

            Ok(CodingSessionPayload {
                id: id2,
                workspace_id,
                project_id,
                title,
                status: "active".to_string(),
                host_mode,
                engine_id,
                model_id,
                native_session_id: None,
                created_at: now2.clone(),
                updated_at: now2,
                last_turn_at: None,
                runtime_status: None,
                sort_timestamp: OffsetDateTime::now_utc().unix_timestamp(),
                transcript_updated_at: None,
            })
        })
        .map_err(CodingSessionError::from)
    }

    async fn update_session(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
        input: &UpdateCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let session_id = session_id.to_string();
        let now = Self::now_iso();
        let input = input.clone();

        self.with_conn(|conn| {
            let mut sets = Vec::new();
            let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
            let mut idx = 1usize;

            if let Some(ref title) = input.title {
                sets.push(format!("{} = ?{}", columns::session::TITLE, idx));
                param_values.push(Box::new(title.clone()));
                idx += 1;
            }
            if let Some(ref status) = input.status {
                sets.push(format!("{} = ?{}", columns::session::STATUS, idx));
                param_values.push(Box::new(status.clone()));
                idx += 1;
            }
            if let Some(ref host_mode) = input.host_mode {
                sets.push(format!("{} = ?{}", columns::session::HOST_MODE, idx));
                param_values.push(Box::new(host_mode.clone()));
                idx += 1;
            }
            if let Some(ref engine_id) = input.engine_id {
                sets.push(format!("{} = ?{}", columns::session::ENGINE_ID, idx));
                param_values.push(Box::new(engine_id.clone()));
                idx += 1;
            }
            if let Some(ref model_id) = input.model_id {
                sets.push(format!("{} = ?{}", columns::session::MODEL_ID, idx));
                param_values.push(Box::new(model_id.clone()));
                idx += 1;
            }

            sets.push(format!("{} = ?{}", columns::session::UPDATED_AT, idx));
            param_values.push(Box::new(now.clone()));
            idx += 1;

            sets.push(format!("{} = {} + 1", columns::session::VERSION, columns::session::VERSION));

            let sql = format!(
                "UPDATE {} SET {} WHERE {} = ?{} AND {} = 0",
                columns::session::TABLE,
                sets.join(", "),
                columns::session::ID,
                idx,
                columns::session::IS_DELETED,
            );
            param_values.push(Box::new(session_id.clone()));

            let params_ref: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|p| p.as_ref()).collect();
            let updated = conn
                .execute(&sql, params_ref.as_slice())
                .map_err(|e| RepositoryError::Update(e.to_string()))?;

            if updated == 0 {
                return Err(RepositoryError::NotFound(format!("session {session_id} not found")));
            }

            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1",
                columns::session::TABLE,
                columns::session::ID,
            );
            let row = conn
                .query_row(&sql, params![session_id], |row| {
                    Ok(SessionRow {
                        id: row.get(0)?,
                        uuid: row.get(1)?,
                        created_at: row.get(2)?,
                        updated_at: row.get(3)?,
                        version: row.get(4)?,
                        is_deleted: row.get(5)?,
                        workspace_id: row.get(6)?,
                        project_id: row.get(7)?,
                        title: row.get(8)?,
                        status: row.get(9)?,
                        entry_surface: row.get(10)?,
                        host_mode: row.get(11)?,
                        engine_id: row.get(12)?,
                        model_id: row.get(13)?,
                        last_turn_at: row.get(14)?,
                        native_session_id: row.get(15)?,
                        sort_timestamp: row.get(16)?,
                        transcript_updated_at: row.get(17)?,
                        pinned: row.get(18)?,
                        archived: row.get(19)?,
                        unread: row.get(20)?,
                    })
                })
                .map_err(|e| RepositoryError::Query(e.to_string()))?;

            Ok(row_mapper::session_row_to_payload(row, None))
        })
        .map_err(CodingSessionError::from)
    }

    async fn delete_session(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
    ) -> Result<(), CodingSessionError> {
        let session_id = session_id.to_string();
        let now = Self::now_iso();

        self.with_conn(|conn| {
            let updated = conn
                .execute(
                    &format!(
                        "UPDATE {} SET {} = 1, {} = ?1, {} = {} + 1 WHERE {} = ?2 AND {} = 0",
                        columns::session::TABLE,
                        columns::session::IS_DELETED,
                        columns::session::UPDATED_AT,
                        columns::session::VERSION,
                        columns::session::VERSION,
                        columns::session::ID,
                        columns::session::IS_DELETED,
                    ),
                    params![now, session_id],
                )
                .map_err(|e| RepositoryError::Delete(e.to_string()))?;

            if updated == 0 {
                return Err(RepositoryError::NotFound(format!("session {session_id} not found")));
            }
            Ok(())
        })
        .map_err(CodingSessionError::from)
    }

    async fn fork_session(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
        input: &ForkCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let session_id = session_id.to_string();
        let input = input.clone();

        self.with_conn(|conn| {
            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0",
                columns::session::TABLE,
                columns::session::ID,
                columns::session::IS_DELETED,
            );
            let original = conn
                .query_row(&sql, params![session_id], |row| {
                    Ok(SessionRow {
                        id: row.get(0)?,
                        uuid: row.get(1)?,
                        created_at: row.get(2)?,
                        updated_at: row.get(3)?,
                        version: row.get(4)?,
                        is_deleted: row.get(5)?,
                        workspace_id: row.get(6)?,
                        project_id: row.get(7)?,
                        title: row.get(8)?,
                        status: row.get(9)?,
                        entry_surface: row.get(10)?,
                        host_mode: row.get(11)?,
                        engine_id: row.get(12)?,
                        model_id: row.get(13)?,
                        last_turn_at: row.get(14)?,
                        native_session_id: row.get(15)?,
                        sort_timestamp: row.get(16)?,
                        transcript_updated_at: row.get(17)?,
                        pinned: row.get(18)?,
                        archived: row.get(19)?,
                        unread: row.get(20)?,
                    })
                })
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => {
                        RepositoryError::NotFound(format!("session {session_id} not found"))
                    }
                    _ => RepositoryError::Query(e.to_string()),
                })?;

            let now = Self::now_iso();
            let new_id = Uuid::new_v4().to_string();
            let title = input
                .title
                .unwrap_or_else(|| format!("{} (fork)", original.title));

            conn.execute(
                &format!(
                    "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
                    columns::session::TABLE,
                    columns::session::ID,
                    columns::session::UUID,
                    columns::session::CREATED_AT,
                    columns::session::UPDATED_AT,
                    columns::session::VERSION,
                    columns::session::IS_DELETED,
                    columns::session::WORKSPACE_ID,
                    columns::session::PROJECT_ID,
                    columns::session::TITLE,
                    columns::session::STATUS,
                    columns::session::ENTRY_SURFACE,
                    columns::session::HOST_MODE,
                    columns::session::ENGINE_ID,
                    columns::session::MODEL_ID,
                    columns::session::SORT_TIMESTAMP,
                ),
                params![
                    new_id,
                    None::<String>,
                    now,
                    now,
                    0i64,
                    0i64,
                    original.workspace_id,
                    original.project_id,
                    title,
                    "active",
                    original.entry_surface,
                    original.host_mode,
                    original.engine_id,
                    original.model_id,
                    OffsetDateTime::now_utc().unix_timestamp(),
                ],
            )
            .map_err(|e| RepositoryError::Insert(e.to_string()))?;

            Ok(CodingSessionPayload {
                id: new_id,
                workspace_id: original.workspace_id,
                project_id: original.project_id,
                title,
                status: "active".to_string(),
                host_mode: original.host_mode,
                engine_id: original.engine_id,
                model_id: original.model_id,
                native_session_id: None,
                created_at: now.clone(),
                updated_at: now,
                last_turn_at: None,
                runtime_status: None,
                sort_timestamp: OffsetDateTime::now_utc().unix_timestamp(),
                transcript_updated_at: None,
            })
        })
        .map_err(CodingSessionError::from)
    }

    async fn list_turns(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionTurnPayload>, CodingSessionError> {
        let session_id = session_id.to_string();

        self.with_conn(|conn| {
            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0 ORDER BY {} ASC",
                columns::turn::TABLE,
                columns::turn::CODING_SESSION_ID,
                columns::turn::IS_DELETED,
                columns::turn::CREATED_AT,
            );
            let mut stmt = conn.prepare(&sql).map_err(|e| RepositoryError::Query(e.to_string()))?;
            let rows = stmt
                .query_map(params![session_id], |row| {
                    Ok(TurnRow {
                        id: row.get(0)?,
                        created_at: row.get(1)?,
                        updated_at: row.get(2)?,
                        version: row.get(3)?,
                        is_deleted: row.get(4)?,
                        coding_session_id: row.get(5)?,
                        runtime_id: row.get(6)?,
                        request_kind: row.get(7)?,
                        status: row.get(8)?,
                        input_summary: row.get(9)?,
                        started_at: row.get(10)?,
                        completed_at: row.get(11)?,
                    })
                })
                .map_err(|e| RepositoryError::Query(e.to_string()))?;

            let mut result = Vec::new();
            for row in rows {
                result.push(row_mapper::turn_row_to_payload(row.map_err(|e| RepositoryError::Query(e.to_string()))?));
            }
            Ok(result)
        })
        .map_err(CodingSessionError::from)
    }

    async fn get_turn(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
        turn_id: &str,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError> {
        let session_id = session_id.to_string();
        let turn_id = turn_id.to_string();

        self.with_conn(|conn| {
            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = ?2 AND {} = 0",
                columns::turn::TABLE,
                columns::turn::ID,
                columns::turn::CODING_SESSION_ID,
                columns::turn::IS_DELETED,
            );
            let row = conn
                .query_row(&sql, params![turn_id, session_id], |row| {
                    Ok(TurnRow {
                        id: row.get(0)?,
                        created_at: row.get(1)?,
                        updated_at: row.get(2)?,
                        version: row.get(3)?,
                        is_deleted: row.get(4)?,
                        coding_session_id: row.get(5)?,
                        runtime_id: row.get(6)?,
                        request_kind: row.get(7)?,
                        status: row.get(8)?,
                        input_summary: row.get(9)?,
                        started_at: row.get(10)?,
                        completed_at: row.get(11)?,
                    })
                })
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => {
                        RepositoryError::NotFound(format!("turn {turn_id} not found"))
                    }
                    _ => RepositoryError::Query(e.to_string()),
                })?;

            Ok(row_mapper::turn_row_to_payload(row))
        })
        .map_err(CodingSessionError::from)
    }

    async fn create_turn(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
        input: &CreateCodingSessionTurnInput,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError> {
        let session_id = session_id.to_string();
        let now = Self::now_iso();
        let turn_id = Uuid::new_v4().to_string();
        let runtime_id = input
            .runtime_id
            .clone()
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let request_kind = input.request_kind.clone();
        let input_summary = input.input_summary.clone();
        let now2 = now.clone();

        self.with_conn(|conn| {
            conn.execute(
                &format!(
                    "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                    columns::turn::TABLE,
                    columns::turn::ID,
                    columns::turn::CREATED_AT,
                    columns::turn::UPDATED_AT,
                    columns::turn::VERSION,
                    columns::turn::IS_DELETED,
                    columns::turn::CODING_SESSION_ID,
                    columns::turn::RUNTIME_ID,
                    columns::turn::REQUEST_KIND,
                    columns::turn::STATUS,
                    columns::turn::INPUT_SUMMARY,
                ),
                params![
                    turn_id,
                    now,
                    now2,
                    0i64,
                    0i64,
                    session_id,
                    runtime_id,
                    request_kind,
                    "pending",
                    input_summary,
                ],
            )
            .map_err(|e| RepositoryError::Insert(e.to_string()))?;

            conn.execute(
                &format!(
                    "UPDATE {} SET {} = ?1, {} = ?2 WHERE {} = ?3",
                    columns::session::TABLE,
                    columns::session::LAST_TURN_AT,
                    columns::session::UPDATED_AT,
                    columns::session::ID,
                ),
                params![now, now, session_id],
            )
            .map_err(|e| RepositoryError::Insert(e.to_string()))?;

            Ok(CodingSessionTurnPayload {
                id: turn_id,
                coding_session_id: session_id,
                runtime_id: Some(runtime_id),
                request_kind,
                status: "pending".to_string(),
                input_summary,
                started_at: None,
                completed_at: None,
            })
        })
        .map_err(CodingSessionError::from)
    }

    async fn edit_message(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
        turn_id: &str,
        input: &EditCodingSessionMessageInput,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError> {
        let session_id = session_id.to_string();
        let turn_id = turn_id.to_string();
        let content = input.content.clone();

        self.with_conn(|conn| {
            let now = Self::now_iso();
            conn.execute(
                &format!(
                    "UPDATE {} SET {} = ?1, {} = ?2, {} = {} + 1 WHERE {} = ?3 AND {} = ?4 AND {} = 0",
                    columns::message::TABLE,
                    columns::message::CONTENT,
                    columns::message::UPDATED_AT,
                    columns::message::VERSION,
                    columns::message::VERSION,
                    columns::message::CODING_SESSION_ID,
                    columns::message::TURN_ID,
                    columns::message::IS_DELETED,
                ),
                params![content, now, session_id, turn_id],
            )
            .map_err(|e| RepositoryError::Update(e.to_string()))?;

            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = ?2 AND {} = 0",
                columns::turn::TABLE,
                columns::turn::ID,
                columns::turn::CODING_SESSION_ID,
                columns::turn::IS_DELETED,
            );
            let row = conn
                .query_row(&sql, params![turn_id, session_id], |row| {
                    Ok(TurnRow {
                        id: row.get(0)?,
                        created_at: row.get(1)?,
                        updated_at: row.get(2)?,
                        version: row.get(3)?,
                        is_deleted: row.get(4)?,
                        coding_session_id: row.get(5)?,
                        runtime_id: row.get(6)?,
                        request_kind: row.get(7)?,
                        status: row.get(8)?,
                        input_summary: row.get(9)?,
                        started_at: row.get(10)?,
                        completed_at: row.get(11)?,
                    })
                })
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => {
                        RepositoryError::NotFound(format!("turn {turn_id} not found"))
                    }
                    _ => RepositoryError::Query(e.to_string()),
                })?;

            Ok(row_mapper::turn_row_to_payload(row))
        })
        .map_err(CodingSessionError::from)
    }

    async fn list_events(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionEventPayload>, CodingSessionError> {
        let session_id = session_id.to_string();

        self.with_conn(|conn| {
            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0 ORDER BY {} ASC",
                columns::event::TABLE,
                columns::event::CODING_SESSION_ID,
                columns::event::IS_DELETED,
                columns::event::SEQUENCE_NO,
            );
            let mut stmt = conn.prepare(&sql).map_err(|e| RepositoryError::Query(e.to_string()))?;
            let rows = stmt
                .query_map(params![session_id], |row| {
                    Ok(EventRow {
                        id: row.get(0)?,
                        created_at: row.get(1)?,
                        updated_at: row.get(2)?,
                        version: row.get(3)?,
                        is_deleted: row.get(4)?,
                        coding_session_id: row.get(5)?,
                        turn_id: row.get(6)?,
                        runtime_id: row.get(7)?,
                        event_kind: row.get(8)?,
                        sequence_no: row.get(9)?,
                        payload_json: row.get(10)?,
                    })
                })
                .map_err(|e| RepositoryError::Query(e.to_string()))?;

            let mut result = Vec::new();
            for row in rows {
                result.push(row_mapper::event_row_to_payload(row.map_err(|e| RepositoryError::Query(e.to_string()))?));
            }
            Ok(result)
        })
        .map_err(CodingSessionError::from)
    }

    async fn list_artifacts(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionArtifactPayload>, CodingSessionError> {
        let session_id = session_id.to_string();

        self.with_conn(|conn| {
            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0 ORDER BY {} ASC",
                columns::artifact::TABLE,
                columns::artifact::CODING_SESSION_ID,
                columns::artifact::IS_DELETED,
                columns::artifact::CREATED_AT,
            );
            let mut stmt = conn.prepare(&sql).map_err(|e| RepositoryError::Query(e.to_string()))?;
            let rows = stmt
                .query_map(params![session_id], |row| {
                    Ok(ArtifactRow {
                        id: row.get(0)?,
                        created_at: row.get(1)?,
                        updated_at: row.get(2)?,
                        version: row.get(3)?,
                        is_deleted: row.get(4)?,
                        coding_session_id: row.get(5)?,
                        turn_id: row.get(6)?,
                        artifact_kind: row.get(7)?,
                        title: row.get(8)?,
                        blob_ref: row.get(9)?,
                        metadata_json: row.get(10)?,
                    })
                })
                .map_err(|e| RepositoryError::Query(e.to_string()))?;

            let mut result = Vec::new();
            for row in rows {
                result.push(row_mapper::artifact_row_to_payload(row.map_err(|e| RepositoryError::Query(e.to_string()))?));
            }
            Ok(result)
        })
        .map_err(CodingSessionError::from)
    }

    async fn list_checkpoints(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionCheckpointPayload>, CodingSessionError> {
        let session_id = session_id.to_string();

        self.with_conn(|conn| {
            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = 0 ORDER BY {} ASC",
                columns::checkpoint::TABLE,
                columns::checkpoint::CODING_SESSION_ID,
                columns::checkpoint::IS_DELETED,
                columns::checkpoint::CREATED_AT,
            );
            let mut stmt = conn.prepare(&sql).map_err(|e| RepositoryError::Query(e.to_string()))?;
            let rows = stmt
                .query_map(params![session_id], |row| {
                    Ok(CheckpointRow {
                        id: row.get(0)?,
                        created_at: row.get(1)?,
                        updated_at: row.get(2)?,
                        version: row.get(3)?,
                        is_deleted: row.get(4)?,
                        coding_session_id: row.get(5)?,
                        runtime_id: row.get(6)?,
                        checkpoint_kind: row.get(7)?,
                        resumable: row.get(8)?,
                        state_json: row.get(9)?,
                    })
                })
                .map_err(|e| RepositoryError::Query(e.to_string()))?;

            let mut result = Vec::new();
            for row in rows {
                result.push(row_mapper::checkpoint_row_to_payload(row.map_err(|e| RepositoryError::Query(e.to_string()))?));
            }
            Ok(result)
        })
        .map_err(CodingSessionError::from)
    }

    async fn submit_approval_decision(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
        checkpoint_id: &str,
        input: &SubmitApprovalDecisionInput,
    ) -> Result<ApprovalDecisionPayload, CodingSessionError> {
        let session_id = session_id.to_string();
        let checkpoint_id = checkpoint_id.to_string();
        let decision = input.decision.clone();
        let reason = input.reason.clone();

        self.with_conn(|conn| {
            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = ?2 AND {} = 0",
                columns::checkpoint::TABLE,
                columns::checkpoint::ID,
                columns::checkpoint::CODING_SESSION_ID,
                columns::checkpoint::IS_DELETED,
            );
            let row = conn
                .query_row(&sql, params![checkpoint_id, session_id], |row| {
                    Ok(CheckpointRow {
                        id: row.get(0)?,
                        created_at: row.get(1)?,
                        updated_at: row.get(2)?,
                        version: row.get(3)?,
                        is_deleted: row.get(4)?,
                        coding_session_id: row.get(5)?,
                        runtime_id: row.get(6)?,
                        checkpoint_kind: row.get(7)?,
                        resumable: row.get(8)?,
                        state_json: row.get(9)?,
                    })
                })
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => {
                        RepositoryError::NotFound(format!("checkpoint {checkpoint_id} not found"))
                    }
                    _ => RepositoryError::Query(e.to_string()),
                })?;

            let runtime_id = row.runtime_id.clone();
            let mut state: BTreeMap<String, serde_json::Value> =
                serde_json::from_str(&row.state_json).unwrap_or_default();

            let approval_id = Uuid::new_v4().to_string();
            let now = Self::now_iso();

            let mut approvals: Vec<serde_json::Value> = state
                .get("approvals")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();

            approvals.push(serde_json::json!({
                "approvalId": approval_id,
                "decision": decision,
                "reason": reason,
                "decidedAt": now,
            }));

            state.insert(
                "approvals".to_string(),
                serde_json::to_value(&approvals).unwrap_or_default(),
            );

            let new_state_json = serde_json::to_string(&state).unwrap_or_else(|_| "{}".to_string());
            conn.execute(
                &format!(
                    "UPDATE {} SET {} = ?1, {} = ?2, {} = {} + 1 WHERE {} = ?3",
                    columns::checkpoint::TABLE,
                    columns::checkpoint::STATE_JSON,
                    columns::checkpoint::UPDATED_AT,
                    columns::checkpoint::VERSION,
                    columns::checkpoint::VERSION,
                    columns::checkpoint::ID,
                ),
                params![new_state_json, now, checkpoint_id],
            )
            .map_err(|e| RepositoryError::Update(e.to_string()))?;

            Ok(ApprovalDecisionPayload {
                approval_id,
                checkpoint_id,
                coding_session_id: session_id,
                runtime_id,
                turn_id: None,
                operation_id: None,
                decision,
                reason,
                decided_at: now,
                runtime_status: "approved".to_string(),
                operation_status: "approved".to_string(),
            })
        })
        .map_err(CodingSessionError::from)
    }

    async fn submit_user_question_answer(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
        question_id: &str,
        input: &SubmitUserQuestionAnswerInput,
    ) -> Result<UserQuestionAnswerPayload, CodingSessionError> {
        let session_id = session_id.to_string();
        let question_id = question_id.to_string();
        let answer = input.answer.clone();
        let option_id = input.option_id.clone();
        let option_label = input.option_label.clone();
        let rejected = input.rejected;

        self.with_conn(|conn| {
            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = ?2 AND {} = 0",
                columns::event::TABLE,
                columns::event::CODING_SESSION_ID,
                columns::event::ID,
                columns::event::IS_DELETED,
            );
            let row = conn
                .query_row(&sql, params![session_id, question_id], |row| {
                    Ok(EventRow {
                        id: row.get(0)?,
                        created_at: row.get(1)?,
                        updated_at: row.get(2)?,
                        version: row.get(3)?,
                        is_deleted: row.get(4)?,
                        coding_session_id: row.get(5)?,
                        turn_id: row.get(6)?,
                        runtime_id: row.get(7)?,
                        event_kind: row.get(8)?,
                        sequence_no: row.get(9)?,
                        payload_json: row.get(10)?,
                    })
                })
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => {
                        RepositoryError::NotFound(format!("question event {question_id} not found"))
                    }
                    _ => RepositoryError::Query(e.to_string()),
                })?;

            let runtime_id = row.runtime_id.clone();
            let turn_id = row.turn_id.clone();
            let mut payload: BTreeMap<String, serde_json::Value> =
                serde_json::from_str(&row.payload_json).unwrap_or_default();

            let now = Self::now_iso();
            if let Some(a) = &answer {
                payload.insert("answer".to_string(), serde_json::Value::String(a.clone()));
            }
            if let Some(oid) = &option_id {
                payload.insert("optionId".to_string(), serde_json::Value::String(oid.clone()));
            }
            if let Some(ol) = &option_label {
                payload.insert("optionLabel".to_string(), serde_json::Value::String(ol.clone()));
            }
            payload.insert("rejected".to_string(), serde_json::Value::Bool(rejected));
            payload.insert("answeredAt".to_string(), serde_json::Value::String(now.clone()));

            let new_payload_json = serde_json::to_string(&payload).unwrap_or_else(|_| "{}".to_string());
            conn.execute(
                &format!(
                    "UPDATE {} SET {} = ?1, {} = ?2, {} = {} + 1 WHERE {} = ?3",
                    columns::event::TABLE,
                    columns::event::PAYLOAD_JSON,
                    columns::event::UPDATED_AT,
                    columns::event::VERSION,
                    columns::event::VERSION,
                    columns::event::ID,
                ),
                params![new_payload_json, now, question_id],
            )
            .map_err(|e| RepositoryError::Update(e.to_string()))?;

            Ok(UserQuestionAnswerPayload {
                question_id,
                coding_session_id: session_id,
                answer,
                answered_at: now,
                option_id,
                option_label,
                rejected,
                runtime_id,
                runtime_status: "answered".to_string(),
                turn_id,
            })
        })
        .map_err(CodingSessionError::from)
    }

    async fn get_operation(
        &self,
        _ctx: &SessionContext,
        session_id: &str,
        operation_id: &str,
    ) -> Result<OperationPayload, CodingSessionError> {
        let session_id = session_id.to_string();
        let operation_id = operation_id.to_string();

        self.with_conn(|conn| {
            let sql = format!(
                "SELECT * FROM {} WHERE {} = ?1 AND {} = ?2 AND {} = 0",
                columns::operation::TABLE,
                columns::operation::ID,
                columns::operation::CODING_SESSION_ID,
                columns::operation::IS_DELETED,
            );
            let row = conn
                .query_row(&sql, params![operation_id, session_id], |row| {
                    Ok(OperationRow {
                        id: row.get(0)?,
                        created_at: row.get(1)?,
                        updated_at: row.get(2)?,
                        version: row.get(3)?,
                        is_deleted: row.get(4)?,
                        coding_session_id: row.get(5)?,
                        turn_id: row.get(6)?,
                        status: row.get(7)?,
                        stream_url: row.get(8)?,
                        stream_kind: row.get(9)?,
                        artifact_refs_json: row.get(10)?,
                    })
                })
                .map_err(|e| match e {
                    rusqlite::Error::QueryReturnedNoRows => {
                        RepositoryError::NotFound(format!("operation {operation_id} not found"))
                    }
                    _ => RepositoryError::Query(e.to_string()),
                })?;

            Ok(row_mapper::operation_row_to_payload(row))
        })
        .map_err(CodingSessionError::from)
    }
}

