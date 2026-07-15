use std::{
    collections::BTreeMap,
    env, fs,
    fs::File,
    io::{BufRead, BufReader, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::Value;

use crate::{
    build_native_session_id, extract_native_lookup_id_for_engine, find_codeengine_descriptor,
    map_codeengine_session_status_from_runtime, CodeEngineSessionDetailRecord,
    CodeEngineSessionMessageRecord, CodeEngineSessionNativeAttributesRecord,
    CodeEngineSessionSummaryRecord,
};

pub const CLAUDE_CONFIG_DIR_ENV: &str = "CLAUDE_CONFIG_DIR";

const CLAUDE_CODE_ENGINE_ID: &str = "claude-code";
const CLAUDE_PROJECTS_DIRECTORY_NAME: &str = "projects";
const CLAUDE_SUMMARY_CHUNK_BYTE_LIMIT: u64 = 64 * 1024;
const CLAUDE_TITLE_CHAR_LIMIT: usize = 200;

#[derive(Clone)]
struct ClaudeTimestamp {
    text: String,
    millis: i64,
}

#[derive(Clone)]
struct ClaudeTranscriptEntry {
    created_at: Option<String>,
    metadata: Option<BTreeMap<String, String>>,
    raw_message_id: Option<String>,
    role: String,
    text: String,
    tool_calls: Option<Vec<Value>>,
    turn_id: Option<String>,
}

#[derive(Default)]
struct ClaudeSessionParseContext {
    ai_title: Option<String>,
    command_title_fallback: Option<String>,
    created_at: Option<ClaudeTimestamp>,
    custom_title: Option<String>,
    first_entry_sidechain: Option<bool>,
    first_prompt: Option<String>,
    has_error: bool,
    has_transcript: bool,
    last_prompt: Option<String>,
    latest_timestamp: Option<ClaudeTimestamp>,
    latest_transcript_timestamp: Option<ClaudeTimestamp>,
    message_index_by_id: BTreeMap<String, usize>,
    messages: Vec<ClaudeTranscriptEntry>,
    model_id: Option<String>,
    native_cwd: Option<String>,
    native_session_id: Option<String>,
    native_attributes: CodeEngineSessionNativeAttributesRecord,
    summary: Option<String>,
}

struct ClaudeMessageContent {
    text: String,
    tool_calls: Vec<Value>,
}

pub fn list_claude_code_session_summaries() -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
    let Some(config_directory) = resolve_claude_config_directory() else {
        return Ok(Vec::new());
    };
    list_claude_code_session_summaries_from_config_directory(config_directory.as_path())
}

pub fn get_claude_code_session_detail(
    session_id: &str,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    let lookup_id = extract_native_lookup_id_for_engine(session_id, CLAUDE_CODE_ENGINE_ID)?;
    let Some(config_directory) = resolve_claude_config_directory() else {
        return Ok(None);
    };
    get_claude_code_session_detail_from_config_directory(
        config_directory.as_path(),
        lookup_id.as_str(),
    )
}

fn resolve_claude_config_directory() -> Option<PathBuf> {
    if let Some(configured) = non_empty_environment_path(CLAUDE_CONFIG_DIR_ENV) {
        return Some(configured);
    }

    non_empty_environment_path("USERPROFILE")
        .or_else(|| non_empty_environment_path("HOME"))
        .map(|home_directory| home_directory.join(".claude"))
}

fn non_empty_environment_path(name: &str) -> Option<PathBuf> {
    let value = env::var_os(name)?;
    if value.to_string_lossy().trim().is_empty() {
        None
    } else {
        Some(PathBuf::from(value))
    }
}

fn list_claude_code_session_summaries_from_config_directory(
    config_directory: &Path,
) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
    let mut summaries_by_identity = BTreeMap::<String, CodeEngineSessionSummaryRecord>::new();

    for file_path in list_claude_code_session_files(config_directory)? {
        let summary = match parse_claude_code_session_summary(file_path.as_path()) {
            Ok(Some(summary)) => summary,
            Ok(None) => continue,
            Err(error) => {
                tracing::warn!(
                    path = %file_path.display(),
                    error = %error,
                    "skipping unreadable Claude Code session summary"
                );
                continue;
            }
        };
        let identity = claude_session_identity(summary.id.as_str());
        let should_replace = summaries_by_identity
            .get(identity.as_str())
            .map(|existing| compare_claude_session_recency(&summary, existing).is_lt())
            .unwrap_or(true);
        if should_replace {
            summaries_by_identity.insert(identity, summary);
        }
    }

    let mut summaries = summaries_by_identity.into_values().collect::<Vec<_>>();
    summaries.sort_by(compare_claude_session_recency);
    Ok(summaries)
}

