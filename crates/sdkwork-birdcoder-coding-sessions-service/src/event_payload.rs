use std::collections::BTreeMap;

use sdkwork_utils_rust::is_blank;
use serde::{Deserialize, Deserializer, Serialize, Serializer};

use crate::native_session_types::{
    deserialize_i64_from_decimal_string_or_number, serialize_i64_as_decimal_string,
    NativeSessionCommandPayload, NativeSessionDetailPayload,
};

pub const BOOTSTRAP_WORKSPACE_ID: &str = "100000000000000101";

pub type CodingSessionEventPayloadMap = BTreeMap<String, serde_json::Value>;

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationPayload {
    pub operation_id: String,
    pub status: String,
    pub artifact_refs: Vec<String>,
    pub stream_url: String,
    pub stream_kind: String,
}

#[derive(Clone, Deserialize, Serialize)]
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

#[derive(Clone, Deserialize, Serialize)]
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

#[derive(Clone, Deserialize, Serialize)]
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

pub fn serialize_usize_as_decimal_string<S>(value: &usize, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

pub fn parse_usize_decimal_string<E>(value: &str) -> Result<usize, E>
where
    E: serde::de::Error,
{
    value
        .trim()
        .parse::<usize>()
        .map_err(|_| E::custom("expected a usize decimal string"))
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
            .ok_or_else(|| serde::de::Error::custom("expected a usize JSON number")),
        _ => Err(serde::de::Error::custom("expected a usize decimal string")),
    }
}

#[derive(Clone, Deserialize, Serialize)]
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

#[derive(Clone, Deserialize, Serialize)]
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

#[derive(Deserialize)]
#[serde(untagged)]
enum ProjectionOperationsField {
    Single(OperationPayload),
    Many(Vec<OperationPayload>),
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

#[derive(Clone, Deserialize)]
pub struct ProjectionSnapshot {
    #[serde(default)]
    pub session: Option<CodingSessionPayload>,
    #[serde(default)]
    pub turns: Vec<CodingSessionTurnPayload>,
    #[serde(
        default,
        alias = "operation",
        deserialize_with = "deserialize_projection_operations"
    )]
    pub operations: Vec<OperationPayload>,
    #[serde(default)]
    pub events: Vec<CodingSessionEventPayload>,
    #[serde(default)]
    pub artifacts: Vec<CodingSessionArtifactPayload>,
    #[serde(default)]
    pub checkpoints: Vec<CodingSessionCheckpointPayload>,
}

pub fn build_event_payload_strings<K, V>(entries: &[(K, V)]) -> CodingSessionEventPayloadMap
where
    K: AsRef<str>,
    V: AsRef<str>,
{
    entries
        .iter()
        .map(|(key, value)| {
            (
                key.as_ref().to_owned(),
                serde_json::Value::String(value.as_ref().to_owned()),
            )
        })
        .collect()
}

pub fn next_event_sequence(snapshot: &ProjectionSnapshot) -> usize {
    snapshot
        .events
        .iter()
        .map(|event| event.sequence)
        .max()
        .map(|sequence| sequence + 1)
        .unwrap_or(0)
}

pub fn payload_string_ref<'a>(
    payload: &'a CodingSessionEventPayloadMap,
    key: &str,
) -> Option<&'a str> {
    payload.get(key).and_then(serde_json::Value::as_str)
}

pub fn payload_string_value(payload: &CodingSessionEventPayloadMap, key: &str) -> Option<String> {
    payload.get(key).and_then(|value| match value {
        serde_json::Value::String(value) => Some(value.clone()),
        serde_json::Value::Bool(value) => Some(value.to_string()),
        serde_json::Value::Number(value) => Some(value.to_string()),
        _ => None,
    })
}

pub fn insert_payload_value(
    payload: &mut CodingSessionEventPayloadMap,
    key: &str,
    value: serde_json::Value,
) {
    payload.insert(key.to_owned(), value);
}

