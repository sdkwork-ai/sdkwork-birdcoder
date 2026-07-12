use serde::{Deserialize, Serialize};

use crate::error::NativeSessionError;

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
    pub created_at: String,
    pub updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_turn_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcript_updated_at: Option<String>,
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
pub struct NativeSessionTurnPayload {
    pub id: String,
    pub role: String,
    pub content: String,
    pub created_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ide_context: Option<NativeSessionTurnIdeContext>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionDetailPayload {
    #[serde(flatten)]
    pub summary: NativeSessionSummaryPayload,
    pub turns: Vec<NativeSessionTurnPayload>,
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
}

#[derive(Clone, Debug)]
pub struct NativeSessionLookup {
    pub session_id: String,
    pub engine_id: Option<String>,
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
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
