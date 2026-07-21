use std::{
    collections::{BTreeMap, BTreeSet},
    fs::{self, File},
    path::Path,
};

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use crate::{
    bounded_json::for_each_bounded_jsonl_record, build_native_session_id,
    canonicalize_codeengine_provider_tool_name, map_codeengine_session_status_from_runtime,
    map_codeengine_tool_command_status, map_codeengine_tool_kind,
    map_codeengine_tool_runtime_status, normalize_codeengine_tool_lifecycle_status,
    resolve_codeengine_command_text, sanitize_codeengine_session_metadata,
    sanitize_codeengine_session_reasoning_records, sanitize_codeengine_session_resource_records,
    CodeEngineSessionCommandRecord, CodeEngineSessionDetailRecord, CodeEngineSessionMessageRecord,
    CodeEngineSessionNativeAttributesRecord, CodeEngineSessionReasoningRecord,
    CodeEngineSessionResourceRecord, CodeEngineSessionSummaryRecord,
};

const GEMINI_ENGINE_ID: &str = "gemini";
const MAX_GEMINI_SESSION_FILE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_GEMINI_SESSION_LINE_BYTES: usize = 16 * 1024 * 1024;
const MAX_GEMINI_SESSION_RECORDS: usize = 100_000;
const MAX_GEMINI_SESSION_MESSAGES: usize = 10_000;
const MAX_GEMINI_MESSAGE_CONTENT_CHARACTERS: usize = 1 << 20;
const MAX_GEMINI_TOOL_OUTPUT_CHARACTERS: usize = 50 * 1024;

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

#[derive(Clone, Debug, Deserialize, Serialize)]
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
    #[serde(rename = "thoughts")]
    thoughts: Vec<Value>,
}

#[derive(Default)]
struct GeminiConversationReplay {
    metadata: Map<String, Value>,
    messages: Vec<GeminiMessageRecord>,
    message_indices: BTreeMap<String, usize>,
}

impl GeminiConversationReplay {
    fn apply_record(&mut self, record: Value) -> Result<(), String> {
        let Some(object) = record.as_object() else {
            return Ok(());
        };

        if let Some(message_id) = object.get("$rewindTo").and_then(Value::as_str) {
            self.rewind_to(message_id);
            return Ok(());
        }

        if object.get("id").and_then(Value::as_str).is_some() {
            self.upsert_message(record)?;
            return Ok(());
        }

        if let Some(updates) = object.get("$set").and_then(Value::as_object) {
            if let Some(messages) = updates.get("messages").and_then(Value::as_array) {
                self.replace_messages(messages)?;
            }
            self.merge_metadata(updates);
            return Ok(());
        }

        let is_metadata = object.get("sessionId").and_then(Value::as_str).is_some()
            && object.get("projectHash").and_then(Value::as_str).is_some();
        if !is_metadata {
            return Ok(());
        }

        if let Some(messages) = object.get("messages").and_then(Value::as_array) {
            for message in messages {
                self.upsert_message(message.clone())?;
            }
        }
        self.merge_metadata(object);
        Ok(())
    }

    fn merge_metadata(&mut self, metadata: &Map<String, Value>) {
        for (key, value) in metadata {
            if matches!(
                key.as_str(),
                "sessionId"
                    | "projectHash"
                    | "startTime"
                    | "lastUpdated"
                    | "summary"
                    | "memoryScratchpad"
                    | "directories"
                    | "kind"
                    | "title"
                    | "model"
            ) {
                self.metadata.insert(key.clone(), value.clone());
            }
        }
    }

    fn replace_messages(&mut self, messages: &[Value]) -> Result<(), String> {
        self.messages.clear();
        self.message_indices.clear();
        for message in messages {
            self.upsert_message(message.clone())?;
        }
        Ok(())
    }

    fn upsert_message(&mut self, value: Value) -> Result<(), String> {
        let message = match serde_json::from_value::<GeminiMessageRecord>(value) {
            Ok(message) => message,
            Err(_) => return Ok(()),
        };
        let Some(message_id) = normalize_non_empty_string(message.id.as_deref()) else {
            return Ok(());
        };

        if let Some(index) = self.message_indices.get(message_id.as_str()).copied() {
            self.messages[index] = message;
            return Ok(());
        }
        if self.messages.len() >= MAX_GEMINI_SESSION_MESSAGES {
            return Err(format!(
                "Gemini CLI session exceeds {MAX_GEMINI_SESSION_MESSAGES} messages"
            ));
        }

        let index = self.messages.len();
        self.messages.push(message);
        self.message_indices.insert(message_id, index);
        Ok(())
    }