fn get_claude_code_session_detail_from_config_directory(
    config_directory: &Path,
    lookup_id: &str,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    let lookup_identity = claude_session_identity(lookup_id);
    let session_files = list_claude_code_session_files(config_directory)?;
    let (direct_candidates, fallback_candidates) = session_files
        .into_iter()
        .partition::<Vec<_>, _>(|file_path| {
            file_path
                .file_stem()
                .and_then(|value| value.to_str())
                .map(claude_session_identity)
                .as_deref()
                == Some(lookup_identity.as_str())
        });

    for candidates in [direct_candidates, fallback_candidates] {
        let mut resolved_detail: Option<CodeEngineSessionDetailRecord> = None;
        for file_path in candidates {
            let detail = match parse_claude_code_session_detail(file_path.as_path()) {
                Ok(Some(detail)) => detail,
                Ok(None) => continue,
                Err(error) => {
                    tracing::warn!(
                        path = %file_path.display(),
                        error = %error,
                        "skipping unreadable Claude Code session detail"
                    );
                    continue;
                }
            };
            if claude_session_identity(detail.summary.id.as_str()) != lookup_identity {
                continue;
            }

            let should_replace = resolved_detail
                .as_ref()
                .map(|existing| {
                    compare_claude_session_recency(&detail.summary, &existing.summary).is_lt()
                })
                .unwrap_or(true);
            if should_replace {
                resolved_detail = Some(detail);
            }
        }
        if resolved_detail.is_some() {
            return Ok(resolved_detail);
        }
    }

    Ok(None)
}

fn list_claude_code_session_files(config_directory: &Path) -> Result<Vec<PathBuf>, String> {
    let projects_directory = config_directory.join(CLAUDE_PROJECTS_DIRECTORY_NAME);
    if !projects_directory.exists() {
        return Ok(Vec::new());
    }

    let mut file_paths = Vec::new();
    collect_claude_jsonl_files(projects_directory.as_path(), &mut file_paths)?;
    file_paths.sort();
    Ok(file_paths)
}

fn collect_claude_jsonl_files(
    directory: &Path,
    file_paths: &mut Vec<PathBuf>,
) -> Result<(), String> {
    let entries = fs::read_dir(directory).map_err(|error| {
        format!(
            "read Claude Code session directory {} failed: {error}",
            directory.display()
        )
    })?;

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };
        let path = entry.path();
        if file_type.is_dir() {
            if let Err(error) = collect_claude_jsonl_files(path.as_path(), file_paths) {
                tracing::warn!(
                    path = %path.display(),
                    error = %error,
                    "skipping unreadable Claude Code project history directory"
                );
            }
            continue;
        }
        if file_type.is_file()
            && path
                .extension()
                .and_then(|value| value.to_str())
                .is_some_and(|value| value.eq_ignore_ascii_case("jsonl"))
        {
            file_paths.push(path);
        }
    }

    Ok(())
}

fn parse_claude_code_session_summary(
    file_path: &Path,
) -> Result<Option<CodeEngineSessionSummaryRecord>, String> {
    let metadata = match fs::metadata(file_path) {
        Ok(metadata) if metadata.is_file() && metadata.len() > 0 => metadata,
        Ok(_) | Err(_) => return Ok(None),
    };
    let mut context = ClaudeSessionParseContext::default();

    if metadata.len() <= CLAUDE_SUMMARY_CHUNK_BYTE_LIMIT * 2 {
        let bytes = fs::read(file_path).map_err(|error| {
            format!(
                "read Claude Code session file {} failed: {error}",
                file_path.display()
            )
        })?;
        let contents = String::from_utf8_lossy(bytes.as_slice());
        apply_claude_jsonl_chunk(&mut context, contents.as_ref(), false, false, false);
    } else {
        let mut file = File::open(file_path).map_err(|error| {
            format!(
                "open Claude Code session file {} failed: {error}",
                file_path.display()
            )
        })?;
        let mut head = vec![0_u8; CLAUDE_SUMMARY_CHUNK_BYTE_LIMIT as usize];
        file.read_exact(head.as_mut_slice()).map_err(|error| {
            format!(
                "read Claude Code session head {} failed: {error}",
                file_path.display()
            )
        })?;
        let tail_offset = metadata
            .len()
            .saturating_sub(CLAUDE_SUMMARY_CHUNK_BYTE_LIMIT);
        file.seek(SeekFrom::Start(tail_offset)).map_err(|error| {
            format!(
                "seek Claude Code session tail {} failed: {error}",
                file_path.display()
            )
        })?;
        let mut tail = Vec::with_capacity(CLAUDE_SUMMARY_CHUNK_BYTE_LIMIT as usize);
        file.read_to_end(&mut tail).map_err(|error| {
            format!(
                "read Claude Code session tail {} failed: {error}",
                file_path.display()
            )
        })?;

        let head_contents = String::from_utf8_lossy(head.as_slice());
        apply_claude_jsonl_chunk(&mut context, head_contents.as_ref(), false, false, true);
        let tail_contents = String::from_utf8_lossy(tail.as_slice());
        apply_claude_jsonl_chunk(&mut context, tail_contents.as_ref(), false, true, false);
    }

    build_claude_session_detail(file_path, &metadata, context, false)
        .map(|detail| detail.map(|detail| detail.summary))
}

