pub mod session {
    pub const TABLE: &str = "ai_coding_session";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const TENANT_ID: &str = "tenant_id";
    pub const USER_ID: &str = "user_id";
    pub const WORKSPACE_ID: &str = "workspace_id";
    pub const PROJECT_ID: &str = "project_id";
    pub const RUNTIME_LOCATION_ID: &str = "runtime_location_id";
    pub const TITLE: &str = "title";
    pub const STATUS: &str = "status";
    pub const ENTRY_SURFACE: &str = "entry_surface";
    pub const HOST_MODE: &str = "host_mode";
    pub const ENGINE_ID: &str = "engine_id";
    pub const MODEL_ID: &str = "model_id";
    pub const LAST_TURN_AT: &str = "last_turn_at";
    pub const NATIVE_SESSION_ID: &str = "native_session_id";
    pub const NATIVE_SESSION_TREE_ID: &str = "native_session_tree_id";
    pub const NATIVE_PARENT_SESSION_ID: &str = "native_parent_session_id";
    pub const NATIVE_FORKED_FROM_SESSION_ID: &str = "native_forked_from_session_id";
    pub const NATIVE_TITLE: &str = "native_title";
    pub const NATIVE_PREVIEW: &str = "native_preview";
    pub const NATIVE_SOURCE: &str = "native_source";
    pub const PROVIDER_VERSION: &str = "provider_version";
    pub const MODEL_PROVIDER: &str = "model_provider";
    pub const NATIVE_PROJECT_ID: &str = "native_project_id";
    pub const NATIVE_CWD: &str = "native_cwd";
    pub const NATIVE_GIT_BRANCH: &str = "native_git_branch";
    pub const NATIVE_GIT_COMMIT: &str = "native_git_commit";
    pub const NATIVE_GIT_REPOSITORY_URL: &str = "native_git_repository_url";
    pub const NATIVE_AGENT_NAME: &str = "native_agent_name";
    pub const NATIVE_AGENT_ROLE: &str = "native_agent_role";
    pub const NATIVE_IS_EPHEMERAL: &str = "native_is_ephemeral";
    pub const NATIVE_IS_SIDECHAIN: &str = "native_is_sidechain";
    pub const NATIVE_SCHEMA_VERSION: &str = "native_schema_version";
    pub const NATIVE_METADATA_JSON: &str = "native_metadata_json";
    pub const SORT_TIMESTAMP: &str = "sort_timestamp";
    pub const TRANSCRIPT_UPDATED_AT: &str = "transcript_updated_at";
    pub const PINNED: &str = "pinned";
    pub const ARCHIVED: &str = "archived";
    pub const UNREAD: &str = "unread";
}

pub mod message {
    pub const TABLE: &str = "ai_coding_session_message";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const TENANT_ID: &str = "tenant_id";
    pub const USER_ID: &str = "user_id";
    pub const CODING_SESSION_ID: &str = "coding_session_id";
    pub const TURN_ID: &str = "turn_id";
    pub const ROLE: &str = "role";
    pub const CONTENT: &str = "content";
    pub const METADATA_JSON: &str = "metadata_json";
    pub const TIMESTAMP_MS: &str = "timestamp_ms";
    pub const NAME: &str = "name";
    pub const TOOL_CALLS_JSON: &str = "tool_calls_json";
    pub const TOOL_CALL_ID: &str = "tool_call_id";
    pub const FILE_CHANGES_JSON: &str = "file_changes_json";
    pub const COMMANDS_JSON: &str = "commands_json";
    pub const TASK_PROGRESS_JSON: &str = "task_progress_json";
}

pub mod runtime {
    pub const TABLE: &str = "ai_coding_session_runtime";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const TENANT_ID: &str = "tenant_id";
    pub const USER_ID: &str = "user_id";
    pub const CODING_SESSION_ID: &str = "coding_session_id";
    pub const ENGINE_ID: &str = "engine_id";
    pub const MODEL_ID: &str = "model_id";
    pub const HOST_MODE: &str = "host_mode";
    pub const STATUS: &str = "status";
    pub const TRANSPORT_KIND: &str = "transport_kind";
    pub const NATIVE_SESSION_ID: &str = "native_session_id";
    pub const NATIVE_TURN_CONTAINER_ID: &str = "native_turn_container_id";
    pub const CAPABILITY_SNAPSHOT_JSON: &str = "capability_snapshot_json";
    pub const METADATA_JSON: &str = "metadata_json";
}