pub fn insert_payload_string(
    payload: &mut CodingSessionEventPayloadMap,
    key: &str,
    value: impl Into<String>,
) {
    insert_payload_value(payload, key, serde_json::Value::String(value.into()));
}

pub fn event_payload_role(payload: &CodingSessionEventPayloadMap) -> Option<&str> {
    payload_string_ref(payload, "role").and_then(|role| {
        let normalized = role.trim();
        if normalized.is_empty() {
            None
        } else {
            Some(normalized)
        }
    })
}

pub fn attach_native_session_id(
    payload: &mut CodingSessionEventPayloadMap,
    native_session_id: Option<&str>,
) {
    if let Some(native_session_id) = native_session_id {
        insert_payload_string(payload, "nativeSessionId", native_session_id);
    }
}

pub fn normalize_stream_event_payload_to_json_map(
    payload: Option<&serde_json::Value>,
) -> CodingSessionEventPayloadMap {
    let Some(payload) = payload.and_then(serde_json::Value::as_object) else {
        return BTreeMap::new();
    };

    let mut normalized_payload = BTreeMap::new();
    for (key, value) in payload {
        if is_blank(Some(key)) || value.is_null() {
            continue;
        }

        normalized_payload.insert(key.clone(), value.clone());
    }

    normalized_payload
}

pub fn build_projection_turn_event_id(runtime_id: &str, turn_id: &str, sequence: usize) -> String {
    format!("{runtime_id}:{turn_id}:event:{sequence}")
}

#[derive(Clone, Copy, Debug)]
pub struct SucceededCodingSessionTurnEventInput<'a> {
    pub coding_session_id: &'a str,
    pub runtime_id: &'a str,
    pub turn_id: &'a str,
    pub operation_id: &'a str,
    pub assistant_content: &'a str,
    pub stream_deltas: &'a [String],
    pub commands: Option<&'a [NativeSessionCommandPayload]>,
    pub base_sequence: usize,
    pub completed_at: &'a str,
    pub native_session_id: Option<&'a str>,
}

