use std::{collections::BTreeMap, fs, path::Path};

use serde::Deserialize;
use serde_json::Value;

use crate::{
    build_native_session_id, canonicalize_codeengine_provider_tool_name,
    map_codeengine_session_status_from_runtime, map_codeengine_tool_command_status,
    map_codeengine_tool_kind, map_codeengine_tool_runtime_status, resolve_codeengine_command_text,
    sanitize_codeengine_session_metadata, CodeEngineSessionCommandRecord,
    CodeEngineSessionDetailRecord, CodeEngineSessionMessageRecord,
    CodeEngineSessionNativeAttributesRecord, CodeEngineSessionSummaryRecord,
};

const GEMINI_ENGINE_ID: &str = "gemini";

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct GeminiConversationRecord {
    session_id: String,
    #[serde(default)]
    project_hash: String,
    start_time: String,
    last_updated: String,
    #[serde(default)]
    messages: Vec<GeminiMessageRecord>,
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    summary: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    kind: Option<String>,
    #[serde(default, flatten)]
    extra: BTreeMap<String, Value>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiMessageRecord {
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    timestamp: Option<String>,
    #[serde(default, rename = "type")]
    message_type: String,
    #[serde(default)]
    content: Value,
    #[serde(default)]
    display_content: Option<Value>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    tool_calls: Vec<Value>,
    #[serde(default)]
    thoughts: Vec<Value>,
}

impl GeminiConversationRecord {
    pub(super) fn session_id(&self) -> &str {
        self.session_id.trim()
    }

    pub(super) fn project_hash(&self) -> &str {
        self.project_hash.trim()
    }
}

pub(super) fn read_gemini_conversation_record(
    path: &Path,
) -> Result<GeminiConversationRecord, String> {
    let contents = fs::read_to_string(path).map_err(|error| {
        format!(
            "read Gemini CLI session file {} failed: {error}",
            path.display()
        )
    })?;
    serde_json::from_str(contents.as_str()).map_err(|error| {
        format!(
            "parse Gemini CLI session file {} failed: {error}",
            path.display()
        )
    })
}

pub(super) fn build_gemini_session_summary(
    conversation: &GeminiConversationRecord,
    native_cwd: Option<&str>,
) -> Option<CodeEngineSessionSummaryRecord> {
    let raw_session_id = normalize_non_empty_string(Some(conversation.session_id.as_str()))?;
    let created_at = normalize_non_empty_string(Some(conversation.start_time.as_str()))?;
    let updated_at = normalize_non_empty_string(Some(conversation.last_updated.as_str()))?;
    if conversation
        .kind
        .as_deref()
        .is_some_and(|kind| kind.trim().eq_ignore_ascii_case("subagent"))
        || !conversation.messages.iter().any(is_meaningful_message)
    {
        return None;
    }

    let native_cwd = normalize_native_cwd(native_cwd);
    let title = conversation
        .title
        .as_deref()
        .and_then(normalize_title)
        .or_else(|| conversation.summary.as_deref().and_then(normalize_title))
        .or_else(|| first_user_message_title(conversation.messages.as_slice()))
        .or_else(|| working_directory_title(native_cwd.as_deref()))
        .unwrap_or_else(|| {
            format!(
                "Gemini session {}",
                shorten_session_id(raw_session_id.as_str())
            )
        });
    let model_id = conversation
        .messages
        .iter()
        .rev()
        .find_map(|message| normalize_non_empty_string(message.model.as_deref()))
        .or_else(|| normalize_non_empty_string(conversation.model.as_deref()))
        .unwrap_or_else(|| "gemini".to_owned());
    let runtime_status = resolve_gemini_session_runtime_status(conversation.messages.as_slice());
    let sort_timestamp = parse_timestamp_millis(updated_at.as_str())
        .or_else(|| parse_timestamp_millis(created_at.as_str()))
        .unwrap_or_default();
    let native_title = conversation
        .title
        .as_deref()
        .and_then(normalize_title)
        .or_else(|| conversation.summary.as_deref().and_then(normalize_title));
    let preview = first_user_message_title(conversation.messages.as_slice());
    let mut native_metadata = sanitize_codeengine_session_metadata(&Value::Object(
        conversation.extra.clone().into_iter().collect(),
    ));
    for (key, value) in [
        ("kind", conversation.kind.as_ref()),
        ("model", conversation.model.as_ref()),
        ("summary", conversation.summary.as_ref()),
        ("title", conversation.title.as_ref()),
    ] {
        if let Some(value) = value {
            native_metadata.insert(key.to_owned(), Value::String(value.clone()));
        }
    }
    let native_attributes = CodeEngineSessionNativeAttributesRecord {
        session_tree_id: Some(raw_session_id.clone()),
        title: native_title,
        preview,
        model_provider: Some("google".to_owned()),
        project_id: normalize_non_empty_string(Some(conversation.project_hash.as_str())),
        cwd: native_cwd.clone(),
        agent_role: normalize_non_empty_string(conversation.kind.as_deref()),
        is_sidechain: conversation
            .kind
            .as_deref()
            .is_some_and(|kind| kind.trim().eq_ignore_ascii_case("subagent")),
        metadata: native_metadata,
        ..Default::default()
    };

    Some(CodeEngineSessionSummaryRecord {
        created_at,
        id: build_native_session_id(GEMINI_ENGINE_ID, raw_session_id.as_str()),
        title,
        status: map_codeengine_session_status_from_runtime(runtime_status).to_owned(),
        runtime_status: Some(runtime_status.to_owned()),
        host_mode: "desktop".to_owned(),
        engine_id: GEMINI_ENGINE_ID.to_owned(),
        model_id,
        updated_at: updated_at.clone(),
        last_turn_at: Some(updated_at.clone()),
        kind: "coding".to_owned(),
        native_cwd,
        sort_timestamp,
        transcript_updated_at: Some(updated_at),
        workspace_id: None,
        project_id: None,
        native_attributes,
    })
}

pub(super) fn build_gemini_session_detail(
    conversation: GeminiConversationRecord,
    summary: CodeEngineSessionSummaryRecord,
) -> CodeEngineSessionDetailRecord {
    let messages = conversation
        .messages
        .iter()
        .enumerate()
        .map(|(index, message)| {
            build_gemini_message_record(summary.id.as_str(), index, message, &summary.updated_at)
        })
        .collect();
    CodeEngineSessionDetailRecord { summary, messages }
}

fn build_gemini_message_record(
    session_id: &str,
    index: usize,
    message: &GeminiMessageRecord,
    fallback_timestamp: &str,
) -> CodeEngineSessionMessageRecord {
    let raw_message_id = normalize_non_empty_string(message.id.as_deref())
        .unwrap_or_else(|| format!("message-{}", index + 1));
    let message_type = message.message_type.trim().to_ascii_lowercase();
    let commands = build_gemini_tool_commands(message.tool_calls.as_slice());
    let content = message
        .display_content
        .as_ref()
        .map(part_list_union_to_string)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| part_list_union_to_string(&message.content));
    let content = if content.trim().is_empty() {
        fallback_gemini_message_content(message, commands.as_slice())
    } else {
        content
    };
    let mut metadata = BTreeMap::new();
    metadata.insert("geminiMessageType".to_owned(), message_type.clone());
    if let Some(model) = normalize_non_empty_string(message.model.as_deref()) {
        metadata.insert("modelId".to_owned(), model);
    }

    CodeEngineSessionMessageRecord {
        id: format!("{session_id}:native-message:{raw_message_id}"),
        turn_id: Some(raw_message_id),
        role: match message_type.as_str() {
            "user" => "user".to_owned(),
            "gemini" => "assistant".to_owned(),
            _ => "tool".to_owned(),
        },
        content,
        commands: if commands.is_empty() {
            None
        } else {
            Some(commands)
        },
        tool_calls: if message.tool_calls.is_empty() {
            None
        } else {
            Some(message.tool_calls.clone())
        },
        tool_call_id: None,
        file_changes: None,
        task_progress: None,
        metadata: Some(metadata),
        created_at: normalize_non_empty_string(message.timestamp.as_deref())
            .unwrap_or_else(|| fallback_timestamp.to_owned()),
    }
}