    fn rewind_to(&mut self, message_id: &str) {
        if let Some(index) = self.message_indices.get(message_id).copied() {
            self.messages.truncate(index);
        } else {
            self.messages.clear();
        }
        self.rebuild_message_indices();
    }

    fn rebuild_message_indices(&mut self) {
        self.message_indices.clear();
        for (index, message) in self.messages.iter().enumerate() {
            if let Some(message_id) = normalize_non_empty_string(message.id.as_deref()) {
                self.message_indices.insert(message_id, index);
            }
        }
    }

    fn finish(mut self, path: &Path) -> Result<GeminiConversationRecord, String> {
        self.metadata.insert(
            "messages".to_owned(),
            serde_json::to_value(self.messages).map_err(|error| {
                format!(
                    "serialize replayed Gemini CLI messages from {} failed: {error}",
                    path.display()
                )
            })?,
        );
        serde_json::from_value(Value::Object(self.metadata)).map_err(|error| {
            format!(
                "project Gemini CLI JSONL session {} failed: {error}",
                path.display()
            )
        })
    }
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
    let file_size = fs::metadata(path)
        .map_err(|error| {
            format!(
                "inspect Gemini CLI session file {} failed: {error}",
                path.display()
            )
        })?
        .len();
    if file_size > MAX_GEMINI_SESSION_FILE_BYTES {
        return Err(format!(
            "Gemini CLI session file {} exceeds {MAX_GEMINI_SESSION_FILE_BYTES} bytes",
            path.display()
        ));
    }

    if path
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("jsonl"))
    {
        return read_gemini_jsonl_conversation_record(path);
    }

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

fn read_gemini_jsonl_conversation_record(path: &Path) -> Result<GeminiConversationRecord, String> {
    let file = File::open(path).map_err(|error| {
        format!(
            "open Gemini CLI JSONL session {} failed: {error}",
            path.display()
        )
    })?;
    let mut replay = GeminiConversationReplay::default();
    let mut record_count = 0usize;
    let mut replay_error = None;
    for_each_bounded_jsonl_record(file, MAX_GEMINI_SESSION_LINE_BYTES, |_, record| {
        if replay_error.is_some() || record.iter().all(|byte| byte.is_ascii_whitespace()) {
            return;
        }
        record_count = record_count.saturating_add(1);
        if record_count > MAX_GEMINI_SESSION_RECORDS {
            replay_error = Some(format!(
                "Gemini CLI JSONL session {} exceeds {MAX_GEMINI_SESSION_RECORDS} records",
                path.display()
            ));
            return;
        }

        let Ok(record) = serde_json::from_slice::<Value>(record) else {
            return;
        };
        if let Err(error) = replay.apply_record(record) {
            replay_error = Some(error);
        }
    })
    .map_err(|error| {
        format!(
            "read Gemini CLI JSONL session {} failed: {error}",
            path.display()
        )
    })?;
    if let Some(error) = replay_error {
        return Err(error);
    }

    replay.finish(path)
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
    let mut current_turn_id = None;
    let mut messages = Vec::new();
    for (index, message) in conversation.messages.iter().enumerate() {
        let raw_message_id = resolve_gemini_message_id(index, message);
        if message.message_type.trim().eq_ignore_ascii_case("user") {
            current_turn_id = Some(raw_message_id.clone());
        }
        let turn_id = current_turn_id
            .clone()
            .unwrap_or_else(|| raw_message_id.clone());
        let record = build_gemini_message_record(
            summary.id.as_str(),
            raw_message_id.as_str(),
            turn_id.as_str(),
            message,
            &summary.updated_at,
        );
        if gemini_message_record_has_payload(&record) {
            messages.push(record);
        }
    }
    CodeEngineSessionDetailRecord { summary, messages }
}