fn parse_claude_code_session_detail(
    file_path: &Path,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    let file = match File::open(file_path) {
        Ok(file) => file,
        Err(_) => return Ok(None),
    };
    let metadata = file.metadata().map_err(|error| {
        format!(
            "read Claude Code session metadata {} failed: {error}",
            file_path.display()
        )
    })?;
    if !metadata.is_file() || metadata.len() == 0 {
        return Ok(None);
    }

    let mut context = ClaudeSessionParseContext::default();
    for (line_index, line) in BufReader::new(file).lines().enumerate() {
        let line = match line {
            Ok(line) => line,
            Err(_) => continue,
        };
        apply_claude_jsonl_line(&mut context, line.as_str(), true, line_index);
    }

    build_claude_session_detail(file_path, &metadata, context, true)
}

fn apply_claude_jsonl_chunk(
    context: &mut ClaudeSessionParseContext,
    contents: &str,
    include_messages: bool,
    skip_leading_partial_line: bool,
    skip_trailing_partial_line: bool,
) {
    if !skip_leading_partial_line && context.first_entry_sidechain.is_none() {
        let first_line = contents.split('\n').next().unwrap_or_default();
        if first_line.contains("\"isSidechain\":true")
            || first_line.contains("\"isSidechain\": true")
        {
            context.first_entry_sidechain = Some(true);
        }
    }

    let lines = contents.split('\n').collect::<Vec<_>>();
    let first_index = usize::from(skip_leading_partial_line).min(lines.len());
    let mut last_index = lines.len();
    if skip_trailing_partial_line && !contents.ends_with('\n') {
        last_index = last_index.saturating_sub(1);
    }

    for (line_index, line) in lines[first_index..last_index].iter().enumerate() {
        apply_claude_jsonl_line(
            context,
            line.trim_end_matches('\r'),
            include_messages,
            line_index,
        );
    }
}

fn apply_claude_jsonl_line(
    context: &mut ClaudeSessionParseContext,
    line: &str,
    include_messages: bool,
    line_index: usize,
) {
    if line.trim().is_empty() {
        return;
    }
    let envelope = match serde_json::from_str::<Value>(line) {
        Ok(envelope) => envelope,
        Err(_) => return,
    };

    if context.first_entry_sidechain.is_none() {
        context.first_entry_sidechain = Some(
            envelope
                .get("isSidechain")
                .and_then(Value::as_bool)
                .unwrap_or(false),
        );
    }
    observe_claude_native_session_attributes(context, &envelope);
    if envelope
        .get("isSidechain")
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return;
    }

    context.native_session_id = context.native_session_id.clone().or_else(|| {
        normalize_value_string(envelope.get("sessionId"))
            .or_else(|| normalize_value_string(envelope.get("session_id")))
    });
    context.native_cwd = context
        .native_cwd
        .clone()
        .or_else(|| normalize_value_string(envelope.get("cwd")));
    context.native_attributes.cwd = context.native_cwd.clone();
    context.model_id =
        normalize_value_string(envelope.get("model")).or_else(|| context.model_id.clone());

    if let Some(timestamp) = parse_claude_timestamp(envelope.get("timestamp")) {
        observe_claude_timestamp(context, timestamp, false);
    }

    if let Some(custom_title) = normalize_value_string(envelope.get("customTitle")) {
        context.custom_title = normalize_claude_title(custom_title.as_str());
    }
    if let Some(ai_title) = normalize_value_string(envelope.get("aiTitle")) {
        context.ai_title = normalize_claude_title(ai_title.as_str());
    }
    if let Some(last_prompt) = normalize_value_string(envelope.get("lastPrompt")) {
        context.last_prompt = normalize_claude_title(last_prompt.as_str());
    }

    let entry_type = normalize_value_string(envelope.get("type"));
    match entry_type.as_deref() {
        Some("summary") | Some("task-summary") => {
            if let Some(summary) = normalize_value_string(envelope.get("summary")) {
                context.summary = normalize_claude_title(summary.as_str());
            }
        }
        Some("result") => {
            context.has_error = envelope
                .get("is_error")
                .and_then(Value::as_bool)
                .unwrap_or(false)
                || normalize_value_string(envelope.get("subtype"))
                    .is_some_and(|value| value != "success");
        }
        Some("user") | Some("assistant") => apply_claude_transcript_line(
            context,
            &envelope,
            entry_type.as_deref().unwrap_or("assistant"),
            include_messages,
            line_index,
        ),
        _ => {}
    }
}

fn observe_claude_native_session_attributes(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
) {
    let attributes = &mut context.native_attributes;
    attributes.is_sidechain |= envelope
        .get("isSidechain")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    attributes.parent_session_id = normalize_value_string(
        envelope
            .get("parentSessionId")
            .or_else(|| envelope.get("parent_session_id")),
    )
    .or_else(|| attributes.parent_session_id.clone());
    attributes.source = normalize_value_string(
        envelope
            .get("entrypoint")
            .or_else(|| envelope.get("entryPoint")),
    )
    .or_else(|| attributes.source.clone());
    attributes.provider_version = normalize_value_string(envelope.get("version"))
        .or_else(|| attributes.provider_version.clone());
    attributes.git_branch =
        normalize_value_string(envelope.get("gitBranch")).or_else(|| attributes.git_branch.clone());
    attributes.agent_name = normalize_value_string(
        envelope
            .get("agentName")
            .or_else(|| envelope.get("agentId")),
    )
    .or_else(|| attributes.agent_name.clone());

    for key in [
        "aiTitle",
        "customTitle",
        "entrypoint",
        "gitBranch",
        "isSidechain",
        "lastPrompt",
        "slug",
        "summary",
        "version",
    ] {
        if let Some(value) = envelope.get(key).filter(|value| !value.is_null()) {
            attributes.metadata.insert(key.to_owned(), value.clone());
        }
    }
}

