use sdkwork_birdcoder_sqlx_repository_pool::dialect::row_get_bool_as_i64;
use sqlx::Row;

pub struct SessionRow {
    pub id: String,
    pub uuid: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub workspace_id: String,
    pub project_id: String,
    pub title: String,
    pub status: String,
    pub entry_surface: String,
    pub host_mode: String,
    pub engine_id: String,
    pub model_id: String,
    pub last_turn_at: Option<String>,
    pub native_session_id: Option<String>,
    pub native_session_tree_id: Option<String>,
    pub native_parent_session_id: Option<String>,
    pub native_forked_from_session_id: Option<String>,
    pub native_title: Option<String>,
    pub native_preview: Option<String>,
    pub native_source: Option<String>,
    pub provider_version: Option<String>,
    pub model_provider: Option<String>,
    pub native_project_id: Option<String>,
    pub native_cwd: Option<String>,
    pub native_git_branch: Option<String>,
    pub native_git_commit: Option<String>,
    pub native_git_repository_url: Option<String>,
    pub native_agent_name: Option<String>,
    pub native_agent_role: Option<String>,
    pub native_is_ephemeral: i64,
    pub native_is_sidechain: i64,
    pub native_schema_version: i64,
    pub native_metadata_json: String,
    pub sort_timestamp: Option<i64>,
    pub transcript_updated_at: Option<String>,
    pub pinned: i64,
    pub archived: i64,
    pub unread: i64,
}

impl SessionRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            workspace_id: row.try_get("workspace_id")?,
            project_id: row.try_get("project_id")?,
            title: row.try_get("title")?,
            status: row.try_get("status")?,
            entry_surface: row.try_get("entry_surface")?,
            host_mode: row.try_get("host_mode")?,
            engine_id: row.try_get("engine_id")?,
            model_id: row.try_get("model_id")?,
            last_turn_at: row.try_get("last_turn_at")?,
            native_session_id: row.try_get("native_session_id")?,
            native_session_tree_id: row.try_get("native_session_tree_id")?,
            native_parent_session_id: row.try_get("native_parent_session_id")?,
            native_forked_from_session_id: row.try_get("native_forked_from_session_id")?,
            native_title: row.try_get("native_title")?,
            native_preview: row.try_get("native_preview")?,
            native_source: row.try_get("native_source")?,
            provider_version: row.try_get("provider_version")?,
            model_provider: row.try_get("model_provider")?,
            native_project_id: row.try_get("native_project_id")?,
            native_cwd: row.try_get("native_cwd")?,
            native_git_branch: row.try_get("native_git_branch")?,
            native_git_commit: row.try_get("native_git_commit")?,
            native_git_repository_url: row.try_get("native_git_repository_url")?,
            native_agent_name: row.try_get("native_agent_name")?,
            native_agent_role: row.try_get("native_agent_role")?,
            native_is_ephemeral: row_get_bool_as_i64(row, "native_is_ephemeral")?,
            native_is_sidechain: row_get_bool_as_i64(row, "native_is_sidechain")?,
            native_schema_version: row.try_get("native_schema_version")?,
            native_metadata_json: row.try_get("native_metadata_json")?,
            sort_timestamp: row.try_get("sort_timestamp")?,
            transcript_updated_at: row.try_get("transcript_updated_at")?,
            pinned: row_get_bool_as_i64(row, "pinned")?,
            archived: row_get_bool_as_i64(row, "archived")?,
            unread: row_get_bool_as_i64(row, "unread")?,
        })
    }
}

pub struct MessageRow {
    pub id: String,
    pub uuid: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub coding_session_id: String,
    pub turn_id: Option<String>,
    pub role: String,
    pub content: String,
    pub metadata_json: String,
    pub timestamp_ms: Option<i64>,
    pub name: Option<String>,
    pub tool_calls_json: Option<String>,
    pub tool_call_id: Option<String>,
    pub file_changes_json: Option<String>,
    pub commands_json: Option<String>,
    pub task_progress_json: Option<String>,
}

impl MessageRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            uuid: row.try_get("uuid")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            coding_session_id: row.try_get("coding_session_id")?,
            turn_id: row.try_get("turn_id")?,
            role: row.try_get("role")?,
            content: row.try_get("content")?,
            metadata_json: row.try_get("metadata_json")?,
            timestamp_ms: row.try_get("timestamp_ms")?,
            name: row.try_get("name")?,
            tool_calls_json: row.try_get("tool_calls_json")?,
            tool_call_id: row.try_get("tool_call_id")?,
            file_changes_json: row.try_get("file_changes_json")?,
            commands_json: row.try_get("commands_json")?,
            task_progress_json: row.try_get("task_progress_json")?,
        })
    }
}

pub struct RuntimeRow {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub coding_session_id: String,
    pub engine_id: String,
    pub model_id: String,
    pub host_mode: String,
    pub status: String,
    pub transport_kind: String,
    pub native_session_id: Option<String>,
    pub native_turn_container_id: Option<String>,
    pub capability_snapshot_json: String,
    pub metadata_json: String,
}