fn gemini_message_record_has_payload(message: &CodeEngineSessionMessageRecord) -> bool {
    !message.content.trim().is_empty()
        || message
            .commands
            .as_ref()
            .is_some_and(|commands| !commands.is_empty())
        || message
            .tool_calls
            .as_ref()
            .is_some_and(|tool_calls| !tool_calls.is_empty())
        || message
            .file_changes
            .as_ref()
            .is_some_and(|file_changes| !file_changes.is_empty())
        || message
            .resources
            .as_ref()
            .is_some_and(|resources| !resources.is_empty())
        || message
            .reasoning
            .as_ref()
            .is_some_and(|reasoning| !reasoning.is_empty())
        || message.task_progress.is_some()
}

fn build_gemini_message_record(
    session_id: &str,
    raw_message_id: &str,
    turn_id: &str,
    message: &GeminiMessageRecord,
    fallback_timestamp: &str,
) -> CodeEngineSessionMessageRecord {
    let message_type = message.message_type.trim().to_ascii_lowercase();
    let commands = build_gemini_tool_commands(message.tool_calls.as_slice());
    let file_changes = build_gemini_file_changes(message.tool_calls.as_slice());
    let reasoning = if message_type == "gemini" {
        build_gemini_message_reasoning(raw_message_id, message.thoughts.as_slice())
    } else {
        Vec::new()
    };
    let resources = sanitize_codeengine_session_resource_records(
        extract_gemini_message_resources([
            message.display_content.as_ref(),
            Some(&message.content),
        ])
        .as_slice(),
    );
    let task_progress = build_gemini_task_progress(message.tool_calls.as_slice());
    let content = message
        .display_content
        .as_ref()
        .map(part_list_union_to_string)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| part_list_union_to_string(&message.content));
    let content = truncate_gemini_text(content.as_str(), MAX_GEMINI_MESSAGE_CONTENT_CHARACTERS);
    let mut metadata = BTreeMap::new();
    metadata.insert("geminiMessageType".to_owned(), message_type.clone());
    if let Some(model) = normalize_non_empty_string(message.model.as_deref()) {
        metadata.insert("modelId".to_owned(), model);
    }
    if message_type == "error" {
        metadata.insert("noticeKind".to_owned(), "failed".to_owned());
    } else if message_type == "warning" {
        metadata.insert("noticeKind".to_owned(), "warning".to_owned());
    }

    CodeEngineSessionMessageRecord {
        id: format!("{session_id}:native-message:{raw_message_id}"),
        turn_id: Some(turn_id.to_owned()),
        role: match message_type.as_str() {
            "user" => "user".to_owned(),
            "gemini" => "assistant".to_owned(),
            "tool" => "tool".to_owned(),
            _ => "system".to_owned(),
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
        file_changes: if file_changes.is_empty() {
            None
        } else {
            Some(file_changes)
        },
        reasoning: if reasoning.is_empty() {
            None
        } else {
            Some(reasoning)
        },
        resources: if resources.is_empty() {
            None
        } else {
            Some(resources)
        },
        task_progress,
        metadata: Some(metadata),
        created_at: normalize_non_empty_string(message.timestamp.as_deref())
            .unwrap_or_else(|| fallback_timestamp.to_owned()),
    }
}

fn resolve_gemini_message_id(index: usize, message: &GeminiMessageRecord) -> String {
    normalize_non_empty_string(message.id.as_deref())
        .unwrap_or_else(|| format!("message-{}", index + 1))
}

