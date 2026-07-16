use std::collections::{BTreeMap, BTreeSet};

use sdkwork_birdcoder_codeengine::{map_codeengine_tool_kind, CodeEngineSessionCommandRecord};
use serde_json::{Map, Value};

const APPROVAL_REQUIRED_EVENT_KIND: &str = "approval.required";
const USER_QUESTION_REQUIRED_EVENT_KIND: &str = "user.question.required";

/// A BirdCoder-owned canonical interaction event projected from a normalized
/// kernel tool command. Provider-specific request names never cross this
/// boundary: callers receive the stable event kind and canonical payload.
#[derive(Clone, Debug, PartialEq)]
pub struct BirdcoderInteractionProjection {
    pub event_kind: &'static str,
    pub payload: BTreeMap<String, Value>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum InteractionProjectionError {
    AmbiguousInteraction {
        tool_call_id: Option<String>,
    },
    InvalidInteractionKind {
        tool_call_id: Option<String>,
        interaction_kind: String,
    },
    MissingNativeInteractionId {
        interaction_kind: &'static str,
        tool_name: Option<String>,
    },
}

impl std::fmt::Display for InteractionProjectionError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::AmbiguousInteraction { tool_call_id } => write!(
                formatter,
                "provider command cannot require approval and a user reply at the same time{}",
                tool_call_id
                    .as_deref()
                    .map(|value| format!(": {value}"))
                    .unwrap_or_default()
            ),
            Self::InvalidInteractionKind {
                tool_call_id,
                interaction_kind,
            } => write!(
                formatter,
                "provider command has an unsupported interactionKind {interaction_kind:?}{}",
                tool_call_id
                    .as_deref()
                    .map(|value| format!(": {value}"))
                    .unwrap_or_default()
            ),
            Self::MissingNativeInteractionId {
                interaction_kind,
                tool_name,
            } => write!(
                formatter,
                "provider {} interaction is missing a native interaction id{}",
                interaction_kind,
                tool_name
                    .as_deref()
                    .map(|value| format!(" for tool {value}"))
                    .unwrap_or_default()
            ),
        }
    }
}

impl std::error::Error for InteractionProjectionError {}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum InteractionKind {
    Approval,
    UserQuestion,
}

impl InteractionKind {
    const fn event_kind(self) -> &'static str {
        match self {
            Self::Approval => APPROVAL_REQUIRED_EVENT_KIND,
            Self::UserQuestion => USER_QUESTION_REQUIRED_EVENT_KIND,
        }
    }

    const fn payload_kind(self) -> &'static str {
        match self {
            Self::Approval => "approval",
            Self::UserQuestion => "user_question",
        }
    }

    const fn requires_payload_key(self) -> &'static str {
        match self {
            Self::Approval => "requiresApproval",
            Self::UserQuestion => "requiresReply",
        }
    }
}

/// Projects pending provider interactions into BirdCoder's canonical event
/// vocabulary. A projection is rejected when the provider has not supplied a
/// stable native request/question/checkpoint identifier; a local or generated
/// identifier would make a later approval or answer unsafe to route.
pub fn project_provider_neutral_interactions(
    commands: Option<&[CodeEngineSessionCommandRecord]>,
) -> Result<Vec<BirdcoderInteractionProjection>, InteractionProjectionError> {
    let Some(commands) = commands else {
        return Ok(Vec::new());
    };

    let mut seen = BTreeSet::new();
    let mut projected = Vec::new();
    for command in commands {
        let Some(interaction_kind) = resolve_interaction_kind(command)? else {
            continue;
        };
        let interaction_id =
            extract_native_interaction_id(command, interaction_kind).ok_or_else(|| {
                InteractionProjectionError::MissingNativeInteractionId {
                    interaction_kind: interaction_kind.payload_kind(),
                    tool_name: normalize_non_empty(command.tool_name.as_deref()),
                }
            })?;
        if !seen.insert((interaction_kind.payload_kind(), interaction_id.clone())) {
            continue;
        }

        projected.push(BirdcoderInteractionProjection {
            event_kind: interaction_kind.event_kind(),
            payload: build_interaction_payload(command, interaction_kind, interaction_id),
        });
    }

    Ok(projected)
}