pub fn build_succeeded_coding_session_turn_events(
    input: SucceededCodingSessionTurnEventInput<'_>,
) -> Vec<CodingSessionEventPayload> {
    let SucceededCodingSessionTurnEventInput {
        coding_session_id,
        runtime_id,
        turn_id,
        operation_id,
        assistant_content,
        stream_deltas,
        commands,
        base_sequence,
        completed_at,
        native_session_id,
    } = input;

    let mut assistant_message_payload = CodingSessionEventPayloadMap::new();
    insert_payload_string(&mut assistant_message_payload, "role", "assistant");
    insert_payload_string(&mut assistant_message_payload, "content", assistant_content);
    insert_payload_string(&mut assistant_message_payload, "operationId", operation_id);
    insert_payload_string(&mut assistant_message_payload, "runtimeStatus", "completed");
    if let Some(commands) = commands {
        if let Ok(commands_value) = serde_json::to_value(commands) {
            insert_payload_value(&mut assistant_message_payload, "commands", commands_value);
        }
    }
    attach_native_session_id(&mut assistant_message_payload, native_session_id);

    let mut operation_payload = CodingSessionEventPayloadMap::new();
    insert_payload_string(&mut operation_payload, "operationId", operation_id);
    insert_payload_string(&mut operation_payload, "status", "succeeded");
    insert_payload_string(&mut operation_payload, "runtimeStatus", "completed");
    attach_native_session_id(&mut operation_payload, native_session_id);

    let mut completed_payload = CodingSessionEventPayloadMap::new();
    insert_payload_string(&mut completed_payload, "operationId", operation_id);
    insert_payload_string(&mut completed_payload, "finishReason", "stop");
    insert_payload_value(
        &mut completed_payload,
        "contentLength",
        serde_json::json!(assistant_content.len()),
    );
    insert_payload_string(&mut completed_payload, "runtimeStatus", "completed");
    attach_native_session_id(&mut completed_payload, native_session_id);

    let mut events = Vec::with_capacity(stream_deltas.len() + 3);
    for content_delta in stream_deltas
        .iter()
        .filter(|content_delta| !content_delta.is_empty())
    {
        let sequence = base_sequence + events.len();
        let mut delta_payload = CodingSessionEventPayloadMap::new();
        insert_payload_string(&mut delta_payload, "role", "assistant");
        insert_payload_string(&mut delta_payload, "contentDelta", content_delta);
        insert_payload_string(&mut delta_payload, "operationId", operation_id);
        insert_payload_string(&mut delta_payload, "runtimeStatus", "streaming");
        attach_native_session_id(&mut delta_payload, native_session_id);
        events.push(CodingSessionEventPayload {
            id: build_projection_turn_event_id(runtime_id, turn_id, sequence),
            coding_session_id: coding_session_id.to_owned(),
            turn_id: Some(turn_id.to_owned()),
            runtime_id: Some(runtime_id.to_owned()),
            kind: "message.delta".to_owned(),
            sequence,
            payload: delta_payload,
            created_at: completed_at.to_owned(),
        });
    }

    let terminal_sequence = base_sequence + events.len();
    events.extend([
        CodingSessionEventPayload {
            id: build_projection_turn_event_id(runtime_id, turn_id, terminal_sequence),
            coding_session_id: coding_session_id.to_owned(),
            turn_id: Some(turn_id.to_owned()),
            runtime_id: Some(runtime_id.to_owned()),
            kind: "message.completed".to_owned(),
            sequence: terminal_sequence,
            payload: assistant_message_payload,
            created_at: completed_at.to_owned(),
        },
        CodingSessionEventPayload {
            id: build_projection_turn_event_id(runtime_id, turn_id, terminal_sequence + 1),
            coding_session_id: coding_session_id.to_owned(),
            turn_id: Some(turn_id.to_owned()),
            runtime_id: Some(runtime_id.to_owned()),
            kind: "operation.updated".to_owned(),
            sequence: terminal_sequence + 1,
            payload: operation_payload,
            created_at: completed_at.to_owned(),
        },
        CodingSessionEventPayload {
            id: build_projection_turn_event_id(runtime_id, turn_id, terminal_sequence + 2),
            coding_session_id: coding_session_id.to_owned(),
            turn_id: Some(turn_id.to_owned()),
            runtime_id: Some(runtime_id.to_owned()),
            kind: "turn.completed".to_owned(),
            sequence: terminal_sequence + 2,
            payload: completed_payload,
            created_at: completed_at.to_owned(),
        },
    ]);
    events
}

