use serde::Deserialize;

use super::models::{CodingSessionTurnIdeContextPayload, CodingSessionTurnOptionsPayload};
use super::results::CodingSessionEventPayloadMap;

// ── Create coding session ────────────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCodingSessionRequest {
    pub workspace_id: String,
    pub project_id: String,
    pub runtime_location_id: String,
    pub title: Option<String>,
    pub host_mode: Option<String>,
    pub engine_id: Option<String>,
    pub model_id: Option<String>,
}

#[derive(Clone, Debug)]
pub struct CreateCodingSessionInput {
    pub workspace_id: String,
    pub project_id: String,
    pub runtime_location_id: String,
    pub title: String,
    pub host_mode: String,
    pub engine_id: String,
    pub model_id: String,
}

// ── Update coding session ────────────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCodingSessionRequest {
    pub title: Option<String>,
    pub status: Option<String>,
    pub host_mode: Option<String>,
}

#[derive(Clone, Debug)]
pub struct UpdateCodingSessionInput {
    pub title: Option<String>,
    pub status: Option<String>,
    pub host_mode: Option<String>,
}

// ── Fork coding session ──────────────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForkCodingSessionRequest {
    pub title: Option<String>,
}

#[derive(Clone, Debug)]
pub struct ForkCodingSessionInput {
    pub title: Option<String>,
}

// ── Edit coding session message ──────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditCodingSessionMessageRequest {
    pub content: String,
}

#[derive(Clone, Debug)]
pub struct EditCodingSessionMessageInput {
    pub content: String,
}

// ── Create coding session turn ───────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCodingSessionTurnRequest {
    pub runtime_id: Option<String>,
    pub request_kind: String,
    pub input_summary: String,
    pub stream: Option<bool>,
    pub ide_context: Option<CodingSessionTurnIdeContextPayload>,
    pub options: Option<CodingSessionTurnOptionsPayload>,
}

#[derive(Clone, Debug)]
pub struct CreateCodingSessionTurnInput {
    pub runtime_id: Option<String>,
    pub request_kind: String,
    pub input_summary: String,
    pub stream: bool,
    pub ide_context: Option<CodingSessionTurnIdeContextPayload>,
    pub options: Option<CodingSessionTurnOptionsPayload>,
}

// -- Append realtime coding session event -----------------------------------

/// A provider-neutral event draft. The repository owns the durable event id,
/// sequence, and timestamp so callers cannot create gaps or reorder a session
/// transcript.
#[derive(Clone, Debug)]
pub struct AppendCodingSessionRealtimeEventInput {
    pub turn_id: Option<String>,
    pub runtime_id: Option<String>,
    pub kind: String,
    pub payload: CodingSessionEventPayloadMap,
}

/// The only interaction authorities accepted by mutation endpoints. The
/// public path identifier is always the durable event UUID; `interactionId`
/// stays inside the normalized payload and is resolved before provider calls.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CodingSessionInteractionKind {
    Approval,
    UserQuestion,
}

impl CodingSessionInteractionKind {
    pub const fn source_event_kind(self) -> &'static str {
        match self {
            Self::Approval => "approval.required",
            Self::UserQuestion => "user.question.required",
        }
    }

    pub const fn payload_kind(self) -> &'static str {
        match self {
            Self::Approval => "approval",
            Self::UserQuestion => "user_question",
        }
    }
}

// ── Submit approval decision ─────────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitApprovalDecisionRequest {
    pub decision: String,
    pub reason: Option<String>,
}

#[derive(Clone, Debug)]
pub struct SubmitApprovalDecisionInput {
    pub decision: String,
    pub reason: Option<String>,
}

// ── Submit user question answer ──────────────────────────────────────

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitUserQuestionAnswerRequest {
    pub answer: Option<String>,
    pub option_id: Option<String>,
    pub option_label: Option<String>,
    pub rejected: Option<bool>,
}

#[derive(Clone, Debug)]
pub struct SubmitUserQuestionAnswerInput {
    pub answer: Option<String>,
    pub option_id: Option<String>,
    pub option_label: Option<String>,
    pub rejected: bool,
}
