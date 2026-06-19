#!/usr/bin/env python3
"""Mechanical rusqlite -> sqlx migration helper for coding_session_repository.rs."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = (
    ROOT
    / "crates/sdkwork-birdcoder-coding-sessions-repository-sqlx/src/repository/coding_session_repository.rs"
)

HEADER = """use std::collections::BTreeMap;

use sqlx::{Row, SqlitePool};
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
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
    FinalizedProjectionTurnExecution,
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
use crate::repository::sqlx_helpers::{
    append_session_tenant_scope_binds, ensure_session_in_tenant_scope, ensure_workspace_in_tenant_scope,
    parse_scoped_tenant_id, session_row_from_sqlite_row,
};

#[derive(Clone)]
pub struct SqliteCodingSessionRepository {
    pool: SqlitePool,
}

impl SqliteCodingSessionRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub fn with_pool(pool: SqlitePool) -> Self {
        Self::new(pool)
    }

    fn now_iso() -> String {
        OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string())
    }
}
"""


def main() -> None:
    source = TARGET.read_text(encoding="utf-8")
    marker = "#[async_trait::async_trait]"
    if marker not in source:
        raise SystemExit("async_trait marker not found")

    impl_body = source.split(marker, 1)[1]
    impl_body = re.sub(
        r"self\.with_conn\(\|conn\| \{",
        "async move {",
        impl_body,
    )
    impl_body = re.sub(
        r"\}\)\s*\n\s*\.map_err\(CodingSessionError::from\)",
        "}.await.map_err(CodingSessionError::from)",
        impl_body,
    )
    impl_body = impl_body.replace("conn.", "self.pool.")
    impl_body = impl_body.replace(
        "Vec<Box<dyn rusqlite::types::ToSql>>",
        "Vec<String>",
    )
    impl_body = impl_body.replace(
        "param_values.push(Box::new(",
        "param_values.push(",
    )
    impl_body = re.sub(
        r"param_values\.push\(([^)]+)\)\);",
        r"param_values.push(\1.to_string());",
        impl_body,
    )

    TARGET.write_text(HEADER + "\n" + marker + impl_body, encoding="utf-8")
    print(f"migrated {TARGET}")


if __name__ == "__main__":
    main()