fn apply_claude_transcript_line(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
    role: &str,
    include_messages: bool,
    line_index: usize,
) {
    if envelope
        .get("isMeta")
        .and_then(Value::as_bool)
        .unwrap_or(false)
        || envelope
            .get("isCompactSummary")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        || (role == "user" && envelope.get("toolUseResult").is_some())
    {
        return;
    }

    let message = envelope.get("message");
    if role == "assistant" {
        context.model_id = normalize_value_string(message.and_then(|value| value.get("model")))
            .or_else(|| context.model_id.clone());
    }
    let content = extract_claude_message_content(
        message
            .and_then(|value| value.get("content"))
            .or_else(|| envelope.get("content")),
    );
    if content.text.is_empty() && content.tool_calls.is_empty() {
        return;
    }

    context.has_transcript = true;
    let timestamp = parse_claude_timestamp(envelope.get("timestamp"));
    if let Some(timestamp) = timestamp.clone() {
        observe_claude_timestamp(context, timestamp, true);
    }

    if role == "user" && context.first_prompt.is_none() {
        let (title, command_fallback) = normalize_claude_first_prompt(content.text.as_str());
        if let Some(title) = title {
            context.first_prompt = Some(title);
        } else if context.command_title_fallback.is_none() {
            context.command_title_fallback = command_fallback;
        }
    }

    if !include_messages {
        return;
    }

    let raw_message_id = normalize_value_string(envelope.get("uuid"))
        .or_else(|| normalize_value_string(message.and_then(|value| value.get("id"))));
    let turn_id = normalize_value_string(envelope.get("requestId"))
        .or_else(|| normalize_value_string(envelope.get("request_id")))
        .or_else(|| normalize_value_string(message.and_then(|value| value.get("id"))));
    let metadata = build_claude_message_metadata(envelope, message);
    let transcript_entry = ClaudeTranscriptEntry {
        created_at: timestamp.map(|timestamp| timestamp.text),
        metadata,
        raw_message_id: raw_message_id.clone(),
        role: role.to_owned(),
        text: content.text,
        tool_calls: if content.tool_calls.is_empty() {
            None
        } else {
            Some(content.tool_calls)
        },
        turn_id,
    };

    if let Some(raw_message_id) = raw_message_id {
        let message_identity = raw_message_id.trim().to_ascii_lowercase();
        if let Some(existing_index) = context.message_index_by_id.get(&message_identity).copied() {
            context.messages[existing_index] = transcript_entry;
            return;
        }
        context
            .message_index_by_id
            .insert(message_identity, context.messages.len());
    } else {
        context.message_index_by_id.insert(
            format!("anonymous:{line_index}:{}", context.messages.len()),
            context.messages.len(),
        );
    }
    context.messages.push(transcript_entry);
}

fn extract_claude_message_content(content: Option<&Value>) -> ClaudeMessageContent {
    let Some(content) = content else {
        return ClaudeMessageContent {
            text: String::new(),
            tool_calls: Vec::new(),
        };
    };
    if let Some(text) = normalize_value_string(Some(content)) {
        return ClaudeMessageContent {
            text,
            tool_calls: Vec::new(),
        };
    }

    let mut text_fragments = Vec::new();
    let mut fallback_fragments = Vec::new();
    let mut tool_calls = Vec::new();
    for block in content.as_array().into_iter().flatten() {
        match block.get("type").and_then(Value::as_str) {
            Some("text") => {
                if let Some(text) = normalize_value_string(block.get("text")) {
                    text_fragments.push(text);
                }
            }
            Some("tool_use") => {
                tool_calls.push(block.clone());
                let tool_name =
                    normalize_value_string(block.get("name")).unwrap_or_else(|| "tool".to_owned());
                fallback_fragments.push(format!("Tool call: {tool_name}"));
            }
            Some("image") => fallback_fragments.push("Image attachment.".to_owned()),
            Some("document") => fallback_fragments.push("Document attachment.".to_owned()),
            _ => {}
        }
    }

    ClaudeMessageContent {
        text: if text_fragments.is_empty() {
            fallback_fragments.join("\n")
        } else {
            text_fragments.join("\n")
        },
        tool_calls,
    }
}

fn build_claude_message_metadata(
    envelope: &Value,
    message: Option<&Value>,
) -> Option<BTreeMap<String, String>> {
    let mut metadata = BTreeMap::new();
    if let Some(model_id) = normalize_value_string(message.and_then(|value| value.get("model"))) {
        metadata.insert("modelId".to_owned(), model_id);
    }
    if let Some(cwd) = normalize_value_string(envelope.get("cwd")) {
        metadata.insert("cwd".to_owned(), cwd);
    }
    if let Some(git_branch) = normalize_value_string(envelope.get("gitBranch")) {
        metadata.insert("gitBranch".to_owned(), git_branch);
    }
    if metadata.is_empty() {
        None
    } else {
        Some(metadata)
    }
}

