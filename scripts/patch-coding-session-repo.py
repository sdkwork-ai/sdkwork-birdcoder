#!/usr/bin/env python3
"""Patch coding_session_repository for tenant isolation and shared SQLite conn."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "crates/sdkwork-birdcoder-coding-sessions-repository-sqlx/src/repository/coding_session_repository.rs"

HELPERS = r'''
fn parse_scoped_tenant_id(ctx: &CodingSessionContext) -> Option<i64> {
    ctx.tenant_id
        .parse::<i64>()
        .ok()
        .filter(|tenant_id| *tenant_id > 0)
}

fn append_session_tenant_scope(
    ctx: &CodingSessionContext,
    session_alias: &str,
    sql: &mut String,
    param_values: &mut Vec<Box<dyn rusqlite::types::ToSql>>,
) {
    if let Some(tenant_id) = parse_scoped_tenant_id(ctx) {
        sql.push_str(&format!(
            " AND EXISTS (SELECT 1 FROM studio_workspace w WHERE CAST(w.id AS TEXT) = {session_alias}.workspace_id AND w.tenant_id = ?{} AND w.is_deleted = 0)",
            param_values.len() + 1
        ));
        param_values.push(Box::new(tenant_id));
    }
}

fn ensure_workspace_in_tenant_scope(
    conn: &Connection,
    ctx: &CodingSessionContext,
    workspace_id: &str,
) -> Result<(), RepositoryError> {
    let Some(tenant_id) = parse_scoped_tenant_id(ctx) else {
        return Ok(());
    };
    let workspace_id = workspace_id.trim();
    if workspace_id.is_empty() {
        return Err(RepositoryError::NotFound("workspace not found".into()));
    }
    let found = conn
        .query_row(
            "SELECT 1 FROM studio_workspace WHERE CAST(id AS TEXT) = ?1 AND tenant_id = ?2 AND is_deleted = 0",
            params![workspace_id, tenant_id],
            |_| Ok(()),
        )
        .optional()
        .map_err(|error| RepositoryError::Query(error.to_string()))?
        .is_some();
    if !found {
        return Err(RepositoryError::NotFound(format!(
            "workspace {workspace_id} not found"
        )));
    }
    Ok(())
}

fn ensure_session_in_tenant_scope(
    conn: &Connection,
    ctx: &CodingSessionContext,
    session_id: &str,
) -> Result<(), RepositoryError> {
    if parse_scoped_tenant_id(ctx).is_none() {
        return Ok(());
    }
    let mut sql = format!(
        "SELECT 1 FROM {} s WHERE s.{} = ?1 AND s.{} = 0",
        columns::session::TABLE,
        columns::session::ID,
        columns::session::IS_DELETED,
    );
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> =
        vec![Box::new(session_id.to_string())];
    append_session_tenant_scope(ctx, "s", &mut sql, &mut param_values);
    let params_ref: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|param| param.as_ref()).collect();
    let found = conn
        .query_row(&sql, params_ref.as_slice(), |_| Ok(()))
        .optional()
        .map_err(|error| RepositoryError::Query(error.to_string()))?
        .is_some();
    if !found {
        return Err(RepositoryError::NotFound(format!(
            "session {session_id} not found"
        )));
    }
    Ok(())
}
'''

FINALIZE_METHODS = r'''
    async fn finalize_turn_execution(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        finalized: &FinalizedProjectionTurnExecution,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError> {
        let session_id = session_id.to_string();
        let turn = finalized.turn.clone();
        let turn_id = turn.id.clone();
        let now = Self::now_iso();

        self.with_conn(|conn| {
            ensure_session_in_tenant_scope(conn, ctx, &session_id)?;
            let started_at = turn.started_at.clone().unwrap_or_else(|| now.clone());
            let completed_at = turn.completed_at.clone().unwrap_or_else(|| now.clone());

            conn.execute(
                &format!(
                    "UPDATE {} SET {} = ?1, {} = ?2, {} = ?3, {} = ?4, {} = {} + 1 \
                     WHERE {} = ?5 AND {} = ?6 AND {} = 0",
                    columns::turn::TABLE,
                    columns::turn::STATUS,
                    columns::turn::STARTED_AT,
                    columns::turn::COMPLETED_AT,
                    columns::turn::UPDATED_AT,
                    columns::turn::VERSION,
                    columns::turn::VERSION,
                    columns::turn::ID,
                    columns::turn::CODING_SESSION_ID,
                    columns::turn::IS_DELETED,
                ),
                params![
                    turn.status,
                    started_at,
                    completed_at,
                    now,
                    turn_id,
                    session_id,
                ],
            )
            .map_err(|e| RepositoryError::Update(e.to_string()))?;

            for event in &finalized.events {
                let payload_json = serde_json::to_string(&event.payload)
                    .map_err(|e| RepositoryError::Insert(e.to_string()))?;
                conn.execute(
                    &format!(
                        "INSERT INTO {} ({}, {}, {}, {}, {}, {}, {}, {}, {}, {}, {}) \
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                        columns::event::TABLE,
                        columns::event::ID,
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
                    ),
                    params![
                        event.id,
                        event.created_at,
                        event.created_at,
                        0i64,
                        0i64,
                        session_id,
                        event.turn_id,
                        event.runtime_id,
                        event.kind,
                        event.sequence as i64,
                        payload_json,
                    ],
                )
                .map_err(|e| RepositoryError::Insert(e.to_string()))?;
            }

            Ok(turn)
        })
        .map_err(CodingSessionError::from)
    }

    async fn mark_turn_failed(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        turn_id: &str,
    ) -> Result<(), CodingSessionError> {
        let session_id = session_id.to_string();
        let turn_id = turn_id.to_string();
        let now = Self::now_iso();

        self.with_conn(|conn| {
            ensure_session_in_tenant_scope(conn, ctx, &session_id)?;
            conn.execute(
                &format!(
                    "UPDATE {} SET {} = 'failed', {} = ?1, {} = {} + 1 \
                     WHERE {} = ?2 AND {} = ?3 AND {} = 0",
                    columns::turn::TABLE,
                    columns::turn::STATUS,
                    columns::turn::UPDATED_AT,
                    columns::turn::VERSION,
                    columns::turn::VERSION,
                    columns::turn::ID,
                    columns::turn::CODING_SESSION_ID,
                    columns::turn::IS_DELETED,
                ),
                params![now, turn_id, session_id],
            )
            .map_err(|e| RepositoryError::Update(e.to_string()))?;
            Ok(())
        })
        .map_err(CodingSessionError::from)
    }
'''

SESSION_METHODS = [
    "update_session",
    "delete_session",
    "fork_session",
    "list_turns",
    "get_turn",
    "create_turn",
    "edit_message",
    "list_events",
    "list_artifacts",
    "list_checkpoints",
    "submit_approval_decision",
    "submit_user_question_answer",
    "get_operation",
]


def insert_after_with_conn(body: str, line: str) -> str:
    marker = "self.with_conn(|conn| {"
    start = body.find(marker)
    if start < 0:
        raise ValueError(f"missing with_conn in method body for guard: {line.strip()}")
    insert_at = start + len(marker)
    if body[insert_at : insert_at + 1] == "\n":
        insert_at += 1
    return body[:insert_at] + f"\n            {line}\n" + body[insert_at:]


def patch_method(src: str, name: str, guard: str) -> str:
    match = re.search(rf"async fn {name}\(", src)
    if not match:
        raise SystemExit(f"missing method {name}")
    start = match.start()
    next_match = re.search(r"\n    async fn ", src[start + 1 :])
    end = start + 1 + next_match.start() if next_match else len(src)
    block = src[start:end]
    if guard.split("(")[0] in block.split("self.with_conn(|conn| {", 1)[1]:
        return src
    patched = insert_after_with_conn(block, guard)
    return src[:start] + patched + src[end:]


def main() -> None:
    src = PATH.read_text(encoding="utf-8")

    src = src.replace("use std::sync::Mutex;", "use std::sync::{Arc, Mutex};")
    src = src.replace(
        "use rusqlite::{params, Connection};",
        "use rusqlite::{params, Connection, OptionalExtension};",
    )
    src = src.replace(
        "use sdkwork_birdcoder_coding_sessions_service::context::SessionContext;",
        "use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;",
    )
    src = src.replace("_ctx: &SessionContext", "ctx: &CodingSessionContext")

    if "FinalizedProjectionTurnExecution" not in src:
        src = src.replace(
            "    CodingSessionTurnPayload,\n    OperationPayload,",
            "    CodingSessionTurnPayload,\n    FinalizedProjectionTurnExecution,\n    OperationPayload,",
        )

    if "parse_scoped_tenant_id" not in src:
        src = src.replace("use uuid::Uuid;\n\nuse crate::db::columns;", f"use uuid::Uuid;{HELPERS}\n\nuse crate::db::columns;")

    src = src.replace(
        "pub struct SqliteCodingSessionRepository {\n    conn: Mutex<Connection>,\n}",
        "pub struct SqliteCodingSessionRepository {\n    conn: Arc<Mutex<Connection>>,\n}",
    )
    src = src.replace(
        "        Self {\n            conn: Mutex::new(conn),\n        }\n    }",
        "        Self {\n            conn: Arc::new(Mutex::new(conn)),\n        }\n    }\n\n    pub fn with_shared(conn: Arc<Mutex<Connection>>) -> Self {\n        Self { conn }\n    }",
    )

    if "append_session_tenant_scope(ctx, \"s\"" not in src:
        src = src.replace(
            "            let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();\n\n"
            "            if let Some(ref engine_id) = query.engine_id {",
            "            let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();\n"
            "            append_session_tenant_scope(ctx, \"s\", &mut sql, &mut param_values);\n\n"
            "            if let Some(ref engine_id) = query.engine_id {",
        )

    old_get = (
        "        self.with_conn(|conn| {\n"
        "            let sql = format!(\n"
        "                \"SELECT * FROM {} WHERE {} = ?1 AND {} = 0\",\n"
        "                columns::session::TABLE,\n"
        "                columns::session::ID,\n"
        "                columns::session::IS_DELETED,\n"
        "            );\n"
        "            let row = conn\n"
        "                .query_row(&sql, params![session_id], |row| {"
    )
    new_get = (
        "        self.with_conn(|conn| {\n"
        "            let mut sql = format!(\n"
        "                \"SELECT * FROM {} WHERE {} = ?1 AND {} = 0\",\n"
        "                columns::session::TABLE,\n"
        "                columns::session::ID,\n"
        "                columns::session::IS_DELETED,\n"
        "            );\n"
        "            let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> =\n"
        "                vec![Box::new(session_id.clone())];\n"
        "            append_session_tenant_scope(ctx, columns::session::TABLE, &mut sql, &mut param_values);\n"
        "            let params_ref: Vec<&dyn rusqlite::types::ToSql> =\n"
        "                param_values.iter().map(|param| param.as_ref()).collect();\n"
        "            let row = conn\n"
        "                .query_row(&sql, params_ref.as_slice(), |row| {"
    )
    if old_get in src:
        src = src.replace(old_get, new_get)

    for name in SESSION_METHODS:
        src = patch_method(src, name, "ensure_session_in_tenant_scope(conn, ctx, &session_id)?;")

    src = patch_method(
        src,
        "create_session",
        "ensure_workspace_in_tenant_scope(conn, ctx, &workspace_id)?;",
    )

    if "async fn finalize_turn_execution" not in src:
        src = src.replace(
            "            Ok(row_mapper::operation_row_to_payload(row))\n"
            "        })\n"
            "        .map_err(CodingSessionError::from)\n"
            "    }\n}",
            "            Ok(row_mapper::operation_row_to_payload(row))\n"
            "        })\n"
            "        .map_err(CodingSessionError::from)\n"
            "    }\n"
            + FINALIZE_METHODS
            + "\n}",
        )

    PATH.write_text(src, encoding="utf-8", newline="\n")
    print(f"patched {PATH}")


if __name__ == "__main__":
    main()
