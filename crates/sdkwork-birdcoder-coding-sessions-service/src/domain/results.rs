use serde::{de, Deserialize, Deserializer, Serialize};
use std::collections::BTreeMap;

use super::models::{
    CodingSessionTurnIdeContextPayload,
    CodingSessionTurnOptionsPayload,
};

// ── Serialization helpers ────────────────────────────────────────────

pub fn serialize_i64_as_decimal_string<S>(value: &i64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&value.to_string())
}

pub fn serialize_usize_as_decimal_string<S>(value: &usize, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&value.to_string())
}

fn parse_i64_decimal_string<E: de::Error>(value: &str) -> Result<i64, E> {
    value
        .trim()
        .parse::<i64>()
        .map_err(|_| E::custom("expected an i64 decimal string"))
}

fn parse_usize_decimal_string<E: de::Error>(value: &str) -> Result<usize, E> {
    value
        .trim()
        .parse::<usize>()
        .map_err(|_| E::custom("expected a usize decimal string"))
}

pub fn deserialize_i64_from_decimal_string_or_number<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::String(value) => parse_i64_decimal_string::<D::Error>(&value),
        serde_json::Value::Number(value) => value
            .as_i64()
            .ok_or_else(|| de::Error::custom("expected an i64 JSON number")),
        _ => Err(de::Error::custom("expected an i64 decimal string")),
    }
}

pub fn deserialize_usize_from_decimal_string_or_number<'de, D>(
    deserializer: D,
) -> Result<usize, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::String(value) => parse_usize_decimal_string::<D::Error>(&value),
        serde_json::Value::Number(value) => value
            .as_u64()
            .and_then(|value| usize::try_from(value).ok())
            .ok_or_else(|| de::Error::custom("expected a usize JSON number")),
        _ => Err(de::Error::custom("expected a usize decimal string")),
    }
}

// ── Operation payload ────────────────────────────────────────────────

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationPayload {
    pub operation_id: String,
    pub status: String,
    pub artifact_refs: Vec<String>,
    pub stream_url: String,
    pub stream_kind: String,
}

// ── Coding session payload ───────────────────────────────────────────

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingSessionPayload {
    pub id: String,
    pub workspace_id: String,
    pub project_id: String,
    pub title: String,
    pub status: String,
    pub host_mode: String,
    pub engine_id: String,
    pub model_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub native_session_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_turn_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub runtime_status: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_i64_from_decimal_string_or_number",
        serialize_with = "serialize_i64_as_decimal_string"
    )]
    pub sort_timestamp: i64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transcript_updated_at: Option<String>,
}

// ── Coding session turn payload ──────────────────────────────────────

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingSessionTurnPayload {
    pub id: String,
    pub coding_session_id: String,
    pub runtime_id: Option<String>,
    pub request_kind: String,
    pub status: String,
    pub input_summary: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

// ── Type aliases ─────────────────────────────────────────────────────

pub type CodingSessionEventPayloadMap = BTreeMap<String, serde_json::Value>;
pub type CodingSessionCheckpointStateMap = BTreeMap<String, serde_json::Value>;

// ── Coding session event payload ─────────────────────────────────────

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingSessionEventPayload {
    pub id: String,
    pub coding_session_id: String,
    pub turn_id: Option<String>,
    pub runtime_id: Option<String>,
    pub kind: String,
    #[serde(
        deserialize_with = "deserialize_usize_from_decimal_string_or_number",
        serialize_with = "serialize_usize_as_decimal_string"
    )]
    pub sequence: usize,
    pub payload: BTreeMap<String, serde_json::Value>,
    pub created_at: String,
}

// ── Coding session checkpoint payload ────────────────────────────────

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingSessionCheckpointPayload {
    pub id: String,
    pub coding_session_id: String,
    pub runtime_id: Option<String>,
    pub checkpoint_kind: String,
    pub resumable: bool,
    pub state: BTreeMap<String, serde_json::Value>,
    pub created_at: String,
}

// ── Coding session artifact payload ──────────────────────────────────

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodingSessionArtifactPayload {
    pub id: String,
    pub coding_session_id: String,
    pub turn_id: Option<String>,
    pub kind: String,
    pub status: String,
    pub title: String,
    pub metadata: BTreeMap<String, String>,
    pub created_at: String,
}

// ── Approval decision payload ────────────────────────────────────────

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalDecisionPayload {
    pub approval_id: String,
    pub checkpoint_id: String,
    pub coding_session_id: String,
    pub runtime_id: Option<String>,
    pub turn_id: Option<String>,
    pub operation_id: Option<String>,
    pub decision: String,
    pub reason: Option<String>,
    pub decided_at: String,
    pub runtime_status: String,
    pub operation_status: String,
}

// ── User question answer payload ─────────────────────────────────────

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserQuestionAnswerPayload {
    pub question_id: String,
    pub coding_session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub answer: Option<String>,
    pub answered_at: String,
    pub option_id: Option<String>,
    pub option_label: Option<String>,
    pub rejected: bool,
    pub runtime_id: Option<String>,
    pub runtime_status: String,
    pub turn_id: Option<String>,
}

// ── Projection turn execution ────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct PendingProjectionTurnExecution {
    pub session: CodingSessionPayload,
    pub turn: CodingSessionTurnPayload,
    pub operation: OperationPayload,
    pub native_session_id: Option<String>,
    pub turn_model_id: String,
    pub ide_context: Option<CodingSessionTurnIdeContextPayload>,
    pub options: Option<CodingSessionTurnOptionsPayload>,
    pub working_directory: Option<std::path::PathBuf>,
}

#[derive(Clone, Debug)]
pub struct FinalizedProjectionTurnExecution {
    pub turn: CodingSessionTurnPayload,
    pub events: Vec<CodingSessionEventPayload>,
}

// ── Delete entity payload ────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteEntityPayload {
    pub id: String,
}

// ── Pending turn result ──────────────────────────────────────────────

#[derive(Clone, Debug)]
pub struct PendingTurnResult {
    pub session: CodingSessionPayload,
    pub turn: CodingSessionTurnPayload,
    pub native_session_id: Option<String>,
    pub turn_model_id: String,
}