fn resolve_interaction_kind(
    command: &CodeEngineSessionCommandRecord,
) -> Result<Option<InteractionKind>, InteractionProjectionError> {
    if !is_pending_command(command) {
        return Ok(None);
    }

    let arguments = serde_json::from_str::<Value>(command.command.as_str()).ok();
    let declared_kind = declared_interaction_kind(command, arguments.as_ref())?;
    let is_pending = is_pending_command(command);
    let tool_kind = command
        .tool_name
        .as_deref()
        .map(map_codeengine_tool_kind)
        .unwrap_or("tool");
    let requires_approval = command.requires_approval == Some(true)
        || interaction_payload_flag(arguments.as_ref(), "requiresApproval")
        || (command.requires_approval.is_none() && is_pending && tool_kind == "approval");
    let requires_reply = command.requires_reply == Some(true)
        || interaction_payload_flag(arguments.as_ref(), "requiresReply")
        || (command.requires_reply.is_none() && is_pending && tool_kind == "user_question");

    if requires_approval && requires_reply {
        return Err(InteractionProjectionError::AmbiguousInteraction {
            tool_call_id: normalize_non_empty(command.tool_call_id.as_deref()),
        });
    }

    if let Some(declared_kind) = declared_kind {
        let conflicts_with_flag = matches!(
            (declared_kind, requires_approval, requires_reply),
            (InteractionKind::Approval, _, true) | (InteractionKind::UserQuestion, true, _)
        );
        if conflicts_with_flag {
            return Err(InteractionProjectionError::AmbiguousInteraction {
                tool_call_id: normalize_non_empty(command.tool_call_id.as_deref()),
            });
        }
        return Ok(Some(declared_kind));
    }

    Ok(if requires_approval {
        Some(InteractionKind::Approval)
    } else if requires_reply {
        Some(InteractionKind::UserQuestion)
    } else {
        None
    })
}

fn is_pending_command(command: &CodeEngineSessionCommandRecord) -> bool {
    let status = command.status.trim().to_ascii_lowercase();
    if matches!(
        status.as_str(),
        "success"
            | "succeeded"
            | "completed"
            | "approved"
            | "denied"
            | "rejected"
            | "error"
            | "failed"
            | "cancelled"
            | "canceled"
            | "terminated"
    ) {
        return false;
    }

    let runtime_status = command
        .runtime_status
        .as_deref()
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    !matches!(
        runtime_status.as_str(),
        "completed" | "failed" | "terminated" | "cancelled" | "canceled"
    )
}

fn declared_interaction_kind(
    command: &CodeEngineSessionCommandRecord,
    arguments: Option<&Value>,
) -> Result<Option<InteractionKind>, InteractionProjectionError> {
    let Some(value) = find_interaction_payload_value(arguments, "interactionKind") else {
        return Ok(None);
    };
    let interaction_kind = value.as_str().map(str::trim).ok_or_else(|| {
        InteractionProjectionError::InvalidInteractionKind {
            tool_call_id: normalize_non_empty(command.tool_call_id.as_deref()),
            interaction_kind: "non-string".to_owned(),
        }
    })?;

    match interaction_kind {
        "approval" => Ok(Some(InteractionKind::Approval)),
        "user_question" => Ok(Some(InteractionKind::UserQuestion)),
        value => Err(InteractionProjectionError::InvalidInteractionKind {
            tool_call_id: normalize_non_empty(command.tool_call_id.as_deref()),
            interaction_kind: value.to_owned(),
        }),
    }
}

fn interaction_payload_flag(arguments: Option<&Value>, field_name: &str) -> bool {
    find_interaction_payload_value(arguments, field_name).and_then(Value::as_bool) == Some(true)
}

fn find_interaction_payload_value<'a>(
    arguments: Option<&'a Value>,
    field_name: &str,
) -> Option<&'a Value> {
    let arguments = arguments?;
    arguments
        .get(field_name)
        .or_else(|| {
            arguments
                .get("toolArguments")
                .and_then(|value| value.get(field_name))
        })
        .or_else(|| {
            arguments
                .get("arguments")
                .and_then(|value| value.get(field_name))
        })
}