pub mod turn {
    pub const TABLE: &str = "ai_coding_session_turn";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const TENANT_ID: &str = "tenant_id";
    pub const USER_ID: &str = "user_id";
    pub const CODING_SESSION_ID: &str = "coding_session_id";
    pub const RUNTIME_ID: &str = "runtime_id";
    pub const REQUEST_KIND: &str = "request_kind";
    pub const STATUS: &str = "status";
    pub const INPUT_SUMMARY: &str = "input_summary";
    pub const STARTED_AT: &str = "started_at";
    pub const COMPLETED_AT: &str = "completed_at";
}

pub mod event {
    pub const TABLE: &str = "ai_coding_session_event";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const TENANT_ID: &str = "tenant_id";
    pub const USER_ID: &str = "user_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const CODING_SESSION_ID: &str = "coding_session_id";
    pub const TURN_ID: &str = "turn_id";
    pub const RUNTIME_ID: &str = "runtime_id";
    pub const EVENT_KIND: &str = "event_kind";
    pub const SEQUENCE_NO: &str = "sequence_no";
    pub const PAYLOAD_JSON: &str = "payload_json";
}

pub mod artifact {
    pub const TABLE: &str = "ai_coding_session_artifact";
    pub const ID: &str = "id";
    pub const UUID: &str = "uuid";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const TENANT_ID: &str = "tenant_id";
    pub const USER_ID: &str = "user_id";
    pub const CODING_SESSION_ID: &str = "coding_session_id";
    pub const TURN_ID: &str = "turn_id";
    pub const ARTIFACT_KIND: &str = "artifact_kind";
    pub const TITLE: &str = "title";
    pub const BLOB_REF: &str = "blob_ref";
    pub const METADATA_JSON: &str = "metadata_json";
}

pub mod checkpoint {
    pub const TABLE: &str = "ai_coding_session_checkpoint";
    pub const ID: &str = "id";
    pub const TENANT_ID: &str = "tenant_id";
    pub const USER_ID: &str = "user_id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const CODING_SESSION_ID: &str = "coding_session_id";
    pub const RUNTIME_ID: &str = "runtime_id";
    pub const CHECKPOINT_KIND: &str = "checkpoint_kind";
    pub const RESUMABLE: &str = "resumable";
    pub const STATE_JSON: &str = "state_json";
}

pub mod operation {
    pub const TABLE: &str = "ai_coding_session_operation";
    pub const ID: &str = "id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const TENANT_ID: &str = "tenant_id";
    pub const USER_ID: &str = "user_id";
    pub const CODING_SESSION_ID: &str = "coding_session_id";
    pub const TURN_ID: &str = "turn_id";
    pub const STATUS: &str = "status";
    pub const STREAM_URL: &str = "stream_url";
    pub const STREAM_KIND: &str = "stream_kind";
    pub const ARTIFACT_REFS_JSON: &str = "artifact_refs_json";
    pub const REQUEST_PAYLOAD_JSON: &str = "request_payload_json";
    pub const REQUEST_FINGERPRINT: &str = "request_fingerprint";
    pub const IDEMPOTENCY_KEY: &str = "idempotency_key";
    pub const AVAILABLE_AT: &str = "available_at";
    pub const ATTEMPT: &str = "attempt";
    pub const MAX_ATTEMPT: &str = "max_attempt";
    pub const LEASE_OWNER: &str = "lease_owner";
    pub const LEASE_EXPIRES_AT: &str = "lease_expires_at";
    pub const FENCING_TOKEN: &str = "fencing_token";
    pub const RUNNER_ID: &str = "runner_id";
    pub const STARTED_AT: &str = "started_at";
    pub const COMPLETED_AT: &str = "completed_at";
    pub const PROBLEM_JSON: &str = "problem_json";
}

pub mod prompt_entry {
    pub const TABLE: &str = "ai_coding_session_prompt_entry";
    pub const ID: &str = "id";
    pub const CREATED_AT: &str = "created_at";
    pub const UPDATED_AT: &str = "updated_at";
    pub const VERSION: &str = "version";
    pub const IS_DELETED: &str = "is_deleted";
    pub const CODING_SESSION_ID: &str = "coding_session_id";
    pub const PROMPT_TEXT: &str = "prompt_text";
    pub const NORMALIZED_PROMPT_TEXT: &str = "normalized_prompt_text";
    pub const LAST_USED_AT: &str = "last_used_at";
    pub const USE_COUNT: &str = "use_count";
}
