use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::{Path as FsPath, PathBuf},
    sync::{Arc, RwLock},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
mod native_sessions;
mod user_center;

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path as AxumPath, Query, State,
    },
    http::{header, HeaderMap, HeaderName, HeaderValue, Method, StatusCode},
    response::{Html, Response},
    routing::{delete, get, patch, post},
    Json, Router,
};
use rusqlite::{params, types::ValueRef, Connection, OptionalExtension};
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::json;
use sdkwork_birdcoder_codeengine::{
    find_codeengine_descriptor, list_codeengine_descriptors,
    list_codeengine_model_catalog_entries, list_native_session_provider_catalog_entries,
    CodeEngineCapabilityMatrixRecord as EngineCapabilityMatrixPayload,
    CodeEngineDescriptorRecord as EngineDescriptorPayload,
    CodeEngineModelCatalogEntryRecord as ModelCatalogEntryPayload,
    NativeSessionProviderCatalogRecord as NativeSessionProviderPayload,
};
use tokio::sync::broadcast;
use tower_http::cors::{AllowOrigin, CorsLayer};
use user_center::{
    ensure_sqlite_user_center_bootstrap_user, ensure_sqlite_user_center_schema,
    UpdateUserCenterProfileRequest, UpdateUserCenterVipMembershipRequest, UserCenterLoginRequest,
    UserCenterMetadataPayload, UserCenterProfilePayload, UserCenterRegisterRequest,
    UserCenterSessionExchangeRequest, UserCenterSessionPayload, UserCenterState,
    UserCenterVipMembershipPayload, BIRDCODER_SESSION_HEADER_NAME,
};
use uuid::Uuid;

pub const BIRD_SERVER_DEFAULT_HOST: &str = "127.0.0.1";
pub const BIRD_SERVER_DEFAULT_PORT: u16 = 10240;
pub const BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME: &str = "bird-server.config.json";
pub const BIRD_SERVER_DEFAULT_BIND_ADDRESS: &str = "127.0.0.1:10240";
pub const CODING_SERVER_API_VERSION: &str = "v1";
pub const CODING_SERVER_OPENAPI_PATH: &str = "/openapi/coding-server-v1.json";
pub const CODING_SERVER_LIVE_OPENAPI_PATH: &str = "/openapi.json";
pub const CODING_SERVER_DOCS_PATH: &str = "/docs";
pub const CODING_SERVER_GATEWAY_BASE_PATH: &str = "/api";
pub const CODING_SERVER_CORE_API_PREFIX: &str = "/api/core/v1";
pub const CODING_SERVER_APP_API_PREFIX: &str = "/api/app/v1";
pub const CODING_SERVER_ADMIN_API_PREFIX: &str = "/api/admin/v1";
pub const CODING_SERVER_ROUTE_CATALOG_PATH: &str = "/api/core/v1/routes";
pub const BIRDCODER_CODING_SERVER_SQLITE_FILE_ENV: &str = "BIRDCODER_CODING_SERVER_SQLITE_FILE";
pub const BIRDCODER_CODING_SERVER_SNAPSHOT_FILE_ENV: &str = "BIRDCODER_CODING_SERVER_SNAPSHOT_FILE";
pub const BIRDCODER_CODING_SERVER_ALLOWED_ORIGINS_ENV: &str =
    "BIRDCODER_CODING_SERVER_ALLOWED_ORIGINS";

const PROVIDER_CODING_SESSIONS_TABLE: &str = "coding_sessions";
const PROVIDER_CODING_SESSION_RUNTIMES_TABLE: &str = "coding_session_runtimes";
const PROVIDER_CODING_SESSION_TURNS_TABLE: &str = "coding_session_turns";
const PROVIDER_CODING_SESSION_EVENTS_TABLE: &str = "coding_session_events";
const PROVIDER_CODING_SESSION_ARTIFACTS_TABLE: &str = "coding_session_artifacts";
const PROVIDER_CODING_SESSION_CHECKPOINTS_TABLE: &str = "coding_session_checkpoints";
const PROVIDER_CODING_SESSION_OPERATIONS_TABLE: &str = "coding_session_operations";
const PROVIDER_WORKSPACES_TABLE: &str = "workspaces";
const PROVIDER_PROJECTS_TABLE: &str = "projects";
const PROVIDER_SKILL_PACKAGES_TABLE: &str = "skill_packages";
const PROVIDER_SKILL_VERSIONS_TABLE: &str = "skill_versions";
const PROVIDER_SKILL_CAPABILITIES_TABLE: &str = "skill_capabilities";
const PROVIDER_SKILL_INSTALLATIONS_TABLE: &str = "skill_installations";
const PROVIDER_APP_TEMPLATES_TABLE: &str = "app_templates";
const PROVIDER_APP_TEMPLATE_VERSIONS_TABLE: &str = "app_template_versions";
const PROVIDER_APP_TEMPLATE_TARGET_PROFILES_TABLE: &str = "app_template_target_profiles";
const PROVIDER_APP_TEMPLATE_PRESETS_TABLE: &str = "app_template_presets";
const PROVIDER_APP_TEMPLATE_INSTANTIATIONS_TABLE: &str = "app_template_instantiations";
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
pub(crate) const BOOTSTRAP_WORKSPACE_OWNER_USER_ID: &str = "user-local-default";
const BOOTSTRAP_PROJECT_ID: &str = "project-default";
const BOOTSTRAP_PROJECT_NAME: &str = "Starter Project";
const SQLITE_AUTHORITY_DEFAULT_TENANT_ID: &str = "tenant-local-default";
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
    uuid TEXT NULL,
    tenant_id TEXT NULL,
    organization_id TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    name TEXT NOT NULL,
    code TEXT NULL,
    title TEXT NULL,
    description TEXT NULL,
    owner_id TEXT NULL,
    leader_id TEXT NULL,
    created_by_user_id TEXT NULL,
    icon TEXT NULL,
    color TEXT NULL,
    type TEXT NULL,
    start_time TEXT NULL,
    end_time TEXT NULL,
    max_members INTEGER NULL,
    current_members INTEGER NULL,
    member_count INTEGER NULL,
    max_storage INTEGER NULL,
    used_storage INTEGER NULL,
    settings_json TEXT NULL,
    is_public INTEGER NOT NULL DEFAULT 0,
    is_template INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    uuid TEXT NULL,
    tenant_id TEXT NULL,
    organization_id TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NOT NULL,
    workspace_uuid TEXT NULL,
    name TEXT NOT NULL,
    code TEXT NULL,
    title TEXT NULL,
    description TEXT NULL,
    root_path TEXT NULL,
    author TEXT NULL,
    file_id TEXT NULL,
    type TEXT NULL,
    site_path TEXT NULL,
    domain_prefix TEXT NULL,
    conversation_id TEXT NULL,
    owner_id TEXT NULL,
    leader_id TEXT NULL,
    created_by_user_id TEXT NULL,
    start_time TEXT NULL,
    end_time TEXT NULL,
    budget_amount INTEGER NULL,
    cover_image_json TEXT NULL,
    is_template INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_packages (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    slug TEXT NOT NULL,
    source_uri TEXT NOT NULL,
    status TEXT NOT NULL,
    manifest_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_versions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    skill_package_id TEXT NOT NULL,
    version_label TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_capabilities (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    skill_version_id TEXT NOT NULL,
    capability_key TEXT NOT NULL,
    description_text TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_installations (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    skill_version_id TEXT NOT NULL,
    status TEXT NOT NULL,
    installed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_templates (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_template_versions (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    app_template_id TEXT NOT NULL,
    version_label TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_template_target_profiles (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    app_template_version_id TEXT NOT NULL,
    profile_key TEXT NOT NULL,
    runtime TEXT NOT NULL,
    deployment_mode TEXT NOT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_template_presets (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    app_template_version_id TEXT NOT NULL,
    preset_key TEXT NOT NULL,
    description_text TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_template_instantiations (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    project_id TEXT NOT NULL,
    app_template_version_id TEXT NOT NULL,
    preset_key TEXT NOT NULL,
    status TEXT NOT NULL,
    output_root TEXT NOT NULL
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
    uuid TEXT NULL,
    tenant_id TEXT NULL,
    organization_id TEXT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT NULL,
    title TEXT NULL,
    description TEXT NULL,
    owner_id TEXT NULL,
    leader_id TEXT NULL,
    created_by_user_id TEXT NULL,
    metadata_json TEXT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    created_by_user_id TEXT NULL,
    granted_by_user_id TEXT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    team_id TEXT NULL,
    role TEXT NOT NULL,
    created_by_user_id TEXT NULL,
    granted_by_user_id TEXT NULL,
    status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_collaborators (
    id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    project_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    team_id TEXT NULL,
    role TEXT NOT NULL,
    created_by_user_id TEXT NULL,
    granted_by_user_id TEXT NULL,
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
    gateway: GatewayDescriptorPayload,
    host_mode: &'static str,
    module_id: &'static str,
    open_api_path: &'static str,
    surfaces: [&'static str; 3],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GatewayDescriptorPayload {
    base_path: &'static str,
    docs_path: &'static str,
    live_open_api_path: &'static str,
    open_api_path: &'static str,
    route_catalog_path: &'static str,
    route_count: usize,
    routes_by_surface: GatewayRoutesBySurfacePayload,
    surfaces: [GatewaySurfaceDescriptorPayload; 3],
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GatewayRoutesBySurfacePayload {
    admin: usize,
    app: usize,
    core: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GatewaySurfaceDescriptorPayload {
    auth_mode: &'static str,
    base_path: &'static str,
    description: &'static str,
    name: &'static str,
    route_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RouteCatalogEntryPayload {
    auth_mode: &'static str,
    method: &'static str,
    open_api_path: String,
    operation_id: &'static str,
    path: &'static str,
    surface: &'static str,
    summary: &'static str,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    organization_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    name: String,
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    owner_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    leader_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    created_by_user_id: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    entity_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    member_count: Option<usize>,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    viewer_role: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    created_at: Option<String>,
    id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    organization_id: Option<String>,
    workspace_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    workspace_uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    name: String,
    description: Option<String>,
    root_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    owner_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    leader_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    created_by_user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    author: Option<String>,
    #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
    entity_type: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    collaborator_count: Option<usize>,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    viewer_role: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SkillCatalogEntryPayload {
    id: String,
    package_id: String,
    slug: String,
    name: String,
    description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    author: Option<String>,
    version_id: String,
    version_label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    install_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    long_description: Option<String>,
    tags: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    license: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    repository_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_updated: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    readme: Option<String>,
    capability_keys: Vec<String>,
    installed: bool,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SkillPackagePayload {
    id: String,
    slug: String,
    name: String,
    description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    author: Option<String>,
    version_id: String,
    version_label: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    install_count: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    long_description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    source_uri: Option<String>,
    installed: bool,
    updated_at: String,
    skills: Vec<SkillCatalogEntryPayload>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SkillInstallationPayload {
    id: String,
    package_id: String,
    scope_id: String,
    scope_type: String,
    status: String,
    version_id: String,
    installed_at: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AppTemplatePayload {
    id: String,
    slug: String,
    name: String,
    description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    author: Option<String>,
    version_id: String,
    version_label: String,
    preset_key: String,
    category: String,
    tags: Vec<String>,
    target_profiles: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    downloads: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    stars: Option<usize>,
    status: String,
    updated_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceScopedQuery {
    root_path: Option<String>,
    user_id: Option<String>,
    workspace_id: Option<String>,
}

#[derive(Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodingSessionListQuery {
    engine_id: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
    project_id: Option<String>,
    workspace_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateWorkspaceRequest {
    name: String,
    description: Option<String>,
    tenant_id: Option<String>,
    organization_id: Option<String>,
    code: Option<String>,
    title: Option<String>,
    owner_id: Option<String>,
    leader_id: Option<String>,
    created_by_user_id: Option<String>,
    #[serde(rename = "type")]
    entity_type: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateWorkspaceRequest {
    name: Option<String>,
    description: Option<String>,
    code: Option<String>,
    title: Option<String>,
    owner_id: Option<String>,
    leader_id: Option<String>,
    #[serde(rename = "type")]
    entity_type: Option<String>,
    status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateProjectRequest {
    workspace_id: String,
    name: String,
    description: Option<String>,
    workspace_uuid: Option<String>,
    tenant_id: Option<String>,
    organization_id: Option<String>,
    code: Option<String>,
    title: Option<String>,
    owner_id: Option<String>,
    leader_id: Option<String>,
    created_by_user_id: Option<String>,
    author: Option<String>,
    #[serde(rename = "type")]
    entity_type: Option<String>,
    root_path: Option<String>,
    app_template_version_id: Option<String>,
    template_preset_key: Option<String>,
    status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct InstallSkillPackageRequest {
    scope_id: String,
    scope_type: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateProjectRequest {
    name: Option<String>,
    description: Option<String>,
    code: Option<String>,
    title: Option<String>,
    owner_id: Option<String>,
    leader_id: Option<String>,
    author: Option<String>,
    #[serde(rename = "type")]
    entity_type: Option<String>,
    root_path: Option<String>,
    status: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeleteEntityPayload {
    id: String,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    uuid: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tenant_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    organization_id: Option<String>,
    workspace_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    title: Option<String>,
    name: String,
    description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    owner_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    leader_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    created_by_user_id: Option<String>,
    status: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct TeamMemberPayload {
    id: String,
    team_id: String,
    user_id: String,
    role: String,
    created_by_user_id: Option<String>,
    granted_by_user_id: Option<String>,
    status: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceMemberPayload {
    id: String,
    workspace_id: String,
    user_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_avatar_url: Option<String>,
    team_id: Option<String>,
    role: String,
    status: String,
    created_by_user_id: Option<String>,
    granted_by_user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    updated_at: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectCollaboratorPayload {
    id: String,
    project_id: String,
    workspace_id: String,
    user_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_display_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    user_avatar_url: Option<String>,
    team_id: Option<String>,
    role: String,
    status: String,
    created_by_user_id: Option<String>,
    granted_by_user_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    created_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    updated_at: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsertWorkspaceMemberRequest {
    user_id: Option<String>,
    email: Option<String>,
    team_id: Option<String>,
    role: Option<String>,
    status: Option<String>,
    created_by_user_id: Option<String>,
    granted_by_user_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpsertProjectCollaboratorRequest {
    user_id: Option<String>,
    email: Option<String>,
    team_id: Option<String>,
    role: Option<String>,
    status: Option<String>,
    created_by_user_id: Option<String>,
    granted_by_user_id: Option<String>,
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

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PublishProjectRequest {
    endpoint_url: Option<String>,
    environment_key: Option<String>,
    release_kind: Option<String>,
    release_version: Option<String>,
    rollout_stage: Option<String>,
    runtime: Option<String>,
    target_id: Option<String>,
    target_name: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct PublishProjectResultPayload {
    deployment: DeploymentPayload,
    release: ReleasePayload,
    target: DeploymentTargetPayload,
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
    native_session_id: Option<String>,
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
    #[serde(default)]
    sort_timestamp: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    transcript_updated_at: Option<String>,
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
struct UpdateCodingSessionRequest {
    title: Option<String>,
    status: Option<String>,
    host_mode: Option<String>,
    engine_id: Option<String>,
    model_id: Option<String>,
}

struct UpdateCodingSessionInput {
    title: Option<String>,
    status: Option<String>,
    host_mode: Option<String>,
    engine_id: Option<String>,
    model_id: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ForkCodingSessionRequest {
    title: Option<String>,
}

struct ForkCodingSessionInput {
    title: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodingSessionTurnCurrentFileContextPayload {
    path: String,
    content: Option<String>,
    language: Option<String>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CodingSessionTurnIdeContextPayload {
    workspace_id: Option<String>,
    project_id: Option<String>,
    thread_id: Option<String>,
    current_file: Option<CodingSessionTurnCurrentFileContextPayload>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateCodingSessionTurnRequest {
    runtime_id: Option<String>,
    request_kind: String,
    input_summary: String,
    ide_context: Option<CodingSessionTurnIdeContextPayload>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeSessionQueryParams {
    workspace_id: Option<String>,
    project_id: Option<String>,
    engine_id: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeSessionLookupQueryParams {
    workspace_id: Option<String>,
    project_id: Option<String>,
    engine_id: Option<String>,
}

struct CreateCodingSessionTurnInput {
    runtime_id: Option<String>,
    request_kind: String,
    input_summary: String,
    ide_context: Option<CodingSessionTurnIdeContextPayload>,
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
    realtime: WorkspaceRealtimeHub,
    user_center: UserCenterState,
    audits: Vec<AuditPayload>,
    deployments: Vec<DeploymentPayload>,
    targets: Vec<DeploymentTargetPayload>,
    documents: Vec<DocumentPayload>,
    members: Vec<TeamMemberPayload>,
    workspace_members: Vec<WorkspaceMemberPayload>,
    project_collaborators: Vec<ProjectCollaboratorPayload>,
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
    workspace_members: Vec<WorkspaceMemberPayload>,
    project_collaborators: Vec<ProjectCollaboratorPayload>,
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
    description: &'static str,
}

#[derive(Serialize)]
struct OpenApiServer {
    url: String,
    description: &'static str,
}

#[derive(Serialize)]
struct OpenApiTag {
    name: &'static str,
    description: &'static str,
}

#[derive(Serialize)]
struct OpenApiResponse {
    description: &'static str,
}

#[derive(Serialize)]
struct OpenApiSecurityScheme {
    #[serde(rename = "type")]
    kind: &'static str,
    scheme: &'static str,
    #[serde(rename = "bearerFormat")]
    bearer_format: &'static str,
}

#[derive(Serialize)]
struct OpenApiSecuritySchemes {
    #[serde(rename = "bearerAuth")]
    bearer_auth: OpenApiSecurityScheme,
}

#[derive(Serialize)]
struct OpenApiComponents {
    #[serde(rename = "securitySchemes")]
    security_schemes: OpenApiSecuritySchemes,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenApiGatewaySurface {
    auth_mode: &'static str,
    base_path: &'static str,
    description: &'static str,
    name: &'static str,
    route_count: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenApiGatewayRoutesBySurface {
    admin: usize,
    app: usize,
    core: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenApiGatewayMetadata {
    base_path: &'static str,
    versioned_open_api_paths: [&'static str; 1],
    docs_path: &'static str,
    live_open_api_path: &'static str,
    route_catalog_path: &'static str,
    route_count: usize,
    routes_by_surface: OpenApiGatewayRoutesBySurface,
    surfaces: [OpenApiGatewaySurface; 3],
}

#[derive(Serialize)]
struct OpenApiOperation {
    #[serde(rename = "operationId")]
    operation_id: &'static str,
    summary: &'static str,
    description: String,
    tags: [&'static str; 1],
    responses: BTreeMap<&'static str, OpenApiResponse>,
    #[serde(skip_serializing_if = "Option::is_none")]
    security: Option<Vec<BTreeMap<&'static str, Vec<String>>>>,
    #[serde(rename = "x-sdkwork-auth-mode")]
    auth_mode: &'static str,
    #[serde(rename = "x-sdkwork-surface")]
    surface: &'static str,
}

#[derive(Serialize)]
struct OpenApiDocument {
    openapi: &'static str,
    info: OpenApiInfo,
    servers: Vec<OpenApiServer>,
    tags: Vec<OpenApiTag>,
    components: OpenApiComponents,
    paths: BTreeMap<String, BTreeMap<&'static str, OpenApiOperation>>,
    #[serde(rename = "x-sdkwork-api-gateway")]
    gateway: OpenApiGatewayMetadata,
}

struct RouteSpec {
    method: &'static str,
    operation_id: &'static str,
    path: &'static str,
    summary: &'static str,
    tag: &'static str,
}

fn surface_description(surface: &str) -> &'static str {
    match surface {
        "core" => "Core coding runtime, engine catalog, session execution, and operation control.",
        "app" => "Application-facing workspace, project, collaboration, and user-center routes.",
        "admin" => {
            "Administrative governance, audit, release, deployment, and team-management routes."
        }
        _ => "Unified BirdCoder API surface.",
    }
}

fn surface_auth_mode(surface: &str) -> &'static str {
    match surface {
        "core" => "host",
        "app" => "user",
        "admin" => "admin",
        _ => "host",
    }
}

fn to_openapi_path_template(path: &str) -> String {
    if !path.starts_with('/') {
        return path.to_owned();
    }

    path.split('/')
        .map(|segment| {
            if let Some(parameter_name) = segment.strip_prefix(':') {
                if parameter_name.is_empty() {
                    segment.to_owned()
                } else {
                    format!("{{{parameter_name}}}")
                }
            } else {
                segment.to_owned()
            }
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn openapi_operation_description(route_spec: &RouteSpec) -> String {
    let auth_description = match surface_auth_mode(route_spec.tag) {
        "host" => {
            "No user session is required; this route is available on the host runtime surface."
        }
        "user" => "Requires an authenticated BirdCoder user session.",
        "admin" => "Requires an authenticated BirdCoder admin session.",
        _ => "Authentication requirements are implementation-defined.",
    };

    format!("{}. {auth_description}", route_spec.summary)
}

fn openapi_operation_responses() -> BTreeMap<&'static str, OpenApiResponse> {
    BTreeMap::from([
        (
            "200",
            OpenApiResponse {
                description: "Successful response",
            },
        ),
        (
            "default",
            OpenApiResponse {
                description: "Problem response",
            },
        ),
    ])
}

fn openapi_operation_security(
    route_spec: &RouteSpec,
) -> Option<Vec<BTreeMap<&'static str, Vec<String>>>> {
    match surface_auth_mode(route_spec.tag) {
        "host" => None,
        _ => Some(vec![BTreeMap::from([("bearerAuth", Vec::new())])]),
    }
}

fn build_openapi_gateway_metadata() -> OpenApiGatewayMetadata {
    let core_route_count = count_routes_for_surface("core");
    let app_route_count = count_routes_for_surface("app");
    let admin_route_count = count_routes_for_surface("admin");

    OpenApiGatewayMetadata {
        base_path: CODING_SERVER_GATEWAY_BASE_PATH,
        versioned_open_api_paths: [CODING_SERVER_OPENAPI_PATH],
        docs_path: CODING_SERVER_DOCS_PATH,
        live_open_api_path: CODING_SERVER_LIVE_OPENAPI_PATH,
        route_catalog_path: CODING_SERVER_ROUTE_CATALOG_PATH,
        route_count: CODING_SERVER_OPENAPI_ROUTE_SPECS.len(),
        routes_by_surface: OpenApiGatewayRoutesBySurface {
            admin: admin_route_count,
            app: app_route_count,
            core: core_route_count,
        },
        surfaces: [
            OpenApiGatewaySurface {
                auth_mode: "host",
                base_path: CODING_SERVER_CORE_API_PREFIX,
                description: surface_description("core"),
                name: "core",
                route_count: core_route_count,
            },
            OpenApiGatewaySurface {
                auth_mode: "user",
                base_path: CODING_SERVER_APP_API_PREFIX,
                description: surface_description("app"),
                name: "app",
                route_count: app_route_count,
            },
            OpenApiGatewaySurface {
                auth_mode: "admin",
                base_path: CODING_SERVER_ADMIN_API_PREFIX,
                description: surface_description("admin"),
                name: "admin",
                route_count: admin_route_count,
            },
        ],
    }
}

fn count_routes_for_surface(surface: &str) -> usize {
    CODING_SERVER_OPENAPI_ROUTE_SPECS
        .iter()
        .filter(|route_spec| route_spec.tag == surface)
        .count()
}

fn build_gateway_descriptor_payload() -> GatewayDescriptorPayload {
    let core_route_count = count_routes_for_surface("core");
    let app_route_count = count_routes_for_surface("app");
    let admin_route_count = count_routes_for_surface("admin");

    GatewayDescriptorPayload {
        base_path: CODING_SERVER_GATEWAY_BASE_PATH,
        docs_path: CODING_SERVER_DOCS_PATH,
        live_open_api_path: CODING_SERVER_LIVE_OPENAPI_PATH,
        open_api_path: CODING_SERVER_OPENAPI_PATH,
        route_catalog_path: CODING_SERVER_ROUTE_CATALOG_PATH,
        route_count: CODING_SERVER_OPENAPI_ROUTE_SPECS.len(),
        routes_by_surface: GatewayRoutesBySurfacePayload {
            admin: admin_route_count,
            app: app_route_count,
            core: core_route_count,
        },
        surfaces: [
            GatewaySurfaceDescriptorPayload {
                auth_mode: "host",
                base_path: CODING_SERVER_CORE_API_PREFIX,
                description: surface_description("core"),
                name: "core",
                route_count: core_route_count,
            },
            GatewaySurfaceDescriptorPayload {
                auth_mode: "user",
                base_path: CODING_SERVER_APP_API_PREFIX,
                description: surface_description("app"),
                name: "app",
                route_count: app_route_count,
            },
            GatewaySurfaceDescriptorPayload {
                auth_mode: "admin",
                base_path: CODING_SERVER_ADMIN_API_PREFIX,
                description: surface_description("admin"),
                name: "admin",
                route_count: admin_route_count,
            },
        ],
    }
}

fn build_route_catalog_payloads() -> Vec<RouteCatalogEntryPayload> {
    CODING_SERVER_OPENAPI_ROUTE_SPECS
        .iter()
        .map(|route_spec| RouteCatalogEntryPayload {
            auth_mode: surface_auth_mode(route_spec.tag),
            method: route_spec.method,
            open_api_path: to_openapi_path_template(route_spec.path),
            operation_id: route_spec.operation_id,
            path: route_spec.path,
            surface: route_spec.tag,
            summary: route_spec.summary,
        })
        .collect()
}

fn build_coding_server_docs_html() -> String {
    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SDKWork BirdCoder Coding Server API</title>
  <style>
    :root {{
      color-scheme: light;
      --bg: #f6f2ea;
      --panel: #fffdf9;
      --ink: #1f2933;
      --muted: #52606d;
      --border: #dbcdb8;
      --accent: #8d5a2b;
      --accent-soft: #f1e4d1;
    }}
    * {{ box-sizing: border-box; }}
    body {{
      margin: 0;
      font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      background:
        radial-gradient(circle at top right, rgba(141, 90, 43, 0.12), transparent 28%),
        linear-gradient(180deg, #fcfaf6 0%, var(--bg) 100%);
      color: var(--ink);
    }}
    main {{
      max-width: 1120px;
      margin: 0 auto;
      padding: 32px 20px 64px;
    }}
    .hero {{
      background: linear-gradient(135deg, rgba(255,255,255,0.96), rgba(252,245,232,0.92));
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 18px 50px rgba(91, 63, 35, 0.08);
    }}
    .eyebrow {{
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }}
    h1 {{
      margin: 14px 0 10px;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1.05;
    }}
    p {{
      margin: 0;
      line-height: 1.6;
      color: var(--muted);
    }}
    .panel {{
      margin-top: 20px;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 20px;
    }}
    .grid {{
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      margin-top: 22px;
    }}
    a {{
      color: var(--accent);
      font-weight: 600;
      text-decoration: none;
    }}
    code {{
      font-family: "Cascadia Code", "Consolas", monospace;
      font-size: 13px;
      background: rgba(141, 90, 43, 0.08);
      border-radius: 8px;
      padding: 2px 6px;
    }}
    ul {{
      margin: 10px 0 0;
      padding-left: 18px;
      color: var(--muted);
    }}
    li + li {{
      margin-top: 8px;
    }}
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <span class="eyebrow">OpenAPI 3.1</span>
      <h1>SDKWork BirdCoder Coding Server API</h1>
      <p>The live schema follows the same single-port API gateway exposed by the BirdCoder host. Use the unified prefixes for core, app, and admin traffic.</p>
      <div class="grid">
        <div class="panel">
          <strong>Live Schema</strong>
          <p><a href="{live_openapi_path}"><code>{live_openapi_path}</code></a></p>
        </div>
        <div class="panel">
          <strong>Versioned Schema</strong>
          <p><a href="{versioned_openapi_path}"><code>{versioned_openapi_path}</code></a></p>
        </div>
        <div class="panel">
          <strong>Unified Gateway</strong>
          <p><code>{gateway_base_path}</code></p>
        </div>
        <div class="panel">
          <strong>Route Catalog</strong>
          <p><a href="{route_catalog_path}"><code>{route_catalog_path}</code></a></p>
        </div>
      </div>
    </section>
    <section class="panel">
      <strong>Gateway Surfaces</strong>
      <ul>
        <li><code>{core_prefix}</code> core runtime, engines, sessions, events, approvals, and operations</li>
        <li><code>{app_prefix}</code> auth, user center, workspaces, projects, collaborators, teams, and deployments</li>
        <li><code>{admin_prefix}</code> audit, policies, teams, releases, deployments, and governed targets</li>
      </ul>
    </section>
  </main>
</body>
</html>"#,
        live_openapi_path = CODING_SERVER_LIVE_OPENAPI_PATH,
        versioned_openapi_path = CODING_SERVER_OPENAPI_PATH,
        gateway_base_path = CODING_SERVER_GATEWAY_BASE_PATH,
        route_catalog_path = CODING_SERVER_ROUTE_CATALOG_PATH,
        core_prefix = CODING_SERVER_CORE_API_PREFIX,
        app_prefix = CODING_SERVER_APP_API_PREFIX,
        admin_prefix = CODING_SERVER_ADMIN_API_PREFIX,
    )
}

pub fn build_coding_server_startup_summary_lines(api_base_url: &str) -> Vec<String> {
    let normalized_base_url = api_base_url.trim().trim_end_matches('/');
    let gateway_base_url = format!("{normalized_base_url}{CODING_SERVER_GATEWAY_BASE_PATH}");
    let live_openapi_url = format!("{normalized_base_url}{CODING_SERVER_LIVE_OPENAPI_PATH}");
    let versioned_openapi_url = format!("{normalized_base_url}{CODING_SERVER_OPENAPI_PATH}");
    let docs_url = format!("{normalized_base_url}{CODING_SERVER_DOCS_PATH}");
    let route_catalog_url = format!("{normalized_base_url}{CODING_SERVER_ROUTE_CATALOG_PATH}");
    let core_url = format!("{normalized_base_url}{CODING_SERVER_CORE_API_PREFIX}");
    let app_url = format!("{normalized_base_url}{CODING_SERVER_APP_API_PREFIX}");
    let admin_url = format!("{normalized_base_url}{CODING_SERVER_ADMIN_API_PREFIX}");
    let core_route_count = count_routes_for_surface("core");
    let app_route_count = count_routes_for_surface("app");
    let admin_route_count = count_routes_for_surface("admin");

    vec![
        "------------------------------------------------------------".to_owned(),
        "SDKWork BirdCoder Unified API Gateway".to_owned(),
        format!("  Base URL: {normalized_base_url}"),
        format!("  Unified Gateway Base: {gateway_base_url}"),
        format!("  Live OpenAPI 3.x Schema: {live_openapi_url}"),
        format!("  Versioned OpenAPI Schema: {versioned_openapi_url}"),
        format!("  API Docs: {docs_url}"),
        format!("  Route Catalog: {route_catalog_url}"),
        format!("  Core API Prefix: {core_url}"),
        format!("  App API Prefix: {app_url}"),
        format!("  Admin API Prefix: {admin_url}"),
        format!(
            "  Route Counts: total={} core={} app={} admin={}",
            CODING_SERVER_OPENAPI_ROUTE_SPECS.len(),
            core_route_count,
            app_route_count,
            admin_route_count
        ),
    ]
}

pub fn print_coding_server_startup_summary(api_base_url: &str) {
    for line in build_coding_server_startup_summary_lines(api_base_url) {
        println!("{line}");
    }
}

fn build_demo_metadata(entries: &[(&str, &str)]) -> BTreeMap<String, String> {
    entries
        .iter()
        .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
        .collect()
}

fn current_session_timestamp() -> String {
    current_storage_timestamp()
}

fn create_identifier(prefix: &str) -> String {
    format!("{prefix}-{}", Uuid::new_v4().simple())
}

struct SeedSkillEntry {
    id: &'static str,
    slug: &'static str,
    name: &'static str,
    description: &'static str,
    icon: &'static str,
    author: &'static str,
    install_count: usize,
    long_description: &'static str,
    tags: &'static [&'static str],
    license: Option<&'static str>,
    repository_url: Option<&'static str>,
    readme: Option<&'static str>,
    capability_key: &'static str,
    capability_description: &'static str,
}

struct SeedSkillPackage {
    package_id: &'static str,
    slug: &'static str,
    name: &'static str,
    description: &'static str,
    icon: &'static str,
    author: &'static str,
    install_count: usize,
    long_description: &'static str,
    source_uri: &'static str,
    version_id: &'static str,
    version_label: &'static str,
    skills: &'static [SeedSkillEntry],
}

struct SeedTemplate {
    template_id: &'static str,
    slug: &'static str,
    name: &'static str,
    category: &'static str,
    status: &'static str,
    version_id: &'static str,
    version_label: &'static str,
    preset_id: &'static str,
    preset_key: &'static str,
    description: &'static str,
    icon: &'static str,
    author: &'static str,
    downloads: usize,
    stars: usize,
    tags: &'static [&'static str],
    target_profiles: &'static [(&'static str, &'static str, &'static str, &'static str)],
    long_description: &'static str,
}

const SKILL_README_REACT: &str = r#"## React Expert

High-signal guidance for component architecture, state flow, and rendering performance in production React codebases."#;

const SKILL_README_DOCKER: &str = r#"## Docker Wizard

Standardized container build, compose, and delivery guidance for local and CI execution."#;

const SKILL_README_BIRDCODER: &str = r#"## BirdCoder Delivery Suite

Official BirdCoder workflow package for repository onboarding, policy-aware release execution, and IDE automation."#;

const SEED_SKILLS_FULLSTACK: &[SeedSkillEntry] = &[
    SeedSkillEntry {
        id: "skill-react-expert",
        slug: "react-expert",
        name: "React Expert",
        description: "Advanced React patterns, architecture, and performance tuning.",
        icon: "RE",
        author: "Community",
        install_count: 12000,
        long_description: "Deep assistance for component boundaries, hooks, state orchestration, and render-path optimization.",
        tags: &["Frontend", "React", "Performance"],
        license: Some("MIT"),
        repository_url: Some("https://github.com/sdkwork/catalog/react-expert"),
        readme: Some(SKILL_README_REACT),
        capability_key: "react.architecture",
        capability_description: "Design React component, hook, and rendering strategies.",
    },
    SeedSkillEntry {
        id: "skill-typescript-pro",
        slug: "typescript-pro",
        name: "TypeScript Pro",
        description: "Strict typing, schema design, and migration support.",
        icon: "TS",
        author: "Community",
        install_count: 25000,
        long_description: "Guidance for industrial TypeScript typing, utility type composition, and domain-model hardening.",
        tags: &["TypeScript", "Architecture", "API"],
        license: Some("MIT"),
        repository_url: Some("https://github.com/sdkwork/catalog/typescript-pro"),
        readme: None,
        capability_key: "typescript.modeling",
        capability_description: "Model rich TypeScript domains with strict types.",
    },
    SeedSkillEntry {
        id: "skill-node-backend",
        slug: "node-backend",
        name: "Node Backend",
        description: "Service design, API contracts, and persistence integration.",
        icon: "NB",
        author: "Community",
        install_count: 15000,
        long_description: "Backend delivery support spanning routing, storage, and runtime diagnostics.",
        tags: &["Backend", "Node.js", "API"],
        license: Some("Apache-2.0"),
        repository_url: Some("https://github.com/sdkwork/catalog/node-backend"),
        readme: None,
        capability_key: "backend.service",
        capability_description: "Design and implement backend service APIs.",
    },
];

const SEED_SKILLS_DEVOPS: &[SeedSkillEntry] = &[
    SeedSkillEntry {
        id: "skill-docker-wizard",
        slug: "docker-wizard",
        name: "Docker Wizard",
        description: "Containerization, Docker Compose, and build pipeline guidance.",
        icon: "DK",
        author: "Community",
        install_count: 18000,
        long_description: "Production-focused container build patterns, compose workflows, and runtime diagnostics.",
        tags: &["DevOps", "Docker", "Containers"],
        license: Some("Apache-2.0"),
        repository_url: Some("https://github.com/sdkwork/catalog/docker-wizard"),
        readme: Some(SKILL_README_DOCKER),
        capability_key: "devops.container",
        capability_description: "Author Dockerfiles, compose specs, and container workflows.",
    },
    SeedSkillEntry {
        id: "skill-git-assistant",
        slug: "git-assistant",
        name: "Git Assistant",
        description: "Version control workflows, rebasing, and conflict resolution.",
        icon: "GT",
        author: "Community",
        install_count: 30000,
        long_description: "Operational guidance for branching strategy, merge safety, and history repair.",
        tags: &["Git", "Workflow", "Delivery"],
        license: Some("MIT"),
        repository_url: Some("https://github.com/sdkwork/catalog/git-assistant"),
        readme: None,
        capability_key: "delivery.git",
        capability_description: "Guide branching, rebasing, and merge operations.",
    },
    SeedSkillEntry {
        id: "skill-aws-architect",
        slug: "aws-architect",
        name: "AWS Architect",
        description: "Cloud infrastructure, deployment topology, and operations design.",
        icon: "AWS",
        author: "Community",
        install_count: 9200,
        long_description: "Covers cloud topology, IAM boundaries, networking, and environment rollout design.",
        tags: &["Cloud", "AWS", "Infrastructure"],
        license: Some("Apache-2.0"),
        repository_url: Some("https://github.com/sdkwork/catalog/aws-architect"),
        readme: None,
        capability_key: "cloud.aws",
        capability_description: "Design AWS infrastructure and delivery patterns.",
    },
];

const SEED_SKILLS_BIRDCODER: &[SeedSkillEntry] = &[
    SeedSkillEntry {
        id: "skill-birdcoder-cli",
        slug: "birdcoder-cli",
        name: "BirdCoder CLI",
        description: "Official CLI automation, repo bootstrap, and task orchestration.",
        icon: "BC",
        author: "SDKWork",
        install_count: 5100,
        long_description: "Official BirdCoder CLI companion for repo onboarding, scripted execution, and maintenance workflows.",
        tags: &["BirdCoder", "CLI", "Automation"],
        license: Some("Apache-2.0"),
        repository_url: Some("https://github.com/sdkwork/birdcoder-cli"),
        readme: Some(SKILL_README_BIRDCODER),
        capability_key: "birdcoder.cli",
        capability_description: "Run BirdCoder automation and repository workflows.",
    },
    SeedSkillEntry {
        id: "skill-birdcoder-release",
        slug: "birdcoder-release",
        name: "BirdCoder Release",
        description: "Release orchestration, deployment policy, and rollout safety.",
        icon: "RL",
        author: "SDKWork",
        install_count: 4300,
        long_description: "Standardized release flow support with approval and deployment guardrails.",
        tags: &["BirdCoder", "Release", "Governance"],
        license: Some("Apache-2.0"),
        repository_url: Some("https://github.com/sdkwork/birdcoder-release"),
        readme: None,
        capability_key: "birdcoder.release",
        capability_description: "Coordinate release flow and governed rollout operations.",
    },
    SeedSkillEntry {
        id: "skill-birdcoder-auth",
        slug: "birdcoder-auth",
        name: "BirdCoder Auth",
        description: "Local and external user-center integration patterns.",
        icon: "AU",
        author: "SDKWork",
        install_count: 3900,
        long_description: "Support user-center plugin design, authentication wiring, and identity-aware API flows.",
        tags: &["BirdCoder", "Auth", "User Center"],
        license: Some("Apache-2.0"),
        repository_url: Some("https://github.com/sdkwork/birdcoder-auth"),
        readme: None,
        capability_key: "birdcoder.user-center",
        capability_description: "Integrate BirdCoder user-center modules and auth flows.",
    },
];

const SEED_SKILL_PACKAGES: &[SeedSkillPackage] = &[
    SeedSkillPackage {
        package_id: "skill-package-fullstack",
        slug: "fullstack-web-bundle",
        name: "Fullstack Web Bundle",
        description: "Frontend, TypeScript, and backend delivery in one standardized package.",
        icon: "FS",
        author: "SDKWork",
        install_count: 45000,
        long_description: "Curated package for modern TypeScript application delivery across UI and service layers.",
        source_uri: "registry://official/fullstack-web-bundle",
        version_id: "skill-version-fullstack-v1",
        version_label: "1.0.0",
        skills: SEED_SKILLS_FULLSTACK,
    },
    SeedSkillPackage {
        package_id: "skill-package-devops",
        slug: "devops-cloud-mastery",
        name: "DevOps & Cloud Mastery",
        description: "Operational tooling for container, Git, and cloud delivery.",
        icon: "DO",
        author: "SDKWork",
        install_count: 22000,
        long_description: "Delivery-oriented package for build, release, and infrastructure operations.",
        source_uri: "registry://official/devops-cloud-mastery",
        version_id: "skill-version-devops-v1",
        version_label: "1.0.0",
        skills: SEED_SKILLS_DEVOPS,
    },
    SeedSkillPackage {
        package_id: "skill-package-birdcoder",
        slug: "birdcoder-official-suite",
        name: "BirdCoder Official Suite",
        description: "Official BirdCoder delivery, auth, and automation package.",
        icon: "BW",
        author: "SDKWork",
        install_count: 15000,
        long_description: "First-party package for BirdCoder workflow automation and platform operations.",
        source_uri: "registry://official/birdcoder-official-suite",
        version_id: "skill-version-birdcoder-v1",
        version_label: "1.0.0",
        skills: SEED_SKILLS_BIRDCODER,
    },
];

const SEED_TEMPLATES: &[SeedTemplate] = &[
    SeedTemplate {
        template_id: "app-template-next-blog",
        slug: "next-blog-starter",
        name: "Next.js Blog Starter",
        category: "community",
        status: "active",
        version_id: "app-template-version-next-blog-v1",
        version_label: "1.0.0",
        preset_id: "app-template-preset-next-blog-default",
        preset_key: "default",
        description: "Next.js 14 blog starter with App Router, Tailwind CSS, and MDX.",
        icon: "NX",
        author: "Community",
        downloads: 12000,
        stars: 4500,
        tags: &["Next.js", "React", "Tailwind"],
        target_profiles: &[("profile-web", "web", "web", "standard")],
        long_description: "Production-ready content starter for documentation, blog, and marketing experiences.",
    },
    SeedTemplate {
        template_id: "app-template-fastapi",
        slug: "python-fastapi-service",
        name: "Python FastAPI Service",
        category: "community",
        status: "active",
        version_id: "app-template-version-fastapi-v1",
        version_label: "1.0.0",
        preset_id: "app-template-preset-fastapi-default",
        preset_key: "default",
        description: "High-performance backend starter with FastAPI, SQLAlchemy, and Alembic.",
        icon: "PY",
        author: "Community",
        downloads: 11000,
        stars: 4100,
        tags: &["Python", "FastAPI", "Backend"],
        target_profiles: &[("profile-server", "server", "server", "service")],
        long_description: "Backend service template with pragmatic defaults for API, persistence, and migration flow.",
    },
    SeedTemplate {
        template_id: "app-template-ai-agent",
        slug: "ai-agent-scaffolding",
        name: "AI Agent Scaffolding",
        category: "saas",
        status: "active",
        version_id: "app-template-version-ai-agent-v1",
        version_label: "1.0.0",
        preset_id: "app-template-preset-ai-agent-default",
        preset_key: "default",
        description: "Multi-runtime AI agent starter with model routing and workflow modules.",
        icon: "AI",
        author: "SDKWork",
        downloads: 18000,
        stars: 6500,
        tags: &["AI", "Agent", "Workflow"],
        target_profiles: &[
            ("profile-fullstack", "fullstack", "server", "fullstack"),
            ("profile-agent", "agent-tooling", "server", "service"),
        ],
        long_description: "Official agent starter aligned to BirdCoder server orchestration and tool execution.",
    },
    SeedTemplate {
        template_id: "app-template-erp",
        slug: "sdkwork-erp-base",
        name: "SDKWork ERP Base",
        category: "saas",
        status: "active",
        version_id: "app-template-version-erp-v1",
        version_label: "1.0.0",
        preset_id: "app-template-preset-erp-default",
        preset_key: "default",
        description: "Enterprise ERP base with multi-tenant modular domain layout.",
        icon: "ERP",
        author: "SDKWork",
        downloads: 5100,
        stars: 1200,
        tags: &["ERP", "Multi-tenant", "SaaS"],
        target_profiles: &[("profile-fullstack", "fullstack", "server", "fullstack")],
        long_description: "Internal enterprise-grade starter for modular multi-tenant applications.",
    },
];

fn ensure_sqlite_catalog_seed_data(connection: &Connection) -> Result<(), String> {
    let seeded_skill_packages = connection
        .query_row(
            "SELECT COUNT(*) FROM skill_packages WHERE is_deleted = 0",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("count skill package catalog failed: {error}"))?;
    if seeded_skill_packages == 0 {
        for package in SEED_SKILL_PACKAGES {
            let now = current_storage_timestamp();
            let package_manifest = json!({
                "name": package.name,
                "description": package.description,
                "icon": package.icon,
                "author": package.author,
                "installCount": package.install_count,
                "longDescription": package.long_description,
            })
            .to_string();
            let version_manifest = json!({
                "skills": package.skills.iter().map(|skill| json!({
                    "id": skill.id,
                    "slug": skill.slug,
                    "name": skill.name,
                    "description": skill.description,
                    "icon": skill.icon,
                    "author": skill.author,
                    "installCount": skill.install_count,
                    "longDescription": skill.long_description,
                    "tags": skill.tags,
                    "license": skill.license,
                    "repositoryUrl": skill.repository_url,
                    "readme": skill.readme,
                })).collect::<Vec<_>>(),
            })
            .to_string();

            connection
                .execute(
                    r#"
                    INSERT INTO skill_packages (
                        id, created_at, updated_at, version, is_deleted, slug, source_uri, status, manifest_json
                    ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7)
                    "#,
                    params![
                        package.package_id,
                        &now,
                        &now,
                        package.slug,
                        package.source_uri,
                        "active",
                        &package_manifest,
                    ],
                )
                .map_err(|error| format!("insert skill package {} failed: {error}", package.package_id))?;

            connection
                .execute(
                    r#"
                    INSERT INTO skill_versions (
                        id, created_at, updated_at, version, is_deleted, skill_package_id, version_label, manifest_json, status
                    ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7)
                    "#,
                    params![
                        package.version_id,
                        &now,
                        &now,
                        package.package_id,
                        package.version_label,
                        &version_manifest,
                        "active",
                    ],
                )
                .map_err(|error| format!("insert skill version {} failed: {error}", package.version_id))?;

            for skill in package.skills {
                let capability_payload = json!({
                    "skillId": skill.id,
                    "skillSlug": skill.slug,
                    "skillName": skill.name,
                })
                .to_string();
                connection
                    .execute(
                        r#"
                        INSERT INTO skill_capabilities (
                            id, created_at, updated_at, version, is_deleted, skill_version_id, capability_key, description_text, payload_json
                        ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7)
                        "#,
                        params![
                            format!("skill-capability-{}", skill.id),
                            &now,
                            &now,
                            package.version_id,
                            skill.capability_key,
                            skill.capability_description,
                            &capability_payload,
                        ],
                    )
                    .map_err(|error| format!("insert skill capability {} failed: {error}", skill.id))?;
            }
        }
    }

    let seeded_templates = connection
        .query_row(
            "SELECT COUNT(*) FROM app_templates WHERE is_deleted = 0",
            [],
            |row| row.get::<_, i64>(0),
        )
        .map_err(|error| format!("count app template catalog failed: {error}"))?;
    if seeded_templates == 0 {
        for template in SEED_TEMPLATES {
            let now = current_storage_timestamp();
            let version_manifest = json!({
                "description": template.description,
                "icon": template.icon,
                "author": template.author,
                "downloads": template.downloads,
                "stars": template.stars,
                "tags": template.tags,
                "longDescription": template.long_description,
            })
            .to_string();
            let preset_payload = json!({
                "promptSeed": template.description,
                "relativeOutputDir": ".",
                "scaffoldFiles": [],
            })
            .to_string();

            connection
                .execute(
                    r#"
                    INSERT INTO app_templates (
                        id, created_at, updated_at, version, is_deleted, slug, name, category, status
                    ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7)
                    "#,
                    params![
                        template.template_id,
                        &now,
                        &now,
                        template.slug,
                        template.name,
                        template.category,
                        template.status,
                    ],
                )
                .map_err(|error| format!("insert app template {} failed: {error}", template.template_id))?;

            connection
                .execute(
                    r#"
                    INSERT INTO app_template_versions (
                        id, created_at, updated_at, version, is_deleted, app_template_id, version_label, manifest_json, status
                    ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7)
                    "#,
                    params![
                        template.version_id,
                        &now,
                        &now,
                        template.template_id,
                        template.version_label,
                        &version_manifest,
                        template.status,
                    ],
                )
                .map_err(|error| format!("insert app template version {} failed: {error}", template.version_id))?;

            connection
                .execute(
                    r#"
                    INSERT INTO app_template_presets (
                        id, created_at, updated_at, version, is_deleted, app_template_version_id, preset_key, description_text, payload_json
                    ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7)
                    "#,
                    params![
                        template.preset_id,
                        &now,
                        &now,
                        template.version_id,
                        template.preset_key,
                        template.description,
                        &preset_payload,
                    ],
                )
                .map_err(|error| format!("insert app template preset {} failed: {error}", template.preset_id))?;

            for (profile_id, profile_key, runtime, deployment_mode) in template.target_profiles {
                connection
                    .execute(
                        r#"
                        INSERT INTO app_template_target_profiles (
                            id, created_at, updated_at, version, is_deleted, app_template_version_id, profile_key, runtime, deployment_mode, status
                        ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8)
                        "#,
                        params![
                            format!("{profile_id}-{}", template.template_id),
                            &now,
                            &now,
                            template.version_id,
                            profile_key,
                            runtime,
                            deployment_mode,
                            template.status,
                        ],
                    )
                    .map_err(|error| {
                        format!(
                            "insert app template target profile {profile_key} for {} failed: {error}",
                            template.template_id
                        )
                    })?;
            }
        }
    }

    Ok(())
}

fn build_engine_catalog() -> Vec<EngineDescriptorPayload> {
    list_codeengine_descriptors()
}

fn build_model_catalog() -> Vec<ModelCatalogEntryPayload> {
    list_codeengine_model_catalog_entries()
}

fn build_native_session_provider_catalog() -> Vec<NativeSessionProviderPayload> {
    list_native_session_provider_catalog_entries()
}

fn find_engine_descriptor(engine_key: &str) -> Option<EngineDescriptorPayload> {
    find_codeengine_descriptor(engine_key)
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

fn normalize_turn_current_file_context(
    value: Option<CodingSessionTurnCurrentFileContextPayload>,
) -> Option<CodingSessionTurnCurrentFileContextPayload> {
    let value = value?;
    let path = normalize_required_string(value.path)?;
    Some(CodingSessionTurnCurrentFileContextPayload {
        path,
        content: normalize_optional_string(value.content),
        language: normalize_optional_string(value.language),
    })
}

fn normalize_turn_ide_context(
    value: Option<CodingSessionTurnIdeContextPayload>,
) -> Option<CodingSessionTurnIdeContextPayload> {
    let value = value?;
    let normalized = CodingSessionTurnIdeContextPayload {
        workspace_id: normalize_optional_string(value.workspace_id),
        project_id: normalize_optional_string(value.project_id),
        thread_id: normalize_optional_string(value.thread_id),
        current_file: normalize_turn_current_file_context(value.current_file),
    };

    if normalized.workspace_id.is_none()
        && normalized.project_id.is_none()
        && normalized.thread_id.is_none()
        && normalized.current_file.is_none()
    {
        None
    } else {
        Some(normalized)
    }
}

fn sanitize_business_code_segment(value: &str) -> String {
    let mut normalized = String::with_capacity(value.len());
    let mut previous_was_separator = false;

    for character in value.chars() {
        let upper = character.to_ascii_uppercase();
        if upper.is_ascii_alphanumeric() {
            normalized.push(upper);
            previous_was_separator = false;
        } else if !previous_was_separator {
            normalized.push('-');
            previous_was_separator = true;
        }
    }

    normalized.trim_matches('-').to_owned()
}

fn build_business_code(prefix: &str, primary_value: &str, fallback_id: &str) -> String {
    let primary_segment = sanitize_business_code_segment(primary_value);
    let fallback_segment = sanitize_business_code_segment(fallback_id);
    let seed = if primary_segment.is_empty() {
        fallback_segment
    } else {
        primary_segment
    };
    let normalized_prefix = sanitize_business_code_segment(prefix);
    let composed = if seed.is_empty() {
        normalized_prefix
    } else {
        format!("{normalized_prefix}-{seed}")
    };
    composed.chars().take(64).collect()
}

fn build_workspace_business_code(workspace_id: &str, name: &str) -> String {
    build_business_code("WKSP", name, workspace_id)
}

fn build_project_business_code(project_id: &str, name: &str, root_path: Option<&str>) -> String {
    let primary_value = root_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(name);
    build_business_code("PROJ", primary_value, project_id)
}

fn build_team_business_code(team_id: &str, name: &str) -> String {
    build_business_code("TEAM", name, team_id)
}

fn normalize_workspace_status(value: Option<String>) -> Result<Option<String>, &'static str> {
    let normalized_value = normalize_optional_string(value);
    if normalized_value
        .as_deref()
        .is_some_and(|status| !matches!(status, "active" | "archived"))
    {
        return Err("workspace status must be active or archived.");
    }

    Ok(normalized_value)
}

fn normalize_project_status(value: Option<String>) -> Result<Option<String>, &'static str> {
    let normalized_value = normalize_optional_string(value);
    if normalized_value
        .as_deref()
        .is_some_and(|status| !matches!(status, "active" | "archived"))
    {
        return Err("project status must be active or archived.");
    }

    Ok(normalized_value)
}

fn normalize_collaboration_role(value: Option<String>) -> Result<Option<String>, &'static str> {
    let normalized_value = normalize_optional_string(value);
    if normalized_value
        .as_deref()
        .is_some_and(|role| !matches!(role, "owner" | "admin" | "member" | "viewer"))
    {
        return Err("collaboration role must be owner/admin/member/viewer.");
    }

    Ok(normalized_value)
}

fn normalize_collaboration_status(value: Option<String>) -> Result<Option<String>, &'static str> {
    let normalized_value = normalize_optional_string(value);
    if normalized_value
        .as_deref()
        .is_some_and(|status| !matches!(status, "invited" | "active" | "suspended" | "removed"))
    {
        return Err("collaboration status must be invited/active/suspended/removed.");
    }

    Ok(normalized_value)
}

fn collapse_project_path_separators(value: &str, preserve_double_leading: bool) -> String {
    let mut result = String::new();
    let mut characters = value.chars().peekable();
    let mut leading_slashes = 0usize;

    while characters.peek().is_some_and(|character| *character == '/') {
        leading_slashes += 1;
        characters.next();
    }

    if preserve_double_leading && leading_slashes >= 2 {
        result.push_str("//");
    } else if leading_slashes > 0 {
        result.push('/');
    }

    let mut previous_was_slash = false;
    for character in characters {
        if character == '/' {
            if !previous_was_slash {
                result.push(character);
                previous_was_slash = true;
            }
        } else {
            result.push(character);
            previous_was_slash = false;
        }
    }

    result
}

fn normalize_project_root_path_for_lookup(value: &str) -> String {
    let trimmed_value = value.trim();
    let is_windows_style_path = trimmed_value.starts_with("\\\\")
        || trimmed_value.starts_with("//")
        || trimmed_value.contains('\\')
        || trimmed_value
            .chars()
            .nth(1)
            .is_some_and(|character| character == ':');
    let normalized_separators = trimmed_value.replace('\\', "/");
    let collapsed_path = collapse_project_path_separators(
        &normalized_separators,
        normalized_separators.starts_with("//"),
    );
    let without_trailing_separator = if collapsed_path == "/" {
        collapsed_path
    } else {
        collapsed_path.trim_end_matches('/').to_owned()
    };

    if is_windows_style_path {
        without_trailing_separator.to_ascii_lowercase()
    } else {
        without_trailing_separator
    }
}

fn is_absolute_project_root_path(value: &str) -> bool {
    let trimmed_value = value.trim();
    if trimmed_value.is_empty() {
        return false;
    }

    trimmed_value.starts_with('/')
        || trimmed_value.starts_with("\\\\")
        || trimmed_value.starts_with("//")
        || trimmed_value.starts_with("\\\\?\\")
        || trimmed_value
            .chars()
            .nth(1)
            .is_some_and(|character| character == ':')
}

fn project_has_absolute_catalog_root_path(project: &ProjectPayload) -> bool {
    project
        .root_path
        .as_deref()
        .is_some_and(is_absolute_project_root_path)
}

fn normalize_optional_project_root_path(
    value: Option<String>,
) -> Result<Option<String>, &'static str> {
    let normalized_value = normalize_optional_string(value);
    if normalized_value
        .as_deref()
        .is_some_and(|root_path| !is_absolute_project_root_path(root_path))
    {
        return Err("project rootPath must be an absolute path.");
    }

    Ok(normalized_value)
}

fn find_provider_project_payload_by_workspace_and_root_path(
    connection: &Connection,
    workspace_id: &str,
    root_path: &str,
    excluded_project_id: Option<&str>,
) -> Result<Option<ProjectPayload>, String> {
    let normalized_root_path = normalize_project_root_path_for_lookup(root_path);
    let projects = load_provider_project_payloads(connection)?;

    Ok(projects.into_iter().find(|project| {
        if project.workspace_id != workspace_id {
            return false;
        }

        if excluded_project_id.is_some_and(|project_id| project.id == project_id) {
            return false;
        }

        project
            .root_path
            .as_deref()
            .is_some_and(|candidate_root_path| {
                normalize_project_root_path_for_lookup(candidate_root_path) == normalized_root_path
            })
    }))
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
    let raw = fs::read_to_string(path).map_err(|error| {
        format!(
            "read runtime config file {} failed: {error}",
            path.display()
        )
    })?;
    let parsed: BirdServerRuntimeConfigFile = serde_json::from_str(&raw).map_err(|error| {
        format!(
            "parse runtime config file {} failed: {error}",
            path.display()
        )
    })?;
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
    let env_bootstrap = load_authority_bootstrap_from_env();
    if env_bootstrap.sqlite_file.is_some() || env_bootstrap.snapshot_file.is_some() {
        return Ok(env_bootstrap);
    }

    let runtime_config_path = std::env::current_dir()
        .map_err(|error| format!("resolve current working directory failed: {error}"))?
        .join(BIRD_SERVER_DEFAULT_CONFIG_FILE_NAME);

    if runtime_config_path.exists() {
        return load_authority_bootstrap_from_config_file(&runtime_config_path);
    }

    Ok(env_bootstrap)
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
        let workspace_id =
            normalize_required_string(value.workspace_id).ok_or("workspaceId is required.")?;
        let project_id =
            normalize_required_string(value.project_id).ok_or("projectId is required.")?;
        let title =
            normalize_optional_string(value.title).unwrap_or_else(|| "New Thread".to_owned());
        let host_mode =
            normalize_optional_string(value.host_mode).unwrap_or_else(|| "server".to_owned());
        let engine_id =
            normalize_optional_string(value.engine_id).unwrap_or_else(|| "codex".to_owned());
        let model_id =
            normalize_optional_string(value.model_id).or_else(|| Some(engine_id.clone()));

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

impl TryFrom<UpdateCodingSessionRequest> for UpdateCodingSessionInput {
    type Error = &'static str;

    fn try_from(value: UpdateCodingSessionRequest) -> Result<Self, Self::Error> {
        let title = normalize_optional_string(value.title);
        let status = normalize_optional_string(value.status);
        let host_mode = normalize_optional_string(value.host_mode);
        let engine_id = normalize_optional_string(value.engine_id);
        let model_id = normalize_optional_string(value.model_id);

        if title.is_none()
            && status.is_none()
            && host_mode.is_none()
            && engine_id.is_none()
            && model_id.is_none()
        {
            return Err("At least one coding session field must be provided.");
        }

        if host_mode
            .as_deref()
            .is_some_and(|value| !matches!(value, "web" | "desktop" | "server"))
        {
            return Err("hostMode must be one of web/desktop/server.");
        }

        if status.as_deref().is_some_and(|value| {
            !matches!(value, "draft" | "active" | "paused" | "completed" | "archived")
        }) {
            return Err("status must be one of draft/active/paused/completed/archived.");
        }

        Ok(Self {
            title,
            status,
            host_mode,
            engine_id,
            model_id,
        })
    }
}

impl TryFrom<ForkCodingSessionRequest> for ForkCodingSessionInput {
    type Error = &'static str;

    fn try_from(value: ForkCodingSessionRequest) -> Result<Self, Self::Error> {
        Ok(Self {
            title: normalize_optional_string(value.title),
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
            ide_context: normalize_turn_ide_context(value.ide_context),
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

fn sqlite_column_exists(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
) -> Result<bool, String> {
    let pragma = format!("PRAGMA table_info({table_name})");
    let mut statement = connection
        .prepare(&pragma)
        .map_err(|error| format!("prepare sqlite table info for {table_name} failed: {error}"))?;
    let rows = statement
        .query_map([], |row| row.get::<_, String>(1))
        .map_err(|error| format!("query sqlite table info for {table_name} failed: {error}"))?;

    for row in rows {
        let existing_column_name = row
            .map_err(|error| format!("read sqlite table info for {table_name} failed: {error}"))?;
        if existing_column_name == column_name {
            return Ok(true);
        }
    }

    Ok(false)
}

fn ensure_sqlite_table_column(
    connection: &Connection,
    table_name: &str,
    column_name: &str,
    column_sql: &str,
) -> Result<(), String> {
    if sqlite_column_exists(connection, table_name, column_name)? {
        return Ok(());
    }

    connection
        .execute(
            &format!("ALTER TABLE {table_name} ADD COLUMN {column_sql}"),
            [],
        )
        .map_err(|error| {
            format!("alter sqlite table {table_name} add column {column_name} failed: {error}")
        })?;

    Ok(())
}

fn ensure_sqlite_table_columns(
    connection: &Connection,
    table_name: &str,
    columns: &[(&str, &str)],
) -> Result<(), String> {
    for (column_name, column_sql) in columns {
        ensure_sqlite_table_column(connection, table_name, column_name, column_sql)?;
    }
    Ok(())
}

fn backfill_workspace_business_columns(
    connection: &mut Connection,
) -> Result<BTreeMap<String, String>, String> {
    let workspace_rows = {
        let mut statement = connection
            .prepare(
                r#"
                SELECT
                    id,
                    name,
                    owner_id,
                    leader_id,
                    created_by_user_id,
                    uuid,
                    code,
                    title,
                    type,
                    settings_json
                FROM workspaces
                WHERE is_deleted = 0
                "#,
            )
            .map_err(|error| format!("prepare workspace canonical migration failed: {error}"))?;
        let mut rows = statement
            .query([])
            .map_err(|error| format!("query workspace canonical migration failed: {error}"))?;
        let mut records = Vec::new();
        while let Some(row) = rows
            .next()
            .map_err(|error| format!("read workspace canonical migration row failed: {error}"))?
        {
            records.push((
                row.get::<_, String>(0)
                    .map_err(|error| format!("read workspace canonical id failed: {error}"))?,
                row.get::<_, String>(1)
                    .map_err(|error| format!("read workspace canonical name failed: {error}"))?,
                row.get::<_, Option<String>>(2).map_err(|error| {
                    format!("read workspace canonical owner_id failed: {error}")
                })?,
                row.get::<_, Option<String>>(3).map_err(|error| {
                    format!("read workspace canonical leader_id failed: {error}")
                })?,
                row.get::<_, Option<String>>(4).map_err(|error| {
                    format!("read workspace canonical created_by_user_id failed: {error}")
                })?,
                row.get::<_, Option<String>>(5)
                    .map_err(|error| format!("read workspace canonical uuid failed: {error}"))?,
                row.get::<_, Option<String>>(6)
                    .map_err(|error| format!("read workspace canonical code failed: {error}"))?,
                row.get::<_, Option<String>>(7)
                    .map_err(|error| format!("read workspace canonical title failed: {error}"))?,
                row.get::<_, Option<String>>(8)
                    .map_err(|error| format!("read workspace canonical type failed: {error}"))?,
                row.get::<_, Option<String>>(9).map_err(|error| {
                    format!("read workspace canonical settings_json failed: {error}")
                })?,
            ));
        }
        records
    };

    let mut workspace_uuid_map = BTreeMap::new();
    for (
        workspace_id,
        workspace_name,
        owner_id,
        leader_id,
        created_by_user_id,
        uuid,
        code,
        title,
        workspace_type,
        settings_json,
    ) in workspace_rows
    {
        let (resolved_owner_id, resolved_leader_id, resolved_created_by_user_id) =
            resolve_effective_user_authority(
                owner_id.as_deref(),
                leader_id.as_deref(),
                created_by_user_id.as_deref(),
                None,
                None,
                None,
            );
        let resolved_uuid =
            normalize_optional_string(uuid).unwrap_or_else(|| Uuid::new_v4().to_string());
        let resolved_code = normalize_optional_string(code)
            .unwrap_or_else(|| build_workspace_business_code(&workspace_id, &workspace_name));
        let resolved_title =
            normalize_optional_string(title).unwrap_or_else(|| workspace_name.clone());
        let resolved_type =
            normalize_optional_string(workspace_type).unwrap_or_else(|| "DEFAULT".to_owned());
        let resolved_settings_json =
            normalize_optional_string(settings_json).unwrap_or_else(|| "{}".to_owned());

        connection
            .execute(
                r#"
                UPDATE workspaces
                SET
                    uuid = ?2,
                    tenant_id = COALESCE(NULLIF(TRIM(tenant_id), ''), ?3),
                    code = ?4,
                    title = ?5,
                    owner_id = ?6,
                    leader_id = ?7,
                    created_by_user_id = ?8,
                    type = ?9,
                    settings_json = ?10
                WHERE id = ?1
                "#,
                params![
                    &workspace_id,
                    &resolved_uuid,
                    SQLITE_AUTHORITY_DEFAULT_TENANT_ID,
                    &resolved_code,
                    &resolved_title,
                    &resolved_owner_id,
                    &resolved_leader_id,
                    &resolved_created_by_user_id,
                    &resolved_type,
                    &resolved_settings_json,
                ],
            )
            .map_err(|error| {
                format!("backfill workspace canonical fields {workspace_id} failed: {error}")
            })?;
        workspace_uuid_map.insert(workspace_id, resolved_uuid);
    }

    Ok(workspace_uuid_map)
}

fn backfill_project_business_columns(
    connection: &mut Connection,
    workspace_uuid_map: &BTreeMap<String, String>,
) -> Result<(), String> {
    let project_rows = {
        let mut statement = connection
            .prepare(
                r#"
                SELECT
                    id,
                    workspace_id,
                    name,
                    root_path,
                    owner_id,
                    leader_id,
                    created_by_user_id,
                    uuid,
                    code,
                    title,
                    type,
                    workspace_uuid,
                    author
                FROM projects
                WHERE is_deleted = 0
                "#,
            )
            .map_err(|error| format!("prepare project canonical migration failed: {error}"))?;
        let mut rows = statement
            .query([])
            .map_err(|error| format!("query project canonical migration failed: {error}"))?;
        let mut records = Vec::new();
        while let Some(row) = rows
            .next()
            .map_err(|error| format!("read project canonical migration row failed: {error}"))?
        {
            records.push((
                row.get::<_, String>(0)
                    .map_err(|error| format!("read project canonical id failed: {error}"))?,
                row.get::<_, String>(1).map_err(|error| {
                    format!("read project canonical workspace_id failed: {error}")
                })?,
                row.get::<_, String>(2)
                    .map_err(|error| format!("read project canonical name failed: {error}"))?,
                row.get::<_, Option<String>>(3)
                    .map_err(|error| format!("read project canonical root_path failed: {error}"))?,
                row.get::<_, Option<String>>(4)
                    .map_err(|error| format!("read project canonical owner_id failed: {error}"))?,
                row.get::<_, Option<String>>(5)
                    .map_err(|error| format!("read project canonical leader_id failed: {error}"))?,
                row.get::<_, Option<String>>(6).map_err(|error| {
                    format!("read project canonical created_by_user_id failed: {error}")
                })?,
                row.get::<_, Option<String>>(7)
                    .map_err(|error| format!("read project canonical uuid failed: {error}"))?,
                row.get::<_, Option<String>>(8)
                    .map_err(|error| format!("read project canonical code failed: {error}"))?,
                row.get::<_, Option<String>>(9)
                    .map_err(|error| format!("read project canonical title failed: {error}"))?,
                row.get::<_, Option<String>>(10)
                    .map_err(|error| format!("read project canonical type failed: {error}"))?,
                row.get::<_, Option<String>>(11).map_err(|error| {
                    format!("read project canonical workspace_uuid failed: {error}")
                })?,
                row.get::<_, Option<String>>(12)
                    .map_err(|error| format!("read project canonical author failed: {error}"))?,
            ));
        }
        records
    };

    for (
        project_id,
        workspace_id,
        project_name,
        root_path,
        owner_id,
        leader_id,
        created_by_user_id,
        uuid,
        code,
        title,
        project_type,
        workspace_uuid,
        author,
    ) in project_rows
    {
        let (resolved_owner_id, resolved_leader_id, resolved_created_by_user_id) =
            resolve_effective_user_authority(
                owner_id.as_deref(),
                leader_id.as_deref(),
                created_by_user_id.as_deref(),
                None,
                None,
                None,
            );
        let resolved_uuid =
            normalize_optional_string(uuid).unwrap_or_else(|| Uuid::new_v4().to_string());
        let resolved_code = normalize_optional_string(code).unwrap_or_else(|| {
            build_project_business_code(&project_id, &project_name, root_path.as_deref())
        });
        let resolved_title =
            normalize_optional_string(title).unwrap_or_else(|| project_name.clone());
        let resolved_type =
            normalize_optional_string(project_type).unwrap_or_else(|| "CODE".to_owned());
        let resolved_workspace_uuid = normalize_optional_string(workspace_uuid)
            .or_else(|| workspace_uuid_map.get(&workspace_id).cloned())
            .unwrap_or_else(|| Uuid::new_v4().to_string());
        let resolved_author = normalize_optional_string(author)
            .unwrap_or_else(|| resolved_created_by_user_id.clone());

        connection
            .execute(
                r#"
                UPDATE projects
                SET
                    uuid = ?2,
                    tenant_id = COALESCE(NULLIF(TRIM(tenant_id), ''), ?3),
                    workspace_uuid = ?4,
                    code = ?5,
                    title = ?6,
                    owner_id = ?7,
                    leader_id = ?8,
                    created_by_user_id = ?9,
                    type = ?10,
                    author = ?11
                WHERE id = ?1
                "#,
                params![
                    &project_id,
                    &resolved_uuid,
                    SQLITE_AUTHORITY_DEFAULT_TENANT_ID,
                    &resolved_workspace_uuid,
                    &resolved_code,
                    &resolved_title,
                    &resolved_owner_id,
                    &resolved_leader_id,
                    &resolved_created_by_user_id,
                    &resolved_type,
                    &resolved_author,
                ],
            )
            .map_err(|error| {
                format!("backfill project canonical fields {project_id} failed: {error}")
            })?;
    }

    Ok(())
}

fn parse_storage_timestamp_millis(timestamp: &str) -> Option<i64> {
    let normalized = timestamp.trim();
    if normalized.is_empty() {
        return None;
    }

    let numeric = normalized.strip_prefix('-').unwrap_or(normalized);
    if !numeric.is_empty() && numeric.chars().all(|character| character.is_ascii_digit()) {
        let parsed = normalized.parse::<i128>().ok()?;
        let absolute = parsed.abs();
        let milliseconds = if absolute >= 1_000_000_000_000_000_000 {
            parsed / 1_000_000
        } else if absolute >= 1_000_000_000_000_000 {
            parsed / 1_000
        } else if absolute >= 1_000_000_000_000 {
            parsed
        } else if absolute >= 1_000_000_000 {
            parsed * 1_000
        } else {
            parsed
        };

        return i64::try_from(milliseconds).ok();
    }

    let parsed =
        time::OffsetDateTime::parse(normalized, &time::format_description::well_known::Rfc3339)
            .ok()?;
    Some((parsed.unix_timestamp_nanos() / 1_000_000) as i64)
}

fn storage_timestamp_from_millis(value: i64) -> String {
    let seconds = value.div_euclid(1_000);
    let milliseconds = value.rem_euclid(1_000) as u16;
    let datetime = time::OffsetDateTime::from_unix_timestamp(seconds)
        .unwrap_or(time::OffsetDateTime::UNIX_EPOCH)
        .replace_millisecond(milliseconds)
        .unwrap_or(time::OffsetDateTime::UNIX_EPOCH);
    datetime
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
}

fn normalize_storage_timestamp_value(timestamp: &str) -> Option<String> {
    parse_storage_timestamp_millis(timestamp).map(storage_timestamp_from_millis)
}

fn normalize_optional_storage_timestamp_value(value: Option<String>) -> Option<String> {
    value.and_then(|timestamp| normalize_storage_timestamp_value(timestamp.as_str()))
}

fn resolve_latest_storage_timestamp_from_candidates(
    candidates: &[Option<&str>],
) -> Option<String> {
    candidates
        .iter()
        .filter_map(|candidate| {
            candidate.and_then(|timestamp| {
                parse_storage_timestamp_millis(timestamp).map(|parsed| (parsed, timestamp.to_owned()))
            })
        })
        .max_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)))
        .map(|(_, timestamp)| timestamp)
}

fn resolve_projection_transcript_updated_at(
    events: &[CodingSessionEventPayload],
) -> Option<String> {
    events
        .iter()
        .filter(|event| event.kind == "message.completed" || event.kind == "message.deleted")
        .filter_map(|event| {
            parse_storage_timestamp_millis(event.created_at.as_str())
                .map(|timestamp| (timestamp, event.created_at.clone()))
        })
        .max_by(|left, right| left.0.cmp(&right.0).then_with(|| left.1.cmp(&right.1)))
        .map(|(_, created_at)| created_at)
}

fn resolve_coding_session_payload_sort_timestamp(session: &CodingSessionPayload) -> i64 {
    if session.sort_timestamp > 0 {
        return session.sort_timestamp;
    }

    resolve_latest_storage_timestamp_from_candidates(&[
        session.transcript_updated_at.as_deref(),
        session.last_turn_at.as_deref(),
        Some(session.updated_at.as_str()),
        Some(session.created_at.as_str()),
    ])
    .as_deref()
    .and_then(parse_storage_timestamp_millis)
        .unwrap_or_default()
}

fn normalize_coding_session_payload(
    session: &CodingSessionPayload,
    transcript_updated_at: Option<String>,
) -> CodingSessionPayload {
    let resolved_transcript_updated_at =
        transcript_updated_at.or_else(|| session.transcript_updated_at.clone());
    let mut normalized = session.clone();
    normalized.transcript_updated_at = resolved_transcript_updated_at;
    normalized.sort_timestamp = resolve_coding_session_payload_sort_timestamp(&normalized);
    normalized
}

fn sqlite_value_ref_to_string(value: ValueRef<'_>) -> Option<String> {
    match value {
        ValueRef::Null => None,
        ValueRef::Integer(integer) => Some(integer.to_string()),
        ValueRef::Real(real) => {
            if real.fract() == 0.0 {
                Some((real as i64).to_string())
            } else {
                Some(real.to_string())
            }
        }
        ValueRef::Text(text) => Some(String::from_utf8_lossy(text).into_owned()),
        ValueRef::Blob(_) => None,
    }
}

fn backfill_sqlite_timestamp_column(
    connection: &mut Connection,
    table_name: &str,
    column_name: &str,
) -> Result<(), String> {
    let select_statement = format!(
        "SELECT rowid, {column_name} FROM {table_name} WHERE {column_name} IS NOT NULL"
    );
    let mut statement = connection
        .prepare(&select_statement)
        .map_err(|error| {
            format!(
                "prepare sqlite timestamp normalization query for {table_name}.{column_name} failed: {error}"
            )
        })?;
    let mut rows = statement.query([]).map_err(|error| {
        format!(
            "query sqlite timestamp normalization rows for {table_name}.{column_name} failed: {error}"
        )
    })?;
    let mut pending_updates: Vec<(i64, String)> = Vec::new();

    while let Some(row) = rows.next().map_err(|error| {
        format!(
            "read sqlite timestamp normalization row for {table_name}.{column_name} failed: {error}"
        )
    })? {
        let row_id = row.get::<_, i64>(0).map_err(|error| {
            format!(
                "read sqlite timestamp normalization rowid for {table_name}.{column_name} failed: {error}"
            )
        })?;
        let Some(raw_value) = sqlite_value_ref_to_string(row.get_ref(1).map_err(|error| {
            format!(
                "read sqlite timestamp normalization value for {table_name}.{column_name} failed: {error}"
            )
        })?) else {
            continue;
        };
        let trimmed_value = raw_value.trim();
        let Some(normalized_value) = normalize_storage_timestamp_value(trimmed_value) else {
            continue;
        };

        if normalized_value != trimmed_value {
            pending_updates.push((row_id, normalized_value));
        }
    }

    drop(rows);
    drop(statement);

    if pending_updates.is_empty() {
        return Ok(());
    }

    let update_statement =
        format!("UPDATE {table_name} SET {column_name} = ?1 WHERE rowid = ?2");
    for (row_id, normalized_value) in pending_updates {
        connection
            .execute(&update_statement, params![normalized_value, row_id])
            .map_err(|error| {
                format!(
                    "update sqlite timestamp normalization for {table_name}.{column_name} rowid {row_id} failed: {error}"
                )
            })?;
    }

    Ok(())
}

fn ensure_sqlite_provider_authority_timestamp_normalization(
    connection: &mut Connection,
) -> Result<(), String> {
    let table_names = [
        PROVIDER_WORKSPACES_TABLE,
        PROVIDER_PROJECTS_TABLE,
        PROVIDER_CODING_SESSIONS_TABLE,
        PROVIDER_CODING_SESSION_RUNTIMES_TABLE,
        PROVIDER_CODING_SESSION_TURNS_TABLE,
        PROVIDER_CODING_SESSION_EVENTS_TABLE,
        PROVIDER_CODING_SESSION_ARTIFACTS_TABLE,
        PROVIDER_CODING_SESSION_CHECKPOINTS_TABLE,
        PROVIDER_CODING_SESSION_OPERATIONS_TABLE,
        PROVIDER_SKILL_PACKAGES_TABLE,
        PROVIDER_SKILL_VERSIONS_TABLE,
        PROVIDER_SKILL_CAPABILITIES_TABLE,
        PROVIDER_SKILL_INSTALLATIONS_TABLE,
        PROVIDER_APP_TEMPLATES_TABLE,
        PROVIDER_APP_TEMPLATE_VERSIONS_TABLE,
        PROVIDER_APP_TEMPLATE_TARGET_PROFILES_TABLE,
        PROVIDER_APP_TEMPLATE_PRESETS_TABLE,
        PROVIDER_APP_TEMPLATE_INSTANTIATIONS_TABLE,
        PROVIDER_PROJECT_DOCUMENTS_TABLE,
        PROVIDER_DEPLOYMENT_TARGETS_TABLE,
        PROVIDER_DEPLOYMENT_RECORDS_TABLE,
        PROVIDER_TEAMS_TABLE,
        PROVIDER_TEAM_MEMBERS_TABLE,
        PROVIDER_RELEASE_RECORDS_TABLE,
        PROVIDER_AUDIT_EVENTS_TABLE,
        PROVIDER_GOVERNANCE_POLICIES_TABLE,
    ];
    let timestamp_columns = [
        "created_at",
        "updated_at",
        "last_turn_at",
        "started_at",
        "completed_at",
        "start_time",
        "end_time",
    ];

    for table_name in table_names {
        if !sqlite_table_exists(connection, table_name)? {
            continue;
        }

        for column_name in timestamp_columns {
            if !sqlite_column_exists(connection, table_name, column_name)? {
                continue;
            }
            backfill_sqlite_timestamp_column(connection, table_name, column_name)?;
        }
    }

    Ok(())
}

fn backfill_team_business_columns(connection: &mut Connection) -> Result<(), String> {
    let team_rows = {
        let mut statement = connection
            .prepare(
                r#"
                SELECT
                    id,
                    name,
                    owner_id,
                    leader_id,
                    created_by_user_id,
                    uuid,
                    code,
                    title,
                    metadata_json
                FROM teams
                WHERE is_deleted = 0
                "#,
            )
            .map_err(|error| format!("prepare team canonical migration failed: {error}"))?;
        let mut rows = statement
            .query([])
            .map_err(|error| format!("query team canonical migration failed: {error}"))?;
        let mut records = Vec::new();
        while let Some(row) = rows
            .next()
            .map_err(|error| format!("read team canonical migration row failed: {error}"))?
        {
            records.push((
                row.get::<_, String>(0)
                    .map_err(|error| format!("read team canonical id failed: {error}"))?,
                row.get::<_, String>(1)
                    .map_err(|error| format!("read team canonical name failed: {error}"))?,
                row.get::<_, Option<String>>(2)
                    .map_err(|error| format!("read team canonical owner_id failed: {error}"))?,
                row.get::<_, Option<String>>(3)
                    .map_err(|error| format!("read team canonical leader_id failed: {error}"))?,
                row.get::<_, Option<String>>(4).map_err(|error| {
                    format!("read team canonical created_by_user_id failed: {error}")
                })?,
                row.get::<_, Option<String>>(5)
                    .map_err(|error| format!("read team canonical uuid failed: {error}"))?,
                row.get::<_, Option<String>>(6)
                    .map_err(|error| format!("read team canonical code failed: {error}"))?,
                row.get::<_, Option<String>>(7)
                    .map_err(|error| format!("read team canonical title failed: {error}"))?,
                row.get::<_, Option<String>>(8).map_err(|error| {
                    format!("read team canonical metadata_json failed: {error}")
                })?,
            ));
        }
        records
    };

    for (
        team_id,
        team_name,
        owner_id,
        leader_id,
        created_by_user_id,
        uuid,
        code,
        title,
        metadata_json,
    ) in team_rows
    {
        let (resolved_owner_id, resolved_leader_id, resolved_created_by_user_id) =
            resolve_effective_user_authority(
                owner_id.as_deref(),
                leader_id.as_deref(),
                created_by_user_id.as_deref(),
                None,
                None,
                None,
            );
        let resolved_uuid =
            normalize_optional_string(uuid).unwrap_or_else(|| Uuid::new_v4().to_string());
        let resolved_code = normalize_optional_string(code)
            .unwrap_or_else(|| build_team_business_code(&team_id, &team_name));
        let resolved_title = normalize_optional_string(title).unwrap_or_else(|| team_name.clone());
        let resolved_metadata_json =
            normalize_optional_string(metadata_json).unwrap_or_else(|| "{}".to_owned());

        connection
            .execute(
                r#"
                UPDATE teams
                SET
                    uuid = ?2,
                    tenant_id = COALESCE(NULLIF(TRIM(tenant_id), ''), ?3),
                    code = ?4,
                    title = ?5,
                    owner_id = ?6,
                    leader_id = ?7,
                    created_by_user_id = ?8,
                    metadata_json = ?9
                WHERE id = ?1
                "#,
                params![
                    &team_id,
                    &resolved_uuid,
                    SQLITE_AUTHORITY_DEFAULT_TENANT_ID,
                    &resolved_code,
                    &resolved_title,
                    &resolved_owner_id,
                    &resolved_leader_id,
                    &resolved_created_by_user_id,
                    &resolved_metadata_json,
                ],
            )
            .map_err(|error| format!("backfill team canonical fields {team_id} failed: {error}"))?;
    }

    Ok(())
}

fn backfill_collaboration_user_columns(
    connection: &mut Connection,
    table_name: &str,
) -> Result<(), String> {
    let statement = format!(
        r#"
        UPDATE {table_name}
        SET
            user_id = COALESCE(NULLIF(TRIM(user_id), ''), ?1),
            created_by_user_id = COALESCE(NULLIF(TRIM(created_by_user_id), ''), user_id, ?1),
            granted_by_user_id = COALESCE(NULLIF(TRIM(granted_by_user_id), ''), created_by_user_id, user_id, ?1)
        WHERE is_deleted = 0
        "#
    );
    connection
        .execute(&statement, params![BOOTSTRAP_WORKSPACE_OWNER_USER_ID])
        .map_err(|error| {
            format!("backfill collaboration user fields for {table_name} failed: {error}")
        })?;
    Ok(())
}

fn ensure_sqlite_provider_authority_schema_upgrade(
    connection: &mut Connection,
) -> Result<(), String> {
    connection
        .execute_batch(SQLITE_PROVIDER_AUTHORITY_SCHEMA)
        .map_err(|error| format!("create sqlite provider authority schema failed: {error}"))?;

    if sqlite_table_exists(connection, PROVIDER_WORKSPACES_TABLE)? {
        ensure_sqlite_table_columns(
            connection,
            PROVIDER_WORKSPACES_TABLE,
            &[
                ("uuid", "uuid TEXT NULL"),
                ("tenant_id", "tenant_id TEXT NULL"),
                ("organization_id", "organization_id TEXT NULL"),
                ("code", "code TEXT NULL"),
                ("title", "title TEXT NULL"),
                ("owner_id", "owner_id TEXT NULL"),
                ("leader_id", "leader_id TEXT NULL"),
                ("created_by_user_id", "created_by_user_id TEXT NULL"),
                ("icon", "icon TEXT NULL"),
                ("color", "color TEXT NULL"),
                ("type", "type TEXT NULL"),
                ("start_time", "start_time TEXT NULL"),
                ("end_time", "end_time TEXT NULL"),
                ("max_members", "max_members INTEGER NULL"),
                ("current_members", "current_members INTEGER NULL"),
                ("member_count", "member_count INTEGER NULL"),
                ("max_storage", "max_storage INTEGER NULL"),
                ("used_storage", "used_storage INTEGER NULL"),
                ("settings_json", "settings_json TEXT NULL"),
                ("is_public", "is_public INTEGER NOT NULL DEFAULT 0"),
                ("is_template", "is_template INTEGER NOT NULL DEFAULT 0"),
            ],
        )?;
    }
    if sqlite_table_exists(connection, PROVIDER_PROJECTS_TABLE)? {
        ensure_sqlite_table_columns(
            connection,
            PROVIDER_PROJECTS_TABLE,
            &[
                ("uuid", "uuid TEXT NULL"),
                ("tenant_id", "tenant_id TEXT NULL"),
                ("organization_id", "organization_id TEXT NULL"),
                ("workspace_uuid", "workspace_uuid TEXT NULL"),
                ("code", "code TEXT NULL"),
                ("title", "title TEXT NULL"),
                ("author", "author TEXT NULL"),
                ("file_id", "file_id TEXT NULL"),
                ("type", "type TEXT NULL"),
                ("site_path", "site_path TEXT NULL"),
                ("domain_prefix", "domain_prefix TEXT NULL"),
                ("conversation_id", "conversation_id TEXT NULL"),
                ("owner_id", "owner_id TEXT NULL"),
                ("leader_id", "leader_id TEXT NULL"),
                ("created_by_user_id", "created_by_user_id TEXT NULL"),
                ("start_time", "start_time TEXT NULL"),
                ("end_time", "end_time TEXT NULL"),
                ("budget_amount", "budget_amount INTEGER NULL"),
                ("cover_image_json", "cover_image_json TEXT NULL"),
                ("is_template", "is_template INTEGER NOT NULL DEFAULT 0"),
            ],
        )?;
    }
    if sqlite_table_exists(connection, PROVIDER_TEAMS_TABLE)? {
        ensure_sqlite_table_columns(
            connection,
            PROVIDER_TEAMS_TABLE,
            &[
                ("uuid", "uuid TEXT NULL"),
                ("tenant_id", "tenant_id TEXT NULL"),
                ("organization_id", "organization_id TEXT NULL"),
                ("code", "code TEXT NULL"),
                ("title", "title TEXT NULL"),
                ("owner_id", "owner_id TEXT NULL"),
                ("leader_id", "leader_id TEXT NULL"),
                ("metadata_json", "metadata_json TEXT NULL"),
                ("created_by_user_id", "created_by_user_id TEXT NULL"),
            ],
        )?;
    }
    if sqlite_table_exists(connection, PROVIDER_TEAM_MEMBERS_TABLE)? {
        ensure_sqlite_table_columns(
            connection,
            PROVIDER_TEAM_MEMBERS_TABLE,
            &[
                ("user_id", "user_id TEXT NULL"),
                ("created_by_user_id", "created_by_user_id TEXT NULL"),
                ("granted_by_user_id", "granted_by_user_id TEXT NULL"),
            ],
        )?;
    }
    if sqlite_table_exists(connection, "workspace_members")? {
        ensure_sqlite_table_columns(
            connection,
            "workspace_members",
            &[
                ("user_id", "user_id TEXT NULL"),
                ("created_by_user_id", "created_by_user_id TEXT NULL"),
                ("granted_by_user_id", "granted_by_user_id TEXT NULL"),
            ],
        )?;
    }
    if sqlite_table_exists(connection, "project_collaborators")? {
        ensure_sqlite_table_columns(
            connection,
            "project_collaborators",
            &[
                ("user_id", "user_id TEXT NULL"),
                ("created_by_user_id", "created_by_user_id TEXT NULL"),
                ("granted_by_user_id", "granted_by_user_id TEXT NULL"),
            ],
        )?;
    }

    let workspace_uuid_map = backfill_workspace_business_columns(connection)?;
    backfill_project_business_columns(connection, &workspace_uuid_map)?;
    backfill_team_business_columns(connection)?;
    backfill_collaboration_user_columns(connection, PROVIDER_TEAM_MEMBERS_TABLE)?;
    backfill_collaboration_user_columns(connection, "workspace_members")?;
    backfill_collaboration_user_columns(connection, "project_collaborators")?;

    Ok(())
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
        PROVIDER_SKILL_PACKAGES_TABLE,
        PROVIDER_SKILL_VERSIONS_TABLE,
        PROVIDER_SKILL_CAPABILITIES_TABLE,
        PROVIDER_SKILL_INSTALLATIONS_TABLE,
        PROVIDER_APP_TEMPLATES_TABLE,
        PROVIDER_APP_TEMPLATE_VERSIONS_TABLE,
        PROVIDER_APP_TEMPLATE_TARGET_PROFILES_TABLE,
        PROVIDER_APP_TEMPLATE_PRESETS_TABLE,
        PROVIDER_APP_TEMPLATE_INSTANTIATIONS_TABLE,
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

fn parse_json_value(raw: &str, context: &str) -> Result<serde_json::Value, String> {
    serde_json::from_str(raw).map_err(|error| format!("parse {context} json failed: {error}"))
}

fn manifest_string(value: &serde_json::Value, key: &str) -> Option<String> {
    value
        .get(key)
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(str::to_owned)
}

fn manifest_usize(value: &serde_json::Value, key: &str) -> Option<usize> {
    value.get(key).and_then(|entry| match entry {
        serde_json::Value::Number(number) => number.as_u64().map(|value| value as usize),
        serde_json::Value::String(text) => text.trim().parse::<usize>().ok(),
        _ => None,
    })
}

fn manifest_string_array(value: &serde_json::Value, key: &str) -> Vec<String> {
    value.get(key)
        .and_then(serde_json::Value::as_array)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|entry| match entry {
                    serde_json::Value::String(text) => {
                        let normalized = text.trim();
                        (!normalized.is_empty()).then(|| normalized.to_owned())
                    }
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default()
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

fn load_provider_coding_session_rows(
    connection: &Connection,
) -> Result<Vec<CodingSessionRow>, String> {
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
            let created_at: String = row.get(7)?;
            let updated_at: String = row.get(8)?;
            let last_turn_at: Option<String> = row.get(9)?;
            Ok(CodingSessionRow {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                project_id: row.get(2)?,
                title: row.get(3)?,
                status: row.get(4)?,
                engine_id: row.get(5)?,
                model_id: row.get(6)?,
                created_at: normalize_storage_timestamp_value(created_at.as_str())
                    .unwrap_or(created_at),
                updated_at: normalize_storage_timestamp_value(updated_at.as_str())
                    .unwrap_or(updated_at),
                last_turn_at: normalize_optional_storage_timestamp_value(last_turn_at),
            })
        })
        .map_err(|error| format!("query coding_sessions failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read coding_sessions row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_runtime_rows(
    connection: &Connection,
) -> Result<Vec<CodingSessionRuntimeRow>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT id, coding_session_id, host_mode, engine_id, model_id, native_session_id, created_at, updated_at
            FROM coding_session_runtimes
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare coding_session_runtimes query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            let created_at: String = row.get(6)?;
            let updated_at: String = row.get(7)?;
            Ok(CodingSessionRuntimeRow {
                id: row.get(0)?,
                coding_session_id: row.get(1)?,
                host_mode: row.get(2)?,
                engine_id: row.get(3)?,
                model_id: row.get(4)?,
                native_session_id: row.get(5)?,
                created_at: normalize_storage_timestamp_value(created_at.as_str())
                    .unwrap_or(created_at),
                updated_at: normalize_storage_timestamp_value(updated_at.as_str())
                    .unwrap_or(updated_at),
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

fn load_latest_runtime_rows_by_coding_session_id(
    sqlite_file: Option<&FsPath>,
) -> BTreeMap<String, CodingSessionRuntimeRow> {
    let Some(sqlite_file) = sqlite_file else {
        return BTreeMap::new();
    };
    let Ok(connection) = Connection::open(sqlite_file) else {
        return BTreeMap::new();
    };
    let Ok(runtime_rows) = load_provider_runtime_rows(&connection) else {
        return BTreeMap::new();
    };

    let mut runtime_rows_by_coding_session_id = BTreeMap::<String, Vec<CodingSessionRuntimeRow>>::new();
    for runtime_row in runtime_rows {
        runtime_rows_by_coding_session_id
            .entry(runtime_row.coding_session_id.clone())
            .or_default()
            .push(runtime_row);
    }

    runtime_rows_by_coding_session_id
        .into_iter()
        .filter_map(|(coding_session_id, runtime_rows)| {
            select_latest_runtime_row(&runtime_rows)
                .cloned()
                .map(|runtime_row| (coding_session_id, runtime_row))
        })
        .collect()
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
        records
            .push(row.map_err(|error| format!("read coding_session_turns row failed: {error}"))?);
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
        records
            .push(row.map_err(|error| format!("read coding_session_events row failed: {error}"))?);
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
    fn read_workspace_payload(row: &rusqlite::Row<'_>) -> rusqlite::Result<WorkspacePayload> {
        let owner_id: Option<String> = row.get(8)?;
        let leader_id: Option<String> = row.get(9)?;
        let created_by_user_id: Option<String> = row.get(10)?;
        let (owner_id, leader_id, created_by_user_id) = resolve_effective_user_authority(
            owner_id.as_deref(),
            leader_id.as_deref(),
            created_by_user_id.as_deref(),
            None,
            None,
            None,
        );
        Ok(WorkspacePayload {
            id: row.get(0)?,
            uuid: row.get(1)?,
            tenant_id: row.get(2)?,
            organization_id: row.get(3)?,
            name: row.get(4)?,
            code: row.get(5)?,
            title: row.get(6)?,
            description: row.get(7)?,
            owner_id: Some(owner_id),
            leader_id: Some(leader_id),
            created_by_user_id: Some(created_by_user_id),
            member_count: None,
            status: row.get(11)?,
            viewer_role: None,
            entity_type: row.get(12)?,
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
                status,
                type
            FROM workspaces
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

fn load_provider_project_payloads(connection: &Connection) -> Result<Vec<ProjectPayload>, String> {
    fn read_project_payload(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectPayload> {
        let owner_id: Option<String> = row.get(11)?;
        let leader_id: Option<String> = row.get(12)?;
        let created_by_user_id: Option<String> = row.get(13)?;
        let created_at: Option<String> = row.get(17)?;
        let updated_at: Option<String> = row.get(18)?;
        let (owner_id, leader_id, created_by_user_id) = resolve_effective_user_authority(
            owner_id.as_deref(),
            leader_id.as_deref(),
            created_by_user_id.as_deref(),
            None,
            None,
            None,
        );
        Ok(ProjectPayload {
            created_at: normalize_optional_storage_timestamp_value(created_at),
            id: row.get(0)?,
            uuid: row.get(1)?,
            tenant_id: row.get(2)?,
            organization_id: row.get(3)?,
            workspace_id: row.get(4)?,
            workspace_uuid: row.get(5)?,
            code: row.get(6)?,
            title: row.get(7)?,
            name: row.get(8)?,
            description: row.get(9)?,
            root_path: row.get(10)?,
            owner_id: Some(owner_id.clone()),
            leader_id: Some(leader_id),
            created_by_user_id: Some(created_by_user_id.clone()),
            author: row
                .get::<_, Option<String>>(14)?
                .or(Some(created_by_user_id)),
            entity_type: row.get(15)?,
            collaborator_count: None,
            status: row.get(16)?,
            updated_at: normalize_optional_storage_timestamp_value(updated_at),
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
                workspace_id,
                workspace_uuid,
                code,
                title,
                name,
                description,
                root_path,
                owner_id,
                leader_id,
                created_by_user_id,
                author,
                type,
                status,
                created_at,
                updated_at
            FROM projects
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
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

fn load_provider_workspace_payload_by_id(
    connection: &Connection,
    workspace_id: &str,
) -> Result<Option<WorkspacePayload>, String> {
    fn read_workspace_payload(row: &rusqlite::Row<'_>) -> rusqlite::Result<WorkspacePayload> {
        let owner_id: Option<String> = row.get(8)?;
        let leader_id: Option<String> = row.get(9)?;
        let created_by_user_id: Option<String> = row.get(10)?;
        let (owner_id, leader_id, created_by_user_id) = resolve_effective_user_authority(
            owner_id.as_deref(),
            leader_id.as_deref(),
            created_by_user_id.as_deref(),
            None,
            None,
            None,
        );
        Ok(WorkspacePayload {
            id: row.get(0)?,
            uuid: row.get(1)?,
            tenant_id: row.get(2)?,
            organization_id: row.get(3)?,
            name: row.get(4)?,
            code: row.get(5)?,
            title: row.get(6)?,
            description: row.get(7)?,
            owner_id: Some(owner_id),
            leader_id: Some(leader_id),
            created_by_user_id: Some(created_by_user_id),
            member_count: None,
            status: row.get(11)?,
            viewer_role: None,
            entity_type: row.get(12)?,
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
                status,
                type
            FROM workspaces
            WHERE is_deleted = 0 AND id = ?1
            LIMIT 1
            "#,
        )
        .map_err(|error| format!("prepare workspace by id query failed: {error}"))?;
    let mut rows = statement
        .query(params![workspace_id])
        .map_err(|error| format!("query workspace by id failed: {error}"))?;

    rows.next()
        .map_err(|error| format!("read workspace by id row failed: {error}"))?
        .map(read_workspace_payload)
        .transpose()
        .map_err(|error: rusqlite::Error| format!("map workspace by id row failed: {error}"))
}

fn load_provider_project_payload_by_id(
    connection: &Connection,
    project_id: &str,
) -> Result<Option<ProjectPayload>, String> {
    fn read_project_payload(row: &rusqlite::Row<'_>) -> rusqlite::Result<ProjectPayload> {
        let owner_id: Option<String> = row.get(11)?;
        let leader_id: Option<String> = row.get(12)?;
        let created_by_user_id: Option<String> = row.get(13)?;
        let created_at: Option<String> = row.get(17)?;
        let updated_at: Option<String> = row.get(18)?;
        let (owner_id, leader_id, created_by_user_id) = resolve_effective_user_authority(
            owner_id.as_deref(),
            leader_id.as_deref(),
            created_by_user_id.as_deref(),
            None,
            None,
            None,
        );
        Ok(ProjectPayload {
            created_at: normalize_optional_storage_timestamp_value(created_at),
            id: row.get(0)?,
            uuid: row.get(1)?,
            tenant_id: row.get(2)?,
            organization_id: row.get(3)?,
            workspace_id: row.get(4)?,
            workspace_uuid: row.get(5)?,
            code: row.get(6)?,
            title: row.get(7)?,
            name: row.get(8)?,
            description: row.get(9)?,
            root_path: row.get(10)?,
            owner_id: Some(owner_id.clone()),
            leader_id: Some(leader_id),
            created_by_user_id: Some(created_by_user_id.clone()),
            author: row
                .get::<_, Option<String>>(14)?
                .or(Some(created_by_user_id)),
            entity_type: row.get(15)?,
            collaborator_count: None,
            status: row.get(16)?,
            updated_at: normalize_optional_storage_timestamp_value(updated_at),
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
                workspace_id,
                workspace_uuid,
                code,
                title,
                name,
                description,
                root_path,
                owner_id,
                leader_id,
                created_by_user_id,
                author,
                type,
                status,
                created_at,
                updated_at
            FROM projects
            WHERE is_deleted = 0 AND id = ?1
            LIMIT 1
            "#,
        )
        .map_err(|error| format!("prepare project by id query failed: {error}"))?;
    let mut rows = statement
        .query(params![project_id])
        .map_err(|error| format!("query project by id failed: {error}"))?;

    rows.next()
        .map_err(|error| format!("read project by id row failed: {error}"))?
        .map(read_project_payload)
        .transpose()
        .map_err(|error: rusqlite::Error| format!("map project by id row failed: {error}"))
}

fn load_provider_skill_package_payloads(
    connection: &Connection,
    workspace_id: Option<&str>,
) -> Result<Vec<SkillPackagePayload>, String> {
    let installed_version_ids = if let Some(workspace_id) = workspace_id {
        let mut statement = connection
            .prepare(
                r#"
                SELECT skill_version_id
                FROM skill_installations
                WHERE is_deleted = 0
                  AND status = 'active'
                  AND scope_type = 'workspace'
                  AND scope_id = ?1
                "#,
            )
            .map_err(|error| format!("prepare skill_installations query failed: {error}"))?;
        let rows = statement
            .query_map(params![workspace_id], |row| row.get::<_, String>(0))
            .map_err(|error| format!("query skill_installations failed: {error}"))?;
        let mut versions = BTreeSet::new();
        for row in rows {
            versions.insert(
                row.map_err(|error| format!("read skill_installations row failed: {error}"))?,
            );
        }
        versions
    } else {
        BTreeSet::new()
    };

    let mut capability_lookup: BTreeMap<(String, String), Vec<String>> = BTreeMap::new();
    let mut capability_statement = connection
        .prepare(
            r#"
            SELECT skill_version_id, capability_key, payload_json
            FROM skill_capabilities
            WHERE is_deleted = 0
            ORDER BY created_at ASC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare skill_capabilities query failed: {error}"))?;
    let capability_rows = capability_statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|error| format!("query skill_capabilities failed: {error}"))?;
    for row in capability_rows {
        let (version_id, capability_key, payload_json) =
            row.map_err(|error| format!("read skill_capabilities row failed: {error}"))?;
        let payload = parse_json_value(&payload_json, "skill capability payload")?;
        let skill_id = manifest_string(&payload, "skillId").unwrap_or_else(|| version_id.clone());
        capability_lookup
            .entry((version_id, skill_id))
            .or_default()
            .push(capability_key);
    }

    let mut statement = connection
        .prepare(
            r#"
            SELECT
                packages.id,
                packages.slug,
                packages.source_uri,
                packages.manifest_json,
                packages.updated_at,
                versions.id,
                versions.version_label,
                versions.manifest_json
            FROM skill_packages packages
            INNER JOIN skill_versions versions
                ON versions.skill_package_id = packages.id
               AND versions.is_deleted = 0
            WHERE packages.is_deleted = 0
              AND packages.status = 'active'
            ORDER BY packages.updated_at DESC, versions.updated_at DESC, versions.id ASC
            "#,
        )
        .map_err(|error| format!("prepare skill_packages query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
            ))
        })
        .map_err(|error| format!("query skill_packages failed: {error}"))?;

    let mut seen_package_ids = BTreeSet::new();
    let mut packages = Vec::new();
    for row in rows {
        let (
            package_id,
            slug,
            source_uri,
            package_manifest_json,
            updated_at,
            version_id,
            version_label,
            version_manifest_json,
        ) = row.map_err(|error| format!("read skill_packages row failed: {error}"))?;

        if !seen_package_ids.insert(package_id.clone()) {
            continue;
        }

        let package_manifest = parse_json_value(&package_manifest_json, "skill package manifest")?;
        let version_manifest = parse_json_value(&version_manifest_json, "skill version manifest")?;
        let installed = installed_version_ids.contains(&version_id);
        let skills = version_manifest
            .get("skills")
            .and_then(serde_json::Value::as_array)
            .map(|entries| {
                entries
                    .iter()
                    .map(|entry| {
                        let skill_id = manifest_string(entry, "id")
                            .unwrap_or_else(|| format!("{package_id}:{version_id}:skill"));
                        SkillCatalogEntryPayload {
                            id: skill_id.clone(),
                            package_id: package_id.clone(),
                            slug: manifest_string(entry, "slug")
                                .unwrap_or_else(|| slug.clone()),
                            name: manifest_string(entry, "name")
                                .unwrap_or_else(|| manifest_string(&package_manifest, "name").unwrap_or_else(|| slug.clone())),
                            description: manifest_string(entry, "description")
                                .unwrap_or_else(|| manifest_string(&package_manifest, "description").unwrap_or_default()),
                            icon: manifest_string(entry, "icon"),
                            author: manifest_string(entry, "author"),
                            version_id: version_id.clone(),
                            version_label: version_label.clone(),
                            install_count: manifest_usize(entry, "installCount"),
                            long_description: manifest_string(entry, "longDescription"),
                            tags: manifest_string_array(entry, "tags"),
                            license: manifest_string(entry, "license"),
                            repository_url: manifest_string(entry, "repositoryUrl"),
                            last_updated: Some(updated_at.clone()),
                            readme: manifest_string(entry, "readme"),
                            capability_keys: capability_lookup
                                .get(&(version_id.clone(), skill_id))
                                .cloned()
                                .unwrap_or_default(),
                            installed,
                        }
                    })
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();

        packages.push(SkillPackagePayload {
            id: package_id.clone(),
            slug: slug.clone(),
            name: manifest_string(&package_manifest, "name").unwrap_or_else(|| slug.clone()),
            description: manifest_string(&package_manifest, "description").unwrap_or_default(),
            icon: manifest_string(&package_manifest, "icon"),
            author: manifest_string(&package_manifest, "author"),
            version_id,
            version_label,
            install_count: manifest_usize(&package_manifest, "installCount"),
            long_description: manifest_string(&package_manifest, "longDescription"),
            source_uri: Some(source_uri),
            installed,
            updated_at,
            skills,
        });
    }

    Ok(packages)
}

fn load_provider_app_template_payloads(
    connection: &Connection,
) -> Result<Vec<AppTemplatePayload>, String> {
    let mut target_profiles_by_version_id: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut profile_statement = connection
        .prepare(
            r#"
            SELECT app_template_version_id, profile_key
            FROM app_template_target_profiles
            WHERE is_deleted = 0
            ORDER BY created_at ASC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare app_template_target_profiles query failed: {error}"))?;
    let profile_rows = profile_statement
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| format!("query app_template_target_profiles failed: {error}"))?;
    for row in profile_rows {
        let (version_id, profile_key) =
            row.map_err(|error| format!("read app_template_target_profiles row failed: {error}"))?;
        target_profiles_by_version_id
            .entry(version_id)
            .or_default()
            .push(profile_key);
    }

    let mut presets_by_version_id: BTreeMap<String, String> = BTreeMap::new();
    let mut preset_statement = connection
        .prepare(
            r#"
            SELECT app_template_version_id, preset_key
            FROM app_template_presets
            WHERE is_deleted = 0
            ORDER BY CASE WHEN preset_key = 'default' THEN 0 ELSE 1 END, created_at ASC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare app_template_presets query failed: {error}"))?;
    let preset_rows = preset_statement
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|error| format!("query app_template_presets failed: {error}"))?;
    for row in preset_rows {
        let (version_id, preset_key) =
            row.map_err(|error| format!("read app_template_presets row failed: {error}"))?;
        presets_by_version_id.entry(version_id).or_insert(preset_key);
    }

    let mut statement = connection
        .prepare(
            r#"
            SELECT
                templates.id,
                templates.slug,
                templates.name,
                templates.category,
                templates.status,
                templates.updated_at,
                versions.id,
                versions.version_label,
                versions.manifest_json
            FROM app_templates templates
            INNER JOIN app_template_versions versions
                ON versions.app_template_id = templates.id
               AND versions.is_deleted = 0
            WHERE templates.is_deleted = 0
              AND templates.status = 'active'
            ORDER BY templates.updated_at DESC, versions.updated_at DESC, versions.id ASC
            "#,
        )
        .map_err(|error| format!("prepare app_templates query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
                row.get::<_, String>(6)?,
                row.get::<_, String>(7)?,
                row.get::<_, String>(8)?,
            ))
        })
        .map_err(|error| format!("query app_templates failed: {error}"))?;

    let mut seen_template_ids = BTreeSet::new();
    let mut templates = Vec::new();
    for row in rows {
        let (template_id, slug, name, category, status, updated_at, version_id, version_label, manifest_json) =
            row.map_err(|error| format!("read app_templates row failed: {error}"))?;

        if !seen_template_ids.insert(template_id.clone()) {
            continue;
        }

        let manifest = parse_json_value(&manifest_json, "app template manifest")?;
        templates.push(AppTemplatePayload {
            id: template_id,
            slug,
            name,
            description: manifest_string(&manifest, "description").unwrap_or_default(),
            icon: manifest_string(&manifest, "icon"),
            author: manifest_string(&manifest, "author"),
            version_id: version_id.clone(),
            version_label,
            preset_key: presets_by_version_id
                .get(&version_id)
                .cloned()
                .unwrap_or_else(|| "default".to_owned()),
            category,
            tags: manifest_string_array(&manifest, "tags"),
            target_profiles: target_profiles_by_version_id
                .get(&version_id)
                .cloned()
                .unwrap_or_default(),
            downloads: manifest_usize(&manifest, "downloads"),
            stars: manifest_usize(&manifest, "stars"),
            status,
            updated_at,
        });
    }

    Ok(templates)
}

fn load_latest_skill_version_for_package(
    connection: &Connection,
    package_id: &str,
) -> Result<Option<(String, String)>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT versions.id, packages.id
            FROM skill_packages packages
            INNER JOIN skill_versions versions
                ON versions.skill_package_id = packages.id
               AND versions.is_deleted = 0
            WHERE packages.is_deleted = 0
              AND packages.id = ?1
            ORDER BY versions.updated_at DESC, versions.id ASC
            LIMIT 1
            "#,
        )
        .map_err(|error| format!("prepare latest skill version query failed: {error}"))?;
    let mut rows = statement
        .query(params![package_id])
        .map_err(|error| format!("query latest skill version failed: {error}"))?;
    rows.next()
        .map_err(|error| format!("read latest skill version row failed: {error}"))?
        .map(|row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
            ))
        })
        .transpose()
        .map_err(|error: rusqlite::Error| format!("map latest skill version row failed: {error}"))
}

fn template_version_exists(connection: &Connection, version_id: &str) -> Result<bool, String> {
    let count: i64 = connection
        .query_row(
            r#"
            SELECT COUNT(*)
            FROM app_template_versions
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![version_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("count app template version failed: {error}"))?;
    Ok(count > 0)
}

fn template_preset_exists(
    connection: &Connection,
    version_id: &str,
    preset_key: &str,
) -> Result<bool, String> {
    let count: i64 = connection
        .query_row(
            r#"
            SELECT COUNT(*)
            FROM app_template_presets
            WHERE app_template_version_id = ?1
              AND preset_key = ?2
              AND is_deleted = 0
            "#,
            params![version_id, preset_key],
            |row| row.get(0),
        )
        .map_err(|error| format!("count app template preset failed: {error}"))?;
    Ok(count > 0)
}

fn upsert_project_template_instantiation(
    transaction: &rusqlite::Transaction<'_>,
    project_id: &str,
    app_template_version_id: &str,
    preset_key: &str,
    output_root: &str,
    timestamp: &str,
) -> Result<(), String> {
    let instantiation_id = format!("app-template-instantiation-{project_id}");
    transaction
        .execute(
            r#"
            INSERT INTO app_template_instantiations (
                id, created_at, updated_at, version, is_deleted, project_id,
                app_template_version_id, preset_key, status, output_root
            ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id)
            DO UPDATE SET
                updated_at = excluded.updated_at,
                is_deleted = 0,
                project_id = excluded.project_id,
                app_template_version_id = excluded.app_template_version_id,
                preset_key = excluded.preset_key,
                status = excluded.status,
                output_root = excluded.output_root
            "#,
            params![
                instantiation_id,
                timestamp,
                timestamp,
                project_id,
                app_template_version_id,
                preset_key,
                "planned",
                output_root,
            ],
        )
        .map_err(|error| format!("upsert project template instantiation failed: {error}"))?;
    Ok(())
}

fn load_provider_document_payloads(
    connection: &Connection,
) -> Result<Vec<DocumentPayload>, String> {
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
        records.push(row.map_err(|error| format!("read project_documents row failed: {error}"))?);
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
        records.push(row.map_err(|error| format!("read deployment_records row failed: {error}"))?);
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
        records.push(row.map_err(|error| format!("read deployment_targets row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_team_payloads(connection: &Connection) -> Result<Vec<TeamPayload>, String> {
    fn read_team_payload(row: &rusqlite::Row<'_>) -> rusqlite::Result<TeamPayload> {
        let owner_id: Option<String> = row.get(9)?;
        let leader_id: Option<String> = row.get(10)?;
        let created_by_user_id: Option<String> = row.get(11)?;
        let (owner_id, leader_id, created_by_user_id) = resolve_effective_user_authority(
            owner_id.as_deref(),
            leader_id.as_deref(),
            created_by_user_id.as_deref(),
            None,
            None,
            None,
        );
        Ok(TeamPayload {
            id: row.get(0)?,
            uuid: row.get(1)?,
            tenant_id: row.get(2)?,
            organization_id: row.get(3)?,
            workspace_id: row.get(4)?,
            name: row.get(5)?,
            code: row.get(6)?,
            title: row.get(7)?,
            description: row.get(8)?,
            owner_id: Some(owner_id),
            leader_id: Some(leader_id),
            created_by_user_id: Some(created_by_user_id),
            status: row.get(12)?,
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
                workspace_id,
                name,
                code,
                title,
                description,
                owner_id,
                leader_id,
                created_by_user_id,
                status
            FROM teams
            WHERE is_deleted = 0
            ORDER BY updated_at DESC, id ASC
            "#,
        )
        .map_err(|error| format!("prepare teams query failed: {error}"))?;
    let rows = statement
        .query_map([], read_team_payload)
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
            SELECT
                id,
                team_id,
                user_id,
                role,
                created_by_user_id,
                granted_by_user_id,
                status
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
                user_id: row.get(2)?,
                role: row.get(3)?,
                created_by_user_id: row.get(4)?,
                granted_by_user_id: row.get(5)?,
                status: row.get(6)?,
            })
        })
        .map_err(|error| format!("query team_members failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read team_members row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_workspace_member_payloads(
    connection: &Connection,
) -> Result<Vec<WorkspaceMemberPayload>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT
                workspace_members.id,
                workspace_members.workspace_id,
                workspace_members.user_id,
                plus_user.email,
                plus_user.nickname,
                plus_user.avatar_url,
                workspace_members.team_id,
                workspace_members.role,
                workspace_members.created_by_user_id,
                workspace_members.granted_by_user_id,
                workspace_members.status,
                workspace_members.created_at,
                workspace_members.updated_at
            FROM workspace_members
            LEFT JOIN plus_user
                ON plus_user.id = workspace_members.user_id
               AND plus_user.is_deleted = 0
            WHERE workspace_members.is_deleted = 0
            ORDER BY workspace_members.updated_at DESC, workspace_members.id ASC
            "#,
        )
        .map_err(|error| format!("prepare workspace_members query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(WorkspaceMemberPayload {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                user_id: row.get(2)?,
                user_email: row.get(3)?,
                user_display_name: row.get(4)?,
                user_avatar_url: row.get(5)?,
                team_id: row.get(6)?,
                role: row.get(7)?,
                created_by_user_id: row.get(8)?,
                granted_by_user_id: row.get(9)?,
                status: row.get(10)?,
                created_at: Some(row.get(11)?),
                updated_at: Some(row.get(12)?),
            })
        })
        .map_err(|error| format!("query workspace_members failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records.push(row.map_err(|error| format!("read workspace_members row failed: {error}"))?);
    }
    Ok(records)
}

fn load_provider_project_collaborator_payloads(
    connection: &Connection,
) -> Result<Vec<ProjectCollaboratorPayload>, String> {
    let mut statement = connection
        .prepare(
            r#"
            SELECT
                project_collaborators.id,
                project_collaborators.project_id,
                project_collaborators.workspace_id,
                project_collaborators.user_id,
                plus_user.email,
                plus_user.nickname,
                plus_user.avatar_url,
                project_collaborators.team_id,
                project_collaborators.role,
                project_collaborators.created_by_user_id,
                project_collaborators.granted_by_user_id,
                project_collaborators.status,
                project_collaborators.created_at,
                project_collaborators.updated_at
            FROM project_collaborators
            LEFT JOIN plus_user
                ON plus_user.id = project_collaborators.user_id
               AND plus_user.is_deleted = 0
            WHERE project_collaborators.is_deleted = 0
            ORDER BY project_collaborators.updated_at DESC, project_collaborators.id ASC
            "#,
        )
        .map_err(|error| format!("prepare project_collaborators query failed: {error}"))?;
    let rows = statement
        .query_map([], |row| {
            Ok(ProjectCollaboratorPayload {
                id: row.get(0)?,
                project_id: row.get(1)?,
                workspace_id: row.get(2)?,
                user_id: row.get(3)?,
                user_email: row.get(4)?,
                user_display_name: row.get(5)?,
                user_avatar_url: row.get(6)?,
                team_id: row.get(7)?,
                role: row.get(8)?,
                created_by_user_id: row.get(9)?,
                granted_by_user_id: row.get(10)?,
                status: row.get(11)?,
                created_at: Some(row.get(12)?),
                updated_at: Some(row.get(13)?),
            })
        })
        .map_err(|error| format!("query project_collaborators failed: {error}"))?;

    let mut records = Vec::new();
    for row in rows {
        records
            .push(row.map_err(|error| format!("read project_collaborators row failed: {error}"))?);
    }
    Ok(records)
}

fn is_active_collaboration_status(status: &str) -> bool {
    matches!(status, "active" | "invited")
}

fn collaboration_role_rank(role: &str) -> usize {
    match role {
        "owner" => 4,
        "admin" => 3,
        "member" => 2,
        "viewer" => 1,
        _ => 0,
    }
}

fn choose_preferred_role(current: Option<String>, candidate: &str) -> Option<String> {
    if current.as_deref().is_some_and(|existing| {
        collaboration_role_rank(existing) >= collaboration_role_rank(candidate)
    }) {
        return current;
    }

    Some(candidate.to_owned())
}

fn user_belongs_to_team(team_members: &[TeamMemberPayload], team_id: &str, user_id: &str) -> bool {
    team_members.iter().any(|member| {
        member.team_id == team_id
            && member.user_id == user_id
            && is_active_collaboration_status(&member.status)
    })
}

fn resolve_workspace_viewer_role(
    workspace: &WorkspacePayload,
    workspace_members: &[WorkspaceMemberPayload],
    team_members: &[TeamMemberPayload],
    user_id: &str,
) -> Option<String> {
    let mut role = None;

    if workspace.owner_id.as_deref() == Some(user_id) {
        role = choose_preferred_role(role, "owner");
    } else if workspace.leader_id.as_deref() == Some(user_id)
        || workspace.created_by_user_id.as_deref() == Some(user_id)
    {
        role = choose_preferred_role(role, "admin");
    }

    for member in workspace_members.iter().filter(|member| {
        member.workspace_id == workspace.id && is_active_collaboration_status(&member.status)
    }) {
        let direct_match = member.user_id == user_id;
        let team_match = member
            .team_id
            .as_deref()
            .is_some_and(|team_id| user_belongs_to_team(team_members, team_id, user_id));
        if direct_match || team_match {
            role = choose_preferred_role(role, &member.role);
        }
    }

    role
}

fn workspace_is_visible_to_user(
    workspace: &WorkspacePayload,
    workspace_members: &[WorkspaceMemberPayload],
    team_members: &[TeamMemberPayload],
    user_id: &str,
) -> bool {
    resolve_workspace_viewer_role(workspace, workspace_members, team_members, user_id).is_some()
}

fn count_active_workspace_members(
    workspace_members: &[WorkspaceMemberPayload],
    workspace_id: &str,
) -> usize {
    workspace_members
        .iter()
        .filter(|member| {
            member.workspace_id == workspace_id && is_active_collaboration_status(&member.status)
        })
        .count()
}

fn resolve_project_viewer_role(
    project: &ProjectPayload,
    workspace_lookup: &BTreeMap<String, WorkspacePayload>,
    workspace_members: &[WorkspaceMemberPayload],
    project_collaborators: &[ProjectCollaboratorPayload],
    team_members: &[TeamMemberPayload],
    user_id: &str,
) -> Option<String> {
    let mut role = None;

    if project.owner_id.as_deref() == Some(user_id) {
        role = choose_preferred_role(role, "owner");
    } else if project.leader_id.as_deref() == Some(user_id)
        || project.created_by_user_id.as_deref() == Some(user_id)
    {
        role = choose_preferred_role(role, "admin");
    }

    for collaborator in project_collaborators.iter().filter(|collaborator| {
        collaborator.project_id == project.id
            && is_active_collaboration_status(&collaborator.status)
    }) {
        let direct_match = collaborator.user_id == user_id;
        let team_match = collaborator
            .team_id
            .as_deref()
            .is_some_and(|team_id| user_belongs_to_team(team_members, team_id, user_id));
        if direct_match || team_match {
            role = choose_preferred_role(role, &collaborator.role);
        }
    }

    if let Some(workspace) = workspace_lookup.get(&project.workspace_id) {
        if let Some(workspace_role) =
            resolve_workspace_viewer_role(workspace, workspace_members, team_members, user_id)
        {
            role = choose_preferred_role(role, &workspace_role);
        }
    }

    role
}

fn project_is_visible_to_user(
    project: &ProjectPayload,
    workspace_lookup: &BTreeMap<String, WorkspacePayload>,
    workspace_members: &[WorkspaceMemberPayload],
    project_collaborators: &[ProjectCollaboratorPayload],
    team_members: &[TeamMemberPayload],
    user_id: &str,
) -> bool {
    resolve_project_viewer_role(
        project,
        workspace_lookup,
        workspace_members,
        project_collaborators,
        team_members,
        user_id,
    )
    .is_some()
}

fn count_active_project_collaborators(
    project_collaborators: &[ProjectCollaboratorPayload],
    project_id: &str,
) -> usize {
    project_collaborators
        .iter()
        .filter(|collaborator| {
            collaborator.project_id == project_id
                && is_active_collaboration_status(&collaborator.status)
        })
        .count()
}

fn workspace_lookup_map(workspaces: &[WorkspacePayload]) -> BTreeMap<String, WorkspacePayload> {
    workspaces
        .iter()
        .cloned()
        .map(|workspace| (workspace.id.clone(), workspace))
        .collect()
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
        records.push(row.map_err(|error| format!("read release_records row failed: {error}"))?);
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
            let payload =
                serde_json::from_str::<serde_json::Value>(&payload_json).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        payload_json.len(),
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })?;
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
        records.push(row.map_err(|error| format!("read governance_policies row failed: {error}"))?);
    }
    Ok(records)
}

fn current_storage_timestamp() -> String {
    let milliseconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before unix epoch")
        .as_millis();
    storage_timestamp_from_millis(i64::try_from(milliseconds).unwrap_or(i64::MAX))
}

fn build_default_publish_release_version(now: &str) -> String {
    let normalized = now
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_owned();
    format!("publish-{normalized}")
}

fn build_default_publish_target_name(
    project_name: &str,
    environment_key: &str,
    runtime: &str,
) -> String {
    format!("{project_name} {environment_key} {runtime}")
}

fn normalize_optional_identifier(value: Option<&str>) -> Option<String> {
    value.and_then(|candidate| normalize_required_string(candidate.to_owned()))
}

fn resolve_effective_user_authority(
    owner_id: Option<&str>,
    leader_id: Option<&str>,
    created_by_user_id: Option<&str>,
    fallback_owner_id: Option<&str>,
    fallback_leader_id: Option<&str>,
    fallback_created_by_user_id: Option<&str>,
) -> (String, String, String) {
    let owner_id = normalize_optional_identifier(owner_id)
        .or_else(|| normalize_optional_identifier(created_by_user_id))
        .or_else(|| normalize_optional_identifier(fallback_owner_id))
        .or_else(|| normalize_optional_identifier(fallback_created_by_user_id))
        .unwrap_or_else(|| BOOTSTRAP_WORKSPACE_OWNER_USER_ID.to_owned());
    let leader_id = normalize_optional_identifier(leader_id)
        .or_else(|| normalize_optional_identifier(fallback_leader_id))
        .unwrap_or_else(|| owner_id.clone());
    let created_by_user_id = normalize_optional_identifier(created_by_user_id)
        .or_else(|| normalize_optional_identifier(fallback_created_by_user_id))
        .unwrap_or_else(|| owner_id.clone());
    (owner_id, leader_id, created_by_user_id)
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
        return Ok(runtime_rows
            .into_iter()
            .find(|runtime| runtime.id == runtime_id));
    }

    Ok(select_latest_runtime_row(&runtime_rows).cloned())
}

fn resolve_native_session_id_from_snapshot(snapshot: &ProjectionSnapshot) -> Option<String> {
    snapshot.events.iter().rev().find_map(|event| {
        event.payload.get("nativeSessionId").and_then(|value| {
            let normalized = value.trim();
            if normalized.is_empty() {
                None
            } else {
                Some(normalized.to_owned())
            }
        })
    })
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

fn event_payload_role(payload: &BTreeMap<String, String>) -> Option<&str> {
    payload.get("role").map(String::as_str).and_then(|role| {
        let normalized = role.trim();
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    })
}

fn build_forked_coding_session_payload(
    source_session: &CodingSessionPayload,
    input: &ForkCodingSessionInput,
) -> CodingSessionPayload {
    let timestamp = current_session_timestamp();
    let sort_timestamp = parse_storage_timestamp_millis(timestamp.as_str()).unwrap_or_default();

    CodingSessionPayload {
        id: create_identifier("coding-session"),
        workspace_id: source_session.workspace_id.clone(),
        project_id: source_session.project_id.clone(),
        title: input
            .title
            .clone()
            .unwrap_or_else(|| format!("{} (Fork)", source_session.title)),
        status: "active".to_owned(),
        host_mode: source_session.host_mode.clone(),
        engine_id: source_session.engine_id.clone(),
        model_id: source_session.model_id.clone(),
        created_at: timestamp.clone(),
        updated_at: timestamp.clone(),
        last_turn_at: Some(timestamp),
        sort_timestamp,
        transcript_updated_at: None,
    }
}

fn build_forked_transcript_events(
    source_events: &[CodingSessionEventPayload],
    target_coding_session_id: &str,
    runtime_id: &str,
) -> Vec<CodingSessionEventPayload> {
    let mut sorted_source_events = source_events.to_vec();
    sorted_source_events.sort_by(|left, right| {
        left.sequence
            .cmp(&right.sequence)
            .then_with(|| left.created_at.cmp(&right.created_at))
            .then_with(|| left.id.cmp(&right.id))
    });

    let mut next_sequence = 0_usize;
    let mut turn_map = BTreeMap::<String, String>::new();
    let mut forked_events = Vec::<CodingSessionEventPayload>::new();

    for source_event in sorted_source_events {
        if !matches!(
            source_event.kind.as_str(),
            "message.completed" | "message.delta" | "message.deleted"
        ) {
            continue;
        }

        let source_turn_locator = source_event
            .turn_id
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
            .unwrap_or_else(|| source_event.id.clone());
        let target_turn_id = turn_map
            .entry(source_turn_locator)
            .or_insert_with(|| create_identifier("coding-turn"))
            .clone();

        let mut payload = source_event.payload.clone();
        payload.remove("nativeSessionId");

        if source_event.kind == "message.deleted" {
            let Some(role) = event_payload_role(&payload).map(str::to_owned) else {
                continue;
            };
            payload.insert(
                "deletedMessageId".to_owned(),
                format!("{target_coding_session_id}:authoritative:{target_turn_id}:{role}"),
            );
        }

        forked_events.push(CodingSessionEventPayload {
            id: format!("{runtime_id}:{target_turn_id}:event:{next_sequence}"),
            coding_session_id: target_coding_session_id.to_owned(),
            turn_id: Some(target_turn_id),
            runtime_id: Some(runtime_id.to_owned()),
            kind: source_event.kind,
            sequence: next_sequence,
            payload,
            created_at: source_event.created_at,
        });
        next_sequence += 1;
    }

    forked_events
}

fn parse_authoritative_message_locator(
    coding_session_id: &str,
    message_id: &str,
) -> Option<(String, String)> {
    let prefix = format!("{coding_session_id}:authoritative:");
    let remainder = message_id.strip_prefix(prefix.as_str())?;
    let (turn_locator, role) = remainder.rsplit_once(':')?;
    let normalized_turn_locator = turn_locator.trim();
    let normalized_role = role.trim();
    if normalized_turn_locator.is_empty() || normalized_role.is_empty() {
        return None;
    }

    Some((
        normalized_turn_locator.to_owned(),
        normalized_role.to_owned(),
    ))
}

#[cfg(test)]
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

#[cfg(test)]
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

#[cfg(test)]
fn is_codex_cli_authentication_error(message: &str) -> bool {
    let normalized = message.trim().to_ascii_lowercase();
    normalized.contains("401 unauthorized")
        || normalized.contains("missing bearer or basic authentication")
        || normalized.contains("login")
        || normalized.contains("api key")
        || normalized.contains("authentication")
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
        .or_else(|| {
            snapshot
                .events
                .iter()
                .find_map(|event| event.turn_id.clone())
        })
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

fn find_approval_context(
    snapshot: &ProjectionSnapshot,
    approval_id: &str,
) -> Option<ApprovalContext> {
    snapshot
        .checkpoints
        .iter()
        .enumerate()
        .find_map(|(checkpoint_index, checkpoint)| {
            if checkpoint.checkpoint_kind != "approval" {
                return None;
            }

            if checkpoint.state.get("approvalId").map(String::as_str) != Some(approval_id) {
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
                .or_else(|| {
                    snapshot
                        .turns
                        .iter()
                        .rev()
                        .map(|turn| turn.id.clone())
                        .next()
                });
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
                .or_else(|| {
                    approval_event.and_then(|event| event.payload.get("operationId").cloned())
                })
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
        .ok_or_else(|| {
            format!(
                "approval checkpoint {} was not found",
                context.checkpoint_id
            )
        })?;
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
        checkpoint
            .state
            .insert("turnId".to_owned(), turn_id.clone());
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

fn persist_forked_coding_session_to_provider(
    connection: &mut Connection,
    source_coding_session_id: &str,
    session: &CodingSessionPayload,
    runtime_id: &str,
    events: &[CodingSessionEventPayload],
) -> Result<(), String> {
    let capability_snapshot_json = serde_json::json!({}).to_string();
    let metadata_json = serde_json::json!({
        "createdBy": "core.forkCodingSession",
        "forkedFromCodingSessionId": source_coding_session_id,
    })
    .to_string();
    let transaction = connection
        .transaction()
        .map_err(|error| format!("open fork coding_session transaction failed: {error}"))?;

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
        .map_err(|error| format!("insert forked coding_session {} failed: {error}", session.id))?;

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
                "ready",
                "projection-fork",
                Option::<String>::None,
                Option::<String>::None,
                capability_snapshot_json,
                metadata_json,
            ],
        )
        .map_err(|error| {
            format!(
                "insert forked coding_session runtime for {} failed: {error}",
                session.id
            )
        })?;

    for event in events {
        let payload_json = serde_json::to_string(&event.payload).map_err(|error| {
            format!(
                "serialize forked coding_session event {} failed: {error}",
                event.id
            )
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
                format!("insert forked coding_session event {} failed: {error}", event.id)
            })?;
    }

    transaction
        .commit()
        .map_err(|error| format!("commit fork coding_session transaction failed: {error}"))?;

    Ok(())
}

fn persist_updated_coding_session_to_provider(
    connection: &mut Connection,
    coding_session_id: &str,
    input: &UpdateCodingSessionInput,
) -> Result<(), String> {
    let updated_at = current_storage_timestamp();
    let transaction = connection
        .transaction()
        .map_err(|error| format!("open update coding_session transaction failed: {error}"))?;

    let updated_sessions = transaction
        .execute(
            r#"
            UPDATE coding_sessions
            SET
                updated_at = ?2,
                title = COALESCE(?3, title),
                status = COALESCE(?4, status),
                engine_id = COALESCE(?5, engine_id),
                model_id = COALESCE(?6, model_id)
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![
                coding_session_id,
                updated_at,
                input.title,
                input.status,
                input.engine_id,
                input.model_id,
            ],
        )
        .map_err(|error| {
            format!(
                "update coding_session {coding_session_id} failed: {error}"
            )
        })?;
    if updated_sessions == 0 {
        return Err(format!(
            "coding_session {coding_session_id} was not found while updating"
        ));
    }

    if input.host_mode.is_some() || input.engine_id.is_some() || input.model_id.is_some() {
        transaction
            .execute(
                r#"
                UPDATE coding_session_runtimes
                SET
                    updated_at = ?2,
                    host_mode = COALESCE(?3, host_mode),
                    engine_id = COALESCE(?4, engine_id),
                    model_id = COALESCE(?5, model_id)
                WHERE coding_session_id = ?1 AND is_deleted = 0
                "#,
                params![
                    coding_session_id,
                    updated_at,
                    input.host_mode,
                    input.engine_id,
                    input.model_id,
                ],
            )
            .map_err(|error| {
                format!(
                    "update coding_session runtimes for {coding_session_id} failed: {error}"
                )
            })?;
    }

    transaction
        .commit()
        .map_err(|error| format!("commit update coding_session transaction failed: {error}"))?;

    Ok(())
}

fn persist_deleted_coding_session_to_provider(
    connection: &mut Connection,
    coding_session_id: &str,
) -> Result<(), String> {
    let deleted_at = current_storage_timestamp();
    let transaction = connection
        .transaction()
        .map_err(|error| format!("open delete coding_session transaction failed: {error}"))?;

    let deleted_sessions = transaction
        .execute(
            r#"
            UPDATE coding_sessions
            SET is_deleted = 1, updated_at = ?2
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![coding_session_id, deleted_at],
        )
        .map_err(|error| {
            format!(
                "delete coding_session {coding_session_id} failed: {error}"
            )
        })?;
    if deleted_sessions == 0 {
        return Err(format!(
            "coding_session {coding_session_id} was not found while deleting"
        ));
    }

    for (table_name, id_column) in [
        (PROVIDER_CODING_SESSION_RUNTIMES_TABLE, "coding_session_id"),
        (PROVIDER_CODING_SESSION_TURNS_TABLE, "coding_session_id"),
        (PROVIDER_CODING_SESSION_EVENTS_TABLE, "coding_session_id"),
        (PROVIDER_CODING_SESSION_ARTIFACTS_TABLE, "coding_session_id"),
        (PROVIDER_CODING_SESSION_CHECKPOINTS_TABLE, "coding_session_id"),
        (PROVIDER_CODING_SESSION_OPERATIONS_TABLE, "coding_session_id"),
    ] {
        let sql = format!(
            "UPDATE {table_name} SET is_deleted = 1, updated_at = ?2 WHERE {id_column} = ?1 AND is_deleted = 0"
        );
        transaction
            .execute(sql.as_str(), params![coding_session_id, deleted_at])
            .map_err(|error| {
                format!(
                    "cascade delete in {table_name} for coding_session {coding_session_id} failed: {error}"
                )
            })?;
    }

    transaction
        .commit()
        .map_err(|error| format!("commit delete coding_session transaction failed: {error}"))?;

    Ok(())
}

fn persist_deleted_coding_session_message_to_provider(
    connection: &mut Connection,
    snapshot: &ProjectionSnapshot,
    coding_session_id: &str,
    message_id: &str,
) -> Result<(), String> {
    let (turn_locator, role) = parse_authoritative_message_locator(coding_session_id, message_id)
        .ok_or_else(|| {
            format!(
                "coding session message {message_id} is not an authoritative projection message"
            )
        })?;
    let has_matching_message = snapshot.events.iter().any(|event| {
        event.turn_id.as_deref() == Some(turn_locator.as_str())
            && matches!(event.kind.as_str(), "message.completed" | "message.delta")
            && event_payload_role(&event.payload) == Some(role.as_str())
    });
    if !has_matching_message {
        return Err(format!(
            "coding session message {message_id} was not found in coding session {coding_session_id}"
        ));
    }

    let deleted_at = current_session_timestamp();
    let runtime_id = snapshot
        .events
        .iter()
        .rev()
        .find(|event| {
            event.turn_id.as_deref() == Some(turn_locator.as_str())
                && matches!(event.kind.as_str(), "message.completed" | "message.delta")
                && event_payload_role(&event.payload) == Some(role.as_str())
        })
        .and_then(|event| event.runtime_id.clone());
    let sequence_no = next_event_sequence(snapshot);
    let event_id = format!("{coding_session_id}:{turn_locator}:event:{sequence_no}:message-deleted");
    let event_payload_json = serde_json::to_string(&json!({
        "role": role,
        "deletedMessageId": message_id,
        "runtimeStatus": "completed",
    }))
    .map_err(|error| {
        format!(
            "serialize deleted coding session message event for {message_id} failed: {error}"
        )
    })?;
    let transaction = connection.transaction().map_err(|error| {
        format!("open delete coding session message transaction failed: {error}")
    })?;

    let updated_sessions = transaction
        .execute(
            r#"
            UPDATE coding_sessions
            SET updated_at = ?2
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![coding_session_id, deleted_at],
        )
        .map_err(|error| {
            format!(
                "update coding_session {coding_session_id} for message deletion failed: {error}"
            )
        })?;
    if updated_sessions == 0 {
        return Err(format!(
            "coding_session {coding_session_id} was not found while deleting message {message_id}"
        ));
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
                event_id,
                deleted_at,
                deleted_at,
                0_i64,
                0_i64,
                coding_session_id,
                turn_locator,
                runtime_id,
                "message.deleted",
                sequence_no as i64,
                event_payload_json,
            ],
        )
        .map_err(|error| {
            format!(
                "insert deleted coding session message event for {message_id} failed: {error}"
            )
        })?;

    transaction
        .commit()
        .map_err(|error| format!("commit delete coding session message transaction failed: {error}"))?;

    Ok(())
}

fn persist_created_coding_session_turn_to_provider(
    connection: &mut Connection,
    turn: &CodingSessionTurnPayload,
    events: &[CodingSessionEventPayload],
    operation: &OperationPayload,
    native_session_id: Option<&str>,
) -> Result<(), String> {
    let updated_at = turn
        .completed_at
        .clone()
        .or_else(|| turn.started_at.clone())
        .unwrap_or_else(current_session_timestamp);
    let turn_created_at = turn
        .started_at
        .clone()
        .unwrap_or_else(current_session_timestamp);
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
            SET updated_at = ?2, status = ?3, native_session_id = COALESCE(?5, native_session_id)
            WHERE id = ?1 AND coding_session_id = ?4 AND is_deleted = 0
            "#,
            params![
                runtime_id,
                updated_at,
                "completed",
                turn.coding_session_id,
                native_session_id,
            ],
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
            format!(
                "serialize created event {} payload failed: {error}",
                event.id
            )
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

    transaction.commit().map_err(|error| {
        format!("commit create coding_session turn transaction failed: {error}")
    })?;

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
        .ok_or_else(|| {
            format!(
                "approval checkpoint {} was not found",
                context.checkpoint_id
            )
        })?
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
    let event_payload_json = serde_json::to_string(&event.payload).map_err(|error| {
        format!(
            "serialize approval event {} payload failed: {error}",
            event.id
        )
    })?;
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
                params![
                    operation_id,
                    decided_at,
                    operation_status,
                    coding_session_id
                ],
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
        ensure_sqlite_provider_authority_schema_upgrade(connection)?;
        ensure_sqlite_provider_authority_timestamp_normalization(connection)?;
        ensure_sqlite_user_center_schema(connection)?;
        ensure_sqlite_user_center_bootstrap_user(connection)?;
        ensure_sqlite_bootstrap_user_context(connection)?;
        ensure_sqlite_catalog_seed_data(connection)?;
        return Ok(());
    }

    Err(format!(
        "sqlite authority file {} is missing required direct provider tables",
        path.display()
    ))
}

fn ensure_sqlite_bootstrap_user_context(connection: &mut Connection) -> Result<(), String> {
    let workspace_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM workspaces WHERE is_deleted = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("count bootstrap workspaces failed: {error}"))?;

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
        upsert_bootstrap_workspace(&transaction, &bootstrap_timestamp)?;
    }

    archive_legacy_bootstrap_project(&transaction, &bootstrap_timestamp)?;

    let bootstrap_team_count: i64 = transaction
        .query_row(
            "SELECT COUNT(*) FROM teams WHERE is_deleted = 0 AND workspace_id = ?1",
            params![&preferred_workspace_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("count bootstrap teams failed: {error}"))?;
    if bootstrap_team_count == 0 {
        upsert_bootstrap_team(&transaction, &preferred_workspace_id, &bootstrap_timestamp)?;
    }

    let bootstrap_team_member_count: i64 = transaction
        .query_row(
            "SELECT COUNT(*) FROM team_members WHERE is_deleted = 0 AND team_id = 'team-default'",
            [],
            |row| row.get(0),
        )
        .map_err(|error| format!("count bootstrap team members failed: {error}"))?;
    if bootstrap_team_member_count == 0 {
        upsert_bootstrap_team_member(&transaction, &bootstrap_timestamp)?;
    }

    let bootstrap_workspace_member_count: i64 = transaction
        .query_row(
            "SELECT COUNT(*) FROM workspace_members WHERE is_deleted = 0 AND workspace_id = ?1",
            params![&preferred_workspace_id],
            |row| row.get(0),
        )
        .map_err(|error| format!("count bootstrap workspace members failed: {error}"))?;
    if bootstrap_workspace_member_count == 0 {
        upsert_bootstrap_workspace_member(
            &transaction,
            &preferred_workspace_id,
            &bootstrap_timestamp,
        )?;
    }

    transaction
        .commit()
        .map_err(|error| format!("commit bootstrap user context transaction failed: {error}"))?;

    backfill_sqlite_authority_access_context(connection)
}

fn upsert_bootstrap_workspace(
    transaction: &rusqlite::Transaction<'_>,
    bootstrap_timestamp: &str,
) -> Result<(), String> {
    let bootstrap_workspace_uuid = Uuid::new_v4().to_string();
    let bootstrap_workspace_code =
        build_workspace_business_code(BOOTSTRAP_WORKSPACE_ID, BOOTSTRAP_WORKSPACE_NAME);
    transaction
        .execute(
            r#"
            INSERT INTO workspaces (
                id, uuid, tenant_id, created_at, updated_at, version, is_deleted, name, code, title,
                description, owner_id, leader_id, created_by_user_id, type, settings_json, status
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
            ON CONFLICT(id)
            DO UPDATE SET
                uuid = COALESCE(workspaces.uuid, excluded.uuid),
                tenant_id = COALESCE(workspaces.tenant_id, excluded.tenant_id),
                updated_at = excluded.updated_at,
                is_deleted = 0,
                name = excluded.name,
                code = excluded.code,
                title = excluded.title,
                description = excluded.description,
                owner_id = excluded.owner_id,
                leader_id = excluded.leader_id,
                created_by_user_id = excluded.created_by_user_id,
                type = COALESCE(workspaces.type, excluded.type),
                settings_json = COALESCE(workspaces.settings_json, excluded.settings_json),
                status = excluded.status
            "#,
            params![
                BOOTSTRAP_WORKSPACE_ID,
                &bootstrap_workspace_uuid,
                SQLITE_AUTHORITY_DEFAULT_TENANT_ID,
                bootstrap_timestamp,
                bootstrap_timestamp,
                0_i64,
                0_i64,
                BOOTSTRAP_WORKSPACE_NAME,
                &bootstrap_workspace_code,
                BOOTSTRAP_WORKSPACE_NAME,
                BOOTSTRAP_WORKSPACE_DESCRIPTION,
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                "DEFAULT",
                "{}",
                "active",
            ],
        )
        .map_err(|error| format!("upsert bootstrap workspace failed: {error}"))?;

    Ok(())
}

fn archive_legacy_bootstrap_project(
    transaction: &rusqlite::Transaction<'_>,
    bootstrap_timestamp: &str,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            UPDATE projects
            SET updated_at = ?2,
                is_deleted = 1,
                status = 'archived'
            WHERE id = ?1
              AND name = ?3
              AND (root_path IS NULL OR TRIM(root_path) = '')
            "#,
            params![
                BOOTSTRAP_PROJECT_ID,
                bootstrap_timestamp,
                BOOTSTRAP_PROJECT_NAME,
            ],
        )
        .map_err(|error| format!("archive legacy bootstrap project failed: {error}"))?;
    transaction
        .execute(
            r#"
            UPDATE project_collaborators
            SET updated_at = ?2,
                is_deleted = 1,
                status = 'archived'
            WHERE project_id = ?1
            "#,
            params![BOOTSTRAP_PROJECT_ID, bootstrap_timestamp],
        )
        .map_err(|error| format!("archive legacy bootstrap project collaborators failed: {error}"))?;

    Ok(())
}

fn upsert_bootstrap_team(
    transaction: &rusqlite::Transaction<'_>,
    preferred_workspace_id: &str,
    bootstrap_timestamp: &str,
) -> Result<(), String> {
    let bootstrap_team_uuid = Uuid::new_v4().to_string();
    let bootstrap_team_code = build_team_business_code("team-default", "Default Workspace Owners");
    transaction
        .execute(
            r#"
            INSERT INTO teams (
                id, uuid, tenant_id, created_at, updated_at, version, is_deleted, workspace_id, name, code,
                title, description, owner_id, leader_id, created_by_user_id, metadata_json, status
            )
            VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            ON CONFLICT(id)
            DO UPDATE SET
                uuid = COALESCE(teams.uuid, excluded.uuid),
                tenant_id = COALESCE(teams.tenant_id, excluded.tenant_id),
                updated_at = excluded.updated_at,
                is_deleted = 0,
                workspace_id = excluded.workspace_id,
                name = excluded.name,
                code = excluded.code,
                title = excluded.title,
                description = excluded.description,
                owner_id = excluded.owner_id,
                leader_id = excluded.leader_id,
                created_by_user_id = excluded.created_by_user_id,
                metadata_json = COALESCE(teams.metadata_json, excluded.metadata_json),
                status = excluded.status
            "#,
            params![
                "team-default",
                &bootstrap_team_uuid,
                SQLITE_AUTHORITY_DEFAULT_TENANT_ID,
                bootstrap_timestamp,
                bootstrap_timestamp,
                preferred_workspace_id,
                "Default Workspace Owners",
                &bootstrap_team_code,
                "Default Workspace Owners",
                Some("Bootstrap workspace owner team.".to_owned()),
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                "{}",
                "active",
            ],
        )
        .map_err(|error| format!("upsert bootstrap team failed: {error}"))?;

    Ok(())
}

fn upsert_bootstrap_team_member(
    transaction: &rusqlite::Transaction<'_>,
    bootstrap_timestamp: &str,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            INSERT INTO team_members (
                id, created_at, updated_at, version, is_deleted, team_id, user_id, role,
                created_by_user_id, granted_by_user_id, status
            )
            VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, ?9)
            ON CONFLICT(id)
            DO UPDATE SET
                updated_at = excluded.updated_at,
                is_deleted = 0,
                team_id = excluded.team_id,
                user_id = excluded.user_id,
                role = excluded.role,
                created_by_user_id = excluded.created_by_user_id,
                granted_by_user_id = excluded.granted_by_user_id,
                status = excluded.status
            "#,
            params![
                "team-member-default-owner",
                bootstrap_timestamp,
                bootstrap_timestamp,
                "team-default",
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                "owner",
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                "active",
            ],
        )
        .map_err(|error| format!("upsert bootstrap team member failed: {error}"))?;

    Ok(())
}

fn upsert_bootstrap_workspace_member(
    transaction: &rusqlite::Transaction<'_>,
    preferred_workspace_id: &str,
    bootstrap_timestamp: &str,
) -> Result<(), String> {
    transaction
        .execute(
            r#"
            INSERT INTO workspace_members (
                id, created_at, updated_at, version, is_deleted, workspace_id, user_id, team_id, role,
                created_by_user_id, granted_by_user_id, status
            )
            VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            ON CONFLICT(id)
            DO UPDATE SET
                updated_at = excluded.updated_at,
                is_deleted = 0,
                workspace_id = excluded.workspace_id,
                user_id = excluded.user_id,
                team_id = excluded.team_id,
                role = excluded.role,
                created_by_user_id = excluded.created_by_user_id,
                granted_by_user_id = excluded.granted_by_user_id,
                status = excluded.status
            "#,
            params![
                "workspace-member-default-owner",
                bootstrap_timestamp,
                bootstrap_timestamp,
                preferred_workspace_id,
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                "team-default",
                "owner",
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                "active",
            ],
        )
        .map_err(|error| format!("upsert bootstrap workspace member failed: {error}"))?;

    Ok(())
}

fn backfill_sqlite_authority_access_context(connection: &mut Connection) -> Result<(), String> {
    let workspace_authority_pairs = load_provider_workspace_payloads(connection)?
        .into_iter()
        .map(|workspace| {
            let (owner_id, leader_id, created_by_user_id) = resolve_effective_user_authority(
                workspace.owner_id.as_deref(),
                workspace.leader_id.as_deref(),
                workspace.created_by_user_id.as_deref(),
                None,
                None,
                None,
            );
            let _ = leader_id;
            (workspace.id, (owner_id, created_by_user_id))
        })
        .collect::<BTreeMap<_, _>>();
    let projects = load_provider_project_payloads(connection)?;
    let now = current_storage_timestamp();
    let transaction = connection
        .transaction()
        .map_err(|error| format!("open authority access backfill transaction failed: {error}"))?;

    for (workspace_id, (owner_user_id, created_by_user_id)) in workspace_authority_pairs.iter() {
        let workspace_member_count: i64 = transaction
            .query_row(
                "SELECT COUNT(*) FROM workspace_members WHERE is_deleted = 0 AND workspace_id = ?1",
                params![workspace_id],
                |row| row.get(0),
            )
            .map_err(|error| format!("count workspace members during backfill failed: {error}"))?;
        if workspace_member_count == 0 {
            let workspace_member_id = create_identifier("workspace-member");
            transaction
                .execute(
                    r#"
                    INSERT INTO workspace_members (
                        id, created_at, updated_at, version, is_deleted, workspace_id, user_id, team_id, role,
                        created_by_user_id, granted_by_user_id, status
                    )
                    VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                    "#,
                    params![
                        &workspace_member_id,
                        &now,
                        &now,
                        workspace_id,
                        owner_user_id,
                        Option::<String>::None,
                        "owner",
                        created_by_user_id,
                        created_by_user_id,
                        "active",
                    ],
                )
                .map_err(|error| format!("insert workspace access backfill member failed: {error}"))?;
        }
    }

    for project in projects {
        let workspace_authority_pair = workspace_authority_pairs.get(&project.workspace_id);
        let (owner_user_id, _, created_by_user_id) = resolve_effective_user_authority(
            project.owner_id.as_deref(),
            project.leader_id.as_deref(),
            project.created_by_user_id.as_deref(),
            workspace_authority_pair.map(|pair| pair.0.as_str()),
            None,
            workspace_authority_pair.map(|pair| pair.1.as_str()),
        );

        let project_collaborator_count: i64 = transaction
            .query_row(
                "SELECT COUNT(*) FROM project_collaborators WHERE is_deleted = 0 AND project_id = ?1",
                params![&project.id],
                |row| row.get(0),
            )
            .map_err(|error| format!("count project collaborators during backfill failed: {error}"))?;
        if project_collaborator_count == 0 {
            let project_collaborator_id = create_identifier("project-collaborator");
            transaction
                .execute(
                    r#"
                    INSERT INTO project_collaborators (
                        id, created_at, updated_at, version, is_deleted, project_id, workspace_id, user_id, team_id, role,
                        created_by_user_id, granted_by_user_id, status
                    )
                    VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                    "#,
                    params![
                        &project_collaborator_id,
                        &now,
                        &now,
                        &project.id,
                        &project.workspace_id,
                        &owner_user_id,
                        Option::<String>::None,
                        "owner",
                        &created_by_user_id,
                        &created_by_user_id,
                        "active",
                    ],
                )
                .map_err(|error| {
                    format!("insert project access backfill collaborator failed: {error}")
                })?;
        }
    }

    transaction
        .commit()
        .map_err(|error| format!("commit authority access backfill transaction failed: {error}"))?;

    Ok(())
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
            sort_timestamp: parse_storage_timestamp_millis("2026-04-10T00:00:01Z")
                .unwrap_or_default(),
            transcript_updated_at: None,
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
                payload: build_demo_metadata(&[("engineId", "codex"), ("runtimeStatus", "ready")]),
                created_at: "2026-04-10T00:00:00Z".to_owned(),
            },
            CodingSessionEventPayload {
                id: "demo-runtime:demo-turn:event:1".to_owned(),
                coding_session_id: "demo-coding-session".to_owned(),
                turn_id: Some("demo-turn".to_owned()),
                runtime_id: Some("demo-runtime".to_owned()),
                kind: "turn.started".to_owned(),
                sequence: 1,
                payload: build_demo_metadata(&[("engineId", "codex"), ("requestKind", "chat")]),
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
                created_at: session.created_at.clone(),
                updated_at: resolve_latest_storage_timestamp_from_candidates(&[
                    Some(session.updated_at.as_str()),
                    latest_runtime.map(|runtime| runtime.updated_at.as_str()),
                ])
                .unwrap_or(session.updated_at),
                last_turn_at: session.last_turn_at,
                sort_timestamp: 0,
                transcript_updated_at: None,
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
        let mut connection = Connection::open(path).map_err(|error| {
            format!(
                "open sqlite projection file {} failed: {error}",
                path.display()
            )
        })?;
        ensure_sqlite_provider_authority(&mut connection, path)?;
        Self::from_sqlite_provider_connection(&connection)
    }

    fn from_json_file(path: &FsPath) -> Result<Self, String> {
        let raw = fs::read_to_string(path)
            .map_err(|error| format!("read snapshot file {} failed: {error}", path.display()))?;
        serde_json::from_str(&raw)
            .map_err(|error| format!("parse snapshot file {} failed: {error}", path.display()))
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
            .and_then(|snapshot| {
                snapshot.session.as_ref().map(|session| {
                    normalize_coding_session_payload(
                        session,
                        resolve_projection_transcript_updated_at(snapshot.events.as_slice()),
                    )
                })
            })
    }

    fn sessions(&self) -> Vec<CodingSessionPayload> {
        let mut sessions = self
            .sessions
            .values()
            .filter_map(|snapshot| {
                snapshot.session.as_ref().map(|session| {
                    normalize_coding_session_payload(
                        session,
                        resolve_projection_transcript_updated_at(snapshot.events.as_slice()),
                    )
                })
            })
            .collect::<Vec<_>>();
        sessions.sort_by(|left, right| {
            resolve_coding_session_payload_sort_timestamp(right)
                .cmp(&resolve_coding_session_payload_sort_timestamp(left))
                .then_with(|| right.updated_at.cmp(&left.updated_at))
                .then_with(|| right.created_at.cmp(&left.created_at))
                .then_with(|| left.id.cmp(&right.id))
        });
        sessions
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
        self.sessions
            .iter()
            .find_map(|(coding_session_id, snapshot)| {
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

    fn sessions(&self) -> Vec<CodingSessionPayload> {
        self.state
            .read()
            .expect("read projection authority state")
            .sessions()
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
        let timestamp = current_session_timestamp();
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
            last_turn_at: Some(timestamp.clone()),
            sort_timestamp: parse_storage_timestamp_millis(timestamp.as_str()).unwrap_or_default(),
            transcript_updated_at: None,
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

    fn fork_coding_session(
        &self,
        source_session: CodingSessionPayload,
        source_events: Vec<CodingSessionEventPayload>,
        input: ForkCodingSessionInput,
    ) -> Result<CodingSessionPayload, String> {
        let forked_session = build_forked_coding_session_payload(&source_session, &input);
        let runtime_id = create_identifier("coding-runtime");
        let forked_events = build_forked_transcript_events(
            source_events.as_slice(),
            forked_session.id.as_str(),
            runtime_id.as_str(),
        );

        if let Some(sqlite_file) = self.sqlite_file.as_deref() {
            let mut connection = Connection::open(sqlite_file).map_err(|error| {
                format!(
                    "open sqlite coding-session fork authority {} failed: {error}",
                    sqlite_file.display()
                )
            })?;
            ensure_sqlite_provider_authority(&mut connection, sqlite_file)?;
            persist_forked_coding_session_to_provider(
                &mut connection,
                source_session.id.as_str(),
                &forked_session,
                runtime_id.as_str(),
                forked_events.as_slice(),
            )?;
            let reloaded_state = ProjectionReadState::from_sqlite_provider_connection(&connection)?;
            let forked_summary = reloaded_state
                .session(forked_session.id.as_str())
                .ok_or_else(|| format!("forked coding session {} was not found", forked_session.id))?;
            *self
                .state
                .write()
                .expect("write projection authority state") = reloaded_state;
            return Ok(forked_summary);
        }

        self.state
            .write()
            .expect("write projection authority state")
            .sessions
            .insert(
                forked_session.id.clone(),
                ProjectionSnapshot {
                    session: Some(forked_session.clone()),
                    turns: Vec::new(),
                    operations: Vec::new(),
                    events: forked_events,
                    artifacts: Vec::new(),
                    checkpoints: Vec::new(),
                },
            );

        Ok(forked_session)
    }

    fn update_coding_session(
        &self,
        coding_session_id: &str,
        input: UpdateCodingSessionInput,
    ) -> Result<CodingSessionPayload, String> {
        let updated_at = current_session_timestamp();

        if let Some(sqlite_file) = self.sqlite_file.as_deref() {
            let mut connection = Connection::open(sqlite_file).map_err(|error| {
                format!(
                    "open sqlite coding-session update authority {} failed: {error}",
                    sqlite_file.display()
                )
            })?;
            ensure_sqlite_provider_authority(&mut connection, sqlite_file)?;
            persist_updated_coding_session_to_provider(&mut connection, coding_session_id, &input)?;
            let reloaded_state = ProjectionReadState::from_sqlite_provider_connection(&connection)?;
            let updated_session = reloaded_state
                .session(coding_session_id)
                .ok_or_else(|| format!("coding session {coding_session_id} was not found"))?;
            *self
                .state
                .write()
                .expect("write projection authority state") = reloaded_state;
            return Ok(updated_session);
        }

        let mut state = self
            .state
            .write()
            .expect("write projection authority state");
        let snapshot = state
            .sessions
            .get_mut(coding_session_id)
            .ok_or_else(|| format!("coding session {coding_session_id} was not found"))?;
        let session = snapshot
            .session
            .as_mut()
            .ok_or_else(|| format!("coding session {coding_session_id} has no session payload"))?;

        if let Some(title) = input.title {
            session.title = title;
        }
        if let Some(status) = input.status {
            session.status = status;
        }
        if let Some(host_mode) = input.host_mode {
            session.host_mode = host_mode;
        }
        if let Some(engine_id) = input.engine_id {
            session.engine_id = engine_id;
        }
        if let Some(model_id) = input.model_id {
            session.model_id = Some(model_id);
        }
        session.updated_at = updated_at;

        Ok(session.clone())
    }

    fn delete_coding_session(&self, coding_session_id: &str) -> Result<(), String> {
        if let Some(sqlite_file) = self.sqlite_file.as_deref() {
            let mut connection = Connection::open(sqlite_file).map_err(|error| {
                format!(
                    "open sqlite coding-session delete authority {} failed: {error}",
                    sqlite_file.display()
                )
            })?;
            ensure_sqlite_provider_authority(&mut connection, sqlite_file)?;
            persist_deleted_coding_session_to_provider(&mut connection, coding_session_id)?;
            let reloaded_state = ProjectionReadState::from_sqlite_provider_connection(&connection)?;
            *self
                .state
                .write()
                .expect("write projection authority state") = reloaded_state;
            return Ok(());
        }

        let removed_snapshot = self
            .state
            .write()
            .expect("write projection authority state")
            .sessions
            .remove(coding_session_id);
        if removed_snapshot.is_none() {
            return Err(format!("coding session {coding_session_id} was not found"));
        }

        Ok(())
    }

    fn delete_coding_session_message(
        &self,
        coding_session_id: &str,
        message_id: &str,
    ) -> Result<(), String> {
        let snapshot = self
            .session_snapshot(coding_session_id)
            .ok_or_else(|| format!("coding session {coding_session_id} was not found"))?;
        let (turn_locator, role) =
            parse_authoritative_message_locator(coding_session_id, message_id).ok_or_else(|| {
                format!(
                    "coding session message {message_id} is not an authoritative projection message"
                )
            })?;
        let has_matching_message = snapshot.events.iter().any(|event| {
            event.turn_id.as_deref() == Some(turn_locator.as_str())
                && matches!(event.kind.as_str(), "message.completed" | "message.delta")
                && event_payload_role(&event.payload) == Some(role.as_str())
        });
        if !has_matching_message {
            return Err(format!(
                "coding session message {message_id} was not found in coding session {coding_session_id}"
            ));
        }

        if let Some(sqlite_file) = self.sqlite_file.as_deref() {
            let mut connection = Connection::open(sqlite_file).map_err(|error| {
                format!(
                    "open sqlite coding-session message delete authority {} failed: {error}",
                    sqlite_file.display()
                )
            })?;
            ensure_sqlite_provider_authority(&mut connection, sqlite_file)?;
            persist_deleted_coding_session_message_to_provider(
                &mut connection,
                &snapshot,
                coding_session_id,
                message_id,
            )?;
            let reloaded_state = ProjectionReadState::from_sqlite_provider_connection(&connection)?;
            *self
                .state
                .write()
                .expect("write projection authority state") = reloaded_state;
            return Ok(());
        }

        let deleted_at = current_session_timestamp();
        let mut state = self
            .state
            .write()
            .expect("write projection authority state");
        let snapshot = state
            .sessions
            .get_mut(coding_session_id)
            .ok_or_else(|| format!("coding session {coding_session_id} was not found"))?;
        if let Some(session) = snapshot.session.as_mut() {
            session.updated_at = deleted_at.clone();
        }
        let next_sequence = next_event_sequence(snapshot);
        let runtime_id = snapshot
            .events
            .iter()
            .rev()
            .find(|event| {
                event.turn_id.as_deref() == Some(turn_locator.as_str())
                    && matches!(event.kind.as_str(), "message.completed" | "message.delta")
                    && event_payload_role(&event.payload) == Some(role.as_str())
            })
            .and_then(|event| event.runtime_id.clone());
        let turn_id = turn_locator.clone();
        snapshot.events.push(CodingSessionEventPayload {
            id: format!(
                "{coding_session_id}:{turn_id}:event:{next_sequence}:message-deleted"
            ),
            coding_session_id: coding_session_id.to_owned(),
            turn_id: Some(turn_id),
            runtime_id,
            kind: "message.deleted".to_owned(),
            sequence: next_sequence,
            payload: build_demo_metadata(&[
                ("role", role.as_str()),
                ("deletedMessageId", message_id),
                ("runtimeStatus", "completed"),
            ]),
            created_at: deleted_at,
        });

        Ok(())
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
        let started_at = current_session_timestamp();
        let provider_runtime_row = if let Some(sqlite_file) = self.sqlite_file.as_deref() {
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
        } else {
            None
        };
        let runtime_id = provider_runtime_row
            .as_ref()
            .map(|runtime| runtime.id.clone())
            .or(input.runtime_id.clone())
            .unwrap_or_else(|| derive_runtime_id(&snapshot, coding_session_id));
        let native_session_id = provider_runtime_row
            .as_ref()
            .and_then(|runtime| runtime.native_session_id.clone())
            .or_else(|| resolve_native_session_id_from_snapshot(&snapshot));
        let turn_id = create_identifier("coding-turn");
        let operation_id = format!("{turn_id}:operation");
        let request_kind = input.request_kind;
        let input_summary = input.input_summary;
        let completed_at = current_session_timestamp();
        let native_turn_result = native_sessions::execute_native_session_turn(
            &native_sessions::NativeSessionTurnRequest {
                engine_id: session.engine_id.clone(),
                model_id: session.model_id.clone(),
                native_session_id: native_session_id.clone(),
                request_kind: request_kind.clone(),
                input_summary: input_summary.clone(),
                ide_context: to_native_session_turn_ide_context(input.ide_context.as_ref()),
                working_directory: working_directory.map(FsPath::to_path_buf),
                config: native_sessions::NativeSessionTurnConfig {
                    full_auto: true,
                    skip_git_repo_check: true,
                    ..Default::default()
                },
            },
        )?;
        let assistant_content = native_turn_result.assistant_content.clone();
        let resolved_native_session_id = native_turn_result
            .native_session_id
            .clone()
            .or(native_session_id);
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
        if let Some(native_session_id) = resolved_native_session_id.as_ref() {
            started_payload.insert("nativeSessionId".to_owned(), native_session_id.clone());
        }

        let mut message_payload = BTreeMap::new();
        message_payload.insert("role".to_owned(), "user".to_owned());
        message_payload.insert("content".to_owned(), input_summary.clone());
        message_payload.insert("operationId".to_owned(), operation_id.clone());
        message_payload.insert("runtimeStatus".to_owned(), "completed".to_owned());
        if let Some(native_session_id) = resolved_native_session_id.as_ref() {
            message_payload.insert("nativeSessionId".to_owned(), native_session_id.clone());
        }

        let mut assistant_message_payload = BTreeMap::new();
        assistant_message_payload.insert("role".to_owned(), "assistant".to_owned());
        assistant_message_payload.insert("content".to_owned(), assistant_content.clone());
        assistant_message_payload.insert("operationId".to_owned(), operation_id.clone());
        assistant_message_payload.insert("runtimeStatus".to_owned(), "completed".to_owned());
        if let Some(native_session_id) = resolved_native_session_id.as_ref() {
            assistant_message_payload
                .insert("nativeSessionId".to_owned(), native_session_id.clone());
        }

        let mut operation_payload = BTreeMap::new();
        operation_payload.insert("operationId".to_owned(), operation_id.clone());
        operation_payload.insert("status".to_owned(), "succeeded".to_owned());
        operation_payload.insert("runtimeStatus".to_owned(), "completed".to_owned());
        if let Some(native_session_id) = resolved_native_session_id.as_ref() {
            operation_payload.insert("nativeSessionId".to_owned(), native_session_id.clone());
        }

        let mut completed_payload = BTreeMap::new();
        completed_payload.insert("operationId".to_owned(), operation_id.clone());
        completed_payload.insert("finishReason".to_owned(), "stop".to_owned());
        completed_payload.insert(
            "contentLength".to_owned(),
            assistant_content.len().to_string(),
        );
        completed_payload.insert("runtimeStatus".to_owned(), "completed".to_owned());
        if let Some(native_session_id) = resolved_native_session_id.as_ref() {
            completed_payload.insert("nativeSessionId".to_owned(), native_session_id.clone());
        }

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
                created_at: started_at.clone(),
            },
            CodingSessionEventPayload {
                id: format!("{runtime_id}:{turn_id}:event:{}", base_sequence + 2),
                coding_session_id: coding_session_id.to_owned(),
                turn_id: Some(turn_id.clone()),
                runtime_id: Some(runtime_id.clone()),
                kind: "message.completed".to_owned(),
                sequence: base_sequence + 2,
                payload: assistant_message_payload,
                created_at: completed_at.clone(),
            },
            CodingSessionEventPayload {
                id: format!("{runtime_id}:{turn_id}:event:{}", base_sequence + 3),
                coding_session_id: coding_session_id.to_owned(),
                turn_id: Some(turn_id.clone()),
                runtime_id: Some(runtime_id.clone()),
                kind: "operation.updated".to_owned(),
                sequence: base_sequence + 3,
                payload: operation_payload,
                created_at: completed_at.clone(),
            },
            CodingSessionEventPayload {
                id: format!("{runtime_id}:{turn_id}:event:{}", base_sequence + 4),
                coding_session_id: coding_session_id.to_owned(),
                turn_id: Some(turn_id.clone()),
                runtime_id: Some(runtime_id.clone()),
                kind: "turn.completed".to_owned(),
                sequence: base_sequence + 4,
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
                resolved_native_session_id.as_deref(),
            )?;
            let reloaded_state = ProjectionReadState::from_sqlite_provider_connection(&connection)?;
            *self
                .state
                .write()
                .expect("write projection authority state") = reloaded_state;
        } else {
            let mut state = self
                .state
                .write()
                .expect("write projection authority state");
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
        let decided_at = current_session_timestamp();

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
            let refreshed_state =
                ProjectionReadState::from_sqlite_provider_connection(&connection)?;
            *self
                .state
                .write()
                .expect("write projection authority state") = refreshed_state;
            return Ok(decision);
        }

        let mut state = self
            .state
            .write()
            .expect("write projection authority state");
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
            workspace_members: self.workspace_members.clone(),
            project_collaborators: self.project_collaborators.clone(),
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
            workspace_members: load_provider_workspace_member_payloads(&connection)?,
            project_collaborators: load_provider_project_collaborator_payloads(&connection)?,
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

    fn open_authority_connection_for_write(&self) -> Result<Connection, String> {
        let Some(sqlite_file) = self.projections.sqlite_file.as_deref() else {
            return Err(
                "App/admin authority writes require a configured sqlite authority file.".to_owned(),
            );
        };

        let mut connection = Connection::open(sqlite_file).map_err(|error| {
            format!(
                "open sqlite app/admin authority file {} failed: {error}",
                sqlite_file.display()
            )
        })?;
        ensure_sqlite_provider_authority(&mut connection, sqlite_file)?;
        Ok(connection)
    }

    fn has_workspace(&self, workspace_id: &str) -> bool {
        self.read_app_admin_state()
            .workspaces
            .iter()
            .any(|workspace| workspace.id == workspace_id)
    }

    fn publish_workspace_realtime_event(
        &self,
        event_kind: &str,
        source_surface: &str,
        workspace_id: String,
        project_id: Option<String>,
        project_name: Option<String>,
        project_root_path: Option<String>,
        project_updated_at: Option<String>,
        coding_session_id: Option<String>,
        coding_session_title: Option<String>,
        coding_session_status: Option<String>,
        coding_session_host_mode: Option<String>,
        coding_session_engine_id: Option<String>,
        coding_session_model_id: Option<String>,
        coding_session_updated_at: Option<String>,
        turn_id: Option<String>,
    ) {
        self.realtime.publish(WorkspaceRealtimeEventPayload {
            event_id: format!("realtime-{}", Uuid::new_v4()),
            event_kind: event_kind.to_owned(),
            workspace_id,
            project_id,
            project_name,
            project_root_path,
            coding_session_id,
            coding_session_title,
            coding_session_status,
            coding_session_host_mode,
            coding_session_engine_id,
            coding_session_model_id,
            turn_id,
            occurred_at: current_storage_timestamp(),
            project_updated_at,
            coding_session_updated_at,
            source_surface: source_surface.to_owned(),
        });
    }

    fn demo() -> Self {
        Self {
            projections: ProjectionAuthorityState::new(ProjectionReadState::demo(), None),
            realtime: WorkspaceRealtimeHub::new(),
            user_center: UserCenterState::from_env(),
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
                rationale: Some(
                    "Demo terminal lane requires explicit approval for codex.".to_owned(),
                ),
                status: "active".to_owned(),
                updated_at: "2026-04-10T13:06:00Z".to_owned(),
            }],
            workspaces: vec![WorkspacePayload {
                id: "demo-workspace".to_owned(),
                uuid: Some("workspace-uuid-demo".to_owned()),
                tenant_id: Some(SQLITE_AUTHORITY_DEFAULT_TENANT_ID.to_owned()),
                organization_id: None,
                code: Some("demo.workspace".to_owned()),
                title: Some("Demo Workspace".to_owned()),
                name: "Demo Workspace".to_owned(),
                description: Some(
                    "Default embedded workspace for the local desktop authority.".to_owned(),
                ),
                owner_id: Some("user-demo-owner".to_owned()),
                leader_id: Some("user-demo-owner".to_owned()),
                created_by_user_id: Some("user-demo-owner".to_owned()),
                entity_type: Some("DEFAULT".to_owned()),
                member_count: Some(1),
                status: "active".to_owned(),
                viewer_role: Some("owner".to_owned()),
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
                created_at: Some("2026-04-10T12:59:00Z".to_owned()),
                id: "demo-project".to_owned(),
                uuid: Some("project-uuid-demo".to_owned()),
                tenant_id: Some(SQLITE_AUTHORITY_DEFAULT_TENANT_ID.to_owned()),
                organization_id: None,
                workspace_id: "demo-workspace".to_owned(),
                workspace_uuid: Some("workspace-uuid-demo".to_owned()),
                code: Some("demo.project".to_owned()),
                title: Some("Demo IDE workspace project".to_owned()),
                name: "Demo IDE workspace project".to_owned(),
                description: Some("Representative app project list item.".to_owned()),
                root_path: Some("E:/sdkwork/demo-project".to_owned()),
                owner_id: Some("user-demo-owner".to_owned()),
                leader_id: Some("user-demo-owner".to_owned()),
                created_by_user_id: Some("user-demo-owner".to_owned()),
                author: Some("user-demo-owner".to_owned()),
                entity_type: Some("CODE".to_owned()),
                collaborator_count: Some(1),
                status: "active".to_owned(),
                updated_at: Some("2026-04-10T13:00:00Z".to_owned()),
                viewer_role: Some("owner".to_owned()),
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
                user_id: "user-demo-owner".to_owned(),
                role: "owner".to_owned(),
                created_by_user_id: Some("user-demo-owner".to_owned()),
                granted_by_user_id: Some("user-demo-owner".to_owned()),
                status: "active".to_owned(),
            }],
            workspace_members: vec![WorkspaceMemberPayload {
                id: "workspace-member-demo-owner".to_owned(),
                workspace_id: "demo-workspace".to_owned(),
                user_id: "user-demo-owner".to_owned(),
                user_email: Some("demo-owner@sdkwork.dev".to_owned()),
                user_display_name: Some("Demo Owner".to_owned()),
                user_avatar_url: None,
                team_id: Some("demo-team".to_owned()),
                role: "owner".to_owned(),
                status: "active".to_owned(),
                created_by_user_id: Some("user-demo-owner".to_owned()),
                granted_by_user_id: Some("user-demo-owner".to_owned()),
                created_at: Some("2026-04-10T12:58:00Z".to_owned()),
                updated_at: Some("2026-04-10T12:58:00Z".to_owned()),
            }],
            project_collaborators: vec![ProjectCollaboratorPayload {
                id: "project-collaborator-demo-owner".to_owned(),
                project_id: "demo-project".to_owned(),
                workspace_id: "demo-workspace".to_owned(),
                user_id: "user-demo-owner".to_owned(),
                user_email: Some("demo-owner@sdkwork.dev".to_owned()),
                user_display_name: Some("Demo Owner".to_owned()),
                user_avatar_url: None,
                team_id: Some("demo-team".to_owned()),
                role: "owner".to_owned(),
                status: "active".to_owned(),
                created_by_user_id: Some("user-demo-owner".to_owned()),
                granted_by_user_id: Some("user-demo-owner".to_owned()),
                created_at: Some("2026-04-10T12:59:00Z".to_owned()),
                updated_at: Some("2026-04-10T12:59:00Z".to_owned()),
            }],
            teams: vec![TeamPayload {
                id: "demo-team".to_owned(),
                uuid: Some("team-uuid-demo".to_owned()),
                tenant_id: Some(SQLITE_AUTHORITY_DEFAULT_TENANT_ID.to_owned()),
                organization_id: None,
                workspace_id: "demo-workspace".to_owned(),
                code: Some("demo.team".to_owned()),
                title: Some("Demo collaboration team".to_owned()),
                name: "Demo collaboration team".to_owned(),
                description: Some("Representative admin team list item.".to_owned()),
                owner_id: Some("user-demo-owner".to_owned()),
                leader_id: Some("user-demo-owner".to_owned()),
                created_by_user_id: Some("user-demo-owner".to_owned()),
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
                realtime: WorkspaceRealtimeHub::new(),
                user_center: UserCenterState::from_env(),
                audits: load_provider_audit_payloads(&connection)?,
                deployments: load_provider_deployment_payloads(&connection)?,
                targets: load_provider_deployment_target_payloads(&connection)?,
                documents: load_provider_document_payloads(&connection)?,
                members: load_provider_team_member_payloads(&connection)?,
                workspace_members: load_provider_workspace_member_payloads(&connection)?,
                project_collaborators: load_provider_project_collaborator_payloads(&connection)?,
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
            realtime: WorkspaceRealtimeHub::new(),
            user_center: UserCenterState::from_env(),
            audits: demo.audits,
            deployments: demo.deployments,
            targets: demo.targets,
            documents: demo.documents,
            members: demo.members,
            workspace_members: demo.workspace_members,
            project_collaborators: demo.project_collaborators,
            policies: demo.policies,
            workspaces: demo.workspaces,
            projects: demo.projects,
            teams: demo.teams,
            releases: demo.releases,
        })
    }
}

const CODING_SERVER_OPENAPI_ROUTE_SPECS: [RouteSpec; 61] = [
    RouteSpec {
        method: "get",
        operation_id: "core.getDescriptor",
        path: "/api/core/v1/descriptor",
        summary: "Get coding-server descriptor",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.listRoutes",
        path: CODING_SERVER_ROUTE_CATALOG_PATH,
        summary: "List unified API routes",
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
        operation_id: "core.listNativeSessionProviders",
        path: "/api/core/v1/native-session-providers",
        summary: "List registered native engine session providers",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.listNativeSessions",
        path: "/api/core/v1/native-sessions",
        summary: "List discovered native engine sessions",
        tag: "core",
    },
    RouteSpec {
        method: "get",
        operation_id: "core.getNativeSession",
        path: "/api/core/v1/native-sessions/:id",
        summary: "Get discovered native engine session detail",
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
        method: "get",
        operation_id: "core.listCodingSessions",
        path: "/api/core/v1/coding-sessions",
        summary: "List coding sessions",
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
        method: "patch",
        operation_id: "core.updateCodingSession",
        path: "/api/core/v1/coding-sessions/:id",
        summary: "Update coding session",
        tag: "core",
    },
    RouteSpec {
        method: "delete",
        operation_id: "core.deleteCodingSession",
        path: "/api/core/v1/coding-sessions/:id",
        summary: "Delete coding session",
        tag: "core",
    },
    RouteSpec {
        method: "delete",
        operation_id: "core.deleteCodingSessionMessage",
        path: "/api/core/v1/coding-sessions/:id/messages/:messageId",
        summary: "Delete coding session message",
        tag: "core",
    },
    RouteSpec {
        method: "post",
        operation_id: "core.forkCodingSession",
        path: "/api/core/v1/coding-sessions/:id/fork",
        summary: "Fork coding session",
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
        operation_id: "app.getUserCenterConfig",
        path: "/api/app/v1/auth/config",
        summary: "Get user center provider metadata",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.getCurrentUserSession",
        path: "/api/app/v1/auth/session",
        summary: "Get current user center session",
        tag: "app",
    },
    RouteSpec {
        method: "post",
        operation_id: "app.login",
        path: "/api/app/v1/auth/login",
        summary: "Create user center session with local credentials",
        tag: "app",
    },
    RouteSpec {
        method: "post",
        operation_id: "app.register",
        path: "/api/app/v1/auth/register",
        summary: "Register local user center user",
        tag: "app",
    },
    RouteSpec {
        method: "post",
        operation_id: "app.logout",
        path: "/api/app/v1/auth/logout",
        summary: "Revoke current user center session",
        tag: "app",
    },
    RouteSpec {
        method: "post",
        operation_id: "app.exchangeUserCenterSession",
        path: "/api/app/v1/auth/session/exchange",
        summary: "Exchange third-party user into a BirdCoder session",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.getCurrentUserProfile",
        path: "/api/app/v1/user-center/profile",
        summary: "Get current user profile",
        tag: "app",
    },
    RouteSpec {
        method: "patch",
        operation_id: "app.updateCurrentUserProfile",
        path: "/api/app/v1/user-center/profile",
        summary: "Update current user profile",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.getCurrentUserMembership",
        path: "/api/app/v1/user-center/membership",
        summary: "Get current user membership",
        tag: "app",
    },
    RouteSpec {
        method: "patch",
        operation_id: "app.updateCurrentUserMembership",
        path: "/api/app/v1/user-center/membership",
        summary: "Update current user membership",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.listWorkspaces",
        path: "/api/app/v1/workspaces",
        summary: "List workspaces",
        tag: "app",
    },
    RouteSpec {
        method: "post",
        operation_id: "app.createWorkspace",
        path: "/api/app/v1/workspaces",
        summary: "Create workspace",
        tag: "app",
    },
    RouteSpec {
        method: "patch",
        operation_id: "app.updateWorkspace",
        path: "/api/app/v1/workspaces/:workspaceId",
        summary: "Update workspace",
        tag: "app",
    },
    RouteSpec {
        method: "delete",
        operation_id: "app.deleteWorkspace",
        path: "/api/app/v1/workspaces/:workspaceId",
        summary: "Delete workspace",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.subscribeWorkspaceRealtime",
        path: "/api/app/v1/workspaces/:workspaceId/realtime",
        summary: "Subscribe to workspace realtime invalidation events",
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
        operation_id: "app.getProject",
        path: "/api/app/v1/projects/:projectId",
        summary: "Get project",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.listProjectCollaborators",
        path: "/api/app/v1/projects/:projectId/collaborators",
        summary: "List project collaborators",
        tag: "app",
    },
    RouteSpec {
        method: "post",
        operation_id: "app.upsertProjectCollaborator",
        path: "/api/app/v1/projects/:projectId/collaborators",
        summary: "Upsert project collaborator",
        tag: "app",
    },
    RouteSpec {
        method: "post",
        operation_id: "app.createProject",
        path: "/api/app/v1/projects",
        summary: "Create project",
        tag: "app",
    },
    RouteSpec {
        method: "patch",
        operation_id: "app.updateProject",
        path: "/api/app/v1/projects/:projectId",
        summary: "Update project",
        tag: "app",
    },
    RouteSpec {
        method: "delete",
        operation_id: "app.deleteProject",
        path: "/api/app/v1/projects/:projectId",
        summary: "Delete project",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.listSkillPackages",
        path: "/api/app/v1/skill-packages",
        summary: "List skill packages",
        tag: "app",
    },
    RouteSpec {
        method: "post",
        operation_id: "app.installSkillPackage",
        path: "/api/app/v1/skill-packages/:packageId/installations",
        summary: "Install skill package for a scope",
        tag: "app",
    },
    RouteSpec {
        method: "get",
        operation_id: "app.listAppTemplates",
        path: "/api/app/v1/app-templates",
        summary: "List app templates",
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
        operation_id: "app.listWorkspaceMembers",
        path: "/api/app/v1/workspaces/:workspaceId/members",
        summary: "List workspace members",
        tag: "app",
    },
    RouteSpec {
        method: "post",
        operation_id: "app.upsertWorkspaceMember",
        path: "/api/app/v1/workspaces/:workspaceId/members",
        summary: "Upsert workspace member",
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
        method: "post",
        operation_id: "app.publishProject",
        path: "/api/app/v1/projects/:projectId/publish",
        summary: "Publish project release flow",
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
        let openapi_path = to_openapi_path_template(route_spec.path);
        paths
            .entry(openapi_path)
            .or_insert_with(BTreeMap::new)
            .insert(
                route_spec.method,
                OpenApiOperation {
                    operation_id: route_spec.operation_id,
                    summary: route_spec.summary,
                    description: openapi_operation_description(&route_spec),
                    tags: [route_spec.tag],
                    responses: openapi_operation_responses(),
                    security: openapi_operation_security(&route_spec),
                    auth_mode: surface_auth_mode(route_spec.tag),
                    surface: route_spec.tag,
                },
            );
    }

    OpenApiDocument {
        openapi: "3.1.0",
        info: OpenApiInfo {
            title: "SDKWork BirdCoder Coding Server API",
            version: CODING_SERVER_API_VERSION,
            description:
                "OpenAPI 3.1 schema generated from the live BirdCoder unified same-port API gateway.",
        },
        servers: vec![OpenApiServer {
            url: "/".to_owned(),
            description: "Unified same-port BirdCoder API gateway.",
        }],
        tags: vec![
            OpenApiTag {
                name: "core",
                description: surface_description("core"),
            },
            OpenApiTag {
                name: "app",
                description: surface_description("app"),
            },
            OpenApiTag {
                name: "admin",
                description: surface_description("admin"),
            },
        ],
        components: OpenApiComponents {
            security_schemes: OpenApiSecuritySchemes {
                bearer_auth: OpenApiSecurityScheme {
                    kind: "http",
                    scheme: "bearer",
                    bearer_format: "Bearer token",
                },
            },
        },
        paths,
        gateway: build_openapi_gateway_metadata(),
    }
}

async fn core_health() -> Json<ApiEnvelope<HealthPayload>> {
    Json(create_envelope(
        "core-health",
        HealthPayload { status: "healthy" },
    ))
}

async fn core_route_catalog() -> Json<ApiListEnvelope<RouteCatalogEntryPayload>> {
    Json(create_list_envelope(
        "core-route-catalog",
        build_route_catalog_payloads(),
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

fn create_paged_list_envelope<T>(
    seed: &str,
    items: Vec<T>,
    offset: usize,
    requested_page_size: Option<usize>,
    total: usize,
) -> ApiListEnvelope<T> {
    let page_size = requested_page_size.unwrap_or(items.len());
    let page_base = if page_size == 0 { 1 } else { page_size };
    ApiListEnvelope {
        request_id: format!("req:{seed}:rust"),
        timestamp: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock before unix epoch")
            .as_secs()
            .to_string(),
        items,
        meta: ApiListMeta {
            page: (offset / page_base) + 1,
            page_size,
            total,
            version: CODING_SERVER_API_VERSION,
        },
    }
}

fn paginate_vec<T>(
    items: Vec<T>,
    offset: Option<usize>,
    limit: Option<usize>,
) -> (Vec<T>, usize, Option<usize>, usize) {
    let total = items.len();
    let normalized_offset = offset.unwrap_or(0).min(total);
    let requested_page_size = limit.filter(|value| *value > 0);
    let paged_items = if let Some(page_size) = requested_page_size {
        items
            .into_iter()
            .skip(normalized_offset)
            .take(page_size)
            .collect::<Vec<_>>()
    } else {
        items
            .into_iter()
            .skip(normalized_offset)
            .collect::<Vec<_>>()
    };

    (paged_items, normalized_offset, requested_page_size, total)
}

async fn core_descriptor() -> Json<ApiEnvelope<DescriptorPayload>> {
    Json(create_envelope(
        "core-descriptor",
        DescriptorPayload {
            api_version: CODING_SERVER_API_VERSION,
            gateway: build_gateway_descriptor_payload(),
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

async fn core_native_session_providers() -> Json<ApiListEnvelope<NativeSessionProviderPayload>> {
    Json(create_list_envelope(
        "core-native-session-providers",
        build_native_session_provider_catalog(),
    ))
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BooleanResultPayload {
    success: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceRealtimeEventPayload {
    event_id: String,
    event_kind: String,
    workspace_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_root_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    coding_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    coding_session_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    coding_session_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    coding_session_host_mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    coding_session_engine_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    coding_session_model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    turn_id: Option<String>,
    occurred_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    coding_session_updated_at: Option<String>,
    source_surface: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct WorkspaceRealtimeQueryParams {
    session_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
enum WorkspaceRealtimeMessagePayload {
    Ready {
        connected_at: String,
        user_id: String,
        workspace_id: String,
    },
    Event {
        event: WorkspaceRealtimeEventPayload,
    },
}

#[derive(Clone)]
struct WorkspaceRealtimeHub {
    sender: broadcast::Sender<WorkspaceRealtimeEventPayload>,
}

impl WorkspaceRealtimeHub {
    fn new() -> Self {
        let (sender, _) = broadcast::channel(256);
        Self { sender }
    }

    fn publish(&self, event: WorkspaceRealtimeEventPayload) {
        let _ = self.sender.send(event);
    }

    fn subscribe(&self) -> broadcast::Receiver<WorkspaceRealtimeEventPayload> {
        self.sender.subscribe()
    }
}

fn try_resolve_current_user_center_session(
    state: &AppState,
    headers: &HeaderMap,
) -> Option<UserCenterSessionPayload> {
    let connection = state.open_authority_connection_for_write().ok()?;
    state
        .user_center
        .resolve_session(&connection, headers)
        .ok()
        .flatten()
}

fn resolve_current_user_center_session(
    state: &AppState,
    headers: &HeaderMap,
    unavailable_seed: &str,
    unauthorized_seed: &str,
) -> Result<
    (Connection, UserCenterSessionPayload),
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                unavailable_seed,
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;
    let session = state
        .user_center
        .resolve_session(&connection, headers)
        .map_err(|error| {
            problem_response(
                unavailable_seed,
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .ok_or_else(|| {
            problem_response(
                unauthorized_seed,
                StatusCode::UNAUTHORIZED,
                "unauthorized",
                "A valid user center session is required.",
            )
        })?;
    Ok((connection, session))
}

fn resolve_headers_with_optional_session_query(
    headers: &HeaderMap,
    query_session_id: Option<&str>,
) -> Result<HeaderMap, String> {
    let mut resolved_headers = headers.clone();
    if resolved_headers.contains_key(BIRDCODER_SESSION_HEADER_NAME) {
        return Ok(resolved_headers);
    }

    let Some(session_id) = query_session_id.and_then(|value| normalize_required_string(value.to_owned())) else {
        return Ok(resolved_headers);
    };
    let session_header_value = HeaderValue::from_str(session_id.as_str())
        .map_err(|error| format!("Invalid realtime sessionId query parameter: {error}"))?;
    resolved_headers.insert(
        HeaderName::from_static(BIRDCODER_SESSION_HEADER_NAME),
        session_header_value,
    );
    Ok(resolved_headers)
}

async fn send_workspace_realtime_message(
    socket: &mut WebSocket,
    payload: &WorkspaceRealtimeMessagePayload,
) -> Result<(), String> {
    let serialized_payload = serde_json::to_string(payload)
        .map_err(|error| format!("Serialize realtime payload failed: {error}"))?;
    socket
        .send(Message::Text(serialized_payload.into()))
        .await
        .map_err(|error| format!("Send realtime payload failed: {error}"))
}

async fn serve_workspace_realtime_socket(
    mut socket: WebSocket,
    hub: WorkspaceRealtimeHub,
    workspace_id: String,
    user_id: String,
) {
    let ready_message = WorkspaceRealtimeMessagePayload::Ready {
        connected_at: current_storage_timestamp(),
        user_id,
        workspace_id: workspace_id.clone(),
    };
    if send_workspace_realtime_message(&mut socket, &ready_message)
        .await
        .is_err()
    {
        return;
    }

    let mut receiver = hub.subscribe();
    loop {
        tokio::select! {
            next_event = receiver.recv() => {
                match next_event {
                    Ok(event) => {
                        if event.workspace_id != workspace_id {
                            continue;
                        }

                        let event_message = WorkspaceRealtimeMessagePayload::Event {
                            event,
                        };
                        if send_workspace_realtime_message(&mut socket, &event_message)
                            .await
                            .is_err()
                        {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        continue;
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        break;
                    }
                }
            }
            next_message = socket.recv() => {
                match next_message {
                    Some(Ok(Message::Ping(payload))) => {
                        if socket.send(Message::Pong(payload)).await.is_err() {
                            break;
                        }
                    }
                    Some(Ok(Message::Close(_))) | None => {
                        break;
                    }
                    Some(Ok(_)) => {}
                    Some(Err(_)) => {
                        break;
                    }
                }
            }
        }
    }
}

async fn app_workspace_realtime(
    ws: WebSocketUpgrade,
    AxumPath(workspace_id): AxumPath<String>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<WorkspaceRealtimeQueryParams>,
) -> Result<Response, (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>)> {
    let normalized_workspace_id = normalize_required_string(workspace_id).ok_or_else(|| {
        problem_response(
            "workspace-realtime-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "workspaceId is required.",
        )
    })?;
    if !state.has_workspace(normalized_workspace_id.as_str()) {
        return Err(problem_response(
            "workspace-realtime-workspace-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Workspace authority was not found.",
        ));
    }

    let resolved_headers = resolve_headers_with_optional_session_query(
        &headers,
        query.session_id.as_deref(),
    )
    .map_err(|error| {
        problem_response(
            "workspace-realtime-session-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            error,
        )
    })?;
    let (_, session) = resolve_current_user_center_session(
        &state,
        &resolved_headers,
        "workspace-realtime-auth-unavailable",
        "workspace-realtime-unauthorized",
    )?;

    let realtime_hub = state.realtime.clone();
    let current_user_id = session.user.id;
    Ok(ws.on_upgrade(move |socket| async move {
        serve_workspace_realtime_socket(
            socket,
            realtime_hub,
            normalized_workspace_id,
            current_user_id,
        )
        .await;
    }))
}

async fn app_user_center_config(
    State(state): State<AppState>,
) -> Json<ApiEnvelope<UserCenterMetadataPayload>> {
    Json(create_envelope(
        "app-user-center-config",
        state.user_center.metadata(),
    ))
}

async fn app_user_center_session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Json<ApiEnvelope<Option<UserCenterSessionPayload>>> {
    let session = state
        .open_authority_connection_for_write()
        .ok()
        .and_then(|connection| {
            state
                .user_center
                .resolve_session(&connection, &headers)
                .ok()
        })
        .flatten();
    Json(create_envelope("app-user-center-session", session))
}

async fn app_user_center_login(
    State(state): State<AppState>,
    Json(request): Json<UserCenterLoginRequest>,
) -> Result<
    Json<ApiEnvelope<UserCenterSessionPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let mut connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "app-user-center-login-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;
    let session = state
        .user_center
        .login(&mut connection, &request)
        .map_err(|error| {
            problem_response(
                "app-user-center-login-failed",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                error,
            )
        })?;
    Ok(Json(create_envelope("app-user-center-login", session)))
}

async fn app_user_center_register(
    State(state): State<AppState>,
    Json(request): Json<UserCenterRegisterRequest>,
) -> Result<
    Json<ApiEnvelope<UserCenterSessionPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let mut connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "app-user-center-register-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;
    let session = state
        .user_center
        .register(&mut connection, &request)
        .map_err(|error| {
            problem_response(
                "app-user-center-register-failed",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                error,
            )
        })?;
    Ok(Json(create_envelope("app-user-center-register", session)))
}

async fn app_user_center_logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<
    Json<ApiEnvelope<BooleanResultPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    if let Ok(mut connection) = state.open_authority_connection_for_write() {
        let session_id = headers
            .get(BIRDCODER_SESSION_HEADER_NAME)
            .and_then(|value| value.to_str().ok())
            .map(str::trim)
            .filter(|value| !value.is_empty());
        state
            .user_center
            .logout(&mut connection, session_id)
            .map_err(|error| {
                problem_response(
                    "app-user-center-logout-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    error,
                )
            })?;
    }

    Ok(Json(create_envelope(
        "app-user-center-logout",
        BooleanResultPayload { success: true },
    )))
}

async fn app_user_center_exchange_session(
    State(state): State<AppState>,
    Json(request): Json<UserCenterSessionExchangeRequest>,
) -> Result<
    Json<ApiEnvelope<UserCenterSessionPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let mut connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "app-user-center-session-exchange-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;
    let session = state
        .user_center
        .exchange_session(&mut connection, &request)
        .map_err(|error| {
            problem_response(
                "app-user-center-session-exchange-failed",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                error,
            )
        })?;
    Ok(Json(create_envelope(
        "app-user-center-session-exchange",
        session,
    )))
}

async fn app_user_center_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<
    Json<ApiEnvelope<UserCenterProfilePayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let (connection, session) = resolve_current_user_center_session(
        &state,
        &headers,
        "app-user-center-profile-unavailable",
        "app-user-center-profile-unauthorized",
    )?;
    let mut connection = connection;
    let profile = state
        .user_center
        .read_profile(&mut connection, &session)
        .map_err(|error| {
            problem_response(
                "app-user-center-profile-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?;
    Ok(Json(create_envelope("app-user-center-profile", profile)))
}

async fn app_update_user_center_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<UpdateUserCenterProfileRequest>,
) -> Result<
    Json<ApiEnvelope<UserCenterProfilePayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let (mut connection, session) = resolve_current_user_center_session(
        &state,
        &headers,
        "app-user-center-profile-update-unavailable",
        "app-user-center-profile-update-unauthorized",
    )?;
    let profile = state
        .user_center
        .update_profile(&mut connection, &session, &request)
        .map_err(|error| {
            problem_response(
                "app-user-center-profile-update-failed",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                error,
            )
        })?;
    Ok(Json(create_envelope(
        "app-user-center-profile-update",
        profile,
    )))
}

async fn app_user_center_membership(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<
    Json<ApiEnvelope<UserCenterVipMembershipPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let (connection, session) = resolve_current_user_center_session(
        &state,
        &headers,
        "app-user-center-membership-unavailable",
        "app-user-center-membership-unauthorized",
    )?;
    let mut connection = connection;
    let membership = state
        .user_center
        .read_vip_membership(&mut connection, &session)
        .map_err(|error| {
            problem_response(
                "app-user-center-membership-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?;
    Ok(Json(create_envelope(
        "app-user-center-membership",
        membership,
    )))
}

async fn app_update_user_center_membership(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<UpdateUserCenterVipMembershipRequest>,
) -> Result<
    Json<ApiEnvelope<UserCenterVipMembershipPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let (mut connection, session) = resolve_current_user_center_session(
        &state,
        &headers,
        "app-user-center-membership-update-unavailable",
        "app-user-center-membership-update-unauthorized",
    )?;
    let membership = state
        .user_center
        .update_vip_membership(&mut connection, &session, &request)
        .map_err(|error| {
            problem_response(
                "app-user-center-membership-update-failed",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                error,
            )
        })?;
    Ok(Json(create_envelope(
        "app-user-center-membership-update",
        membership,
    )))
}

async fn app_workspaces(
    Query(query): Query<WorkspaceScopedQuery>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Json<ApiListEnvelope<WorkspacePayload>> {
    let app_admin_state = state.read_app_admin_state();
    let user_filter = normalize_optional_string(query.user_id).or_else(|| {
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id)
    });
    let workspaces = app_admin_state
        .workspaces
        .into_iter()
        .filter_map(|workspace| {
            if user_filter.as_deref().is_some_and(|user_id| {
                !workspace_is_visible_to_user(
                    &workspace,
                    &app_admin_state.workspace_members,
                    &app_admin_state.members,
                    user_id,
                )
            }) {
                return None;
            }

            let member_count =
                count_active_workspace_members(&app_admin_state.workspace_members, &workspace.id);
            let viewer_role = user_filter.as_deref().and_then(|user_id| {
                resolve_workspace_viewer_role(
                    &workspace,
                    &app_admin_state.workspace_members,
                    &app_admin_state.members,
                    user_id,
                )
            });

            Some(WorkspacePayload {
                member_count: Some(member_count),
                viewer_role,
                ..workspace
            })
        })
        .collect::<Vec<_>>();
    Json(create_list_envelope("app-workspaces", workspaces))
}

async fn app_create_workspace(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CreateWorkspaceRequest>,
) -> Result<
    (StatusCode, Json<ApiEnvelope<WorkspacePayload>>),
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let name = normalize_required_string(request.name).ok_or_else(|| {
        problem_response(
            "create-workspace-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "Workspace name is required.",
        )
    })?;
    let description = normalize_optional_string(request.description);
    let requested_tenant_id = normalize_optional_string(request.tenant_id);
    let requested_organization_id = normalize_optional_string(request.organization_id);
    let requested_code = normalize_optional_string(request.code);
    let requested_title = normalize_optional_string(request.title);
    let requested_owner_id = normalize_optional_string(request.owner_id);
    let requested_leader_id = normalize_optional_string(request.leader_id);
    let requested_created_by_user_id = normalize_optional_string(request.created_by_user_id);
    let requested_type = normalize_optional_string(request.entity_type);
    let current_user_id =
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id);
    let created_by_user_id = current_user_id
        .clone()
        .or(requested_created_by_user_id)
        .unwrap_or_else(|| BOOTSTRAP_WORKSPACE_OWNER_USER_ID.to_owned());
    let tenant_id =
        requested_tenant_id.unwrap_or_else(|| SQLITE_AUTHORITY_DEFAULT_TENANT_ID.to_owned());
    let organization_id = requested_organization_id;
    let owner_id = requested_owner_id.unwrap_or_else(|| {
        current_user_id
            .clone()
            .unwrap_or_else(|| created_by_user_id.clone())
    });
    let leader_id = requested_leader_id.unwrap_or_else(|| owner_id.clone());
    let now = current_storage_timestamp();

    let mut connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "create-workspace-authority-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;
    let workspace_id = create_identifier("workspace");
    let workspace_uuid = Uuid::new_v4().to_string();
    let workspace_code =
        requested_code.unwrap_or_else(|| build_workspace_business_code(&workspace_id, &name));
    let workspace_title = requested_title.unwrap_or_else(|| name.clone());
    let workspace_type = requested_type.unwrap_or_else(|| "DEFAULT".to_owned());
    let default_team_id = create_identifier("team");
    let default_team_uuid = Uuid::new_v4().to_string();
    let default_team_name = format!("{name} Owners");
    let default_team_code = build_team_business_code(&default_team_id, &default_team_name);
    let default_team_member_id = create_identifier("team-member");
    let default_workspace_member_id = create_identifier("workspace-member");
    let transaction = connection.transaction().map_err(|error| {
        problem_response(
            "create-workspace-transaction-open-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to open workspace authority transaction: {error}"),
        )
    })?;

    transaction
        .execute(
            r#"
            INSERT INTO workspaces (
                id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted,
                name, code, title, description, owner_id, leader_id, type, settings_json,
                created_by_user_id, status
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 0, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
            "#,
            params![
                &workspace_id,
                &workspace_uuid,
                &tenant_id,
                &organization_id,
                &now,
                &now,
                &name,
                &workspace_code,
                &workspace_title,
                &description,
                &owner_id,
                &leader_id,
                &workspace_type,
                "{}",
                &created_by_user_id,
                "active",
            ],
        )
        .and_then(|_| {
            transaction.execute(
                r#"
                INSERT INTO teams (
                    id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted,
                    workspace_id, name, code, title, description, owner_id, leader_id, metadata_json,
                    created_by_user_id, status
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 0, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
                "#,
                params![
                    &default_team_id,
                    &default_team_uuid,
                    &tenant_id,
                    &organization_id,
                    &now,
                    &now,
                    &workspace_id,
                    &default_team_name,
                    &default_team_code,
                    &default_team_name,
                    Some("Default workspace owner team.".to_owned()),
                    &owner_id,
                    &leader_id,
                    "{}",
                    &created_by_user_id,
                    "active",
                ],
            )
        })
        .and_then(|_| {
            transaction.execute(
                r#"
                INSERT INTO team_members (
                    id, created_at, updated_at, version, is_deleted, team_id, user_id, role,
                    created_by_user_id, granted_by_user_id, status
                ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, ?9)
                "#,
                params![
                    &default_team_member_id,
                    &now,
                    &now,
                    &default_team_id,
                    &owner_id,
                    "owner",
                    &created_by_user_id,
                    &created_by_user_id,
                    "active",
                ],
            )
        })
        .and_then(|_| {
            transaction.execute(
                r#"
                INSERT INTO workspace_members (
                    id, created_at, updated_at, version, is_deleted, workspace_id, user_id, team_id, role,
                    created_by_user_id, granted_by_user_id, status
                ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    &default_workspace_member_id,
                    &now,
                    &now,
                    &workspace_id,
                    &owner_id,
                    &default_team_id,
                    "owner",
                    &created_by_user_id,
                    &created_by_user_id,
                    "active",
                ],
            )
        })
        .map_err(|error| {
            problem_response(
                "create-workspace-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to persist workspace authority: {error}"),
            )
        })?;

    transaction.commit().map_err(|error| {
        problem_response(
            "create-workspace-transaction-commit-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to commit workspace authority: {error}"),
        )
    })?;

    let workspace = load_provider_workspace_payload_by_id(&connection, &workspace_id)
        .map_err(|error| {
            problem_response(
                "create-workspace-readback-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .ok_or_else(|| {
            problem_response(
                "create-workspace-readback-missing",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                "Workspace authority readback was not found.",
            )
        })?;

    Ok((
        StatusCode::CREATED,
        Json(create_envelope("app-create-workspace", workspace)),
    ))
}

async fn app_update_workspace(
    AxumPath(workspace_id): AxumPath<String>,
    State(state): State<AppState>,
    Json(request): Json<UpdateWorkspaceRequest>,
) -> Result<
    Json<ApiEnvelope<WorkspacePayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_workspace_id = normalize_required_string(workspace_id).ok_or_else(|| {
        problem_response(
            "update-workspace-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "workspaceId is required.",
        )
    })?;
    let normalized_status = normalize_workspace_status(request.status).map_err(|message| {
        problem_response(
            "update-workspace-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            message,
        )
    })?;

    let connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "update-workspace-authority-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;
    let existing_workspace =
        load_provider_workspace_payload_by_id(&connection, &normalized_workspace_id)
            .map_err(|error| {
                problem_response(
                    "update-workspace-read-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    error,
                )
            })?
            .ok_or_else(|| {
                problem_response(
                    "update-workspace-not-found",
                    StatusCode::NOT_FOUND,
                    "not_found",
                    "Workspace authority was not found.",
                )
            })?;

    let next_name = request
        .name
        .and_then(normalize_required_string)
        .unwrap_or(existing_workspace.name.clone());
    let next_description = match request.description {
        Some(description) => normalize_optional_string(Some(description)),
        None => existing_workspace.description.clone(),
    };
    let next_code = request
        .code
        .and_then(normalize_required_string)
        .or_else(|| existing_workspace.code.clone())
        .unwrap_or_else(|| build_workspace_business_code(&normalized_workspace_id, &next_name));
    let next_title = request
        .title
        .and_then(normalize_required_string)
        .or_else(|| existing_workspace.title.clone())
        .unwrap_or_else(|| next_name.clone());
    let next_owner_id = request
        .owner_id
        .and_then(normalize_required_string)
        .or_else(|| existing_workspace.owner_id.clone())
        .unwrap_or_else(|| BOOTSTRAP_WORKSPACE_OWNER_USER_ID.to_owned());
    let next_leader_id = request
        .leader_id
        .and_then(normalize_required_string)
        .or_else(|| existing_workspace.leader_id.clone())
        .unwrap_or_else(|| next_owner_id.clone());
    let next_type = request
        .entity_type
        .and_then(normalize_required_string)
        .or_else(|| existing_workspace.entity_type.clone())
        .unwrap_or_else(|| "DEFAULT".to_owned());
    let next_status = normalized_status.unwrap_or(existing_workspace.status);

    connection
        .execute(
            r#"
            UPDATE workspaces
            SET
                updated_at = ?2,
                name = ?3,
                code = ?4,
                title = ?5,
                description = ?6,
                owner_id = ?7,
                leader_id = ?8,
                type = ?9,
                status = ?10
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![
                &normalized_workspace_id,
                current_storage_timestamp(),
                &next_name,
                &next_code,
                &next_title,
                &next_description,
                &next_owner_id,
                &next_leader_id,
                &next_type,
                &next_status,
            ],
        )
        .map_err(|error| {
            problem_response(
                "update-workspace-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to persist workspace authority: {error}"),
            )
        })?;

    let workspace = load_provider_workspace_payload_by_id(&connection, &normalized_workspace_id)
        .map_err(|error| {
            problem_response(
                "update-workspace-readback-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .ok_or_else(|| {
            problem_response(
                "update-workspace-readback-missing",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                "Workspace authority readback was not found.",
            )
        })?;

    Ok(Json(create_envelope("app-update-workspace", workspace)))
}

async fn app_delete_workspace(
    AxumPath(workspace_id): AxumPath<String>,
    State(state): State<AppState>,
) -> Result<
    Json<ApiEnvelope<DeleteEntityPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_workspace_id = normalize_required_string(workspace_id).ok_or_else(|| {
        problem_response(
            "delete-workspace-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "workspaceId is required.",
        )
    })?;
    let connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "delete-workspace-authority-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;
    let deleted_at = current_storage_timestamp();
    let deleted_count = connection
        .execute(
            r#"
            UPDATE workspaces
            SET is_deleted = 1, updated_at = ?2
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![normalized_workspace_id, deleted_at],
        )
        .map_err(|error| {
            problem_response(
                "delete-workspace-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to delete workspace authority: {error}"),
            )
        })?;

    if deleted_count == 0 {
        return Err(problem_response(
            "delete-workspace-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Workspace authority was not found.",
        ));
    }

    connection
        .execute(
            r#"
            UPDATE projects
            SET is_deleted = 1, updated_at = ?2
            WHERE workspace_id = ?1 AND is_deleted = 0
            "#,
            params![normalized_workspace_id, deleted_at],
        )
        .map_err(|error| {
            problem_response(
                "delete-workspace-projects-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to cascade workspace project deletion: {error}"),
            )
        })?;

    connection
        .execute(
            r#"
            UPDATE project_collaborators
            SET is_deleted = 1, updated_at = ?2
            WHERE workspace_id = ?1 AND is_deleted = 0
            "#,
            params![normalized_workspace_id, deleted_at],
        )
        .map_err(|error| {
            problem_response(
                "delete-workspace-collaborators-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to cascade workspace collaborator deletion: {error}"),
            )
        })?;

    connection
        .execute(
            r#"
            UPDATE workspace_members
            SET is_deleted = 1, updated_at = ?2
            WHERE workspace_id = ?1 AND is_deleted = 0
            "#,
            params![normalized_workspace_id, deleted_at],
        )
        .map_err(|error| {
            problem_response(
                "delete-workspace-members-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to cascade workspace member deletion: {error}"),
            )
        })?;

    connection
        .execute(
            r#"
            UPDATE team_members
            SET is_deleted = 1, updated_at = ?2
            WHERE team_id IN (
                SELECT id
                FROM teams
                WHERE workspace_id = ?1 AND is_deleted = 0
            ) AND is_deleted = 0
            "#,
            params![normalized_workspace_id, deleted_at],
        )
        .map_err(|error| {
            problem_response(
                "delete-workspace-team-members-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to cascade workspace team member deletion: {error}"),
            )
        })?;

    connection
        .execute(
            r#"
            UPDATE teams
            SET is_deleted = 1, updated_at = ?2
            WHERE workspace_id = ?1 AND is_deleted = 0
            "#,
            params![normalized_workspace_id, deleted_at],
        )
        .map_err(|error| {
            problem_response(
                "delete-workspace-teams-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to cascade workspace team deletion: {error}"),
            )
        })?;

    Ok(Json(create_envelope(
        "app-delete-workspace",
        DeleteEntityPayload {
            id: normalized_workspace_id,
        },
    )))
}

async fn app_projects(
    Query(query): Query<WorkspaceScopedQuery>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiListEnvelope<ProjectPayload>>, (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>)>
{
    let app_admin_state = state.read_app_admin_state();
    let root_path_filter = normalize_optional_project_root_path(query.root_path).map_err(|error| {
        problem_response(
            "project-list-invalid-root-path",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            error.to_owned(),
        )
    })?;
    let normalized_root_path_filter = root_path_filter
        .as_deref()
        .map(normalize_project_root_path_for_lookup);
    let workspace_filter = normalize_optional_string(query.workspace_id);
    let user_filter = normalize_optional_string(query.user_id).or_else(|| {
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id)
    });
    let workspace_lookup = workspace_lookup_map(&app_admin_state.workspaces);
    let projects = app_admin_state
        .projects
        .into_iter()
        .filter_map(|project| {
            if !project_has_absolute_catalog_root_path(&project) {
                return None;
            }

            if workspace_filter
                .as_deref()
                .is_some_and(|workspace_id| project.workspace_id != workspace_id)
            {
                return None;
            }

            if normalized_root_path_filter
                .as_deref()
                .is_some_and(|normalized_root_path| {
                    !project
                        .root_path
                        .as_deref()
                        .is_some_and(|project_root_path| {
                            normalize_project_root_path_for_lookup(project_root_path)
                                == *normalized_root_path
                        })
                })
            {
                return None;
            }

            if user_filter.as_deref().is_some_and(|user_id| {
                !project_is_visible_to_user(
                    &project,
                    &workspace_lookup,
                    &app_admin_state.workspace_members,
                    &app_admin_state.project_collaborators,
                    &app_admin_state.members,
                    user_id,
                )
            }) {
                return None;
            }

            let collaborator_count = count_active_project_collaborators(
                &app_admin_state.project_collaborators,
                &project.id,
            );
            let viewer_role = user_filter.as_deref().and_then(|user_id| {
                resolve_project_viewer_role(
                    &project,
                    &workspace_lookup,
                    &app_admin_state.workspace_members,
                    &app_admin_state.project_collaborators,
                    &app_admin_state.members,
                    user_id,
                )
            });

            Some(ProjectPayload {
                collaborator_count: Some(collaborator_count),
                viewer_role,
                ..project
            })
        })
        .collect::<Vec<_>>();
    Ok(Json(create_list_envelope("app-projects", projects)))
}

async fn app_project(
    AxumPath(project_id): AxumPath<String>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<ApiEnvelope<ProjectPayload>>, (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>)>
{
    let normalized_project_id = normalize_required_string(project_id).ok_or_else(|| {
        problem_response(
            "project-read-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "projectId is required.",
        )
    })?;
    let current_user_id =
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id);
    let app_admin_state = state.read_app_admin_state();
    let workspace_lookup = workspace_lookup_map(&app_admin_state.workspaces);
    let project = app_admin_state
        .projects
        .into_iter()
        .find(|candidate| candidate.id == normalized_project_id)
        .filter(project_has_absolute_catalog_root_path)
        .filter(|candidate| {
            current_user_id.as_deref().is_none_or(|user_id| {
                project_is_visible_to_user(
                    candidate,
                    &workspace_lookup,
                    &app_admin_state.workspace_members,
                    &app_admin_state.project_collaborators,
                    &app_admin_state.members,
                    user_id,
                )
            })
        })
        .map(|project| {
            let collaborator_count = count_active_project_collaborators(
                &app_admin_state.project_collaborators,
                &project.id,
            );
            let viewer_role = current_user_id.as_deref().and_then(|user_id| {
                resolve_project_viewer_role(
                    &project,
                    &workspace_lookup,
                    &app_admin_state.workspace_members,
                    &app_admin_state.project_collaborators,
                    &app_admin_state.members,
                    user_id,
                )
            });
            ProjectPayload {
                collaborator_count: Some(collaborator_count),
                viewer_role,
                ..project
            }
        })
        .ok_or_else(|| {
            problem_response(
                "project-read-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Project was not found.",
            )
        })?;

    Ok(Json(create_envelope("app-project", project)))
}

async fn app_skill_packages(
    Query(query): Query<WorkspaceScopedQuery>,
    State(state): State<AppState>,
) -> Result<
    Json<ApiListEnvelope<SkillPackagePayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let workspace_id = normalize_optional_string(query.workspace_id);
    let connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "app-skill-packages-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;
    let packages = load_provider_skill_package_payloads(&connection, workspace_id.as_deref())
        .map_err(|error| {
            problem_response(
                "app-skill-packages-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?;
    Ok(Json(create_list_envelope("app-skill-packages", packages)))
}

async fn app_install_skill_package(
    AxumPath(package_id): AxumPath<String>,
    State(state): State<AppState>,
    Json(request): Json<InstallSkillPackageRequest>,
) -> Result<
    Json<ApiEnvelope<SkillInstallationPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_package_id = normalize_required_string(package_id).ok_or_else(|| {
        problem_response(
            "install-skill-package-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "packageId is required.",
        )
    })?;
    let normalized_scope_id = normalize_required_string(request.scope_id).ok_or_else(|| {
        problem_response(
            "install-skill-package-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "scopeId is required.",
        )
    })?;
    let normalized_scope_type = normalize_required_string(request.scope_type).ok_or_else(|| {
        problem_response(
            "install-skill-package-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "scopeType is required.",
        )
    })?;
    if normalized_scope_type != "workspace" && normalized_scope_type != "project" {
        return Err(problem_response(
            "install-skill-package-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "scopeType must be workspace or project.",
        ));
    }

    let connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "install-skill-package-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;

    if normalized_scope_type == "workspace" {
        let workspace_exists =
            load_provider_workspace_payload_by_id(&connection, &normalized_scope_id).map_err(
                |error| {
                    problem_response(
                        "install-skill-package-scope-read-failed",
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "system_error",
                        error,
                    )
                },
            )?;
        if workspace_exists.is_none() {
            return Err(problem_response(
                "install-skill-package-scope-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                format!("Workspace \"{normalized_scope_id}\" was not found."),
            ));
        }
    } else {
        let project_exists =
            load_provider_project_payload_by_id(&connection, &normalized_scope_id).map_err(
                |error| {
                    problem_response(
                        "install-skill-package-scope-read-failed",
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "system_error",
                        error,
                    )
                },
            )?;
        if project_exists.is_none() {
            return Err(problem_response(
                "install-skill-package-scope-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                format!("Project \"{normalized_scope_id}\" was not found."),
            ));
        }
    }

    let (version_id, resolved_package_id) =
        load_latest_skill_version_for_package(&connection, &normalized_package_id)
            .map_err(|error| {
                problem_response(
                    "install-skill-package-version-read-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    error,
                )
            })?
            .ok_or_else(|| {
                problem_response(
                    "install-skill-package-not-found",
                    StatusCode::NOT_FOUND,
                    "not_found",
                    format!("Skill package \"{normalized_package_id}\" was not found."),
                )
            })?;

    let existing_installation = connection
        .query_row(
            r#"
            SELECT skill_installations.id, skill_installations.installed_at
            FROM skill_installations
            INNER JOIN skill_versions
                ON skill_versions.id = skill_installations.skill_version_id
               AND skill_versions.is_deleted = 0
            WHERE skill_installations.is_deleted = 0
              AND skill_installations.scope_type = ?1
              AND skill_installations.scope_id = ?2
              AND skill_versions.skill_package_id = ?3
            ORDER BY skill_installations.updated_at DESC, skill_installations.id ASC
            LIMIT 1
            "#,
            params![
                &normalized_scope_type,
                &normalized_scope_id,
                &resolved_package_id,
            ],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)),
        )
        .optional()
        .map_err(|error| {
            problem_response(
                "install-skill-package-existing-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to read existing skill installation: {error}"),
            )
        })?;

    let installation_id = existing_installation
        .as_ref()
        .map(|entry| entry.0.clone())
        .unwrap_or_else(|| create_identifier("skill-installation"));
    let installed_at = existing_installation
        .as_ref()
        .map(|entry| entry.1.clone())
        .unwrap_or_else(current_storage_timestamp);
    let updated_at = current_storage_timestamp();

    connection
        .execute(
            r#"
            INSERT INTO skill_installations (
                id, created_at, updated_at, version, is_deleted, scope_type, scope_id, skill_version_id, status, installed_at
            ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id)
            DO UPDATE SET
                updated_at = excluded.updated_at,
                is_deleted = 0,
                scope_type = excluded.scope_type,
                scope_id = excluded.scope_id,
                skill_version_id = excluded.skill_version_id,
                status = excluded.status,
                installed_at = excluded.installed_at
            "#,
            params![
                &installation_id,
                &installed_at,
                &updated_at,
                &normalized_scope_type,
                &normalized_scope_id,
                &version_id,
                "active",
                &installed_at,
            ],
        )
        .map_err(|error| {
            problem_response(
                "install-skill-package-write-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to persist skill installation: {error}"),
            )
        })?;

    Ok(Json(create_envelope(
        "app-install-skill-package",
        SkillInstallationPayload {
            id: installation_id,
            package_id: resolved_package_id,
            scope_id: normalized_scope_id,
            scope_type: normalized_scope_type,
            status: "active".to_owned(),
            version_id,
            installed_at,
        },
    )))
}

async fn app_templates(
    State(state): State<AppState>,
) -> Result<
    Json<ApiListEnvelope<AppTemplatePayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "app-templates-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;
    let templates = load_provider_app_template_payloads(&connection).map_err(|error| {
        problem_response(
            "app-templates-read-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            error,
        )
    })?;
    Ok(Json(create_list_envelope("app-templates", templates)))
}

async fn app_create_project(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<CreateProjectRequest>,
) -> Result<
    (StatusCode, Json<ApiEnvelope<ProjectPayload>>),
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let workspace_id = normalize_required_string(request.workspace_id).ok_or_else(|| {
        problem_response(
            "create-project-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "workspaceId is required.",
        )
    })?;
    let name = normalize_required_string(request.name).ok_or_else(|| {
        problem_response(
            "create-project-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "Project name is required.",
        )
    })?;
    let description = normalize_optional_string(request.description);
    let requested_workspace_uuid = normalize_optional_string(request.workspace_uuid);
    let requested_tenant_id = normalize_optional_string(request.tenant_id);
    let requested_organization_id = normalize_optional_string(request.organization_id);
    let requested_code = normalize_optional_string(request.code);
    let requested_title = normalize_optional_string(request.title);
    let requested_owner_id = normalize_optional_string(request.owner_id);
    let requested_leader_id = normalize_optional_string(request.leader_id);
    let requested_created_by_user_id = normalize_optional_string(request.created_by_user_id);
    let requested_author = normalize_optional_string(request.author);
    let requested_type = normalize_optional_string(request.entity_type);
    let requested_app_template_version_id =
        normalize_optional_string(request.app_template_version_id);
    let requested_template_preset_key = normalize_optional_string(request.template_preset_key);
    let root_path = normalize_optional_project_root_path(request.root_path)
        .map_err(|message| {
            problem_response(
                "create-project-invalid",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                message,
            )
        })?
        .ok_or_else(|| {
            problem_response(
                "create-project-invalid",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                "project rootPath is required.",
            )
        })?;
    let current_user_id =
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id);
    let status = normalize_project_status(request.status)
        .map_err(|message| {
            problem_response(
                "create-project-invalid",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                message,
            )
        })?
        .unwrap_or_else(|| "active".to_owned());
    let now = current_storage_timestamp();

    let mut connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "create-project-authority-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;

    let workspace =
        load_provider_workspace_payload_by_id(&connection, &workspace_id).map_err(|error| {
            problem_response(
                "create-project-workspace-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?;

    let workspace = if let Some(workspace) = workspace {
        workspace
    } else {
        return Err(problem_response(
            "create-project-workspace-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Workspace authority was not found.",
        ));
    };

    let created_by_user_id = current_user_id
        .clone()
        .or(requested_created_by_user_id)
        .or_else(|| workspace.created_by_user_id.clone())
        .or_else(|| workspace.owner_id.clone())
        .unwrap_or_else(|| BOOTSTRAP_WORKSPACE_OWNER_USER_ID.to_owned());
    let tenant_id = requested_tenant_id
        .or_else(|| workspace.tenant_id.clone())
        .unwrap_or_else(|| SQLITE_AUTHORITY_DEFAULT_TENANT_ID.to_owned());
    let organization_id = requested_organization_id.or_else(|| workspace.organization_id.clone());
    let owner_id = requested_owner_id.unwrap_or_else(|| {
        current_user_id
            .clone()
            .or_else(|| workspace.owner_id.clone())
            .unwrap_or_else(|| created_by_user_id.clone())
    });
    let leader_id = requested_leader_id.unwrap_or_else(|| owner_id.clone());
    if let Some(existing_project) = find_provider_project_payload_by_workspace_and_root_path(
        &connection,
        &workspace_id,
        &root_path,
        None,
    )
    .map_err(|error| {
        problem_response(
            "create-project-conflict-read-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            error,
        )
    })? {
        return Ok((
            StatusCode::OK,
            Json(create_envelope(
                "app-create-project-existing",
                existing_project,
            )),
        ));
    }
    if let Some(app_template_version_id) = requested_app_template_version_id.as_deref() {
        if !template_version_exists(&connection, app_template_version_id).map_err(|error| {
            problem_response(
                "create-project-template-version-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })? {
            return Err(problem_response(
                "create-project-template-version-not-found",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                format!(
                    "App template version \"{app_template_version_id}\" was not found."
                ),
            ));
        }

        let template_preset_key = requested_template_preset_key
            .as_deref()
            .filter(|value| !value.is_empty())
            .unwrap_or("default");
        if !template_preset_exists(&connection, app_template_version_id, template_preset_key)
            .map_err(|error| {
                problem_response(
                    "create-project-template-preset-read-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    error,
                )
            })?
        {
            return Err(problem_response(
                "create-project-template-preset-not-found",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                format!(
                    "Template preset \"{template_preset_key}\" was not found for version \"{app_template_version_id}\"."
                ),
            ));
        }
    }

    let project_id = create_identifier("project");
    let project_uuid = Uuid::new_v4().to_string();
    let project_code = requested_code
        .unwrap_or_else(|| build_project_business_code(&project_id, &name, Some(&root_path)));
    let project_title = requested_title.unwrap_or_else(|| name.clone());
    let project_author = requested_author.unwrap_or_else(|| created_by_user_id.clone());
    let project_type = requested_type.unwrap_or_else(|| "CODE".to_owned());
    let project_collaborator_id = create_identifier("project-collaborator");
    let project_owner_team_id = load_provider_team_payloads(&connection)
        .map_err(|error| {
            problem_response(
                "create-project-team-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .into_iter()
        .find(|team| {
            team.workspace_id == workspace_id && team.owner_id.as_deref() == Some(owner_id.as_str())
        })
        .map(|team| team.id);
    let workspace_uuid =
        if let Some(workspace_uuid) = requested_workspace_uuid.or_else(|| workspace.uuid.clone()) {
            workspace_uuid
        } else {
            match connection.query_row(
                "SELECT uuid FROM workspaces WHERE id = ?1 AND is_deleted = 0 LIMIT 1",
                params![&workspace_id],
                |row| row.get::<_, Option<String>>(0),
            ) {
                Ok(Some(value)) => value,
                Ok(None) | Err(rusqlite::Error::QueryReturnedNoRows) => {
                    return Err(problem_response(
                        "create-project-workspace-uuid-read-failed",
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "system_error",
                        "Failed to resolve workspace uuid.",
                    ))
                }
                Err(error) => {
                    return Err(problem_response(
                        "create-project-workspace-uuid-read-failed",
                        StatusCode::INTERNAL_SERVER_ERROR,
                        "system_error",
                        format!("Failed to resolve workspace uuid: {error}"),
                    ))
                }
            }
        };
    let transaction = connection.transaction().map_err(|error| {
        problem_response(
            "create-project-transaction-open-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to open project authority transaction: {error}"),
        )
    })?;

    transaction
        .execute(
            r#"
            INSERT INTO projects (
                id, uuid, tenant_id, organization_id, created_at, updated_at, version, is_deleted,
                workspace_id, workspace_uuid, name, code, title, description, root_path, owner_id,
                leader_id, created_by_user_id, type, author, status
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, 0, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
            "#,
            params![
                &project_id,
                &project_uuid,
                &tenant_id,
                &organization_id,
                &now,
                &now,
                &workspace_id,
                &workspace_uuid,
                &name,
                &project_code,
                &project_title,
                &description,
                &root_path,
                &owner_id,
                &leader_id,
                &created_by_user_id,
                &project_type,
                &project_author,
                &status,
            ],
        )
        .and_then(|_| {
            transaction.execute(
                r#"
                INSERT INTO project_collaborators (
                    id, created_at, updated_at, version, is_deleted, project_id, workspace_id, user_id, team_id, role,
                    created_by_user_id, granted_by_user_id, status
                ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    &project_collaborator_id,
                    &now,
                    &now,
                    &project_id,
                    &workspace_id,
                    &owner_id,
                    &project_owner_team_id,
                    "owner",
                    &created_by_user_id,
                    &created_by_user_id,
                    "active",
                ],
            )
        })
        .and_then(|_| {
            if let Some(app_template_version_id) = requested_app_template_version_id.as_deref() {
                upsert_project_template_instantiation(
                    &transaction,
                    &project_id,
                    app_template_version_id,
                    requested_template_preset_key.as_deref().unwrap_or("default"),
                    &root_path,
                    &now,
                )
                .map(|_| 1)
                .map_err(|error| rusqlite::Error::ToSqlConversionFailure(Box::new(
                    std::io::Error::new(std::io::ErrorKind::Other, error),
                )))
            } else {
                Ok(0)
            }
        })
        .map_err(|error| {
            problem_response(
                "create-project-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to persist project authority: {error}"),
            )
        })?;

    transaction.commit().map_err(|error| {
        problem_response(
            "create-project-transaction-commit-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to commit project authority: {error}"),
        )
    })?;

    let project = load_provider_project_payload_by_id(&connection, &project_id)
        .map_err(|error| {
            problem_response(
                "create-project-readback-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .ok_or_else(|| {
            problem_response(
                "create-project-readback-missing",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                "Project authority readback was not found.",
            )
        })?;

    state.publish_workspace_realtime_event(
        "project.created",
        "app",
        project.workspace_id.clone(),
        Some(project.id.clone()),
        Some(project.name.clone()),
        project.root_path.clone(),
        project.updated_at.clone(),
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
    );

    Ok((
        StatusCode::CREATED,
        Json(create_envelope("app-create-project", project)),
    ))
}

async fn app_update_project(
    AxumPath(project_id): AxumPath<String>,
    State(state): State<AppState>,
    Json(request): Json<UpdateProjectRequest>,
) -> Result<Json<ApiEnvelope<ProjectPayload>>, (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>)>
{
    let normalized_project_id = normalize_required_string(project_id).ok_or_else(|| {
        problem_response(
            "update-project-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "projectId is required.",
        )
    })?;
    let normalized_status = normalize_project_status(request.status).map_err(|message| {
        problem_response(
            "update-project-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            message,
        )
    })?;

    let connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "update-project-authority-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;
    let existing_project = load_provider_project_payload_by_id(&connection, &normalized_project_id)
        .map_err(|error| {
            problem_response(
                "update-project-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .ok_or_else(|| {
            problem_response(
                "update-project-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Project authority was not found.",
            )
        })?;
    let existing_workspace_id = existing_project.workspace_id.clone();

    let next_name = request
        .name
        .and_then(normalize_required_string)
        .unwrap_or(existing_project.name.clone());
    let next_description = match request.description {
        Some(description) => normalize_optional_string(Some(description)),
        None => existing_project.description.clone(),
    };
    let next_root_path = match request.root_path {
        Some(root_path) => {
            normalize_optional_project_root_path(Some(root_path)).map_err(|message| {
                problem_response(
                    "update-project-invalid",
                    StatusCode::BAD_REQUEST,
                    "argument_invalid",
                    message,
                )
            })?
        }
        None => existing_project.root_path,
    };
    let next_root_path = next_root_path.ok_or_else(|| {
        problem_response(
            "update-project-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "project rootPath is required.",
        )
    })?;
    let next_code = request
        .code
        .and_then(normalize_required_string)
        .or_else(|| existing_project.code.clone())
        .unwrap_or_else(|| {
            build_project_business_code(&normalized_project_id, &next_name, Some(&next_root_path))
        });
    let next_title = request
        .title
        .and_then(normalize_required_string)
        .or_else(|| existing_project.title.clone())
        .unwrap_or_else(|| next_name.clone());
    let next_owner_id = request
        .owner_id
        .and_then(normalize_required_string)
        .or_else(|| existing_project.owner_id.clone())
        .unwrap_or_else(|| BOOTSTRAP_WORKSPACE_OWNER_USER_ID.to_owned());
    let next_leader_id = request
        .leader_id
        .and_then(normalize_required_string)
        .or_else(|| existing_project.leader_id.clone())
        .unwrap_or_else(|| next_owner_id.clone());
    let next_author = request
        .author
        .and_then(normalize_required_string)
        .or_else(|| existing_project.author.clone())
        .or_else(|| existing_project.created_by_user_id.clone())
        .unwrap_or_else(|| next_owner_id.clone());
    let next_type = request
        .entity_type
        .and_then(normalize_required_string)
        .or_else(|| existing_project.entity_type.clone())
        .unwrap_or_else(|| "CODE".to_owned());
    let next_status = normalized_status.unwrap_or(existing_project.status);

    if let Some(conflicting_project) = find_provider_project_payload_by_workspace_and_root_path(
        &connection,
        &existing_workspace_id,
        &next_root_path,
        Some(&normalized_project_id),
    )
    .map_err(|error| {
        problem_response(
            "update-project-conflict-read-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            error,
        )
    })? {
        return Err(problem_response(
            "update-project-root-path-conflict",
            StatusCode::CONFLICT,
            "already_exists",
            format!(
                "Workspace already contains project \"{}\" for rootPath \"{}\".",
                conflicting_project.name, next_root_path,
            ),
        ));
    }

    connection
        .execute(
            r#"
            UPDATE projects
            SET
                updated_at = ?2,
                name = ?3,
                code = ?4,
                title = ?5,
                description = ?6,
                root_path = ?7,
                owner_id = ?8,
                leader_id = ?9,
                author = ?10,
                type = ?11,
                status = ?12
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![
                &normalized_project_id,
                current_storage_timestamp(),
                &next_name,
                &next_code,
                &next_title,
                &next_description,
                &next_root_path,
                &next_owner_id,
                &next_leader_id,
                &next_author,
                &next_type,
                &next_status,
            ],
        )
        .map_err(|error| {
            problem_response(
                "update-project-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to persist project authority: {error}"),
            )
        })?;

    let project = load_provider_project_payload_by_id(&connection, &normalized_project_id)
        .map_err(|error| {
            problem_response(
                "update-project-readback-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .ok_or_else(|| {
            problem_response(
                "update-project-readback-missing",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                "Project authority readback was not found.",
            )
        })?;

    state.publish_workspace_realtime_event(
        "project.updated",
        "app",
        project.workspace_id.clone(),
        Some(project.id.clone()),
        Some(project.name.clone()),
        project.root_path.clone(),
        project.updated_at.clone(),
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
    );

    Ok(Json(create_envelope("app-update-project", project)))
}

async fn app_delete_project(
    AxumPath(project_id): AxumPath<String>,
    State(state): State<AppState>,
) -> Result<
    Json<ApiEnvelope<DeleteEntityPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_project_id = normalize_required_string(project_id).ok_or_else(|| {
        problem_response(
            "delete-project-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "projectId is required.",
        )
    })?;
    let connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "delete-project-authority-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;
    let existing_project = load_provider_project_payload_by_id(&connection, &normalized_project_id)
        .map_err(|error| {
            problem_response(
                "delete-project-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .ok_or_else(|| {
            problem_response(
                "delete-project-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Project authority was not found.",
            )
        })?;
    let deleted_count = connection
        .execute(
            r#"
            UPDATE projects
            SET is_deleted = 1, updated_at = ?2
            WHERE id = ?1 AND is_deleted = 0
            "#,
            params![normalized_project_id, current_storage_timestamp()],
        )
        .map_err(|error| {
            problem_response(
                "delete-project-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to delete project authority: {error}"),
            )
        })?;

    debug_assert!(deleted_count > 0);

    connection
        .execute(
            r#"
            UPDATE project_collaborators
            SET is_deleted = 1, updated_at = ?2
            WHERE project_id = ?1 AND is_deleted = 0
            "#,
            params![normalized_project_id, current_storage_timestamp()],
        )
        .map_err(|error| {
            problem_response(
                "delete-project-collaborators-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to delete project collaborator authority: {error}"),
            )
        })?;

    state.publish_workspace_realtime_event(
        "project.deleted",
        "app",
        existing_project.workspace_id,
        Some(normalized_project_id.clone()),
        Some(existing_project.name),
        existing_project.root_path,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
    );

    Ok(Json(create_envelope(
        "app-delete-project",
        DeleteEntityPayload {
            id: normalized_project_id,
        },
    )))
}

async fn app_workspace_members(
    AxumPath(workspace_id): AxumPath<String>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<
    Json<ApiListEnvelope<WorkspaceMemberPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_workspace_id = normalize_required_string(workspace_id).ok_or_else(|| {
        problem_response(
            "workspace-members-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "workspaceId is required.",
        )
    })?;
    let app_admin_state = state.read_app_admin_state();
    let workspace = app_admin_state
        .workspaces
        .iter()
        .find(|workspace| workspace.id == normalized_workspace_id)
        .cloned();
    let Some(workspace) = workspace else {
        return Err(problem_response(
            "workspace-members-workspace-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Workspace authority was not found.",
        ));
    };
    if let Some(current_user_id) =
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id)
    {
        let viewer_role = resolve_workspace_viewer_role(
            &workspace,
            &app_admin_state.workspace_members,
            &app_admin_state.members,
            &current_user_id,
        );
        if viewer_role.is_none() {
            return Err(problem_response(
                "workspace-members-forbidden",
                StatusCode::FORBIDDEN,
                "forbidden",
                "Current user is not allowed to read workspace members.",
            ));
        }
    }

    let members = app_admin_state
        .workspace_members
        .into_iter()
        .filter(|member| member.workspace_id == normalized_workspace_id)
        .collect::<Vec<_>>();
    Ok(Json(create_list_envelope("app-workspace-members", members)))
}

async fn app_upsert_workspace_member(
    AxumPath(workspace_id): AxumPath<String>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<UpsertWorkspaceMemberRequest>,
) -> Result<
    (StatusCode, Json<ApiEnvelope<WorkspaceMemberPayload>>),
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_workspace_id = normalize_required_string(workspace_id).ok_or_else(|| {
        problem_response(
            "workspace-member-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "workspaceId is required.",
        )
    })?;
    let role = normalize_collaboration_role(request.role)
        .map_err(|message| {
            problem_response(
                "workspace-member-invalid",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                message,
            )
        })?
        .unwrap_or_else(|| "member".to_owned());
    let status = normalize_collaboration_status(request.status)
        .map_err(|message| {
            problem_response(
                "workspace-member-invalid",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                message,
            )
        })?
        .unwrap_or_else(|| "active".to_owned());
    let team_id = normalize_optional_string(request.team_id);
    let current_user_id =
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id);
    let app_admin_state = state.read_app_admin_state();
    let workspace_projection = app_admin_state
        .workspaces
        .iter()
        .find(|workspace| workspace.id == normalized_workspace_id)
        .cloned();
    if let (Some(workspace), Some(actor_user_id)) =
        (workspace_projection.as_ref(), current_user_id.as_deref())
    {
        let viewer_role = resolve_workspace_viewer_role(
            workspace,
            &app_admin_state.workspace_members,
            &app_admin_state.members,
            actor_user_id,
        );
        if !matches!(viewer_role.as_deref(), Some("owner" | "admin")) {
            return Err(problem_response(
                "workspace-member-forbidden",
                StatusCode::FORBIDDEN,
                "forbidden",
                "Current user is not allowed to manage workspace members.",
            ));
        }
    }
    let mut connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "workspace-member-authority-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;

    let workspace = load_provider_workspace_payload_by_id(&connection, &normalized_workspace_id)
        .map_err(|error| {
            problem_response(
                "workspace-member-workspace-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .ok_or_else(|| {
            problem_response(
                "workspace-member-workspace-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Workspace authority was not found.",
            )
        })?;

    if let Some(normalized_team_id) = team_id.as_deref() {
        let team_exists = load_provider_team_payloads(&connection)
            .map_err(|error| {
                problem_response(
                    "workspace-member-team-read-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    error,
                )
            })?
            .into_iter()
            .any(|team| {
                team.id == normalized_team_id && team.workspace_id == normalized_workspace_id
            });
        if !team_exists {
            return Err(problem_response(
                "workspace-member-team-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Team authority was not found for the workspace.",
            ));
        }
    }

    let resolved_user = state
        .user_center
        .ensure_user_account(
            &mut connection,
            request.user_id.as_deref(),
            request.email.as_deref(),
            None,
            None,
        )
        .map_err(|error| {
            problem_response(
                "workspace-member-invalid",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                error,
            )
        })?;
    let user_id = resolved_user.id.clone();

    let now = current_storage_timestamp();
    let created_by_user_id = current_user_id
        .clone()
        .or_else(|| normalize_optional_string(request.created_by_user_id))
        .or_else(|| workspace.owner_id.clone())
        .or_else(|| workspace.created_by_user_id.clone())
        .unwrap_or_else(|| BOOTSTRAP_WORKSPACE_OWNER_USER_ID.to_owned());
    let granted_by_user_id = current_user_id
        .clone()
        .or_else(|| normalize_optional_string(request.granted_by_user_id))
        .unwrap_or_else(|| created_by_user_id.clone());
    let existing_member = load_provider_workspace_member_payloads(&connection)
        .map_err(|error| {
            problem_response(
                "workspace-member-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .into_iter()
        .find(|member| member.workspace_id == normalized_workspace_id && member.user_id == user_id);

    let transaction = connection.transaction().map_err(|error| {
        problem_response(
            "workspace-member-transaction-open-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to open workspace member transaction: {error}"),
        )
    })?;

    let member_id = existing_member
        .as_ref()
        .map(|member| member.id.clone())
        .unwrap_or_else(|| create_identifier("workspace-member"));
    let created_at = existing_member
        .as_ref()
        .and_then(|member| member.created_at.clone())
        .unwrap_or_else(|| now.clone());

    if existing_member.is_some() {
        transaction
            .execute(
                r#"
                UPDATE workspace_members
                SET
                    updated_at = ?2,
                    user_id = ?3,
                    team_id = ?4,
                    role = ?5,
                    created_by_user_id = ?6,
                    granted_by_user_id = ?7,
                    status = ?8,
                    is_deleted = 0
                WHERE id = ?1
                "#,
                params![
                    &member_id,
                    &now,
                    &user_id,
                    &team_id,
                    &role,
                    &created_by_user_id,
                    &granted_by_user_id,
                    &status,
                ],
            )
            .map_err(|error| {
                problem_response(
                    "workspace-member-upsert-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    format!("Failed to update workspace member authority: {error}"),
                )
            })?;
    } else {
        transaction
            .execute(
                r#"
                INSERT INTO workspace_members (
                    id, created_at, updated_at, version, is_deleted, workspace_id, user_id, team_id, role,
                    created_by_user_id, granted_by_user_id, status
                ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                "#,
                params![
                    &member_id,
                    &created_at,
                    &now,
                    &normalized_workspace_id,
                    &user_id,
                    &team_id,
                    &role,
                    &created_by_user_id,
                    &granted_by_user_id,
                    &status,
                ],
            )
            .map_err(|error| {
                problem_response(
                    "workspace-member-upsert-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    format!("Failed to create workspace member authority: {error}"),
                )
            })?;
    }

    if role == "owner" {
        transaction
            .execute(
                r#"
                UPDATE workspaces
                SET updated_at = ?2, owner_id = ?3, leader_id = ?4
                WHERE id = ?1 AND is_deleted = 0
                "#,
                params![&normalized_workspace_id, &now, &user_id, &user_id,],
            )
            .map_err(|error| {
                problem_response(
                    "workspace-member-owner-sync-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    format!("Failed to sync workspace owner authority: {error}"),
                )
            })?;
    }

    transaction.commit().map_err(|error| {
        problem_response(
            "workspace-member-transaction-commit-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to commit workspace member authority: {error}"),
        )
    })?;

    Ok((
        if existing_member.is_some() {
            StatusCode::OK
        } else {
            StatusCode::CREATED
        },
        Json(create_envelope(
            "app-upsert-workspace-member",
            WorkspaceMemberPayload {
                id: member_id,
                workspace_id: normalized_workspace_id,
                user_id: user_id,
                user_email: Some(resolved_user.email.clone()),
                user_display_name: Some(resolved_user.name.clone()),
                user_avatar_url: resolved_user.avatar_url,
                team_id,
                role,
                status,
                created_by_user_id: Some(created_by_user_id),
                granted_by_user_id: Some(granted_by_user_id),
                created_at: Some(created_at),
                updated_at: Some(now),
            },
        )),
    ))
}

async fn app_project_collaborators(
    AxumPath(project_id): AxumPath<String>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<
    Json<ApiListEnvelope<ProjectCollaboratorPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_project_id = normalize_required_string(project_id).ok_or_else(|| {
        problem_response(
            "project-collaborators-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "projectId is required.",
        )
    })?;
    let app_admin_state = state.read_app_admin_state();
    let project = app_admin_state
        .projects
        .iter()
        .find(|project| project.id == normalized_project_id)
        .cloned();
    let Some(project) = project else {
        return Err(problem_response(
            "project-collaborators-project-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Project authority was not found.",
        ));
    };
    if let Some(current_user_id) =
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id)
    {
        let viewer_role = resolve_project_viewer_role(
            &project,
            &workspace_lookup_map(&app_admin_state.workspaces),
            &app_admin_state.workspace_members,
            &app_admin_state.project_collaborators,
            &app_admin_state.members,
            &current_user_id,
        );
        if viewer_role.is_none() {
            return Err(problem_response(
                "project-collaborators-forbidden",
                StatusCode::FORBIDDEN,
                "forbidden",
                "Current user is not allowed to read project collaborators.",
            ));
        }
    }

    let collaborators = app_admin_state
        .project_collaborators
        .into_iter()
        .filter(|collaborator| collaborator.project_id == normalized_project_id)
        .collect::<Vec<_>>();
    Ok(Json(create_list_envelope(
        "app-project-collaborators",
        collaborators,
    )))
}

async fn app_upsert_project_collaborator(
    AxumPath(project_id): AxumPath<String>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<UpsertProjectCollaboratorRequest>,
) -> Result<
    (StatusCode, Json<ApiEnvelope<ProjectCollaboratorPayload>>),
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_project_id = normalize_required_string(project_id).ok_or_else(|| {
        problem_response(
            "project-collaborator-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "projectId is required.",
        )
    })?;
    let role = normalize_collaboration_role(request.role)
        .map_err(|message| {
            problem_response(
                "project-collaborator-invalid",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                message,
            )
        })?
        .unwrap_or_else(|| "member".to_owned());
    let status = normalize_collaboration_status(request.status)
        .map_err(|message| {
            problem_response(
                "project-collaborator-invalid",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                message,
            )
        })?
        .unwrap_or_else(|| "active".to_owned());
    let team_id = normalize_optional_string(request.team_id);
    let current_user_id =
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id);
    let app_admin_state = state.read_app_admin_state();
    let project_projection = app_admin_state
        .projects
        .iter()
        .find(|project| project.id == normalized_project_id)
        .cloned();
    if let (Some(project), Some(actor_user_id)) =
        (project_projection.as_ref(), current_user_id.as_deref())
    {
        let viewer_role = resolve_project_viewer_role(
            project,
            &workspace_lookup_map(&app_admin_state.workspaces),
            &app_admin_state.workspace_members,
            &app_admin_state.project_collaborators,
            &app_admin_state.members,
            actor_user_id,
        );
        if !matches!(viewer_role.as_deref(), Some("owner" | "admin")) {
            return Err(problem_response(
                "project-collaborator-forbidden",
                StatusCode::FORBIDDEN,
                "forbidden",
                "Current user is not allowed to manage project collaborators.",
            ));
        }
    }
    let mut connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "project-collaborator-authority-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;

    let project = load_provider_project_payload_by_id(&connection, &normalized_project_id)
        .map_err(|error| {
            problem_response(
                "project-collaborator-project-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .ok_or_else(|| {
            problem_response(
                "project-collaborator-project-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Project authority was not found.",
            )
        })?;

    if let Some(normalized_team_id) = team_id.as_deref() {
        let team_exists = load_provider_team_payloads(&connection)
            .map_err(|error| {
                problem_response(
                    "project-collaborator-team-read-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    error,
                )
            })?
            .into_iter()
            .any(|team| team.id == normalized_team_id && team.workspace_id == project.workspace_id);
        if !team_exists {
            return Err(problem_response(
                "project-collaborator-team-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Team authority was not found for the project workspace.",
            ));
        }
    }

    let resolved_user = state
        .user_center
        .ensure_user_account(
            &mut connection,
            request.user_id.as_deref(),
            request.email.as_deref(),
            None,
            None,
        )
        .map_err(|error| {
            problem_response(
                "project-collaborator-invalid",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                error,
            )
        })?;
    let user_id = resolved_user.id.clone();

    let now = current_storage_timestamp();
    let created_by_user_id = current_user_id
        .clone()
        .or_else(|| normalize_optional_string(request.created_by_user_id))
        .or_else(|| project.owner_id.clone())
        .or_else(|| project.created_by_user_id.clone())
        .unwrap_or_else(|| BOOTSTRAP_WORKSPACE_OWNER_USER_ID.to_owned());
    let granted_by_user_id = current_user_id
        .clone()
        .or_else(|| normalize_optional_string(request.granted_by_user_id))
        .unwrap_or_else(|| created_by_user_id.clone());
    let existing_collaborator = load_provider_project_collaborator_payloads(&connection)
        .map_err(|error| {
            problem_response(
                "project-collaborator-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .into_iter()
        .find(|collaborator| {
            collaborator.project_id == normalized_project_id && collaborator.user_id == user_id
        });

    let transaction = connection.transaction().map_err(|error| {
        problem_response(
            "project-collaborator-transaction-open-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to open project collaborator transaction: {error}"),
        )
    })?;

    let collaborator_id = existing_collaborator
        .as_ref()
        .map(|collaborator| collaborator.id.clone())
        .unwrap_or_else(|| create_identifier("project-collaborator"));
    let created_at = existing_collaborator
        .as_ref()
        .and_then(|collaborator| collaborator.created_at.clone())
        .unwrap_or_else(|| now.clone());

    if existing_collaborator.is_some() {
        transaction
            .execute(
                r#"
                UPDATE project_collaborators
                SET
                    updated_at = ?2,
                    user_id = ?3,
                    team_id = ?4,
                    role = ?5,
                    created_by_user_id = ?6,
                    granted_by_user_id = ?7,
                    status = ?8,
                    is_deleted = 0
                WHERE id = ?1
                "#,
                params![
                    &collaborator_id,
                    &now,
                    &user_id,
                    &team_id,
                    &role,
                    &created_by_user_id,
                    &granted_by_user_id,
                    &status,
                ],
            )
            .map_err(|error| {
                problem_response(
                    "project-collaborator-upsert-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    format!("Failed to update project collaborator authority: {error}"),
                )
            })?;
    } else {
        transaction
            .execute(
                r#"
                INSERT INTO project_collaborators (
                    id, created_at, updated_at, version, is_deleted, project_id, workspace_id, user_id, team_id, role,
                    created_by_user_id, granted_by_user_id, status
                ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    &collaborator_id,
                    &created_at,
                    &now,
                    &normalized_project_id,
                    &project.workspace_id,
                    &user_id,
                    &team_id,
                    &role,
                    &created_by_user_id,
                    &granted_by_user_id,
                    &status,
                ],
            )
            .map_err(|error| {
                problem_response(
                    "project-collaborator-upsert-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    format!("Failed to create project collaborator authority: {error}"),
                )
            })?;
    }

    if role == "owner" {
        transaction
            .execute(
                r#"
                UPDATE projects
                SET updated_at = ?2, owner_id = ?3, leader_id = ?4
                WHERE id = ?1 AND is_deleted = 0
                "#,
                params![&normalized_project_id, &now, &user_id, &user_id,],
            )
            .map_err(|error| {
                problem_response(
                    "project-collaborator-owner-sync-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    format!("Failed to sync project owner authority: {error}"),
                )
            })?;
    }

    transaction.commit().map_err(|error| {
        problem_response(
            "project-collaborator-transaction-commit-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to commit project collaborator authority: {error}"),
        )
    })?;

    Ok((
        if existing_collaborator.is_some() {
            StatusCode::OK
        } else {
            StatusCode::CREATED
        },
        Json(create_envelope(
            "app-upsert-project-collaborator",
            ProjectCollaboratorPayload {
                id: collaborator_id,
                project_id: normalized_project_id,
                workspace_id: project.workspace_id,
                user_id: user_id,
                user_email: Some(resolved_user.email.clone()),
                user_display_name: Some(resolved_user.name.clone()),
                user_avatar_url: resolved_user.avatar_url,
                team_id,
                role,
                status,
                created_by_user_id: Some(created_by_user_id),
                granted_by_user_id: Some(granted_by_user_id),
                created_at: Some(created_at),
                updated_at: Some(now),
            },
        )),
    ))
}

async fn app_documents(State(state): State<AppState>) -> Json<ApiListEnvelope<DocumentPayload>> {
    let app_admin_state = state.read_app_admin_state();
    Json(create_list_envelope(
        "app-documents",
        app_admin_state.documents,
    ))
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

async fn app_publish_project(
    AxumPath(project_id): AxumPath<String>,
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(request): Json<PublishProjectRequest>,
) -> Result<
    Json<ApiEnvelope<PublishProjectResultPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_project_id = normalize_required_string(project_id).ok_or_else(|| {
        problem_response(
            "project-publish-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "projectId is required.",
        )
    })?;
    let requested_target_id = normalize_optional_string(request.target_id);
    let requested_target_name = normalize_optional_string(request.target_name);
    let requested_environment_key = normalize_optional_string(request.environment_key);
    let requested_runtime = normalize_optional_string(request.runtime);
    let requested_release_kind =
        normalize_optional_string(request.release_kind).unwrap_or_else(|| "formal".to_owned());
    let requested_release_version = normalize_optional_string(request.release_version);
    let requested_rollout_stage = normalize_optional_string(request.rollout_stage);
    let requested_endpoint_url = normalize_optional_string(request.endpoint_url);
    let current_user_id =
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id);
    let app_admin_state = state.read_app_admin_state();
    let project_projection = app_admin_state
        .projects
        .iter()
        .find(|project| project.id == normalized_project_id)
        .cloned();
    if let (Some(project), Some(actor_user_id)) =
        (project_projection.as_ref(), current_user_id.as_deref())
    {
        let viewer_role = resolve_project_viewer_role(
            project,
            &workspace_lookup_map(&app_admin_state.workspaces),
            &app_admin_state.workspace_members,
            &app_admin_state.project_collaborators,
            &app_admin_state.members,
            actor_user_id,
        );
        if !matches!(viewer_role.as_deref(), Some("owner" | "admin")) {
            return Err(problem_response(
                "project-publish-forbidden",
                StatusCode::FORBIDDEN,
                "forbidden",
                "Current user is not allowed to publish the project.",
            ));
        }
    }

    let mut connection = state
        .open_authority_connection_for_write()
        .map_err(|error| {
            problem_response(
                "project-publish-authority-unavailable",
                StatusCode::NOT_IMPLEMENTED,
                "system_error",
                error,
            )
        })?;

    let project = load_provider_project_payload_by_id(&connection, &normalized_project_id)
        .map_err(|error| {
            problem_response(
                "project-publish-project-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .ok_or_else(|| {
            problem_response(
                "project-publish-project-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Project authority was not found.",
            )
        })?;

    let active_targets = load_provider_deployment_target_payloads(&connection)
        .map_err(|error| {
            problem_response(
                "project-publish-target-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                error,
            )
        })?
        .into_iter()
        .filter(|target| target.project_id == normalized_project_id && target.status == "active")
        .collect::<Vec<_>>();

    let explicit_existing_target = if let Some(target_id) = requested_target_id.as_deref() {
        Some(
            active_targets
                .iter()
                .find(|target| target.id == target_id)
                .cloned()
                .ok_or_else(|| {
                    problem_response(
                        "project-publish-target-not-found",
                        StatusCode::NOT_FOUND,
                        "not_found",
                        "Deployment target was not found for the project.",
                    )
                })?,
        )
    } else {
        None
    };

    let create_new_target = requested_target_id.is_none()
        && (requested_target_name.is_some()
            || requested_environment_key.is_some()
            || requested_runtime.is_some()
            || active_targets.is_empty());
    let fallback_existing_target = if create_new_target {
        None
    } else {
        active_targets.first().cloned()
    };

    let effective_environment_key = requested_environment_key
        .clone()
        .or_else(|| {
            explicit_existing_target
                .as_ref()
                .map(|target| target.environment_key.clone())
        })
        .or_else(|| {
            fallback_existing_target
                .as_ref()
                .map(|target| target.environment_key.clone())
        })
        .unwrap_or_else(|| "prod".to_owned());
    let effective_runtime = requested_runtime
        .clone()
        .or_else(|| {
            explicit_existing_target
                .as_ref()
                .map(|target| target.runtime.clone())
        })
        .or_else(|| {
            fallback_existing_target
                .as_ref()
                .map(|target| target.runtime.clone())
        })
        .unwrap_or_else(|| "web".to_owned());
    let effective_rollout_stage =
        requested_rollout_stage.unwrap_or_else(|| effective_environment_key.clone());
    let now = current_storage_timestamp();
    let release_version =
        requested_release_version.unwrap_or_else(|| build_default_publish_release_version(&now));

    let created_target = if create_new_target {
        Some(DeploymentTargetPayload {
            id: create_identifier("target"),
            project_id: normalized_project_id.clone(),
            name: requested_target_name.unwrap_or_else(|| {
                build_default_publish_target_name(
                    &project.name,
                    &effective_environment_key,
                    &effective_runtime,
                )
            }),
            environment_key: effective_environment_key.clone(),
            runtime: effective_runtime.clone(),
            status: "active".to_owned(),
        })
    } else {
        None
    };

    let target = created_target
        .clone()
        .or(explicit_existing_target)
        .or(fallback_existing_target)
        .ok_or_else(|| {
            problem_response(
                "project-publish-target-resolution-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                "Failed to resolve a deployment target for the project.",
            )
        })?;

    let release = ReleasePayload {
        id: create_identifier("release"),
        release_version: release_version.clone(),
        release_kind: requested_release_kind.clone(),
        rollout_stage: effective_rollout_stage.clone(),
        status: "ready".to_owned(),
    };
    let deployment = DeploymentPayload {
        id: create_identifier("deployment"),
        project_id: normalized_project_id.clone(),
        target_id: target.id.clone(),
        release_record_id: Some(release.id.clone()),
        status: "planned".to_owned(),
        endpoint_url: requested_endpoint_url.clone(),
        started_at: Some(now.clone()),
        completed_at: None,
    };
    let created_by_user_id = current_user_id
        .clone()
        .or_else(|| project.created_by_user_id.clone())
        .or_else(|| project.owner_id.clone())
        .unwrap_or_else(|| BOOTSTRAP_WORKSPACE_OWNER_USER_ID.to_owned());
    let release_manifest = serde_json::json!({
        "projectId": normalized_project_id,
        "projectName": project.name,
        "targetId": target.id,
        "targetName": target.name,
        "environmentKey": target.environment_key,
        "runtime": target.runtime,
        "releaseVersion": release.release_version,
        "releaseKind": release.release_kind,
        "rolloutStage": release.rollout_stage,
        "endpointUrl": requested_endpoint_url,
        "createdByUserId": created_by_user_id,
        "publishedAt": now,
    });
    let audit_payload = serde_json::json!({
        "projectId": deployment.project_id,
        "deploymentId": deployment.id,
        "targetId": target.id,
        "releaseId": release.id,
        "releaseVersion": release.release_version,
        "status": deployment.status,
    });
    let transaction = connection.transaction().map_err(|error| {
        problem_response(
            "project-publish-transaction-open-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to open project publish transaction: {error}"),
        )
    })?;

    if let Some(target_to_insert) = created_target.as_ref() {
        transaction
            .execute(
                r#"
                INSERT INTO deployment_targets (
                    id, created_at, updated_at, version, is_deleted, project_id, name, environment_key, runtime, status
                ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8)
                "#,
                params![
                    &target_to_insert.id,
                    &now,
                    &now,
                    &target_to_insert.project_id,
                    &target_to_insert.name,
                    &target_to_insert.environment_key,
                    &target_to_insert.runtime,
                    &target_to_insert.status,
                ],
            )
            .map_err(|error| {
                problem_response(
                    "project-publish-target-create-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    format!("Failed to create deployment target: {error}"),
                )
            })?;
    }

    transaction
        .execute(
            r#"
            INSERT INTO release_records (
                id, created_at, updated_at, version, is_deleted, release_version, release_kind, rollout_stage, manifest_json, status
            ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8)
            "#,
            params![
                &release.id,
                &now,
                &now,
                &release.release_version,
                &release.release_kind,
                &release.rollout_stage,
                release_manifest.to_string(),
                &release.status,
            ],
        )
        .map_err(|error| {
            problem_response(
                "project-publish-release-create-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to create release record: {error}"),
            )
        })?;

    transaction
        .execute(
            r#"
            INSERT INTO deployment_records (
                id, created_at, updated_at, version, is_deleted, project_id, target_id, release_record_id, status, endpoint_url, started_at, completed_at
            ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
            "#,
            params![
                &deployment.id,
                &now,
                &now,
                &deployment.project_id,
                &deployment.target_id,
                &deployment.release_record_id,
                &deployment.status,
                &deployment.endpoint_url,
                &deployment.started_at,
                &deployment.completed_at,
            ],
        )
        .map_err(|error| {
            problem_response(
                "project-publish-deployment-create-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to create deployment record: {error}"),
            )
        })?;

    transaction
        .execute(
            r#"
            INSERT INTO audit_events (
                id, created_at, updated_at, version, is_deleted, scope_type, scope_id, event_type, payload_json
            ) VALUES (?1, ?2, ?3, 0, 0, ?4, ?5, ?6, ?7)
            "#,
            params![
                create_identifier("audit"),
                &now,
                &now,
                "project",
                &deployment.project_id,
                "project.publish.created",
                audit_payload.to_string(),
            ],
        )
        .map_err(|error| {
            problem_response(
                "project-publish-audit-create-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to create publish audit event: {error}"),
            )
        })?;

    transaction.commit().map_err(|error| {
        problem_response(
            "project-publish-transaction-commit-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to commit project publish transaction: {error}"),
        )
    })?;

    Ok(Json(create_envelope(
        "app-publish-project",
        PublishProjectResultPayload {
            deployment,
            release,
            target,
        },
    )))
}

async fn app_teams(
    Query(query): Query<WorkspaceScopedQuery>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Json<ApiListEnvelope<TeamPayload>> {
    let app_admin_state = state.read_app_admin_state();
    let workspace_filter = normalize_optional_string(query.workspace_id);
    let user_filter = normalize_optional_string(query.user_id).or_else(|| {
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id)
    });
    let teams = app_admin_state
        .teams
        .into_iter()
        .filter(|team| {
            if workspace_filter
                .as_deref()
                .is_some_and(|workspace_id| team.workspace_id != workspace_id)
            {
                return false;
            }

            user_filter.as_deref().is_none_or(|user_id| {
                app_admin_state.members.iter().any(|member| {
                    member.team_id == team.id
                        && member.user_id == user_id
                        && is_active_collaboration_status(&member.status)
                }) || app_admin_state
                    .workspaces
                    .iter()
                    .find(|workspace| workspace.id == team.workspace_id)
                    .is_some_and(|workspace| {
                        workspace_is_visible_to_user(
                            workspace,
                            &app_admin_state.workspace_members,
                            &app_admin_state.members,
                            user_id,
                        )
                    })
            })
        })
        .collect::<Vec<_>>();
    Json(create_list_envelope("app-teams", teams))
}

async fn admin_teams(
    Query(query): Query<WorkspaceScopedQuery>,
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Json<ApiListEnvelope<TeamPayload>> {
    let app_admin_state = state.read_app_admin_state();
    let workspace_filter = normalize_optional_string(query.workspace_id);
    let user_filter = normalize_optional_string(query.user_id).or_else(|| {
        try_resolve_current_user_center_session(&state, &headers).map(|session| session.user.id)
    });
    let teams = app_admin_state
        .teams
        .into_iter()
        .filter(|team| {
            if workspace_filter
                .as_deref()
                .is_some_and(|workspace_id| team.workspace_id != workspace_id)
            {
                return false;
            }

            user_filter.as_deref().is_none_or(|user_id| {
                app_admin_state.members.iter().any(|member| {
                    member.team_id == team.id
                        && member.user_id == user_id
                        && is_active_collaboration_status(&member.status)
                }) || app_admin_state
                    .workspaces
                    .iter()
                    .find(|workspace| workspace.id == team.workspace_id)
                    .is_some_and(|workspace| {
                        workspace_is_visible_to_user(
                            workspace,
                            &app_admin_state.workspace_members,
                            &app_admin_state.members,
                            user_id,
                        )
                    })
            })
        })
        .collect::<Vec<_>>();
    Json(create_list_envelope("admin-teams", teams))
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

async fn openapi_docs() -> Html<String> {
    Html(build_coding_server_docs_html())
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
) -> Result<
    Json<ApiEnvelope<OperationPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let operation = state.projections.operation(&operation_id).ok_or_else(|| {
        problem_response(
            "operation-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Operation projection was not found.",
        )
    })?;

    Ok(Json(create_envelope("core-operation", operation)))
}

fn is_native_coding_session_id(coding_session_id: &str) -> bool {
    native_sessions::is_authority_backed_native_session_id(coding_session_id)
}

fn normalize_attached_native_session_id(
    engine_id: &str,
    native_session_id: &str,
) -> Option<String> {
    let normalized_native_session_id = native_session_id.trim();
    if normalized_native_session_id.is_empty() {
        return None;
    }

    if is_native_coding_session_id(normalized_native_session_id) {
        return Some(normalized_native_session_id.to_owned());
    }

    Some(native_sessions::build_native_session_id(
        engine_id,
        normalized_native_session_id,
    ))
}

fn resolve_projection_attached_native_session_id(
    state: &AppState,
    coding_session_id: &str,
    engine_id: &str,
    snapshot: &ProjectionSnapshot,
) -> Option<String> {
    let latest_runtime_row = state
        .projections
        .sqlite_file
        .as_deref()
        .and_then(|sqlite_file| Connection::open(sqlite_file).ok())
        .and_then(|connection| {
            load_provider_runtime_row_for_session(&connection, coding_session_id, None)
                .ok()
                .flatten()
        });
    resolve_projection_attached_native_session_id_with_runtime_row(
        engine_id,
        snapshot,
        latest_runtime_row.as_ref(),
    )
}

fn resolve_projection_attached_native_session_id_with_runtime_row(
    engine_id: &str,
    snapshot: &ProjectionSnapshot,
    runtime_row: Option<&CodingSessionRuntimeRow>,
) -> Option<String> {
    let resolved_engine_id = runtime_row
        .and_then(|runtime| {
            let normalized_runtime_engine_id = runtime.engine_id.trim();
            (!normalized_runtime_engine_id.is_empty()).then_some(normalized_runtime_engine_id)
        })
        .unwrap_or(engine_id);
    let event_native_session_id =
        resolve_native_session_id_from_snapshot(snapshot).and_then(|native_session_id| {
            normalize_attached_native_session_id(resolved_engine_id, native_session_id.as_str())
        });
    if event_native_session_id.is_some() {
        return event_native_session_id;
    }

    runtime_row.and_then(|runtime| {
        runtime.native_session_id.as_ref().and_then(|native_session_id| {
            normalize_attached_native_session_id(resolved_engine_id, native_session_id.as_str())
        })
    })
}

fn build_native_session_query(
    query: NativeSessionQueryParams,
) -> native_sessions::NativeSessionQuery {
    native_sessions::NativeSessionQuery {
        workspace_id: normalize_optional_string(query.workspace_id),
        project_id: normalize_optional_string(query.project_id),
        engine_id: normalize_optional_string(query.engine_id),
        limit: query.limit,
    }
}

fn build_native_session_lookup(
    coding_session_id: String,
    query: NativeSessionLookupQueryParams,
) -> native_sessions::NativeSessionLookup {
    let NativeSessionLookupQueryParams {
        workspace_id,
        project_id,
        engine_id,
    } = query;
    native_sessions::NativeSessionLookup {
        session_id: coding_session_id,
        engine_id: normalize_optional_string(engine_id),
        workspace_id: normalize_optional_string(workspace_id),
        project_id: normalize_optional_string(project_id),
    }
}

fn build_coding_session_payload_from_native_summary(
    summary: &native_sessions::NativeSessionSummaryPayload,
) -> CodingSessionPayload {
    CodingSessionPayload {
        id: summary.id.clone(),
        workspace_id: summary.workspace_id.clone(),
        project_id: summary.project_id.clone(),
        title: summary.title.clone(),
        status: summary.status.clone(),
        host_mode: summary.host_mode.clone(),
        engine_id: summary.engine_id.clone(),
        model_id: summary.model_id.clone(),
        created_at: summary.created_at.clone(),
        updated_at: summary.updated_at.clone(),
        last_turn_at: summary.last_turn_at.clone(),
        sort_timestamp: summary.sort_timestamp,
        transcript_updated_at: summary.transcript_updated_at.clone(),
    }
}

fn overlay_projection_session_with_native_summary(
    session: &CodingSessionPayload,
    native_summary: &native_sessions::NativeSessionSummaryPayload,
) -> CodingSessionPayload {
    CodingSessionPayload {
        id: session.id.clone(),
        workspace_id: native_summary.workspace_id.clone(),
        project_id: native_summary.project_id.clone(),
        title: native_summary.title.clone(),
        status: native_summary.status.clone(),
        host_mode: native_summary.host_mode.clone(),
        engine_id: native_summary.engine_id.clone(),
        model_id: native_summary
            .model_id
            .clone()
            .or_else(|| session.model_id.clone()),
        created_at: native_summary.created_at.clone(),
        updated_at: native_summary.updated_at.clone(),
        last_turn_at: native_summary
            .last_turn_at
            .clone()
            .or_else(|| session.last_turn_at.clone()),
        sort_timestamp: native_summary.sort_timestamp,
        transcript_updated_at: native_summary
            .transcript_updated_at
            .clone()
            .or_else(|| session.transcript_updated_at.clone()),
    }
}

fn to_native_session_turn_ide_context(
    ide_context: Option<&CodingSessionTurnIdeContextPayload>,
) -> Option<native_sessions::NativeSessionTurnIdeContext> {
    let ide_context = ide_context?;
    Some(native_sessions::NativeSessionTurnIdeContext {
        workspace_id: ide_context.workspace_id.clone(),
        project_id: ide_context.project_id.clone(),
        thread_id: ide_context.thread_id.clone(),
        current_file: ide_context.current_file.as_ref().map(|current_file| {
            native_sessions::NativeSessionTurnCurrentFileContext {
                path: current_file.path.clone(),
                content: current_file.content.clone(),
                language: current_file.language.clone(),
            }
        }),
    })
}

async fn list_native_sessions_async(
    projects: Vec<ProjectPayload>,
    query: native_sessions::NativeSessionQuery,
) -> Result<Vec<native_sessions::NativeSessionSummaryPayload>, String> {
    tokio::task::spawn_blocking(move || native_sessions::list_native_sessions(&projects, &query))
        .await
        .map_err(|error| format!("join native session list task failed: {error}"))?
}

async fn get_native_session_async(
    projects: Vec<ProjectPayload>,
    lookup: native_sessions::NativeSessionLookup,
) -> Result<Option<native_sessions::NativeSessionDetailPayload>, String> {
    tokio::task::spawn_blocking(move || native_sessions::get_native_session(&projects, &lookup))
        .await
        .map_err(|error| format!("join native session read task failed: {error}"))?
}

async fn get_native_session_summary_async(
    projects: Vec<ProjectPayload>,
    lookup: native_sessions::NativeSessionLookup,
) -> Result<Option<native_sessions::NativeSessionSummaryPayload>, String> {
    tokio::task::spawn_blocking(move || {
        native_sessions::get_native_session_summary(&projects, &lookup)
    })
    .await
    .map_err(|error| format!("join native session summary read task failed: {error}"))?
}

fn filter_projects_by_scope(
    projects: Vec<ProjectPayload>,
    workspace_id: Option<&str>,
    project_id: Option<&str>,
) -> Vec<ProjectPayload> {
    let normalized_workspace_id = workspace_id.map(str::trim).filter(|value| !value.is_empty());
    let normalized_project_id = project_id.map(str::trim).filter(|value| !value.is_empty());
    projects
        .into_iter()
        .filter(|project| {
            normalized_workspace_id
                .is_none_or(|workspace_id| project.workspace_id == workspace_id)
                && normalized_project_id.is_none_or(|project_id| project.id == project_id)
        })
        .collect()
}

async fn read_projection_attached_native_session_detail(
    state: AppState,
    session: CodingSessionPayload,
    snapshot: ProjectionSnapshot,
) -> Result<Option<native_sessions::NativeSessionDetailPayload>, String> {
    let Some(attached_native_session_id) = resolve_projection_attached_native_session_id(
        &state,
        session.id.as_str(),
        session.engine_id.as_str(),
        &snapshot,
    ) else {
        return Ok(None);
    };

    let app_admin_state = state.read_app_admin_state();
    let scoped_projects = filter_projects_by_scope(
        app_admin_state.projects,
        Some(session.workspace_id.as_str()),
        None,
    );
    if scoped_projects.is_empty() {
        return Ok(None);
    }
    let attached_native_engine_id =
        native_sessions::resolve_native_session_engine_id(attached_native_session_id.as_str())
            .unwrap_or_else(|| session.engine_id.clone());
    get_native_session_async(
        scoped_projects,
        native_sessions::NativeSessionLookup {
            session_id: attached_native_session_id,
            engine_id: Some(attached_native_engine_id),
            workspace_id: Some(session.workspace_id.clone()),
            project_id: None,
        },
    )
    .await
}

async fn read_projection_native_session_detail(
    state: AppState,
    session: CodingSessionPayload,
    snapshot: ProjectionSnapshot,
) -> Result<Option<native_sessions::NativeSessionDetailPayload>, String> {
    if let Some(detail) =
        read_projection_attached_native_session_detail(state.clone(), session.clone(), snapshot)
            .await?
    {
        return Ok(Some(detail));
    }

    if !is_native_coding_session_id(session.id.as_str()) {
        return Ok(None);
    }

    let app_admin_state = state.read_app_admin_state();
    let scoped_projects = filter_projects_by_scope(
        app_admin_state.projects,
        Some(session.workspace_id.as_str()),
        None,
    );
    if scoped_projects.is_empty() {
        return Ok(None);
    }

    let native_engine_id = native_sessions::resolve_native_session_engine_id(session.id.as_str())
        .unwrap_or_else(|| session.engine_id.clone());
    get_native_session_async(
        scoped_projects,
        native_sessions::NativeSessionLookup {
            session_id: session.id.clone(),
            engine_id: Some(native_engine_id),
            workspace_id: Some(session.workspace_id.clone()),
            project_id: None,
        },
    )
    .await
}

async fn read_projection_attached_native_session_summary(
    state: AppState,
    session: CodingSessionPayload,
    snapshot: ProjectionSnapshot,
) -> Result<Option<native_sessions::NativeSessionSummaryPayload>, String> {
    let Some(attached_native_session_id) = resolve_projection_attached_native_session_id(
        &state,
        session.id.as_str(),
        session.engine_id.as_str(),
        &snapshot,
    ) else {
        return Ok(None);
    };

    let app_admin_state = state.read_app_admin_state();
    let scoped_projects = filter_projects_by_scope(
        app_admin_state.projects,
        Some(session.workspace_id.as_str()),
        None,
    );
    if scoped_projects.is_empty() {
        return Ok(None);
    }
    let attached_native_engine_id =
        native_sessions::resolve_native_session_engine_id(attached_native_session_id.as_str())
            .unwrap_or_else(|| session.engine_id.clone());
    get_native_session_summary_async(
        scoped_projects,
        native_sessions::NativeSessionLookup {
            session_id: attached_native_session_id,
            engine_id: Some(attached_native_engine_id),
            workspace_id: Some(session.workspace_id.clone()),
            project_id: None,
        },
    )
    .await
}

async fn read_projection_native_session_summary(
    state: AppState,
    session: CodingSessionPayload,
    snapshot: ProjectionSnapshot,
) -> Result<Option<native_sessions::NativeSessionSummaryPayload>, String> {
    if let Some(summary) =
        read_projection_attached_native_session_summary(state.clone(), session.clone(), snapshot)
            .await?
    {
        return Ok(Some(summary));
    }

    if !is_native_coding_session_id(session.id.as_str()) {
        return Ok(None);
    }

    let app_admin_state = state.read_app_admin_state();
    let scoped_projects = filter_projects_by_scope(
        app_admin_state.projects,
        Some(session.workspace_id.as_str()),
        None,
    );
    if scoped_projects.is_empty() {
        return Ok(None);
    }

    let native_engine_id = native_sessions::resolve_native_session_engine_id(session.id.as_str())
        .unwrap_or_else(|| session.engine_id.clone());
    get_native_session_summary_async(
        scoped_projects,
        native_sessions::NativeSessionLookup {
            session_id: session.id.clone(),
            engine_id: Some(native_engine_id),
            workspace_id: Some(session.workspace_id.clone()),
            project_id: None,
        },
    )
    .await
}

fn build_native_session_events_for_coding_session(
    detail: &native_sessions::NativeSessionDetailPayload,
    coding_session_id: &str,
    base_sequence: usize,
) -> Vec<CodingSessionEventPayload> {
    let runtime_id = format!("{coding_session_id}:runtime");
    detail
        .messages
        .iter()
        .enumerate()
        .map(|(index, message)| {
            let mut payload = BTreeMap::new();
            payload.insert("role".to_owned(), message.role.clone());
            payload.insert("content".to_owned(), message.content.clone());
            payload.insert("runtimeStatus".to_owned(), "completed".to_owned());
            payload.insert("nativeSessionId".to_owned(), detail.summary.id.clone());
            if let Some(commands) = message.commands.as_ref() {
                if let Ok(serialized_commands) = serde_json::to_string(commands) {
                    payload.insert("commandsJson".to_owned(), serialized_commands);
                }
            }

            CodingSessionEventPayload {
                id: format!(
                    "{}:{}:event:{}",
                    runtime_id,
                    message
                        .turn_id
                        .clone()
                        .unwrap_or_else(|| format!("native-turn-{index}")),
                    base_sequence + index
                ),
                coding_session_id: coding_session_id.to_owned(),
                turn_id: message.turn_id.clone(),
                runtime_id: Some(runtime_id.clone()),
                kind: "message.completed".to_owned(),
                sequence: base_sequence + index,
                payload,
                created_at: message.created_at.clone(),
            }
        })
        .collect()
}

fn build_native_session_events(
    detail: &native_sessions::NativeSessionDetailPayload,
) -> Vec<CodingSessionEventPayload> {
    build_native_session_events_for_coding_session(detail, detail.summary.id.as_str(), 0)
}

fn build_projection_session_events_with_native_detail(
    snapshot: &ProjectionSnapshot,
    detail: &native_sessions::NativeSessionDetailPayload,
    coding_session_id: &str,
) -> Vec<CodingSessionEventPayload> {
    let mut events = snapshot
        .events
        .iter()
        .filter(|event| event.kind != "message.completed" && event.kind != "message.delta")
        .cloned()
        .collect::<Vec<_>>();
    let base_sequence = events
        .iter()
        .map(|event| event.sequence)
        .max()
        .map(|sequence| sequence + 1)
        .unwrap_or(0);
    events.extend(build_native_session_events_for_coding_session(
        detail,
        coding_session_id,
        base_sequence,
    ));
    events.sort_by(|left, right| {
        left.sequence
            .cmp(&right.sequence)
            .then_with(|| left.created_at.cmp(&right.created_at))
            .then_with(|| left.id.cmp(&right.id))
    });
    events
}

fn resolve_native_turn_working_directory(
    detail: &native_sessions::NativeSessionDetailPayload,
    projects: &[ProjectPayload],
) -> Option<PathBuf> {
    if let Some(project) = projects
        .iter()
        .find(|project| project.id == detail.summary.project_id)
    {
        if let Some(root_path) = project.root_path.as_deref() {
            return Some(PathBuf::from(root_path));
        }
    }

    detail
        .summary
        .native_cwd
        .as_deref()
        .filter(|cwd| !cwd.trim().is_empty())
        .map(PathBuf::from)
}

fn resolve_native_turn_id(
    before_detail: Option<&native_sessions::NativeSessionDetailPayload>,
    after_detail: &native_sessions::NativeSessionDetailPayload,
) -> Option<String> {
    let before_message_ids = before_detail
        .map(|detail| {
            detail
                .messages
                .iter()
                .map(|message| message.id.clone())
                .collect::<std::collections::BTreeSet<_>>()
        })
        .unwrap_or_default();

    after_detail
        .messages
        .iter()
        .rev()
        .find(|message| !before_message_ids.contains(&message.id) && message.turn_id.is_some())
        .and_then(|message| message.turn_id.clone())
        .or_else(|| {
            after_detail
                .messages
                .iter()
                .rev()
                .find_map(|message| message.turn_id.clone())
        })
}

fn create_native_coding_session_turn(
    state: &AppState,
    coding_session_id: &str,
    input: &CreateCodingSessionTurnInput,
) -> Result<CodingSessionTurnPayload, String> {
    let app_admin_state = state.read_app_admin_state();
    let native_engine_id = native_sessions::resolve_native_session_engine_id(coding_session_id);
    let before_detail = native_sessions::get_native_session(
        &app_admin_state.projects,
        &native_sessions::NativeSessionLookup {
            session_id: coding_session_id.to_owned(),
            engine_id: native_engine_id.clone(),
            workspace_id: None,
            project_id: None,
        },
    )?
    .ok_or_else(|| format!("native coding session {coding_session_id} was not found"))?;
    let started_at = current_session_timestamp();

    let _turn_result =
        native_sessions::execute_native_session_turn(&native_sessions::NativeSessionTurnRequest {
            engine_id: before_detail.summary.engine_id.clone(),
            model_id: before_detail.summary.model_id.clone(),
            native_session_id: Some(before_detail.summary.id.clone()),
            request_kind: input.request_kind.clone(),
            input_summary: input.input_summary.clone(),
            ide_context: to_native_session_turn_ide_context(input.ide_context.as_ref()),
            working_directory: resolve_native_turn_working_directory(
                &before_detail,
                &app_admin_state.projects,
            ),
            config: native_sessions::NativeSessionTurnConfig {
                full_auto: true,
                skip_git_repo_check: true,
                ..Default::default()
            },
        })?;

    let after_detail = native_sessions::get_native_session(
        &app_admin_state.projects,
        &native_sessions::NativeSessionLookup {
            session_id: coding_session_id.to_owned(),
            engine_id: native_engine_id,
            workspace_id: Some(before_detail.summary.workspace_id.clone()),
            project_id: Some(before_detail.summary.project_id.clone()),
        },
    )?
    .unwrap_or(before_detail.clone());
    let completed_at = current_session_timestamp();

    Ok(CodingSessionTurnPayload {
        id: resolve_native_turn_id(Some(&before_detail), &after_detail)
            .unwrap_or_else(|| create_identifier("coding-turn")),
        coding_session_id: coding_session_id.to_owned(),
        runtime_id: Some(format!("{coding_session_id}:runtime")),
        request_kind: input.request_kind.clone(),
        status: "completed".to_owned(),
        input_summary: input.input_summary.clone(),
        started_at: Some(started_at),
        completed_at: Some(completed_at),
    })
}

async fn core_native_sessions(
    State(state): State<AppState>,
    Query(query): Query<NativeSessionQueryParams>,
) -> Result<
    Json<ApiListEnvelope<native_sessions::NativeSessionSummaryPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let app_admin_state = state.read_app_admin_state();
    let all_sessions = list_native_sessions_async(
        app_admin_state.projects,
        build_native_session_query(NativeSessionQueryParams {
            workspace_id: query.workspace_id.clone(),
            project_id: query.project_id.clone(),
            engine_id: query.engine_id.clone(),
            limit: None,
            offset: None,
        }),
    )
    .await
    .map_err(|error| {
        problem_response(
            "native-sessions-list-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to list native sessions: {error}"),
        )
    })?;
    let (paged_sessions, normalized_offset, requested_page_size, total) =
        paginate_vec(all_sessions, query.offset, query.limit);

    Ok(Json(create_paged_list_envelope(
        "core-native-sessions",
        paged_sessions,
        normalized_offset,
        requested_page_size,
        total,
    )))
}

async fn core_sessions(
    State(state): State<AppState>,
    Query(query): Query<CodingSessionListQuery>,
) -> Result<
    Json<ApiListEnvelope<CodingSessionPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_workspace_id = normalize_optional_string(query.workspace_id);
    let normalized_project_id = normalize_optional_string(query.project_id);
    let normalized_engine_id = normalize_optional_string(query.engine_id);

    let mut sessions = state.projections.sessions();

    let app_admin_state = state.read_app_admin_state();
    let scoped_projects = filter_projects_by_scope(
        app_admin_state.projects,
        normalized_workspace_id.as_deref(),
        None,
    );
    let native_sessions = if scoped_projects.is_empty() {
        Vec::new()
    } else {
        list_native_sessions_async(
            scoped_projects,
            native_sessions::NativeSessionQuery {
                workspace_id: normalized_workspace_id.clone(),
                project_id: None,
                engine_id: normalized_engine_id.clone(),
                limit: None,
            },
        )
        .await
        .map_err(|error| {
            problem_response(
                "list-coding-sessions-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to list unified coding sessions: {error}"),
            )
        })?
    };
    let native_summaries_by_id = native_sessions
        .iter()
        .map(|summary| (summary.id.clone(), summary.clone()))
        .collect::<BTreeMap<_, _>>();
    let mut attached_native_session_ids = BTreeSet::new();
    let latest_runtime_rows_by_session_id =
        load_latest_runtime_rows_by_coding_session_id(state.projections.sqlite_file.as_deref());

    sessions = sessions
        .into_iter()
        .map(|session| {
            let Some(snapshot) = state.projections.session_snapshot(session.id.as_str()) else {
                return session;
            };
            let Some(attached_native_session_id) =
                resolve_projection_attached_native_session_id_with_runtime_row(
                    session.engine_id.as_str(),
                    &snapshot,
                    latest_runtime_rows_by_session_id.get(session.id.as_str()),
                )
            else {
                return session;
            };

            attached_native_session_ids.insert(attached_native_session_id.clone());
            native_summaries_by_id
                .get(&attached_native_session_id)
                .map(|native_summary| {
                    overlay_projection_session_with_native_summary(&session, native_summary)
                })
                .unwrap_or(session)
        })
        .filter(|session| {
            normalized_workspace_id
                .as_ref()
                .is_none_or(|workspace_id| session.workspace_id == *workspace_id)
                && normalized_project_id
                    .as_ref()
                    .is_none_or(|project_id| session.project_id == *project_id)
                && normalized_engine_id
                    .as_ref()
                    .is_none_or(|engine_id| session.engine_id == *engine_id)
        })
        .collect();

    sessions.extend(
        native_sessions
            .iter()
            .filter(|summary| {
                normalized_project_id
                    .as_ref()
                    .is_none_or(|project_id| summary.project_id == *project_id)
            })
            .filter(|summary| !attached_native_session_ids.contains(&summary.id))
            .map(build_coding_session_payload_from_native_summary),
    );
    sessions.sort_by(|left, right| {
        resolve_coding_session_payload_sort_timestamp(right)
            .cmp(&resolve_coding_session_payload_sort_timestamp(left))
            .then_with(|| right.updated_at.cmp(&left.updated_at))
            .then_with(|| right.created_at.cmp(&left.created_at))
            .then_with(|| left.id.cmp(&right.id))
    });
    sessions.dedup_by(|left, right| left.id == right.id);

    let (paged_sessions, normalized_offset, requested_page_size, total) =
        paginate_vec(sessions, query.offset, query.limit);

    Ok(Json(create_paged_list_envelope(
        "core-coding-sessions",
        paged_sessions,
        normalized_offset,
        requested_page_size,
        total,
    )))
}

async fn core_native_session(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
    Query(query): Query<NativeSessionLookupQueryParams>,
) -> Result<
    Json<ApiEnvelope<native_sessions::NativeSessionDetailPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let app_admin_state = state.read_app_admin_state();
    let detail = get_native_session_async(
        app_admin_state.projects,
        build_native_session_lookup(coding_session_id, query),
    )
    .await
    .map_err(|error| {
        problem_response(
            "native-session-read-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to read native session: {error}"),
        )
    })?
    .ok_or_else(|| {
        problem_response(
            "native-session-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Native coding session was not found.",
        )
    })?;

    Ok(Json(create_envelope("core-native-session", detail)))
}

async fn core_session(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
) -> Result<
    Json<ApiEnvelope<CodingSessionPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let session = if let Some(session) = state.projections.session(&coding_session_id) {
        if let Some(snapshot) = state.projections.session_snapshot(&coding_session_id) {
            if let Some(summary) = read_projection_native_session_summary(
                state.clone(),
                session.clone(),
                snapshot.clone(),
            )
            .await
            .map_err(|error| {
                problem_response(
                    "native-session-read-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    format!("Failed to read native session summary: {error}"),
                )
            })? {
                overlay_projection_session_with_native_summary(&session, &summary)
            } else {
                session
            }
        } else {
            session
        }
    } else if is_native_coding_session_id(&coding_session_id) {
        let app_admin_state = state.read_app_admin_state();
        let detail = get_native_session_async(
            app_admin_state.projects,
            native_sessions::NativeSessionLookup {
                session_id: coding_session_id.clone(),
                engine_id: native_sessions::resolve_native_session_engine_id(
                    coding_session_id.as_str(),
                ),
                workspace_id: None,
                project_id: None,
            },
        )
        .await
        .map_err(|error| {
            problem_response(
                "native-session-read-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to read native session summary: {error}"),
            )
        })?
        .ok_or_else(|| {
            problem_response(
                "session-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Coding session projection was not found.",
            )
        })?;
        build_coding_session_payload_from_native_summary(&detail.summary)
    } else {
        return Err(problem_response(
            "session-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Coding session projection was not found.",
        ));
    };

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

    let session = state
        .projections
        .create_coding_session(input)
        .map_err(|error| {
            problem_response(
                "create-coding-session-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to persist coding session authority: {error}"),
            )
        })?;

    state.publish_workspace_realtime_event(
        "coding-session.created",
        "core",
        session.workspace_id.clone(),
        Some(session.project_id.clone()),
        None,
        None,
        None,
        Some(session.id.clone()),
        Some(session.title.clone()),
        Some(session.status.clone()),
        Some(session.host_mode.clone()),
        Some(session.engine_id.clone()),
        session.model_id.clone(),
        Some(session.updated_at.clone()),
        None,
    );

    Ok((
        StatusCode::CREATED,
        Json(create_envelope("core-create-session", session)),
    ))
}

async fn core_fork_session(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
    Json(request): Json<ForkCodingSessionRequest>,
) -> Result<
    (StatusCode, Json<ApiEnvelope<CodingSessionPayload>>),
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let input = ForkCodingSessionInput::try_from(request).map_err(|message| {
        problem_response(
            "fork-coding-session-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            message,
        )
    })?;

    let (source_session, source_events) =
        resolve_fork_source_session_and_events(state.clone(), coding_session_id.as_str())
            .await
            .map_err(|error| {
                problem_response(
                    "fork-coding-session-source-read-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    format!("Failed to load fork source coding session: {error}"),
                )
            })?;
    if source_session.workspace_id.trim().is_empty() || source_session.project_id.trim().is_empty() {
        return Err(problem_response(
            "fork-coding-session-missing-project-scope",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "Only project-scoped coding sessions can be forked.",
        ));
    }

    let session = state
        .projections
        .fork_coding_session(source_session, source_events, input)
        .map_err(|error| {
            problem_response(
                "fork-coding-session-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to persist forked coding session authority: {error}"),
            )
        })?;

    state.publish_workspace_realtime_event(
        "coding-session.created",
        "core",
        session.workspace_id.clone(),
        Some(session.project_id.clone()),
        None,
        None,
        None,
        Some(session.id.clone()),
        Some(session.title.clone()),
        Some(session.status.clone()),
        Some(session.host_mode.clone()),
        Some(session.engine_id.clone()),
        session.model_id.clone(),
        Some(session.updated_at.clone()),
        None,
    );

    Ok((
        StatusCode::CREATED,
        Json(create_envelope("core-fork-session", session)),
    ))
}

async fn core_update_session(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
    Json(request): Json<UpdateCodingSessionRequest>,
) -> Result<
    Json<ApiEnvelope<CodingSessionPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    if state.projections.session(&coding_session_id).is_none() {
        return Err(problem_response(
            "update-coding-session-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Coding session projection was not found.",
        ));
    }

    let input = UpdateCodingSessionInput::try_from(request).map_err(|message| {
        problem_response(
            "update-coding-session-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            message,
        )
    })?;

    let session = state
        .projections
        .update_coding_session(&coding_session_id, input)
        .map_err(|error| {
            problem_response(
                "update-coding-session-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to persist coding session authority: {error}"),
            )
        })?;

    state.publish_workspace_realtime_event(
        "coding-session.updated",
        "core",
        session.workspace_id.clone(),
        Some(session.project_id.clone()),
        None,
        None,
        None,
        Some(session.id.clone()),
        Some(session.title.clone()),
        Some(session.status.clone()),
        Some(session.host_mode.clone()),
        Some(session.engine_id.clone()),
        session.model_id.clone(),
        Some(session.updated_at.clone()),
        None,
    );

    Ok(Json(create_envelope("core-update-session", session)))
}

async fn core_delete_session(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
) -> Result<
    Json<ApiEnvelope<DeleteEntityPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_coding_session_id = normalize_required_string(coding_session_id).ok_or_else(|| {
        problem_response(
            "delete-coding-session-invalid",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "codingSessionId is required.",
        )
    })?;

    let existing_session = state
        .projections
        .session(&normalized_coding_session_id)
        .ok_or_else(|| {
            problem_response(
                "delete-coding-session-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Coding session projection was not found.",
            )
        })?;

    state
        .projections
        .delete_coding_session(&normalized_coding_session_id)
        .map_err(|error| {
            problem_response(
                "delete-coding-session-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to delete coding session authority: {error}"),
            )
        })?;

    state.publish_workspace_realtime_event(
        "coding-session.deleted",
        "core",
        existing_session.workspace_id.clone(),
        Some(existing_session.project_id.clone()),
        None,
        None,
        None,
        Some(existing_session.id.clone()),
        Some(existing_session.title.clone()),
        Some(existing_session.status.clone()),
        Some(existing_session.host_mode.clone()),
        Some(existing_session.engine_id.clone()),
        existing_session.model_id.clone(),
        Some(current_storage_timestamp()),
        None,
    );

    Ok(Json(create_envelope(
        "core-delete-session",
        DeleteEntityPayload {
            id: normalized_coding_session_id,
        },
    )))
}

async fn core_delete_session_message(
    State(state): State<AppState>,
    AxumPath((coding_session_id, message_id)): AxumPath<(String, String)>,
) -> Result<
    Json<ApiEnvelope<DeleteEntityPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    let normalized_coding_session_id =
        normalize_required_string(coding_session_id).ok_or_else(|| {
            problem_response(
                "delete-coding-session-message-invalid-session-id",
                StatusCode::BAD_REQUEST,
                "argument_invalid",
                "codingSessionId is required.",
            )
        })?;
    let normalized_message_id = normalize_required_string(message_id).ok_or_else(|| {
        problem_response(
            "delete-coding-session-message-invalid-message-id",
            StatusCode::BAD_REQUEST,
            "argument_invalid",
            "messageId is required.",
        )
    })?;

    let existing_session = state
        .projections
        .session(&normalized_coding_session_id)
        .ok_or_else(|| {
            problem_response(
                "delete-coding-session-message-not-found",
                StatusCode::NOT_FOUND,
                "not_found",
                "Coding session projection was not found.",
            )
        })?;

    state
        .projections
        .delete_coding_session_message(
            &normalized_coding_session_id,
            &normalized_message_id,
        )
        .map_err(|error| {
            problem_response(
                "delete-coding-session-message-failed",
                StatusCode::INTERNAL_SERVER_ERROR,
                "system_error",
                format!("Failed to delete coding session message: {error}"),
            )
        })?;

    let updated_session = state
        .projections
        .session(&normalized_coding_session_id)
        .unwrap_or(existing_session.clone());
    state.publish_workspace_realtime_event(
        "coding-session.updated",
        "core",
        updated_session.workspace_id.clone(),
        Some(updated_session.project_id.clone()),
        None,
        None,
        None,
        Some(updated_session.id.clone()),
        Some(updated_session.title.clone()),
        Some(updated_session.status.clone()),
        Some(updated_session.host_mode.clone()),
        Some(updated_session.engine_id.clone()),
        updated_session.model_id.clone(),
        Some(updated_session.updated_at.clone()),
        None,
    );

    Ok(Json(create_envelope(
        "core-delete-session-message",
        DeleteEntityPayload {
            id: normalized_message_id,
        },
    )))
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

    if state.projections.session(&coding_session_id).is_none()
        && is_native_coding_session_id(&coding_session_id)
    {
        let turn = create_native_coding_session_turn(&state, &coding_session_id, &input).map_err(
            |error| {
                problem_response(
                    "create-native-coding-session-turn-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    format!("Failed to execute native coding session turn: {error}"),
                )
            },
        )?;

        return Ok((
            StatusCode::CREATED,
            Json({
                let app_admin_state = state.read_app_admin_state();
                if let Ok(Some(detail)) = get_native_session_async(
                    app_admin_state.projects,
                    native_sessions::NativeSessionLookup {
                        session_id: coding_session_id.clone(),
                        engine_id: native_sessions::resolve_native_session_engine_id(
                            coding_session_id.as_str(),
                        ),
                        workspace_id: None,
                        project_id: None,
                    },
                )
                .await
                {
                    state.publish_workspace_realtime_event(
                        "coding-session.turn.created",
                        "core",
                        detail.summary.workspace_id.clone(),
                        Some(detail.summary.project_id.clone()),
                        None,
                        detail.summary.native_cwd.clone(),
                        None,
                        Some(detail.summary.id.clone()),
                        Some(detail.summary.title.clone()),
                        Some(detail.summary.status.clone()),
                        Some(detail.summary.host_mode.clone()),
                        Some(detail.summary.engine_id.clone()),
                        detail.summary.model_id.clone(),
                        Some(detail.summary.updated_at.clone()),
                        turn.id.clone().into(),
                    );
                }
                create_envelope("core-create-turn", turn)
            }),
        ));
    }

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
    if let Some(session) = state.projections.session(&coding_session_id) {
        state.publish_workspace_realtime_event(
            "coding-session.turn.created",
            "core",
            session.workspace_id.clone(),
            Some(session.project_id.clone()),
            None,
            None,
            None,
            Some(session.id.clone()),
            Some(session.title.clone()),
            Some(session.status.clone()),
            Some(session.host_mode.clone()),
            Some(session.engine_id.clone()),
            session.model_id.clone(),
            Some(session.updated_at.clone()),
            Some(turn.id.clone()),
        );
    }

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
    if let Some(snapshot) = state.projections.session_snapshot(&coding_session_id) {
        if let Some(session) = snapshot.session.as_ref() {
            if let Some(detail) = read_projection_native_session_detail(
                state.clone(),
                session.clone(),
                snapshot.clone(),
            )
            .await
            .map_err(|error| {
                problem_response(
                    "native-session-events-read-failed",
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "system_error",
                    format!("Failed to read native session events: {error}"),
                )
            })? {
                return Ok(Json(create_list_envelope(
                    "core-session-events",
                    build_projection_session_events_with_native_detail(
                        &snapshot,
                        &detail,
                        coding_session_id.as_str(),
                    ),
                )));
            }
        }

        return Ok(Json(create_list_envelope(
            "core-session-events",
            snapshot.events.clone(),
        )));
    }

    if !is_native_coding_session_id(&coding_session_id) {
        return Err(problem_response(
            "session-events-not-found",
            StatusCode::NOT_FOUND,
            "not_found",
            "Coding session projection was not found.",
        ));
    }

    let app_admin_state = state.read_app_admin_state();
    let native_engine_id =
        native_sessions::resolve_native_session_engine_id(coding_session_id.as_str());
    let detail = get_native_session_async(
        app_admin_state.projects,
        native_sessions::NativeSessionLookup {
            session_id: coding_session_id,
            engine_id: native_engine_id,
            workspace_id: None,
            project_id: None,
        },
    )
    .await
    .map_err(|error| {
        problem_response(
            "native-session-events-read-failed",
            StatusCode::INTERNAL_SERVER_ERROR,
            "system_error",
            format!("Failed to read native session events: {error}"),
        )
    })?
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
        build_native_session_events(&detail),
    )))
}

async fn resolve_fork_source_session_and_events(
    state: AppState,
    coding_session_id: &str,
) -> Result<(CodingSessionPayload, Vec<CodingSessionEventPayload>), String> {
    if let Some(session) = state.projections.session(coding_session_id) {
        if let Some(snapshot) = state.projections.session_snapshot(coding_session_id) {
            if let Some(detail) = read_projection_native_session_detail(
                state.clone(),
                session.clone(),
                snapshot.clone(),
            )
            .await?
            {
                return Ok((
                    overlay_projection_session_with_native_summary(&session, &detail.summary),
                    build_projection_session_events_with_native_detail(
                        &snapshot,
                        &detail,
                        coding_session_id,
                    ),
                ));
            }

            return Ok((session, snapshot.events));
        }

        return Ok((session, Vec::new()));
    }

    if !is_native_coding_session_id(coding_session_id) {
        return Err(format!("coding session {coding_session_id} was not found"));
    }

    let app_admin_state = state.read_app_admin_state();
    let detail = get_native_session_async(
        app_admin_state.projects,
        native_sessions::NativeSessionLookup {
            session_id: coding_session_id.to_owned(),
            engine_id: native_sessions::resolve_native_session_engine_id(coding_session_id),
            workspace_id: None,
            project_id: None,
        },
    )
    .await?
    .ok_or_else(|| format!("coding session {coding_session_id} was not found"))?;

    Ok((
        build_coding_session_payload_from_native_summary(&detail.summary),
        build_native_session_events(&detail),
    ))
}

async fn core_session_artifacts(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
) -> Result<
    Json<ApiListEnvelope<CodingSessionArtifactPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    if let Some(snapshot) = state.projections.session_snapshot(&coding_session_id) {
        return Ok(Json(create_list_envelope(
            "core-session-artifacts",
            snapshot.artifacts.clone(),
        )));
    }

    if is_native_coding_session_id(&coding_session_id) {
        return Ok(Json(create_list_envelope(
            "core-session-artifacts",
            Vec::<CodingSessionArtifactPayload>::new(),
        )));
    }

    Err(problem_response(
        "session-artifacts-not-found",
        StatusCode::NOT_FOUND,
        "not_found",
        "Coding session projection was not found.",
    ))
}

async fn core_session_checkpoints(
    State(state): State<AppState>,
    AxumPath(coding_session_id): AxumPath<String>,
) -> Result<
    Json<ApiListEnvelope<CodingSessionCheckpointPayload>>,
    (StatusCode, Json<ApiEnvelope<ProblemDetailsPayload>>),
> {
    if let Some(snapshot) = state.projections.session_snapshot(&coding_session_id) {
        return Ok(Json(create_list_envelope(
            "core-session-checkpoints",
            snapshot.checkpoints.clone(),
        )));
    }

    if is_native_coding_session_id(&coding_session_id) {
        return Ok(Json(create_list_envelope(
            "core-session-checkpoints",
            Vec::<CodingSessionCheckpointPayload>::new(),
        )));
    }

    Err(problem_response(
        "session-checkpoints-not-found",
        StatusCode::NOT_FOUND,
        "not_found",
        "Coding session projection was not found.",
    ))
}

pub fn build_app() -> Router {
    build_app_with_state(AppState::demo())
}

pub fn build_app_from_sqlite_file(path: impl AsRef<FsPath>) -> Result<Router, String> {
    Ok(build_app_with_state(AppState::load(
        &AuthorityBootstrapConfig {
            sqlite_file: Some(path.as_ref().to_path_buf()),
            snapshot_file: None,
        },
    )?))
}

pub fn initialize_sqlite_provider_authority_schema(connection: &Connection) -> Result<(), String> {
    connection
        .execute_batch(SQLITE_PROVIDER_AUTHORITY_SCHEMA)
        .map_err(|error| format!("create sqlite provider authority schema failed: {error}"))
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
        .route(CODING_SERVER_ROUTE_CATALOG_PATH, get(core_route_catalog))
        .route("/api/core/v1/runtime", get(core_runtime))
        .route("/api/core/v1/health", get(core_health))
        .route(CODING_SERVER_LIVE_OPENAPI_PATH, get(openapi_document))
        .route(CODING_SERVER_OPENAPI_PATH, get(openapi_document))
        .route(CODING_SERVER_DOCS_PATH, get(openapi_docs))
        .route("/api/core/v1/engines", get(core_engines))
        .route(
            "/api/core/v1/native-session-providers",
            get(core_native_session_providers),
        )
        .route("/api/core/v1/native-sessions", get(core_native_sessions))
        .route(
            "/api/core/v1/native-sessions/{id}",
            get(core_native_session),
        )
        .route(
            "/api/core/v1/engines/{engine_key}/capabilities",
            get(core_engine_capabilities),
        )
        .route("/api/core/v1/models", get(core_models))
        .route(
            "/api/core/v1/coding-sessions",
            get(core_sessions).post(core_create_session),
        )
        .route(
            "/api/core/v1/coding-sessions/{id}",
            get(core_session)
                .patch(core_update_session)
                .delete(core_delete_session),
        )
        .route(
            "/api/core/v1/coding-sessions/{id}/messages/{message_id}",
            delete(core_delete_session_message),
        )
        .route(
            "/api/core/v1/coding-sessions/{id}/fork",
            post(core_fork_session),
        )
        .route(
            "/api/core/v1/coding-sessions/{id}/turns",
            post(core_create_turn),
        )
        .route(
            "/api/core/v1/coding-sessions/{id}/events",
            get(core_session_events),
        )
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
        .route(
            "/api/core/v1/operations/{operation_id}",
            get(core_operation),
        )
        .route("/api/app/v1/auth/config", get(app_user_center_config))
        .route("/api/app/v1/auth/session", get(app_user_center_session))
        .route("/api/app/v1/auth/login", post(app_user_center_login))
        .route("/api/app/v1/auth/register", post(app_user_center_register))
        .route("/api/app/v1/auth/logout", post(app_user_center_logout))
        .route(
            "/api/app/v1/auth/session/exchange",
            post(app_user_center_exchange_session),
        )
        .route(
            "/api/app/v1/user-center/profile",
            get(app_user_center_profile).patch(app_update_user_center_profile),
        )
        .route(
            "/api/app/v1/user-center/membership",
            get(app_user_center_membership).patch(app_update_user_center_membership),
        )
        .route(
            "/api/app/v1/workspaces",
            get(app_workspaces).post(app_create_workspace),
        )
        .route(
            "/api/app/v1/workspaces/{workspace_id}",
            patch(app_update_workspace).delete(app_delete_workspace),
        )
        .route(
            "/api/app/v1/workspaces/{workspace_id}/members",
            get(app_workspace_members).post(app_upsert_workspace_member),
        )
        .route(
            "/api/app/v1/workspaces/{workspace_id}/realtime",
            get(app_workspace_realtime),
        )
        .route(
            "/api/app/v1/projects",
            get(app_projects).post(app_create_project),
        )
        .route("/api/app/v1/skill-packages", get(app_skill_packages))
        .route(
            "/api/app/v1/skill-packages/{package_id}/installations",
            post(app_install_skill_package),
        )
        .route("/api/app/v1/app-templates", get(app_templates))
        .route(
            "/api/app/v1/projects/{project_id}",
            get(app_project).patch(app_update_project).delete(app_delete_project),
        )
        .route(
            "/api/app/v1/projects/{project_id}/collaborators",
            get(app_project_collaborators).post(app_upsert_project_collaborator),
        )
        .route(
            "/api/app/v1/projects/{project_id}/publish",
            post(app_publish_project),
        )
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
        .route(
            "/api/admin/v1/teams/{team_id}/members",
            get(admin_team_members),
        )
        .route("/api/admin/v1/releases", get(admin_releases))
        .route("/api/admin/v1/deployments", get(admin_deployments))
        .layer(build_local_cors_layer())
        .with_state(state)
}

fn is_origin_with_optional_port(origin: &str, prefix: &str) -> bool {
    origin == prefix
        || origin
            .strip_prefix(prefix)
            .is_some_and(|suffix| suffix.starts_with(':'))
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
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PATCH,
            Method::DELETE,
            Method::OPTIONS,
        ])
        .allow_headers([
            header::ACCEPT,
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            HeaderName::from_static(BIRDCODER_SESSION_HEADER_NAME),
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

    struct FakeCodexHomeGuard {
        fixture_directory: PathBuf,
        project_root: PathBuf,
        original_codex_home: Option<OsString>,
    }

    impl FakeCodexHomeGuard {
        fn install(
            directory_name: &str,
            session_id: &str,
            user_prompt: &str,
            assistant_content: &str,
        ) -> Self {
            let mut fixture_directory = std::env::temp_dir();
            fixture_directory.push(directory_name);

            if fixture_directory.exists() {
                fs::remove_dir_all(&fixture_directory)
                    .expect("remove existing fake codex home fixture directory");
            }

            let codex_home = fixture_directory.join("codex-home");
            let session_directory = codex_home
                .join("sessions")
                .join("2026")
                .join("04")
                .join("17");
            let project_root = fixture_directory.join("project-root");

            fs::create_dir_all(&session_directory).expect("create fake codex session directory");
            fs::create_dir_all(&project_root).expect("create fake project root directory");

            let session_index_line = serde_json::json!({
                "id": session_id,
                "thread_name": "Outdated thread index title",
                "updated_at": "2026-04-17T05:00:04Z",
            });
            fs::write(
                codex_home.join("session_index.jsonl"),
                format!("{session_index_line}\n"),
            )
            .expect("write fake codex session index");

            let session_lines = vec![
                serde_json::json!({
                    "timestamp": "2026-04-17T05:00:00Z",
                    "type": "session_meta",
                    "payload": {
                        "id": session_id,
                        "timestamp": "2026-04-17T05:00:00Z",
                        "cwd": project_root.display().to_string(),
                    },
                }),
                serde_json::json!({
                    "timestamp": "2026-04-17T05:00:01Z",
                    "type": "response_item",
                    "payload": {
                        "type": "message",
                        "role": "user",
                        "content": [{
                            "type": "input_text",
                            "text": format!("## My request for Codex:\n{user_prompt}"),
                        }],
                    },
                }),
                serde_json::json!({
                    "timestamp": "2026-04-17T05:00:02Z",
                    "type": "response_item",
                    "payload": {
                        "type": "message",
                        "role": "assistant",
                        "content": [{
                            "type": "output_text",
                            "text": assistant_content,
                        }],
                    },
                }),
            ]
            .into_iter()
            .map(|line| line.to_string())
            .collect::<Vec<_>>()
            .join("\n");
            fs::write(
                session_directory.join(format!("{session_id}.jsonl")),
                format!("{session_lines}\n"),
            )
            .expect("write fake codex session transcript");

            let original_codex_home = std::env::var_os("CODEX_HOME");
            std::env::set_var("CODEX_HOME", &codex_home);

            Self {
                fixture_directory,
                project_root,
                original_codex_home,
            }
        }

        fn project_root(&self) -> &FsPath {
            &self.project_root
        }
    }

    impl Drop for FakeCodexHomeGuard {
        fn drop(&mut self) {
            if let Some(codex_home) = self.original_codex_home.take() {
                std::env::set_var("CODEX_HOME", codex_home);
            } else {
                std::env::remove_var("CODEX_HOME");
            }

            if self.fixture_directory.exists() {
                fs::remove_dir_all(&self.fixture_directory)
                    .expect("remove fake codex home fixture directory");
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

    fn attach_fake_codex_session_to_provider_fixture(
        sqlite_path: &FsPath,
        fake_codex_home: &FakeCodexHomeGuard,
        native_session_id: &str,
    ) {
        let connection =
            Connection::open(sqlite_path).expect("open sqlite fixture for native session attach");
        connection
            .execute(
                "UPDATE projects SET root_path = ?1 WHERE id = 'project-provider'",
                params![fake_codex_home.project_root().display().to_string()],
            )
            .expect("update provider project root path for native session attribution");
        connection
            .execute(
                "UPDATE coding_session_runtimes SET native_session_id = ?1 WHERE coding_session_id = 'provider-session'",
                params![native_session_id],
            )
            .expect("update provider runtime native session id");
    }

    fn generated_engine_catalog_json() -> serde_json::Value {
        serde_json::to_value(sdkwork_birdcoder_codeengine::shared_codeengine_catalog())
            .expect("serialize shared codeengine catalog fixture")
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
        update_codex_cli_turn_error(&mut turn_error, "Codex CLI turn failed.");

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

    fn write_minimal_direct_provider_authority_fixture(file_name: &str) -> std::path::PathBuf {
        let path = write_empty_sqlite_provider_authority_fixture(file_name);
        let connection =
            Connection::open(&path).expect("open minimal direct sqlite provider fixture");
        connection
            .execute_batch(
                r#"
                DROP TABLE project_collaborators;
                DROP TABLE workspace_members;
                DROP TABLE team_members;
                DROP TABLE teams;
                DROP TABLE projects;
                DROP TABLE workspaces;

                CREATE TABLE workspaces (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    name TEXT NOT NULL,
                    description TEXT NULL,
                    owner_id TEXT NULL,
                    leader_id TEXT NULL,
                    created_by_user_id TEXT NULL,
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
                    user_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    created_by_user_id TEXT NULL,
                    granted_by_user_id TEXT NULL,
                    status TEXT NOT NULL
                );

                CREATE TABLE workspace_members (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    workspace_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    team_id TEXT NULL,
                    role TEXT NOT NULL,
                    created_by_user_id TEXT NULL,
                    granted_by_user_id TEXT NULL,
                    status TEXT NOT NULL
                );

                CREATE TABLE project_collaborators (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    version INTEGER NOT NULL DEFAULT 0,
                    is_deleted INTEGER NOT NULL DEFAULT 0,
                    project_id TEXT NOT NULL,
                    workspace_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    team_id TEXT NULL,
                    role TEXT NOT NULL,
                    created_by_user_id TEXT NULL,
                    granted_by_user_id TEXT NULL,
                    status TEXT NOT NULL
                );
                "#,
            )
            .expect("rewrite minimal direct provider authority schema");
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
            .execute_batch(SQLITE_PROVIDER_AUTHORITY_SCHEMA)
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
                    id, created_at, updated_at, version, is_deleted, name, description, owner_id, leader_id, created_by_user_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    "workspace-provider",
                    "2026-04-10T13:00:00Z",
                    "2026-04-10T13:00:00Z",
                    0_i64,
                    0_i64,
                    "Provider authority workspace",
                    "Provider-backed app workspace list item",
                    "user-provider-owner",
                    "user-provider-owner",
                    "user-provider-owner",
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
                    id, created_at, updated_at, version, is_deleted, team_id, user_id, role, created_by_user_id, granted_by_user_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    "member-provider-admin",
                    "2026-04-10T13:00:00Z",
                    "2026-04-10T13:00:00Z",
                    0_i64,
                    0_i64,
                    "team-provider",
                    "user-provider-admin",
                    "admin",
                    "user-provider-admin",
                    "user-provider-admin",
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
        let json: serde_json::Value = serde_json::from_slice(&body).expect("parse health response");

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
        assert_eq!(
            json["data"]["openApiPath"],
            "/openapi/coding-server-v1.json"
        );
        assert_eq!(
            json["data"]["surfaces"],
            serde_json::json!(["core", "app", "admin"])
        );
        assert_eq!(
            json["data"]["gateway"]["basePath"],
            CODING_SERVER_GATEWAY_BASE_PATH
        );
        assert_eq!(
            json["data"]["gateway"]["routeCatalogPath"],
            CODING_SERVER_ROUTE_CATALOG_PATH
        );
        assert_eq!(json["data"]["gateway"]["routeCount"], 57);
        assert_eq!(json["data"]["gateway"]["routesBySurface"]["core"], 19);
        assert_eq!(json["data"]["gateway"]["routesBySurface"]["app"], 31);
        assert_eq!(json["data"]["gateway"]["routesBySurface"]["admin"], 7);
    }

    #[tokio::test]
    async fn route_catalog_route_returns_unified_operation_catalog() {
        let response = build_app()
            .oneshot(
                Request::builder()
                    .uri(CODING_SERVER_ROUTE_CATALOG_PATH)
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
            serde_json::from_slice(&body).expect("parse route catalog response");

        assert_eq!(json["items"].as_array().map(|items| items.len()), Some(56));
        assert_eq!(json["meta"]["total"], 56);
        assert_eq!(json["meta"]["version"], CODING_SERVER_API_VERSION);
        assert_eq!(
            json["items"]
                .as_array()
                .expect("route catalog items")
                .iter()
                .any(|item| item["operationId"] == "core.listRoutes"
                    && item["openApiPath"] == "/api/core/v1/routes"
                    && item["surface"] == "core"),
            true
        );
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
            serde_json::from_slice(&admin_team_members_body).expect("parse team members response");

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
            app_workspaces_json["items"][0]["ownerId"],
            "user-demo-owner"
        );
        assert_eq!(app_workspaces_json["items"][0]["status"], "active");
        assert_eq!(app_deployments_json["items"][0]["id"], "deployment-demo");
        assert_eq!(
            app_deployments_json["items"][0]["projectId"],
            "demo-project"
        );
        assert_eq!(
            app_deployments_json["items"][0]["targetId"],
            "target-demo-web"
        );
        assert_eq!(app_deployments_json["items"][0]["status"], "succeeded");
        assert_eq!(admin_deployments_json["items"][0]["id"], "deployment-demo");
        assert_eq!(
            admin_deployments_json["items"][0]["projectId"],
            "demo-project"
        );
        assert_eq!(
            admin_deployments_json["items"][0]["targetId"],
            "target-demo-web"
        );
        assert_eq!(admin_deployments_json["items"][0]["status"], "succeeded");
        assert_eq!(
            app_documents_json["items"][0]["id"],
            "doc-architecture-demo"
        );
        assert_eq!(app_documents_json["items"][0]["projectId"], "demo-project");
        assert_eq!(
            app_documents_json["items"][0]["documentKind"],
            "architecture"
        );
        assert_eq!(app_projects_json["items"][0]["id"], "demo-project");
        assert_eq!(
            app_projects_json["items"][0]["workspaceId"],
            "demo-workspace"
        );
        assert_eq!(app_teams_json["items"][0]["id"], "demo-team");
        assert_eq!(app_teams_json["items"][0]["workspaceId"], "demo-workspace");
        assert_eq!(admin_teams_json["items"][0]["id"], "demo-team");
        assert_eq!(
            admin_teams_json["items"][0]["workspaceId"],
            "demo-workspace"
        );
        assert_eq!(
            admin_deployment_targets_json["items"][0]["id"],
            "target-demo-web"
        );
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
        assert_eq!(
            admin_releases_json["items"][0]["releaseVersion"],
            "0.1.0-demo"
        );
        assert_eq!(admin_audit_json["items"][0]["id"], "audit-demo-release");
        assert_eq!(admin_audit_json["items"][0]["scopeType"], "workspace");
        assert_eq!(admin_audit_json["items"][0]["scopeId"], "demo-workspace");
        assert_eq!(
            admin_audit_json["items"][0]["eventType"],
            "release.promoted"
        );
        assert_eq!(
            admin_policies_json["items"][0]["id"],
            "policy-demo-terminal"
        );
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
        let json: serde_json::Value = serde_json::from_slice(&body).expect("parse list response");

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
            let capabilities_json: serde_json::Value =
                serde_json::from_slice(&capabilities_body).expect("parse capabilities response");

            assert_eq!(capabilities_json["data"], engine["capabilityMatrix"]);
            assert_eq!(
                capabilities_json["meta"]["version"],
                CODING_SERVER_API_VERSION
            );
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
        assert_eq!(
            checkpoints_json["meta"]["version"],
            CODING_SERVER_API_VERSION
        );
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
                params![create_json["data"]["id"]
                    .as_str()
                    .expect("created session id")],
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
        let create_json: serde_json::Value = serde_json::from_slice(&create_body)
            .expect("parse create coding session turn response");

        let created_turn_id = create_json["data"]["id"]
            .as_str()
            .expect("created turn id")
            .to_owned();
        let created_operation_id = format!("{created_turn_id}:operation");

        assert!(created_turn_id.starts_with("coding-turn-"));
        assert_eq!(
            create_json["data"]["codingSessionId"],
            "demo-coding-session"
        );
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
        assert_eq!(
            operation_json["data"]["artifactRefs"],
            serde_json::json!([])
        );

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
        assert_eq!(created_events.len(), 5);
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
        assert_eq!(created_events[1]["payload"]["role"], "user");
        assert_eq!(
            created_events[1]["payload"]["content"],
            "Implement terminal command palette"
        );
        assert_eq!(
            created_events[2]["payload"]["content"],
            "Codex CLI executed for the demo create-turn route."
        );
        assert_eq!(created_events[2]["kind"], "message.completed");
        assert_eq!(created_events[2]["payload"]["role"], "assistant");
        assert_eq!(created_events[3]["kind"], "operation.updated");
        assert_eq!(created_events[3]["payload"]["status"], "succeeded");
        assert_eq!(created_events[4]["kind"], "turn.completed");
        assert_eq!(created_events[4]["payload"]["finishReason"], "stop");
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
        let create_json: serde_json::Value = serde_json::from_slice(&create_body)
            .expect("parse create coding session turn response");
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

        assert_eq!(created_events[2]["kind"], "message.completed");
        assert_eq!(
            created_events[2]["payload"]["content"],
            "Codex CLI executed from the local server bridge."
        );
        assert_ne!(
            created_events[2]["payload"]["content"],
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
        assert_eq!(
            approval_json["data"]["codingSessionId"],
            "demo-coding-session"
        );
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
        let checkpoints_json: serde_json::Value =
            serde_json::from_slice(&checkpoints_body).expect("parse checkpoints response");

        assert_eq!(checkpoints_json["items"][0]["resumable"], false);
        assert_eq!(
            checkpoints_json["items"][0]["state"]["approvalId"],
            "demo-approval-1"
        );
        assert_eq!(
            checkpoints_json["items"][0]["state"]["decision"],
            "approved"
        );
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
        assert_eq!(
            events_json["items"][3]["payload"]["approvalDecision"],
            "approved"
        );
        assert_eq!(
            events_json["items"][3]["payload"]["runtimeStatus"],
            "awaiting_tool"
        );
        assert_eq!(
            events_json["items"][3]["payload"]["operationStatus"],
            "running"
        );

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
        let operation_json: serde_json::Value =
            serde_json::from_slice(&operation_body).expect("parse operation response");

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
        assert_eq!(
            approval_json["data"]["checkpointId"],
            "provider-checkpoint:1"
        );
        assert_eq!(approval_json["data"]["runtimeId"], "provider-runtime");
        assert_eq!(approval_json["data"]["turnId"], "provider-turn");
        assert_eq!(
            approval_json["data"]["operationId"],
            "provider-turn:operation"
        );
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
            serde_json::from_str(&persisted_checkpoint.1)
                .expect("parse persisted checkpoint state");

        assert_eq!(persisted_checkpoint.0, 0);
        assert_eq!(
            persisted_checkpoint_state["approvalId"],
            "provider-approval-1"
        );
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
    async fn build_app_loads_projection_state_from_direct_sqlite_provider_tables_when_configured() {
        async fn issue_get_request(
            app: &Router,
            uri: &str,
        ) -> axum::response::Response {
            app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri(uri)
                        .body(Body::empty())
                        .expect("build request"),
                )
                .await
                .expect("serve request")
        }

        let _guard = ENV_LOCK.lock().expect("lock env");
        let sqlite_path =
            write_sqlite_provider_authority_fixture("birdcoder-coding-server-provider.sqlite3");

        std::env::set_var(
            "BIRDCODER_CODING_SERVER_SQLITE_FILE",
            sqlite_path.as_os_str(),
        );
        let app = build_app_from_env().expect("load env app");

        let operation_response =
            issue_get_request(&app, "/api/core/v1/operations/provider-turn:operation").await;
        let session_response =
            issue_get_request(&app, "/api/core/v1/coding-sessions/provider-session").await;
        let events_response =
            issue_get_request(&app, "/api/core/v1/coding-sessions/provider-session/events")
                .await;
        let checkpoints_response =
            issue_get_request(&app, "/api/core/v1/coding-sessions/provider-session/checkpoints")
                .await;
        let app_workspaces_response =
            issue_get_request(&app, "/api/app/v1/workspaces").await;
        let app_deployments_response =
            issue_get_request(&app, "/api/app/v1/deployments").await;
        let admin_deployments_response =
            issue_get_request(&app, "/api/admin/v1/deployments").await;
        let app_projects_response =
            issue_get_request(&app, "/api/app/v1/projects").await;
        let app_documents_response =
            issue_get_request(&app, "/api/app/v1/documents").await;
        let app_teams_response = issue_get_request(&app, "/api/app/v1/teams").await;
        let admin_teams_response =
            issue_get_request(&app, "/api/admin/v1/teams").await;
        let admin_deployment_targets_response = issue_get_request(
            &app,
            "/api/admin/v1/projects/project-provider/deployment-targets",
        )
        .await;
        let admin_team_members_response =
            issue_get_request(&app, "/api/admin/v1/teams/team-provider/members").await;
        let admin_releases_response =
            issue_get_request(&app, "/api/admin/v1/releases").await;
        let admin_audit_response = issue_get_request(&app, "/api/admin/v1/audit").await;
        let admin_policies_response =
            issue_get_request(&app, "/api/admin/v1/policies").await;

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
            serde_json::from_slice(&admin_team_members_body).expect("parse team members response");

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

        assert_eq!(
            operation_json["data"]["operationId"],
            "provider-turn:operation"
        );
        assert_eq!(session_json["data"]["id"], "provider-session");
        assert_eq!(session_json["data"]["hostMode"], "server");
        assert_eq!(
            events_json["items"][0]["id"],
            "provider-runtime:provider-turn:event:0"
        );
        assert_eq!(checkpoints_json["items"][0]["id"], "provider-checkpoint:1");
        assert_eq!(app_workspaces_json["items"][0]["id"], "workspace-provider");
        assert_eq!(
            app_workspaces_json["items"][0]["name"],
            "Provider authority workspace"
        );
        assert_eq!(
            app_workspaces_json["items"][0]["ownerId"],
            "user-provider-owner"
        );
        assert_eq!(
            app_deployments_json["items"][0]["id"],
            "deployment-provider"
        );
        assert_eq!(
            app_deployments_json["items"][0]["projectId"],
            "project-provider"
        );
        assert_eq!(
            app_deployments_json["items"][0]["targetId"],
            "target-provider-web"
        );
        assert_eq!(
            admin_deployments_json["items"][0]["id"],
            "deployment-provider"
        );
        assert_eq!(
            admin_deployments_json["items"][0]["projectId"],
            "project-provider"
        );
        assert_eq!(
            admin_deployments_json["items"][0]["targetId"],
            "target-provider-web"
        );
        assert_eq!(app_projects_json["items"][0]["id"], "project-provider");
        assert_eq!(
            app_documents_json["items"][0]["id"],
            "doc-provider-architecture"
        );
        assert_eq!(
            app_documents_json["items"][0]["projectId"],
            "project-provider"
        );
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
        assert_eq!(
            admin_team_members_json["items"][0]["teamId"],
            "team-provider"
        );
        assert_eq!(admin_team_members_json["items"][0]["role"], "admin");
        assert_eq!(
            admin_releases_json["items"][0]["id"],
            "release-0.3.0-provider"
        );
        assert_eq!(admin_audit_json["items"][0]["id"], "audit-provider-release");
        assert_eq!(
            admin_audit_json["items"][0]["scopeId"],
            "workspace-provider"
        );
        assert_eq!(
            admin_policies_json["items"][0]["id"],
            "policy-provider-terminal"
        );
        assert_eq!(
            admin_policies_json["items"][0]["approvalPolicy"],
            "OnRequest"
        );
        assert_eq!(admin_policies_json["items"][0]["targetId"], "claude-code");
    }

    #[tokio::test]
    async fn core_sessions_route_returns_unified_provider_and_native_sessions_for_project_scope() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let fake_codex_home = FakeCodexHomeGuard::install(
            "birdcoder-coding-sessions-unified",
            "019d-native-provider-session",
            "Implement unified session authority",
            "I will verify provider and native session parity.",
        );
        let sqlite_path =
            write_sqlite_provider_authority_fixture("birdcoder-coding-sessions-unified.sqlite3");
        attach_fake_codex_session_to_provider_fixture(
            &sqlite_path,
            &fake_codex_home,
            "native-provider-session",
        );
        let state = AppState::load(&AuthorityBootstrapConfig {
            sqlite_file: Some(sqlite_path.clone()),
            snapshot_file: None,
        })
        .expect("load provider-backed app state");
        let app = build_app_with_state(state);

        let scoped_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions?workspaceId=workspace-provider&projectId=project-provider")
                    .body(Body::empty())
                    .expect("build scoped list coding sessions request"),
            )
            .await
            .expect("serve scoped list coding sessions request");
        assert_eq!(scoped_response.status(), StatusCode::OK);

        let scoped_body = to_bytes(scoped_response.into_body(), usize::MAX)
            .await
            .expect("read scoped list coding sessions body");
        let scoped_json: serde_json::Value = serde_json::from_slice(&scoped_body)
            .expect("parse scoped list coding sessions response");
        let scoped_items = scoped_json["items"]
            .as_array()
            .expect("scoped list coding sessions items");

        let provider_session = scoped_items
            .iter()
            .find(|item| item["id"] == "provider-session")
            .expect("provider-backed session is present");
        let native_session = scoped_items
            .iter()
            .find(|item| item["id"] == "codex-native:019d-native-provider-session")
            .expect("native session is present");

        assert_eq!(scoped_items.len(), 2);
        assert_eq!(scoped_json["meta"]["total"], 2);
        assert_eq!(provider_session["workspaceId"], "workspace-provider");
        assert_eq!(provider_session["projectId"], "project-provider");
        assert_eq!(native_session["workspaceId"], "workspace-provider");
        assert_eq!(native_session["projectId"], "project-provider");
        assert_eq!(native_session["engineId"], "codex");
        assert_eq!(
            native_session["title"],
            "Implement unified session authority"
        );

        let empty_response = app
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions?projectId=missing-project")
                    .body(Body::empty())
                    .expect("build empty list coding sessions request"),
            )
            .await
            .expect("serve empty list coding sessions request");
        assert_eq!(empty_response.status(), StatusCode::OK);

        let empty_body = to_bytes(empty_response.into_body(), usize::MAX)
            .await
            .expect("read empty list coding sessions body");
        let empty_json: serde_json::Value =
            serde_json::from_slice(&empty_body).expect("parse empty list coding sessions response");
        let empty_items = empty_json["items"]
            .as_array()
            .expect("empty list coding sessions items");

        assert_eq!(empty_items.is_empty(), true);
        assert_eq!(empty_json["meta"]["total"], 0);

        fs::remove_file(sqlite_path).expect("remove unified coding sessions sqlite fixture");
    }

    #[tokio::test]
    async fn core_sessions_route_collapses_attached_native_session_into_projection_session() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let fake_codex_home = FakeCodexHomeGuard::install(
            "birdcoder-coding-sessions-attached",
            "019d-attached-provider-session",
            "Implement standard attached native session hydration",
            "Native transcript assistant response.",
        );
        let sqlite_path =
            write_sqlite_provider_authority_fixture("birdcoder-coding-sessions-attached.sqlite3");
        attach_fake_codex_session_to_provider_fixture(
            &sqlite_path,
            &fake_codex_home,
            "019d-attached-provider-session",
        );
        let state = AppState::load(&AuthorityBootstrapConfig {
            sqlite_file: Some(sqlite_path.clone()),
            snapshot_file: None,
        })
        .expect("load provider-backed app state");
        let app = build_app_with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions?workspaceId=workspace-provider&projectId=project-provider")
                    .body(Body::empty())
                    .expect("build attached list coding sessions request"),
            )
            .await
            .expect("serve attached list coding sessions request");
        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read attached list coding sessions body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("parse attached list coding sessions response");
        let items = json["items"]
            .as_array()
            .expect("attached list coding sessions items");

        assert_eq!(items.len(), 1);
        assert_eq!(json["meta"]["total"], 1);
        assert_eq!(items[0]["id"], "provider-session");
        assert_eq!(
            items[0]["title"],
            "Implement standard attached native session hydration"
        );
        assert_eq!(items[0]["hostMode"], "desktop");
        assert_eq!(items[0]["workspaceId"], "workspace-provider");
        assert_eq!(items[0]["projectId"], "project-provider");

        fs::remove_file(sqlite_path).expect("remove attached coding sessions sqlite fixture");
    }

    #[tokio::test]
    async fn core_session_events_route_reads_native_transcript_for_attached_projection_session() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let fake_codex_home = FakeCodexHomeGuard::install(
            "birdcoder-coding-session-events-attached",
            "019d-attached-provider-events",
            "Read native transcript for attached projection session",
            "Attached native assistant response.",
        );
        let sqlite_path = write_sqlite_provider_authority_fixture(
            "birdcoder-coding-session-events-attached.sqlite3",
        );
        attach_fake_codex_session_to_provider_fixture(
            &sqlite_path,
            &fake_codex_home,
            "019d-attached-provider-events",
        );
        let state = AppState::load(&AuthorityBootstrapConfig {
            sqlite_file: Some(sqlite_path.clone()),
            snapshot_file: None,
        })
        .expect("load provider-backed app state");
        let app = build_app_with_state(state);

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/coding-sessions/provider-session/events")
                    .body(Body::empty())
                    .expect("build attached session events request"),
            )
            .await
            .expect("serve attached session events request");
        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read attached session events body");
        let json: serde_json::Value =
            serde_json::from_slice(&body).expect("parse attached session events response");
        let items = json["items"]
            .as_array()
            .expect("attached session events items");

        assert_eq!(items.len(), 3);
        assert_eq!(items[0]["kind"], "turn.completed");
        assert_eq!(items[1]["kind"], "message.completed");
        assert_eq!(items[1]["payload"]["role"], "user");
        assert_eq!(
            items[1]["payload"]["content"],
            "Read native transcript for attached projection session"
        );
        assert_eq!(items[2]["kind"], "message.completed");
        assert_eq!(items[2]["payload"]["role"], "assistant");
        assert_eq!(
            items[2]["payload"]["content"],
            "Attached native assistant response."
        );
        assert_eq!(items[2]["codingSessionId"], "provider-session");

        fs::remove_file(sqlite_path).expect("remove attached session events sqlite fixture");
    }

    #[tokio::test]
    async fn build_app_from_sqlite_file_reads_live_workspace_and_project_authority_from_sqlite() {
        let sqlite_path =
            write_sqlite_provider_authority_fixture("birdcoder-coding-server-live.sqlite3");
        let app = build_app_from_sqlite_file(&sqlite_path).expect("load sqlite file app");

        let connection =
            Connection::open(&sqlite_path).expect("open sqlite live authority fixture");
        connection
            .execute(
                r#"
                INSERT INTO workspaces (
                    id, created_at, updated_at, version, is_deleted, name, description, owner_id, leader_id, created_by_user_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    "workspace-live",
                    "2026-04-10T13:10:00Z",
                    "2026-04-10T13:10:00Z",
                    0_i64,
                    0_i64,
                    "Live authority workspace",
                    "Workspace inserted after router bootstrap",
                    "user-live-owner",
                    "user-live-owner",
                    "user-live-owner",
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
    async fn build_app_from_sqlite_file_bootstraps_default_workspace_without_creating_default_project(
    ) {
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
        assert_eq!(persisted_project_count, 0);
        assert_eq!(workspaces_json["items"][0]["id"], "workspace-default");
        assert_eq!(workspaces_json["items"][0]["name"], "Default Workspace");
        assert_eq!(projects_json["items"], serde_json::json!([]));
    }

    #[tokio::test]
    async fn build_app_from_sqlite_file_preserves_existing_workspace_without_bootstrapping_projects(
    ) {
        let sqlite_path = write_empty_sqlite_provider_authority_fixture(
            "birdcoder-coding-server-bootstrap-project.sqlite3",
        );
        let connection =
            Connection::open(&sqlite_path).expect("open sqlite bootstrap project fixture");
        connection
            .execute(
                r#"
                INSERT INTO workspaces (
                    id, created_at, updated_at, version, is_deleted, name, description, owner_id, leader_id, created_by_user_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    "workspace-existing",
                    "2026-04-15T18:30:00Z",
                    "2026-04-15T18:30:00Z",
                    0_i64,
                    0_i64,
                    "Existing Workspace",
                    "Pre-existing local workspace",
                    "user-existing",
                    "user-existing",
                    "user-existing",
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
        let persisted_project_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM projects WHERE is_deleted = 0",
                [],
                |row| row.get(0),
            )
            .expect("read persisted project count");
        drop(connection);
        fs::remove_file(sqlite_path).expect("remove sqlite bootstrap fixture");

        let projects_body = to_bytes(projects_response.into_body(), usize::MAX)
            .await
            .expect("read projects body");
        let projects_json: serde_json::Value =
            serde_json::from_slice(&projects_body).expect("parse projects response");

        assert_eq!(persisted_workspace_count, 1);
        assert_eq!(persisted_project_count, 0);
        assert_eq!(projects_json["items"], serde_json::json!([]));
    }

    #[tokio::test]
    async fn build_app_from_sqlite_file_hides_projects_without_absolute_root_path_from_app_catalog()
    {
        let sqlite_path = write_empty_sqlite_provider_authority_fixture(
            "birdcoder-coding-server-invalid-project-catalog.sqlite3",
        );
        let connection =
            Connection::open(&sqlite_path).expect("open sqlite invalid project fixture");
        connection
            .execute(
                r#"
                INSERT INTO workspaces (
                    id, created_at, updated_at, version, is_deleted, name, description, owner_id, leader_id, created_by_user_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    "workspace-existing",
                    "2026-04-15T18:30:00Z",
                    "2026-04-15T18:30:00Z",
                    0_i64,
                    0_i64,
                    "Existing Workspace",
                    "Pre-existing local workspace",
                    "user-existing",
                    "user-existing",
                    "user-existing",
                    "active",
                ],
            )
            .expect("insert existing workspace");
        connection
            .execute(
                r#"
                INSERT INTO projects (
                    id, created_at, updated_at, version, is_deleted, workspace_id, name, description, root_path, owner_id, leader_id, created_by_user_id, author, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
                "#,
                params![
                    "project-invalid-root",
                    "2026-04-15T18:31:00Z",
                    "2026-04-15T18:31:00Z",
                    0_i64,
                    0_i64,
                    "workspace-existing",
                    "Invalid Root Project",
                    "Project persisted before root path validation was enforced",
                    "relative/project",
                    "user-existing",
                    "user-existing",
                    "user-existing",
                    "user-existing",
                    "active",
                ],
            )
            .expect("insert invalid root project");
        drop(connection);

        let app = build_app_from_sqlite_file(&sqlite_path).expect("load sqlite invalid project app");
        let projects_response = app
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/projects")
                    .body(Body::empty())
                    .expect("build projects request"),
            )
            .await
            .expect("serve projects request");

        fs::remove_file(sqlite_path).expect("remove sqlite invalid project fixture");

        let projects_body = to_bytes(projects_response.into_body(), usize::MAX)
            .await
            .expect("read projects body");
        let projects_json: serde_json::Value =
            serde_json::from_slice(&projects_body).expect("parse projects response");

        assert_eq!(projects_json["items"], serde_json::json!([]));
    }

    #[tokio::test]
    async fn build_app_from_sqlite_file_archives_legacy_bootstrap_project_rows() {
        let sqlite_path = write_empty_sqlite_provider_authority_fixture(
            "birdcoder-coding-server-bootstrap-project-restore.sqlite3",
        );
        let connection =
            Connection::open(&sqlite_path).expect("open sqlite bootstrap restore fixture");
        connection
            .execute(
                r#"
                CREATE UNIQUE INDEX IF NOT EXISTS uk_projects_workspace_name
                ON projects(workspace_id, name)
                "#,
                [],
            )
            .expect("create desktop-style project workspace name index");
        connection
            .execute(
                r#"
                INSERT INTO workspaces (
                    id, created_at, updated_at, version, is_deleted, name, description, owner_id, leader_id, created_by_user_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
                "#,
                params![
                    "workspace-existing",
                    "2026-04-15T18:30:00Z",
                    "2026-04-15T18:30:00Z",
                    0_i64,
                    0_i64,
                    "Existing Workspace",
                    "Pre-existing local workspace",
                    "user-existing",
                    "user-existing",
                    "user-existing",
                    "active",
                ],
            )
            .expect("insert existing workspace");
        connection
            .execute(
                r#"
                INSERT INTO projects (
                    id, created_at, updated_at, version, is_deleted, workspace_id, name, description, root_path, owner_id, leader_id, created_by_user_id, author, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
                "#,
                params![
                    BOOTSTRAP_PROJECT_ID,
                    "2026-04-15T18:31:00Z",
                    "2026-04-15T18:31:00Z",
                    0_i64,
                    1_i64,
                    "workspace-existing",
                    BOOTSTRAP_PROJECT_NAME,
                    "Soft-deleted starter project",
                    Option::<String>::None,
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                    BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                    "archived",
                ],
            )
            .expect("insert soft-deleted starter project");
        connection
            .execute(
                r#"
                INSERT INTO project_collaborators (
                    id, created_at, updated_at, version, is_deleted, project_id, workspace_id, user_id, team_id, role,
                    created_by_user_id, granted_by_user_id, status
                )
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
                "#,
                params![
                    "project-collaborator-default-owner",
                    "2026-04-15T18:31:00Z",
                    "2026-04-15T18:31:00Z",
                    0_i64,
                    1_i64,
                    BOOTSTRAP_PROJECT_ID,
                    "workspace-existing",
                    BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                    "team-default",
                    "owner",
                    BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                    BOOTSTRAP_WORKSPACE_OWNER_USER_ID,
                    "archived",
                ],
            )
            .expect("insert soft-deleted starter collaborator");
        drop(connection);

        let app = build_app_from_sqlite_file(&sqlite_path).expect("load sqlite bootstrap app");
        let projects_response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/projects")
                    .body(Body::empty())
                    .expect("build projects request"),
            )
            .await
            .expect("serve projects request");
        let collaborators_response = app
            .oneshot(
                Request::builder()
                    .uri("/api/app/v1/projects/project-default/collaborators")
                    .body(Body::empty())
                    .expect("build project collaborators request"),
            )
            .await
            .expect("serve project collaborators request");
        let collaborators_status = collaborators_response.status();

        let connection = Connection::open(&sqlite_path).expect("open sqlite bootstrap fixture");
        let persisted_project_row: (String, String, i64, String) = connection
            .query_row(
                "SELECT id, workspace_id, is_deleted, status FROM projects WHERE id = ?1",
                params![BOOTSTRAP_PROJECT_ID],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .expect("read archived starter project");
        let persisted_collaborator_row: (String, i64, String) = connection
            .query_row(
                "SELECT id, is_deleted, status FROM project_collaborators WHERE id = ?1",
                params!["project-collaborator-default-owner"],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("read archived starter collaborator");
        drop(connection);
        fs::remove_file(sqlite_path).expect("remove sqlite bootstrap fixture");

        let projects_body = to_bytes(projects_response.into_body(), usize::MAX)
            .await
            .expect("read projects body");
        let projects_json: serde_json::Value =
            serde_json::from_slice(&projects_body).expect("parse projects response");
        assert_eq!(persisted_project_row.0, "project-default");
        assert_eq!(persisted_project_row.1, "workspace-existing");
        assert_eq!(persisted_project_row.2, 1);
        assert_eq!(persisted_project_row.3, "archived");
        assert_eq!(
            persisted_collaborator_row.0,
            "project-collaborator-default-owner"
        );
        assert_eq!(persisted_collaborator_row.1, 1);
        assert_eq!(persisted_collaborator_row.2, "archived");
        assert_eq!(projects_json["items"], serde_json::json!([]));
        assert_eq!(collaborators_status, StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn build_app_from_sqlite_file_upgrades_minimal_direct_provider_schema_before_bootstrap_writes(
    ) {
        let sqlite_path = write_minimal_direct_provider_authority_fixture(
            "birdcoder-coding-server-minimal-direct.sqlite3",
        );
        let app =
            build_app_from_sqlite_file(&sqlite_path).expect("load minimal direct sqlite authority");

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

        let connection =
            Connection::open(&sqlite_path).expect("open minimal direct sqlite fixture");

        assert!(
            sqlite_column_exists(&connection, PROVIDER_WORKSPACES_TABLE, "created_by_user_id")
                .expect("probe workspaces.created_by_user_id"),
            "workspaces table should expose created_by_user_id"
        );
        assert!(
            sqlite_column_exists(&connection, PROVIDER_PROJECTS_TABLE, "owner_id")
                .expect("probe projects.owner_id"),
            "projects table should expose owner_id"
        );
        assert!(
            sqlite_column_exists(&connection, PROVIDER_PROJECTS_TABLE, "created_by_user_id")
                .expect("probe projects.created_by_user_id"),
            "projects table should expose created_by_user_id"
        );
        assert!(
            sqlite_column_exists(&connection, PROVIDER_TEAMS_TABLE, "owner_id")
                .expect("probe teams.owner_id"),
            "teams table should expose owner_id"
        );
        assert!(
            sqlite_column_exists(&connection, PROVIDER_TEAMS_TABLE, "created_by_user_id")
                .expect("probe teams.created_by_user_id"),
            "teams table should expose created_by_user_id"
        );
        assert!(
            sqlite_column_exists(
                &connection,
                PROVIDER_TEAM_MEMBERS_TABLE,
                "created_by_user_id"
            )
            .expect("probe team_members.created_by_user_id"),
            "team_members table should expose created_by_user_id"
        );
        assert!(
            sqlite_column_exists(
                &connection,
                PROVIDER_TEAM_MEMBERS_TABLE,
                "granted_by_user_id"
            )
            .expect("probe team_members.granted_by_user_id"),
            "team_members table should expose granted_by_user_id"
        );
        assert!(
            sqlite_column_exists(&connection, "workspace_members", "created_by_user_id")
                .expect("probe workspace_members.created_by_user_id"),
            "workspace_members table should expose created_by_user_id"
        );
        assert!(
            sqlite_column_exists(&connection, "workspace_members", "granted_by_user_id")
                .expect("probe workspace_members.granted_by_user_id"),
            "workspace_members table should expose granted_by_user_id"
        );
        assert!(
            sqlite_column_exists(&connection, "project_collaborators", "created_by_user_id")
                .expect("probe project_collaborators.created_by_user_id"),
            "project_collaborators table should expose created_by_user_id"
        );
        assert!(
            sqlite_column_exists(&connection, "project_collaborators", "granted_by_user_id")
                .expect("probe project_collaborators.granted_by_user_id"),
            "project_collaborators table should expose granted_by_user_id"
        );

        let workspace_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM workspaces WHERE is_deleted = 0",
                [],
                |row| row.get(0),
            )
            .expect("read upgraded workspace count");
        let project_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM projects WHERE is_deleted = 0",
                [],
                |row| row.get(0),
            )
            .expect("read upgraded project count");

        drop(connection);
        fs::remove_file(&sqlite_path).expect("remove minimal direct sqlite fixture");

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

        assert_eq!(workspace_count, 1);
        assert_eq!(project_count, 0);
        assert_eq!(workspaces_json["items"][0]["id"], "workspace-default");
        assert_eq!(projects_json["items"], serde_json::json!([]));
    }

    #[tokio::test]
    async fn build_app_from_sqlite_file_initializes_user_center_for_direct_provider_authority() {
        let sqlite_path = write_empty_sqlite_provider_authority_fixture(
            "birdcoder-coding-server-direct-user-center.sqlite3",
        );

        let _ = build_app_from_sqlite_file(&sqlite_path).expect("load direct sqlite authority");

        let connection = Connection::open(&sqlite_path).expect("open direct sqlite authority");
        let user_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM plus_user WHERE is_deleted = 0",
                [],
                |row| row.get(0),
            )
            .expect("read bootstrap user count");
        let profile_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM plus_user WHERE is_deleted = 0 AND bio IS NOT NULL AND TRIM(bio) <> ''",
                [],
                |row| row.get(0),
            )
            .expect("read bootstrap profile count");
        let membership_count: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM plus_vip_user WHERE is_deleted = 0",
                [],
                |row| row.get(0),
            )
            .expect("read bootstrap membership count");
        let bootstrap_user: (String, String, String) = connection
            .query_row(
                "SELECT id, email, provider_key FROM plus_user WHERE id = ?1",
                params![BOOTSTRAP_WORKSPACE_OWNER_USER_ID],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("read bootstrap user");

        drop(connection);
        fs::remove_file(sqlite_path).expect("remove direct sqlite authority fixture");

        assert_eq!(user_count, 1);
        assert_eq!(profile_count, 1);
        assert_eq!(membership_count, 1);
        assert_eq!(bootstrap_user.0, BOOTSTRAP_WORKSPACE_OWNER_USER_ID);
        assert_eq!(bootstrap_user.1, "local-default@sdkwork-birdcoder.local");
        assert_eq!(bootstrap_user.2, "local");
    }

    #[tokio::test]
    async fn build_app_loads_projection_state_from_default_runtime_config_file_when_present() {
        let _guard = ENV_LOCK.lock().expect("lock env");
        let sqlite_path =
            write_sqlite_provider_authority_fixture("birdcoder-coding-server-config.sqlite3");
        let config_path = write_runtime_config_fixture(&sqlite_path);

        std::env::remove_var("BIRDCODER_CODING_SERVER_SQLITE_FILE");
        std::env::remove_var("BIRDCODER_CODING_SERVER_SNAPSHOT_FILE");

        let response = build_app_from_env()
            .expect("load config app")
            .oneshot(
                Request::builder()
                    .uri("/api/core/v1/operations/provider-turn:operation")
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

        assert_eq!(json["data"]["operationId"], "provider-turn:operation");
    }

    #[test]
    fn build_app_from_env_returns_error_when_sqlite_authority_has_no_direct_tables() {
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

        assert_eq!(json["servers"][0]["url"], "/");
        assert_eq!(
            json["x-sdkwork-api-gateway"]["liveOpenApiPath"],
            CODING_SERVER_LIVE_OPENAPI_PATH
        );
        assert_eq!(
            json["x-sdkwork-api-gateway"]["docsPath"],
            CODING_SERVER_DOCS_PATH
        );
        assert_eq!(
            json["x-sdkwork-api-gateway"]["routeCatalogPath"],
            CODING_SERVER_ROUTE_CATALOG_PATH
        );
        assert_eq!(json["x-sdkwork-api-gateway"]["routeCount"], 57);
        assert_eq!(json["x-sdkwork-api-gateway"]["routesBySurface"]["core"], 19);
        assert_eq!(json["x-sdkwork-api-gateway"]["routesBySurface"]["app"], 31);
        assert_eq!(json["x-sdkwork-api-gateway"]["routesBySurface"]["admin"], 7);
        assert_eq!(
            json["paths"]["/api/core/v1/native-session-providers"]["get"]["operationId"],
            "core.listNativeSessionProviders"
        );
        assert_eq!(
            json["paths"]["/api/core/v1/coding-sessions"]["get"]["operationId"],
            "core.listCodingSessions"
        );
        assert_eq!(
            json["paths"]["/api/core/v1/routes"]["get"]["operationId"],
            "core.listRoutes"
        );
        assert_eq!(
            json["paths"]["/api/core/v1/coding-sessions/{id}/events"]["get"]["operationId"],
            "core.listCodingSessionEvents"
        );
        assert_eq!(
            json["paths"]["/api/app/v1/workspaces"]["get"]["operationId"],
            "app.listWorkspaces"
        );
        assert_eq!(
            json["paths"]["/api/admin/v1/teams/{teamId}/members"]["get"]["operationId"],
            "admin.listTeamMembers"
        );
        assert_eq!(
            json["paths"]["/api/admin/v1/projects/{projectId}/deployment-targets"]["get"]
                ["operationId"],
            "admin.listDeploymentTargets"
        );
        assert_eq!(
            json["paths"]["/api/admin/v1/releases"]["get"]["operationId"],
            "admin.listReleases"
        );
    }

    #[tokio::test]
    async fn docs_route_exposes_live_schema_and_route_catalog_links() {
        let response = build_app()
            .oneshot(
                Request::builder()
                    .uri(CODING_SERVER_DOCS_PATH)
                    .body(Body::empty())
                    .expect("build request"),
            )
            .await
            .expect("serve request");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            response.headers().get(header::CONTENT_TYPE),
            Some(&HeaderValue::from_static("text/html; charset=utf-8"))
        );

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("read body");
        let html = String::from_utf8(body.to_vec()).expect("docs html");

        assert_eq!(html.contains(CODING_SERVER_LIVE_OPENAPI_PATH), true);
        assert_eq!(html.contains(CODING_SERVER_OPENAPI_PATH), true);
        assert_eq!(html.contains(CODING_SERVER_ROUTE_CATALOG_PATH), true);
        assert_eq!(html.contains(CODING_SERVER_GATEWAY_BASE_PATH), true);
    }

    #[tokio::test]
    async fn health_route_is_not_exposed() {
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