fn extract_native_interaction_id(
    command: &CodeEngineSessionCommandRecord,
    interaction_kind: InteractionKind,
) -> Option<String> {
    let argument_value = serde_json::from_str::<Value>(command.command.as_str()).ok();
    let mut records = Vec::new();
    if let Some(value) = argument_value.as_ref() {
        records.push(value);
        for field in [
            "toolArguments",
            "arguments",
            "request",
            "checkpoint",
            "tool",
        ] {
            if let Some(nested) = value.get(field) {
                records.push(nested);
            }
        }
    }

    let field_names: &[&str] = match interaction_kind {
        InteractionKind::Approval => &[
            "interactionId",
            "approvalId",
            "approvalID",
            "approval_id",
            "permissionId",
            "permissionID",
            "permission_id",
            "checkpointId",
            "checkpointID",
            "checkpoint_id",
            "requestId",
            "requestID",
            "request_id",
        ],
        InteractionKind::UserQuestion => &[
            "interactionId",
            "questionId",
            "questionID",
            "question_id",
            "requestId",
            "requestID",
            "request_id",
        ],
    };

    for field_name in field_names {
        for record in &records {
            if let Some(value) = record.get(*field_name).and_then(Value::as_str) {
                if let Some(value) = normalize_non_empty(Some(value)) {
                    return Some(value);
                }
            }
        }
    }

    normalize_non_empty(command.tool_call_id.as_deref())
}

fn build_interaction_payload(
    command: &CodeEngineSessionCommandRecord,
    interaction_kind: InteractionKind,
    interaction_id: String,
) -> BTreeMap<String, Value> {
    let parsed_arguments = serde_json::from_str::<Value>(command.command.as_str()).ok();
    let display_arguments = parsed_arguments
        .as_ref()
        .and_then(resolve_display_arguments)
        .map(sanitize_display_value);
    let mut payload = BTreeMap::new();
    payload.insert("interactionId".to_owned(), Value::String(interaction_id));
    payload.insert(
        "interactionKind".to_owned(),
        Value::String(interaction_kind.payload_kind().to_owned()),
    );
    payload.insert(
        "runtimeStatus".to_owned(),
        Value::String("awaiting_tool".to_owned()),
    );
    payload.insert(
        interaction_kind.requires_payload_key().to_owned(),
        Value::Bool(true),
    );

    if let Some(status) = normalize_non_empty(Some(command.status.as_str())) {
        payload.insert("status".to_owned(), Value::String(status));
    }
    if let Some(tool_name) = normalize_non_empty(command.tool_name.as_deref()) {
        payload.insert("toolName".to_owned(), Value::String(tool_name));
    }
    if let Some(tool_call_id) = normalize_non_empty(command.tool_call_id.as_deref()) {
        payload.insert("toolCallId".to_owned(), Value::String(tool_call_id));
    }
    if let Some(arguments) = display_arguments.as_ref() {
        payload.insert("toolArguments".to_owned(), arguments.clone());
    }
    if let Some(questions) = find_display_value(parsed_arguments.as_ref(), "questions") {
        payload.insert("questions".to_owned(), sanitize_display_value(questions));
    }
    if let Some(metadata) = find_display_value(parsed_arguments.as_ref(), "metadata") {
        payload.insert("metadata".to_owned(), sanitize_display_value(metadata));
    }
    if let Some(tool) = build_tool_metadata(command, parsed_arguments.as_ref()) {
        payload.insert("tool".to_owned(), tool);
    }

    payload
}

fn resolve_display_arguments(value: &Value) -> Option<&Value> {
    value
        .get("toolArguments")
        .or_else(|| value.get("arguments"))
        .or(Some(value))
}

fn find_display_value<'a>(value: Option<&'a Value>, field_name: &str) -> Option<&'a Value> {
    let value = value?;
    value
        .get(field_name)
        .or_else(|| value.get("toolArguments")?.get(field_name))
        .or_else(|| value.get("arguments")?.get(field_name))
}

fn build_tool_metadata(
    command: &CodeEngineSessionCommandRecord,
    parsed_arguments: Option<&Value>,
) -> Option<Value> {
    let source_tool = parsed_arguments.and_then(|value| value.get("tool"));
    let mut tool = Map::new();
    if let Some(tool_name) = normalize_non_empty(command.tool_name.as_deref()) {
        tool.insert("name".to_owned(), Value::String(tool_name));
    }
    if let Some(tool_call_id) = normalize_non_empty(command.tool_call_id.as_deref()) {
        tool.insert("callId".to_owned(), Value::String(tool_call_id));
    }
    if let Some(source_tool) = source_tool.and_then(Value::as_object) {
        copy_tool_metadata_value(
            source_tool,
            &mut tool,
            "messageId",
            &["messageId", "messageID"],
        );
        copy_tool_metadata_value(source_tool, &mut tool, "callId", &["callId", "callID"]);
        copy_tool_metadata_value(source_tool, &mut tool, "title", &["title"]);
        copy_tool_metadata_value(source_tool, &mut tool, "metadata", &["metadata"]);
    }

    (!tool.is_empty()).then_some(Value::Object(tool))
}