fn observe_claude_timestamp(
    context: &mut ClaudeSessionParseContext,
    timestamp: ClaudeTimestamp,
    transcript_timestamp: bool,
) {
    let replace_created = context
        .created_at
        .as_ref()
        .map(|current| timestamp.millis < current.millis)
        .unwrap_or(true);
    if replace_created {
        context.created_at = Some(timestamp.clone());
    }
    let replace_latest = context
        .latest_timestamp
        .as_ref()
        .map(|current| timestamp.millis >= current.millis)
        .unwrap_or(true);
    if replace_latest {
        context.latest_timestamp = Some(timestamp.clone());
    }
    if transcript_timestamp {
        let replace_latest_transcript = context
            .latest_transcript_timestamp
            .as_ref()
            .map(|current| timestamp.millis >= current.millis)
            .unwrap_or(true);
        if replace_latest_transcript {
            context.latest_transcript_timestamp = Some(timestamp);
        }
    }
}

fn build_claude_session_detail(
    file_path: &Path,
    metadata: &fs::Metadata,
    context: ClaudeSessionParseContext,
    include_messages: bool,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    if context.first_entry_sidechain == Some(true) || !context.has_transcript {
        return Ok(None);
    }

    let raw_session_id = context
        .native_session_id
        .clone()
        .or_else(|| {
            file_path
                .file_stem()
                .and_then(|value| value.to_str())
                .and_then(normalize_non_empty_string)
        })
        .ok_or_else(|| {
            format!(
                "resolve native Claude Code session id from {} failed.",
                file_path.display()
            )
        })?;
    let summary_id = build_native_session_id(CLAUDE_CODE_ENGINE_ID, raw_session_id.as_str());
    if summary_id.is_empty() {
        return Ok(None);
    }

    let file_modified_timestamp = timestamp_from_system_time(metadata.modified().ok());
    let updated_timestamp = resolve_later_timestamp(
        context.latest_timestamp.clone(),
        Some(file_modified_timestamp.clone()),
    )
    .unwrap_or(file_modified_timestamp);
    let created_at = context
        .created_at
        .as_ref()
        .map(|value| value.text.clone())
        .unwrap_or_else(|| updated_timestamp.text.clone());
    let last_turn_at = context
        .latest_transcript_timestamp
        .as_ref()
        .map(|value| value.text.clone())
        .or(Some(updated_timestamp.text.clone()));
    let title = context
        .custom_title
        .clone()
        .or(context.ai_title.clone())
        .or(context.last_prompt.clone())
        .or(context.summary.clone())
        .or(context.first_prompt.clone())
        .or(context.command_title_fallback.clone())
        .or_else(|| derive_claude_cwd_title(context.native_cwd.as_deref()))
        .unwrap_or_else(|| format!("Session {}", shorten_claude_session_id(summary_id.as_str())));
    let model_id = context.model_id.clone().unwrap_or_else(|| {
        find_codeengine_descriptor(CLAUDE_CODE_ENGINE_ID)
            .map(|descriptor| descriptor.default_model_id)
            .unwrap_or_else(|| "claude-sonnet-4-6".to_owned())
    });
    let runtime_status = if context.has_error {
        "failed"
    } else {
        "completed"
    };
    let status = map_codeengine_session_status_from_runtime(runtime_status).to_owned();

    let mut native_attributes = context.native_attributes.clone();
    native_attributes.session_tree_id = Some(raw_session_id);
    native_attributes.title = context
        .custom_title
        .clone()
        .or_else(|| context.ai_title.clone());
    native_attributes.preview = context
        .last_prompt
        .clone()
        .or_else(|| context.first_prompt.clone())
        .or_else(|| context.summary.clone());
    native_attributes.cwd = context.native_cwd.clone();
    if let Some(first_prompt) = context.first_prompt.as_ref() {
        native_attributes.metadata.insert(
            "firstPrompt".to_owned(),
            Value::String(first_prompt.clone()),
        );
    }

    let summary = CodeEngineSessionSummaryRecord {
        created_at: created_at.clone(),
        id: summary_id.clone(),
        title,
        status,
        runtime_status: Some(runtime_status.to_owned()),
        host_mode: "desktop".to_owned(),
        engine_id: CLAUDE_CODE_ENGINE_ID.to_owned(),
        model_id,
        updated_at: updated_timestamp.text.clone(),
        last_turn_at,
        kind: "coding".to_owned(),
        native_cwd: context.native_cwd.clone(),
        sort_timestamp: updated_timestamp.millis,
        transcript_updated_at: context
            .latest_transcript_timestamp
            .as_ref()
            .map(|value| value.text.clone()),
        workspace_id: None,
        project_id: None,
        native_attributes,
    };
    let messages = if include_messages {
        context
            .messages
            .into_iter()
            .enumerate()
            .map(|(message_index, message)| {
                let message_identity = message
                    .raw_message_id
                    .clone()
                    .unwrap_or_else(|| format!("anonymous:{}", message_index + 1));
                CodeEngineSessionMessageRecord {
                    id: format!("{summary_id}:native-message:{message_identity}"),
                    turn_id: message.turn_id,
                    role: message.role,
                    content: message.text,
                    commands: None,
                    tool_calls: message.tool_calls,
                    tool_call_id: None,
                    file_changes: None,
                    task_progress: None,
                    metadata: message.metadata,
                    created_at: message.created_at.unwrap_or_else(|| created_at.clone()),
                }
            })
            .collect()
    } else {
        Vec::new()
    };

    Ok(Some(CodeEngineSessionDetailRecord { summary, messages }))
}