pub struct TurnRow {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub coding_session_id: String,
    pub runtime_id: String,
    pub request_kind: String,
    pub status: String,
    pub input_summary: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

impl TurnRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            coding_session_id: row.try_get("coding_session_id")?,
            runtime_id: row.try_get("runtime_id")?,
            request_kind: row.try_get("request_kind")?,
            status: row.try_get("status")?,
            input_summary: row.try_get("input_summary")?,
            started_at: row.try_get("started_at")?,
            completed_at: row.try_get("completed_at")?,
        })
    }
}

pub struct EventRow {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub coding_session_id: String,
    pub turn_id: Option<String>,
    pub runtime_id: Option<String>,
    pub event_kind: String,
    pub sequence_no: i64,
    pub payload_json: String,
}

impl EventRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            coding_session_id: row.try_get("coding_session_id")?,
            turn_id: row.try_get("turn_id")?,
            runtime_id: row.try_get("runtime_id")?,
            event_kind: row.try_get("event_kind")?,
            sequence_no: row.try_get("sequence_no")?,
            payload_json: row.try_get("payload_json")?,
        })
    }
}

pub struct ArtifactRow {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub coding_session_id: String,
    pub turn_id: Option<String>,
    pub artifact_kind: String,
    pub title: String,
    pub blob_ref: Option<String>,
    pub metadata_json: String,
}

impl ArtifactRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            coding_session_id: row.try_get("coding_session_id")?,
            turn_id: row.try_get("turn_id")?,
            artifact_kind: row.try_get("artifact_kind")?,
            title: row.try_get("title")?,
            blob_ref: row.try_get("blob_ref")?,
            metadata_json: row.try_get("metadata_json")?,
        })
    }
}

pub struct CheckpointRow {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub coding_session_id: String,
    pub runtime_id: Option<String>,
    pub checkpoint_kind: String,
    pub resumable: i64,
    pub state_json: String,
}

impl CheckpointRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            coding_session_id: row.try_get("coding_session_id")?,
            runtime_id: row.try_get("runtime_id")?,
            checkpoint_kind: row.try_get("checkpoint_kind")?,
            resumable: row.try_get("resumable")?,
            state_json: row.try_get("state_json")?,
        })
    }
}

pub struct OperationRow {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub coding_session_id: String,
    pub turn_id: String,
    pub status: String,
    pub stream_url: String,
    pub stream_kind: String,
    pub artifact_refs_json: String,
}

impl OperationRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
            version: row.try_get("version")?,
            is_deleted: row_get_bool_as_i64(row, "is_deleted")?,
            coding_session_id: row.try_get("coding_session_id")?,
            turn_id: row.try_get("turn_id")?,
            status: row.try_get("status")?,
            stream_url: row.try_get("stream_url")?,
            stream_kind: row.try_get("stream_kind")?,
            artifact_refs_json: row.try_get("artifact_refs_json")?,
        })
    }
}

pub struct DurableOperationRow {
    pub id: String,
    pub tenant_id: i64,
    pub user_id: i64,
    pub coding_session_id: String,
    pub turn_id: String,
    pub status: String,
    pub request_payload_json: String,
    pub request_fingerprint: String,
    pub idempotency_key: Option<String>,
    pub available_at: String,
    pub attempt: i64,
    pub max_attempt: i64,
    pub lease_owner: Option<String>,
    pub lease_expires_at: Option<String>,
    pub fencing_token: i64,
    pub runner_id: Option<String>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub problem_json: Option<String>,
}

impl DurableOperationRow {
    pub fn from_row(row: &sqlx::any::AnyRow) -> Result<Self, sqlx::Error> {
        Ok(Self {
            id: row.try_get("id")?,
            tenant_id: row.try_get("tenant_id")?,
            user_id: row.try_get("user_id")?,
            coding_session_id: row.try_get("coding_session_id")?,
            turn_id: row.try_get("turn_id")?,
            status: row.try_get("status")?,
            request_payload_json: row.try_get("request_payload_json")?,
            request_fingerprint: row.try_get("request_fingerprint")?,
            idempotency_key: row.try_get("idempotency_key")?,
            available_at: row.try_get("available_at")?,
            attempt: row.try_get("attempt")?,
            max_attempt: row.try_get("max_attempt")?,
            lease_owner: row.try_get("lease_owner")?,
            lease_expires_at: row.try_get("lease_expires_at")?,
            fencing_token: row.try_get("fencing_token")?,
            runner_id: row.try_get("runner_id")?,
            started_at: row.try_get("started_at")?,
            completed_at: row.try_get("completed_at")?,
            problem_json: row.try_get("problem_json")?,
        })
    }
}

pub struct PromptEntryRow {
    pub id: String,
    pub created_at: String,
    pub updated_at: String,
    pub version: i64,
    pub is_deleted: i64,
    pub coding_session_id: String,
    pub prompt_text: String,
    pub normalized_prompt_text: String,
    pub last_used_at: String,
    pub use_count: i64,
}