fn build_gemini_message_reasoning(
    raw_message_id: &str,
    thoughts: &[Value],
) -> Vec<CodeEngineSessionReasoningRecord> {
    let records = thoughts
        .iter()
        .enumerate()
        .filter_map(|(index, thought)| {
            let subject = normalize_value_string(thought.get("subject"));
            let description = normalize_value_string(thought.get("description"));
            let summary = description.clone().or_else(|| subject.clone())?;
            Some(CodeEngineSessionReasoningRecord {
                id: format!("{raw_message_id}:thought:{}", index + 1),
                summary,
                title: description.and(subject),
                created_at: normalize_non_empty_string(
                    thought.get("timestamp").and_then(Value::as_str),
                ),
                started_at: None,
                completed_at: None,
                duration_ms: None,
            })
        })
        .collect::<Vec<_>>();
    sanitize_codeengine_session_reasoning_records(records.as_slice())
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
            let status = resolve_gemini_tool_status(tool_call);
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

fn gemini_tool_completed(tool_call: &Value) -> bool {
    resolve_gemini_tool_status(tool_call)
        .as_deref()
        .and_then(normalize_codeengine_tool_lifecycle_status)
        == Some("completed")
}

fn build_gemini_file_changes(tool_calls: &[Value]) -> Vec<Value> {
    tool_calls
        .iter()
        .filter(|tool_call| gemini_tool_completed(tool_call))
        .filter_map(|tool_call| {
            let result_display = tool_call.get("resultDisplay")?.as_object()?;
            let diff = normalize_value_string(result_display.get("fileDiff"))?;
            let path = normalize_value_string(result_display.get("filePath"))
                .or_else(|| normalize_value_string(result_display.get("fileName")))?
                .replace('\\', "/");
            let diff_stat = result_display.get("diffStat").and_then(Value::as_object);
            let (derived_additions, derived_deletions) = count_gemini_diff_lines(diff.as_str());
            let additions = diff_stat
                .and_then(|stat| {
                    read_gemini_non_negative_integer(stat.get("model_added_lines"))
                        .or_else(|| read_gemini_non_negative_integer(stat.get("added")))
                        .or_else(|| read_gemini_non_negative_integer(stat.get("additions")))
                })
                .unwrap_or(derived_additions);
            let deletions = diff_stat
                .and_then(|stat| {
                    read_gemini_non_negative_integer(stat.get("model_removed_lines"))
                        .or_else(|| read_gemini_non_negative_integer(stat.get("removed")))
                        .or_else(|| read_gemini_non_negative_integer(stat.get("deletions")))
                })
                .unwrap_or(derived_deletions);
            let mut file_change = serde_json::Map::new();
            file_change.insert("path".to_owned(), Value::String(path));
            file_change.insert("additions".to_owned(), Value::from(additions));
            file_change.insert("deletions".to_owned(), Value::from(deletions));
            file_change.insert("lineImpactKnown".to_owned(), Value::Bool(true));
            file_change.insert("diff".to_owned(), Value::String(diff));
            if let Some(content) = result_display.get("newContent").cloned() {
                file_change.insert("content".to_owned(), content);
            }
            if let Some(original_content) = result_display.get("originalContent").cloned() {
                file_change.insert("originalContent".to_owned(), original_content);
            }
            Some(Value::Object(file_change))
        })
        .collect()
}

fn build_gemini_task_progress(tool_calls: &[Value]) -> Option<Value> {
    tool_calls.iter().rev().find_map(|tool_call| {
        if !gemini_tool_completed(tool_call) {
            return None;
        }
        let todos = tool_call
            .get("resultDisplay")?
            .as_object()?
            .get("todos")?
            .as_array()?;
        if todos.is_empty() {
            return None;
        }
        let completed = todos
            .iter()
            .filter(|todo| {
                normalize_value_string(todo.get("status"))
                    .as_deref()
                    .and_then(normalize_codeengine_tool_lifecycle_status)
                    == Some("completed")
            })
            .count();
        Some(serde_json::json!({
            "total": todos.len(),
            "completed": completed,
        }))
    })
}

fn read_gemini_non_negative_integer(value: Option<&Value>) -> Option<u64> {
    match value {
        Some(Value::Number(value)) => value
            .as_u64()
            .or_else(|| value.as_i64().map(|value| value.max(0) as u64)),
        Some(Value::String(value)) => value.trim().parse::<u64>().ok(),
        _ => None,
    }
}

fn count_gemini_diff_lines(diff: &str) -> (u64, u64) {
    let mut additions = 0_u64;
    let mut deletions = 0_u64;
    for line in diff.replace("\r\n", "\n").replace('\r', "\n").lines() {
        if line.starts_with("+++") || line.starts_with("---") {
            continue;
        }
        if line.starts_with('+') {
            additions += 1;
        } else if line.starts_with('-') {
            deletions += 1;
        }
    }
    (additions, deletions)
}

fn extract_gemini_tool_output(tool_call: &Value) -> Option<String> {
    normalize_value_content(tool_call.get("resultDisplay"))
        .or_else(|| normalize_value_content(tool_call.get("result")))
        .map(|output| truncate_gemini_text(output.as_str(), MAX_GEMINI_TOOL_OUTPUT_CHARACTERS))
}

fn truncate_gemini_text(value: &str, limit: usize) -> String {
    if value.chars().count() <= limit {
        return value.to_owned();
    }

    let mut truncated = value
        .chars()
        .take(limit.saturating_sub(20))
        .collect::<String>();
    truncated.push_str("\n...[truncated]");
    truncated
}

fn normalize_value_content(value: Option<&Value>) -> Option<String> {
    let value = value?;
    match value {
        Value::Null => None,
        Value::String(value) => normalize_non_empty_string(Some(value.as_str())),
        Value::Array(values) => {
            if values.iter().all(|value| {
                value
                    .as_object()
                    .and_then(|record| record.get("text"))
                    .and_then(Value::as_str)
                    .is_some()
            }) {
                let content = values
                    .iter()
                    .filter_map(|value| value.get("text").and_then(Value::as_str))
                    .collect::<String>();
                return normalize_non_empty_string(Some(content.as_str()));
            }
            let content = values
                .iter()
                .filter_map(|value| normalize_value_content(Some(value)))
                .collect::<Vec<_>>()
                .join("\n");
            normalize_non_empty_string(Some(content.as_str()))
        }
        Value::Object(record) => {
            let stdout = normalize_value_content(record.get("stdout"));
            let stderr = normalize_value_content(record.get("stderr"));
            if stdout.is_some() || stderr.is_some() {
                return normalize_non_empty_string(Some(
                    [stdout, stderr]
                        .into_iter()
                        .flatten()
                        .collect::<Vec<_>>()
                        .join("\n")
                        .as_str(),
                ));
            }

            let mut fragments = Vec::new();
            if let Some(output) = normalize_value_content(record.get("output")) {
                fragments.push(output);
            }
            if record
                .get("error")
                .is_some_and(has_meaningful_gemini_error_value)
            {
                if let Some(error) = normalize_value_content(record.get("error")) {
                    if !fragments.contains(&error) {
                        fragments.push(error);
                    }
                }
            }
            if !fragments.is_empty() {
                return normalize_non_empty_string(Some(fragments.join("\n").as_str()));
            }

            [
                "message",
                "text",
                "summary",
                "response",
                "functionResponse",
                "result",
                "content",
                "parts",
                "responseParts",
            ]
            .into_iter()
            .find_map(|field| normalize_value_content(record.get(field)))
        }
        _ => Some(value.to_string()),
    }
}

fn resolve_gemini_tool_status(tool_call: &Value) -> Option<String> {
    let native_status = normalize_value_string(tool_call.get("status"));
    let native_lifecycle = native_status
        .as_deref()
        .and_then(normalize_codeengine_tool_lifecycle_status);
    if native_lifecycle == Some("cancelled") || gemini_value_has_cancellation(tool_call, 0) {
        return Some("cancelled".to_owned());
    }
    if gemini_value_has_error(tool_call, 0) {
        return Some("error".to_owned());
    }
    native_status
}

fn has_meaningful_gemini_error_value(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(value) => *value,
        Value::String(value) => {
            !value.trim().is_empty() && !value.trim().eq_ignore_ascii_case("false")
        }
        Value::Number(value) => value.as_i64().is_some_and(|value| value != 0),
        Value::Array(values) => values.iter().any(has_meaningful_gemini_error_value),
        Value::Object(record) => !record.is_empty(),
    }
}