pub fn build_native_session_events_for_coding_session(
    detail: &NativeSessionDetailPayload,
    coding_session_id: &str,
    base_sequence: usize,
) -> Vec<CodingSessionEventPayload> {
    let runtime_id = format!("{coding_session_id}:runtime");
    detail
        .messages
        .iter()
        .enumerate()
        .map(|(index, message)| {
            let mut payload = CodingSessionEventPayloadMap::new();
            insert_payload_string(&mut payload, "role", message.role.clone());
            insert_payload_string(&mut payload, "content", message.content.clone());
            insert_payload_string(&mut payload, "runtimeStatus", "completed");
            insert_payload_string(&mut payload, "nativeSessionId", detail.summary.id.clone());
            if let Some(commands) = message.commands.as_ref() {
                if let Ok(commands_value) = serde_json::to_value(commands) {
                    insert_payload_value(&mut payload, "commands", commands_value);
                }
            }
            if let Some(tool_calls) = message.tool_calls.as_ref() {
                insert_payload_value(
                    &mut payload,
                    "toolCalls",
                    serde_json::Value::Array(tool_calls.clone()),
                );
            }
            if let Some(tool_call_id) = message.tool_call_id.as_ref() {
                insert_payload_string(&mut payload, "toolCallId", tool_call_id);
            }
            if let Some(file_changes) = message.file_changes.as_ref() {
                insert_payload_value(
                    &mut payload,
                    "fileChanges",
                    serde_json::Value::Array(file_changes.clone()),
                );
            }
            if let Some(task_progress) = message.task_progress.as_ref() {
                insert_payload_value(&mut payload, "taskProgress", task_progress.clone());
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

pub fn build_native_session_events(
    detail: &NativeSessionDetailPayload,
) -> Vec<CodingSessionEventPayload> {
    build_native_session_events_for_coding_session(detail, detail.summary.id.as_str(), 0)
}

const PROJECTION_NATIVE_MESSAGE_OVERLAY_DUPLICATE_WINDOW_MS: i64 = 5 * 60 * 1000;

fn strip_projection_overlay_tag_block(value: &str, tag_name: &str) -> String {
    let start_tag = format!("<{tag_name}>");
    let end_tag = format!("</{tag_name}>");
    let mut remaining = value;
    let mut cleaned = String::new();

    while let Some(start_index) = remaining.find(start_tag.as_str()) {
        cleaned.push_str(&remaining[..start_index]);
        let after_start = &remaining[start_index + start_tag.len()..];
        if let Some(end_index) = after_start.find(end_tag.as_str()) {
            remaining = &after_start[end_index + end_tag.len()..];
        } else {
            remaining = "";
            break;
        }
    }

    cleaned.push_str(remaining);
    cleaned
}

fn strip_projection_overlay_control_tags(value: &str) -> String {
    let without_environment_context =
        strip_projection_overlay_tag_block(value, "environment_context");
    strip_projection_overlay_tag_block(without_environment_context.as_str(), "turn_aborted")
}

fn extract_projection_overlay_request_segment(value: &str) -> &str {
    if value.contains("IDE context:")
        || value.contains("Current file path:")
        || value.contains("Current file content:")
    {
        if let Some(start_index) = value.find("User request:") {
            return &value[start_index + "User request:".len()..];
        }
    }

    for marker in [
        "## My request for Codex:",
        "# My request for Codex:",
        "My request for Codex:",
    ] {
        if let Some(start_index) = value.find(marker) {
            return &value[start_index + marker.len()..];
        }
    }

    value
}

fn normalize_projection_overlay_message_content(value: &str) -> Option<String> {
    let extracted_request = extract_projection_overlay_request_segment(value);
    let stripped = strip_projection_overlay_control_tags(extracted_request);
    let normalized = stripped.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = normalized.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}

fn read_message_event_overlay_content(event: &CodingSessionEventPayload) -> Option<String> {
    if !matches!(event.kind.as_str(), "message.completed" | "message.delta") {
        return None;
    }

    event
        .payload
        .get("content")
        .or_else(|| event.payload.get("contentDelta"))
        .and_then(serde_json::Value::as_str)
        .and_then(normalize_projection_overlay_message_content)
}

fn read_message_event_overlay_raw_content(event: &CodingSessionEventPayload) -> Option<&str> {
    if !matches!(event.kind.as_str(), "message.completed" | "message.delta") {
        return None;
    }

    event
        .payload
        .get("content")
        .or_else(|| event.payload.get("contentDelta"))
        .and_then(serde_json::Value::as_str)
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

fn message_overlay_timestamps_are_near(
    left: &CodingSessionEventPayload,
    right: &CodingSessionEventPayload,
) -> bool {
    match (
        parse_storage_timestamp_millis(left.created_at.as_str()),
        parse_storage_timestamp_millis(right.created_at.as_str()),
    ) {
        (Some(left_timestamp), Some(right_timestamp)) => {
            (left_timestamp - right_timestamp).abs()
                <= PROJECTION_NATIVE_MESSAGE_OVERLAY_DUPLICATE_WINDOW_MS
        }
        _ => false,
    }
}

#[derive(Default)]
struct ProjectionDeltaOverlayAggregate {
    content: String,
    is_near_native_event: bool,
}

fn projection_delta_aggregates_match_native_event(
    native_event: &CodingSessionEventPayload,
    projection_events: &[CodingSessionEventPayload],
    native_role: &str,
    native_content: &str,
) -> bool {
    let mut sorted_delta_events = projection_events
        .iter()
        .filter(|event| {
            event.kind == "message.delta" && event_payload_role(&event.payload) == Some(native_role)
        })
        .collect::<Vec<_>>();
    sorted_delta_events.sort_by(|left, right| {
        left.sequence
            .cmp(&right.sequence)
            .then_with(|| left.created_at.cmp(&right.created_at))
            .then_with(|| left.id.cmp(&right.id))
    });

    let mut aggregates = BTreeMap::<String, ProjectionDeltaOverlayAggregate>::new();
    for projection_event in sorted_delta_events {
        let Some(turn_id) = projection_event
            .turn_id
            .as_deref()
            .map(str::trim)
            .filter(|turn_id| !turn_id.is_empty())
        else {
            continue;
        };
        let Some(raw_content) = read_message_event_overlay_raw_content(projection_event) else {
            continue;
        };

        let aggregate = aggregates.entry(turn_id.to_owned()).or_default();
        aggregate.content.push_str(raw_content);
        if message_overlay_timestamps_are_near(native_event, projection_event) {
            aggregate.is_near_native_event = true;
        }
    }

    aggregates.into_values().any(|aggregate| {
        aggregate.is_near_native_event
            && normalize_projection_overlay_message_content(aggregate.content.as_str())
                .is_some_and(|projection_content| projection_content == native_content)
    })
}

fn is_duplicate_projection_native_message_event(
    native_event: &CodingSessionEventPayload,
    projection_events: &[CodingSessionEventPayload],
) -> bool {
    let Some(native_role) = event_payload_role(&native_event.payload) else {
        return false;
    };
    let native_turn_id = native_event
        .turn_id
        .as_deref()
        .map(str::trim)
        .filter(|turn_id| !turn_id.is_empty());
    let native_content = read_message_event_overlay_content(native_event);

    if projection_events
        .iter()
        .filter(|event| matches!(event.kind.as_str(), "message.completed" | "message.delta"))
        .any(|projection_event| {
            if event_payload_role(&projection_event.payload) != Some(native_role) {
                return false;
            }

            let projection_turn_id = projection_event
                .turn_id
                .as_deref()
                .map(str::trim)
                .filter(|turn_id| !turn_id.is_empty());
            if native_turn_id.is_some()
                && projection_turn_id.is_some()
                && native_turn_id == projection_turn_id
            {
                return true;
            }

            native_content
                .as_ref()
                .zip(read_message_event_overlay_content(projection_event))
                .is_some_and(|(left_content, right_content)| {
                    left_content == &right_content
                        && message_overlay_timestamps_are_near(native_event, projection_event)
                })
        })
    {
        return true;
    }

    native_content.as_ref().is_some_and(|content| {
        projection_delta_aggregates_match_native_event(
            native_event,
            projection_events,
            native_role,
            content.as_str(),
        )
    })
}

pub fn build_projection_session_events_with_native_detail(
    snapshot: &ProjectionSnapshot,
    detail: &NativeSessionDetailPayload,
    coding_session_id: &str,
) -> Vec<CodingSessionEventPayload> {
    let native_events = build_native_session_events_for_coding_session(
        detail,
        coding_session_id,
        next_event_sequence(snapshot),
    );
    let mut events = snapshot
        .events
        .iter()
        .filter(|event| {
            if !matches!(event.kind.as_str(), "message.completed" | "message.delta") {
                return true;
            }

            event_payload_role(&event.payload).is_some()
        })
        .cloned()
        .collect::<Vec<_>>();
    events.extend(native_events.into_iter().filter(|event| {
        event_payload_role(&event.payload).is_some()
            && !is_duplicate_projection_native_message_event(event, snapshot.events.as_slice())
    }));
    events.sort_by(|left, right| {
        left.sequence
            .cmp(&right.sequence)
            .then_with(|| left.created_at.cmp(&right.created_at))
            .then_with(|| left.id.cmp(&right.id))
    });
    events
}