fn build_gemini_tool_commands(tool_calls: &[Value]) -> Vec<CodeEngineSessionCommandRecord> {
    tool_calls
        .iter()
        .filter_map(|tool_call| {
            let raw_tool_name = normalize_value_string(tool_call.get("name"))?;
            let tool_name = canonicalize_codeengine_provider_tool_name(
                GEMINI_ENGINE_ID,
                raw_tool_name.as_str(),
                raw_tool_name.as_str(),
            );
            let kind = map_codeengine_tool_kind(tool_name.as_str()).to_owned();
            let status = normalize_value_string(tool_call.get("status"));
            let command_status = map_codeengine_tool_command_status(status.as_deref(), None);
            let args = tool_call.get("args");
            let fallback_arguments = args.and_then(|value| serde_json::to_string(value).ok());
            let runtime_status =
                map_codeengine_tool_runtime_status(kind.as_str(), status.as_deref(), None);

            Some(CodeEngineSessionCommandRecord {
                command: resolve_codeengine_command_text(
                    tool_name.as_str(),
                    args,
                    fallback_arguments.as_deref(),
                ),
                status: command_status,
                output: extract_gemini_tool_output(tool_call),
                kind: Some(kind.clone()),
                tool_name: Some(tool_name),
                tool_call_id: normalize_value_string(tool_call.get("id")),
                runtime_status: Some(runtime_status.to_owned()),
                requires_approval: Some(kind == "approval"),
                requires_reply: Some(kind == "user_question"),
            })
        })
        .collect()
}