fn copy_tool_metadata_value(
    source: &Map<String, Value>,
    target: &mut Map<String, Value>,
    canonical_key: &str,
    source_keys: &[&str],
) {
    if target.contains_key(canonical_key) {
        return;
    }
    for source_key in source_keys {
        if let Some(value) = source.get(*source_key) {
            target.insert(canonical_key.to_owned(), sanitize_display_value(value));
            return;
        }
    }
}

fn sanitize_display_value(value: &Value) -> Value {
    match value {
        Value::Array(entries) => Value::Array(entries.iter().map(sanitize_display_value).collect()),
        Value::Object(entries) => {
            let mut sanitized = Map::new();
            for (key, value) in entries {
                if is_provider_identifier_key(key) {
                    continue;
                }
                sanitized.insert(key.clone(), sanitize_display_value(value));
            }
            Value::Object(sanitized)
        }
        value => value.clone(),
    }
}

fn is_provider_identifier_key(key: &str) -> bool {
    matches!(
        key,
        "interactionId"
            | "approvalId"
            | "approvalID"
            | "approval_id"
            | "permissionId"
            | "permissionID"
            | "permission_id"
            | "checkpointId"
            | "checkpointID"
            | "checkpoint_id"
            | "questionId"
            | "questionID"
            | "question_id"
            | "requestId"
            | "requestID"
            | "request_id"
            | "sessionId"
            | "sessionID"
            | "session_id"
            | "nativeSessionId"
            | "native_session_id"
            | "messageID"
            | "messageId"
            | "message_id"
            | "callID"
            | "callId"
            | "call_id"
    )
}