fn gemini_value_has_error(value: &Value, depth: usize) -> bool {
    if depth >= 8 {
        return false;
    }
    if let Value::Array(values) = value {
        return values
            .iter()
            .any(|value| gemini_value_has_error(value, depth + 1));
    }
    let Some(record) = value.as_object() else {
        return false;
    };
    if record
        .get("isError")
        .or_else(|| record.get("is_error"))
        .is_some_and(|value| match value {
            Value::Bool(value) => *value,
            Value::String(value) => value.trim().eq_ignore_ascii_case("true"),
            _ => false,
        })
        || record
            .get("error")
            .is_some_and(has_meaningful_gemini_error_value)
        || normalize_value_string(record.get("type")).is_some_and(|value| {
            let normalized = value.trim().to_ascii_lowercase();
            normalized == "error" || normalized.ends_with("_error")
        })
    {
        return true;
    }
    [
        "content",
        "functionResponse",
        "output",
        "response",
        "responseParts",
        "result",
        "resultDisplay",
        "parts",
    ]
    .into_iter()
    .filter_map(|field| record.get(field))
    .any(|value| gemini_value_has_error(value, depth + 1))
}

fn gemini_value_has_cancellation(value: &Value, depth: usize) -> bool {
    if depth >= 8 {
        return false;
    }
    if let Value::String(value) = value {
        let normalized = value.trim().trim_start_matches('[').to_ascii_lowercase();
        let normalized = normalized.trim_end_matches(']').trim();
        return matches!(normalized, "cancelled" | "canceled")
            || ["operation", "request", "tool", "command", "user"]
                .into_iter()
                .any(|subject| {
                    normalized == format!("{subject} cancelled")
                        || normalized == format!("{subject} canceled")
                        || normalized.starts_with(format!("{subject} was cancelled").as_str())
                        || normalized.starts_with(format!("{subject} was canceled").as_str())
                        || normalized.starts_with(format!("{subject} cancelled ").as_str())
                        || normalized.starts_with(format!("{subject} canceled ").as_str())
                })
            || normalized.starts_with("cancelled ")
            || normalized.starts_with("canceled ");
    }
    if let Value::Array(values) = value {
        return values
            .iter()
            .any(|value| gemini_value_has_cancellation(value, depth + 1));
    }
    let Some(record) = value.as_object() else {
        return false;
    };
    if ["aborted", "canceled", "cancelled", "interrupted"]
        .into_iter()
        .any(|field| record.get(field).and_then(Value::as_bool) == Some(true))
    {
        return true;
    }
    [
        "error",
        "functionResponse",
        "response",
        "responseParts",
        "result",
        "resultDisplay",
        "parts",
    ]
    .into_iter()
    .filter_map(|field| record.get(field))
    .any(|value| gemini_value_has_cancellation(value, depth + 1))
}