fn extract_gemini_tool_output(tool_call: &Value) -> Option<String> {
    normalize_value_content(tool_call.get("resultDisplay"))
        .or_else(|| normalize_value_content(tool_call.get("result")))
}

fn normalize_value_content(value: Option<&Value>) -> Option<String> {
    let value = value?;
    match value {
        Value::Null => None,
        Value::String(value) => normalize_non_empty_string(Some(value.as_str())),
        Value::Array(values) => {
            let content = values
                .iter()
                .filter_map(|value| normalize_value_content(Some(value)))
                .collect::<Vec<_>>()
                .join("\n");
            normalize_non_empty_string(Some(content.as_str()))
        }
        Value::Object(record) => ["output", "error", "message", "text"]
            .into_iter()
            .find_map(|field| normalize_value_content(record.get(field)))
            .or_else(|| normalize_value_content(record.get("response")))
            .or_else(|| normalize_value_content(record.get("functionResponse")))
            .or_else(|| serde_json::to_string(value).ok()),
        _ => Some(value.to_string()),
    }
}

fn fallback_gemini_message_content(
    message: &GeminiMessageRecord,
    commands: &[CodeEngineSessionCommandRecord],
) -> String {
    let thought_content = message
        .thoughts
        .iter()
        .filter_map(|thought| {
            normalize_value_string(thought.get("description"))
                .or_else(|| normalize_value_string(thought.get("subject")))
        })
        .collect::<Vec<_>>()
        .join("\n");
    if !thought_content.trim().is_empty() {
        return thought_content;
    }
    if !commands.is_empty() {
        return commands
            .iter()
            .map(|command| format!("{}: {}", command.status, command.command))
            .collect::<Vec<_>>()
            .join("\n");
    }
    match message.message_type.trim().to_ascii_lowercase().as_str() {
        "info" => "Gemini CLI information message.".to_owned(),
        "warning" => "Gemini CLI warning.".to_owned(),
        "error" => "Gemini CLI error.".to_owned(),
        _ => String::new(),
    }
}

