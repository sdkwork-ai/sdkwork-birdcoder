use std::collections::BTreeMap;

use serde::{Deserialize, Serialize, Serializer};

use crate::error::NativeSessionError;

pub const NATIVE_SESSION_ATTRIBUTES_SCHEMA_VERSION: i64 = 1;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionAttributesPayload {
    #[serde(default = "default_native_session_attributes_schema_version")]
    pub schema_version: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session_tree_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub forked_from_session_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub provider_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub model_provider: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_branch: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_commit: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git_repository_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub agent_role: Option<String>,
    #[serde(default)]
    pub is_ephemeral: bool,
    #[serde(default)]
    pub is_sidechain: bool,
    #[serde(default)]
    pub metadata: BTreeMap<String, serde_json::Value>,
}

impl Default for NativeSessionAttributesPayload {
    fn default() -> Self {
        Self {
            schema_version: NATIVE_SESSION_ATTRIBUTES_SCHEMA_VERSION,
            session_tree_id: None,
            parent_session_id: None,
            forked_from_session_id: None,
            title: None,
            preview: None,
            source: None,
            provider_version: None,
            model_provider: None,
            project_id: None,
            cwd: None,
            git_branch: None,
            git_commit: None,
            git_repository_url: None,
            agent_name: None,
            agent_role: None,
            is_ephemeral: false,
            is_sidechain: false,
            metadata: BTreeMap::new(),
        }
    }
}

const fn default_native_session_attributes_schema_version() -> i64 {
    NATIVE_SESSION_ATTRIBUTES_SCHEMA_VERSION
}

// ── Payload types ────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionSummaryPayload {
    pub id: String,
    pub workspace_id: String,
    pub project_id: String,
    pub title: String,
    pub status: String,
    pub host_mode: String,
    pub engine_id: String,
    pub model_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_session_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_turn_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcript_updated_at: Option<String>,
    #[serde(serialize_with = "serialize_i64_as_decimal_string")]
    pub sort_timestamp: i64,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub native_cwd: Option<String>,
    #[serde(default)]
    pub native_attributes: NativeSessionAttributesPayload,
}

fn serialize_i64_as_decimal_string<S>(value: &i64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionCommandPayload {
    pub command: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub runtime_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_approval: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub requires_reply: Option<bool>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionTurnCurrentFileContext {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionTurnIdeContext {
    pub workspace_id: String,
    pub project_id: String,
    pub session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_file: Option<NativeSessionTurnCurrentFileContext>,
}

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionTurnConfig {
    pub full_auto: bool,
    pub skip_git_repo_check: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<u32>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionMessagePayload {
    pub id: String,
    pub coding_session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub turn_id: Option<String>,
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub commands: Option<Vec<NativeSessionCommandPayload>>,
    #[serde(
        default,
        rename = "tool_calls",
        skip_serializing_if = "Option::is_none"
    )]
    pub tool_calls: Option<Vec<serde_json::Value>>,
    #[serde(
        default,
        rename = "tool_call_id",
        skip_serializing_if = "Option::is_none"
    )]
    pub tool_call_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_changes: Option<Vec<serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub task_progress: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<BTreeMap<String, String>>,
    pub created_at: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionDetailPayload {
    pub summary: NativeSessionSummaryPayload,
    pub messages: Vec<NativeSessionMessagePayload>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionProviderPayload {
    pub provider_id: String,
    pub name: String,
    pub description: String,
}

// ── Query / Lookup ───────────────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct NativeSessionQuery {
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub engine_id: Option<String>,
    pub offset: Option<usize>,
    pub limit: Option<usize>,
    pub project_root: Option<String>,
}

#[derive(Clone, Debug)]
pub struct NativeSessionLookup {
    pub session_id: String,
    pub engine_id: Option<String>,
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub project_root: Option<String>,
}

// ── Repository trait ─────────────────────────────────────────────────

pub trait NativeSessionRepository: Send + Sync {
    fn list_sessions(
        &self,
        query: &NativeSessionQuery,
    ) -> Result<(Vec<NativeSessionSummaryPayload>, usize), String>;

    fn get_session(
        &self,
        lookup: &NativeSessionLookup,
    ) -> Result<Option<NativeSessionDetailPayload>, String>;

    fn get_session_summary(
        &self,
        lookup: &NativeSessionLookup,
    ) -> Result<Option<NativeSessionSummaryPayload>, String>;
}

// ── Service ──────────────────────────────────────────────────────────

#[derive(Clone)]
pub struct NativeSessionService<R: NativeSessionRepository> {
    repository: R,
}

impl<R: NativeSessionRepository> NativeSessionService<R> {
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub fn list_sessions(
        &self,
        query: &NativeSessionQuery,
    ) -> Result<(Vec<NativeSessionSummaryPayload>, usize), NativeSessionError> {
        self.repository
            .list_sessions(query)
            .map_err(NativeSessionError::Repository)
    }

    pub fn get_session_detail(
        &self,
        lookup: &NativeSessionLookup,
    ) -> Result<NativeSessionDetailPayload, NativeSessionError> {
        self.repository
            .get_session(lookup)
            .map_err(NativeSessionError::Repository)?
            .ok_or_else(|| {
                NativeSessionError::NotFound(format!(
                    "Native session \"{}\" was not found.",
                    lookup.session_id
                ))
            })
    }

    pub fn get_session_summary(
        &self,
        lookup: &NativeSessionLookup,
    ) -> Result<Option<NativeSessionSummaryPayload>, NativeSessionError> {
        self.repository
            .get_session_summary(lookup)
            .map_err(NativeSessionError::Repository)
    }
}

// ── Helpers ──────────────────────────────────────────────────────────

const NATIVE_SESSION_ID_PREFIX: &str = "native:";

pub fn is_authority_backed_native_session_id(session_id: &str) -> bool {
    session_id.starts_with(NATIVE_SESSION_ID_PREFIX)
}

pub fn build_native_session_id(engine_id: &str, native_session_id: &str) -> String {
    format!("{NATIVE_SESSION_ID_PREFIX}{engine_id}:{native_session_id}")
}

pub fn resolve_native_session_engine_id(session_id: &str) -> Option<String> {
    let remainder = session_id.strip_prefix(NATIVE_SESSION_ID_PREFIX)?;
    let engine_end = remainder.find(':')?;
    let engine_id = &remainder[..engine_end];
    if engine_id.is_empty() {
        return None;
    }
    Some(engine_id.to_string())
}
