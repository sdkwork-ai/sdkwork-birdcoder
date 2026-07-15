use std::collections::BTreeMap;

use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    CodingSessionArtifactPayload, CodingSessionCheckpointPayload, CodingSessionEventPayload,
    CodingSessionPayload, CodingSessionTurnPayload, OperationPayload,
};
use sdkwork_birdcoder_coding_sessions_service::native_session_types::NativeSessionAttributesPayload;

use crate::db::rows::{ArtifactRow, CheckpointRow, EventRow, OperationRow, SessionRow, TurnRow};

pub fn session_row_to_payload(
    row: SessionRow,
    runtime_status: Option<String>,
) -> CodingSessionPayload {
    CodingSessionPayload {
        id: row.id,
        workspace_id: row.workspace_id,
        project_id: row.project_id,
        title: row.title,
        status: row.status,
        host_mode: row.host_mode,
        engine_id: row.engine_id,
        model_id: row.model_id,
        native_session_id: row.native_session_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_turn_at: row.last_turn_at,
        runtime_status,
        sort_timestamp: row.sort_timestamp.unwrap_or(0),
        transcript_updated_at: row.transcript_updated_at,
        native_attributes: NativeSessionAttributesPayload {
            schema_version: row.native_schema_version,
            session_tree_id: row.native_session_tree_id,
            parent_session_id: row.native_parent_session_id,
            forked_from_session_id: row.native_forked_from_session_id,
            title: row.native_title,
            preview: row.native_preview,
            source: row.native_source,
            provider_version: row.provider_version,
            model_provider: row.model_provider,
            project_id: row.native_project_id,
            cwd: row.native_cwd,
            git_branch: row.native_git_branch,
            git_commit: row.native_git_commit,
            git_repository_url: row.native_git_repository_url,
            agent_name: row.native_agent_name,
            agent_role: row.native_agent_role,
            is_ephemeral: row.native_is_ephemeral != 0,
            is_sidechain: row.native_is_sidechain != 0,
            metadata: parse_json_btree_map(&row.native_metadata_json),
        },
    }
}

pub fn turn_row_to_payload(row: TurnRow) -> CodingSessionTurnPayload {
    CodingSessionTurnPayload {
        id: row.id,
        coding_session_id: row.coding_session_id,
        runtime_id: Some(row.runtime_id),
        request_kind: row.request_kind,
        status: row.status,
        input_summary: row.input_summary,
        started_at: row.started_at,
        completed_at: row.completed_at,
    }
}

pub fn event_row_to_payload(row: EventRow) -> CodingSessionEventPayload {
    CodingSessionEventPayload {
        id: row.id,
        coding_session_id: row.coding_session_id,
        turn_id: row.turn_id,
        runtime_id: row.runtime_id,
        kind: row.event_kind,
        sequence: row.sequence_no as usize,
        payload: parse_json_btree_map(&row.payload_json),
        created_at: row.created_at,
    }
}

pub fn artifact_row_to_payload(row: ArtifactRow) -> CodingSessionArtifactPayload {
    let metadata = parse_string_btree_map(&row.metadata_json);
    CodingSessionArtifactPayload {
        id: row.id,
        coding_session_id: row.coding_session_id,
        turn_id: row.turn_id,
        kind: row.artifact_kind,
        status: String::new(),
        title: row.title,
        metadata,
        created_at: row.created_at,
    }
}

pub fn checkpoint_row_to_payload(row: CheckpointRow) -> CodingSessionCheckpointPayload {
    CodingSessionCheckpointPayload {
        id: row.id,
        coding_session_id: row.coding_session_id,
        runtime_id: row.runtime_id,
        checkpoint_kind: row.checkpoint_kind,
        resumable: row.resumable != 0,
        state: parse_json_btree_map(&row.state_json),
        created_at: row.created_at,
    }
}

pub fn operation_row_to_payload(row: OperationRow) -> OperationPayload {
    let artifact_refs: Vec<String> =
        serde_json::from_str(&row.artifact_refs_json).unwrap_or_default();
    OperationPayload {
        operation_id: row.id,
        status: row.status,
        artifact_refs,
        stream_url: row.stream_url,
        stream_kind: row.stream_kind,
    }
}

fn parse_json_btree_map(json: &str) -> BTreeMap<String, serde_json::Value> {
    serde_json::from_str(json).unwrap_or_default()
}

fn parse_string_btree_map(json: &str) -> BTreeMap<String, String> {
    serde_json::from_str(json).unwrap_or_default()
}
