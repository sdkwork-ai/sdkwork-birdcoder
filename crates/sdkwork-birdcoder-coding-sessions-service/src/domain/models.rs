use serde::Deserialize;
use std::collections::BTreeMap;

// ── Database row models ──────────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct CodingSessionRow {
    pub id: String,
    pub workspace_id: String,
    pub project_id: String,
    pub runtime_location_id: Option<String>,
    pub title: String,
    pub status: String,
    pub engine_id: String,
    pub model_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_turn_at: Option<String>,
    pub native_session_id: Option<String>,
    pub native_attributes: crate::native_session_types::NativeSessionAttributesPayload,
}

#[derive(Clone, Debug)]
pub struct CodingSessionRuntimeRow {
    pub id: String,
    pub coding_session_id: String,
    pub host_mode: String,
    pub engine_id: String,
    pub model_id: String,
    pub status: String,
    pub native_session_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, Debug)]
pub struct CodingSessionTurnRow {
    pub id: String,
    pub coding_session_id: String,
    pub runtime_id: String,
    pub request_kind: String,
    pub status: String,
    pub input_summary: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Clone, Debug)]
pub struct CodingSessionEventRow {
    pub id: String,
    pub coding_session_id: String,
    pub turn_id: Option<String>,
    pub runtime_id: Option<String>,
    pub event_kind: String,
    pub sequence_no: usize,
    pub payload_json: String,
    pub created_at: String,
}

#[derive(Clone, Debug)]
pub struct CodingSessionArtifactRow {
    pub id: String,
    pub coding_session_id: String,
    pub turn_id: Option<String>,
    pub artifact_kind: String,
    pub title: String,
    pub blob_ref: Option<String>,
    pub metadata_json: String,
    pub created_at: String,
}

#[derive(Clone, Debug)]
pub struct CodingSessionCheckpointRow {
    pub id: String,
    pub coding_session_id: String,
    pub runtime_id: Option<String>,
    pub checkpoint_kind: String,
    pub resumable: bool,
    pub state_json: String,
    pub created_at: String,
}

#[derive(Clone, Debug)]
pub struct CodingSessionOperationRow {
    pub id: String,
    pub coding_session_id: String,
    pub status: String,
    pub stream_url: String,
    pub stream_kind: String,
    pub artifact_refs_json: String,
}

#[derive(Clone, Debug, PartialEq)]
pub struct DurableCodingSessionOperation {
    pub id: String,
    pub tenant_id: i64,
    pub user_id: i64,
    pub coding_session_id: String,
    pub turn_id: String,
    pub status: String,
    pub request_payload: serde_json::Value,
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
    pub problem: Option<serde_json::Value>,
}

#[derive(Clone, Debug)]
pub struct EnqueueCodingSessionOperationInput {
    /// Server-owned deterministic operation id, normally turn-id plus operation suffix.
    pub operation_id: String,
    pub coding_session_id: String,
    pub turn_id: String,
    /// Serialized worker request containing everything needed after request process exit.
    pub request_payload: serde_json::Value,
    pub request_fingerprint: String,
    pub idempotency_key: String,
    pub available_at: String,
    pub max_attempt: i64,
}

#[derive(Clone, Debug)]
pub struct ClaimCodingSessionOperationInput {
    pub lease_owner: String,
    pub runner_id: String,
    pub claimed_at: String,
    pub lease_expires_at: String,
}

#[derive(Clone, Debug)]
pub struct RenewCodingSessionOperationLeaseInput {
    pub operation_id: String,
    pub lease_owner: String,
    pub fencing_token: i64,
    pub renewed_at: String,
    pub lease_expires_at: String,
}

#[derive(Clone, Debug)]
pub struct CompleteCodingSessionOperationInput {
    pub operation_id: String,
    pub lease_owner: String,
    pub fencing_token: i64,
    pub completed_at: String,
    pub finalized: super::results::FinalizedProjectionTurnExecution,
}

#[derive(Clone, Debug)]
pub struct FailCodingSessionOperationInput {
    pub operation_id: String,
    pub lease_owner: String,
    pub fencing_token: i64,
    pub failed_at: String,
    pub retry_at: Option<String>,
    pub problem: serde_json::Value,
}

// ── Query models ─────────────────────────────────────────────────────

#[derive(Clone, Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingSessionListQuery {
    pub engine_id: Option<String>,
    pub page_size: Option<usize>,
    pub offset: Option<usize>,
    pub project_id: Option<String>,
    pub runtime_location_id: Option<String>,
    pub workspace_id: Option<String>,
}

// ── Context / options ────────────────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingSessionTurnCurrentFileContextPayload {
    pub path: String,
    pub content: Option<String>,
    pub language: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingSessionTurnIdeContextPayload {
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub session_id: Option<String>,
    pub current_file: Option<CodingSessionTurnCurrentFileContextPayload>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingSessionTurnOptionsPayload {
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub max_tokens: Option<i64>,
}

// ── Runtime profile ──────────────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct AuthoritativeEngineRuntimeProfile {
    pub transport_kind: String,
    pub capability_snapshot_json: String,
}

// ── Projection snapshots ─────────────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
pub struct ProjectionSnapshot {
    #[serde(default)]
    pub session: Option<super::results::CodingSessionPayload>,
    #[serde(default)]
    pub turns: Vec<super::results::CodingSessionTurnPayload>,
    #[serde(default, alias = "operation")]
    pub operations: Vec<super::results::OperationPayload>,
    #[serde(default)]
    pub events: Vec<super::results::CodingSessionEventPayload>,
    #[serde(default)]
    pub artifacts: Vec<super::results::CodingSessionArtifactPayload>,
    #[serde(default)]
    pub checkpoints: Vec<super::results::CodingSessionCheckpointPayload>,
}

#[derive(Clone, Debug, Deserialize)]
pub struct ProjectionReadState {
    pub sessions: BTreeMap<String, ProjectionSnapshot>,
}