fn normalize_claude_first_prompt(value: &str) -> (Option<String>, Option<String>) {
    let normalized = collapse_whitespace(value);
    if normalized.is_empty() {
        return (None, None);
    }
    if let Some(command_name) = extract_xml_tag_text(normalized.as_str(), "command-name") {
        return (None, normalize_claude_title(command_name.as_str()));
    }
    if normalized.starts_with("[Request interrupted by user") || normalized.starts_with('<') {
        return (None, None);
    }
    (normalize_claude_title(normalized.as_str()), None)
}

fn normalize_claude_title(value: &str) -> Option<String> {
    let normalized = collapse_whitespace(value);
    if normalized.is_empty() {
        return None;
    }
    let mut characters = normalized.chars();
    let truncated = characters
        .by_ref()
        .take(CLAUDE_TITLE_CHAR_LIMIT)
        .collect::<String>();
    if characters.next().is_some() {
        Some(format!("{}...", truncated.trim_end()))
    } else {
        Some(truncated)
    }
}

fn collapse_whitespace(value: &str) -> String {
    value.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn extract_xml_tag_text(value: &str, tag_name: &str) -> Option<String> {
    let opening_tag = format!("<{tag_name}>");
    let closing_tag = format!("</{tag_name}>");
    let start = value.find(opening_tag.as_str())? + opening_tag.len();
    let end = value[start..].find(closing_tag.as_str())? + start;
    normalize_non_empty_string(&value[start..end])
}

fn derive_claude_cwd_title(cwd: Option<&str>) -> Option<String> {
    let cwd = normalize_non_empty_string(cwd?)?;
    cwd.trim_end_matches(['/', '\\'])
        .rsplit(['/', '\\'])
        .find(|segment| !segment.trim().is_empty())
        .and_then(normalize_claude_title)
}

fn shorten_claude_session_id(value: &str) -> String {
    let normalized = value.trim();
    normalized.chars().take(8).collect()
}

fn claude_session_identity(value: &str) -> String {
    value.trim().to_ascii_lowercase()
}

fn compare_claude_session_recency(
    left: &CodeEngineSessionSummaryRecord,
    right: &CodeEngineSessionSummaryRecord,
) -> std::cmp::Ordering {
    right
        .sort_timestamp
        .cmp(&left.sort_timestamp)
        .then_with(|| left.id.cmp(&right.id))
}

fn normalize_value_string(value: Option<&Value>) -> Option<String> {
    normalize_non_empty_string(value?.as_str()?)
}

fn normalize_non_empty_string(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}

fn parse_claude_timestamp(value: Option<&Value>) -> Option<ClaudeTimestamp> {
    let value = value?;
    if let Some(text) = value.as_str().and_then(normalize_non_empty_string) {
        let parsed = time::OffsetDateTime::parse(
            text.as_str(),
            &time::format_description::well_known::Rfc3339,
        )
        .ok()?;
        return Some(ClaudeTimestamp {
            millis: (parsed.unix_timestamp_nanos() / 1_000_000) as i64,
            text,
        });
    }

    let numeric = value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|value| i64::try_from(value).ok()))?;
    let millis = if numeric.unsigned_abs() < 100_000_000_000 {
        numeric.saturating_mul(1_000)
    } else {
        numeric
    };
    Some(ClaudeTimestamp {
        text: timestamp_from_millis(millis),
        millis,
    })
}

fn timestamp_from_system_time(value: Option<SystemTime>) -> ClaudeTimestamp {
    let millis = value
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|duration| i64::try_from(duration.as_millis()).unwrap_or(i64::MAX))
        .unwrap_or_default();
    ClaudeTimestamp {
        text: timestamp_from_millis(millis),
        millis,
    }
}