fn resolve_gemini_session_runtime_status(messages: &[GeminiMessageRecord]) -> &'static str {
    for message in messages.iter().rev() {
        if !is_meaningful_message(message) {
            continue;
        }
        for tool_call in message.tool_calls.iter().rev() {
            let tool_name =
                normalize_value_string(tool_call.get("name")).unwrap_or_else(|| "tool".to_owned());
            let kind = map_codeengine_tool_kind(tool_name.as_str());
            let status = normalize_value_string(tool_call.get("status"));
            let runtime_status = map_codeengine_tool_runtime_status(kind, status.as_deref(), None);
            if runtime_status != "completed" {
                return runtime_status;
            }
        }
        return "completed";
    }
    "completed"
}

fn is_meaningful_message(message: &GeminiMessageRecord) -> bool {
    matches!(
        message.message_type.trim().to_ascii_lowercase().as_str(),
        "user" | "gemini"
    )
}

fn first_user_message_title(messages: &[GeminiMessageRecord]) -> Option<String> {
    let mut user_messages = messages
        .iter()
        .filter(|message| message.message_type.trim().eq_ignore_ascii_case("user"));
    let preferred = user_messages.clone().find_map(|message| {
        let content = part_list_union_to_string(&message.content);
        let trimmed = content.trim();
        if trimmed.is_empty() || trimmed.starts_with('/') || trimmed.starts_with('?') {
            None
        } else {
            normalize_title(trimmed)
        }
    });
    preferred.or_else(|| {
        user_messages
            .find_map(|message| normalize_title(&part_list_union_to_string(&message.content)))
    })
}

fn part_list_union_to_string(value: &Value) -> String {
    match value {
        Value::Null => String::new(),
        Value::String(value) => value.clone(),
        Value::Array(values) => values
            .iter()
            .map(part_list_union_to_string)
            .collect::<Vec<_>>()
            .join(""),
        Value::Object(record) => normalize_value_string(record.get("text"))
            .or_else(|| {
                record
                    .get("functionCall")
                    .and_then(|value| normalize_value_string(value.get("name")))
                    .map(|name| format!("[Function Call: {name}]"))
            })
            .or_else(|| {
                record
                    .get("functionResponse")
                    .and_then(|value| normalize_value_string(value.get("name")))
                    .map(|name| format!("[Function Response: {name}]"))
            })
            .unwrap_or_default(),
        _ => value.to_string(),
    }
}

fn normalize_value_string(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(value)) => normalize_non_empty_string(Some(value.as_str())),
        Some(Value::Number(value)) => Some(value.to_string()),
        Some(Value::Bool(value)) => Some(value.to_string()),
        _ => None,
    }
}

fn normalize_title(value: &str) -> Option<String> {
    const TITLE_LIMIT: usize = 120;
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return None;
    }
    if normalized.chars().count() <= TITLE_LIMIT {
        return Some(normalized);
    }

    let truncated = normalized
        .chars()
        .take(TITLE_LIMIT.saturating_sub(3))
        .collect::<String>();
    Some(format!("{}...", truncated.trim_end()))
}

fn working_directory_title(native_cwd: Option<&str>) -> Option<String> {
    let native_cwd = normalize_non_empty_string(native_cwd)?;
    native_cwd
        .trim_end_matches(['/', '\\'])
        .rsplit(['/', '\\'])
        .find_map(normalize_title)
}

fn normalize_native_cwd(value: Option<&str>) -> Option<String> {
    normalize_non_empty_string(value).map(|value| value.replace('\\', "/"))
}

fn normalize_non_empty_string(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_owned())
    }
}

fn shorten_session_id(value: &str) -> String {
    value.trim().chars().take(8).collect()
}

fn parse_timestamp_millis(value: &str) -> Option<i64> {
    let parsed =
        time::OffsetDateTime::parse(value.trim(), &time::format_description::well_known::Rfc3339)
            .ok()?;
    Some((parsed.unix_timestamp_nanos() / 1_000_000) as i64)
}