fn resolve_gemini_session_runtime_status(messages: &[GeminiMessageRecord]) -> &'static str {
    for message in messages.iter().rev() {
        let message_type = message.message_type.trim().to_ascii_lowercase();
        if message_type == "error" {
            return "failed";
        }
        if !is_meaningful_message(message) {
            continue;
        }
        for tool_call in message.tool_calls.iter().rev() {
            let tool_name =
                normalize_value_string(tool_call.get("name")).unwrap_or_else(|| "tool".to_owned());
            let kind = map_codeengine_tool_kind(tool_name.as_str());
            let status = resolve_gemini_tool_status(tool_call);
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
    ) && (!part_list_union_to_string(&message.content)
        .trim()
        .is_empty()
        || message
            .display_content
            .as_ref()
            .is_some_and(|value| !part_list_union_to_string(value).trim().is_empty())
        || gemini_value_has_message_resource(&message.content, 0)
        || message
            .display_content
            .as_ref()
            .is_some_and(|value| gemini_value_has_message_resource(value, 0))
        || !message.thoughts.is_empty()
        || !message.tool_calls.is_empty())
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
        Value::Object(record) => {
            let record_type = normalize_value_string(record.get("type"))
                .unwrap_or_default()
                .to_ascii_lowercase();
            if record.get("thought").and_then(Value::as_bool) == Some(true)
                || matches!(record_type.as_str(), "thought" | "thinking")
            {
                return String::new();
            }
            normalize_value_string(record.get("text")).unwrap_or_default()
        }
        _ => String::new(),
    }
}

fn extract_gemini_message_resources(
    values: [Option<&Value>; 2],
) -> Vec<CodeEngineSessionResourceRecord> {
    let mut resources = Vec::new();
    for value in values.into_iter().flatten() {
        collect_gemini_message_resources(value, &mut resources, 0);
    }
    let mut seen = BTreeSet::new();
    resources
        .into_iter()
        .filter(|resource| seen.insert(gemini_resource_dedupe_key(resource)))
        .take(32)
        .collect()
}

fn gemini_value_has_message_resource(value: &Value, depth: usize) -> bool {
    if depth > 8 {
        return false;
    }
    match value {
        Value::Array(values) => values
            .iter()
            .any(|value| gemini_value_has_message_resource(value, depth + 1)),
        Value::Object(record) => {
            record.contains_key("inlineData")
                || record.contains_key("inline_data")
                || record.contains_key("fileData")
                || record.contains_key("file_data")
                || ["parts", "content", "message"].into_iter().any(|key| {
                    record
                        .get(key)
                        .is_some_and(|value| gemini_value_has_message_resource(value, depth + 1))
                })
        }
        _ => false,
    }
}