fn timestamp_from_millis(value: i64) -> String {
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

fn resolve_later_timestamp(
    left: Option<ClaudeTimestamp>,
    right: Option<ClaudeTimestamp>,
) -> Option<ClaudeTimestamp> {
    match (left, right) {
        (Some(left), Some(right)) if left.millis >= right.millis => Some(left),
        (Some(_), Some(right)) => Some(right),
        (Some(left), None) => Some(left),
        (None, Some(right)) => Some(right),
        (None, None) => None,
    }
}

#[cfg(test)]
mod tests {
    use std::{
        fs,
        path::{Path, PathBuf},
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    use serde_json::{json, Value};

    use super::{
        get_claude_code_session_detail_from_config_directory,
        list_claude_code_session_summaries_from_config_directory, parse_claude_code_session_detail,
        parse_claude_code_session_summary,
    };

    static TEMP_DIRECTORY_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn claude_session_parser_projects_metadata_and_visible_messages() {
        let fixture = TestDirectory::new("parser");
        let session_id = "11111111-1111-4111-8111-111111111111";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-birdcoder")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "parentUuid": null,
                    "isSidechain": false,
                    "cwd": "E:/workspace/birdcoder",
                    "entrypoint": "cli",
                    "gitBranch": "feature/native-session-attributes",
                    "sessionId": session_id,
                    "slug": "native-history",
                    "version": "2.1.172",
                    "type": "user",
                    "message": {
                        "role": "user",
                        "content": [{"type": "text", "text": "Inspect every provider session"}]
                    },
                    "uuid": "user-message-1",
                    "timestamp": "2099-07-15T00:00:00Z"
                }),
                json!({
                    "parentUuid": "user-message-1",
                    "isSidechain": false,
                    "cwd": "E:/workspace/birdcoder",
                    "sessionId": session_id,
                    "type": "assistant",
                    "message": {
                        "id": "assistant-turn-1",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [
                            {"type": "text", "text": "I found the native history."},
                            {
                                "type": "tool_use",
                                "id": "tool-use-1",
                                "name": "Read",
                                "input": {"file_path": "src/session.ts"}
                            }
                        ]
                    },
                    "uuid": "assistant-message-1",
                    "timestamp": "2099-07-15T00:00:01Z"
                }),
                json!({
                    "parentUuid": "assistant-message-1",
                    "isSidechain": false,
                    "cwd": "E:/workspace/birdcoder",
                    "sessionId": session_id,
                    "type": "user",
                    "toolUseResult": {"ok": true},
                    "message": {
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": "tool-use-1",
                            "content": "file contents"
                        }]
                    },
                    "uuid": "tool-result-1",
                    "timestamp": "2099-07-15T00:00:02Z"
                }),
                json!({
                    "type": "summary",
                    "summary": "Generated summary"
                }),
                json!({
                    "type": "ai-title",
                    "sessionId": session_id,
                    "aiTitle": "Generated title"
                }),
                json!({
                    "type": "last-prompt",
                    "sessionId": session_id,
                    "lastPrompt": "Latest prompt"
                }),
                json!({
                    "type": "custom-title",
                    "sessionId": session_id,
                    "customTitle": "  Native   Claude history  "
                }),
            ],
        );

        let summary = parse_claude_code_session_summary(session_path.as_path())
            .expect("parse Claude summary")
            .expect("Claude summary");
        assert_eq!(summary.id, session_id);
        assert_eq!(summary.title, "Native Claude history");
        assert_eq!(summary.model_id, "claude-sonnet-4-6");
        assert_eq!(
            summary.native_attributes.session_tree_id.as_deref(),
            Some(session_id)
        );
        assert_eq!(summary.native_attributes.source.as_deref(), Some("cli"));
        assert_eq!(
            summary.native_attributes.provider_version.as_deref(),
            Some("2.1.172")
        );
        assert_eq!(
            summary.native_attributes.git_branch.as_deref(),
            Some("feature/native-session-attributes")
        );
        assert_eq!(summary.native_attributes.metadata["slug"], "native-history");
        assert_eq!(
            summary.native_cwd.as_deref(),
            Some("E:/workspace/birdcoder")
        );
        assert_eq!(summary.created_at, "2099-07-15T00:00:00Z");
        assert_eq!(summary.updated_at, "2099-07-15T00:00:02Z");
        assert_eq!(
            summary.transcript_updated_at.as_deref(),
            Some("2099-07-15T00:00:01Z")
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse Claude detail")
            .expect("Claude detail");
        assert_eq!(detail.messages.len(), 2);
        assert_eq!(detail.messages[0].role, "user");
        assert_eq!(detail.messages[0].content, "Inspect every provider session");
        assert_eq!(detail.messages[1].role, "assistant");
        assert_eq!(detail.messages[1].content, "I found the native history.");
        assert_eq!(
            detail.messages[1].tool_calls.as_ref().map(Vec::len),
            Some(1)
        );
        assert!(detail.messages[0].id.ends_with("user-message-1"));
    }

    #[test]
    fn claude_session_parser_prefers_native_title_then_resume_preview() {
        let fixture = TestDirectory::new("title-priority");
        let ai_title_session_id = "12121212-1212-4212-8212-121212121212";
        let summary_session_id = "13131313-1313-4313-8313-131313131313";
        let project_directory = fixture.path().join("projects/title-priority");

        let ai_title_path = project_directory.join(format!("{ai_title_session_id}.jsonl"));
        write_jsonl(
            ai_title_path.as_path(),
            &[
                json!({
                    "parentUuid": null,
                    "isSidechain": false,
                    "cwd": "E:/workspace/birdcoder",
                    "sessionId": ai_title_session_id,
                    "type": "user",
                    "message": {"role": "user", "content": "First prompt preview"},
                    "uuid": "user-title-priority-1",
                    "timestamp": "2099-07-15T01:00:00Z"
                }),
                json!({"type": "summary", "summary": "Generated summary"}),
                json!({
                    "type": "last-prompt",
                    "sessionId": ai_title_session_id,
                    "lastPrompt": "Latest prompt preview"
                }),
                json!({
                    "type": "ai-title",
                    "sessionId": ai_title_session_id,
                    "aiTitle": "Native Claude title"
                }),
            ],
        );

        let summary_path = project_directory.join(format!("{summary_session_id}.jsonl"));
        write_jsonl(
            summary_path.as_path(),
            &[
                json!({
                    "parentUuid": null,
                    "isSidechain": false,
                    "cwd": "E:/workspace/birdcoder",
                    "sessionId": summary_session_id,
                    "type": "user",
                    "message": {"role": "user", "content": "First prompt preview"},
                    "uuid": "user-title-priority-2",
                    "timestamp": "2099-07-15T01:00:00Z"
                }),
                json!({"type": "summary", "summary": "Native session summary"}),
                json!({
                    "type": "last-prompt",
                    "sessionId": summary_session_id,
                    "lastPrompt": "Latest prompt preview"
                }),
            ],
        );

        let ai_title_summary = parse_claude_code_session_summary(ai_title_path.as_path())
            .expect("parse Claude AI-titled summary")
            .expect("Claude AI-titled summary");
        let native_summary = parse_claude_code_session_summary(summary_path.as_path())
            .expect("parse Claude generated summary")
            .expect("Claude generated summary");

        assert_eq!(ai_title_summary.title, "Native Claude title");
        assert_eq!(native_summary.title, "Latest prompt preview");
    }

    #[test]
    fn claude_config_inventory_recurses_dedupes_and_skips_sidechains() {
        let fixture = TestDirectory::new("inventory");
        let shared_session_id = "22222222-2222-4222-8222-222222222222";
        let newest_session_id = "33333333-3333-4333-8333-333333333333";
        let sidechain_session_id = "44444444-4444-4444-8444-444444444444";

        write_basic_session(
            fixture
                .path()
                .join("projects/project-a")
                .join(format!("{shared_session_id}.jsonl"))
                .as_path(),
            shared_session_id,
            "E:/workspace/old-copy",
            "Older duplicate",
            "2098-01-01T00:00:00Z",
            false,
        );
        write_basic_session(
            fixture
                .path()
                .join("projects/project-b/nested")
                .join(format!("{shared_session_id}.jsonl"))
                .as_path(),
            shared_session_id,
            "E:/workspace/current-copy",
            "Newer duplicate",
            "2099-01-01T00:00:00Z",
            false,
        );
        write_basic_session(
            fixture
                .path()
                .join("projects/project-c")
                .join(format!("{newest_session_id}.jsonl"))
                .as_path(),
            newest_session_id,
            "E:/workspace/newest",
            "Newest session",
            "2100-01-01T00:00:00Z",
            false,
        );
        write_basic_session(
            fixture
                .path()
                .join("projects/project-c/subagents")
                .join(format!("{sidechain_session_id}.jsonl"))
                .as_path(),
            sidechain_session_id,
            "E:/workspace/newest",
            "Sidechain session",
            "2101-01-01T00:00:00Z",
            true,
        );

        let sessions = list_claude_code_session_summaries_from_config_directory(fixture.path())
            .expect("list Claude sessions");
        assert_eq!(sessions.len(), 2);
        assert_eq!(sessions[0].id, newest_session_id);
        let shared = sessions
            .iter()
            .find(|session| session.id == shared_session_id)
            .expect("deduped shared session");
        assert_eq!(shared.title, "Newer duplicate");
        assert_eq!(
            shared.native_cwd.as_deref(),
            Some("E:/workspace/current-copy")
        );

        let detail =
            get_claude_code_session_detail_from_config_directory(fixture.path(), shared_session_id)
                .expect("get Claude detail")
                .expect("Claude detail");
        assert_eq!(detail.summary.title, "Newer duplicate");
    }

    fn write_basic_session(
        path: &Path,
        session_id: &str,
        cwd: &str,
        prompt: &str,
        timestamp: &str,
        is_sidechain: bool,
    ) {
        write_jsonl(
            path,
            &[json!({
                "parentUuid": null,
                "isSidechain": is_sidechain,
                "cwd": cwd,
                "sessionId": session_id,
                "type": "user",
                "message": {"role": "user", "content": prompt},
                "uuid": format!("message-{session_id}"),
                "timestamp": timestamp
            })],
        );
    }

    fn write_jsonl(path: &Path, entries: &[Value]) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create Claude fixture directory");
        }
        let mut contents = entries
            .iter()
            .map(Value::to_string)
            .collect::<Vec<_>>()
            .join("\n");
        contents.push('\n');
        fs::write(path, contents).expect("write Claude JSONL fixture");
    }

    struct TestDirectory {
        path: PathBuf,
    }

    impl TestDirectory {
        fn new(label: &str) -> Self {
            let sequence = TEMP_DIRECTORY_SEQUENCE.fetch_add(1, Ordering::Relaxed);
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_nanos())
                .unwrap_or_default();
            let path = std::env::temp_dir().join(format!(
                "sdkwork-birdcoder-claude-{label}-{}-{now}-{sequence}",
                std::process::id()
            ));
            fs::create_dir_all(path.as_path()).expect("create Claude test directory");
            Self { path }
        }

        fn path(&self) -> &Path {
            self.path.as_path()
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(self.path.as_path());
        }
    }
}
