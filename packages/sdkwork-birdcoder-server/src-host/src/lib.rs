use std::{
    collections::BTreeMap,
    fs,
    io::Write,
    path::{Path as FsPath, PathBuf},
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, OnceLock, RwLock,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use axum::{
    extract::{Path as AxumPath, State},
    http::{header, HeaderValue, Method, StatusCode},
    routing::{get, post},
    Json, Router,
};
use rusqlite::{params, Connection};
use serde::{Deserialize, Deserializer, Serialize};
use tower_http::cors::{AllowOrigin, CorsLayer};

pub const BIRD_SERVER_DEFAULT_HOST: &str = "127.0.0.1";
pub const BIRD_SERVER_DEFAULT_PORT: u16 = 10240;
pub const BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME: &str = "bird-server.config.json";
pub const BIRD_SERVER_DEFAULT_BIND_ADDRESS: &str = "127.0.0.1:10240";
pub const CODING_SERVER_API_VERSION: &str = "v1";
pub const CODING_SERVER_OPENAPI_PATH: &str = "/openapi/coding-server-v1.json";
pub const BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV: &str = "BIRDCODER_CODING_SERVER_SQLITE_FILE";
pub const BIRDCODER_CODING_SERVER_SNAPSHOT_FILE_ENV: &str =
    "BIRDCODER_CODING_SERVER_SNAPSHOT_FILE";
pub const BIRDCODER_CODING_SERVER_ALLOWED_ORIGINS_ENV: &str =
    "BIRDCODER_CODING_SERVER_ALLOWED_ORIGINS";

const CODING_SESSION_PROJECTION_SCOPE: &str = "coding-session";
const SQLITE_PROJECTION_KEY_SUFFIX: &str = ".v1";
const SQLITE_SESSIONS_KEY: &str = "table.sqlite.coding-sessions.v1";
const SQLITE_EVENTS_KEY_PREFIX: &str = "table.sqlite.coding-session-events.";
const SQLITE_ARTIFACTS_KEY_PREFIX: &str = "table.sqlite.coding-session-artifacts.";
const SQLITE_CHECKPOINTS_KEY_PREFIX: &str = "table.sqlite.coding-session-checkpoints.";
const SQLITE_OPERATIONS_KEY_PREFIX: &str = "table.sqlite.coding-session-operations.";
const WORKSPACE_SCOPE: &str = "workspace";
const PROJECT_DOCUMENTS_SCOPE: &str = "project-documents";
const DEPLOYMENT_SCOPE: &str = "deployment";
const COLLABORATION_SCOPE: &str = "collaboration";
const GOVERNANCE_SCOPE: &str = "governance";
const SQLITE_WORKSPACES_KEY: &str = "table.sqlite.workspaces.v1";
const SQLITE_PROJECTS_KEY: &str = "table.sqlite.projects.v1";
const SQLITE_DOCUMENTS_KEY: &str = "table.sqlite.project-documents.v1";
const SQLITE_DEPLOYMENT_TARGETS_KEY: &str = "table.sqlite.deployment-targets.v1";
const SQLITE_DEPLOYMENTS_KEY: &str = "table.sqlite.deployment-records.v1";
const SQLITE_TEAMS_KEY: &str = "table.sqlite.teams.v1";
const SQLITE_TEAM_MEMBERS_KEY: &str = "table.sqlite.team-members.v1";
const SQLITE_RELEASES_KEY: &str = "table.sqlite.release-records.v1";
const SQLITE_AUDITS_KEY: &str = "table.sqlite.audit-events.v1";
const SQLITE_POLICIES_KEY: &str = "table.sqlite.governance-policies.v1";
const PROVIDER_CODING_SESSIONS_TABLE: &str = "coding_sessions";
const PROVIDER_CODING_SESSION_RUNTIMES_TABLE: &str = "coding_session_runtimes";
const PROVIDER_CODING_SESSION_TURNS_TABLE: &str = "coding_session_turns";
const PROVIDER_CODING_SESSION_EVENTS_TABLE: &str = "coding_session_events";
const PROVIDER_CODING_SESSION_ARTIFACTS_TABLE: &str = "coding_session_artifacts";
const PROVIDER_CODING_SESSION_CHECKPOINTS_TABLE: &str = "coding_session_checkpoints";
const PROVIDER_CODING_SESSION_OPERATIONS_TABLE: &str = "coding_session_operations";
const PROVIDER_WORKSPACES_TABLE: &str = "workspaces";
const PROVIDER_PROJECTS_TABLE: &str = "projects";
const PROVIDER_PROJECT_DOCUMENTS_TABLE: &str = "project_documents";
const PROVIDER_DEPLOYMENT_TARGETS_TABLE: &str = "deployment_targets";
const PROVIDER_DEPLOYMENT_RECORDS_TABLE: &str = "deployment_records";
const PROVIDER_TEAMS_TABLE: &str = "teams";
const PROVIDER_TEAM_MEMBERS_TABLE: &str = "team_members";
const PROVIDER_RELEASE_RECORDS_TABLE: &str = "release_records";
const PROVIDER_AUDIT_EVENTS_TABLE: &str = "audit_events";
const PROVIDER_GOVERNANCE_POLICIES_TABLE: &str = "governance_policies";
const BOOTSTRAP_WORKSPACE_ID: &str = "workspace-default";
const BOOTSTRAP_WORKSPACE_NAME: &str = "Default Workspace";
const BOOTSTRAP_WORKSPACE_DESCRIPTION: &str = "Primary local workspace for BirdCoder.";
const BOOTSTRAP_WORKSPACE_OWNER_IDENTITY_ID: &str = "identity-local-default";
const BOOTSTRAP_PROJECT_ID: &str = "project-default";
const BOOTSTRAP_PROJECT_NAME: &str = "Starter Project";
const BOOTSTRAP_PROJECT_DESCRIPTION: &str = "Starter project created for first-run BirdCoder.";
const TAURI_LOCALHOST_ORIGIN: &str = "tauri://localhost";
const TAURI_WEBVIEW_HTTP_ORIGIN: &str = "http://tauri.localhost";
const TAURI_WEBVIEW_HTTPS_ORIGIN: &str = "https://tauri.localhost";
const SQLITE_PROVIDER_AUTHORITY_SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS coding_sessions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    entry_surface TEXT NOT NULL,
    engine_id TEXT NOT NULL,
    model_id TEXT NULL,
    last_turn_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS coding_session_runtimes (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    engine_id TEXT NOT NULL,
    model_id TEXT NULL,
    host_mode TEXT NOT NULL,
    status TEXT NOT NULL,
    transport_kind TEXT NOT NULL,
    native_session_id TEXT NULL,
    native_turn_container_id TEXT NULL,
    capability_snapshot_json TEXT NOT NULL,
    metadata_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coding_session_turns (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    runtime_id TEXT NOT NULL,
    request_kind TEXT NOT NULL,
    status TEXT NOT NULL,
    input_summary TEXT NOT NULL,
    started_at TEXT NULL,
    completed_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS coding_session_events (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    turn_id TEXT NULL,
    runtime_id TEXT NULL,
    event_kind TEXT NOT NULL,
    sequence_no INTEGER NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coding_session_artifacts (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    turn_id TEXT NULL,
    artifact_kind TEXT NOT NULL,
    title TEXT NOT NULL,
    blob_ref TEXT NULL,
    metadata_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coding_session_checkpoints (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    runtime_id TEXT NULL,
    checkpoint_kind TEXT NOT NULL,
    resumable INTEGER NOT NULL,
    state_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS coding_session_operations (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    coding_session_id TEXT NOT NULL,
    turn_id TEXT NOT NULL,
    status TEXT NOT NULL,
    stream_url TEXT NOT NULL,
    stream_kind TEXT NOT NULL,
    artifact_refs_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    description TEXT NULL,
    owner_identity_id TEXT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    root_path TEXT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_documents (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    project_id TEXT NOT NULL,
    document_kind TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deployment_targets (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    environment_key TEXT NOT NULL,
    runtime TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deployment_records (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    project_id TEXT NOT NULL,
    target_id TEXT NOT NULL,
    release_record_id TEXT NULL,
    status TEXT NOT NULL,
    endpoint_url TEXT NULL,
    started_at TEXT NULL,
    completed_at TEXT NULL
);

CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    team_id TEXT NOT NULL,
    identity_id TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS release_records (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    release_version TEXT NOT NULL,
    release_kind TEXT NOT NULL,
    rollout_stage TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS governance_policies (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    policy_category TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    approval_policy TEXT NOT NULL,
    rationale TEXT NULL,
    status TEXT NOT NULL
);
"#;
const SQLITE_PROVIDER_AUTHORITY_CLEAR_SQL: &str = r#"
DELETE FROM coding_session_operations;
DELETE FROM coding_session_turns;
DELETE FROM coding_session_checkpoints;
DELETE FROM coding_session_artifacts;
DELETE FROM coding_session_events;
DELETE FROM coding_session_runtimes;
DELETE FROM coding_sessions;
DELETE FROM workspaces;
DELETE FROM release_records;
DELETE FROM team_members;
DELETE FROM teams;
DELETE FROM deployment_targets;
DELETE FROM deployment_records;
DELETE FROM project_documents;
DELETE FROM projects;
DELETE FROM audit_events;
DELETE FROM governance_policies;
"#;
const SQLITE_LEGACY_KV_STORE_TABLE: &str = "kv_store";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiMeta {
    version: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiEnvelope<T> {
    request_id: String,
    timestamp: String,
    data: T,
    meta: ApiMeta,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiListMeta {
    page: usize,
    page_size: usize,
    total: usize,
    version: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiListEnvelope<T> {
    request_id: String,
    timestamp: String,
    items: Vec<T>,
    meta: ApiListMeta,
}

#[derive(Serialize)]
struct HealthPayload {
    status: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DescriptorPayload {
    api_version: &'static str,
    host_mode: &'static str,
    module_id: &'static str,
    open_api_path: &'static str,
    surfaces: [&'static str; 3],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RuntimePayload {
    host: &'static str,
    port: u16,
    config_file_name: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProblemDetailsPayload {
    code: &'static str,
    message: String,
    retryable: bool,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspacePayload {
    id: String,
    name: String,
    description: Option<String>,
    owner_identity_id: Option<String>,
    status: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectPayload {
    id: String,
    workspace_id: String,
    name: String,
    description: Option<String>,
    root_path: Option<String>,
    status: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DocumentPayload {
    id: String,
    project_id: String,
    document_kind: String,
    title: String,
    slug: String,
    status: String,
    updated_at: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeploymentPayload {
    id: String,
    project_id: String,
    target_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    release_record_id: Option<String>,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    endpoint_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    started_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    completed_at: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TeamPayload {
    id: String,
    workspace_id: String,
    name: String,
    description: Option<String>,
    status: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TeamMemberPayload {
    id: String,
    team_id: String,
    identity_id: String,
    role: String,
    status: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct DeploymentTargetPayload {
    id: String,
    project_id: String,
    name: String,
    environment_key: String,
    runtime: String,
    status: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReleasePayload {
    id: String,
    release_version: String,
    release_kind: String,
    rollout_stage: String,
    status: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AuditPayload {
    id: String,
    scope_type: String,
    scope_id: String,
    event_type: String,
    payload: serde_json::Value,
    created_at: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PolicyPayload {
    id: String,
    scope_type: String,
    scope_id: String,
    policy_category: String,
    target_type: String,
    target_id: String,
    approval_policy: String,
    rationale: Option<String>,
    status: String,
    updated_at: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct EngineCapabilityMatrixPayload {
    chat: bool,
    streaming: bool,
    structured_output: bool,
    tool_calls: bool,
    planning: bool,
    patch_artifacts: bool,
    command_artifacts: bool,
    todo_artifacts: bool,
    pty_artifacts: bool,
    preview_artifacts: bool,
    test_artifacts: bool,
    approval_checkpoints: bool,
    session_resume: bool,
    remote_bridge: bool,
    mcp: bool,
}

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PartialEngineCapabilityMatrixPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    chat: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    streaming: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    structured_output: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_calls: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    planning: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    patch_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    command_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    todo_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pty_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    preview_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    test_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    approval_checkpoints: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    session_resume: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    remote_bridge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    mcp: Option<bool>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct EngineDescriptorPayload {
    engine_key: String,
    display_name: String,
    vendor: String,
    installation_kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    default_model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    homepage: Option<String>,
    supported_host_modes: Vec<String>,
    transport_kinds: Vec<String>,
    capability_matrix: EngineCapabilityMatrixPayload,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelCatalogEntryPayload {
    engine_key: String,
    model_id: String,
    display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    provider_id: Option<String>,
    status: String,
    default_for_engine: bool,
    transport_kinds: Vec<String>,
    capability_matrix: PartialEngineCapabilityMatrixPayload,
}

#[derive(Clone, Deserialize)]
struct SharedEngineCatalogPayload {
    engines: Vec<EngineDescriptorPayload>,
    models: Vec<ModelCatalogEntryPayload>,
}

#[derive(Default)]
struct AuthorityBootstrapConfig {
    sqlite_file: Option<PathBuf>,
    snapshot_file: Option<PathBuf>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BirdServerRuntimeConfigFile {
    authority: Option<BirdServerAuthorityConfigFile>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BirdServerAuthorityConfigFile {
    sqlite_file: Option<PathBuf>,
    snapshot_file: Option<PathBuf>,
}

#[derive(Clone)]
struct CodingSessionRow {
    id: String,
    workspace_id: String,
    project_id: String,
    title: String,
    status: String,
    engine_id: String,
    model_id: Option<String>,
    created_at: String,
    updated_at: String,
    last_turn_at: Option<String>,
}

#[derive(Clone)]
struct CodingSessionRuntimeRow {
    id: String,
    coding_session_id: String,
    host_mode: String,
    engine_id: String,
    model_id: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Clone)]
struct CodingSessionTurnRow {
    id: String,
    coding_session_id: String,
    runtime_id: String,
    request_kind: String,
    status: String,
    input_summary: String,
    started_at: Option<String>,
    completed_at: Option<String>,
}

#[derive(Clone)]
struct CodingSessionEventRow {
    id: String,
    coding_session_id: String,
    turn_id: Option<String>,
    runtime_id: Option<String>,
    event_kind: String,
    sequence_no: usize,
    payload_json: String,
    created_at: String,
}

#[derive(Clone)]
struct CodingSessionArtifactRow {
    id: String,
    coding_session_id: String,
    turn_id: Option<String>,
    artifact_kind: String,
    title: String,
    blob_ref: Option<String>,
    metadata_json: String,
    created_at: String,
}

#[derive(Clone)]
struct CodingSessionCheckpointRow {
    id: String,
    coding_session_id: String,
    runtime_id: Option<String>,
    checkpoint_kind: String,
    resumable: bool,
    state_json: String,
    created_at: String,
}

#[derive(Clone)]
struct CodingSessionOperationRow {
    id: String,
    coding_session_id: String,
    status: String,
    stream_url: String,
    stream_kind: String,
    artifact_refs_json: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct OperationPayload {
    operation_id: String,
    status: String,
    artifact_refs: Vec<String>,
    stream_url: String,
    stream_kind: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodingSessionPayload {
    id: String,
    workspace_id: String,
    project_id: String,
    title: String,
    status: String,
    host_mode: String,
    engine_id: String,
    model_id: Option<String>,
    created_at: String,
    updated_at: String,
    last_turn_at: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCodingSessionRequest {
    workspace_id: String,
    project_id: String,
    title: Option<String>,
    host_mode: Option<String>,
    engine_id: Option<String>,
    model_id: Option<String>,
}

struct CreateCodingSessionInput {
    workspace_id: String,
    project_id: String,
    title: String,
    host_mode: String,
    engine_id: String,
    model_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCodingSessionTurnRequest {
    runtime_id: Option<String>,
    request_kind: String,
    input_summary: String,
}

struct CreateCodingSessionTurnInput {
    runtime_id: Option<String>,
    request_kind: String,
    input_summary: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SubmitApprovalDecisionRequest {
    decision: String,
    reason: Option<String>,
}

struct SubmitApprovalDecisionInput {
    decision: String,
    reason: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodingSessionTurnPayload {
    id: String,
    coding_session_id: String,
    runtime_id: Option<String>,
    request_kind: String,
    status: String,
    input_summary: String,
    started_at: Option<String>,
    completed_at: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodingSessionEventPayload {
    id: String,
    coding_session_id: String,
    turn_id: Option<String>,
    runtime_id: Option<String>,
    kind: String,
    sequence: usize,
    payload: BTreeMap<String, String>,
    created_at: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodingSessionCheckpointPayload {
    id: String,
    coding_session_id: String,
    runtime_id: Option<String>,
    checkpoint_kind: String,
    resumable: bool,
    state: BTreeMap<String, String>,
    created_at: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct CodingSessionArtifactPayload {
    id: String,
    coding_session_id: String,
    turn_id: Option<String>,
    kind: String,
    status: String,
    title: String,
    metadata: BTreeMap<String, String>,
    created_at: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApprovalDecisionPayload {
    approval_id: String,
    checkpoint_id: String,
    coding_session_id: String,
    runtime_id: Option<String>,
    turn_id: Option<String>,
    operation_id: Option<String>,
    decision: String,
    reason: Option<String>,
    decided_at: String,
    runtime_status: String,
    operation_status: String,
}

#[derive(Clone, Deserialize)]
struct ProjectionSnapshot {
    #[serde(default)]
    session: Option<CodingSessionPayload>,
    #[serde(default)]
    turns: Vec<CodingSessionTurnPayload>,
    #[serde(
        default,
        alias = "operation",
        deserialize_with = "deserialize_projection_operations"
    )]
    operations: Vec<OperationPayload>,
    #[serde(default)]
    events: Vec<CodingSessionEventPayload>,
    #[serde(default)]
    artifacts: Vec<CodingSessionArtifactPayload>,
    #[serde(default)]
    checkpoints: Vec<CodingSessionCheckpointPayload>,
}

#[derive(Clone, Deserialize)]
struct ProjectionReadState {
    sessions: BTreeMap<String, ProjectionSnapshot>,
}

#[derive(Clone)]
struct ProjectionAuthorityState {
    sqlite_file: Option<PathBuf>,
    state: Arc<RwLock<ProjectionReadState>>,
}

#[derive(Clone)]
struct AppState {
    projections: ProjectionAuthorityState,
    audits: Vec<AuditPayload>,
    deployments: Vec<DeploymentPayload>,
    targets: Vec<DeploymentTargetPayload>,
    documents: Vec<DocumentPayload>,
    members: Vec<TeamMemberPayload>,
    policies: Vec<PolicyPayload>,
    workspaces: Vec<WorkspacePayload>,
    projects: Vec<ProjectPayload>,
    teams: Vec<TeamPayload>,
    releases: Vec<ReleasePayload>,
}

#[derive(Clone)]
struct AppAdminReadState {
    audits: Vec<AuditPayload>,
    deployments: Vec<DeploymentPayload>,
    targets: Vec<DeploymentTargetPayload>,
    documents: Vec<DocumentPayload>,
    members: Vec<TeamMemberPayload>,
    policies: Vec<PolicyPayload>,
    workspaces: Vec<WorkspacePayload>,
    projects: Vec<ProjectPayload>,
    teams: Vec<TeamPayload>,
    releases: Vec<ReleasePayload>,
}

#[derive(Serialize)]
struct OpenApiInfo {
    title: &'static str,
    version: &'static str,
}

#[derive(Serialize)]
struct OpenApiServer {
    url: String,
}

#[derive(Serialize)]
struct OpenApiTag {
    name: &'static str,
}

#[derive(Serialize)]
struct OpenApiOperation {
    #[serde(rename = "operationId")]
    operation_id: &'static str,
    summary: &'static str,
    tags: [&'static str; 1],
}

#[derive(Serialize)]
struct OpenApiDocument {
    openapi: &'static str,
    info: OpenApiInfo,
    servers: Vec<OpenApiServer>,
    tags: Vec<OpenApiTag>,
    paths: BTreeMap<&'static str, BTreeMap<&'static str, OpenApiOperation>>,
}

struct RouteSpec {
    method: &'static str,
    operation_id: &'static str,
    path: &'static str,
    summary: &'static str,
    tag: &'static str,
}

static ID_COUNTER: AtomicU64 = AtomicU64::new(1);
static SHARED_ENGINE_CATALOG: OnceLock<SharedEngineCatalogPayload> = OnceLock::new();

fn build_demo_metadata(entries: &[(&str, &str)]) -> BTreeMap<String, String> {
    entries
        .iter()
        .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
        .collect()
}

fn current_unix_millis_string() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_millis()
        .to_string()
}

fn create_identifier(prefix: &str) -> String {
    let sequence = ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("{prefix}-{sequence}")
}

fn shared_engine_catalog() -> &'static SharedEngineCatalogPayload {
    SHARED_ENGINE_CATALOG.get_or_init(|| {
        serde_json::from_str(include_str!("../generated/engine-catalog.json"))
            .expect("parse generated shared engine catalog")
    })
}

fn build_engine_catalog() -> Vec<EngineDescriptorPayload> {
    shared_engine_catalog().engines.clone()
}

fn build_model_catalog() -> Vec<ModelCatalogEntryPayload> {
    shared_engine_catalog().models.clone()
}

fn find_engine_descriptor(engine_key: &str) -> Option<EngineDescriptorPayload> {
    let normalized_engine_key = engine_key.trim().to_ascii_lowercase();

    build_engine_catalog().into_iter().find(|engine| {
        engine
            .engine_key
            .eq_ignore_ascii_case(normalized_engine_key.as_str())
    })
}

fn normalize_required_string(value: String) -> Option<String> {
    let normalized = value.trim().to_owned();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(normalize_required_string)
}

fn resolve_authority_path(base_dir: &FsPath, path: PathBuf) -> PathBuf {
    if path.is_absolute() {
        path
    } else {
        base_dir.join(path)
    }
}

fn load_authority_bootstrap_from_env() -> AuthorityBootstrapConfig {
    AuthorityBootstrapConfig {
        sqlite_file: std::env::var_os(BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV).map(PathBuf::from),
        snapshot_file: std::env::var_os(BIRDCODER_CODING_SERVER_SNAPSHOT_FILE_ENV)
            .map(PathBuf::from),
    }
}

fn load_authority_bootstrap_from_config_file(
    path: &FsPath,
) -> Result<AuthorityBootstrapConfig, String> {
    let raw = fs::read_to_string(path)
        .map_err(|error| format!("read runtime config file {} failed: {error}", path.display()))?;
    let parsed: BirdServerRuntimeConfigFile = serde_json::from_str(&raw)
        .map_err(|error| format!("parse runtime config file {} failed: {error}", path.display()))?;
    let base_dir = path.parent().unwrap_or_else(|| FsPath::new("."));
    let authority = parsed.authority.unwrap_or(BirdServerAuthorityConfigFile {
        sqlite_file: None,
        snapshot_file: None,
    });

    Ok(AuthorityBootstrapConfig {
        sqlite_file: authority
            .sqlite_file
            .map(|sqlite_file| resolve_authority_path(base_dir, sqlite_file)),
        snapshot_file: authority
            .snapshot_file
            .map(|snapshot_file| resolve_authority_path(base_dir, snapshot_file)),
    })
}

fn resolve_authority_bootstrap() -> Result<AuthorityBootstrapConfig, String> {
    let runtime_config_path = std::env::current_dir()
        .map_err(|error| format!("resolve current working directory failed: {error}"))?
        .join(BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME);

    if runtime_config_path.exists() {
        return load_authority_bootstrap_from_config_file(&runtime_config_path);
    }

    Ok(load_authority_bootstrap_from_env())
}

#[derive(Deserialize)]
#[serde(untagged)]
enum ProjectionOperationsField {
    Single(OperationPayload),
    Many(Vec<OperationPayload>),
}

impl TryFrom<CreateCodingSessionRequest> for CreateCodingSessionInput {
    type Error = &'static str;

    fn try_from(value: CreateCodingSessionRequest) -> Result<Self, Self::Error> {
        let workspace_id = normalize_required_string(value.workspace_id)
            .ok_or("workspaceId is required.")?;
        let project_id = normalize_required_string(value.project_id)
            .ok_or("projectId is required.")?;
        let title = normalize_optional_string(value.title).unwrap_or_else(|| "New Thread".to_owned());
        let host_mode =
            normalize_optional_string(value.host_mode).unwrap_or_else(|| "server".to_owned());
        let engine_id =
            normalize_optional_string(value.engine_id).unwrap_or_else(|| "codex".to_owned());
        let model_id = normalize_optional_string(value.model_id).or_else(|| Some(engine_id.clone()));

        Ok(Self {
            workspace_id,
            project_id,
            title,
            host_mode,
            engine_id,
            model_id,
        })
    }
}

impl TryFrom<CreateCodingSessionTurnRequest> for CreateCodingSessionTurnInput {
    type Error = &'static str;

    fn try_from(value: CreateCodingSessionTurnRequest) -> Result<Self, Self::Error> {
        let request_kind =
            normalize_required_string(value.request_kind).ok_or("requestKind is required.")?;
        let input_summary =
            normalize_required_string(value.input_summary).ok_or("inputSummary is required.")?;

        if !matches!(
            request_kind.as_str(),
            "chat" | "plan" | "tool" | "review" | "apply"
        ) {
            return Err("requestKind must be one of chat/plan/tool/review/apply.");
        }

        Ok(Self {
            runtime_id: normalize_optional_string(value.runtime_id),
            request_kind,
            input_summary,
        })
    }
}

impl TryFrom<SubmitApprovalDecisionRequest> for SubmitApprovalDecisionInput {
    type Error = &'static str;

    fn try_from(value: SubmitApprovalDecisionRequest) -> Result<Self, Self::Error> {
        let decision = normalize_required_string(value.decision).ok_or("decision is required.")?;

        if !matches!(decision.as_str(), "approved" | "denied" | "blocked") {
            return Err("decision must be one of approved/denied/blocked.");
        }

        Ok(Self {
            decision,
            reason: normalize_optional_string(value.reason),
        })
    }
}

fn deserialize_projection_operations<'de, D>(
    deserializer: D,
) -> Result<Vec<OperationPayload>, D::Error>
where
    D: Deserializer<'de>,
{
    let field = Option::<ProjectionOperationsField>::deserialize(deserializer)?;
    Ok(match field {
        Some(ProjectionOperationsField::Single(operation)) => vec![operation],
        Some(ProjectionOperationsField::Many(operations)) => operations,
        None => Vec::new(),
    })
}

fn parse_session_id_from_projection_key(key: &str, prefix: &str) -> Option<String> {
    key.strip_prefix(prefix)?
        .strip_suffix(SQLITE_PROJECTION_KEY_SUFFIX)
        .map(|session_id| session_id.to_owned())
}

fn sqlite_table_exists(connection: &Connection, table_name: &str) -> Result<bool, String> {
    let mut statement = connection
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?1")
        .map_err(|error| format!("prepare sqlite table probe for {table_name} failed: {error}"))?;
    let mut rows = statement
        .query([table_name])
        .map_err(|error| format!("query sqlite table probe for {table_name} failed: {error}"))?;

    rows.next()
        .map(|row| row.is_some())
        .map_err(|error| format!("read sqlite table probe for {table_name} failed: {error}"))
}

fn sqlite_has_direct_projection_provider_tables(connection: &Connection) -> Result<bool, String> {
    for table_name in [
        PROVIDER_CODING_SESSIONS_TABLE,
        PROVIDER_CODING_SESSION_RUNTIMES_TABLE,
        PROVIDER_CODING_SESSION_TURNS_TABLE,
        PROVIDER_CODING_SESSION_EVENTS_TABLE,
        PROVIDER_CODING_SESSION_ARTIFACTS_TABLE,
        PROVIDER_CODING_SESSION_CHECKPOINTS_TABLE,
        PROVIDER_CODING_SESSION_OPERATIONS_TABLE,
    ] {
        if !sqlite_table_exists(connection, table_name)? {
            return Ok(false);
        }
    }

    Ok(true)
}

fn sqlite_has_direct_app_admin_provider_tables(connection: &Connection) -> Result<bool, String> {
    for table_name in [
        PROVIDER_WORKSPACES_TABLE,
        PROVIDER_PROJECTS_TABLE,
        PROVIDER_PROJECT_DOCUMENTS_TABLE,
        PROVIDER_DEPLOYMENT_TARGETS_TABLE,
        PROVIDER_DEPLOYMENT_RECORDS_TABLE,
        PROVIDER_TEAMS_TABLE,
        PROVIDER_TEAM_MEMBERS_TABLE,
        PROVIDER_RELEASE_RECORDS_TABLE,
        PROVIDER_AUDIT_EVENTS_TABLE,
    ] {
        if !sqlite_table_exists(connection, table_name)? {
            return Ok(false);
        }
    }

    Ok(true)
}

fn parse_json_object_string_map(
    raw: &str,
    context: &str,
) -> Result<BTreeMap<String, String>, String> {
    let parsed: serde_json::Value = serde_json::from_str(raw)
        .map_err(|error| format!("parse {context} json failed: {error}"))?;
    let object = parsed
        .as_object()
        .ok_or_else(|| format!("{context} json must be an object"))?;

    Ok(object
        .iter()
        .map(|(key, value)| {
            let normalized = match value {
                serde_json::Value::Null => String::new(),
                serde_json::Value::String(string) => string.clone(),
                _ => value.to_string(),
            };
            (key.clone(), normalized)
        })
        .collect())
}

fn parse_json_string_array(raw: &str, context: &str) -> Result<Vec<String>, String> {
    let parsed: serde_json::Value = serde_json::from_str(raw)
        .map_err(|error| format!("parse {context} json failed: {error}"))?;
    let values = parsed
        .as_array()
        .ok_or_else(|| format!("{context} json must be an array"))?;

    Ok(values
        .iter()
        .map(|value| match value {
            serde_json::Value::String(string) => string.clone(),
            _ => value.to_string(),
        })
        .collect())
}

fn select_latest_runtime_row<'a>(
    runtimes: &'a [CodingSessionRuntimeRow],
) -> Option<&'a CodingSessionRuntimeRow> {
    runtimes.iter().max_by(|left, right| {
        left.updated_at
            .cmp(&right.updated_at)
            .then_with(|| left.created_at.cmp(&right.created_at))
            .then_with(|| left.id.cmp(&right.id))
    })
}

fn load_provider_coding_session_rows(connection: &Connection) -> Result<Vec<CodingSessionRow>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, workspace_id, project_id, title, status, engine_id, model_id, created_at, updated_at, last_turn_at
            FROM coding_sessions
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare coding_sessions query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(CodingSessionRow {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                project_id: row.get(2)?,
                title: row.get(3)?,
                status: row.get(4)?,
                engine_id: row.get(5)?,
                model_id: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
                last_turn_at: row.get(9)?,
            })
        })
        .map_err(|error| format!("query coding_sessions failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read coding_sessions row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_runtime_rows(connection: &Connection) -> Result<Vec<CodingSessionRuntimeRow>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, coding_session_id, host_mode, engine_id, model_id, created_at, updated_at
            FROM coding_session_runtimes
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare coding_session_runtimes query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(CodingSessionRuntimeRow {
                id: row.get(0)?,
                coding_session_id: row.get(1)?,
                host_mode: row.get(2)?,
                engine_id: row.get(3)?,
                model_id: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|error| format!("query coding_session_runtimes failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(
            row.map_err(|error| format!("read coding_session_runtimes row failed: {error}"))?,
        );
    }
    Ok(records)
}

fn load_provider_turn_rows(connection: &Connection) -> Result<Vec<CodingSessionTurnRow>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, coding_session_id, runtime_id, request_kind, status, input_summary, started_at, completed_at
            FROM coding_session_turns
            WHERE is_deleted = 0
            ORDER BY coding_session_id ASC, created_at ASC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare coding_session_turns query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(CodingSessionTurnRow {
                id: row.get(0)?,
                coding_session_id: row.get(1)?,
                runtime_id: row.get(2)?,
                request_kind: row.get(3)?,
                status: row.get(4)?,
                input_summary: row.get(5)?,
                started_at: row.get(6)?,
                completed_at: row.get(7)?,
            })
        })
        .map_err(|error| format!("query coding_session_turns failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read coding_session_turns row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_event_rows(connection: &Connection) -> Result<Vec<CodingSessionEventRow>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, coding_session_id, turn_id, runtime_id, event_kind, sequence_no, payload_json, created_at
            FROM coding_session_events
            WHERE is_deleted = 0
            ORDER BY coding_session_id ASC, sequence_no ASC, created_at ASC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare coding_session_events query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(CodingSessionEventRow {
                id: row.get(0)?,
                coding_session_id: row.get(1)?,
                turn_id: row.get(2)?,
                runtime_id: row.get(3)?,
                event_kind: row.get(4)?,
                sequence_no: row.get::<_, i64>(5)? as usize,
                payload_json: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|error| format!("query coding_session_events failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read coding_session_events row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_artifact_rows(
    connection: &Connection,
) -> Result<Vec<CodingSessionArtifactRow>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, coding_session_id, turn_id, artifact_kind, title, blob_ref, metadata_json, created_at
            FROM coding_session_artifacts
            WHERE is_deleted = 0
            ORDER BY coding_session_id ASC, created_at ASC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare coding_session_artifacts query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(CodingSessionArtifactRow {
                id: row.get(0)?,
                coding_session_id: row.get(1)?,
                turn_id: row.get(2)?,
                artifact_kind: row.get(3)?,
                title: row.get(4)?,
                blob_ref: row.get(5)?,
                metadata_json: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|error| format!("query coding_session_artifacts failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(
            row.map_err(|error| format!("read coding_session_artifacts row failed: {error}"))?,
        );
    }
    Ok(records)
}

fn load_provider_checkpoint_rows(
    connection: &Connection,
) -> Result<Vec<CodingSessionCheckpointRow>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, coding_session_id, runtime_id, checkpoint_kind, resumable, state_json, created_at
            FROM coding_session_checkpoints
            WHERE is_deleted = 0
            ORDER BY coding_session_id ASC, created_at ASC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare coding_session_checkpoints query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(CodingSessionCheckpointRow {
                id: row.get(0)?,
                coding_session_id: row.get(1)?,
                runtime_id: row.get(2)?,
                checkpoint_kind: row.get(3)?,
                resumable: row.get::<_, i64>(4)? != 0,
                state_json: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|error| format!("query coding_session_checkpoints failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(
            row.map_err(|error| format!("read coding_session_checkpoints row failed: {error}"))?,
        );
    }
    Ok(records)
}

fn load_provider_operation_rows(
    connection: &Connection,
) -> Result<Vec<CodingSessionOperationRow>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, coding_session_id, status, stream_url, stream_kind, artifact_refs_json
            FROM coding_session_operations
            WHERE is_deleted = 0
            ORDER BY coding_session_id ASC, created_at ASC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare coding_session_operations query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(CodingSessionOperationRow {
                id: row.get(0)?,
                coding_session_id: row.get(1)?,
                status: row.get(2)?,
                stream_url: row.get(3)?,
                stream_kind: row.get(4)?,
                artifact_refs_json: row.get(5)?,
            })
        })
        .map_err(|error| format!("query coding_session_operations failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(
            row.map_err(|error| format!("read coding_session_operations row failed: {error}"))?,
        );
    }
    Ok(records)
}

fn load_provider_workspace_payloads(
    connection: &Connection,
) -> Result<Vec<WorkspacePayload>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, name, description, owner_identity_id, status
            FROM workspaces
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare workspaces query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(WorkspacePayload {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                owner_identity_id: row.get(3)?,
                status: row.get(4)?,
            })
        })
        .map_err(|error| format!("query workspaces failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read workspaces row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_project_payloads(connection: &Connection) -> Result<Vec<ProjectPayload>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, workspace_id, name, description, root_path, status
            FROM projects
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare projects query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(ProjectPayload {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                root_path: row.get(4)?,
                status: row.get(5)?,
            })
        })
        .map_err(|error| format!("query projects failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read projects row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_document_payloads(connection: &Connection) -> Result<Vec<DocumentPayload>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, project_id, document_kind, title, slug, status, updated_at
            FROM project_documents
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare project_documents query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(DocumentPayload {
                id: row.get(0)?,
                project_id: row.get(1)?,
                document_kind: row.get(2)?,
                title: row.get(3)?,
                slug: row.get(4)?,
                status: row.get(5)?,
                updated_at: row.get(6)?,
            })
        })
        .map_err(|error| format!("query project_documents failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(
            row.map_err(|error| format!("read project_documents row failed: {error}"))?,
        );
    }
    Ok(records)
}

fn load_provider_deployment_payloads(
    connection: &Connection,
) -> Result<Vec<DeploymentPayload>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, project_id, target_id, release_record_id, status, endpoint_url, started_at, completed_at
            FROM deployment_records
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare deployment_records query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(DeploymentPayload {
                id: row.get(0)?,
                project_id: row.get(1)?,
                target_id: row.get(2)?,
                release_record_id: row.get(3)?,
                status: row.get(4)?,
                endpoint_url: row.get(5)?,
                started_at: row.get(6)?,
                completed_at: row.get(7)?,
            })
        })
        .map_err(|error| format!("query deployment_records failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(
            row.map_err(|error| format!("read deployment_records row failed: {error}"))?,
        );
    }
    Ok(records)
}

fn load_provider_deployment_target_payloads(
    connection: &Connection,
) -> Result<Vec<DeploymentTargetPayload>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, project_id, name, environment_key, runtime, status
            FROM deployment_targets
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare deployment_targets query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(DeploymentTargetPayload {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                environment_key: row.get(3)?,
                runtime: row.get(4)?,
                status: row.get(5)?,
            })
        })
        .map_err(|error| format!("query deployment_targets failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(
            row.map_err(|error| format!("read deployment_targets row failed: {error}"))?,
        );
    }
    Ok(records)
}

fn load_provider_team_payloads(connection: &Connection) -> Result<Vec<TeamPayload>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, workspace_id, name, description, status
            FROM teams
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare teams query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(TeamPayload {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                name: row.get(2)?,
                description: row.get(3)?,
                status: row.get(4)?,
            })
        })
        .map_err(|error| format!("query teams failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read teams row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_team_member_payloads(
    connection: &Connection,
) -> Result<Vec<TeamMemberPayload>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, team_id, identity_id, role, status
            FROM team_members
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare team_members query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(TeamMemberPayload {
                id: row.get(0)?,
                team_id: row.get(1)?,
                identity_id: row.get(2)?,
                role: row.get(3)?,
                status: row.get(4)?,
            })
        })
        .map_err(|error| format!("query team_members failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read team_members row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_release_payloads(connection: &Connection) -> Result<Vec<ReleasePayload>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, release_version, release_kind, rollout_stage, status
            FROM release_records
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare release_records query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(ReleasePayload {
                id: row.get(0)?,
                release_version: row.get(1)?,
                release_kind: row.get(2)?,
                rollout_stage: row.get(3)?,
                status: row.get(4)?,
            })
        })
        .map_err(|error| format!("query release_records failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(
            row.map_err(|error| format!("read release_records row failed: {error}"))?,
        );
    }
    Ok(records)
}

fn load_provider_audit_payloads(connection: &Connection) -> Result<Vec<AuditPayload>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, scope_type, scope_id, event_type, payload_json, created_at
            FROM audit_events
            WHERE is_deleted = 0
            ORDER BY created_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare audit_events query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            let payload_json: String = row.get(4)?;
            let payload = serde_json::from_str::<serde_json::Value>(&payload_json).map_err(
                |error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        payload_json.len(),
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                },
            )?;
            Ok(AuditPayload {
                id: row.get(0)?,
                scope_type: row.get(1)?,
                scope_id: row.get(2)?,
                event_type: row.get(3)?,
                payload,
                created_at: row.get(5)?,
            })
        })
        .map_err(|error| format!("query audit_events failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read audit_events row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_policy_payloads(connection: &Connection) -> Result<Vec<PolicyPayload>, String> {
    let query = format!(
        r#"
            SELECT id, scope_type, scope_id, policy_category, target_type, target_id, approval_policy, rationale, status, updated_at
            FROM {PROVIDER_GOVERNANCE_POLICIES_TABLE}
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#
    );
    let mut statement = connection
        .prepare(&query)
        .map_err(|error| format!("prepare governance_policies query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(PolicyPayload {
                id: row.get(0)?,
                scope_type: row.get(1)?,
                scope_id: row.get(2)?,
                policy_category: row.get(3)?,
                target_type: row.get(4)?,
                target_id: row.get(5)?,
                approval_policy: row.get(6)?,
                rationale: row.get(7)?,
                status: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|error| format!("query governance_policies failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(
            row.map_err(|error| format!("read governance_policies row failed: {error}"))?,
        );
    }
    Ok(records)
}

fn current_storage_timestamp() -> String {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_secs()
        .to_string()
}

fn sqlite_has_legacy_kv_store_table(connection: &Connection) -> Result<bool, String> {
    sqlite_table_exists(connection, SQLITE_LEGACY_KV_STORE_TABLE)
}

fn derive_runtime_id(snapshot: &ProjectionSnapshot, session_id: &str) -> String {
    snapshot
        .turns
        .iter()
        .rev()
        .find_map(|turn| turn.runtime_id.clone())
        .or_else(|| {
            snapshot
                .events
                .iter()
                .find_map(|event| event.runtime_id.clone())
        })
        .or_else(|| {
            snapshot
                .checkpoints
                .iter()
                .find_map(|checkpoint| checkpoint.runtime_id.clone())
        })
        .unwrap_or_else(|| format!("{session_id}:runtime"))
}

fn load_provider_runtime_row_for_session(
    connection: &Connection,
    coding_session_id: &str,
    requested_runtime_id: Option<&str>,
) -> Result<Option<CodingSessionRuntimeRow>, String> {
    let runtime_rows = load_provider_runtime_rows(connection)?
        .into_iter()
        .filter(|runtime| runtime.coding_session_id == coding_session_id)
        .collect::<Vec<_>>();

    if let Some(runtime_id) = requested_runtime_id {
        return Ok(runtime_rows.into_iter().find(|runtime| runtime.id == runtime_id));
    }

    Ok(select_latest_runtime_row(&runtime_rows).cloned())
}

fn next_event_sequence(snapshot: &ProjectionSnapshot) -> usize {
    snapshot
        .events
        .iter()
        .map(|event| event.sequence)
        .max()
        .map(|sequence| sequence + 1)
        .unwrap_or(0)
}

fn build_codex_cli_prompt(request_kind: &str, input_summary: &str) -> String {
    if request_kind == "chat" {
        input_summary.to_owned()
    } else {
        format!("Request kind: {request_kind}\n\n{input_summary}")
    }
}

fn create_codex_cli_command() -> Command {
    if cfg!(windows) {
        let mut command = Command::new("cmd");
        command.arg("/C").arg("codex.cmd");
        command
    } else {
        Command::new("codex")
    }
}

fn execute_codex_cli_turn(
    model_id: Option<&str>,
    working_directory: Option<&FsPath>,
    request_kind: &str,
    input_summary: &str,
) -> Result<String, String> {
    let mut command = create_codex_cli_command();
    command
        .arg("exec")
        .arg("--json")
        .arg("--full-auto")
        .arg("--skip-git-repo-check")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(model_id) = model_id.filter(|model_id| !model_id.trim().is_empty()) {
        command.arg("--model").arg(model_id);
    }

    if let Some(directory) = working_directory.filter(|directory| directory.exists()) {
        command.arg("--cd").arg(directory);
        command.current_dir(directory);
    }

    let mut child = command
        .spawn()
        .map_err(|error| format!("spawn codex cli failed: {error}"))?;

    let prompt = build_codex_cli_prompt(request_kind, input_summary);
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|error| format!("write codex cli prompt failed: {error}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("wait for codex cli failed: {error}"))?;
    let stdout = String::from_utf8(output.stdout)
        .map_err(|error| format!("decode codex cli stdout failed: {error}"))?;
    let stderr = String::from_utf8(output.stderr)
        .map_err(|error| format!("decode codex cli stderr failed: {error}"))?;

    let mut assistant_content: Option<String> = None;
    let mut turn_error: Option<String> = None;

    for line in stdout.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let parsed: serde_json::Value = serde_json::from_str(line)
            .map_err(|error| format!("parse codex cli jsonl event failed: {error}; line: {line}"))?;
        match parsed.get("type").and_then(serde_json::Value::as_str) {
            Some("item.updated") | Some("item.completed") => {
                let item = parsed.get("item").and_then(serde_json::Value::as_object);
                if item
                    .and_then(|item| item.get("type"))
                    .and_then(serde_json::Value::as_str)
                    == Some("agent_message")
                {
                    if let Some(text) = item
                        .and_then(|item| item.get("text"))
                        .and_then(serde_json::Value::as_str)
                    {
                        assistant_content = Some(text.to_owned());
                    }
                }
            }
            Some("turn.failed") => {
                update_codex_cli_turn_error(
                    &mut turn_error,
                    parsed
                        .get("error")
                        .and_then(|error| error.get("message"))
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or("Codex CLI turn failed."),
                );
            }
            Some("error") => {
                update_codex_cli_turn_error(
                    &mut turn_error,
                    parsed
                        .get("message")
                        .and_then(serde_json::Value::as_str)
                        .unwrap_or("Codex CLI stream failed."),
                );
            }
            _ => {}
        }
    }

    if let Some(turn_error) = turn_error {
        return Err(format_codex_cli_error(&turn_error));
    }

    if !output.status.success() {
        let detail = stderr.trim();
        return Err(if detail.is_empty() {
            format!("codex cli exited with status {}", output.status)
        } else {
            format!(
                "codex cli exited with status {}: {}",
                output.status,
                format_codex_cli_error(detail)
            )
        });
    }

    assistant_content.ok_or_else(|| "Codex CLI did not return an assistant response.".to_owned())
}

fn update_codex_cli_turn_error(turn_error: &mut Option<String>, candidate: &str) {
    let candidate = candidate.trim();
    if candidate.is_empty() {
        return;
    }

    match turn_error {
        Some(existing) if is_codex_cli_authentication_error(existing) => {}
        Some(_) if is_codex_cli_authentication_error(candidate) => {
            *turn_error = Some(candidate.to_owned());
        }
        None => {
            *turn_error = Some(candidate.to_owned());
        }
        Some(_) => {}
    }
}

fn format_codex_cli_error(message: &str) -> String {
    let trimmed = message.trim();
    if is_codex_cli_authentication_error(trimmed) {
        "Codex CLI authentication is not configured. BirdCoder reuses your existing Codex auth from `CODEX_HOME` or `~/.codex`; if none is configured, set `OPENAI_API_KEY` or run `codex login --with-api-key`.".to_owned()
    } else if trimmed.is_empty() {
        "Codex CLI turn failed.".to_owned()
    } else {
        trimmed.to_owned()
    }
}

fn is_codex_cli_authentication_error(message: &str) -> bool {
    let normalized = message.trim().to_ascii_lowercase();
    normalized.contains("401 unauthorized")
        || normalized.contains("missing bearer or basic authentication")
        || normalized.contains("login")
        || normalized.contains("api key")
        || normalized.contains("authentication")
}

fn build_completed_turn_assistant_content(request_kind: &str, input_summary: &str) -> String {
    format!("Completed {request_kind} request: {input_summary}")
}

fn derive_runtime_status(snapshot: &ProjectionSnapshot, session: &CodingSessionPayload) -> String {
    snapshot
        .events
        .iter()
        .rev()
        .find_map(|event| event.payload.get("runtimeStatus").cloned())
        .unwrap_or_else(|| session.status.clone())
}

fn derive_operation_turn_id(snapshot: &ProjectionSnapshot, operation: &OperationPayload) -> String {
    operation
        .artifact_refs
        .iter()
        .find_map(|artifact_ref| {
            snapshot
                .artifacts
                .iter()
                .find(|artifact| artifact.id == *artifact_ref)
                .and_then(|artifact| artifact.turn_id.clone())
        })
        .or_else(|| snapshot.events.iter().find_map(|event| event.turn_id.clone()))
        .or_else(|| {
            snapshot
                .artifacts
                .iter()
                .find_map(|artifact| artifact.turn_id.clone())
        })
        .or_else(|| {
            operation
                .operation_id
                .strip_suffix(":operation")
                .map(str::to_owned)
        })
        .unwrap_or_else(|| operation.operation_id.clone())
}

#[derive(Clone)]
struct ApprovalContext {
    checkpoint_index: usize,
    checkpoint_id: String,
    runtime_id: Option<String>,
    turn_id: Option<String>,
    operation_index: Option<usize>,
    operation_id: Option<String>,
}

fn approval_runtime_status(decision: &str) -> &'static str {
    match decision {
        "approved" => "awaiting_tool",
        "denied" | "blocked" => "failed",
        _ => "failed",
    }
}

fn approval_operation_status(decision: &str, current_status: Option<&str>) -> String {
    match decision {
        "approved" => current_status.unwrap_or("running").to_owned(),
        "denied" | "blocked" => "failed".to_owned(),
        _ => "failed".to_owned(),
    }
}

fn approval_turn_status(decision: &str, current_status: Option<&str>) -> String {
    match decision {
        "approved" => current_status.unwrap_or("running").to_owned(),
        "denied" | "blocked" => "failed".to_owned(),
        _ => "failed".to_owned(),
    }
}

fn find_approval_context(snapshot: &ProjectionSnapshot, approval_id: &str) -> Option<ApprovalContext> {
    snapshot
        .checkpoints
        .iter()
        .enumerate()
        .find_map(|(checkpoint_index, checkpoint)| {
            if checkpoint.checkpoint_kind != "approval" {
                return None;
            }

            if checkpoint
                .state
                .get("approvalId")
                .map(String::as_str)
                != Some(approval_id)
            {
                return None;
            }

            let runtime_id = checkpoint
                .state
                .get("runtimeId")
                .cloned()
                .or_else(|| checkpoint.runtime_id.clone());
            let approval_event = snapshot.events.iter().rev().find(|event| {
                event.kind == "approval.required"
                    && (event.payload.get("approvalId").map(String::as_str) == Some(approval_id)
                        || (runtime_id.is_some()
                            && event.runtime_id.as_deref() == runtime_id.as_deref()))
            });
            let turn_id = checkpoint
                .state
                .get("turnId")
                .cloned()
                .or_else(|| approval_event.and_then(|event| event.turn_id.clone()))
                .or_else(|| {
                    runtime_id.as_deref().and_then(|target_runtime_id| {
                        snapshot
                            .turns
                            .iter()
                            .rev()
                            .find(|turn| turn.runtime_id.as_deref() == Some(target_runtime_id))
                            .map(|turn| turn.id.clone())
                    })
                })
                .or_else(|| snapshot.turns.iter().rev().map(|turn| turn.id.clone()).next());
            let operation_index = checkpoint
                .state
                .get("operationId")
                .and_then(|operation_id| {
                    snapshot
                        .operations
                        .iter()
                        .position(|operation| operation.operation_id == *operation_id)
                })
                .or_else(|| {
                    approval_event.and_then(|event| {
                        event.payload.get("operationId").and_then(|operation_id| {
                            snapshot
                                .operations
                                .iter()
                                .position(|operation| operation.operation_id == *operation_id)
                        })
                    })
                })
                .or_else(|| {
                    turn_id.as_deref().and_then(|resolved_turn_id| {
                        snapshot.operations.iter().position(|operation| {
                            derive_operation_turn_id(snapshot, operation) == resolved_turn_id
                        })
                    })
                });
            let operation_id = checkpoint
                .state
                .get("operationId")
                .cloned()
                .or_else(|| approval_event.and_then(|event| event.payload.get("operationId").cloned()))
                .or_else(|| {
                    operation_index.and_then(|index| {
                        snapshot
                            .operations
                            .get(index)
                            .map(|operation| operation.operation_id.clone())
                    })
                });

            Some(ApprovalContext {
                checkpoint_index,
                checkpoint_id: checkpoint.id.clone(),
                runtime_id,
                turn_id,
                operation_index,
                operation_id,
            })
        })
}

fn build_approval_decision_event(
    snapshot: &ProjectionSnapshot,
    context: &ApprovalContext,
    approval_id: &str,
    decided_at: &str,
    decision: &str,
    reason: Option<&str>,
    runtime_status: &str,
    operation_status: &str,
) -> CodingSessionEventPayload {
    let mut payload = BTreeMap::new();
    payload.insert("approvalId".to_owned(), approval_id.to_owned());
    payload.insert("approvalDecision".to_owned(), decision.to_owned());
    payload.insert("runtimeStatus".to_owned(), runtime_status.to_owned());
    payload.insert("operationStatus".to_owned(), operation_status.to_owned());
    payload.insert("checkpointId".to_owned(), context.checkpoint_id.clone());

    if let Some(reason) = reason {
        payload.insert("decisionReason".to_owned(), reason.to_owned());
    }
    if let Some(runtime_id) = context.runtime_id.as_ref() {
        payload.insert("runtimeId".to_owned(), runtime_id.clone());
    }
    if let Some(turn_id) = context.turn_id.as_ref() {
        payload.insert("turnId".to_owned(), turn_id.clone());
    }
    if let Some(operation_id) = context.operation_id.as_ref() {
        payload.insert("operationId".to_owned(), operation_id.clone());
    }

    CodingSessionEventPayload {
        id: format!(
            "{}:{}:event:{}",
            context.runtime_id.as_deref().unwrap_or("runtime"),
            context.turn_id.as_deref().unwrap_or(approval_id),
            next_event_sequence(snapshot)
        ),
        coding_session_id: snapshot
            .session
            .as_ref()
            .map(|session| session.id.clone())
            .unwrap_or_default(),
        turn_id: context.turn_id.clone(),
        runtime_id: context.runtime_id.clone(),
        kind: "operation.updated".to_owned(),
        sequence: next_event_sequence(snapshot),
        payload,
        created_at: decided_at.to_owned(),
    }
}

fn apply_approval_decision_to_snapshot(
    snapshot: &mut ProjectionSnapshot,
    context: &ApprovalContext,
    approval_id: &str,
    input: &SubmitApprovalDecisionInput,
    decided_at: &str,
) -> Result<ApprovalDecisionPayload, String> {
    let current_operation_status = context
        .operation_index
        .and_then(|index| snapshot.operations.get(index))
        .map(|operation| operation.status.as_str());
    let current_turn_status = context.turn_id.as_deref().and_then(|turn_id| {
        snapshot
            .turns
            .iter()
            .find(|turn| turn.id == turn_id)
            .map(|turn| turn.status.as_str())
    });
    let runtime_status = approval_runtime_status(&input.decision).to_owned();
    let operation_status = approval_operation_status(&input.decision, current_operation_status);
    let turn_status = approval_turn_status(&input.decision, current_turn_status);

    let event = build_approval_decision_event(
        snapshot,
        context,
        approval_id,
        decided_at,
        &input.decision,
        input.reason.as_deref(),
        &runtime_status,
        &operation_status,
    );

    let checkpoint = snapshot
        .checkpoints
        .get_mut(context.checkpoint_index)
        .ok_or_else(|| format!("approval checkpoint {} was not found", context.checkpoint_id))?;
    checkpoint.resumable = false;
    checkpoint
        .state
        .insert("approvalId".to_owned(), approval_id.to_owned());
    checkpoint
        .state
        .insert("decision".to_owned(), input.decision.clone());
    checkpoint
        .state
        .insert("decidedAt".to_owned(), decided_at.to_owned());
    checkpoint
        .state
        .insert("runtimeStatus".to_owned(), runtime_status.clone());
    checkpoint
        .state
        .insert("operationStatus".to_owned(), operation_status.clone());
    if let Some(reason) = input.reason.as_ref() {
        checkpoint
            .state
            .insert("decisionReason".to_owned(), reason.clone());
    }
    if let Some(runtime_id) = context.runtime_id.as_ref() {
        checkpoint
            .state
            .insert("runtimeId".to_owned(), runtime_id.clone());
    }
    if let Some(turn_id) = context.turn_id.as_ref() {
        checkpoint.state.insert("turnId".to_owned(), turn_id.clone());
    }
    if let Some(operation_id) = context.operation_id.as_ref() {
        checkpoint
            .state
            .insert("operationId".to_owned(), operation_id.clone());
    }

    if let Some(turn_id) = context.turn_id.as_deref() {
        if let Some(turn) = snapshot.turns.iter_mut().find(|turn| turn.id == turn_id) {
            turn.status = turn_status;
            if input.decision != "approved" {
                turn.completed_at = Some(decided_at.to_owned());
            }
        }
    }

    if let Some(operation_index) = context.operation_index {
        if let Some(operation) = snapshot.operations.get_mut(operation_index) {
            operation.status = operation_status.clone();
        }
    }

    if let Some(session) = snapshot.session.as_mut() {
        session.updated_at = decided_at.to_owned();
    }

    snapshot.events.push(event);

    Ok(ApprovalDecisionPayload {
        approval_id: approval_id.to_owned(),
        checkpoint_id: context.checkpoint_id.clone(),
        coding_session_id: snapshot
            .session
            .as_ref()
            .map(|session| session.id.clone())
            .unwrap_or_default(),
        runtime_id: context.runtime_id.clone(),
        turn_id: context.turn_id.clone(),
        operation_id: context.operation_id.clone(),
        decision: input.decision.clone(),
        reason: input.reason.clone(),
        decided_at: decided_at.to_owned(),
        runtime_status,
        operation_status,
    })
}

fn persist_created_coding_session_to_provider(
    connection: &mut Connection,
    session: &CodingSessionPayload,
    host_mode: &str,
) -> Result<(), String> {
    let runtime_id = create_identifier("coding-runtime");
    let capability_snapshot_json = serde_json::json!({}).to_string();
    let metadata_json = serde_json::json!({
        "createdBy": "core.createCodingSession",
    })
    .to_string();
    let transaction = connection
        .transaction()
        .map_err(|error| format!("open create coding_session transaction failed: {error}"))?;

    transaction
        .execute(
            r#"
            INSERT INTO coding_sessions (
                id, created_at, updated_at, version, is_deleted, workspace_id, project_id, title, status, entry_surface, engine_id, model_id, last_turn_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            "#,
            params![
                session.id,
                session.created_at,
                session.updated_at,
                0_i64,
                0_i64,
                session.workspace_id,
                session.project_id,
                session.title,
                session.status,
                "api",
                session.engine_id,
                session.model_id,
                session.last_turn_at,
            ],
        )
        .map_err(|error| format!("insert created coding_session {} failed: {error}", session.id))?;

    transaction
        .execute(
            r#"
            INSERT INTO coding_session_runtimes (
                id, created_at, updated_at, version, is_deleted, coding_session_id, engine_id, model_id, host_mode, status, transport_kind, native_session_id, native_turn_container_id, capability_snapshot_json, metadata_json
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            "#,
            params![
                runtime_id,
                session.created_at,
                session.updated_at,
                0_i64,
                0_i64,
                session.id,
                session.engine_id,
                session.model_id,
                host_mode,
                "ready",
                "cli-jsonl",
                Option::<String>::None,
                Option::<String>::None,
                capability_snapshot_json,
                metadata_json,
            ],
        )
        .map_err(|error| {
            format!(
                "insert created coding_session runtime for {} failed: {error}",
                session.id
            )
        })?;

    transaction
        .commit()
        .map_err(|error| format!("commit create coding_session transaction failed: {error}"))?;

    Ok(())
}

fn persist_created_coding_session_turn_to_provider(
    connection: &mut Connection,
    turn: &CodingSessionTurnPayload,
    events: &[CodingSessionEventPayload],
    operation: &OperationPayload,
) -> Result<(), String> {
    let updated_at = turn
        .completed_at
        .clone()
        .or_else(|| turn.started_at.clone())
        .unwrap_or_else(current_unix_millis_string);
    let turn_created_at = turn
        .started_at
        .clone()
        .unwrap_or_else(current_unix_millis_string);
    let artifact_refs_json = serde_json::to_string(&operation.artifact_refs).map_err(|error| {
        format!(
            "serialize created operation {} artifact refs failed: {error}",
            operation.operation_id
        )
    })?;
    let runtime_id = turn
        .runtime_id
        .clone()
        .ok_or("coding session turn runtimeId is required.")?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("open create coding_session turn transaction failed: {error}"))?;

    let updated_sessions = transaction
        .execute(
            r#"
            UPDATE coding_sessions
            SET updated_at = ?2, last_turn_at = ?2
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![turn.coding_session_id, updated_at],
        )
        .map_err(|error| {
            format!(
                "update coding_session {} for turn {} failed: {error}",
                turn.coding_session_id, turn.id
            )
        })?;
    if updated_sessions == 0 {
        return Err(format!(
            "coding_session {} was not found while creating turn {}",
            turn.coding_session_id, turn.id
        ));
    }

    let updated_runtimes = transaction
        .execute(
            r#"
            UPDATE coding_session_runtimes
            SET updated_at = ?2, status = ?3
            WHERE id = ?1 AND coding_session_id = ?4 AND is_deleted = 0
            "#,
            params![runtime_id, updated_at, "completed", turn.coding_session_id],
        )
        .map_err(|error| {
            format!(
                "update coding_session runtime {} for turn {} failed: {error}",
                runtime_id, turn.id
            )
        })?;
    if updated_runtimes == 0 {
        return Err(format!(
            "coding_session runtime {} was not found while creating turn {}",
            runtime_id, turn.id
        ));
    }

    transaction
        .execute(
            r#"
            INSERT INTO coding_session_turns (
                id, created_at, updated_at, version, is_deleted, coding_session_id, runtime_id, request_kind, status, input_summary, started_at, completed_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
            "#,
            params![
                turn.id,
                turn_created_at,
                updated_at,
                0_i64,
                0_i64,
                turn.coding_session_id,
                runtime_id,
                turn.request_kind,
                turn.status,
                turn.input_summary,
                turn.started_at,
                turn.completed_at,
            ],
        )
        .map_err(|error| format!("insert created coding_session turn {} failed: {error}", turn.id))?;

    for event in events {
        let payload_json = serde_json::to_string(&event.payload).map_err(|error| {
            format!("serialize created event {} payload failed: {error}", event.id)
        })?;
        transaction
            .execute(
                r#"
                INSERT INTO coding_session_events (
                    id, created_at, updated_at, version, is_deleted, coding_session_id, turn_id, runtime_id, event_kind, sequence_no, payload_json
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    event.id,
                    event.created_at,
                    event.created_at,
                    0_i64,
                    0_i64,
                    event.coding_session_id,
                    event.turn_id,
                    event.runtime_id,
                    event.kind,
                    event.sequence as i64,
                    payload_json,
                ],
            )
            .map_err(|error| {
                format!("insert created coding_session event {} failed: {error}", event.id)
            })?;
    }

    transaction
        .execute(
            r#"
            INSERT INTO coding_session_operations (
                id, created_at, updated_at, version, is_deleted, coding_session_id, turn_id, status, stream_url, stream_kind, artifact_refs_json
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                operation.operation_id,
                updated_at,
                updated_at,
                0_i64,
                0_i64,
                turn.coding_session_id,
                turn.id,
                operation.status,
                operation.stream_url,
                operation.stream_kind,
                artifact_refs_json,
            ],
        )
        .map_err(|error| {
            format!(
                "insert created coding_session operation {} failed: {error}",
                operation.operation_id
            )
        })?;

    transaction
        .commit()
        .map_err(|error| format!("commit create coding_session turn transaction failed: {error}"))?;

    Ok(())
}

fn persist_approval_decision_to_provider(
    connection: &mut Connection,
    state: &ProjectionReadState,
    coding_session_id: &str,
    context: &ApprovalContext,
    approval_id: &str,
    input: &SubmitApprovalDecisionInput,
    decided_at: &str,
) -> Result<ApprovalDecisionPayload, String> {
    let snapshot = state
        .session_snapshot(coding_session_id)
        .ok_or_else(|| format!("coding session {coding_session_id} was not found"))?;
    let current_operation_status = context
        .operation_index
        .and_then(|index| snapshot.operations.get(index))
        .map(|operation| operation.status.as_str());
    let current_turn_status = context.turn_id.as_deref().and_then(|turn_id| {
        snapshot
            .turns
            .iter()
            .find(|turn| turn.id == turn_id)
            .map(|turn| turn.status.as_str())
    });
    let runtime_status = approval_runtime_status(&input.decision).to_owned();
    let operation_status = approval_operation_status(&input.decision, current_operation_status);
    let turn_status = approval_turn_status(&input.decision, current_turn_status);
    let event = build_approval_decision_event(
        snapshot,
        context,
        approval_id,
        decided_at,
        &input.decision,
        input.reason.as_deref(),
        &runtime_status,
        &operation_status,
    );
    let mut checkpoint_state = snapshot
        .checkpoints
        .get(context.checkpoint_index)
        .ok_or_else(|| format!("approval checkpoint {} was not found", context.checkpoint_id))?
        .state
        .clone();
    checkpoint_state.insert("approvalId".to_owned(), approval_id.to_owned());
    checkpoint_state.insert("decision".to_owned(), input.decision.clone());
    checkpoint_state.insert("decidedAt".to_owned(), decided_at.to_owned());
    checkpoint_state.insert("runtimeStatus".to_owned(), runtime_status.clone());
    checkpoint_state.insert("operationStatus".to_owned(), operation_status.clone());
    if let Some(reason) = input.reason.as_ref() {
        checkpoint_state.insert("decisionReason".to_owned(), reason.clone());
    }
    if let Some(runtime_id) = context.runtime_id.as_ref() {
        checkpoint_state.insert("runtimeId".to_owned(), runtime_id.clone());
    }
    if let Some(turn_id) = context.turn_id.as_ref() {
        checkpoint_state.insert("turnId".to_owned(), turn_id.clone());
    }
    if let Some(operation_id) = context.operation_id.as_ref() {
        checkpoint_state.insert("operationId".to_owned(), operation_id.clone());
    }

    let checkpoint_state_json = serde_json::to_string(&checkpoint_state).map_err(|error| {
        format!(
            "serialize approval checkpoint {} state failed: {error}",
            context.checkpoint_id
        )
    })?;
    let event_payload_json = serde_json::to_string(&event.payload)
        .map_err(|error| format!("serialize approval event {} payload failed: {error}", event.id))?;
    let transaction = connection
        .transaction()
        .map_err(|error| format!("open approval decision transaction failed: {error}"))?;

    let updated_sessions = transaction
        .execute(
            r#"
            UPDATE coding_sessions
            SET updated_at = ?2
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![coding_session_id, decided_at],
        )
        .map_err(|error| format!("update coding_session {coding_session_id} failed: {error}"))?;
    if updated_sessions == 0 {
        return Err(format!(
            "coding_session {coding_session_id} was not found while submitting approval {approval_id}"
        ));
    }

    transaction
        .execute(
            r#"
            UPDATE coding_session_checkpoints
            SET updated_at = ?2, resumable = ?3, state_json = ?4
            WHERE id = ?1 AND coding_session_id = ?5 AND is_deleted = 0
            "#,
            params![
                context.checkpoint_id,
                decided_at,
                0_i64,
                checkpoint_state_json,
                coding_session_id,
            ],
        )
        .map_err(|error| {
            format!(
                "update approval checkpoint {} for session {} failed: {error}",
                context.checkpoint_id, coding_session_id
            )
        })?;

    if let Some(runtime_id) = context.runtime_id.as_ref() {
        transaction
            .execute(
                r#"
                UPDATE coding_session_runtimes
                SET updated_at = ?2, status = ?3
                WHERE id = ?1 AND coding_session_id = ?4 AND is_deleted = 0
                "#,
                params![runtime_id, decided_at, runtime_status, coding_session_id],
            )
            .map_err(|error| {
                format!(
                    "update approval runtime {} for session {} failed: {error}",
                    runtime_id, coding_session_id
                )
            })?;
    }

    if let Some(turn_id) = context.turn_id.as_ref() {
        transaction
            .execute(
                r#"
                UPDATE coding_session_turns
                SET updated_at = ?2, status = ?3, completed_at = ?4
                WHERE id = ?1 AND coding_session_id = ?5 AND is_deleted = 0
                "#,
                params![
                    turn_id,
                    decided_at,
                    turn_status,
                    if input.decision == "approved" {
                        None::<String>
                    } else {
                        Some(decided_at.to_owned())
                    },
                    coding_session_id,
                ],
            )
            .map_err(|error| {
                format!(
                    "update approval turn {} for session {} failed: {error}",
                    turn_id, coding_session_id
                )
            })?;
    }

    if let Some(operation_id) = context.operation_id.as_ref() {
        transaction
            .execute(
                r#"
                UPDATE coding_session_operations
                SET updated_at = ?2, status = ?3
                WHERE id = ?1 AND coding_session_id = ?4 AND is_deleted = 0
                "#,
                params![operation_id, decided_at, operation_status, coding_session_id],
            )
            .map_err(|error| {
                format!(
                    "update approval operation {} for session {} failed: {error}",
                    operation_id, coding_session_id
                )
            })?;
    }

    transaction
        .execute(
            r#"
            INSERT INTO coding_session_events (
                id, created_at, updated_at, version, is_deleted, coding_session_id, turn_id, runtime_id, event_kind, sequence_no, payload_json
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
            "#,
            params![
                event.id,
                event.created_at,
                event.created_at,
                0_i64,
                0_i64,
                coding_session_id,
                event.turn_id,
                event.runtime_id,
                event.kind,
                event.sequence as i64,
                event_payload_json,
            ],
        )
        .map_err(|error| format!("insert approval event {} failed: {error}", event.id))?;

    transaction
        .commit()
        .map_err(|error| format!("commit approval decision transaction failed: {error}"))?;

    Ok(ApprovalDecisionPayload {
        approval_id: approval_id.to_owned(),
        checkpoint_id: context.checkpoint_id.clone(),
        coding_session_id: coding_session_id.to_owned(),
        runtime_id: context.runtime_id.clone(),
        turn_id: context.turn_id.clone(),
        operation_id: context.operation_id.clone(),
        decision: input.decision.clone(),
        reason: input.reason.clone(),
        decided_at: decided_at.to_owned(),
        runtime_status,
        operation_status,
    })
}

fn ensure_sqlite_provider_authority(
    connection: &mut Connection,
    path: &FsPath,
) -> Result<(), String> {
    let has_projection_tables = sqlite_has_direct_projection_provider_tables(connection)?;
    let has_app_admin_tables = sqlite_has_direct_app_admin_provider_tables(connection)?;

    if has_projection_tables && has_app_admin_tables {
        ensure_sqlite_bootstrap_user_context(connection)?;
        return Ok(());
    }

    if !sqlite_has_legacy_kv_store_table(connection)? {
        return Err(format!(
            "sqlite authority file {} is missing direct provider tables and legacy kv_store bridge",
            path.display()
        ));
    }

    materialize_legacy_kv_authority_into_provider_tables(connection)?;

    if !sqlite_has_direct_projection_provider_tables(connection)?
        || !sqlite_has_direct_app_admin_provider_tables(connection)?
    {
        return Err(format!(
            "sqlite authority file {} failed to materialize direct provider tables from legacy kv_store",
            path.display()
        ));
    }

    ensure_sqlite_bootstrap_user_context(connection)?;

    Ok(())
}

fn ensure_sqlite_bootstrap_user_context(connection: &mut Connection) -> Result<(), String> {
    let workspace_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM workspaces WHERE is_deleted = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("count bootstrap workspaces failed: {error}"))?;
    let project_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM projects WHERE is_deleted = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("count bootstrap projects failed: {error}"))?;

    if workspace_count > 0 && project_count > 0 {
        return Ok(());
    }

    let preferred_workspace_id = if workspace_count > 0 {
        connection
            .query_row(
                r#"
                SELECT id
                FROM workspaces
                WHERE is_deleted = 0
                ORDER BY updated_at DESC, id ASC
                LIMIT 1
                "#,
                [],
                |row| row.get::<_, String>(0),
            )
            .map_err(|error| format!("resolve bootstrap workspace id failed: {error}"))?
    } else {
        BOOTSTRAP_WORKSPACE_ID.to_owned()
    };

    let bootstrap_timestamp = current_storage_timestamp();
    let transaction = connection
        .transaction()
        .map_err(|error| format!("open bootstrap user context transaction failed: {error}"))?;

    if workspace_count == 0 {
        transaction
            .execute(
                r#"
                INSERT INTO workspaces (
                    id, created_at, updated_at, version, is_deleted, name, description, owner_identity_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    BOOTSTRAP_WORKSPACE_ID,
                    &bootstrap_timestamp,
                    &bootstrap_timestamp,
                    0_i64,
                    0_i64,
                    BOOTSTRAP_WORKSPACE_NAME,
                    BOOTSTRAP_WORKSPACE_DESCRIPTION,
                    BOOTSTRAP_WORKSPACE_OWNER_IDENTITY_ID,
                    "active",
                ],
            )
            .map_err(|error| format!("insert bootstrap workspace failed: {error}"))?;
    }

    if project_count == 0 {
        transaction
            .execute(
                r#"
                INSERT INTO projects (
                    id, created_at, updated_at, version, is_deleted, workspace_id, name, description, root_path, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    BOOTSTRAP_PROJECT_ID,
                    &bootstrap_timestamp,
                    &bootstrap_timestamp,
                    0_i64,
                    0_i64,
                    &preferred_workspace_id,
                    BOOTSTRAP_PROJECT_NAME,
                    BOOTSTRAP_PROJECT_DESCRIPTION,
                    Option::<String>::None,
                    "active",
                ],
            )
            .map_err(|error| format!("insert bootstrap project failed: {error}"))?;
    }

    transaction
        .commit()
        .map_err(|error| format!("commit bootstrap user context transaction failed: {error}"))?;

    Ok(())
}

fn materialize_legacy_kv_authority_into_provider_tables(
    connection: &mut Connection,
) -> Result<(), String> {
    let projections = ProjectionReadState::from_sqlite_kv_connection(connection)?;
    let workspaces = load_global_table_records_with_scope::<WorkspacePayload>(
        connection,
        WORKSPACE_SCOPE,
        SQLITE_WORKSPACES_KEY,
    )?;
    let projects =
        load_global_table_records_with_scope::<ProjectPayload>(connection, WORKSPACE_SCOPE, SQLITE_PROJECTS_KEY)?;
    let documents = load_global_table_records_with_scope::<DocumentPayload>(
        connection,
        PROJECT_DOCUMENTS_SCOPE,
        SQLITE_DOCUMENTS_KEY,
    )?;
    let deployment_targets = load_global_table_records_with_scope::<DeploymentTargetPayload>(
        connection,
        DEPLOYMENT_SCOPE,
        SQLITE_DEPLOYMENT_TARGETS_KEY,
    )?;
    let deployments = load_global_table_records_with_scope::<DeploymentPayload>(
        connection,
        DEPLOYMENT_SCOPE,
        SQLITE_DEPLOYMENTS_KEY,
    )?;
    let teams =
        load_global_table_records_with_scope::<TeamPayload>(connection, COLLABORATION_SCOPE, SQLITE_TEAMS_KEY)?;
    let members = load_global_table_records_with_scope::<TeamMemberPayload>(
        connection,
        COLLABORATION_SCOPE,
        SQLITE_TEAM_MEMBERS_KEY,
    )?;
    let releases =
        load_global_table_records_with_scope::<ReleasePayload>(connection, GOVERNANCE_SCOPE, SQLITE_RELEASES_KEY)?;
    let audits =
        load_global_table_records_with_scope::<AuditPayload>(connection, GOVERNANCE_SCOPE, SQLITE_AUDITS_KEY)?;
    let policies =
        load_global_table_records_with_scope::<PolicyPayload>(connection, GOVERNANCE_SCOPE, SQLITE_POLICIES_KEY)?;

    connection
        .execute_batch(SQLITE_PROVIDER_AUTHORITY_SCHEMA)
        .map_err(|error| format!("create sqlite provider authority schema failed: {error}"))?;

    let transaction = connection
        .transaction()
        .map_err(|error| format!("open sqlite provider authority transaction failed: {error}"))?;

    transaction
        .execute_batch(SQLITE_PROVIDER_AUTHORITY_CLEAR_SQL)
        .map_err(|error| format!("clear sqlite provider authority tables failed: {error}"))?;

    for (session_id, snapshot) in &projections.sessions {
        if let Some(session) = snapshot.session.as_ref() {
            transaction
                .execute(
                    r#"
                    INSERT INTO coding_sessions (
                        id, created_at, updated_at, version, is_deleted, workspace_id, project_id, title, status, entry_surface, engine_id, model_id, last_turn_at
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                    "#,
                    params![
                        session.id,
                        session.created_at,
                        session.updated_at,
                        0_i64,
                        0_i64,
                        session.workspace_id,
                        session.project_id,
                        session.title,
                        session.status,
                        "code",
                        session.engine_id,
                        session.model_id,
                        session.last_turn_at,
                    ],
                )
                .map_err(|error| format!("insert migrated coding_session {} failed: {error}", session.id))?;

            let runtime_id = derive_runtime_id(snapshot, session_id);
            let runtime_status = derive_runtime_status(snapshot, session);

            transaction
                .execute(
                    r#"
                    INSERT INTO coding_session_runtimes (
                        id, created_at, updated_at, version, is_deleted, coding_session_id, engine_id, model_id, host_mode, status, transport_kind, native_session_id, native_turn_container_id, capability_snapshot_json, metadata_json
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
                    "#,
                    params![
                        runtime_id,
                        session.created_at,
                        session.updated_at,
                        0_i64,
                        0_i64,
                        session.id,
                        session.engine_id,
                        session.model_id,
                        session.host_mode,
                        runtime_status,
                        "cli",
                        Option::<String>::None,
                        Option::<String>::None,
                        "{}",
                        r#"{"migratedFrom":"kv_store"}"#,
                    ],
                )
                .map_err(|error| format!("insert migrated runtime for session {} failed: {error}", session.id))?;
        }

        for event in &snapshot.events {
            let payload_json = serde_json::to_string(&event.payload)
                .map_err(|error| format!("serialize migrated event {} payload failed: {error}", event.id))?;
            transaction
                .execute(
                    r#"
                    INSERT INTO coding_session_events (
                        id, created_at, updated_at, version, is_deleted, coding_session_id, turn_id, runtime_id, event_kind, sequence_no, payload_json
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                    "#,
                    params![
                        event.id,
                        event.created_at,
                        event.created_at,
                        0_i64,
                        0_i64,
                        event.coding_session_id,
                        event.turn_id,
                        event.runtime_id,
                        event.kind,
                        event.sequence as i64,
                        payload_json,
                    ],
                )
                .map_err(|error| format!("insert migrated event {} failed: {error}", event.id))?;
        }

        for artifact in &snapshot.artifacts {
            let mut metadata = artifact.metadata.clone();
            metadata
                .entry("status".to_owned())
                .or_insert_with(|| artifact.status.clone());
            let blob_ref = metadata.get("blobRef").cloned();
            let metadata_json = serde_json::to_string(&metadata).map_err(|error| {
                format!("serialize migrated artifact {} metadata failed: {error}", artifact.id)
            })?;
            transaction
                .execute(
                    r#"
                    INSERT INTO coding_session_artifacts (
                        id, created_at, updated_at, version, is_deleted, coding_session_id, turn_id, artifact_kind, title, blob_ref, metadata_json
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                    "#,
                    params![
                        artifact.id,
                        artifact.created_at,
                        artifact.created_at,
                        0_i64,
                        0_i64,
                        artifact.coding_session_id,
                        artifact.turn_id,
                        artifact.kind,
                        artifact.title,
                        blob_ref,
                        metadata_json,
                    ],
                )
                .map_err(|error| format!("insert migrated artifact {} failed: {error}", artifact.id))?;
        }

        for checkpoint in &snapshot.checkpoints {
            let state_json = serde_json::to_string(&checkpoint.state).map_err(|error| {
                format!(
                    "serialize migrated checkpoint {} state failed: {error}",
                    checkpoint.id
                )
            })?;
            transaction
                .execute(
                    r#"
                    INSERT INTO coding_session_checkpoints (
                        id, created_at, updated_at, version, is_deleted, coding_session_id, runtime_id, checkpoint_kind, resumable, state_json
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                    "#,
                    params![
                        checkpoint.id,
                        checkpoint.created_at,
                        checkpoint.created_at,
                        0_i64,
                        0_i64,
                        checkpoint.coding_session_id,
                        checkpoint.runtime_id,
                        checkpoint.checkpoint_kind,
                        if checkpoint.resumable { 1_i64 } else { 0_i64 },
                        state_json,
                    ],
                )
                .map_err(|error| format!("insert migrated checkpoint {} failed: {error}", checkpoint.id))?;
        }

        for operation in &snapshot.operations {
            let artifact_refs_json = serde_json::to_string(&operation.artifact_refs).map_err(|error| {
                format!(
                    "serialize migrated operation {} artifact refs failed: {error}",
                    operation.operation_id
                )
            })?;
            let created_at = snapshot
                .events
                .iter()
                .find_map(|event| event.turn_id.as_deref())
                .and_then(|turn_id| {
                    snapshot
                        .events
                        .iter()
                        .find(|event| event.turn_id.as_deref() == Some(turn_id))
                        .map(|event| event.created_at.clone())
                })
                .or_else(|| snapshot.session.as_ref().map(|session| session.updated_at.clone()))
                .unwrap_or_else(current_storage_timestamp);
            transaction
                .execute(
                    r#"
                    INSERT INTO coding_session_operations (
                        id, created_at, updated_at, version, is_deleted, coding_session_id, turn_id, status, stream_url, stream_kind, artifact_refs_json
                    )
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                    "#,
                    params![
                        operation.operation_id,
                        created_at,
                        snapshot
                            .session
                            .as_ref()
                            .map(|session| session.updated_at.clone())
                            .unwrap_or_else(current_storage_timestamp),
                        0_i64,
                        0_i64,
                        session_id,
                        derive_operation_turn_id(snapshot, operation),
                        operation.status,
                        operation.stream_url,
                        operation.stream_kind,
                        artifact_refs_json,
                    ],
                )
                .map_err(|error| {
                    format!(
                        "insert migrated operation {} failed: {error}",
                        operation.operation_id
                    )
                })?;
        }
    }

    let migrated_at = current_storage_timestamp();

    for workspace in workspaces {
        transaction
            .execute(
                r#"
                INSERT INTO workspaces (
                    id, created_at, updated_at, version, is_deleted, name, description, owner_identity_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    workspace.id,
                    migrated_at,
                    migrated_at,
                    0_i64,
                    0_i64,
                    workspace.name,
                    workspace.description,
                    workspace.owner_identity_id,
                    workspace.status,
                ],
            )
            .map_err(|error| {
                format!(
                    "insert migrated workspace {} failed: {error}",
                    workspace.id
                )
            })?;
    }

    for project in projects {
        transaction
            .execute(
                r#"
                INSERT INTO projects (
                    id, created_at, updated_at, version, is_deleted, workspace_id, name, description, root_path, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    project.id,
                    migrated_at,
                    migrated_at,
                    0_i64,
                    0_i64,
                    project.workspace_id,
                    project.name,
                    project.description,
                    project.root_path,
                    project.status,
                ],
            )
            .map_err(|error| format!("insert migrated project {} failed: {error}", project.id))?;
    }

    for document in documents {
        transaction
            .execute(
                r#"
                INSERT INTO project_documents (
                    id, created_at, updated_at, version, is_deleted, project_id, document_kind, title, slug, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    document.id,
                    migrated_at,
                    document.updated_at,
                    0_i64,
                    0_i64,
                    document.project_id,
                    document.document_kind,
                    document.title,
                    document.slug,
                    document.status,
                ],
            )
            .map_err(|error| {
                format!(
                    "insert migrated project document {} failed: {error}",
                    document.id
                )
            })?;
    }

    for deployment_target in deployment_targets {
        transaction
            .execute(
                r#"
                INSERT INTO deployment_targets (
                    id, created_at, updated_at, version, is_deleted, project_id, name, environment_key, runtime, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    deployment_target.id,
                    migrated_at,
                    migrated_at,
                    0_i64,
                    0_i64,
                    deployment_target.project_id,
                    deployment_target.name,
                    deployment_target.environment_key,
                    deployment_target.runtime,
                    deployment_target.status,
                ],
            )
            .map_err(|error| {
                format!(
                    "insert migrated deployment target {} failed: {error}",
                    deployment_target.id
                )
            })?;
    }

    for deployment in deployments {
        let created_at = deployment
            .started_at
            .clone()
            .or_else(|| deployment.completed_at.clone())
            .unwrap_or_else(|| migrated_at.clone());
        let updated_at = deployment
            .completed_at
            .clone()
            .or_else(|| deployment.started_at.clone())
            .unwrap_or_else(|| migrated_at.clone());
        transaction
            .execute(
                r#"
                INSERT INTO deployment_records (
                    id, created_at, updated_at, version, is_deleted, project_id, target_id, release_record_id, status, endpoint_url, started_at, completed_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                "#,
                params![
                    deployment.id,
                    created_at,
                    updated_at,
                    0_i64,
                    0_i64,
                    deployment.project_id,
                    deployment.target_id,
                    deployment.release_record_id,
                    deployment.status,
                    deployment.endpoint_url,
                    deployment.started_at,
                    deployment.completed_at,
                ],
            )
            .map_err(|error| {
                format!(
                    "insert migrated deployment {} failed: {error}",
                    deployment.id
                )
            })?;
    }

    for team in teams {
        transaction
            .execute(
                r#"
                INSERT INTO teams (
                    id, created_at, updated_at, version, is_deleted, workspace_id, name, description, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    team.id,
                    migrated_at,
                    migrated_at,
                    0_i64,
                    0_i64,
                    team.workspace_id,
                    team.name,
                    team.description,
                    team.status,
                ],
            )
            .map_err(|error| format!("insert migrated team {} failed: {error}", team.id))?;
    }

    for member in members {
        transaction
            .execute(
                r#"
                INSERT INTO team_members (
                    id, created_at, updated_at, version, is_deleted, team_id, identity_id, role, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    member.id,
                    migrated_at,
                    migrated_at,
                    0_i64,
                    0_i64,
                    member.team_id,
                    member.identity_id,
                    member.role,
                    member.status,
                ],
            )
            .map_err(|error| {
                format!("insert migrated team member {} failed: {error}", member.id)
            })?;
    }

    for release in releases {
        transaction
            .execute(
                r#"
                INSERT INTO release_records (
                    id, created_at, updated_at, version, is_deleted, release_version, release_kind, rollout_stage, manifest_json, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    release.id,
                    migrated_at,
                    migrated_at,
                    0_i64,
                    0_i64,
                    release.release_version,
                    release.release_kind,
                    release.rollout_stage,
                    r#"{"migratedFrom":"kv_store"}"#,
                    release.status,
                ],
            )
            .map_err(|error| format!("insert migrated release {} failed: {error}", release.id))?;
    }

    for audit in audits {
        let payload_json = serde_json::to_string(&audit.payload)
            .map_err(|error| format!("serialize migrated audit {} payload failed: {error}", audit.id))?;
        transaction
            .execute(
                r#"
                INSERT INTO audit_events (
                    id, created_at, updated_at, version, is_deleted, scope_type, scope_id, event_type, payload_json
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    audit.id,
                    audit.created_at,
                    audit.created_at,
                    0_i64,
                    0_i64,
                    audit.scope_type,
                    audit.scope_id,
                    audit.event_type,
                    payload_json,
                ],
            )
            .map_err(|error| format!("insert migrated audit {} failed: {error}", audit.id))?;
    }

    for policy in policies {
        transaction
            .execute(
                r#"
                INSERT INTO governance_policies (
                    id, created_at, updated_at, version, is_deleted, scope_type, scope_id, policy_category, target_type, target_id, approval_policy, rationale, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                "#,
                params![
                    policy.id,
                    policy.updated_at,
                    policy.updated_at,
                    0_i64,
                    0_i64,
                    policy.scope_type,
                    policy.scope_id,
                    policy.policy_category,
                    policy.target_type,
                    policy.target_id,
                    policy.approval_policy,
                    policy.rationale,
                    policy.status,
                ],
            )
            .map_err(|error| format!("insert migrated policy {} failed: {error}", policy.id))?;
    }

    transaction
        .commit()
        .map_err(|error| format!("commit sqlite provider authority migration failed: {error}"))?;

    Ok(())
}

fn load_global_table_records<T>(connection: &Connection, key: &str) -> Result<Vec<T>, String>
where
    T: for<'de> Deserialize<'de>,
{
    load_global_table_records_with_scope(connection, CODING_SESSION_PROJECTION_SCOPE, key)
}

fn load_global_table_records_with_scope<T>(
    connection: &Connection,
    scope: &str,
    key: &str,
) -> Result<Vec<T>, String>
where
    T: for<'de> Deserialize<'de>,
{
    let mut statement = connection
        .prepare("SELECT value FROM kv_store WHERE scope = ?1 AND key = ?2")
        .map_err(|error| format!("prepare kv_store global query failed: {error}"))?;
    let mut rows = statement
        .query([scope, key])
        .map_err(|error| format!("query kv_store global row failed: {error}"))?;

    match rows
        .next()
        .map_err(|error| format!("read kv_store global row failed: {error}"))?
    {
        Some(row) => {
            let raw_value = row
                .get::<_, String>(0)
                .map_err(|error| format!("decode kv_store global value failed: {error}"))?;
            serde_json::from_str::<Vec<T>>(&raw_value)
                .map_err(|error| format!("parse projection payload for key {key} failed: {error}"))
        }
        None => Ok(Vec::new()),
    }
}

fn load_projection_table_records<T>(
    connection: &Connection,
    prefix: &str,
) -> Result<Vec<(String, Vec<T>)>, String>
where
    T: for<'de> Deserialize<'de>,
{
    let pattern = format!("{prefix}%{SQLITE_PROJECTION_KEY_SUFFIX}");
    let mut statement = connection
        .prepare("SELECT key, value FROM kv_store WHERE scope = ?1 AND key LIKE ?2")
        .map_err(|error| format!("prepare kv_store query failed: {error}"))?;
    let rows = statement
        .query_map([CODING_SESSION_PROJECTION_SCOPE, pattern.as_str()], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|error| format!("query kv_store projection rows failed: {error}"))?;

    let mut records = Vec::new();

    for row in rows {
        let (key, raw_value) =
            row.map_err(|error| format!("read kv_store projection row failed: {error}"))?;
        let session_id = parse_session_id_from_projection_key(&key, prefix).ok_or_else(|| {
            format!("projection key {key} does not match expected prefix {prefix}")
        })?;
        let values = serde_json::from_str::<Vec<T>>(&raw_value)
            .map_err(|error| format!("parse projection payload for key {key} failed: {error}"))?;
        records.push((session_id, values));
    }

    Ok(records)
}

#[derive(Default)]
struct ProjectionSnapshotBuilder {
    session: Option<CodingSessionPayload>,
    turns: Vec<CodingSessionTurnPayload>,
    operations: Vec<OperationPayload>,
    events: Vec<CodingSessionEventPayload>,
    artifacts: Vec<CodingSessionArtifactPayload>,
    checkpoints: Vec<CodingSessionCheckpointPayload>,
}

impl ProjectionReadState {
    fn upsert_session(&mut self, session: CodingSessionPayload) {
        let session_id = session.id.clone();
        let snapshot = self
            .sessions
            .entry(session_id)
            .or_insert_with(|| ProjectionSnapshot {
                session: None,
                turns: Vec::new(),
                operations: Vec::new(),
                events: Vec::new(),
                artifacts: Vec::new(),
                checkpoints: Vec::new(),
            });
        snapshot.session = Some(session);
    }

    fn demo() -> Self {
        let session = CodingSessionPayload {
            id: "demo-coding-session".to_owned(),
            workspace_id: "demo-workspace".to_owned(),
            project_id: "demo-project".to_owned(),
            title: "Demo coding session".to_owned(),
            status: "active".to_owned(),
            host_mode: "server".to_owned(),
            engine_id: "codex".to_owned(),
            model_id: Some("gpt-5-codex".to_owned()),
            created_at: "2026-04-10T00:00:00Z".to_owned(),
            updated_at: "2026-04-10T00:00:03Z".to_owned(),
            last_turn_at: Some("2026-04-10T00:00:01Z".to_owned()),
        };

        let operation = OperationPayload {
            operation_id: "demo-turn:operation".to_owned(),
            status: "running".to_owned(),
            artifact_refs: vec!["demo-turn:artifact:1".to_owned()],
            stream_url: "/api/core/v1/coding-sessions/demo-coding-session/events".to_owned(),
            stream_kind: "sse".to_owned(),
        };

        let events = vec![
            CodingSessionEventPayload {
                id: "demo-runtime:demo-turn:event:0".to_owned(),
                coding_session_id: "demo-coding-session".to_owned(),
                turn_id: Some("demo-turn".to_owned()),
                runtime_id: Some("demo-runtime".to_owned()),
                kind: "session.started".to_owned(),
                sequence: 0,
                payload: build_demo_metadata(&[
                    ("engineId", "codex"),
                    ("runtimeStatus", "ready"),
                ]),
                created_at: "2026-04-10T00:00:00Z".to_owned(),
            },
            CodingSessionEventPayload {
                id: "demo-runtime:demo-turn:event:1".to_owned(),
                coding_session_id: "demo-coding-session".to_owned(),
                turn_id: Some("demo-turn".to_owned()),
                runtime_id: Some("demo-runtime".to_owned()),
                kind: "turn.started".to_owned(),
                sequence: 1,
                payload: build_demo_metadata(&[
                    ("engineId", "codex"),
                    ("requestKind", "chat"),
                ]),
                created_at: "2026-04-10T00:00:01Z".to_owned(),
            },
            CodingSessionEventPayload {
                id: "demo-runtime:demo-turn:event:2".to_owned(),
                coding_session_id: "demo-coding-session".to_owned(),
                turn_id: Some("demo-turn".to_owned()),
                runtime_id: Some("demo-runtime".to_owned()),
                kind: "artifact.upserted".to_owned(),
                sequence: 2,
                payload: build_demo_metadata(&[
                    ("artifactId", "demo-turn:artifact:1"),
                    ("runtimeStatus", "streaming"),
                ]),
                created_at: "2026-04-10T00:00:02Z".to_owned(),
            },
        ];

        let artifacts = vec![CodingSessionArtifactPayload {
            id: "demo-turn:artifact:1".to_owned(),
            coding_session_id: "demo-coding-session".to_owned(),
            turn_id: Some("demo-turn".to_owned()),
            kind: "patch".to_owned(),
            status: "sealed".to_owned(),
            title: "Unified coding-server parity patch".to_owned(),
            metadata: build_demo_metadata(&[
                ("sourceEventId", "demo-runtime:demo-turn:event:2"),
                ("sourceEngineId", "codex"),
            ]),
            created_at: "2026-04-10T00:00:03Z".to_owned(),
        }];

        let checkpoints = vec![CodingSessionCheckpointPayload {
            id: "demo-checkpoint:1".to_owned(),
            coding_session_id: "demo-coding-session".to_owned(),
            runtime_id: Some("demo-runtime".to_owned()),
            checkpoint_kind: "approval".to_owned(),
            resumable: true,
            state: build_demo_metadata(&[
                ("approvalId", "demo-approval-1"),
                ("reason", "Review generated patch"),
            ]),
            created_at: "2026-04-10T00:00:04Z".to_owned(),
        }];

        let mut sessions = BTreeMap::new();
        sessions.insert(
            "demo-coding-session".to_owned(),
            ProjectionSnapshot {
                session: Some(session),
                turns: vec![CodingSessionTurnPayload {
                    id: "demo-turn".to_owned(),
                    coding_session_id: "demo-coding-session".to_owned(),
                    runtime_id: Some("demo-runtime".to_owned()),
                    request_kind: "chat".to_owned(),
                    status: "running".to_owned(),
                    input_summary: "Create unified coding-server parity patch".to_owned(),
                    started_at: Some("2026-04-10T00:00:01Z".to_owned()),
                    completed_at: None,
                }],
                operations: vec![operation],
                events,
                artifacts,
                checkpoints,
            },
        );

        Self { sessions }
    }

    fn from_sqlite_kv_connection(connection: &Connection) -> Result<Self, String> {
        let mut sessions = BTreeMap::<String, ProjectionSnapshotBuilder>::new();

        for session in load_global_table_records::<CodingSessionPayload>(&connection, SQLITE_SESSIONS_KEY)? {
            let session_id = session.id.clone();
            sessions.entry(session_id).or_default().session = Some(session);
        }

        for (session_id, operations) in
            load_projection_table_records::<OperationPayload>(&connection, SQLITE_OPERATIONS_KEY_PREFIX)?
        {
            sessions.entry(session_id).or_default().operations = operations;
        }

        for (session_id, events) in
            load_projection_table_records::<CodingSessionEventPayload>(&connection, SQLITE_EVENTS_KEY_PREFIX)?
        {
            sessions.entry(session_id).or_default().events = events;
        }

        for (session_id, artifacts) in
            load_projection_table_records::<CodingSessionArtifactPayload>(&connection, SQLITE_ARTIFACTS_KEY_PREFIX)?
        {
            sessions.entry(session_id).or_default().artifacts = artifacts;
        }

        for (session_id, checkpoints) in load_projection_table_records::<CodingSessionCheckpointPayload>(
            &connection,
            SQLITE_CHECKPOINTS_KEY_PREFIX,
        )? {
            sessions.entry(session_id).or_default().checkpoints = checkpoints;
        }

        Ok(Self {
            sessions: sessions
                .into_iter()
                .filter_map(|(session_id, snapshot)| {
                    if snapshot.session.is_none()
                        && snapshot.turns.is_empty()
                        && snapshot.operations.is_empty()
                        && snapshot.events.is_empty()
                        && snapshot.artifacts.is_empty()
                        && snapshot.checkpoints.is_empty()
                    {
                        None
                    } else {
                        Some((
                            session_id,
                            ProjectionSnapshot {
                                session: snapshot.session,
                                turns: snapshot.turns,
                                operations: snapshot.operations,
                                events: snapshot.events,
                                artifacts: snapshot.artifacts,
                                checkpoints: snapshot.checkpoints,
                            },
                        ))
                    }
                })
                .collect(),
        })
    }

    fn from_sqlite_provider_connection(connection: &Connection) -> Result<Self, String> {
        let mut sessions = BTreeMap::<String, ProjectionSnapshotBuilder>::new();
        let runtime_rows = load_provider_runtime_rows(connection)?;
        let mut runtimes_by_session = BTreeMap::<String, Vec<CodingSessionRuntimeRow>>::new();

        for runtime in runtime_rows {
            runtimes_by_session
                .entry(runtime.coding_session_id.clone())
                .or_default()
                .push(runtime);
        }

        for session in load_provider_coding_session_rows(connection)? {
            let latest_runtime = runtimes_by_session
                .get(&session.id)
                .and_then(|runtimes| select_latest_runtime_row(runtimes));

            sessions.entry(session.id.clone()).or_default().session = Some(CodingSessionPayload {
                id: session.id.clone(),
                workspace_id: session.workspace_id,
                project_id: session.project_id,
                title: session.title,
                status: session.status,
                host_mode: latest_runtime
                    .map(|runtime| runtime.host_mode.clone())
                    .unwrap_or_else(|| "desktop".to_owned()),
                engine_id: latest_runtime
                    .map(|runtime| runtime.engine_id.clone())
                    .unwrap_or(session.engine_id),
                model_id: latest_runtime
                    .and_then(|runtime| runtime.model_id.clone())
                    .or(session.model_id),
                created_at: session.created_at,
                updated_at: latest_runtime
                    .map(|runtime| runtime.updated_at.clone())
                    .unwrap_or(session.updated_at),
                last_turn_at: session.last_turn_at,
            });
        }

        for turn in load_provider_turn_rows(connection)? {
            let coding_session_id = turn.coding_session_id.clone();
            sessions
                .entry(coding_session_id.clone())
                .or_default()
                .turns
                .push(CodingSessionTurnPayload {
                    id: turn.id,
                    coding_session_id,
                    runtime_id: Some(turn.runtime_id),
                    request_kind: turn.request_kind,
                    status: turn.status,
                    input_summary: turn.input_summary,
                    started_at: turn.started_at,
                    completed_at: turn.completed_at,
                });
        }

        for operation in load_provider_operation_rows(connection)? {
            let artifact_refs = parse_json_string_array(
                &operation.artifact_refs_json,
                "coding_session_operations.artifact_refs_json",
            )?;
            sessions
                .entry(operation.coding_session_id)
                .or_default()
                .operations
                .push(OperationPayload {
                    operation_id: operation.id,
                    status: operation.status,
                    artifact_refs,
                    stream_url: operation.stream_url,
                    stream_kind: operation.stream_kind,
                });
        }

        for event in load_provider_event_rows(connection)? {
            let coding_session_id = event.coding_session_id.clone();
            let payload = parse_json_object_string_map(
                &event.payload_json,
                "coding_session_events.payload_json",
            )?;
            sessions
                .entry(coding_session_id.clone())
                .or_default()
                .events
                .push(CodingSessionEventPayload {
                    id: event.id,
                    coding_session_id,
                    turn_id: event.turn_id,
                    runtime_id: event.runtime_id,
                    kind: event.event_kind,
                    sequence: event.sequence_no,
                    payload,
                    created_at: event.created_at,
                });
        }

        for artifact in load_provider_artifact_rows(connection)? {
            let coding_session_id = artifact.coding_session_id.clone();
            let mut metadata = parse_json_object_string_map(
                &artifact.metadata_json,
                "coding_session_artifacts.metadata_json",
            )?;
            if let Some(blob_ref) = artifact.blob_ref {
                metadata.entry("blobRef".to_owned()).or_insert(blob_ref);
            }
            let status = metadata
                .get("status")
                .cloned()
                .unwrap_or_else(|| "sealed".to_owned());

            sessions
                .entry(coding_session_id.clone())
                .or_default()
                .artifacts
                .push(CodingSessionArtifactPayload {
                    id: artifact.id,
                    coding_session_id,
                    turn_id: artifact.turn_id,
                    kind: artifact.artifact_kind,
                    status,
                    title: artifact.title,
                    metadata,
                    created_at: artifact.created_at,
                });
        }

        for checkpoint in load_provider_checkpoint_rows(connection)? {
            let coding_session_id = checkpoint.coding_session_id.clone();
            let state = parse_json_object_string_map(
                &checkpoint.state_json,
                "coding_session_checkpoints.state_json",
            )?;
            sessions
                .entry(coding_session_id.clone())
                .or_default()
                .checkpoints
                .push(CodingSessionCheckpointPayload {
                    id: checkpoint.id,
                    coding_session_id,
                    runtime_id: checkpoint.runtime_id,
                    checkpoint_kind: checkpoint.checkpoint_kind,
                    resumable: checkpoint.resumable,
                    state,
                    created_at: checkpoint.created_at,
                });
        }

        Ok(Self {
            sessions: sessions
                .into_iter()
                .filter_map(|(session_id, snapshot)| {
                    if snapshot.session.is_none()
                        && snapshot.turns.is_empty()
                        && snapshot.operations.is_empty()
                        && snapshot.events.is_empty()
                        && snapshot.artifacts.is_empty()
                        && snapshot.checkpoints.is_empty()
                    {
                        None
                    } else {
                        Some((
                            session_id,
                            ProjectionSnapshot {
                                session: snapshot.session,
                                turns: snapshot.turns,
                                operations: snapshot.operations,
                                events: snapshot.events,
                                artifacts: snapshot.artifacts,
                                checkpoints: snapshot.checkpoints,
                            },
                        ))
                    }
                })
                .collect(),
        })
    }

    fn from_sqlite_file(path: &FsPath) -> Result<Self, String> {
        let mut connection = Connection::open(path)
            .map_err(|error| format!("open sqlite projection file {} failed: {error}", path.display()))?;
        ensure_sqlite_provider_authority(&mut connection, path)?;
        Self::from_sqlite_provider_connection(&connection)
    }

    fn from_json_file(path: &FsPath) -> Result<Self, String> {
        let raw = fs::read_to_string(path)
            .map_err(|error| format!("read snapshot file {} failed: {error}", path.display()))?;
        serde_json::from_str(&raw).map_err(|error| {
            format!(
                "parse snapshot file {} failed: {error}",
                path.display()
            )
        })
    }

    fn load(bootstrap: &AuthorityBootstrapConfig) -> Result<Self, String> {
        if let Some(path) = bootstrap.sqlite_file.as_deref() {
            return Self::from_sqlite_file(path);
        }

        match bootstrap.snapshot_file.as_deref() {
            Some(path) => Self::from_json_file(path),
            None => Ok(Self::demo()),
        }
    }

    fn session_snapshot(&self, coding_session_id: &str) -> Option<&ProjectionSnapshot> {
        self.sessions.get(coding_session_id)
    }

    fn session(&self, coding_session_id: &str) -> Option<CodingSessionPayload> {
        self.session_snapshot(coding_session_id)
            .and_then(|snapshot| snapshot.session.clone())
    }

    fn operation(&self, operation_id: &str) -> Option<OperationPayload> {
        self.sessions.values().find_map(|snapshot| {
            snapshot
                .operations
                .iter()
                .find(|operation| operation.operation_id == operation_id)
                .cloned()
        })
    }

    fn approval_context(&self, approval_id: &str) -> Option<(String, ApprovalContext)> {
        self.sessions.iter().find_map(|(coding_session_id, snapshot)| {
            find_approval_context(snapshot, approval_id)
                .map(|context| (coding_session_id.clone(), context))
        })
    }
}

impl ProjectionAuthorityState {
    fn new(state: ProjectionReadState, sqlite_file: Option<PathBuf>) -> Self {
        Self {
            sqlite_file,
            state: Arc::new(RwLock::new(state)),
        }
    }

    fn session_snapshot(&self, coding_session_id: &str) -> Option<ProjectionSnapshot> {
        self.state
            .read()
            .expect("read projection authority state")
            .session_snapshot(coding_session_id)
            .cloned()
    }

    fn session(&self, coding_session_id: &str) -> Option<CodingSessionPayload> {
        self.state
            .read()
            .expect("read projection authority state")
            .session(coding_session_id)
    }

    fn operation(&self, operation_id: &str) -> Option<OperationPayload> {
        self.state
            .read()
            .expect("read projection authority state")
            .operation(operation_id)
    }

    fn has_approval(&self, approval_id: &str) -> bool {
        self.state
            .read()
            .expect("read projection authority state")
            .approval_context(approval_id)
            .is_some()
    }

    fn create_coding_session(
        &self,
        input: CreateCodingSessionInput,
    ) -> Result<CodingSessionPayload, String> {
        let timestamp = current_unix_millis_string();
        let session = CodingSessionPayload {
            id: create_identifier("coding-session"),
            workspace_id: input.workspace_id,
            project_id: input.project_id,
            title: input.title,
            status: "active".to_owned(),
            host_mode: input.host_mode.clone(),
            engine_id: input.engine_id.clone(),
            model_id: input.model_id.clone(),
            created_at: timestamp.clone(),
            updated_at: timestamp.clone(),
            last_turn_at: Some(timestamp),
        };

        if let Some(sqlite_file) = self.sqlite_file.as_deref() {
            let mut connection = Connection::open(sqlite_file).map_err(|error| {
                format!(
                    "open sqlite coding-session authority {} failed: {error}",
                    sqlite_file.display()
                )
            })?;
            ensure_sqlite_provider_authority(&mut connection, sqlite_file)?;
            persist_created_coding_session_to_provider(
                &mut connection,
                &session,
                &input.host_mode,
            )?;
            let reloaded_state = ProjectionReadState::from_sqlite_provider_connection(&connection)?;
            *self
                .state
                .write()
                .expect("write projection authority state") = reloaded_state;
        } else {
            self.state
                .write()
                .expect("write projection authority state")
                .upsert_session(session.clone());
        }

        Ok(session)
    }

    fn create_coding_session_turn(
        &self,
        coding_session_id: &str,
        input: CreateCodingSessionTurnInput,
        working_directory: Option<&FsPath>,
    ) -> Result<CodingSessionTurnPayload, String> {
        let snapshot = self
            .session_snapshot(coding_session_id)
            .ok_or_else(|| format!("coding session {coding_session_id} was not found"))?;
        let session = snapshot
            .session
            .clone()
            .ok_or_else(|| format!("coding session {coding_session_id} has no session payload"))?;
        let started_at = current_unix_millis_string();
        let runtime_id = if let Some(sqlite_file) = self.sqlite_file.as_deref() {
            let mut connection = Connection::open(sqlite_file).map_err(|error| {
                format!(
                    "open sqlite coding-session turn authority {} failed: {error}",
                    sqlite_file.display()
                )
            })?;
            ensure_sqlite_provider_authority(&mut connection, sqlite_file)?;
            load_provider_runtime_row_for_session(
                &connection,
                coding_session_id,
                input.runtime_id.as_deref(),
            )?
            .map(|runtime| runtime.id)
            .or(input.runtime_id.clone())
            .unwrap_or_else(|| derive_runtime_id(&snapshot, coding_session_id))
        } else {
            input
                .runtime_id
                .clone()
                .unwrap_or_else(|| derive_runtime_id(&snapshot, coding_session_id))
        };
        let turn_id = create_identifier("coding-turn");
        let operation_id = format!("{turn_id}:operation");
        let request_kind = input.request_kind;
        let input_summary = input.input_summary;
        let completed_at = current_unix_millis_string();
        let assistant_content = if session.engine_id == "codex" {
            execute_codex_cli_turn(
                session.model_id.as_deref(),
                working_directory,
                &request_kind,
                &input_summary,
            )?
        } else {
            build_completed_turn_assistant_content(&request_kind, &input_summary)
        };
        let base_sequence = next_event_sequence(&snapshot);
        let turn = CodingSessionTurnPayload {
            id: turn_id.clone(),
            coding_session_id: coding_session_id.to_owned(),
            runtime_id: Some(runtime_id.clone()),
            request_kind: request_kind.clone(),
            status: "completed".to_owned(),
            input_summary: input_summary.clone(),
            started_at: Some(started_at.clone()),
            completed_at: Some(completed_at.clone()),
        };
        let operation = OperationPayload {
            operation_id: operation_id.clone(),
            status: "succeeded".to_owned(),
            artifact_refs: Vec::new(),
            stream_url: format!("/api/core/v1/coding-sessions/{coding_session_id}/events"),
            stream_kind: "sse".to_owned(),
        };
        let mut started_payload = BTreeMap::new();
        started_payload.insert("engineId".to_owned(), session.engine_id);
        started_payload.insert("requestKind".to_owned(), request_kind.clone());
        started_payload.insert("inputSummary".to_owned(), input_summary.clone());
        started_payload.insert("operationId".to_owned(), operation_id.clone());
        started_payload.insert("runtimeStatus".to_owned(), "streaming".to_owned());

        let mut message_payload = BTreeMap::new();
        message_payload.insert("role".to_owned(), "assistant".to_owned());
        message_payload.insert("content".to_owned(), assistant_content.clone());
        message_payload.insert("operationId".to_owned(), operation_id.clone());
        message_payload.insert("runtimeStatus".to_owned(), "completed".to_owned());

        let mut operation_payload = BTreeMap::new();
        operation_payload.insert("operationId".to_owned(), operation_id.clone());
        operation_payload.insert("status".to_owned(), "succeeded".to_owned());
        operation_payload.insert("runtimeStatus".to_owned(), "completed".to_owned());

        let mut completed_payload = BTreeMap::new();
        completed_payload.insert("operationId".to_owned(), operation_id.clone());
        completed_payload.insert("finishReason".to_owned(), "stop".to_owned());
        completed_payload.insert(
            "contentLength".to_owned(),
            assistant_content.len().to_string(),
        );
        completed_payload.insert("runtimeStatus".to_owned(), "completed".to_owned());

        let events = vec![
            CodingSessionEventPayload {
                id: format!("{runtime_id}:{turn_id}:event:{base_sequence}"),
                coding_session_id: coding_session_id.to_owned(),
                turn_id: Some(turn_id.clone()),
                runtime_id: Some(runtime_id.clone()),
                kind: "turn.started".to_owned(),
                sequence: base_sequence,
                payload: started_payload,
                created_at: started_at.clone(),
            },
            CodingSessionEventPayload {
                id: format!("{runtime_id}:{turn_id}:event:{}", base_sequence + 1),
                coding_session_id: coding_session_id.to_owned(),
                turn_id: Some(turn_id.clone()),
                runtime_id: Some(runtime_id.clone()),
                kind: "message.completed".to_owned(),
                sequence: base_sequence + 1,
                payload: message_payload,
                created_at: completed_at.clone(),
            },
            CodingSessionEventPayload {
                id: format!("{runtime_id}:{turn_id}:event:{}", base_sequence + 2),
                coding_session_id: coding_session_id.to_owned(),
                turn_id: Some(turn_id.clone()),
                runtime_id: Some(runtime_id.clone()),
                kind: "operation.updated".to_owned(),
                sequence: base_sequence + 2,
                payload: operation_payload,
                created_at: completed_at.clone(),
            },
            CodingSessionEventPayload {
                id: format!("{runtime_id}:{turn_id}:event:{}", base_sequence + 3),
                coding_session_id: coding_session_id.to_owned(),
                turn_id: Some(turn_id.clone()),
                runtime_id: Some(runtime_id.clone()),
                kind: "turn.completed".to_owned(),
                sequence: base_sequence + 3,
                payload: completed_payload,
                created_at: completed_at.clone(),
            },
        ];

        if let Some(sqlite_file) = self.sqlite_file.as_deref() {
            let mut connection = Connection::open(sqlite_file).map_err(|error| {
                format!(
                    "open sqlite coding-session turn authority {} failed: {error}",
                    sqlite_file.display()
                )
            })?;
            ensure_sqlite_provider_authority(&mut connection, sqlite_file)?;
            persist_created_coding_session_turn_to_provider(
                &mut connection,
                &turn,
                &events,
                &operation,
            )?;
            let reloaded_state = ProjectionReadState::from_sqlite_provider_connection(&connection)?;
            *self
                .state
                .write()
                .expect("write projection authority state") = reloaded_state;
        } else {
            let mut state = self.state.write().expect("write projection authority state");
            let snapshot = state
                .sessions
                .get_mut(coding_session_id)
                .ok_or_else(|| format!("coding session {coding_session_id} was not found"))?;
            if let Some(session) = snapshot.session.as_mut() {
                session.updated_at = completed_at.clone();
                session.last_turn_at = Some(completed_at.clone());
            }
            snapshot.turns.push(turn.clone());
            snapshot.events.extend(events);
            snapshot.operations.push(operation);
        }

        Ok(turn)
    }

    fn submit_approval_decision(
        &self,
        approval_id: &str,
        input: SubmitApprovalDecisionInput,
    ) -> Result<ApprovalDecisionPayload, String> {
        let decided_at = current_unix_millis_string();

        if let Some(sqlite_file) = self.sqlite_file.as_deref() {
            let mut connection = Connection::open(sqlite_file).map_err(|error| {
                format!(
                    "open sqlite approval authority {} failed: {error}",
                    sqlite_file.display()
                )
            })?;
            ensure_sqlite_provider_authority(&mut connection, sqlite_file)?;
            let reloaded_state = ProjectionReadState::from_sqlite_provider_connection(&connection)?;
            let (coding_session_id, context) = reloaded_state
                .approval_context(approval_id)
                .ok_or_else(|| format!("approval {approval_id} was not found"))?;
            let decision = persist_approval_decision_to_provider(
                &mut connection,
                &reloaded_state,
                &coding_session_id,
                &context,
                approval_id,
                &input,
                &decided_at,
            )?;
            let refreshed_state = ProjectionReadState::from_sqlite_provider_connection(&connection)?;
            *self
                .state
                .write()
                .expect("write projection authority state") = refreshed_state;
            return Ok(decision);
        }

        let mut state = self.state.write().expect("write projection authority state");
        let (coding_session_id, context) = state
            .approval_context(approval_id)
            .ok_or_else(|| format!("approval {approval_id} was not found"))?;
        let snapshot = state
            .sessions
            .get_mut(&coding_session_id)
            .ok_or_else(|| format!("coding session {coding_session_id} was not found"))?;
        apply_approval_decision_to_snapshot(snapshot, &context, approval_id, &input, &decided_at)
    }
}

impl AppState {
    fn cached_app_admin_read_state(&self) -> AppAdminReadState {
        AppAdminReadState {
            audits: self.audits.clone(),
            deployments: self.deployments.clone(),
            targets: self.targets.clone(),
            documents: self.documents.clone(),
            members: self.members.clone(),
            policies: self.policies.clone(),
            workspaces: self.workspaces.clone(),
            projects: self.projects.clone(),
            teams: self.teams.clone(),
            releases: self.releases.clone(),
        }
    }

    fn load_live_app_admin_read_state(&self) -> Result<Option<AppAdminReadState>, String> {
        let Some(sqlite_file) = self.projections.sqlite_file.as_deref() else {
            return Ok(None);
        };

        let mut connection = Connection::open(sqlite_file).map_err(|error| {
            format!(
                "open sqlite app/admin authority file {} failed: {error}",
                sqlite_file.display()
            )
        })?;
        ensure_sqlite_provider_authority(&mut connection, sqlite_file)?;

        Ok(Some(AppAdminReadState {
            audits: load_provider_audit_payloads(&connection)?,
            deployments: load_provider_deployment_payloads(&connection)?,
            targets: load_provider_deployment_target_payloads(&connection)?,
            documents: load_provider_document_payloads(&connection)?,
            members: load_provider_team_member_payloads(&connection)?,
            policies: load_provider_policy_payloads(&connection)?,
            workspaces: load_provider_workspace_payloads(&connection)?,
            projects: load_provider_project_payloads(&connection)?,
            teams: load_provider_team_payloads(&connection)?,
            releases: load_provider_release_payloads(&connection)?,
        }))
    }

    fn read_app_admin_state(&self) -> AppAdminReadState {
        self.load_live_app_admin_read_state()
            .ok()
            .flatten()
            .unwrap_or_else(|| self.cached_app_admin_read_state())
    }

    fn demo() -> Self {
        Self {
            projections: ProjectionAuthorityState::new(ProjectionReadState::demo(), None),
            audits: vec![AuditPayload {
                id: "audit-demo-release".to_owned(),
                scope_type: "workspace".to_owned(),
                scope_id: "demo-workspace".to_owned(),
                event_type: "release.promoted".to_owned(),
                payload: serde_json::json!({
                    "actor": "release-bot",
                    "releaseVersion": "0.1.0-demo",
                    "rolloutStage": "ring-0",
                }),
                created_at: "2026-04-10T13:05:00Z".to_owned(),
            }],
            policies: vec![PolicyPayload {
                id: "policy-demo-terminal".to_owned(),
                scope_type: "workspace".to_owned(),
                scope_id: "demo-workspace".to_owned(),
                policy_category: "terminal".to_owned(),
                target_type: "engine".to_owned(),
                target_id: "codex".to_owned(),
                approval_policy: "Restricted".to_owned(),
                rationale: Some("Demo terminal lane requires explicit approval for codex.".to_owned()),
                status: "active".to_owned(),
                updated_at: "2026-04-10T13:06:00Z".to_owned(),
            }],
            workspaces: vec![WorkspacePayload {
                id: "demo-workspace".to_owned(),
                name: "Demo Workspace".to_owned(),
                description: Some("Default embedded workspace for the local desktop authority.".to_owned()),
                owner_identity_id: Some("identity-demo-owner".to_owned()),
                status: "active".to_owned(),
            }],
            documents: vec![DocumentPayload {
                id: "doc-architecture-demo".to_owned(),
                project_id: "demo-project".to_owned(),
                document_kind: "architecture".to_owned(),
                title: "Demo architecture".to_owned(),
                slug: "demo-architecture".to_owned(),
                status: "active".to_owned(),
                updated_at: "2026-04-10T13:00:00Z".to_owned(),
            }],
            projects: vec![ProjectPayload {
                id: "demo-project".to_owned(),
                workspace_id: "demo-workspace".to_owned(),
                name: "Demo IDE workspace project".to_owned(),
                description: Some("Representative app project list item.".to_owned()),
                root_path: Some("E:/sdkwork/demo-project".to_owned()),
                status: "active".to_owned(),
            }],
            deployments: vec![DeploymentPayload {
                id: "deployment-demo".to_owned(),
                project_id: "demo-project".to_owned(),
                target_id: "target-demo-web".to_owned(),
                release_record_id: Some("release-0.1.0-demo".to_owned()),
                status: "succeeded".to_owned(),
                endpoint_url: Some("https://demo.sdkwork.dev".to_owned()),
                started_at: Some("2026-04-10T13:03:00Z".to_owned()),
                completed_at: Some("2026-04-10T13:04:00Z".to_owned()),
            }],
            targets: vec![DeploymentTargetPayload {
                id: "target-demo-web".to_owned(),
                project_id: "demo-project".to_owned(),
                name: "Demo deployment target".to_owned(),
                environment_key: "prod".to_owned(),
                runtime: "web".to_owned(),
                status: "active".to_owned(),
            }],
            members: vec![TeamMemberPayload {
                id: "member-demo-owner".to_owned(),
                team_id: "demo-team".to_owned(),
                identity_id: "identity-demo-owner".to_owned(),
                role: "owner".to_owned(),
                status: "active".to_owned(),
            }],
            teams: vec![TeamPayload {
                id: "demo-team".to_owned(),
                workspace_id: "demo-workspace".to_owned(),
                name: "Demo collaboration team".to_owned(),
                description: Some("Representative admin team list item.".to_owned()),
                status: "active".to_owned(),
            }],
            releases: vec![ReleasePayload {
                id: "release-0.1.0-demo".to_owned(),
                release_version: "0.1.0-demo".to_owned(),
                release_kind: "canary".to_owned(),
                rollout_stage: "ring-0".to_owned(),
                status: "pending".to_owned(),
            }],
        }
    }

    fn load(bootstrap: &AuthorityBootstrapConfig) -> Result<Self, String> {
        if let Some(path) = bootstrap.sqlite_file.as_deref() {
            let mut connection = Connection::open(path).map_err(|error| {
                format!(
                    "open sqlite app/admin authority file {} failed: {error}",
                    path.display()
                )
            })?;
            ensure_sqlite_provider_authority(&mut connection, path)?;

            return Ok(Self {
                projections: ProjectionAuthorityState::new(
                    ProjectionReadState::from_sqlite_provider_connection(&connection)?,
                    Some(path.to_path_buf()),
                ),
                audits: load_provider_audit_payloads(&connection)?,
                deployments: load_provider_deployment_payloads(&connection)?,
                targets: load_provider_deployment_target_payloads(&connection)?,
                documents: load_provider_document_payloads(&connection)?,
                members: load_provider_team_member_payloads(&connection)?,
                policies: load_provider_policy_payloads(&connection)?,
                workspaces: load_provider_workspace_payloads(&connection)?,
                projects: load_provider_project_payloads(&connection)?,
                teams: load_provider_team_payloads(&connection)?,
                releases: load_provider_release_payloads(&connection)?,
            });
        }

        let demo = Self::demo();
        Ok(Self {
            projections: ProjectionAuthorityState::new(ProjectionReadState::load(bootstrap)?, None),
            audits: demo.audits,
            deployments: demo.deployments,
            targets: demo.targets,
            documents: demo.documents,
            members: demo.members,
            policies: demo.policies,
            workspaces: demo.workspaces,
            projects: demo.projects,
            teams: demo.teams,
            releases: demo.releases,
        })
    }
}

const CODING_SERVER_OPENAPI_ROUTE_SPECS: [RouteSpec; 26] = [
    RouteSpec {
        method: "get",
        operation_id: "core.getDescriptor",
        path: "/api/core/v1/descriptor",
        summary: "Get coding-server descriptor",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.listEngines",
        path: "/api/core/v1/engines",
        summary: "List available engines",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.getEngineCapabilities",
        path: "/api/core/v1/engines/:engineKey/capabilities",
        summary: "Get runtime capabilities for one engine",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.listModels",
        path: "/api/core/v1/models",
        summary: "List model catalog",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.getRuntime",
        path: "/api/core/v1/runtime",
        summary: "Get runtime metadata",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.getHealth",
        path: "/api/core/v1/health",
        summary: "Get coding-server health",
        tag: "core",
    },
    RouteSpec {
        method: "post",
        operation_id: "core.createCodingSession",
        path: "/api/core/v1/coding-sessions",
        summary: "Create coding session",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.getCodingSession",
        path: "/api/core/v1/coding-sessions/:id",
        summary: "Get coding session",
        tag: "core",
    },
    RouteSpec {
        method: "post",
        operation_id: "core.createCodingSessionTurn",
        path: "/api/core/v1/coding-sessions/:id/turns",
        summary: "Create coding session turn",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.listCodingSessionEvents",
        path: "/api/core/v1/coding-sessions/:id/events",
        summary: "Replay or subscribe to coding session events",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.listCodingSessionArtifacts",
        path: "/api/core/v1/coding-sessions/:id/artifacts",
        summary: "List coding session artifacts",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.listCodingSessionCheckpoints",
        path: "/api/core/v1/coding-sessions/:id/checkpoints",
        summary: "List coding session checkpoints",
        tag: "core",
    },
    RouteSpec {
        method: "post",
        operation_id: "core.submitApprovalDecision",
        path: "/api/core/v1/approvals/:approvalId/decision",
        summary: "Submit approval decision",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.getOperation",
        path: "/api/core/v1/operations/:operationId",
        summary: "Get operation status",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.listWorkspaces",
        path: "/api/app/v1/workspaces",
        summary: "List workspaces",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.listProjects",
        path: "/api/app/v1/projects",
        summary: "List projects",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.listDocuments",
        path: "/api/app/v1/documents",
        summary: "List project documents",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.listTeams",
        path: "/api/app/v1/teams",
        summary: "List workspace teams",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.listDeployments",
        path: "/api/app/v1/deployments",
        summary: "List deployments",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "admin.listAuditEvents",
        path: "/api/admin/v1/audit",
        summary: "List audit events",
        tag: "admin",
    },
    RouteSpec {
        method: "get",
        operation_id: "admin.listPolicies",
        path: "/api/admin/v1/policies",
        summary: "List governance policies",
        tag: "admin",
    },
    RouteSpec {
        method: "get",
        operation_id: "admin.listTeams",
        path: "/api/admin/v1/teams",
        summary: "List teams",
        tag: "admin",
    },
    RouteSpec {
        method: "get",
        operation_id: "admin.listDeploymentTargets",
        path: "/api/admin/v1/projects/:projectId/deployment-targets",
        summary: "List deployment targets",
        tag: "admin",
    },
    RouteSpec {
        method: "get",
        operation_id: "admin.listTeamMembers",
        path: "/api/admin/v1/teams/:teamId/members",
        summary: "List team members",
        tag: "admin",
    },
    RouteSpec {
        method: "get",
        operation_id: "admin.listReleases",
        path: "/api/admin/v1/releases",
        summary: "List releases",
        tag: "admin",
    },
    RouteSpec {
        method: "get",
        operation_id: "admin.listDeployments",
        path: "/api/admin/v1/deployments",
        summary: "List governed deployments",
        tag: "admin",
    },
];

fn create_envelope<T>(seed: &str, data: T) -> ApiEnvelope<T> {
    ApiEnvelope {
        request_id: format!("req:{seed}:rust"),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_secs()
            .to_string(),
        data,
        meta: ApiMeta {
            version: CODING_SERVER_API_VERSION,
        },
    }
}

fn build_openapi_document() -> OpenApiDocument {
    let mut paths = BTreeMap::new();
    for route_spec in CODING_SERVER_OPENAPI_ROUTE_SPECS {
        paths
            .entry(route_spec.path)
            .or_insert_with(BTreeMap::new)
            .insert(
                route_spec.method,
                OpenApiOperation {
                    operation_id: route_spec.operation_id,
                    summary: route_spec.summary,
                    tags: [route_spec.tag],
                },
            );
    }

    OpenApiDocument {
        openapi: "3.1.0",
        info: OpenApiInfo {
            title: "SDKWork BirdCoder Coding Server API",
            version: CODING_SERVER_API_VERSION,
        },
        servers: vec![OpenApiServer {
            url: format!("http://{BIRD_SERVER_DEFAULT_BIND_ADDRESS}"),
        }],
        tags: vec![
            OpenApiTag { name: "core" },
            OpenApiTag { name: "app" },
            OpenApiTag { name: "admin" },
        ],
        paths,
    }
}

async fn core_health() -> Json<ApiEnvelope<HealthPayload>> {
    Json(create_envelope(
        "core-health",
        HealthPayload { status: "healthy" },
    ))
}

fn create_list_envelope<T>(seed: &str, items: Vec<T>) -> ApiListEnvelope<T> {
    let total = items.len();
    ApiListEnvelope {
        request_id: format!("req:{seed}:rust"),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_secs()
            .to_string(),
        items,
        meta: ApiListMeta {
            page: 1,
            page_size: total,
            total,
            version: CODING_SERVER_API_VERSION,
        },
    }
}

async fn core_descriptor() -> Json<ApiEnvelope<DescriptorPayload>> {
    Json(create_envelope(
        "core-descriptor",
        DescriptorPayload {
            api_version: CODING_SERVER_API_VERSION,
            host_mode: "server",
            module_id: "coding-server",
            open_api_path: CODING_SERVER_OPENAPI_PATH,
            surfaces: ["core", "app", "admin"],
        },
    ))
}

async fn core_runtime() -> Json<ApiEnvelope<RuntimePayload>> {
    Json(create_envelope(
        "core-runtime",
        RuntimePayload {
            host: BIRD_SERVER_DEFAULT_HOST,
            port: BIRD_SERVER_DEFAULT_PORT,
            config_file_name: BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME,
        },
    ))
}

async fn core_engines() -> Json<ApiListEnvelope<EngineDescriptorPayload>> {
    Json(create_list_envelope("core-engines", build_engine_catalog()))
}

async fn core_engine_capabilities(
    AxumPath(engine_key): AxumPath<String>,
) -> Result<
    Json<ApiEnvelope<EngineCapabilityMatrixPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let engine = find_engine_descriptor(&engine_key).ok_or_else(|| {
        problem_response(
            "engine-capabilities-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Engine capability catalog entry was not found.",
        )
    })?;

    Ok(Json(create_envelope(
        "core-engine-capabilities",
        engine.capability_matrix,
    )))
}

async fn core_models() -> Json<ApiListEnvelope<ModelCatalogEntryPayload>> {
    Json(create_list_envelope("core-models", build_model_catalog()))
}

async fn app_workspaces(State(state): State<AppState>) -> Json<ApiListEnvelope<WorkspacePayload>> {
    let app_admin_state = state.read_app_admin_state();
    Json(create_list_envelope("app-workspaces", app_admin_state.workspaces))
}

async fn app_projects(State(state): State<AppState>) -> Json<ApiListEnvelope<ProjectPayload>> {
    let app_admin_state = state.read_app_admin_state();
    Json(create_list_envelope("app-projects", app_admin_state.projects))
}

async fn app_documents(State(state): State<AppState>) -> Json<ApiListEnvelope<DocumentPayload>> {
    let app_admin_state = state.read_app_admin_state();
    Json(create_list_envelope("app-documents", app_admin_state.documents))
}

async fn app_deployments(
    State(state): State<AppState>,
) -> Json<ApiListEnvelope<DeploymentPayload>> {
    let app_admin_state = state.read_app_admin_state();
    Json(create_list_envelope(
        "app-deployments",
        app_admin_state.deployments,
    ))
}

async fn app_teams(State(state): State<AppState>) -> Json<ApiListEnvelope<TeamPayload>> {
    let app_admin_state = state.read_app_admin_state();
    Json(create_list_envelope("app-teams", app_admin_state.teams))
}

async fn admin_teams(State(state): State<AppState>) -> Json<ApiListEnvelope<TeamPayload>> {
    let app_admin_state = state.read_app_admin_state();
    Json(create_list_envelope("admin-teams", app_admin_state.teams))
}

async fn admin_deployment_targets(
    AxumPath(project_id): AxumPath<String>,
    State(state): State<AppState>,
) -> Json<ApiListEnvelope<DeploymentTargetPayload>> {
    let app_admin_state = state.read_app_admin_state();
    let targets = app_admin_state
        .targets
        .iter()
        .filter(|target| target.project_id == project_id)
        .cloned()
        .collect::<Vec<_>>();
    Json(create_list_envelope("admin-deployment-targets", targets))
}

async fn admin_team_members(
    AxumPath(team_id): AxumPath<String>,
    State(state): State<AppState>,
) -> Json<ApiListEnvelope<TeamMemberPayload>> {
    let app_admin_state = state.read_app_admin_state();
    let members = app_admin_state
        .members
        .iter()
        .filter(|member| member.team_id == team_id)
        .cloned()
        .collect::<Vec<_>>();
    Json(create_list_envelope("admin-team-members", members))
}

async fn admin_releases(State(state): State<AppState>) -> Json<ApiListEnvelope<ReleasePayload>> {
    let app_admin_state = state.read_app_admin_state();
    Json(create_list_envelope(
        "admin-releases",
        app_admin_state.releases,
    ))
}

async fn admin_audit(State(state): State<AppState>) -> Json<ApiListEnvelope<AuditPayload>> {
    let app_admin_state = state.read_app_admin_state();
    Json(create_list_envelope("admin-audit", app_admin_state.audits))
}

async fn admin_policies(State(state): State<AppState>) -> Json<ApiListEnvelope<PolicyPayload>> {
    let app_admin_state = state.read_app_admin_state();
    Json(create_list_envelope(
        "admin-policies",
        app_admin_state.policies,
    ))
}

async fn admin_deployments(
    State(state): State<AppState>,
) -> Json<ApiListEnvelope<DeploymentPayload>> {
    let app_admin_state = state.read_app_admin_state();
    Json(create_list_envelope(
        "admin-deployments",
        app_admin_state.deployments,
    ))
}

async fn openapi_document() -> Json<OpenApiDocument> {
    Json(build_openapi_document())
}

fn problem_response(
    seed: &str,
    status: StatusCode,
    code: &'static str,
    message: impl Into<String>,
) -> (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>) {
    (
        status,
        Json(create_envelope(
            seed,
            ProblemDetailsPayload {
                code,
                message: message.into(),
                retryable: false,
            },
        )),
    )
}

async fn core_operation(
    State(state): State<AppState>,
    AxumPath(operation_id): AxumPath<String>,
) -> Result<Json<ApiEnvelope<OperationPayload>>, (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>)>
{
    let operation = state
        .projections
        .operation(&operation_id)
        .ok_or_else(|| {
            problem_response(
                "operation-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Operation projection was not found.",
            )
        })?;

    Ok(Json(create_envelope("core-operation", operation)))
}

async fn core_session(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
) -> Result<Json<ApiEnvelope<CodingSessionPayload>>, (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>)>
{
    let session = state
        .projections
        .session(&coding_session_id)
        .ok_or_else(|| {
            problem_response(
                "session-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Coding session projection was not found.",
            )
        })?;

    Ok(Json(create_envelope("core-session", session)))
}

async fn core_create_session(
    State(state): State<AppState>,
    Json(request): Json<CreateCodingSessionRequest>,
) -> Result<
    (StatusCode, Json<ApiEnvelope<CodingSessionPayload>>),
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let input = CreateCodingSessionInput::try_from(request).map_err(|message| {
        problem_response(
            "create-coding-session-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            message,
        )
    })?;

    let session = state.projections.create_coding_session(input).map_err(|error| {
        problem_response(
            "create-coding-session-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to persist coding session authority: {error}"),
        )
    })?;

    Ok((
        StatusCode::CREATED,
        Json(create_envelope("core-create-session", session)),
    ))
}

async fn core_create_turn(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
    Json(request): Json<CreateCodingSessionTurnRequest>,
) -> Result<
    (StatusCode, Json<ApiEnvelope<CodingSessionTurnPayload>>),
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let input = CreateCodingSessionTurnInput::try_from(request).map_err(|message| {
        problem_response(
            "create-coding-session-turn-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            message,
        )
    })?;

    if state.projections.session(&coding_session_id).is_none() {
        return Err(problem_response(
            "create-coding-session-turn-session-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Coding session projection was not found.",
        ));
    }
    let project_root_path = state
        .projections
        .session(&coding_session_id)
        .and_then(|session| {
            state
                .projects
                .iter()
                .find(|project| project.id == session.project_id)
                .and_then(|project| project.root_path.as_deref())
                .map(FsPath::new)
                .map(FsPath::to_path_buf)
        });

    let turn = state
        .projections
        .create_coding_session_turn(&coding_session_id, input, project_root_path.as_deref())
        .map_err(|error| {
            problem_response(
                "create-coding-session-turn-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to persist coding session turn authority: {error}"),
            )
        })?;

    Ok((
        StatusCode::CREATED,
        Json(create_envelope("core-create-turn", turn)),
    ))
}

async fn core_submit_approval_decision(
    State(state): State<AppState>,
    AxumPath(approval_id): AxumPath<String>,
    Json(request): Json<SubmitApprovalDecisionRequest>,
) -> Result<
    Json<ApiEnvelope<ApprovalDecisionPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let input = SubmitApprovalDecisionInput::try_from(request).map_err(|message| {
        problem_response(
            "submit-approval-decision-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            message,
        )
    })?;

    if !state.projections.has_approval(&approval_id) {
        return Err(problem_response(
            "submit-approval-decision-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Approval checkpoint was not found.",
        ));
    }

    let approval = state
        .projections
        .submit_approval_decision(&approval_id, input)
        .map_err(|error| {
            problem_response(
                "submit-approval-decision-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to persist approval authority: {error}"),
            )
        })?;

    Ok(Json(create_envelope("core-approval-decision", approval)))
}

async fn core_session_events(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
) -> Result<
    Json<ApiListEnvelope<CodingSessionEventPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let snapshot = state
        .projections
        .session_snapshot(&coding_session_id)
        .ok_or_else(|| {
            problem_response(
                "session-events-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Coding session projection was not found.",
            )
        })?;

    Ok(Json(create_list_envelope(
        "core-session-events",
        snapshot.events.clone(),
    )))
}

async fn core_session_artifacts(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
) -> Result<
    Json<ApiListEnvelope<CodingSessionArtifactPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let snapshot = state
        .projections
        .session_snapshot(&coding_session_id)
        .ok_or_else(|| {
            problem_response(
                "session-artifacts-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Coding session projection was not found.",
            )
        })?;

    Ok(Json(create_list_envelope(
        "core-session-artifacts",
        snapshot.artifacts.clone(),
    )))
}

async fn core_session_checkpoints(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
) -> Result<
    Json<ApiListEnvelope<CodingSessionCheckpointPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let snapshot = state
        .projections
        .session_snapshot(&coding_session_id)
        .ok_or_else(|| {
            problem_response(
                "session-checkpoints-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Coding session projection was not found.",
            )
        })?;

    Ok(Json(create_list_envelope(
        "core-session-checkpoints",
        snapshot.checkpoints.clone(),
    )))
}

pub fn build_app() -> Router {
    build_app_with_state(AppState::demo())
}

pub fn build_app_from_sqlite_file(path: impl AsRef<FsPath>) -> Result<Router, String> {
    Ok(build_app_with_state(AppState::load(&AuthorityBootstrapConfig {
        sqlite_file: Some(path.as_ref().to_path_buf()),
        snapshot_file: None,
    })?))
}

pub fn build_app_from_env() -> Result<Router, String> {
    let bootstrap = resolve_authority_bootstrap()?;
    Ok(build_app_with_state(AppState::load(&bootstrap)?))
}

pub fn build_app_from_runtime_config() -> Result<Router, String> {
    build_app_from_env()
}

fn build_app_with_state(state: AppState) -> Router {
    Router::new()
        .route("/api/core/v1/descriptor", get(core_descriptor))
        .route("/api/core/v1/runtime", get(core_runtime))
        .route("/api/core/v1/health", get(core_health))
        .route(CODING_SERVER_OPENAPI_PATH, get(openapi_document))
        .route("/api/core/v1/engines", get(core_engines))
        .route(
            "/api/core/v1/engines/{engine_key}/capabilities",
            get(core_engine_capabilities),
        )
        .route("/api/core/v1/models", get(core_models))
        .route("/api/core/v1/coding-sessions", post(core_create_session))
        .route("/api/core/v1/coding-sessions/{id}", get(core_session))
        .route("/api/core/v1/coding-sessions/{id}/turns", post(core_create_turn))
        .route("/api/core/v1/coding-sessions/{id}/events", get(core_session_events))
        .route(
            "/api/core/v1/coding-sessions/{id}/artifacts",
            get(core_session_artifacts),
        )
        .route(
            "/api/core/v1/coding-sessions/{id}/checkpoints",
            get(core_session_checkpoints),
        )
        .route(
            "/api/core/v1/approvals/{approval_id}/decision",
            post(core_submit_approval_decision),
        )
        .route("/api/core/v1/operations/{operation_id}", get(core_operation))
        .route("/api/app/v1/workspaces", get(app_workspaces))
        .route("/api/app/v1/projects", get(app_projects))
        .route("/api/app/v1/documents", get(app_documents))
        .route("/api/app/v1/teams", get(app_teams))
        .route("/api/app/v1/deployments", get(app_deployments))
        .route("/api/admin/v1/audit", get(admin_audit))
        .route("/api/admin/v1/policies", get(admin_policies))
        .route("/api/admin/v1/teams", get(admin_teams))
        .route(
            "/api/admin/v1/projects/{project_id}/deployment-targets",
            get(admin_deployment_targets),
        )
        .route("/api/admin/v1/teams/{team_id}/members", get(admin_team_members))
        .route("/api/admin/v1/releases", get(admin_releases))
        .route("/api/admin/v1/deployments", get(admin_deployments))
        .layer(build_local_cors_layer())
        .with_state(state)
}

fn is_origin_with_optional_port(origin: &str, prefix: &str) -> bool {
    origin == prefix || origin.strip_prefix(prefix).is_some_and(|suffix| suffix.starts_with(':'))
}

fn is_allowed_default_browser_origin(origin: &str) -> bool {
    let normalized_origin = origin.trim().to_ascii_lowercase();

    normalized_origin == TAURI_LOCALHOST_ORIGIN
        || is_origin_with_optional_port(&normalized_origin, "http://127.0.0.1")
        || is_origin_with_optional_port(&normalized_origin, "https://127.0.0.1")
        || is_origin_with_optional_port(&normalized_origin, "http://localhost")
        || is_origin_with_optional_port(&normalized_origin, "https://localhost")
        || is_origin_with_optional_port(&normalized_origin, "http://[::1]")
        || is_origin_with_optional_port(&normalized_origin, "https://[::1]")
        || is_origin_with_optional_port(&normalized_origin, TAURI_WEBVIEW_HTTP_ORIGIN)
        || is_origin_with_optional_port(&normalized_origin, TAURI_WEBVIEW_HTTPS_ORIGIN)
}

fn parse_configured_allowed_browser_origins() -> Vec<String> {
    std::env::var(BIRDCODER_CODING_SERVER_ALLOWED_ORIGINS_ENV)
        .ok()
        .map(|value| {
            value
                .split([',', ';', '\n'])
                .map(|entry| entry.trim())
                .filter(|entry| !entry.is_empty())
                .map(|entry| entry.to_ascii_lowercase())
                .collect()
        })
        .unwrap_or_default()
}

fn build_local_cors_layer() -> CorsLayer {
    let configured_allowed_origins = parse_configured_allowed_browser_origins();

    CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([
            header::ACCEPT,
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
        ])
        .allow_origin(AllowOrigin::predicate(
            move |origin: &HeaderValue, _request_parts| {
                origin.to_str().ok().is_some_and(|origin_value| {
                    let normalized_origin = origin_value.trim().to_ascii_lowercase();
                    is_allowed_default_browser_origin(&normalized_origin)
                        || configured_allowed_origins
                            .iter()
                            .any(|allowed_origin| allowed_origin == &normalized_origin)
                })
            },
        ))
        .max_age(Duration::from_secs(60 * 10))
}

#[cfg(test)]
mod tests {
    use super::*;

    use std::{ffi::OsString, fs, path::PathBuf, sync::Mutex};

    use axum::{
        body::{to_bytes, Body},
        http::{Request, StatusCode},
    };
    use rusqlite::{params, Connection};
    use tower::ServiceExt;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    struct FakeCodexCliGuard {
        fixture_directory: PathBuf,
        original_path: Option<OsString>,
    }

    impl FakeCodexCliGuard {
        fn install(directory_name: &str, assistant_content: &str) -> Self {
            let fake_codex_path = write_fake_codex_cli_fixture(directory_name, assistant_content);
            let fixture_directory = fake_codex_path
                .parent()
                .expect("fake codex fixture directory")
                .to_path_buf();
            let original_path = std::env::var_os("PATH");
            let joined_path = match &original_path {
                Some(existing_path) => {
                    std::env::join_paths([fixture_directory.as_os_str(), existing_path])
                        .expect("join fake codex PATH")
                }
                None => std::env::join_paths([fixture_directory.as_os_str()])
                    .expect("create fake codex PATH"),
            };
            std::env::set_var("PATH", joined_path);

            Self {
                fixture_directory,
                original_path,
            }
        }

        fn project_root(&self) -> &FsPath {
            &self.fixture_directory
        }
    }

    impl Drop for FakeCodexCliGuard {
        fn drop(&mut self) {
            if let Some(path) = self.original_path.take() {
                std::env::set_var("PATH", path);
            } else {
                std::env::remove_var("PATH");
            }

            if self.fixture_directory.exists() {
                fs::remove_dir_all(&self.fixture_directory)
                    .expect("remove fake codex fixture directory");
            }
        }
    }

    fn override_project_root_path(state: &mut AppState, project_id: &str, root_path: &FsPath) {
        let project = state
            .projects
            .iter_mut()
            .find(|project| project.id == project_id)
            .expect("project exists for fake codex fixture");
        project.root_path = Some(root_path.display().to_string());
    }

    fn generated_engine_catalog_json() -> serde_json::Value {
        serde_json::from_str(include_str!("../generated/engine-catalog.json"))
            .expect("parse generated engine catalog fixture")
    }

    #[test]
    fn codex_cli_error_helpers_prioritize_authentication_failures() {
        let mut turn_error = None;

        update_codex_cli_turn_error(
            &mut turn_error,
            "Reconnecting... 2/5 (unexpected status 401 Unauthorized: Missing bearer or basic authentication in header)",
        );
        update_codex_cli_turn_error(
            &mut turn_error,
            "stream disconnected before completion: error sending request for url (https://api.openai.com/v1/responses)",
        );

        assert_eq!(
            format_codex_cli_error(turn_error.as_deref().expect("turn error")),
            "Codex CLI authentication is not configured. BirdCoder reuses your existing Codex auth from `CODEX_HOME` or `~/.codex`; if none is configured, set `OPENAI_API_KEY` or run `codex login --with-api-key`."
        );
    }

    #[test]
    fn codex_cli_error_helpers_preserve_non_authentication_failures() {
        let mut turn_error = None;

        update_codex_cli_turn_error(
            &mut turn_error,
            "stream disconnected before completion: error sending request for url (https://api.openai.com/v1/responses)",
        );
        update_codex_cli_turn_error(
            &mut turn_error,
            "Codex CLI turn failed.",
        );

        assert_eq!(
            format_codex_cli_error(turn_error.as_deref().expect("turn error")),
            "stream disconnected before completion: error sending request for url (https://api.openai.com/v1/responses)"
        );
    }

    fn write_snapshot_fixture(file_name: &str, body: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(file_name);
        fs::write(&path, body).expect("write snapshot fixture");
        path
    }

    fn write_fake_codex_cli_fixture(
        directory_name: &str,
        assistant_content: &str,
    ) -> std::path::PathBuf {
        let mut directory = std::env::temp_dir();
        directory.push(directory_name);

        if directory.exists() {
            fs::remove_dir_all(&directory).expect("remove existing fake codex fixture directory");
        }
        fs::create_dir_all(&directory).expect("create fake codex fixture directory");

        let script_name = if cfg!(windows) { "codex.cmd" } else { "codex" };
        let script_path = directory.join(script_name);
        let encoded_assistant_content =
            serde_json::to_string(assistant_content).expect("encode fake codex assistant content");

        let script_body = if cfg!(windows) {
            format!(
                "@echo off\r\n\
setlocal\r\n\
echo {{\"type\":\"thread.started\",\"thread_id\":\"fake-codex-thread\"}}\r\n\
echo {{\"type\":\"turn.started\"}}\r\n\
echo {{\"type\":\"item.completed\",\"item\":{{\"id\":\"fake-codex-message\",\"type\":\"agent_message\",\"text\":{encoded_assistant_content}}}}}\r\n\
echo {{\"type\":\"turn.completed\",\"usage\":{{\"input_tokens\":1,\"cached_input_tokens\":0,\"output_tokens\":1}}}}\r\n"
            )
        } else {
            format!(
                "#!/bin/sh\n\
printf '%s\\n' '{{\"type\":\"thread.started\",\"thread_id\":\"fake-codex-thread\"}}'\n\
printf '%s\\n' '{{\"type\":\"turn.started\"}}'\n\
printf '%s\\n' '{{\"type\":\"item.completed\",\"item\":{{\"id\":\"fake-codex-message\",\"type\":\"agent_message\",\"text\":{encoded_assistant_content}}}}}'\n\
printf '%s\\n' '{{\"type\":\"turn.completed\",\"usage\":{{\"input_tokens\":1,\"cached_input_tokens\":0,\"output_tokens\":1}}}}'\n"
            )
        };

        fs::write(&script_path, script_body).expect("write fake codex fixture script");

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let mut permissions = fs::metadata(&script_path)
                .expect("read fake codex fixture metadata")
                .permissions();
            permissions.set_mode(0o755);
            fs::set_permissions(&script_path, permissions)
                .expect("set fake codex fixture permissions");
        }

        script_path
    }

    fn write_sqlite_projection_fixture(file_name: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(file_name);

        if path.exists() {
            fs::remove_file(&path).expect("remove existing sqlite fixture");
        }

        let connection = Connection::open(&path).expect("open sqlite fixture");
        connection
            .execute_batch(
                r#"
                CREATE TABLE kv_store (
                    scope TEXT NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (scope, key)
                );
                "#,
            )
            .expect("create kv_store");

        for (scope, key, value) in [
            (
                "coding-session",
                "table.sqlite.coding-sessions.v1",
                r#"[{
                    "id":"sqlite-session",
                    "workspaceId":"workspace-sqlite",
                    "projectId":"project-sqlite",
                    "title":"SQLite authority session",
                    "status":"active",
                    "hostMode":"desktop",
                    "engineId":"claude-code",
                    "modelId":"claude-sonnet-4",
                    "createdAt":"2026-04-10T11:59:59Z",
                    "updatedAt":"2026-04-10T12:00:02Z",
                    "lastTurnAt":"2026-04-10T12:00:02Z"
                }]"#,
            ),
            (
                "coding-session",
                "table.sqlite.coding-session-events.sqlite-session.v1",
                r#"[{
                    "id":"sqlite-runtime:sqlite-turn:event:0",
                    "codingSessionId":"sqlite-session",
                    "turnId":"sqlite-turn",
                    "runtimeId":"sqlite-runtime",
                    "kind":"turn.completed",
                    "sequence":0,
                    "payload":{"engineId":"claude-code","runtimeStatus":"completed"},
                    "createdAt":"2026-04-10T12:00:00Z"
                }]"#,
            ),
            (
                "coding-session",
                "table.sqlite.coding-session-artifacts.sqlite-session.v1",
                r#"[{
                    "id":"sqlite-turn:artifact:1",
                    "codingSessionId":"sqlite-session",
                    "turnId":"sqlite-turn",
                    "kind":"patch",
                    "status":"sealed",
                    "title":"SQLite authority patch",
                    "metadata":{"sourceEngineId":"claude-code"},
                    "createdAt":"2026-04-10T12:00:01Z"
                }]"#,
            ),
            (
                "coding-session",
                "table.sqlite.coding-session-operations.sqlite-session.v1",
                r#"[{
                    "operationId":"sqlite-turn:operation",
                    "status":"succeeded",
                    "artifactRefs":["sqlite-turn:artifact:1"],
                    "streamUrl":"/api/core/v1/coding-sessions/sqlite-session/events",
                    "streamKind":"sse"
                }]"#,
            ),
            (
                "coding-session",
                "table.sqlite.coding-session-checkpoints.sqlite-session.v1",
                r#"[{
                    "id":"sqlite-checkpoint:1",
                    "codingSessionId":"sqlite-session",
                    "runtimeId":"sqlite-runtime",
                    "checkpointKind":"approval",
                    "resumable":true,
                    "state":{"approvalId":"approval-1","reason":"Need confirmation"},
                    "createdAt":"2026-04-10T12:00:03Z"
                }]"#,
            ),
            (
                "workspace",
                "table.sqlite.workspaces.v1",
                r#"[{
                    "id":"workspace-sqlite",
                    "name":"SQLite authority workspace",
                    "description":"Authority-backed app workspace list item",
                    "ownerIdentityId":"identity-sqlite-owner",
                    "status":"active"
                }]"#,
            ),
            (
                "workspace",
                "table.sqlite.projects.v1",
                r#"[{
                    "id":"project-sqlite",
                    "workspaceId":"workspace-sqlite",
                    "name":"SQLite authority project",
                    "description":"Authority-backed app project list item",
                    "rootPath":"E:/sdkwork/project-sqlite",
                    "status":"active"
                }]"#,
            ),
            (
                "project-documents",
                "table.sqlite.project-documents.v1",
                r#"[{
                    "id":"doc-sqlite-architecture",
                    "projectId":"project-sqlite",
                    "documentKind":"architecture",
                    "title":"SQLite authority architecture",
                    "slug":"sqlite-authority-architecture",
                    "status":"active",
                    "updatedAt":"2026-04-10T12:00:04Z"
                }]"#,
            ),
            (
                "deployment",
                "table.sqlite.deployment-targets.v1",
                r#"[{
                    "id":"target-sqlite-web",
                    "projectId":"project-sqlite",
                    "name":"SQLite authority target",
                    "environmentKey":"staging",
                    "runtime":"container",
                    "status":"active"
                }]"#,
            ),
            (
                "deployment",
                "table.sqlite.deployment-records.v1",
                r#"[{
                    "id":"deployment-sqlite",
                    "projectId":"project-sqlite",
                    "targetId":"target-sqlite-web",
                    "releaseRecordId":"release-0.2.0-sqlite",
                    "status":"succeeded",
                    "endpointUrl":"https://sqlite.sdkwork.dev",
                    "startedAt":"2026-04-10T12:00:04Z",
                    "completedAt":"2026-04-10T12:00:05Z"
                }]"#,
            ),
            (
                "collaboration",
                "table.sqlite.teams.v1",
                r#"[{
                    "id":"team-sqlite",
                    "workspaceId":"workspace-sqlite",
                    "name":"SQLite authority team",
                    "description":"Authority-backed admin team list item",
                    "status":"active"
                }]"#,
            ),
            (
                "collaboration",
                "table.sqlite.team-members.v1",
                r#"[{
                    "id":"member-sqlite-admin",
                    "teamId":"team-sqlite",
                    "identityId":"identity-sqlite-admin",
                    "role":"admin",
                    "status":"active"
                }]"#,
            ),
            (
                "governance",
                "table.sqlite.release-records.v1",
                r#"[{
                    "id":"release-0.2.0-sqlite",
                    "releaseVersion":"0.2.0-sqlite",
                    "releaseKind":"formal",
                    "rolloutStage":"general-availability",
                    "status":"ready"
                }]"#,
            ),
            (
                "governance",
                "table.sqlite.audit-events.v1",
                r#"[{
                    "id":"audit-sqlite-release",
                    "scopeType":"workspace",
                    "scopeId":"workspace-sqlite",
                    "eventType":"release.promoted",
                    "payload":{"actor":"release-bot","releaseVersion":"0.2.0-sqlite","rolloutStage":"general-availability"},
                    "createdAt":"2026-04-10T12:00:05Z"
                }]"#,
            ),
            (
                "governance",
                "table.sqlite.governance-policies.v1",
                r#"[{
                    "id":"policy-sqlite-terminal",
                    "scopeType":"workspace",
                    "scopeId":"workspace-sqlite",
                    "policyCategory":"terminal",
                    "targetType":"engine",
                    "targetId":"codex",
                    "approvalPolicy":"Restricted",
                    "rationale":"SQLite authority requires approval for codex terminal execution.",
                    "status":"active",
                    "updatedAt":"2026-04-10T12:00:06Z"
                }]"#,
            ),
        ] {
            connection
                .execute(
                    "INSERT INTO kv_store (scope, key, value) VALUES (?1, ?2, ?3)",
                    params![scope, key, value],
                )
                .expect("insert sqlite projection fixture");
        }

        path
    }

    fn write_empty_sqlite_fixture(file_name: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(file_name);

        if path.exists() {
            fs::remove_file(&path).expect("remove existing empty sqlite fixture");
        }

        Connection::open(&path).expect("open empty sqlite fixture");
        path
    }

    fn write_empty_sqlite_provider_authority_fixture(file_name: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(file_name);

        if path.exists() {
            fs::remove_file(&path).expect("remove existing empty sqlite provider fixture");
        }

        let connection = Connection::open(&path).expect("open empty sqlite provider fixture");
        connection
            .execute_batch(SQLITE_PROVIDER_AUTHORITY_SCHEMA)
            .expect("create empty sqlite provider authority schema");
        path
    }

    fn write_sqlite_provider_authority_fixture(file_name: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(file_name);

        if path.exists() {
            fs::remove_file(&path).expect("remove existing sqlite provider fixture");
        }

        let connection = Connection::open(&path).expect("open sqlite provider fixture");
        connection
            .execute_batch(
                r#"
                CREATE TABLE coding_sessions (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    workspace_id TEXT NOT NULL,
                    project_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    status TEXT NOT NULL,
                    entry_surface TEXT NOT NULL,
                    engine_id TEXT NOT NULL,
                    model_id TEXT NULL,
                    last_turn_at TEXT NULL
                );

                CREATE TABLE coding_session_runtimes (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    coding_session_id TEXT NOT NULL,
                    engine_id TEXT NOT NULL,
                    model_id TEXT NULL,
                    host_mode TEXT NOT NULL,
                    status TEXT NOT NULL,
                    transport_kind TEXT NOT NULL,
                    native_session_id TEXT NULL,
                    native_turn_container_id TEXT NULL,
                    capability_snapshot_json TEXT NOT NULL,
                    metadata_json TEXT NOT NULL
                );

                CREATE TABLE coding_session_turns (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    coding_session_id TEXT NOT NULL,
                    runtime_id TEXT NOT NULL,
                    request_kind TEXT NOT NULL,
                    status TEXT NOT NULL,
                    input_summary TEXT NOT NULL,
                    started_at TEXT NULL,
                    completed_at TEXT NULL
                );

                CREATE TABLE coding_session_events (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    coding_session_id TEXT NOT NULL,
                    turn_id TEXT NULL,
                    runtime_id TEXT NULL,
                    event_kind TEXT NOT NULL,
                    sequence_no INTEGER NOT NULL,
                    payload_json TEXT NOT NULL
                );

                CREATE TABLE coding_session_artifacts (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    coding_session_id TEXT NOT NULL,
                    turn_id TEXT NULL,
                    artifact_kind TEXT NOT NULL,
                    title TEXT NOT NULL,
                    blob_ref TEXT NULL,
                    metadata_json TEXT NOT NULL
                );

                CREATE TABLE coding_session_checkpoints (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    coding_session_id TEXT NOT NULL,
                    runtime_id TEXT NULL,
                    checkpoint_kind TEXT NOT NULL,
                    resumable INTEGER NOT NULL,
                    state_json TEXT NOT NULL
                );

                CREATE TABLE coding_session_operations (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    coding_session_id TEXT NOT NULL,
                    turn_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    stream_url TEXT NOT NULL,
                    stream_kind TEXT NOT NULL,
                    artifact_refs_json TEXT NOT NULL
                );

                CREATE TABLE workspaces (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    name TEXT NOT NULL,
                    description TEXT NULL,
                    owner_identity_id TEXT NULL,
                    status TEXT NOT NULL
                );

                CREATE TABLE projects (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    workspace_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NULL,
                    root_path TEXT NULL,
                    status TEXT NOT NULL
                );

                CREATE TABLE project_documents (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    project_id TEXT NOT NULL,
                    document_kind TEXT NOT NULL,
                    title TEXT NOT NULL,
                    slug TEXT NOT NULL,
                    status TEXT NOT NULL
                );

                CREATE TABLE deployment_targets (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    project_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    environment_key TEXT NOT NULL,
                    runtime TEXT NOT NULL,
                    status TEXT NOT NULL
                );

                CREATE TABLE deployment_records (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    project_id TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    release_record_id TEXT NULL,
                    status TEXT NOT NULL,
                    endpoint_url TEXT NULL,
                    started_at TEXT NULL,
                    completed_at TEXT NULL
                );

                CREATE TABLE teams (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    workspace_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT NULL,
                    status TEXT NOT NULL
                );

                CREATE TABLE team_members (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    team_id TEXT NOT NULL,
                    identity_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    status TEXT NOT NULL
                );

                CREATE TABLE release_records (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    release_version TEXT NOT NULL,
                    release_kind TEXT NOT NULL,
                    rollout_stage TEXT NOT NULL,
                    manifest_json TEXT NOT NULL,
                    status TEXT NOT NULL
                );

                CREATE TABLE audit_events (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    scope_type TEXT NOT NULL,
                    scope_id TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    payload_json TEXT NOT NULL
                );

                CREATE TABLE governance_policies (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    scope_type TEXT NOT NULL,
                    scope_id TEXT NOT NULL,
                    policy_category TEXT NOT NULL,
                    target_type TEXT NOT NULL,
                    target_id TEXT NOT NULL,
                    approval_policy TEXT NOT NULL,
                    rationale TEXT NULL,
                    status TEXT NOT NULL
                );
                "#,
            )
            .expect("create sqlite provider authority schema");

        connection
            .execute(
                r#"
                INSERT INTO coding_sessions (
                    id, created_at, updated_at, version, is_deleted, workspace_id, project_id, title, status, entry_surface, engine_id, model_id, last_turn_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                "#,
                params![
                    "provider-session",
                    "2026-04-10T13:00:00Z",
                    "2026-04-10T13:00:03Z",
                    0_i64,
                    0_i64,
                    "workspace-provider",
                    "project-provider",
                    "Provider authority session",
                    "active",
                    "code",
                    "codex",
                    "gpt-5-codex",
                    "2026-04-10T13:00:02Z",
                ],
            )
            .expect("insert provider session");

        connection
            .execute(
                r#"
                INSERT INTO coding_session_runtimes (
                    id, created_at, updated_at, version, is_deleted, coding_session_id, engine_id, model_id, host_mode, status, transport_kind, native_session_id, native_turn_container_id, capability_snapshot_json, metadata_json
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
                "#,
                params![
                    "provider-runtime",
                    "2026-04-10T13:00:00Z",
                    "2026-04-10T13:00:03Z",
                    0_i64,
                    0_i64,
                    "provider-session",
                    "codex",
                    "gpt-5-codex",
                    "server",
                    "completed",
                    "cli",
                    "native-provider-session",
                    "native-provider-turn-container",
                    r#"{"chat":true}"#,
                    r#"{"source":"provider"}"#,
                ],
            )
            .expect("insert provider runtime");

        connection
            .execute(
                r#"
                INSERT INTO coding_session_turns (
                    id, created_at, updated_at, version, is_deleted, coding_session_id, runtime_id, request_kind, status, input_summary, started_at, completed_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                "#,
                params![
                    "provider-turn",
                    "2026-04-10T13:00:01Z",
                    "2026-04-10T13:00:01Z",
                    0_i64,
                    0_i64,
                    "provider-session",
                    "provider-runtime",
                    "chat",
                    "completed",
                    "Provider authority seed turn",
                    "2026-04-10T13:00:01Z",
                    "2026-04-10T13:00:02Z",
                ],
            )
            .expect("insert provider turn");

        connection
            .execute(
                r#"
                INSERT INTO coding_session_events (
                    id, created_at, updated_at, version, is_deleted, coding_session_id, turn_id, runtime_id, event_kind, sequence_no, payload_json
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    "provider-runtime:provider-turn:event:0",
                    "2026-04-10T13:00:01Z",
                    "2026-04-10T13:00:01Z",
                    0_i64,
                    0_i64,
                    "provider-session",
                    "provider-turn",
                    "provider-runtime",
                    "turn.completed",
                    0_i64,
                    r#"{"engineId":"codex","runtimeStatus":"completed"}"#,
                ],
            )
            .expect("insert provider event");

        connection
            .execute(
                r#"
                INSERT INTO coding_session_artifacts (
                    id, created_at, updated_at, version, is_deleted, coding_session_id, turn_id, artifact_kind, title, blob_ref, metadata_json
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    "provider-turn:artifact:1",
                    "2026-04-10T13:00:02Z",
                    "2026-04-10T13:00:02Z",
                    0_i64,
                    0_i64,
                    "provider-session",
                    "provider-turn",
                    "patch",
                    "Provider authority patch",
                    "blob://provider/patch/1",
                    r#"{"sourceEngineId":"codex","status":"sealed"}"#,
                ],
            )
            .expect("insert provider artifact");

        connection
            .execute(
                r#"
                INSERT INTO coding_session_checkpoints (
                    id, created_at, updated_at, version, is_deleted, coding_session_id, runtime_id, checkpoint_kind, resumable, state_json
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    "provider-checkpoint:1",
                    "2026-04-10T13:00:03Z",
                    "2026-04-10T13:00:03Z",
                    0_i64,
                    0_i64,
                    "provider-session",
                    "provider-runtime",
                    "approval",
                    1_i64,
                    r#"{"approvalId":"provider-approval-1","reason":"Need confirmation"}"#,
                ],
            )
            .expect("insert provider checkpoint");

        connection
            .execute(
                r#"
                INSERT INTO coding_session_operations (
                    id, created_at, updated_at, version, is_deleted, coding_session_id, turn_id, status, stream_url, stream_kind, artifact_refs_json
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    "provider-turn:operation",
                    "2026-04-10T13:00:02Z",
                    "2026-04-10T13:00:02Z",
                    0_i64,
                    0_i64,
                    "provider-session",
                    "provider-turn",
                    "succeeded",
                    "/api/core/v1/coding-sessions/provider-session/events",
                    "sse",
                    r#"["provider-turn:artifact:1"]"#,
                ],
            )
            .expect("insert provider operation");

        connection
            .execute(
                r#"
                INSERT INTO workspaces (
                    id, created_at, updated_at, version, is_deleted, name, description, owner_identity_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    "workspace-provider",
                    "2026-04-10T13:00:00Z",
                    "2026-04-10T13:00:00Z",
                    0_i64,
                    0_i64,
                    "Provider authority workspace",
                    "Provider-backed app workspace list item",
                    "identity-provider-owner",
                    "active",
                ],
            )
            .expect("insert provider workspace");

        connection
            .execute(
                r#"
                INSERT INTO projects (
                    id, created_at, updated_at, version, is_deleted, workspace_id, name, description, root_path, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    "project-provider",
                    "2026-04-10T13:00:00Z",
                    "2026-04-10T13:00:00Z",
                    0_i64,
                    0_i64,
                    "workspace-provider",
                    "Provider authority project",
                    "Provider-backed app project list item",
                    "E:/sdkwork/project-provider",
                    "active",
                ],
            )
            .expect("insert provider project");

        connection
            .execute(
                r#"
                INSERT INTO project_documents (
                    id, created_at, updated_at, version, is_deleted, project_id, document_kind, title, slug, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    "doc-provider-architecture",
                    "2026-04-10T13:00:00Z",
                    "2026-04-10T13:00:01Z",
                    0_i64,
                    0_i64,
                    "project-provider",
                    "architecture",
                    "Provider authority architecture",
                    "provider-authority-architecture",
                    "active",
                ],
            )
            .expect("insert provider document");

        connection
            .execute(
                r#"
                INSERT INTO deployment_targets (
                    id, created_at, updated_at, version, is_deleted, project_id, name, environment_key, runtime, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    "target-provider-web",
                    "2026-04-10T13:00:01Z",
                    "2026-04-10T13:00:02Z",
                    0_i64,
                    0_i64,
                    "project-provider",
                    "Provider authority target",
                    "prod",
                    "kubernetes",
                    "active",
                ],
            )
            .expect("insert provider deployment target");

        connection
            .execute(
                r#"
                INSERT INTO deployment_records (
                    id, created_at, updated_at, version, is_deleted, project_id, target_id, release_record_id, status, endpoint_url, started_at, completed_at
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
                "#,
                params![
                    "deployment-provider",
                    "2026-04-10T13:00:01Z",
                    "2026-04-10T13:00:02Z",
                    0_i64,
                    0_i64,
                    "project-provider",
                    "target-provider-web",
                    "release-0.3.0-provider",
                    "succeeded",
                    "https://provider.sdkwork.dev",
                    "2026-04-10T13:00:01Z",
                    "2026-04-10T13:00:02Z",
                ],
            )
            .expect("insert provider deployment");

        connection
            .execute(
                r#"
                INSERT INTO teams (
                    id, created_at, updated_at, version, is_deleted, workspace_id, name, description, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    "team-provider",
                    "2026-04-10T13:00:00Z",
                    "2026-04-10T13:00:00Z",
                    0_i64,
                    0_i64,
                    "workspace-provider",
                    "Provider authority team",
                    "Provider-backed team list item",
                    "active",
                ],
            )
            .expect("insert provider team");

        connection
            .execute(
                r#"
                INSERT INTO team_members (
                    id, created_at, updated_at, version, is_deleted, team_id, identity_id, role, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    "member-provider-admin",
                    "2026-04-10T13:00:00Z",
                    "2026-04-10T13:00:00Z",
                    0_i64,
                    0_i64,
                    "team-provider",
                    "identity-provider-admin",
                    "admin",
                    "active",
                ],
            )
            .expect("insert provider team member");

        connection
            .execute(
                r#"
                INSERT INTO release_records (
                    id, created_at, updated_at, version, is_deleted, release_version, release_kind, rollout_stage, manifest_json, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    "release-0.3.0-provider",
                    "2026-04-10T13:00:00Z",
                    "2026-04-10T13:00:00Z",
                    0_i64,
                    0_i64,
                    "0.3.0-provider",
                    "formal",
                    "general-availability",
                    r#"{"source":"provider"}"#,
                    "ready",
                ],
            )
            .expect("insert provider release");

        connection
            .execute(
                r#"
                INSERT INTO audit_events (
                    id, created_at, updated_at, version, is_deleted, scope_type, scope_id, event_type, payload_json
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    "audit-provider-release",
                    "2026-04-10T13:00:04Z",
                    "2026-04-10T13:00:04Z",
                    0_i64,
                    0_i64,
                    "workspace",
                    "workspace-provider",
                    "release.promoted",
                    r#"{"actor":"release-bot","releaseVersion":"0.3.0-provider","rolloutStage":"general-availability"}"#,
                ],
            )
            .expect("insert provider audit");

        connection
            .execute(
                r#"
                INSERT INTO governance_policies (
                    id, created_at, updated_at, version, is_deleted, scope_type, scope_id, policy_category, target_type, target_id, approval_policy, rationale, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                "#,
                params![
                    "policy-provider-terminal",
                    "2026-04-10T13:00:05Z",
                    "2026-04-10T13:00:05Z",
                    0_i64,
                    0_i64,
                    "workspace",
                    "workspace-provider",
                    "terminal",
                    "engine",
                    "claude-code",
                    "OnRequest",
                    "Provider authority keeps terminal execution on-request for claude-code.",
                    "active",
                ],
            )
            .expect("insert provider policy");

        path
    }

    fn write_runtime_config_fixture(sqlite_path: &FsPath) -> std::path::PathBuf {
        let path = std::env::current_dir()
            .expect("resolve current dir")
            .join(BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME);
        let body = serde_json::json!({
            "authority": {
                "sqliteFile": sqlite_path.display().to_string(),
            }
        });
        fs::write(
            &path,
            serde_json::to_string_pretty(&body).expect("serialize runtime config fixture"),
        )
        .expect("write runtime config fixture");
        path
    }

    #[tokio::test]
    async fn core_health_route_returns_unified_json_envelope() {
        let response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/health")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("parse health response");

        assert_eq!(json["data"]["status"], "healthy");
        assert_eq!(json["meta"]["version"], CODING_SERVER_API_VERSION);
    }

    #[tokio::test]
    async fn descriptor_route_returns_coding_server_descriptor() {
        let response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/descriptor")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("parse descriptor response");

        assert_eq!(json["data"]["moduleId"], "coding-server");
        assert_eq!(json["data"]["openApiPath"], "/openapi/coding-server-v1.json");
        assert_eq!(json["data"]["surfaces"], serde_json::json!(["core", "app", "admin"]));
    }

    #[tokio::test]
    async fn representative_app_and_admin_real_list_routes_return_runtime_data() {
        let app_workspaces_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/workspaces")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_deployments_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/deployments")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_deployments_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/deployments")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_documents_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/documents")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_projects_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/projects")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_teams_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/teams")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_teams_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/teams")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_deployment_targets_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/projects/demo-project/deployment-targets")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_team_members_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/teams/demo-team/members")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_releases_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/releases")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_audit_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/audit")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_policies_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/policies")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(app_workspaces_response.status(), StatusCode::OK);
        assert_eq!(app_deployments_response.status(), StatusCode::OK);
        assert_eq!(app_documents_response.status(), StatusCode::OK);
        assert_eq!(app_projects_response.status(), StatusCode::OK);
        assert_eq!(app_teams_response.status(), StatusCode::OK);
        assert_eq!(admin_teams_response.status(), StatusCode::OK);
        assert_eq!(admin_deployment_targets_response.status(), StatusCode::OK);
        assert_eq!(admin_team_members_response.status(), StatusCode::OK);
        assert_eq!(admin_releases_response.status(), StatusCode::OK);
        assert_eq!(admin_audit_response.status(), StatusCode::OK);
        assert_eq!(admin_policies_response.status(), StatusCode::OK);
        assert_eq!(admin_deployments_response.status(), StatusCode::OK);

        let app_workspaces_body = to_bytes(app_workspaces_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_workspaces_json: serde_json::Value =
            serde_json::from_slice(&app_workspaces_body).expect("parse workspaces response");

        let app_documents_body = to_bytes(app_documents_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_documents_json: serde_json::Value =
            serde_json::from_slice(&app_documents_body).expect("parse documents response");

        let app_deployments_body = to_bytes(app_deployments_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_deployments_json: serde_json::Value =
            serde_json::from_slice(&app_deployments_body).expect("parse deployments response");

        let admin_deployments_body = to_bytes(admin_deployments_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_deployments_json: serde_json::Value =
            serde_json::from_slice(&admin_deployments_body)
                .expect("parse admin deployments response");

        let app_projects_body = to_bytes(app_projects_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_projects_json: serde_json::Value =
            serde_json::from_slice(&app_projects_body).expect("parse projects response");

        let app_teams_body = to_bytes(app_teams_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_teams_json: serde_json::Value =
            serde_json::from_slice(&app_teams_body).expect("parse app teams response");

        let admin_teams_body = to_bytes(admin_teams_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_teams_json: serde_json::Value =
            serde_json::from_slice(&admin_teams_body).expect("parse teams response");

        let admin_deployment_targets_body =
            to_bytes(admin_deployment_targets_response.into_body(), usize::MAX)
                .await
                .expect("read body");
        let admin_deployment_targets_json: serde_json::Value =
            serde_json::from_slice(&admin_deployment_targets_body)
                .expect("parse deployment targets response");

        let admin_team_members_body = to_bytes(admin_team_members_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_team_members_json: serde_json::Value =
            serde_json::from_slice(&admin_team_members_body)
                .expect("parse team members response");

        let admin_releases_body = to_bytes(admin_releases_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_releases_json: serde_json::Value =
            serde_json::from_slice(&admin_releases_body).expect("parse releases response");

        let admin_audit_body = to_bytes(admin_audit_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_audit_json: serde_json::Value =
            serde_json::from_slice(&admin_audit_body).expect("parse audit response");

        let admin_policies_body = to_bytes(admin_policies_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_policies_json: serde_json::Value =
            serde_json::from_slice(&admin_policies_body).expect("parse policies response");

        assert_eq!(app_workspaces_json["items"][0]["id"], "demo-workspace");
        assert_eq!(app_workspaces_json["items"][0]["name"], "Demo Workspace");
        assert_eq!(
            app_workspaces_json["items"][0]["ownerIdentityId"],
            "identity-demo-owner"
        );
        assert_eq!(app_workspaces_json["items"][0]["status"], "active");
        assert_eq!(app_deployments_json["items"][0]["id"], "deployment-demo");
        assert_eq!(app_deployments_json["items"][0]["projectId"], "demo-project");
        assert_eq!(app_deployments_json["items"][0]["targetId"], "target-demo-web");
        assert_eq!(app_deployments_json["items"][0]["status"], "succeeded");
        assert_eq!(admin_deployments_json["items"][0]["id"], "deployment-demo");
        assert_eq!(admin_deployments_json["items"][0]["projectId"], "demo-project");
        assert_eq!(admin_deployments_json["items"][0]["targetId"], "target-demo-web");
        assert_eq!(admin_deployments_json["items"][0]["status"], "succeeded");
        assert_eq!(app_documents_json["items"][0]["id"], "doc-architecture-demo");
        assert_eq!(app_documents_json["items"][0]["projectId"], "demo-project");
        assert_eq!(app_documents_json["items"][0]["documentKind"], "architecture");
        assert_eq!(app_projects_json["items"][0]["id"], "demo-project");
        assert_eq!(app_projects_json["items"][0]["workspaceId"], "demo-workspace");
        assert_eq!(app_teams_json["items"][0]["id"], "demo-team");
        assert_eq!(app_teams_json["items"][0]["workspaceId"], "demo-workspace");
        assert_eq!(admin_teams_json["items"][0]["id"], "demo-team");
        assert_eq!(admin_teams_json["items"][0]["workspaceId"], "demo-workspace");
        assert_eq!(admin_deployment_targets_json["items"][0]["id"], "target-demo-web");
        assert_eq!(
            admin_deployment_targets_json["items"][0]["projectId"],
            "demo-project"
        );
        assert_eq!(
            admin_deployment_targets_json["items"][0]["environmentKey"],
            "prod"
        );
        assert_eq!(admin_team_members_json["items"][0]["teamId"], "demo-team");
        assert_eq!(admin_team_members_json["items"][0]["role"], "owner");
        assert_eq!(admin_releases_json["items"][0]["id"], "release-0.1.0-demo");
        assert_eq!(admin_releases_json["items"][0]["releaseVersion"], "0.1.0-demo");
        assert_eq!(admin_audit_json["items"][0]["id"], "audit-demo-release");
        assert_eq!(admin_audit_json["items"][0]["scopeType"], "workspace");
        assert_eq!(admin_audit_json["items"][0]["scopeId"], "demo-workspace");
        assert_eq!(admin_audit_json["items"][0]["eventType"], "release.promoted");
        assert_eq!(admin_policies_json["items"][0]["id"], "policy-demo-terminal");
        assert_eq!(
            admin_policies_json["items"][0]["approvalPolicy"],
            "Restricted"
        );
        assert_eq!(admin_policies_json["items"][0]["targetId"], "codex");
    }

    #[tokio::test]
    async fn representative_workspace_route_returns_unified_runtime_list_envelope() {
        let response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/workspaces")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("parse list response");

        assert_eq!(json["items"][0]["id"], "demo-workspace");
        assert_eq!(json["items"][0]["name"], "Demo Workspace");
        assert_eq!(json["meta"]["page"], 1);
        assert_eq!(json["meta"]["pageSize"], 1);
        assert_eq!(json["meta"]["total"], 1);
        assert_eq!(json["meta"]["version"], CODING_SERVER_API_VERSION);
    }

    #[tokio::test]
    async fn core_engine_catalog_routes_return_runtime_data() {
        let engines_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/engines")
                    .body(Body::empty())
                    .expect("build engines request"),
            )
            .await
            .expect("serve engines request");
        let capabilities_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/engines/codex/capabilities")
                    .body(Body::empty())
                    .expect("build capabilities request"),
            )
            .await
            .expect("serve capabilities request");
        let models_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/models")
                    .body(Body::empty())
                    .expect("build models request"),
            )
            .await
            .expect("serve models request");

        assert_eq!(engines_response.status(), StatusCode::OK);
        assert_eq!(capabilities_response.status(), StatusCode::OK);
        assert_eq!(models_response.status(), StatusCode::OK);

        let engines_body = to_bytes(engines_response.into_body(), usize::MAX)
            .await
            .expect("read engines body");
        let capabilities_body = to_bytes(capabilities_response.into_body(), usize::MAX)
            .await
            .expect("read capabilities body");
        let models_body = to_bytes(models_response.into_body(), usize::MAX)
            .await
            .expect("read models body");

        let engines_json: serde_json::Value =
            serde_json::from_slice(&engines_body).expect("parse engines response");
        let capabilities_json: serde_json::Value =
            serde_json::from_slice(&capabilities_body).expect("parse capabilities response");
        let models_json: serde_json::Value =
            serde_json::from_slice(&models_body).expect("parse models response");

        assert_eq!(engines_json["items"][0]["engineKey"], "codex");
        assert_eq!(engines_json["items"][0]["capabilityMatrix"]["chat"], true);
        assert_eq!(capabilities_json["data"]["chat"], true);
        assert_eq!(capabilities_json["data"]["patchArtifacts"], true);
        assert_eq!(models_json["items"][0]["engineKey"], "codex");
        assert_eq!(models_json["items"][0]["defaultForEngine"], true);
        assert_eq!(models_json["meta"]["version"], CODING_SERVER_API_VERSION);
    }

    #[tokio::test]
    async fn core_engine_catalog_routes_match_generated_shared_engine_catalog() {
        let generated = generated_engine_catalog_json();

        let engines_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/engines")
                    .body(Body::empty())
                    .expect("build engines request"),
            )
            .await
            .expect("serve engines request");
        let models_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/models")
                    .body(Body::empty())
                    .expect("build models request"),
            )
            .await
            .expect("serve models request");

        assert_eq!(engines_response.status(), StatusCode::OK);
        assert_eq!(models_response.status(), StatusCode::OK);

        let engines_body = to_bytes(engines_response.into_body(), usize::MAX)
            .await
            .expect("read engines body");
        let models_body = to_bytes(models_response.into_body(), usize::MAX)
            .await
            .expect("read models body");

        let engines_json: serde_json::Value =
            serde_json::from_slice(&engines_body).expect("parse engines response");
        let models_json: serde_json::Value =
            serde_json::from_slice(&models_body).expect("parse models response");

        assert_eq!(engines_json["items"], generated["engines"]);
        assert_eq!(models_json["items"], generated["models"]);
        assert_eq!(engines_json["meta"]["version"], CODING_SERVER_API_VERSION);
        assert_eq!(models_json["meta"]["version"], CODING_SERVER_API_VERSION);

        for engine in generated["engines"]
            .as_array()
            .expect("generated engines array")
        {
            let engine_key = engine["engineKey"].as_str().expect("engine key");
            let capabilities_response = build_app()
                .oneshot(
                    Request::builder()
                        .uri(format!("/api/core/v1/engines/{engine_key}/capabilities"))
                        .body(Body::empty())
                        .expect("build capabilities request"),
                )
                .await
                .expect("serve capabilities request");

            assert_eq!(capabilities_response.status(), StatusCode::OK);

            let capabilities_body = to_bytes(capabilities_response.into_body(), usize::MAX)
                .await
                .expect("read capabilities body");
            let capabilities_json: serde_json::Value = serde_json::from_slice(&capabilities_body)
                .expect("parse capabilities response");

            assert_eq!(capabilities_json["data"], engine["capabilityMatrix"]);
            assert_eq!(capabilities_json["meta"]["version"], CODING_SERVER_API_VERSION);
        }
    }

    #[tokio::test]
    async fn core_engine_capabilities_route_returns_not_found_for_unknown_engine() {
        let response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/engines/missing-engine/capabilities")
                    .body(Body::empty())
                    .expect("build capabilities request"),
            )
            .await
            .expect("serve capabilities request");

        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read capabilities body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("parse capabilities response");

        assert_eq!(json["data"]["code"], "not_found");
        assert_eq!(json["meta"]["version"], CODING_SERVER_API_VERSION);
    }

    #[tokio::test]
    async fn projection_backed_core_read_routes_return_runtime_data() {
        let session_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/demo-coding-session")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(session_response.status(), StatusCode::OK);

        let session_body = to_bytes(session_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let session_json: serde_json::Value =
            serde_json::from_slice(&session_body).expect("parse session response");

        assert_eq!(session_json["data"]["id"], "demo-coding-session");
        assert_eq!(session_json["data"]["hostMode"], "server");
        assert_eq!(session_json["data"]["engineId"], "codex");
        assert_eq!(session_json["meta"]["version"], CODING_SERVER_API_VERSION);

        let operation_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/operations/demo-turn:operation")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(operation_response.status(), StatusCode::OK);

        let operation_body = to_bytes(operation_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let operation_json: serde_json::Value =
            serde_json::from_slice(&operation_body).expect("parse operation response");

        assert_eq!(operation_json["data"]["operationId"], "demo-turn:operation");
        assert_eq!(operation_json["data"]["status"], "running");
        assert_eq!(
            operation_json["data"]["streamUrl"],
            "/api/core/v1/coding-sessions/demo-coding-session/events"
        );
        assert_eq!(operation_json["meta"]["version"], CODING_SERVER_API_VERSION);

        let events_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/demo-coding-session/events")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(events_response.status(), StatusCode::OK);

        let events_body = to_bytes(events_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let events_json: serde_json::Value =
            serde_json::from_slice(&events_body).expect("parse events response");

        assert_eq!(events_json["items"][0]["kind"], "session.started");
        assert_eq!(events_json["items"][1]["kind"], "turn.started");
        assert_eq!(events_json["meta"]["total"], 3);
        assert_eq!(events_json["meta"]["version"], CODING_SERVER_API_VERSION);

        let artifacts_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/demo-coding-session/artifacts")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(artifacts_response.status(), StatusCode::OK);

        let artifacts_body = to_bytes(artifacts_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let artifacts_json: serde_json::Value =
            serde_json::from_slice(&artifacts_body).expect("parse artifacts response");

        assert_eq!(artifacts_json["items"][0]["kind"], "patch");
        assert_eq!(artifacts_json["items"][0]["status"], "sealed");
        assert_eq!(artifacts_json["meta"]["total"], 1);
        assert_eq!(artifacts_json["meta"]["version"], CODING_SERVER_API_VERSION);

        let checkpoints_response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/demo-coding-session/checkpoints")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(checkpoints_response.status(), StatusCode::OK);

        let checkpoints_body = to_bytes(checkpoints_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let checkpoints_json: serde_json::Value =
            serde_json::from_slice(&checkpoints_body).expect("parse checkpoints response");

        assert_eq!(checkpoints_json["items"][0]["checkpointKind"], "approval");
        assert_eq!(checkpoints_json["items"][0]["resumable"], true);
        assert_eq!(checkpoints_json["meta"]["total"], 1);
        assert_eq!(checkpoints_json["meta"]["version"], CODING_SERVER_API_VERSION);
    }

    #[tokio::test]
    async fn create_coding_session_route_returns_created_session_and_makes_projection_readable() {
        let app = build_app();
        let request_body = serde_json::json!({
            "workspaceId": "workspace-create",
            "projectId": "project-create",
            "title": "Create session route",
            "hostMode": "server",
            "engineId": "codex",
            "modelId": "gpt-5-codex",
        });

        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/core/v1/coding-sessions")
                    .header("content-type", "application/json")
                    .body(Body::from(request_body.to_string()))
                    .expect("build create coding session request"),
            )
            .await
            .expect("serve create coding session request");

        assert_eq!(create_response.status(), StatusCode::CREATED);

        let create_body = to_bytes(create_response.into_body(), usize::MAX)
            .await
            .expect("read create coding session body");
        let create_json: serde_json::Value =
            serde_json::from_slice(&create_body).expect("parse create coding session response");

        let created_session_id = create_json["data"]["id"]
            .as_str()
            .expect("created session id")
            .to_owned();
        assert!(created_session_id.starts_with("coding-session-"));
        assert_eq!(create_json["data"]["workspaceId"], "workspace-create");
        assert_eq!(create_json["data"]["projectId"], "project-create");
        assert_eq!(create_json["data"]["title"], "Create session route");
        assert_eq!(create_json["data"]["hostMode"], "server");
        assert_eq!(create_json["data"]["engineId"], "codex");
        assert_eq!(create_json["data"]["modelId"], "gpt-5-codex");
        assert_eq!(create_json["meta"]["version"], CODING_SERVER_API_VERSION);

        let read_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/core/v1/coding-sessions/{created_session_id}"))
                    .body(Body::empty())
                    .expect("build get coding session request"),
            )
            .await
            .expect("serve get coding session request");

        assert_eq!(read_response.status(), StatusCode::OK);

        let read_body = to_bytes(read_response.into_body(), usize::MAX)
            .await
            .expect("read get coding session body");
        let read_json: serde_json::Value =
            serde_json::from_slice(&read_body).expect("parse get coding session response");

        assert_eq!(read_json["data"]["id"], created_session_id);
        assert_eq!(read_json["data"]["workspaceId"], "workspace-create");
        assert_eq!(read_json["data"]["projectId"], "project-create");
        assert_eq!(read_json["data"]["hostMode"], "server");
        assert_eq!(read_json["data"]["engineId"], "codex");
        assert_eq!(read_json["data"]["modelId"], "gpt-5-codex");
    }

    #[tokio::test]
    async fn create_coding_session_route_persists_into_sqlite_provider_authority() {
        let sqlite_path = write_sqlite_provider_authority_fixture(
            "birdcoder-create-coding-session-provider-authority.sqlite",
        );
        let app = build_app_with_state(
            AppState::load(&AuthorityBootstrapConfig {
                sqlite_file: Some(sqlite_path.clone()),
                snapshot_file: None,
            })
            .expect("load provider-backed app state"),
        );
        let request_body = serde_json::json!({
            "workspaceId": "workspace-provider-created",
            "projectId": "project-provider-created",
            "title": "Provider-backed create session",
            "hostMode": "server",
            "engineId": "claude-code",
            "modelId": "claude-sonnet-4-20250514",
        });

        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/core/v1/coding-sessions")
                    .header("content-type", "application/json")
                    .body(Body::from(request_body.to_string()))
                    .expect("build provider create coding session request"),
            )
            .await
            .expect("serve provider create coding session request");

        assert_eq!(create_response.status(), StatusCode::CREATED);

        let create_body = to_bytes(create_response.into_body(), usize::MAX)
            .await
            .expect("read provider create coding session body");
        let create_json: serde_json::Value = serde_json::from_slice(&create_body)
            .expect("parse provider create coding session response");
        let created_session_id = create_json["data"]["id"]
            .as_str()
            .expect("provider created session id")
            .to_owned();

        let read_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/core/v1/coding-sessions/{created_session_id}"))
                    .body(Body::empty())
                    .expect("build provider get coding session request"),
            )
            .await
            .expect("serve provider get coding session request");

        assert_eq!(read_response.status(), StatusCode::OK);

        let connection = Connection::open(&sqlite_path).expect("open provider authority sqlite");
        let persisted_session: (String, String, String, String, Option<String>) = connection
            .query_row(
                r#"
                SELECT workspace_id, project_id, title, engine_id, model_id
                FROM coding_sessions
                WHERE id = ?1
                "#,
                params![created_session_id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                    ))
                },
            )
            .expect("read persisted coding session row");
        assert_eq!(persisted_session.0, "workspace-provider-created");
        assert_eq!(persisted_session.1, "project-provider-created");
        assert_eq!(persisted_session.2, "Provider-backed create session");
        assert_eq!(persisted_session.3, "claude-code");
        assert_eq!(
            persisted_session.4.as_deref(),
            Some("claude-sonnet-4-20250514")
        );

        let persisted_runtime: (String, String, String, String) = connection
            .query_row(
                r#"
                SELECT coding_session_id, engine_id, model_id, host_mode
                FROM coding_session_runtimes
                WHERE coding_session_id = ?1
                "#,
                params![create_json["data"]["id"].as_str().expect("created session id")],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("read persisted coding session runtime row");
        assert_eq!(persisted_runtime.0, create_json["data"]["id"]);
        assert_eq!(persisted_runtime.1, "claude-code");
        assert_eq!(persisted_runtime.2, "claude-sonnet-4-20250514");
        assert_eq!(persisted_runtime.3, "server");

        drop(connection);
        fs::remove_file(sqlite_path).expect("remove provider authority fixture");
    }

    #[tokio::test]
    async fn create_coding_session_turn_route_returns_created_turn_and_makes_projection_readable() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let fake_codex = FakeCodexCliGuard::install(
            "birdcoder-fake-codex-cli-demo-create-turn",
            "Codex CLI executed for the demo create-turn route.",
        );
        let mut state = AppState::demo();
        override_project_root_path(&mut state, "demo-project", fake_codex.project_root());
        let app = build_app_with_state(state);
        let request_body = serde_json::json!({
            "requestKind": "chat",
            "inputSummary": "Implement terminal command palette",
        });

        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/core/v1/coding-sessions/demo-coding-session/turns")
                    .header("content-type", "application/json")
                    .body(Body::from(request_body.to_string()))
                    .expect("build create coding session turn request"),
            )
            .await
            .expect("serve create coding session turn request");

        assert_eq!(create_response.status(), StatusCode::CREATED);

        let create_body = to_bytes(create_response.into_body(), usize::MAX)
            .await
            .expect("read create coding session turn body");
        let create_json: serde_json::Value =
            serde_json::from_slice(&create_body).expect("parse create coding session turn response");

        let created_turn_id = create_json["data"]["id"]
            .as_str()
            .expect("created turn id")
            .to_owned();
        let created_operation_id = format!("{created_turn_id}:operation");

        assert!(created_turn_id.starts_with("coding-turn-"));
        assert_eq!(create_json["data"]["codingSessionId"], "demo-coding-session");
        assert_eq!(create_json["data"]["runtimeId"], "demo-runtime");
        assert_eq!(create_json["data"]["requestKind"], "chat");
        assert_eq!(create_json["data"]["status"], "completed");
        assert_eq!(
            create_json["data"]["inputSummary"],
            "Implement terminal command palette"
        );
        assert!(create_json["data"]["startedAt"].is_string());
        assert!(create_json["data"]["completedAt"].is_string());
        assert_eq!(create_json["meta"]["version"], CODING_SERVER_API_VERSION);

        let session_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/demo-coding-session")
                    .body(Body::empty())
                    .expect("build get coding session request"),
            )
            .await
            .expect("serve get coding session request");
        assert_eq!(session_response.status(), StatusCode::OK);

        let session_body = to_bytes(session_response.into_body(), usize::MAX)
            .await
            .expect("read get coding session body");
        let session_json: serde_json::Value =
            serde_json::from_slice(&session_body).expect("parse get coding session response");
        assert_eq!(
            session_json["data"]["lastTurnAt"],
            create_json["data"]["completedAt"]
        );

        let operation_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(format!("/api/core/v1/operations/{created_operation_id}"))
                    .body(Body::empty())
                    .expect("build get operation request"),
            )
            .await
            .expect("serve get operation request");

        assert_eq!(operation_response.status(), StatusCode::OK);

        let operation_body = to_bytes(operation_response.into_body(), usize::MAX)
            .await
            .expect("read get operation body");
        let operation_json: serde_json::Value =
            serde_json::from_slice(&operation_body).expect("parse get operation response");

        assert_eq!(operation_json["data"]["operationId"], created_operation_id);
        assert_eq!(operation_json["data"]["status"], "succeeded");
        assert_eq!(
            operation_json["data"]["streamUrl"],
            "/api/core/v1/coding-sessions/demo-coding-session/events"
        );
        assert_eq!(operation_json["data"]["streamKind"], "sse");
        assert_eq!(operation_json["data"]["artifactRefs"], serde_json::json!([]));

        let events_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/demo-coding-session/events")
                    .body(Body::empty())
                    .expect("build get coding session events request"),
            )
            .await
            .expect("serve get coding session events request");

        assert_eq!(events_response.status(), StatusCode::OK);

        let events_body = to_bytes(events_response.into_body(), usize::MAX)
            .await
            .expect("read get coding session events body");
        let events_json: serde_json::Value =
            serde_json::from_slice(&events_body).expect("parse get coding session events response");

        let created_events = events_json["items"]
            .as_array()
            .expect("events items")
            .iter()
            .filter(|event| event["turnId"] == created_turn_id)
            .collect::<Vec<_>>();
        assert_eq!(created_events.len(), 4);
        assert_eq!(created_events[0]["turnId"], created_turn_id);
        assert_eq!(created_events[0]["runtimeId"], "demo-runtime");
        assert_eq!(created_events[0]["kind"], "turn.started");
        assert_eq!(
            created_events[0]["payload"]["requestKind"],
            serde_json::json!("chat")
        );
        assert_eq!(
            created_events[0]["payload"]["inputSummary"],
            serde_json::json!("Implement terminal command palette")
        );
        assert_eq!(created_events[1]["kind"], "message.completed");
        assert_eq!(
            created_events[1]["payload"]["content"],
            "Codex CLI executed for the demo create-turn route."
        );
        assert_eq!(created_events[2]["kind"], "operation.updated");
        assert_eq!(created_events[2]["payload"]["status"], "succeeded");
        assert_eq!(created_events[3]["kind"], "turn.completed");
        assert_eq!(created_events[3]["payload"]["finishReason"], "stop");
    }

    #[tokio::test]
    async fn create_coding_session_turn_route_executes_codex_cli_for_codex_sessions() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let fake_codex = FakeCodexCliGuard::install(
            "birdcoder-fake-codex-cli",
            "Codex CLI executed from the local server bridge.",
        );
        let mut state = AppState::demo();
        override_project_root_path(&mut state, "demo-project", fake_codex.project_root());
        let app = build_app_with_state(state);
        let request_body = serde_json::json!({
            "requestKind": "chat",
            "inputSummary": "Use the real Codex CLI lane.",
        });

        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/core/v1/coding-sessions/demo-coding-session/turns")
                    .header("content-type", "application/json")
                    .body(Body::from(request_body.to_string()))
                    .expect("build create coding session turn request"),
            )
            .await
            .expect("serve create coding session turn request");

        assert_eq!(create_response.status(), StatusCode::CREATED);

        let create_body = to_bytes(create_response.into_body(), usize::MAX)
            .await
            .expect("read create coding session turn body");
        let create_json: serde_json::Value =
            serde_json::from_slice(&create_body).expect("parse create coding session turn response");
        let created_turn_id = create_json["data"]["id"]
            .as_str()
            .expect("created turn id")
            .to_owned();

        let events_response = app
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/demo-coding-session/events")
                    .body(Body::empty())
                    .expect("build get coding session events request"),
            )
            .await
            .expect("serve get coding session events request");
        let events_body = to_bytes(events_response.into_body(), usize::MAX)
            .await
            .expect("read get coding session events body");
        let events_json: serde_json::Value =
            serde_json::from_slice(&events_body).expect("parse get coding session events response");
        let created_events = events_json["items"]
            .as_array()
            .expect("events items")
            .iter()
            .filter(|event| event["turnId"] == created_turn_id)
            .collect::<Vec<_>>();

        assert_eq!(created_events[1]["kind"], "message.completed");
        assert_eq!(
            created_events[1]["payload"]["content"],
            "Codex CLI executed from the local server bridge."
        );
        assert_ne!(
            created_events[1]["payload"]["content"],
            "Completed chat request: Use the real Codex CLI lane."
        );
    }

    #[tokio::test]
    async fn create_coding_session_turn_route_returns_not_found_for_missing_session() {
        let request_body = serde_json::json!({
            "requestKind": "chat",
            "inputSummary": "Explain missing authority",
        });

        let response = build_app()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/core/v1/coding-sessions/missing-session/turns")
                    .header("content-type", "application/json")
                    .body(Body::from(request_body.to_string()))
                    .expect("build missing session turn request"),
            )
            .await
            .expect("serve missing session turn request");

        assert_eq!(response.status(), StatusCode::NOT_FOUND);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read missing session turn body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("parse missing session turn response");

        assert_eq!(json["data"]["code"], "not_found");
        assert_eq!(json["meta"]["version"], CODING_SERVER_API_VERSION);
    }

    #[tokio::test]
    async fn create_coding_session_turn_route_persists_into_sqlite_provider_authority() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let fake_codex = FakeCodexCliGuard::install(
            "birdcoder-fake-codex-cli-provider-create-turn",
            "Codex CLI executed for the provider-backed create-turn route.",
        );
        let sqlite_path =
            write_sqlite_provider_authority_fixture("birdcoder-create-coding-session-turn.sqlite");
        let mut state = AppState::load(&AuthorityBootstrapConfig {
                sqlite_file: Some(sqlite_path.clone()),
                snapshot_file: None,
            })
            .expect("load provider-backed app state");
        override_project_root_path(&mut state, "project-provider", fake_codex.project_root());
        let app = build_app_with_state(state);
        let request_body = serde_json::json!({
            "requestKind": "review",
            "inputSummary": "Review unified app/admin facade parity",
        });

        let create_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/core/v1/coding-sessions/provider-session/turns")
                    .header("content-type", "application/json")
                    .body(Body::from(request_body.to_string()))
                    .expect("build provider create coding session turn request"),
            )
            .await
            .expect("serve provider create coding session turn request");

        assert_eq!(create_response.status(), StatusCode::CREATED);

        let create_body = to_bytes(create_response.into_body(), usize::MAX)
            .await
            .expect("read provider create coding session turn body");
        let create_json: serde_json::Value = serde_json::from_slice(&create_body)
            .expect("parse provider create coding session turn response");
        let created_turn_id = create_json["data"]["id"]
            .as_str()
            .expect("provider created turn id")
            .to_owned();

        let events_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/provider-session/events")
                    .body(Body::empty())
                    .expect("build provider events request"),
            )
            .await
            .expect("serve provider events request");
        assert_eq!(events_response.status(), StatusCode::OK);

        let connection = Connection::open(&sqlite_path).expect("open provider authority sqlite");
        let persisted_turn: (String, String, String, String, String, Option<String>) = connection
            .query_row(
                r#"
                SELECT coding_session_id, runtime_id, request_kind, status, input_summary, completed_at
                FROM coding_session_turns
                WHERE id = ?1
                "#,
                params![created_turn_id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                },
            )
            .expect("read persisted coding session turn row");
        assert_eq!(persisted_turn.0, "provider-session");
        assert_eq!(persisted_turn.1, "provider-runtime");
        assert_eq!(persisted_turn.2, "review");
        assert_eq!(persisted_turn.3, "completed");
        assert_eq!(persisted_turn.4, "Review unified app/admin facade parity");
        assert_eq!(
            persisted_turn.5.as_deref(),
            create_json["data"]["completedAt"].as_str()
        );

        let persisted_operation: (String, String, String, String) = connection
            .query_row(
                r#"
                SELECT coding_session_id, turn_id, status, stream_url
                FROM coding_session_operations
                WHERE turn_id = ?1
                "#,
                params![created_turn_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("read persisted coding session operation row");
        assert_eq!(persisted_operation.0, "provider-session");
        assert_eq!(persisted_operation.1, created_turn_id);
        assert_eq!(persisted_operation.2, "succeeded");
        assert_eq!(
            persisted_operation.3,
            "/api/core/v1/coding-sessions/provider-session/events"
        );

        let persisted_event: (String, String, String, String) = connection
            .query_row(
                r#"
                SELECT turn_id, runtime_id, event_kind, payload_json
                FROM coding_session_events
                WHERE turn_id = ?1
                ORDER BY sequence_no DESC
                LIMIT 1
                "#,
                params![created_turn_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("read persisted coding session event row");
        assert_eq!(persisted_event.0, created_turn_id);
        assert_eq!(persisted_event.1, "provider-runtime");
        assert_eq!(persisted_event.2, "turn.completed");
        assert!(persisted_event.3.contains("\"finishReason\":\"stop\""));

        let persisted_session: (String, Option<String>) = connection
            .query_row(
                r#"
                SELECT updated_at, last_turn_at
                FROM coding_sessions
                WHERE id = 'provider-session'
                "#,
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("read persisted updated coding session row");
        assert_eq!(
            persisted_session.1.as_deref(),
            create_json["data"]["completedAt"].as_str()
        );
        assert_eq!(persisted_session.0, create_json["data"]["completedAt"]);

        drop(connection);
        fs::remove_file(sqlite_path).expect("remove provider authority fixture");
    }

    #[tokio::test]
    async fn submit_approval_decision_route_updates_demo_projection_authority() {
        let app = build_app();
        let request_body = serde_json::json!({
            "decision": "approved",
            "reason": "Looks safe",
        });

        let approval_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/core/v1/approvals/demo-approval-1/decision")
                    .header("content-type", "application/json")
                    .body(Body::from(request_body.to_string()))
                    .expect("build submit approval decision request"),
            )
            .await
            .expect("serve submit approval decision request");

        assert_eq!(approval_response.status(), StatusCode::OK);

        let approval_body = to_bytes(approval_response.into_body(), usize::MAX)
            .await
            .expect("read submit approval decision body");
        let approval_json: serde_json::Value = serde_json::from_slice(&approval_body)
            .expect("parse submit approval decision response");

        assert_eq!(approval_json["data"]["approvalId"], "demo-approval-1");
        assert_eq!(approval_json["data"]["checkpointId"], "demo-checkpoint:1");
        assert_eq!(approval_json["data"]["codingSessionId"], "demo-coding-session");
        assert_eq!(approval_json["data"]["runtimeId"], "demo-runtime");
        assert_eq!(approval_json["data"]["turnId"], "demo-turn");
        assert_eq!(approval_json["data"]["operationId"], "demo-turn:operation");
        assert_eq!(approval_json["data"]["decision"], "approved");
        assert_eq!(approval_json["data"]["reason"], "Looks safe");
        assert_eq!(approval_json["data"]["runtimeStatus"], "awaiting_tool");
        assert_eq!(approval_json["data"]["operationStatus"], "running");
        assert_eq!(approval_json["meta"]["version"], CODING_SERVER_API_VERSION);

        let checkpoints_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/demo-coding-session/checkpoints")
                    .body(Body::empty())
                    .expect("build checkpoints request"),
            )
            .await
            .expect("serve checkpoints request");

        assert_eq!(checkpoints_response.status(), StatusCode::OK);

        let checkpoints_body = to_bytes(checkpoints_response.into_body(), usize::MAX)
            .await
            .expect("read checkpoints body");
        let checkpoints_json: serde_json::Value = serde_json::from_slice(&checkpoints_body)
            .expect("parse checkpoints response");

        assert_eq!(checkpoints_json["items"][0]["resumable"], false);
        assert_eq!(checkpoints_json["items"][0]["state"]["approvalId"], "demo-approval-1");
        assert_eq!(checkpoints_json["items"][0]["state"]["decision"], "approved");
        assert_eq!(
            checkpoints_json["items"][0]["state"]["decisionReason"],
            "Looks safe"
        );
        assert_eq!(checkpoints_json["items"][0]["state"]["turnId"], "demo-turn");
        assert_eq!(
            checkpoints_json["items"][0]["state"]["operationId"],
            "demo-turn:operation"
        );

        let events_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/demo-coding-session/events")
                    .body(Body::empty())
                    .expect("build events request"),
            )
            .await
            .expect("serve events request");

        assert_eq!(events_response.status(), StatusCode::OK);

        let events_body = to_bytes(events_response.into_body(), usize::MAX)
            .await
            .expect("read events body");
        let events_json: serde_json::Value =
            serde_json::from_slice(&events_body).expect("parse events response");

        assert_eq!(events_json["meta"]["total"], 4);
        assert_eq!(events_json["items"][3]["kind"], "operation.updated");
        assert_eq!(events_json["items"][3]["payload"]["approvalDecision"], "approved");
        assert_eq!(events_json["items"][3]["payload"]["runtimeStatus"], "awaiting_tool");
        assert_eq!(events_json["items"][3]["payload"]["operationStatus"], "running");

        let operation_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/operations/demo-turn:operation")
                    .body(Body::empty())
                    .expect("build operation request"),
            )
            .await
            .expect("serve operation request");

        assert_eq!(operation_response.status(), StatusCode::OK);

        let operation_body = to_bytes(operation_response.into_body(), usize::MAX)
            .await
            .expect("read operation body");
        let operation_json: serde_json::Value = serde_json::from_slice(&operation_body)
            .expect("parse operation response");

        assert_eq!(operation_json["data"]["status"], "running");
    }

    #[tokio::test]
    async fn submit_approval_decision_route_persists_into_sqlite_provider_authority() {
        let sqlite_path = write_sqlite_provider_authority_fixture(
            "birdcoder-submit-approval-provider-authority.sqlite",
        );
        let app = build_app_with_state(
            AppState::load(&AuthorityBootstrapConfig {
                sqlite_file: Some(sqlite_path.clone()),
                snapshot_file: None,
            })
            .expect("load provider-backed app state"),
        );
        let request_body = serde_json::json!({
            "decision": "denied",
            "reason": "Unsafe patch",
        });

        let approval_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/core/v1/approvals/provider-approval-1/decision")
                    .header("content-type", "application/json")
                    .body(Body::from(request_body.to_string()))
                    .expect("build provider submit approval request"),
            )
            .await
            .expect("serve provider submit approval request");

        assert_eq!(approval_response.status(), StatusCode::OK);

        let approval_body = to_bytes(approval_response.into_body(), usize::MAX)
            .await
            .expect("read provider submit approval body");
        let approval_json: serde_json::Value = serde_json::from_slice(&approval_body)
            .expect("parse provider submit approval response");

        assert_eq!(approval_json["data"]["approvalId"], "provider-approval-1");
        assert_eq!(approval_json["data"]["codingSessionId"], "provider-session");
        assert_eq!(approval_json["data"]["checkpointId"], "provider-checkpoint:1");
        assert_eq!(approval_json["data"]["runtimeId"], "provider-runtime");
        assert_eq!(approval_json["data"]["turnId"], "provider-turn");
        assert_eq!(approval_json["data"]["operationId"], "provider-turn:operation");
        assert_eq!(approval_json["data"]["decision"], "denied");
        assert_eq!(approval_json["data"]["reason"], "Unsafe patch");
        assert_eq!(approval_json["data"]["runtimeStatus"], "failed");
        assert_eq!(approval_json["data"]["operationStatus"], "failed");

        let connection = Connection::open(&sqlite_path).expect("open provider approval sqlite");
        let persisted_checkpoint: (i64, String) = connection
            .query_row(
                r#"
                SELECT resumable, state_json
                FROM coding_session_checkpoints
                WHERE id = ?1
                "#,
                params!["provider-checkpoint:1"],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("query persisted checkpoint");
        let persisted_checkpoint_state: serde_json::Value =
            serde_json::from_str(&persisted_checkpoint.1).expect("parse persisted checkpoint state");

        assert_eq!(persisted_checkpoint.0, 0);
        assert_eq!(persisted_checkpoint_state["approvalId"], "provider-approval-1");
        assert_eq!(persisted_checkpoint_state["decision"], "denied");
        assert_eq!(persisted_checkpoint_state["decisionReason"], "Unsafe patch");
        assert_eq!(persisted_checkpoint_state["turnId"], "provider-turn");
        assert_eq!(
            persisted_checkpoint_state["operationId"],
            "provider-turn:operation"
        );

        let persisted_operation_status: String = connection
            .query_row(
                "SELECT status FROM coding_session_operations WHERE id = ?1",
                params!["provider-turn:operation"],
                |row| row.get(0),
            )
            .expect("query persisted operation status");
        let persisted_turn_status: String = connection
            .query_row(
                "SELECT status FROM coding_session_turns WHERE id = ?1",
                params!["provider-turn"],
                |row| row.get(0),
            )
            .expect("query persisted turn status");
        let persisted_runtime_status: String = connection
            .query_row(
                "SELECT status FROM coding_session_runtimes WHERE id = ?1",
                params!["provider-runtime"],
                |row| row.get(0),
            )
            .expect("query persisted runtime status");

        assert_eq!(persisted_operation_status, "failed");
        assert_eq!(persisted_turn_status, "failed");
        assert_eq!(persisted_runtime_status, "failed");

        drop(connection);
        fs::remove_file(sqlite_path).expect("remove provider approval authority fixture");
    }

    #[tokio::test]
    async fn missing_projection_read_routes_return_unified_not_found_problem() {
        for route in [
            "/api/core/v1/coding-sessions/missing-session",
            "/api/core/v1/operations/missing-operation",
            "/api/core/v1/coding-sessions/missing-session/events",
            "/api/core/v1/coding-sessions/missing-session/artifacts",
            "/api/core/v1/coding-sessions/missing-session/checkpoints",
        ] {
            let response = build_app()
                .oneshot(
                    Request::builder()
                        .uri(route)
                        .body(Body::empty())
                        .expect("build request"),
                )
                .await
                .expect("serve request");

            assert_eq!(response.status(), StatusCode::NOT_FOUND);

            let body = to_bytes(response.into_body(), usize::MAX)
                .await
                .expect("read body");
            let json: serde_json::Value =
                serde_json::from_slice(&body).expect("parse missing response");

            assert_eq!(json["data"]["code"], "not_found");
            assert_eq!(json["meta"]["version"], CODING_SERVER_API_VERSION);
        }
    }

    #[tokio::test]
    async fn build_app_loads_projection_state_from_snapshot_file_when_configured() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let snapshot_path = write_snapshot_fixture(
            "birdcoder-coding-server-snapshot.json",
            r#"{
  "sessions": {
    "env-session": {
      "operation": {
        "operationId": "env-turn:operation",
        "status": "succeeded",
        "artifactRefs": ["env-turn:artifact:1"],
        "streamUrl": "/api/core/v1/coding-sessions/env-session/events",
        "streamKind": "sse"
      },
      "events": [
        {
          "id": "env-runtime:env-turn:event:0",
          "codingSessionId": "env-session",
          "turnId": "env-turn",
          "runtimeId": "env-runtime",
          "kind": "turn.completed",
          "sequence": 0,
          "payload": {
            "engineId": "gemini",
            "runtimeStatus": "completed"
          },
          "createdAt": "2026-04-10T10:00:00Z"
        }
      ],
      "artifacts": [
        {
          "id": "env-turn:artifact:1",
          "codingSessionId": "env-session",
          "turnId": "env-turn",
          "kind": "structured-output",
          "status": "sealed",
          "title": "Snapshot structured output",
          "metadata": {
            "sourceEngineId": "gemini"
          },
          "createdAt": "2026-04-10T10:00:01Z"
        }
      ]
    }
  }
}"#,
        );

        std::env::set_var(
            "BIRDCODER_CODING_SERVER_SNAPSHOT_FILE",
            snapshot_path.as_os_str(),
        );

        let response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/operations/env-turn:operation")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        std::env::remove_var("BIRDCODER_CODING_SERVER_SNAPSHOT_FILE");
        fs::remove_file(snapshot_path).expect("remove snapshot fixture");

        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("parse operation response");

        assert_eq!(json["data"]["operationId"], "env-turn:operation");
        assert_eq!(json["data"]["status"], "succeeded");
    }

    #[tokio::test]
    async fn build_app_loads_projection_state_from_sqlite_kv_store_when_configured() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let sqlite_path = write_sqlite_projection_fixture("birdcoder-coding-server.sqlite3");
        let initial_connection = Connection::open(&sqlite_path).expect("open sqlite legacy fixture");
        assert!(
            !sqlite_table_exists(&initial_connection, PROVIDER_CODING_SESSIONS_TABLE)
                .expect("probe initial provider tables"),
            "legacy kv_store fixture should not start with direct provider tables"
        );
        drop(initial_connection);

        std::env::set_var(
            "BIRDCODER_CODING_SERVER_SQLITE_FILE",
            sqlite_path.as_os_str(),
        );

        let operation_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/operations/sqlite-turn:operation")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let session_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/sqlite-session")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let events_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/sqlite-session/events")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let checkpoints_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/sqlite-session/checkpoints")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_workspaces_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/workspaces")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_deployments_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/deployments")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_deployments_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/deployments")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_projects_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/projects")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_documents_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/documents")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_teams_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/teams")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_teams_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/teams")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_deployment_targets_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/projects/project-sqlite/deployment-targets")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_team_members_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/teams/team-sqlite/members")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_releases_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/releases")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_audit_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/audit")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_policies_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/policies")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let migrated_connection =
            Connection::open(&sqlite_path).expect("open sqlite migrated authority fixture");
        assert!(
            sqlite_table_exists(&migrated_connection, PROVIDER_CODING_SESSIONS_TABLE)
                .expect("probe migrated coding_sessions"),
            "legacy kv_store authority should be materialized into coding_sessions"
        );
        assert!(
            sqlite_table_exists(&migrated_connection, PROVIDER_CODING_SESSION_RUNTIMES_TABLE)
                .expect("probe migrated coding_session_runtimes"),
            "legacy kv_store authority should be materialized into coding_session_runtimes"
        );
        assert!(
            sqlite_table_exists(&migrated_connection, PROVIDER_WORKSPACES_TABLE)
                .expect("probe migrated workspaces"),
            "legacy kv_store authority should be materialized into workspaces"
        );
        assert!(
            sqlite_table_exists(&migrated_connection, PROVIDER_PROJECTS_TABLE)
                .expect("probe migrated projects"),
            "legacy kv_store authority should be materialized into projects"
        );
        assert!(
            sqlite_table_exists(&migrated_connection, "project_documents")
                .expect("probe migrated project_documents"),
            "legacy kv_store authority should be materialized into project_documents"
        );
        assert!(
            sqlite_table_exists(&migrated_connection, "deployment_targets")
                .expect("probe migrated deployment_targets"),
            "legacy kv_store authority should be materialized into deployment_targets"
        );
        assert!(
            sqlite_table_exists(&migrated_connection, PROVIDER_DEPLOYMENT_RECORDS_TABLE)
                .expect("probe migrated deployment_records"),
            "legacy kv_store authority should be materialized into deployment_records"
        );
        assert!(
            sqlite_table_exists(&migrated_connection, PROVIDER_AUDIT_EVENTS_TABLE)
                .expect("probe migrated audit_events"),
            "legacy kv_store authority should be materialized into audit_events"
        );
        assert!(
            sqlite_table_exists(&migrated_connection, PROVIDER_GOVERNANCE_POLICIES_TABLE)
                .expect("probe migrated governance_policies"),
            "legacy kv_store authority should be materialized into governance_policies"
        );
        let migrated_operation_count: i64 = migrated_connection
            .query_row(
                "SELECT COUNT(*) FROM coding_session_operations WHERE id = 'sqlite-turn:operation'",
                [],
                |row| row.get(0),
            )
            .expect("count migrated operation rows");
        assert_eq!(migrated_operation_count, 1);
        drop(migrated_connection);

        std::env::remove_var("BIRDCODER_CODING_SERVER_SQLITE_FILE");
        fs::remove_file(sqlite_path).expect("remove sqlite fixture");

        assert_eq!(operation_response.status(), StatusCode::OK);
        assert_eq!(session_response.status(), StatusCode::OK);
        assert_eq!(events_response.status(), StatusCode::OK);
        assert_eq!(checkpoints_response.status(), StatusCode::OK);
        assert_eq!(app_workspaces_response.status(), StatusCode::OK);
        assert_eq!(app_deployments_response.status(), StatusCode::OK);
        assert_eq!(admin_deployments_response.status(), StatusCode::OK);
        assert_eq!(app_projects_response.status(), StatusCode::OK);
        assert_eq!(app_documents_response.status(), StatusCode::OK);
        assert_eq!(app_teams_response.status(), StatusCode::OK);
        assert_eq!(admin_teams_response.status(), StatusCode::OK);
        assert_eq!(admin_deployment_targets_response.status(), StatusCode::OK);
        assert_eq!(admin_team_members_response.status(), StatusCode::OK);
        assert_eq!(admin_releases_response.status(), StatusCode::OK);
        assert_eq!(admin_audit_response.status(), StatusCode::OK);
        assert_eq!(admin_policies_response.status(), StatusCode::OK);

        let operation_body = to_bytes(operation_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let operation_json: serde_json::Value =
            serde_json::from_slice(&operation_body).expect("parse operation response");

        assert_eq!(operation_json["data"]["operationId"], "sqlite-turn:operation");
        assert_eq!(operation_json["data"]["status"], "succeeded");

        let events_body = to_bytes(events_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let events_json: serde_json::Value =
            serde_json::from_slice(&events_body).expect("parse events response");

        let session_body = to_bytes(session_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let session_json: serde_json::Value =
            serde_json::from_slice(&session_body).expect("parse session response");

        assert_eq!(events_json["items"][0]["id"], "sqlite-runtime:sqlite-turn:event:0");
        assert_eq!(events_json["items"][0]["kind"], "turn.completed");
        assert_eq!(session_json["data"]["id"], "sqlite-session");
        assert_eq!(session_json["data"]["workspaceId"], "workspace-sqlite");

        let checkpoints_body = to_bytes(checkpoints_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let checkpoints_json: serde_json::Value =
            serde_json::from_slice(&checkpoints_body).expect("parse checkpoints response");

        let app_workspaces_body = to_bytes(app_workspaces_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_workspaces_json: serde_json::Value =
            serde_json::from_slice(&app_workspaces_body).expect("parse workspaces response");

        let app_deployments_body = to_bytes(app_deployments_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_deployments_json: serde_json::Value =
            serde_json::from_slice(&app_deployments_body).expect("parse deployments response");

        let admin_deployments_body = to_bytes(admin_deployments_response.into_body(), usize::MAX)
            .await
            .expect("read admin deployments body");
        let admin_deployments_json: serde_json::Value =
            serde_json::from_slice(&admin_deployments_body)
                .expect("parse admin deployments response");

        let app_projects_body = to_bytes(app_projects_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_projects_json: serde_json::Value =
            serde_json::from_slice(&app_projects_body).expect("parse projects response");

        let app_documents_body = to_bytes(app_documents_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_documents_json: serde_json::Value =
            serde_json::from_slice(&app_documents_body).expect("parse documents response");

        let app_teams_body = to_bytes(app_teams_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_teams_json: serde_json::Value =
            serde_json::from_slice(&app_teams_body).expect("parse app teams response");

        let admin_teams_body = to_bytes(admin_teams_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_teams_json: serde_json::Value =
            serde_json::from_slice(&admin_teams_body).expect("parse teams response");

        let admin_deployment_targets_body =
            to_bytes(admin_deployment_targets_response.into_body(), usize::MAX)
                .await
                .expect("read body");
        let admin_deployment_targets_json: serde_json::Value =
            serde_json::from_slice(&admin_deployment_targets_body)
                .expect("parse deployment targets response");

        let admin_team_members_body = to_bytes(admin_team_members_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_team_members_json: serde_json::Value =
            serde_json::from_slice(&admin_team_members_body)
                .expect("parse team members response");

        let admin_releases_body = to_bytes(admin_releases_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_releases_json: serde_json::Value =
            serde_json::from_slice(&admin_releases_body).expect("parse releases response");

        let admin_audit_body = to_bytes(admin_audit_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_audit_json: serde_json::Value =
            serde_json::from_slice(&admin_audit_body).expect("parse audit response");

        let admin_policies_body = to_bytes(admin_policies_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_policies_json: serde_json::Value =
            serde_json::from_slice(&admin_policies_body).expect("parse policies response");

        assert_eq!(checkpoints_json["items"][0]["id"], "sqlite-checkpoint:1");
        assert_eq!(checkpoints_json["items"][0]["checkpointKind"], "approval");
        assert_eq!(app_workspaces_json["items"][0]["id"], "workspace-sqlite");
        assert_eq!(app_workspaces_json["items"][0]["name"], "SQLite authority workspace");
        assert_eq!(
            app_workspaces_json["items"][0]["ownerIdentityId"],
            "identity-sqlite-owner"
        );
        assert_eq!(app_deployments_json["items"][0]["id"], "deployment-sqlite");
        assert_eq!(app_deployments_json["items"][0]["projectId"], "project-sqlite");
        assert_eq!(app_deployments_json["items"][0]["targetId"], "target-sqlite-web");
        assert_eq!(admin_deployments_json["items"][0]["id"], "deployment-sqlite");
        assert_eq!(admin_deployments_json["items"][0]["projectId"], "project-sqlite");
        assert_eq!(admin_deployments_json["items"][0]["targetId"], "target-sqlite-web");
        assert_eq!(app_projects_json["items"][0]["id"], "project-sqlite");
        assert_eq!(app_documents_json["items"][0]["id"], "doc-sqlite-architecture");
        assert_eq!(app_documents_json["items"][0]["projectId"], "project-sqlite");
        assert_eq!(app_teams_json["items"][0]["id"], "team-sqlite");
        assert_eq!(admin_teams_json["items"][0]["id"], "team-sqlite");
        assert_eq!(
            admin_deployment_targets_json["items"][0]["id"],
            "target-sqlite-web"
        );
        assert_eq!(
            admin_deployment_targets_json["items"][0]["projectId"],
            "project-sqlite"
        );
        assert_eq!(admin_team_members_json["items"][0]["id"], "member-sqlite-admin");
        assert_eq!(admin_team_members_json["items"][0]["teamId"], "team-sqlite");
        assert_eq!(admin_team_members_json["items"][0]["role"], "admin");
        assert_eq!(admin_releases_json["items"][0]["id"], "release-0.2.0-sqlite");
        assert_eq!(admin_audit_json["items"][0]["id"], "audit-sqlite-release");
        assert_eq!(admin_audit_json["items"][0]["scopeId"], "workspace-sqlite");
        assert_eq!(admin_policies_json["items"][0]["id"], "policy-sqlite-terminal");
        assert_eq!(
            admin_policies_json["items"][0]["approvalPolicy"],
            "Restricted"
        );
        assert_eq!(admin_policies_json["items"][0]["targetId"], "codex");
    }

    #[tokio::test]
    async fn build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let sqlite_path =
            write_sqlite_provider_authority_fixture("birdcoder-coding-server-provider.sqlite3");

        std::env::set_var(
            "BIRDCODER_CODING_SERVER_SQLITE_FILE",
            sqlite_path.as_os_str(),
        );

        let operation_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/operations/provider-turn:operation")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let session_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/provider-session")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let events_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/provider-session/events")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let checkpoints_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/provider-session/checkpoints")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_workspaces_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/workspaces")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_deployments_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/deployments")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_deployments_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/deployments")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_projects_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/projects")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_documents_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/documents")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let app_teams_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/teams")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_teams_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/teams")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_deployment_targets_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/projects/project-provider/deployment-targets")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_team_members_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/teams/team-provider/members")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_releases_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/releases")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_audit_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/audit")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        let admin_policies_response = build_app_from_env()
            .expect("load env app")
            .oneshot(
                Request::builder()
                    .uri("/api/admin/v1/policies")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        std::env::remove_var("BIRDCODER_CODING_SERVER_SQLITE_FILE");
        fs::remove_file(sqlite_path).expect("remove sqlite provider fixture");

        assert_eq!(operation_response.status(), StatusCode::OK);
        assert_eq!(session_response.status(), StatusCode::OK);
        assert_eq!(events_response.status(), StatusCode::OK);
        assert_eq!(checkpoints_response.status(), StatusCode::OK);
        assert_eq!(app_workspaces_response.status(), StatusCode::OK);
        assert_eq!(app_deployments_response.status(), StatusCode::OK);
        assert_eq!(admin_deployments_response.status(), StatusCode::OK);
        assert_eq!(app_projects_response.status(), StatusCode::OK);
        assert_eq!(app_documents_response.status(), StatusCode::OK);
        assert_eq!(app_teams_response.status(), StatusCode::OK);
        assert_eq!(admin_teams_response.status(), StatusCode::OK);
        assert_eq!(admin_deployment_targets_response.status(), StatusCode::OK);
        assert_eq!(admin_team_members_response.status(), StatusCode::OK);
        assert_eq!(admin_releases_response.status(), StatusCode::OK);
        assert_eq!(admin_audit_response.status(), StatusCode::OK);
        assert_eq!(admin_policies_response.status(), StatusCode::OK);

        let operation_body = to_bytes(operation_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let operation_json: serde_json::Value =
            serde_json::from_slice(&operation_body).expect("parse operation response");

        let session_body = to_bytes(session_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let session_json: serde_json::Value =
            serde_json::from_slice(&session_body).expect("parse session response");

        let events_body = to_bytes(events_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let events_json: serde_json::Value =
            serde_json::from_slice(&events_body).expect("parse events response");

        let checkpoints_body = to_bytes(checkpoints_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let checkpoints_json: serde_json::Value =
            serde_json::from_slice(&checkpoints_body).expect("parse checkpoints response");

        let app_workspaces_body = to_bytes(app_workspaces_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_workspaces_json: serde_json::Value =
            serde_json::from_slice(&app_workspaces_body).expect("parse workspaces response");

        let app_deployments_body = to_bytes(app_deployments_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_deployments_json: serde_json::Value =
            serde_json::from_slice(&app_deployments_body).expect("parse deployments response");

        let admin_deployments_body = to_bytes(admin_deployments_response.into_body(), usize::MAX)
            .await
            .expect("read admin deployments body");
        let admin_deployments_json: serde_json::Value =
            serde_json::from_slice(&admin_deployments_body)
                .expect("parse admin deployments response");

        let app_projects_body = to_bytes(app_projects_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_projects_json: serde_json::Value =
            serde_json::from_slice(&app_projects_body).expect("parse projects response");

        let app_documents_body = to_bytes(app_documents_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_documents_json: serde_json::Value =
            serde_json::from_slice(&app_documents_body).expect("parse documents response");

        let app_teams_body = to_bytes(app_teams_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let app_teams_json: serde_json::Value =
            serde_json::from_slice(&app_teams_body).expect("parse app teams response");

        let admin_teams_body = to_bytes(admin_teams_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_teams_json: serde_json::Value =
            serde_json::from_slice(&admin_teams_body).expect("parse teams response");

        let admin_deployment_targets_body =
            to_bytes(admin_deployment_targets_response.into_body(), usize::MAX)
                .await
                .expect("read body");
        let admin_deployment_targets_json: serde_json::Value =
            serde_json::from_slice(&admin_deployment_targets_body)
                .expect("parse deployment targets response");

        let admin_team_members_body = to_bytes(admin_team_members_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_team_members_json: serde_json::Value =
            serde_json::from_slice(&admin_team_members_body)
                .expect("parse team members response");

        let admin_releases_body = to_bytes(admin_releases_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_releases_json: serde_json::Value =
            serde_json::from_slice(&admin_releases_body).expect("parse releases response");

        let admin_audit_body = to_bytes(admin_audit_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_audit_json: serde_json::Value =
            serde_json::from_slice(&admin_audit_body).expect("parse audit response");

        let admin_policies_body = to_bytes(admin_policies_response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let admin_policies_json: serde_json::Value =
            serde_json::from_slice(&admin_policies_body).expect("parse policies response");

        assert_eq!(operation_json["data"]["operationId"], "provider-turn:operation");
        assert_eq!(session_json["data"]["id"], "provider-session");
        assert_eq!(session_json["data"]["hostMode"], "server");
        assert_eq!(
            events_json["items"][0]["id"],
            "provider-runtime:provider-turn:event:0"
        );
        assert_eq!(checkpoints_json["items"][0]["id"], "provider-checkpoint:1");
        assert_eq!(app_workspaces_json["items"][0]["id"], "workspace-provider");
        assert_eq!(app_workspaces_json["items"][0]["name"], "Provider authority workspace");
        assert_eq!(
            app_workspaces_json["items"][0]["ownerIdentityId"],
            "identity-provider-owner"
        );
        assert_eq!(app_deployments_json["items"][0]["id"], "deployment-provider");
        assert_eq!(app_deployments_json["items"][0]["projectId"], "project-provider");
        assert_eq!(app_deployments_json["items"][0]["targetId"], "target-provider-web");
        assert_eq!(admin_deployments_json["items"][0]["id"], "deployment-provider");
        assert_eq!(admin_deployments_json["items"][0]["projectId"], "project-provider");
        assert_eq!(admin_deployments_json["items"][0]["targetId"], "target-provider-web");
        assert_eq!(app_projects_json["items"][0]["id"], "project-provider");
        assert_eq!(app_documents_json["items"][0]["id"], "doc-provider-architecture");
        assert_eq!(app_documents_json["items"][0]["projectId"], "project-provider");
        assert_eq!(app_teams_json["items"][0]["id"], "team-provider");
        assert_eq!(admin_teams_json["items"][0]["id"], "team-provider");
        assert_eq!(
            admin_deployment_targets_json["items"][0]["id"],
            "target-provider-web"
        );
        assert_eq!(
            admin_deployment_targets_json["items"][0]["projectId"],
            "project-provider"
        );
        assert_eq!(admin_team_members_json["items"][0]["teamId"], "team-provider");
        assert_eq!(admin_team_members_json["items"][0]["role"], "admin");
        assert_eq!(admin_releases_json["items"][0]["id"], "release-0.3.0-provider");
        assert_eq!(admin_audit_json["items"][0]["id"], "audit-provider-release");
        assert_eq!(admin_audit_json["items"][0]["scopeId"], "workspace-provider");
        assert_eq!(admin_policies_json["items"][0]["id"], "policy-provider-terminal");
        assert_eq!(
            admin_policies_json["items"][0]["approvalPolicy"],
            "OnRequest"
        );
        assert_eq!(admin_policies_json["items"][0]["targetId"], "claude-code");
    }

    #[tokio::test]
    async fn build_app_from_sqlite_file_reads_live_workspace_and_project_authority_from_sqlite() {
        let sqlite_path =
            write_sqlite_provider_authority_fixture("birdcoder-coding-server-live.sqlite3");
        let app = build_app_from_sqlite_file(&sqlite_path).expect("load sqlite file app");

        let connection = Connection::open(&sqlite_path).expect("open sqlite live authority fixture");
        connection
            .execute(
                r#"
                INSERT INTO workspaces (
                    id, created_at, updated_at, version, is_deleted, name, description, owner_identity_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    "workspace-live",
                    "2026-04-10T13:10:00Z",
                    "2026-04-10T13:10:00Z",
                    0_i64,
                    0_i64,
                    "Live authority workspace",
                    "Workspace inserted after router bootstrap",
                    "identity-live-owner",
                    "active",
                ],
            )
            .expect("insert live workspace");
        connection
            .execute(
                r#"
                INSERT INTO projects (
                    id, created_at, updated_at, version, is_deleted, workspace_id, name, description, root_path, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    "project-live",
                    "2026-04-10T13:10:01Z",
                    "2026-04-10T13:10:01Z",
                    0_i64,
                    0_i64,
                    "workspace-live",
                    "Live authority project",
                    "Project inserted after router bootstrap",
                    "E:/sdkwork/project-live",
                    "active",
                ],
            )
            .expect("insert live project");
        drop(connection);

        let workspaces_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/workspaces")
                    .body(Body::empty())
                    .expect("build workspaces request"),
            )
            .await
            .expect("serve workspaces request");
        let projects_response = app
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/projects")
                    .body(Body::empty())
                    .expect("build projects request"),
            )
            .await
            .expect("serve projects request");

        fs::remove_file(sqlite_path).expect("remove sqlite live fixture");

        let workspaces_body = to_bytes(workspaces_response.into_body(), usize::MAX)
            .await
            .expect("read workspaces body");
        let workspaces_json: serde_json::Value =
            serde_json::from_slice(&workspaces_body).expect("parse workspaces response");
        let projects_body = to_bytes(projects_response.into_body(), usize::MAX)
            .await
            .expect("read projects body");
        let projects_json: serde_json::Value =
            serde_json::from_slice(&projects_body).expect("parse projects response");

        assert!(
            workspaces_json["items"]
                .as_array()
                .expect("workspace items array")
                .iter()
                .any(|item| item["id"] == "workspace-live"),
            "live workspace row should be visible without rebuilding the router"
        );
        assert!(
            projects_json["items"]
                .as_array()
                .expect("project items array")
                .iter()
                .any(|item| item["id"] == "project-live"),
            "live project row should be visible without rebuilding the router"
        );
    }

    #[tokio::test]
    async fn build_app_from_sqlite_file_bootstraps_default_workspace_and_project_when_authority_empty() {
        let sqlite_path = write_empty_sqlite_provider_authority_fixture(
            "birdcoder-coding-server-bootstrap-empty.sqlite3",
        );
        let app = build_app_from_sqlite_file(&sqlite_path).expect("load sqlite bootstrap app");

        let workspaces_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/workspaces")
                    .body(Body::empty())
                    .expect("build workspaces request"),
            )
            .await
            .expect("serve workspaces request");
        let projects_response = app
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/projects")
                    .body(Body::empty())
                    .expect("build projects request"),
            )
            .await
            .expect("serve projects request");

        let connection = Connection::open(&sqlite_path).expect("open sqlite bootstrap fixture");
        let persisted_workspace_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM workspaces WHERE is_deleted = 0",
                [],
                |row| row.get(0),
            )
            .expect("read persisted workspace count");
        let persisted_project_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM projects WHERE is_deleted = 0",
                [],
                |row| row.get(0),
            )
            .expect("read persisted project count");
        drop(connection);
        fs::remove_file(sqlite_path).expect("remove sqlite bootstrap fixture");

        let workspaces_body = to_bytes(workspaces_response.into_body(), usize::MAX)
            .await
            .expect("read workspaces body");
        let workspaces_json: serde_json::Value =
            serde_json::from_slice(&workspaces_body).expect("parse workspaces response");
        let projects_body = to_bytes(projects_response.into_body(), usize::MAX)
            .await
            .expect("read projects body");
        let projects_json: serde_json::Value =
            serde_json::from_slice(&projects_body).expect("parse projects response");

        assert_eq!(persisted_workspace_count, 1);
        assert_eq!(persisted_project_count, 1);
        assert_eq!(workspaces_json["items"][0]["id"], "workspace-default");
        assert_eq!(workspaces_json["items"][0]["name"], "Default Workspace");
        assert_eq!(projects_json["items"][0]["id"], "project-default");
        assert_eq!(projects_json["items"][0]["workspaceId"], "workspace-default");
        assert_eq!(projects_json["items"][0]["name"], "Starter Project");
    }

    #[tokio::test]
    async fn build_app_from_sqlite_file_bootstraps_starter_project_into_existing_workspace_when_projects_missing() {
        let sqlite_path = write_empty_sqlite_provider_authority_fixture(
            "birdcoder-coding-server-bootstrap-project.sqlite3",
        );
        let connection =
            Connection::open(&sqlite_path).expect("open sqlite bootstrap project fixture");
        connection
            .execute(
                r#"
                INSERT INTO workspaces (
                    id, created_at, updated_at, version, is_deleted, name, description, owner_identity_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    "workspace-existing",
                    "2026-04-15T18:30:00Z",
                    "2026-04-15T18:30:00Z",
                    0_i64,
                    0_i64,
                    "Existing Workspace",
                    "Pre-existing local workspace",
                    "identity-existing",
                    "active",
                ],
            )
            .expect("insert existing workspace");
        drop(connection);

        let app = build_app_from_sqlite_file(&sqlite_path).expect("load sqlite bootstrap app");
        let projects_response = app
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/projects")
                    .body(Body::empty())
                    .expect("build projects request"),
            )
            .await
            .expect("serve projects request");

        let connection = Connection::open(&sqlite_path).expect("open sqlite bootstrap fixture");
        let persisted_workspace_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM workspaces WHERE is_deleted = 0",
                [],
                |row| row.get(0),
            )
            .expect("read persisted workspace count");
        let persisted_project_row: (String, String, String) = connection
            .query_row(
                "SELECT id, workspace_id, name FROM projects WHERE is_deleted = 0 LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("read persisted starter project");
        drop(connection);
        fs::remove_file(sqlite_path).expect("remove sqlite bootstrap fixture");

        let projects_body = to_bytes(projects_response.into_body(), usize::MAX)
            .await
            .expect("read projects body");
        let projects_json: serde_json::Value =
            serde_json::from_slice(&projects_body).expect("parse projects response");

        assert_eq!(persisted_workspace_count, 1);
        assert_eq!(persisted_project_row.0, "project-default");
        assert_eq!(persisted_project_row.1, "workspace-existing");
        assert_eq!(persisted_project_row.2, "Starter Project");
        assert_eq!(projects_json["items"][0]["workspaceId"], "workspace-existing");
    }

    #[tokio::test]
    async fn build_app_loads_projection_state_from_default_runtime_config_file_when_present() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let sqlite_path = write_sqlite_projection_fixture("birdcoder-coding-server-config.sqlite3");
        let config_path = write_runtime_config_fixture(&sqlite_path);

        std::env::remove_var("BIRDCODER_CODING_SERVER_SQLITE_FILE");
        std::env::remove_var("BIRDCODER_CODING_SERVER_SNAPSHOT_FILE");

        let response = build_app_from_env()
            .expect("load config app")
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/operations/sqlite-turn:operation")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        fs::remove_file(config_path).expect("remove runtime config fixture");
        fs::remove_file(sqlite_path).expect("remove sqlite fixture");

        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("parse operation response");

        assert_eq!(json["data"]["operationId"], "sqlite-turn:operation");
    }

    #[test]
    fn build_app_from_env_returns_error_when_sqlite_authority_has_no_direct_tables_or_kv_store() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let sqlite_path = write_empty_sqlite_fixture("birdcoder-empty-coding-server.sqlite3");

        std::env::set_var(
            "BIRDCODER_CODING_SERVER_SQLITE_FILE",
            sqlite_path.as_os_str(),
        );

        let result = build_app_from_env();

        std::env::remove_var("BIRDCODER_CODING_SERVER_SQLITE_FILE");
        fs::remove_file(sqlite_path).expect("remove empty sqlite fixture");

        assert_eq!(result.is_err(), true);
    }

    #[test]
    fn build_app_from_env_returns_error_when_configured_snapshot_file_is_missing() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        std::env::set_var(
            "BIRDCODER_CODING_SERVER_SNAPSHOT_FILE",
            std::env::temp_dir()
                .join("birdcoder-missing-coding-server-snapshot.json")
                .as_os_str(),
        );

        let result = build_app_from_env();

        std::env::remove_var("BIRDCODER_CODING_SERVER_SNAPSHOT_FILE");

        assert_eq!(result.is_err(), true);
    }

    #[tokio::test]
    async fn openapi_route_exposes_representative_core_app_and_admin_paths() {
        let response = build_app()
            .oneshot(
                Request::builder()
                    .uri(CODING_SERVER_OPENAPI_PATH)
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("parse openapi response");

        assert_eq!(
            json["paths"]["/api/core/v1/coding-sessions/:id/events"]["get"]["operationId"],
            "core.listCodingSessionEvents"
        );
        assert_eq!(
            json["paths"]["/api/app/v1/workspaces"]["get"]["operationId"],
            "app.listWorkspaces"
        );
        assert_eq!(
            json["paths"]["/api/admin/v1/teams/:teamId/members"]["get"]["operationId"],
            "admin.listTeamMembers"
        );
        assert_eq!(
            json["paths"]["/api/admin/v1/projects/:projectId/deployment-targets"]["get"]
                ["operationId"],
            "admin.listDeploymentTargets"
        );
        assert_eq!(
            json["paths"]["/api/admin/v1/releases"]["get"]["operationId"],
            "admin.listReleases"
        );
    }

    #[tokio::test]
    async fn legacy_health_route_is_not_exposed_anymore() {
        let response = build_app()
            .oneshot(
                Request::builder()
                    .uri("/health")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn app_routes_accept_loopback_cors_preflight_requests() {
        let response = build_app()
            .oneshot(
                Request::builder()
                    .method("OPTIONS")
                    .uri("/api/app/v1/workspaces")
                    .header("origin", "http://127.0.0.1:1520")
                    .header("access-control-request-method", "GET")
                    .header("access-control-request-headers", "content-type")
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(
            response.status().is_success(),
            true,
            "browser-hosted local clients must receive a successful CORS preflight response from the loopback coding server.",
        );
        assert_eq!(
            response.headers().get("access-control-allow-origin"),
            Some(&"http://127.0.0.1:1520".parse().expect("origin header")),
        );
        assert_eq!(
            response.headers().get("access-control-allow-methods").is_some(),
            true,
            "preflight responses must advertise the allowed methods so local web/desktop shells can call app APIs.",
        );
    }
}