fn collect_gemini_message_resources(
    value: &Value,
    output: &mut Vec<CodeEngineSessionResourceRecord>,
    depth: usize,
) {
    if depth > 8 || output.len() >= 64 {
        return;
    }
    match value {
        Value::Array(values) => {
            for value in values {
                collect_gemini_message_resources(value, output, depth + 1);
            }
        }
        Value::Object(record) => {
            if let Some(inline_data) = record
                .get("inlineData")
                .or_else(|| record.get("inline_data"))
                .and_then(Value::as_object)
            {
                if let Some(data) = normalize_value_string(inline_data.get("data")) {
                    let mime_type = normalize_value_string(
                        inline_data
                            .get("mimeType")
                            .or_else(|| inline_data.get("mime_type")),
                    )
                    .unwrap_or_else(|| "application/octet-stream".to_owned());
                    let kind = gemini_resource_kind_for_mime(mime_type.as_str());
                    let media_source = if data.starts_with("data:") {
                        data
                    } else {
                        format!("data:{mime_type};base64,{data}")
                    };
                    output.push(CodeEngineSessionResourceRecord {
                        id: format!("gemini-inline-data-{}", output.len() + 1),
                        kind: kind.to_owned(),
                        name: normalize_value_string(
                            inline_data
                                .get("displayName")
                                .or_else(|| inline_data.get("display_name"))
                                .or_else(|| inline_data.get("name")),
                        ),
                        path: None,
                        uri: None,
                        media_source: Some(media_source),
                        mime_type: Some(mime_type),
                        description: None,
                        origin: None,
                        citation: None,
                    });
                }
            }
            if let Some(file_data) = record
                .get("fileData")
                .or_else(|| record.get("file_data"))
                .and_then(Value::as_object)
            {
                if let Some(uri) = normalize_value_string(
                    file_data
                        .get("fileUri")
                        .or_else(|| file_data.get("file_uri"))
                        .or_else(|| file_data.get("uri")),
                ) {
                    let mime_type = normalize_value_string(
                        file_data
                            .get("mimeType")
                            .or_else(|| file_data.get("mime_type")),
                    );
                    let kind = mime_type
                        .as_deref()
                        .map(gemini_resource_kind_for_mime)
                        .unwrap_or("uri");
                    output.push(CodeEngineSessionResourceRecord {
                        id: format!("gemini-file-data-{}", output.len() + 1),
                        kind: kind.to_owned(),
                        name: normalize_value_string(
                            file_data
                                .get("displayName")
                                .or_else(|| file_data.get("display_name"))
                                .or_else(|| file_data.get("name")),
                        ),
                        path: None,
                        uri: Some(uri.clone()),
                        media_source: matches!(kind, "image" | "audio").then_some(uri),
                        mime_type,
                        description: None,
                        origin: None,
                        citation: None,
                    });
                }
            }
            for key in ["parts", "content", "message"] {
                if let Some(value) = record.get(key) {
                    collect_gemini_message_resources(value, output, depth + 1);
                }
            }
        }
        _ => {}
    }
}

fn gemini_resource_kind_for_mime(mime_type: &str) -> &'static str {
    let normalized = mime_type.trim().to_ascii_lowercase();
    if normalized.starts_with("image/") {
        "image"
    } else if normalized.starts_with("audio/") {
        "audio"
    } else {
        "file"
    }
}

fn gemini_resource_dedupe_key(resource: &CodeEngineSessionResourceRecord) -> String {
    let media_source = resource.media_source.as_deref().unwrap_or_default();
    let media_prefix = media_source.chars().take(128).collect::<String>();
    format!(
        "{}\u{1f}{}\u{1f}{}\u{1f}{}\u{1f}{}:{}",
        resource.kind,
        resource.name.as_deref().unwrap_or_default(),
        resource.uri.as_deref().unwrap_or_default(),
        resource.mime_type.as_deref().unwrap_or_default(),
        media_source.len(),
        media_prefix,
    )
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