fn normalize_non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{project_provider_neutral_interactions, InteractionProjectionError};
    use sdkwork_birdcoder_codeengine::CodeEngineSessionCommandRecord;

    #[test]
    fn approval_projection_uses_native_checkpoint_id_and_sanitizes_provider_aliases() {
        let commands = vec![CodeEngineSessionCommandRecord {
            command: json!({
                "checkpointId": "checkpoint-native-1",
                "sessionID": "provider-session-1",
                "permission": "bash",
                "patterns": ["cargo test"],
                "metadata": {"cwd": "C:/workspace"},
                "tool": {
                    "messageID": "message-1",
                    "callID": "tool-call-1"
                }
            })
            .to_string(),
            status: "running".to_owned(),
            tool_name: Some("permission_request".to_owned()),
            tool_call_id: Some("tool-call-1".to_owned()),
            runtime_status: Some("awaiting_approval".to_owned()),
            requires_approval: Some(true),
            ..Default::default()
        }];

        let events = project_provider_neutral_interactions(Some(&commands))
            .expect("approval command should project");

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_kind, "approval.required");
        assert_eq!(
            events[0].payload.get("interactionId"),
            Some(&json!("checkpoint-native-1"))
        );
        assert_eq!(
            events[0].payload.get("interactionKind"),
            Some(&json!("approval"))
        );
        assert_eq!(
            events[0].payload.get("runtimeStatus"),
            Some(&json!("awaiting_tool"))
        );
        assert_eq!(
            events[0]
                .payload
                .get("tool")
                .and_then(|value| value.get("messageId")),
            Some(&json!("message-1"))
        );
        assert_eq!(
            events[0]
                .payload
                .get("toolArguments")
                .and_then(|value| value.get("checkpointId")),
            None
        );
        assert_eq!(
            events[0]
                .payload
                .get("toolArguments")
                .and_then(|value| value.get("sessionID")),
            None
        );
    }

    #[test]
    fn user_question_projection_preserves_questions_and_normalizes_tool_metadata() {
        let questions = json!([
            {
                "header": "Test scope",
                "question": "Which tests should run?",
                "options": [{"label": "Unit", "description": "Unit tests"}]
            }
        ]);
        let commands = vec![CodeEngineSessionCommandRecord {
            command: json!({
                "requestID": "question-native-1",
                "questions": questions,
                "tool": {
                    "messageID": "message-question-1",
                    "callID": "tool-question-1"
                }
            })
            .to_string(),
            status: "pending".to_owned(),
            tool_name: Some("user_question".to_owned()),
            tool_call_id: Some("tool-question-1".to_owned()),
            runtime_status: Some("awaiting_user".to_owned()),
            requires_reply: Some(true),
            ..Default::default()
        }];

        let events = project_provider_neutral_interactions(Some(&commands))
            .expect("question command should project");

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_kind, "user.question.required");
        assert_eq!(
            events[0].payload.get("interactionId"),
            Some(&json!("question-native-1"))
        );
        assert_eq!(
            events[0].payload.get("interactionKind"),
            Some(&json!("user_question"))
        );
        assert_eq!(events[0].payload.get("questions"), Some(&questions));
        assert_eq!(
            events[0]
                .payload
                .get("tool")
                .and_then(|value| value.get("callId")),
            Some(&json!("tool-question-1"))
        );
    }

    #[test]
    fn pending_interaction_without_native_id_fails_closed() {
        let commands = vec![CodeEngineSessionCommandRecord {
            command: "{}".to_owned(),
            status: "pending".to_owned(),
            tool_name: Some("user_question".to_owned()),
            requires_reply: Some(true),
            ..Default::default()
        }];

        let error = project_provider_neutral_interactions(Some(&commands))
            .expect_err("a missing provider-native id must not be replaced");

        assert_eq!(
            error,
            InteractionProjectionError::MissingNativeInteractionId {
                interaction_kind: "user_question",
                tool_name: Some("user_question".to_owned()),
            }
        );
    }

    #[test]
    fn canonical_interaction_kind_projects_from_awaiting_tool_state() {
        let commands = vec![CodeEngineSessionCommandRecord {
            command: json!({
                "interactionKind": "approval",
                "interactionId": "provider-approval-1",
                "toolArguments": {
                    "requestID": "provider-request-1",
                    "callID": "provider-call-1",
                    "nested": {"session_id": "provider-session-1"}
                }
            })
            .to_string(),
            status: "pending".to_owned(),
            tool_name: Some("provider.custom.approval".to_owned()),
            tool_call_id: Some("provider-call-1".to_owned()),
            runtime_status: Some("awaiting_tool".to_owned()),
            ..Default::default()
        }];

        let events = project_provider_neutral_interactions(Some(&commands))
            .expect("canonical interaction kind should project");

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].event_kind, "approval.required");
        assert_eq!(
            events[0].payload.get("interactionId"),
            Some(&json!("provider-approval-1"))
        );
        let arguments = events[0]
            .payload
            .get("toolArguments")
            .expect("display arguments are retained");
        assert!(arguments.get("requestID").is_none());
        assert!(arguments.get("callID").is_none());
        assert!(arguments
            .get("nested")
            .and_then(|value| value.get("session_id"))
            .is_none());
    }

    #[test]
    fn completed_interactions_are_not_reprojected_from_stale_flags() {
        let commands = vec![CodeEngineSessionCommandRecord {
            command: json!({"interactionId": "provider-approval-settled"}).to_string(),
            status: "approved".to_owned(),
            tool_name: Some("permission_request".to_owned()),
            tool_call_id: Some("provider-call-settled".to_owned()),
            runtime_status: Some("completed".to_owned()),
            requires_approval: Some(true),
            ..Default::default()
        }];

        assert!(project_provider_neutral_interactions(Some(&commands))
            .expect("settled command is ignored")
            .is_empty());
    }

    #[test]
    fn conflicting_declared_interaction_kind_and_reply_flag_fails_closed() {
        let commands = vec![CodeEngineSessionCommandRecord {
            command: json!({
                "interactionKind": "approval",
                "interactionId": "provider-approval-ambiguous",
                "requiresReply": true
            })
            .to_string(),
            status: "pending".to_owned(),
            tool_name: Some("provider.custom.approval".to_owned()),
            tool_call_id: Some("provider-call-ambiguous".to_owned()),
            ..Default::default()
        }];

        assert!(matches!(
            project_provider_neutral_interactions(Some(&commands)),
            Err(InteractionProjectionError::AmbiguousInteraction { .. })
        ));
    }
}
