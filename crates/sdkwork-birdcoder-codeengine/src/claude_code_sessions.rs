use std::{
    collections::{BTreeMap, BTreeSet},
    env, fs,
    fs::File,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::Value;

use crate::{
    bounded_json::for_each_bounded_jsonl_record, build_native_session_id,
    extract_native_lookup_id_for_engine, find_codeengine_descriptor,
    map_codeengine_session_status_from_runtime, sanitize_codeengine_session_resource_records,
    CodeEngineSessionDetailRecord, CodeEngineSessionMessageRecord,
    CodeEngineSessionNativeAttributesRecord, CodeEngineSessionResourceOriginRecord,
    CodeEngineSessionResourceRecord, CodeEngineSessionSummaryRecord,
};

pub const CLAUDE_CONFIG_DIR_ENV: &str = "CLAUDE_CONFIG_DIR";

const CLAUDE_CODE_ENGINE_ID: &str = "claude-code";
const CLAUDE_JSONL_RECORD_BYTE_LIMIT: usize = 32 * 1024 * 1024;
const CLAUDE_PROJECTS_DIRECTORY_NAME: &str = "projects";
const CLAUDE_RESOURCE_MEDIA_SOURCE_CHARACTER_LIMIT: usize = 4 * 1_024 * 1_024;
const CLAUDE_RESULT_NOTICE_CHARACTER_LIMIT: usize = 4_000;
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
    resources: Option<Vec<CodeEngineSessionResourceRecord>>,
    role: String,
    source_message_id: Option<String>,
    text: String,
    tool_call_id: Option<String>,
    tool_calls: Option<Vec<Value>>,
    turn_id: Option<String>,
}

#[derive(Clone)]
struct ClaudeToolCallContext {
    tool_name: Option<String>,
    turn_id: Option<String>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ClaudeTerminalState {
    Cancelled,
    Completed,
    Failed,
}

#[derive(Default)]
struct ClaudeSessionParseContext {
    ai_title: Option<String>,
    command_title_fallback: Option<String>,
    created_at: Option<ClaudeTimestamp>,
    current_turn_id: Option<String>,
    custom_title: Option<String>,
    first_entry_sidechain: Option<bool>,
    first_prompt: Option<String>,
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
    retracted_message_ids: BTreeSet<String>,
    summary: Option<String>,
    task_tool_use_id_by_task_id: BTreeMap<String, String>,
    terminal_state: Option<ClaudeTerminalState>,
    tool_call_context_by_id: BTreeMap<String, ClaudeToolCallContext>,
}

struct ClaudeMessageContent {
    is_tool_result: bool,
    resources: Vec<CodeEngineSessionResourceRecord>,
    text: String,
    tool_calls: Vec<Value>,
}

struct ClaudeToolResultContent {
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
    parse_claude_code_session_detail_with_record_limit(file_path, CLAUDE_JSONL_RECORD_BYTE_LIMIT)
}

fn parse_claude_code_session_detail_with_record_limit(
    file_path: &Path,
    max_record_bytes: usize,
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
    let stats = for_each_bounded_jsonl_record(file, max_record_bytes, |line_index, record| {
        let Ok(line) = std::str::from_utf8(record) else {
            return;
        };
        apply_claude_jsonl_line(&mut context, line, true, line_index);
    })
    .map_err(|error| {
        format!(
            "read Claude Code session file {} failed: {error}",
            file_path.display()
        )
    })?;
    if stats.skipped_oversized_records > 0 {
        tracing::warn!(
            path = %file_path.display(),
            max_record_bytes,
            skipped_oversized_records = stats.skipped_oversized_records,
            "skipped oversized Claude Code JSONL records"
        );
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
    apply_claude_message_retractions(context, &envelope);

    let entry_type = normalize_value_string(envelope.get("type"));
    match entry_type.as_deref() {
        Some("summary") | Some("task-summary") => {
            if let Some(summary) = normalize_value_string(envelope.get("summary")) {
                context.summary = normalize_claude_title(summary.as_str());
            }
        }
        Some("result") => {
            apply_claude_result_line(context, &envelope, include_messages, line_index)
        }
        Some("system") => {
            apply_claude_system_transcript_line(context, &envelope, include_messages, line_index)
        }
        Some("informational") => {
            apply_claude_informational_notice(context, &envelope, include_messages, line_index)
        }
        Some("api_retry") => apply_claude_notice(
            context,
            &envelope,
            "retry",
            format_claude_retry_notice(&envelope),
            include_messages,
            line_index,
        ),
        Some("mirror_error") => {
            context.terminal_state = Some(ClaudeTerminalState::Failed);
            apply_claude_notice(
                context,
                &envelope,
                "failed",
                resolve_claude_notice_detail(&envelope)
                    .unwrap_or_else(|| "Claude session mirror failed.".to_owned()),
                include_messages,
                line_index,
            );
        }
        Some("permission_denied") => apply_claude_permission_denied_tool_line(
            context,
            &envelope,
            include_messages,
            line_index,
        ),
        Some("tool_progress") => {
            apply_claude_tool_progress_line(context, &envelope, include_messages, line_index)
        }
        Some("tool_use_summary") => {
            apply_claude_tool_use_summary_line(context, &envelope, include_messages, line_index)
        }
        Some("model_refusal_fallback") => apply_claude_notice(
            context,
            &envelope,
            "retry",
            "Model refused the request; retrying with a fallback model.".to_owned(),
            include_messages,
            line_index,
        ),
        Some("model_refusal_no_fallback") => {
            context.terminal_state = Some(ClaudeTerminalState::Failed);
            apply_claude_notice(
                context,
                &envelope,
                "failed",
                "Model refused the request and no fallback model is available.".to_owned(),
                include_messages,
                line_index,
            );
        }
        Some("user") | Some("assistant") => {
            let role = entry_type.as_deref().unwrap_or("assistant");
            if claude_skips_transcript(&envelope) {
                return;
            }
            apply_claude_transcript_line(context, &envelope, role, include_messages, line_index);
            if role == "assistant" && claude_assistant_was_aborted(&envelope) {
                context.terminal_state = Some(ClaudeTerminalState::Cancelled);
                apply_claude_notice(
                    context,
                    &envelope,
                    "cancelled",
                    "Generation cancelled.".to_owned(),
                    include_messages,
                    line_index,
                );
            }
        }
        _ => {}
    }
}

fn claude_skips_transcript(envelope: &Value) -> bool {
    envelope
        .get("skip_transcript")
        .or_else(|| envelope.get("skipTranscript"))
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn claude_message_is_synthetic(envelope: &Value) -> bool {
    ["isSynthetic", "is_synthetic", "isMeta", "is_meta"]
        .into_iter()
        .any(|key| read_claude_boolean(envelope.get(key)) == Some(true))
}

fn claude_assistant_was_aborted(envelope: &Value) -> bool {
    if envelope
        .get("aborted")
        .or_else(|| {
            envelope
                .get("message")
                .and_then(|message| message.get("aborted"))
        })
        .and_then(Value::as_bool)
        .unwrap_or(false)
    {
        return true;
    }

    [
        envelope.get("error"),
        envelope
            .get("message")
            .and_then(|message| message.get("error")),
        envelope
            .get("message")
            .and_then(|message| message.get("stop_reason")),
    ]
    .into_iter()
    .flatten()
    .filter_map(|value| normalize_value_string(Some(value)))
    .any(|value| matches!(value.to_ascii_lowercase().as_str(), "abort" | "aborted"))
}

fn apply_claude_message_retractions(context: &mut ClaudeSessionParseContext, envelope: &Value) {
    let retracted_message_ids = ["supersedes", "retracted_message_uuids"]
        .into_iter()
        .filter_map(|key| envelope.get(key).and_then(Value::as_array))
        .flatten()
        .filter_map(|value| normalize_value_string(Some(value)))
        .map(|value| value.to_ascii_lowercase())
        .collect::<BTreeSet<_>>();
    if retracted_message_ids.is_empty() {
        return;
    }

    context
        .retracted_message_ids
        .extend(retracted_message_ids.iter().cloned());
    let retracted_tool_call_ids = collect_claude_assistant_tool_call_ids(
        context
            .messages
            .iter()
            .filter(|entry| claude_entry_matches_message_ids(entry, &retracted_message_ids)),
    );

    context
        .messages
        .retain(|entry| !claude_entry_matches_message_ids(entry, &retracted_message_ids));
    rebuild_claude_message_index(context);
    remove_claude_tool_call_contexts(context, &retracted_tool_call_ids);
}

fn claude_entry_matches_message_ids(
    entry: &ClaudeTranscriptEntry,
    message_ids: &BTreeSet<String>,
) -> bool {
    [
        entry.source_message_id.as_deref(),
        entry.raw_message_id.as_deref(),
    ]
    .into_iter()
    .flatten()
    .map(|identity| identity.trim().to_ascii_lowercase())
    .any(|identity| message_ids.contains(identity.as_str()))
}

fn collect_claude_assistant_tool_call_ids<'a>(
    entries: impl Iterator<Item = &'a ClaudeTranscriptEntry>,
) -> BTreeSet<String> {
    entries
        .filter(|entry| entry.role == "assistant")
        .flat_map(|entry| entry.tool_calls.iter().flatten())
        .filter(|tool_call| {
            normalize_value_string(tool_call.get("type"))
                .is_some_and(|value| value == "tool_use" || value.ends_with("_tool_use"))
        })
        .filter_map(read_claude_tool_call_id)
        .collect()
}

fn remove_claude_tool_call_contexts(
    context: &mut ClaudeSessionParseContext,
    tool_call_ids: &BTreeSet<String>,
) {
    for tool_call_id in tool_call_ids {
        context
            .tool_call_context_by_id
            .remove(tool_call_id.as_str());
    }
    context
        .task_tool_use_id_by_task_id
        .retain(|_, tool_call_id| !tool_call_ids.contains(tool_call_id));
}

fn apply_claude_result_line(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
    include_messages: bool,
    line_index: usize,
) {
    let raw_subtype = envelope
        .get("subtype")
        .and_then(Value::as_str)
        .map(str::trim)
        .unwrap_or_default();
    let subtype = normalize_claude_protocol_code(envelope.get("subtype"), 128);
    let errors = envelope
        .get("errors")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|error| bounded_claude_notice_text(error.as_str(), 2_000))
        .take(16)
        .collect::<Vec<_>>();
    let terminal_reason = normalize_claude_protocol_code(envelope.get("terminal_reason"), 128);
    let permission_denials = envelope
        .get("permission_denials")
        .or_else(|| envelope.get("permissionDenials"))
        .and_then(Value::as_array)
        .map(|denials| denials.as_slice())
        .unwrap_or_default();
    let has_permission_denials = !permission_denials.is_empty();
    let is_error_subtype = !raw_subtype.is_empty() && !raw_subtype.eq_ignore_ascii_case("success");
    let is_failure = envelope
        .get("is_error")
        .and_then(Value::as_bool)
        .unwrap_or(false)
        || is_error_subtype
        || !errors.is_empty();
    let is_cancelled = terminal_reason
        .as_deref()
        .is_some_and(claude_terminal_reason_is_cancellation);
    context.terminal_state = Some(if is_cancelled {
        ClaudeTerminalState::Cancelled
    } else if is_failure {
        ClaudeTerminalState::Failed
    } else {
        ClaudeTerminalState::Completed
    });

    if is_failure || is_cancelled {
        let detail = format_claude_result_notice(
            subtype.as_deref().unwrap_or_default(),
            errors.as_slice(),
            terminal_reason.as_deref(),
            is_cancelled,
        );
        apply_claude_notice(
            context,
            envelope,
            if is_cancelled { "cancelled" } else { "failed" },
            detail,
            include_messages,
            line_index,
        );
    }

    if has_permission_denials {
        let uncorrelated_denials = apply_claude_result_permission_denials(
            context,
            envelope,
            permission_denials,
            include_messages,
            line_index,
        );
        if uncorrelated_denials.is_empty() {
            return;
        }
        let denied_tools = uncorrelated_denials.join(", ");
        let mut notice_envelope = envelope.clone();
        if let Some(notice_envelope) = notice_envelope.as_object_mut() {
            let notice_id = normalize_value_string(notice_envelope.get("uuid"))
                .map(|uuid| format!("{uuid}:uncorrelated-permission-denials"))
                .unwrap_or_else(|| format!("result-permission-denials-{line_index}"));
            notice_envelope.insert("uuid".to_owned(), Value::String(notice_id));
        }
        apply_claude_notice(
            context,
            &notice_envelope,
            "cancelled",
            format!("Permission denied for {denied_tools}."),
            include_messages,
            line_index,
        );
    }
}

fn apply_claude_result_permission_denials(
    context: &mut ClaudeSessionParseContext,
    result_envelope: &Value,
    permission_denials: &[Value],
    include_messages: bool,
    line_index: usize,
) -> Vec<String> {
    let mut uncorrelated_denials = Vec::<String>::new();
    for (denial_index, denial) in permission_denials.iter().take(32).enumerate() {
        let tool_call_id = normalize_value_string(
            denial
                .get("tool_use_id")
                .or_else(|| denial.get("toolUseId")),
        );
        let tool_name = bounded_claude_notice_text(
            denial
                .get("tool_name")
                .or_else(|| denial.get("toolName"))
                .and_then(Value::as_str),
            256,
        )
        .map(|tool_name| collapse_whitespace(tool_name.as_str()))
        .filter(|tool_name| !tool_name.is_empty())
        .unwrap_or_else(|| "tool execution".to_owned());
        let is_correlated = tool_call_id.as_ref().is_some_and(|tool_call_id| {
            context
                .tool_call_context_by_id
                .contains_key(tool_call_id.as_str())
                || context.messages.iter().any(|message| {
                    message.tool_call_id.as_deref() == Some(tool_call_id.as_str())
                        || message.tool_calls.iter().flatten().any(|tool_call| {
                            read_claude_tool_call_id(tool_call).as_deref()
                                == Some(tool_call_id.as_str())
                        })
                })
        });
        if !is_correlated {
            if !uncorrelated_denials.contains(&tool_name) {
                uncorrelated_denials.push(tool_name);
            }
            continue;
        }

        let mut denial_envelope = serde_json::Map::new();
        for key in [
            "tool_name",
            "tool_use_id",
            "tool_input",
            "toolName",
            "toolUseId",
            "toolInput",
        ] {
            if let Some(value) = denial.get(key).filter(|value| !value.is_null()) {
                denial_envelope.insert(key.to_owned(), value.clone());
            }
        }
        for key in [
            "timestamp",
            "requestId",
            "request_id",
            "sessionId",
            "session_id",
        ] {
            if let Some(value) = result_envelope.get(key).filter(|value| !value.is_null()) {
                denial_envelope.insert(key.to_owned(), value.clone());
            }
        }
        denial_envelope.insert(
            "uuid".to_owned(),
            Value::String(format!(
                "result-permission-denial-{line_index}-{denial_index}"
            )),
        );
        apply_claude_permission_denied_tool_line(
            context,
            &Value::Object(denial_envelope),
            include_messages,
            line_index,
        );
    }
    uncorrelated_denials
}

fn bounded_claude_notice_text(value: Option<&str>, max_characters: usize) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() {
        return None;
    }
    let normalized = value
        .chars()
        .map(|character| {
            if character.is_control() && !matches!(character, '\n' | '\t') {
                ' '
            } else {
                character
            }
        })
        .take(max_characters)
        .collect::<String>();
    normalize_non_empty_string(normalized.as_str())
}

fn normalize_claude_protocol_code(value: Option<&Value>, max_characters: usize) -> Option<String> {
    let normalized = value?.as_str()?.trim();
    if normalized.is_empty()
        || normalized.len() > max_characters
        || !normalized
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
    {
        return None;
    }
    Some(normalized.to_ascii_lowercase())
}

fn claude_terminal_reason_is_cancellation(terminal_reason: &str) -> bool {
    matches!(
        terminal_reason,
        "aborted_streaming" | "aborted_tools" | "stop_hook_prevented" | "hook_stopped"
    )
}

fn format_claude_result_notice(
    subtype: &str,
    errors: &[String],
    terminal_reason: Option<&str>,
    is_cancelled: bool,
) -> String {
    let fallback = if is_cancelled {
        "Claude request cancelled.".to_owned()
    } else if subtype.is_empty() || subtype == "success" {
        "Claude request failed.".to_owned()
    } else {
        format!(
            "Claude request failed: {}.",
            subtype.replace(['_', '-'], " ")
        )
    };
    let errors = if errors.is_empty() {
        fallback
    } else {
        errors.join("\n")
    };
    let terminal_detail = terminal_reason
        .map(|reason| format!("Terminal reason: {}.", reason.replace(['_', '-'], " ")));
    let terminal_character_count = terminal_detail
        .as_ref()
        .map(|detail| detail.chars().count() + 1)
        .unwrap_or_default();
    let error_budget =
        CLAUDE_RESULT_NOTICE_CHARACTER_LIMIT.saturating_sub(terminal_character_count);
    let mut detail = errors.chars().take(error_budget).collect::<String>();
    if let Some(terminal_detail) = terminal_detail {
        if !detail.is_empty() {
            detail.push('\n');
        }
        detail.push_str(terminal_detail.as_str());
    }
    detail
}

fn apply_claude_system_transcript_line(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
    include_messages: bool,
    line_index: usize,
) {
    if claude_skips_transcript(envelope) {
        return;
    }

    let subtype = normalize_value_string(envelope.get("subtype"))
        .unwrap_or_default()
        .to_ascii_lowercase();
    match subtype.as_str() {
        "informational" => {
            apply_claude_informational_notice(context, envelope, include_messages, line_index)
        }
        "local_command_output" => apply_claude_notice(
            context,
            envelope,
            "info",
            normalize_value_string(envelope.get("content"))
                .unwrap_or_else(|| "Local command completed.".to_owned()),
            include_messages,
            line_index,
        ),
        "notification" => {
            let priority = normalize_value_string(envelope.get("priority"))
                .unwrap_or_default()
                .to_ascii_lowercase();
            apply_claude_notice(
                context,
                envelope,
                if matches!(priority.as_str(), "high" | "immediate") {
                    "warning"
                } else {
                    "info"
                },
                normalize_value_string(envelope.get("text"))
                    .unwrap_or_else(|| "Provider information.".to_owned()),
                include_messages,
                line_index,
            );
        }
        "memory_recall" => {
            apply_claude_memory_recall_line(context, envelope, include_messages, line_index)
        }
        "hook_started" | "hook_progress" | "hook_response" => {
            apply_claude_hook_transcript_line(context, envelope, include_messages, line_index)
        }
        "task_started" | "task_progress" | "task_notification" | "task_updated" => {
            apply_claude_task_transcript_line(context, envelope, include_messages, line_index);
        }
        "api_retry" => apply_claude_notice(
            context,
            envelope,
            "retry",
            format_claude_retry_notice(envelope),
            include_messages,
            line_index,
        ),
        "permission_denied" => apply_claude_permission_denied_tool_line(
            context,
            envelope,
            include_messages,
            line_index,
        ),
        "mirror_error" => {
            context.terminal_state = Some(ClaudeTerminalState::Failed);
            apply_claude_notice(
                context,
                envelope,
                "failed",
                resolve_claude_notice_detail(envelope)
                    .unwrap_or_else(|| "Claude session mirror failed.".to_owned()),
                include_messages,
                line_index,
            );
        }
        "compact_boundary" => apply_claude_notice(
            context,
            envelope,
            "compression",
            "Conversation context compressed.".to_owned(),
            include_messages,
            line_index,
        ),
        "status"
            if normalize_value_string(envelope.get("compact_result"))
                .is_some_and(|result| result.eq_ignore_ascii_case("failed")) =>
        {
            let detail = bounded_claude_notice_text(
                envelope.get("compact_error").and_then(Value::as_str),
                CLAUDE_RESULT_NOTICE_CHARACTER_LIMIT,
            )
            .map(|error| format!("Conversation context compression failed: {error}"))
            .unwrap_or_else(|| "Conversation context compression failed.".to_owned());
            apply_claude_notice(
                context,
                envelope,
                "warning",
                detail,
                include_messages,
                line_index,
            );
        }
        "model_refusal_fallback" => apply_claude_notice(
            context,
            envelope,
            "retry",
            "Model refused the request; retrying with a fallback model.".to_owned(),
            include_messages,
            line_index,
        ),
        "model_refusal_no_fallback" => {
            context.terminal_state = Some(ClaudeTerminalState::Failed);
            apply_claude_notice(
                context,
                envelope,
                "failed",
                "Model refused the request and no fallback model is available.".to_owned(),
                include_messages,
                line_index,
            );
        }
        // Aggregate task-count changes are transport state, not transcript content.
        "background_tasks_changed" => {}
        _ => {}
    }
}

fn apply_claude_informational_notice(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
    include_messages: bool,
    line_index: usize,
) {
    let prevents_continuation = envelope
        .get("prevent_continuation")
        .or_else(|| envelope.get("preventContinuation"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let level = normalize_value_string(envelope.get("level"))
        .unwrap_or_default()
        .to_ascii_lowercase();
    let detail = [
        "message",
        "content",
        "text",
        "systemMessage",
        "system_message",
        "stopReason",
        "stop_reason",
    ]
    .into_iter()
    .find_map(|key| normalize_value_string(envelope.get(key)));
    let notice_kind = if prevents_continuation {
        "stopped"
    } else if level == "warning" {
        "warning"
    } else {
        "info"
    };
    let fallback = if prevents_continuation {
        "Agent execution stopped."
    } else if level == "warning" {
        "Provider warning."
    } else {
        "Provider notice."
    };
    apply_claude_notice(
        context,
        envelope,
        notice_kind,
        detail.unwrap_or_else(|| fallback.to_owned()),
        include_messages,
        line_index,
    );
}

fn apply_claude_memory_recall_line(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
    include_messages: bool,
    line_index: usize,
) {
    context.has_transcript = true;
    let timestamp = parse_claude_timestamp(envelope.get("timestamp"));
    if let Some(timestamp) = timestamp.clone() {
        observe_claude_timestamp(context, timestamp, true);
    }
    if !include_messages {
        return;
    }

    let message_id = normalize_value_string(envelope.get("uuid"))
        .unwrap_or_else(|| format!("memory-recall-{line_index}"));
    let resources = envelope
        .get("memories")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .take(32)
        .enumerate()
        .filter_map(|(index, memory)| {
            let path = normalize_value_string(memory.get("path"))?;
            let scope = normalize_value_string(memory.get("scope"));
            let description = normalize_value_string(memory.get("content"))
                .map(|content| content.chars().take(4_000).collect::<String>());
            let is_external = path.starts_with("https://") || path.starts_with("http://");
            let is_synthesis = path.starts_with("<synthesis:");
            Some(CodeEngineSessionResourceRecord {
                id: format!("{message_id}:memory:{}", index + 1),
                kind: "citation".to_owned(),
                name: if is_synthesis {
                    Some("Memory synthesis".to_owned())
                } else {
                    Path::new(path.as_str())
                        .file_name()
                        .and_then(|name| name.to_str())
                        .and_then(normalize_non_empty_string)
                },
                path: (!is_external && !is_synthesis).then(|| path.clone()),
                uri: is_external.then(|| path.clone()),
                media_source: None,
                mime_type: None,
                description,
                origin: scope.map(|scope| CodeEngineSessionResourceOriginRecord {
                    kind: "resource".to_owned(),
                    name: Some(scope),
                    path: None,
                    uri: None,
                    client_name: Some("Claude Code memory".to_owned()),
                    line_start: None,
                    line_end: None,
                    column_start: None,
                    column_end: None,
                    excerpt: None,
                }),
                citation: None,
            })
        })
        .collect::<Vec<_>>();
    if resources.is_empty() {
        return;
    }

    let mut metadata = BTreeMap::new();
    metadata.insert("noticeKind".to_owned(), "info".to_owned());
    let raw_message_id = Some(format!("{message_id}:memory-recall"));
    let entry = ClaudeTranscriptEntry {
        created_at: timestamp.map(|timestamp| timestamp.text),
        metadata: Some(metadata),
        raw_message_id: raw_message_id.clone(),
        resources: Some(resources),
        role: "system".to_owned(),
        source_message_id: raw_message_id.clone(),
        text: "Recalled from memory.".to_owned(),
        tool_call_id: None,
        tool_calls: None,
        turn_id: normalize_value_string(
            envelope
                .get("requestId")
                .or_else(|| envelope.get("request_id")),
        )
        .or_else(|| context.current_turn_id.clone()),
    };
    upsert_claude_transcript_entry(context, entry, raw_message_id, line_index);
}

fn apply_claude_tool_use_summary_line(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
    include_messages: bool,
    line_index: usize,
) {
    if normalize_value_string(envelope.get("summary")).is_none() {
        return;
    }
    context.has_transcript = true;
    let timestamp = parse_claude_timestamp(envelope.get("timestamp"));
    if let Some(timestamp) = timestamp.clone() {
        observe_claude_timestamp(context, timestamp, true);
    }
    if !include_messages {
        return;
    }

    let message_id = normalize_value_string(envelope.get("uuid"))
        .unwrap_or_else(|| format!("tool-use-summary-{line_index}"));
    let mut tool_event = envelope.as_object().cloned().unwrap_or_default();
    tool_event.insert(
        "type".to_owned(),
        Value::String("tool_use_summary".to_owned()),
    );
    tool_event.insert("id".to_owned(), Value::String(message_id.clone()));
    let entry = ClaudeTranscriptEntry {
        created_at: timestamp.map(|timestamp| timestamp.text),
        metadata: None,
        raw_message_id: Some(message_id.clone()),
        resources: None,
        role: "tool".to_owned(),
        source_message_id: Some(message_id.clone()),
        text: String::new(),
        tool_call_id: Some(message_id.clone()),
        tool_calls: Some(vec![Value::Object(tool_event)]),
        turn_id: context.current_turn_id.clone(),
    };
    upsert_claude_transcript_entry(context, entry, Some(message_id), line_index);
}

fn resolve_claude_notice_detail(envelope: &Value) -> Option<String> {
    normalize_value_string(envelope.get("message"))
        .or_else(|| normalize_value_string(envelope.get("reason")))
        .or_else(|| normalize_value_string(envelope.get("decision_reason")))
        .or_else(|| {
            envelope
                .get("error")
                .and_then(extract_claude_tool_output_text)
        })
}

fn format_claude_retry_notice(envelope: &Value) -> String {
    let attempt = envelope
        .get("attempt")
        .and_then(Value::as_u64)
        .filter(|attempt| *attempt > 0);
    let base = attempt
        .map(|attempt| format!("Retrying provider request (attempt {attempt})."))
        .unwrap_or_else(|| "Retrying provider request.".to_owned());
    resolve_claude_notice_detail(envelope)
        .filter(|detail| !detail.eq_ignore_ascii_case(base.as_str()))
        .map(|detail| format!("{base} {detail}"))
        .unwrap_or(base)
}

fn format_claude_permission_denied_notice(envelope: &Value) -> String {
    resolve_claude_notice_detail(envelope)
        .map(|detail| format!("Permission denied: {detail}"))
        .or_else(|| {
            normalize_value_string(
                envelope
                    .get("tool_name")
                    .or_else(|| envelope.get("toolName")),
            )
            .map(|tool_name| format!("Permission denied for {tool_name}."))
        })
        .unwrap_or_else(|| "Permission denied.".to_owned())
}

fn apply_claude_permission_denied_tool_line(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
    include_messages: bool,
    line_index: usize,
) {
    let tool_call_id = normalize_value_string(envelope.get("tool_use_id"))
        .or_else(|| normalize_value_string(envelope.get("toolUseId")))
        .or_else(|| normalize_value_string(envelope.get("id")));
    let Some(tool_call_id) = tool_call_id else {
        return;
    };
    context.has_transcript = true;
    let timestamp = parse_claude_timestamp(envelope.get("timestamp"));
    if let Some(timestamp) = timestamp.clone() {
        observe_claude_timestamp(context, timestamp, true);
    }
    if !include_messages {
        return;
    }

    let existing_index = context
        .messages
        .iter()
        .position(|message| message.tool_call_id.as_deref() == Some(tool_call_id.as_str()));
    let existing_entry = existing_index
        .and_then(|index| context.messages.get(index))
        .cloned();
    let existing_is_permission_denial = existing_entry.as_ref().is_some_and(|entry| {
        entry
            .tool_calls
            .iter()
            .flatten()
            .filter_map(Value::as_object)
            .any(|tool_call| {
                normalize_value_string(tool_call.get("subtype"))
                    .is_some_and(|subtype| subtype == "permission_denied")
            })
    });
    let tool_context = context.tool_call_context_by_id.get(tool_call_id.as_str());
    let mut tool_event = existing_entry
        .as_ref()
        .and_then(|entry| entry.tool_calls.as_ref())
        .and_then(|tool_calls| tool_calls.first())
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    if let Some(event) = envelope.as_object() {
        for (key, value) in event {
            if !value.is_null() {
                tool_event.insert(key.clone(), value.clone());
            }
        }
    }
    tool_event.insert("type".to_owned(), Value::String("system".to_owned()));
    tool_event.insert(
        "subtype".to_owned(),
        Value::String("permission_denied".to_owned()),
    );
    tool_event.insert(
        "tool_use_id".to_owned(),
        Value::String(tool_call_id.clone()),
    );
    if !tool_event.contains_key("tool_name") {
        if let Some(tool_name) = tool_context.and_then(|context| context.tool_name.clone()) {
            tool_event.insert("tool_name".to_owned(), Value::String(tool_name));
        }
    }
    if !tool_event.contains_key("message") {
        if let Some(reason) = resolve_claude_notice_detail(envelope) {
            tool_event.insert("message".to_owned(), Value::String(reason));
        }
    }
    let message_identity = format!("permission-denied:{tool_call_id}");
    let text = if resolve_claude_notice_detail(envelope).is_some() {
        format_claude_permission_denied_notice(envelope)
    } else if existing_is_permission_denial {
        existing_entry
            .as_ref()
            .and_then(|entry| normalize_non_empty_string(entry.text.as_str()))
            .unwrap_or_else(|| format_claude_permission_denied_notice(envelope))
    } else {
        format_claude_permission_denied_notice(envelope)
    };
    let entry = ClaudeTranscriptEntry {
        created_at: timestamp.map(|timestamp| timestamp.text).or_else(|| {
            existing_entry
                .as_ref()
                .and_then(|entry| entry.created_at.clone())
        }),
        metadata: None,
        raw_message_id: Some(message_identity.clone()),
        resources: existing_entry
            .as_ref()
            .and_then(|entry| entry.resources.clone()),
        role: "tool".to_owned(),
        source_message_id: existing_entry
            .as_ref()
            .and_then(|entry| entry.source_message_id.clone())
            .or_else(|| Some(message_identity.clone())),
        text,
        tool_call_id: Some(tool_call_id),
        tool_calls: Some(vec![Value::Object(tool_event)]),
        turn_id: existing_entry
            .as_ref()
            .and_then(|entry| entry.turn_id.clone())
            .or_else(|| tool_context.and_then(|context| context.turn_id.clone()))
            .or_else(|| context.current_turn_id.clone()),
    };
    if let Some(existing_index) = existing_index {
        let old_identity = context.messages[existing_index]
            .raw_message_id
            .as_ref()
            .map(|identity| identity.trim().to_ascii_lowercase());
        if let Some(old_identity) = old_identity {
            context.message_index_by_id.remove(old_identity.as_str());
        }
        context.messages[existing_index] = entry;
        context
            .message_index_by_id
            .insert(message_identity.to_ascii_lowercase(), existing_index);
    } else {
        upsert_claude_transcript_entry(context, entry, Some(message_identity), line_index);
    }
}

fn apply_claude_notice(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
    notice_kind: &str,
    text: String,
    include_messages: bool,
    line_index: usize,
) {
    if claude_skips_transcript(envelope) {
        return;
    }
    context.has_transcript = true;
    let timestamp = parse_claude_timestamp(envelope.get("timestamp"));
    if let Some(timestamp) = timestamp.clone() {
        observe_claude_timestamp(context, timestamp, true);
    }
    if !include_messages {
        return;
    }

    let mut metadata = BTreeMap::new();
    metadata.insert("noticeKind".to_owned(), notice_kind.to_owned());
    let raw_message_id = Some(
        normalize_value_string(envelope.get("uuid"))
            .map(|message_id| format!("{message_id}:notice:{notice_kind}"))
            .unwrap_or_else(|| {
                format!(
                    "notice:{notice_kind}:{line_index}:{}",
                    context.messages.len()
                )
            }),
    );
    let entry = ClaudeTranscriptEntry {
        created_at: timestamp.map(|timestamp| timestamp.text),
        metadata: Some(metadata),
        raw_message_id: raw_message_id.clone(),
        resources: None,
        role: "system".to_owned(),
        source_message_id: normalize_value_string(envelope.get("uuid"))
            .or_else(|| raw_message_id.clone()),
        text,
        tool_call_id: None,
        tool_calls: None,
        turn_id: normalize_value_string(
            envelope
                .get("requestId")
                .or_else(|| envelope.get("request_id")),
        )
        .or_else(|| context.current_turn_id.clone()),
    };
    upsert_claude_transcript_entry(context, entry, raw_message_id, line_index);
}

fn apply_claude_tool_progress_line(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
    include_messages: bool,
    line_index: usize,
) {
    let tool_call_id = normalize_value_string(
        envelope
            .get("tool_use_id")
            .or_else(|| envelope.get("toolUseId")),
    );
    let Some(tool_call_id) = tool_call_id else {
        return;
    };

    context.has_transcript = true;
    let timestamp = parse_claude_timestamp(envelope.get("timestamp"));
    if let Some(timestamp) = timestamp.clone() {
        observe_claude_timestamp(context, timestamp, true);
    }
    if !include_messages {
        return;
    }

    let message_identity = format!("tool-progress:{tool_call_id}");
    let existing_entry = context
        .message_index_by_id
        .get(message_identity.to_ascii_lowercase().as_str())
        .and_then(|index| context.messages.get(*index))
        .cloned();
    let mut tool_event = existing_entry
        .as_ref()
        .and_then(|entry| entry.tool_calls.as_ref())
        .and_then(|tool_calls| tool_calls.first())
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    if let Some(event) = envelope.as_object() {
        for (key, value) in event {
            if !value.is_null() {
                tool_event.insert(key.clone(), value.clone());
            }
        }
    }
    tool_event.insert("type".to_owned(), Value::String("tool_progress".to_owned()));
    tool_event.insert(
        "tool_use_id".to_owned(),
        Value::String(tool_call_id.clone()),
    );
    tool_event.insert("status".to_owned(), Value::String("running".to_owned()));
    let tool_context = context.tool_call_context_by_id.get(tool_call_id.as_str());
    if !tool_event.contains_key("tool_name") {
        if let Some(tool_name) = tool_context.and_then(|context| context.tool_name.clone()) {
            tool_event.insert("tool_name".to_owned(), Value::String(tool_name));
        }
    }

    let entry = ClaudeTranscriptEntry {
        created_at: timestamp.map(|timestamp| timestamp.text).or_else(|| {
            existing_entry
                .as_ref()
                .and_then(|entry| entry.created_at.clone())
        }),
        metadata: None,
        raw_message_id: Some(message_identity.clone()),
        resources: None,
        role: "tool".to_owned(),
        source_message_id: Some(message_identity.clone()),
        text: String::new(),
        tool_call_id: Some(tool_call_id.clone()),
        tool_calls: Some(vec![Value::Object(tool_event)]),
        turn_id: tool_context
            .and_then(|context| context.turn_id.clone())
            .or_else(|| {
                existing_entry
                    .as_ref()
                    .and_then(|entry| entry.turn_id.clone())
            })
            .or_else(|| context.current_turn_id.clone()),
    };
    upsert_claude_transcript_entry(context, entry, Some(message_identity), line_index);
}

fn apply_claude_hook_transcript_line(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
    include_messages: bool,
    line_index: usize,
) {
    let hook_id =
        normalize_value_string(envelope.get("hook_id").or_else(|| envelope.get("hookId")));
    let Some(hook_id) = hook_id else {
        return;
    };

    context.has_transcript = true;
    let timestamp = parse_claude_timestamp(envelope.get("timestamp"));
    if let Some(timestamp) = timestamp.clone() {
        observe_claude_timestamp(context, timestamp, true);
    }
    if !include_messages {
        return;
    }

    let lifecycle_id = format!("hook:{hook_id}");
    let message_identity = lifecycle_id.clone();
    let existing_entry = context
        .message_index_by_id
        .get(message_identity.to_ascii_lowercase().as_str())
        .and_then(|index| context.messages.get(*index))
        .cloned();
    let mut hook_event = existing_entry
        .as_ref()
        .and_then(|entry| entry.tool_calls.as_ref())
        .and_then(|tool_calls| tool_calls.first())
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    if let Some(event) = envelope.as_object() {
        for (key, value) in event {
            if !value.is_null() {
                hook_event.insert(key.clone(), value.clone());
            }
        }
    }
    let subtype = normalize_value_string(envelope.get("subtype"))
        .unwrap_or_else(|| "hook_progress".to_owned());
    let status = if subtype == "hook_response" {
        match normalize_value_string(envelope.get("outcome"))
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str()
        {
            "success" => "completed",
            "cancelled" | "canceled" => "cancelled",
            _ => "failed",
        }
    } else {
        "running"
    };
    hook_event.insert("type".to_owned(), Value::String("system".to_owned()));
    hook_event.insert("subtype".to_owned(), Value::String(subtype));
    hook_event.insert("hook_id".to_owned(), Value::String(hook_id));
    hook_event.insert(
        "tool_use_id".to_owned(),
        Value::String(lifecycle_id.clone()),
    );
    hook_event.insert("status".to_owned(), Value::String(status.to_owned()));

    let entry = ClaudeTranscriptEntry {
        created_at: timestamp.map(|timestamp| timestamp.text).or_else(|| {
            existing_entry
                .as_ref()
                .and_then(|entry| entry.created_at.clone())
        }),
        metadata: None,
        raw_message_id: Some(message_identity.clone()),
        resources: None,
        role: "tool".to_owned(),
        source_message_id: Some(message_identity.clone()),
        text: String::new(),
        tool_call_id: Some(lifecycle_id),
        tool_calls: Some(vec![Value::Object(hook_event)]),
        turn_id: existing_entry
            .as_ref()
            .and_then(|entry| entry.turn_id.clone())
            .or_else(|| context.current_turn_id.clone()),
    };
    upsert_claude_transcript_entry(context, entry, Some(message_identity), line_index);
}

fn apply_claude_task_transcript_line(
    context: &mut ClaudeSessionParseContext,
    envelope: &Value,
    include_messages: bool,
    line_index: usize,
) {
    let task_id = normalize_value_string(envelope.get("task_id"));
    let explicit_tool_use_id = normalize_value_string(envelope.get("tool_use_id"));
    if let (Some(task_id), Some(tool_use_id)) = (&task_id, &explicit_tool_use_id) {
        context
            .task_tool_use_id_by_task_id
            .insert(task_id.clone(), tool_use_id.clone());
    }
    let lifecycle_id = explicit_tool_use_id
        .or_else(|| {
            task_id.as_ref().and_then(|task_id| {
                context
                    .task_tool_use_id_by_task_id
                    .get(task_id.as_str())
                    .cloned()
            })
        })
        .or_else(|| task_id.clone())
        .or_else(|| normalize_value_string(envelope.get("id")));
    let Some(lifecycle_id) = lifecycle_id else {
        return;
    };

    context.has_transcript = true;
    let timestamp = parse_claude_timestamp(envelope.get("timestamp"));
    if let Some(timestamp) = timestamp.clone() {
        observe_claude_timestamp(context, timestamp, true);
    }
    if !include_messages {
        return;
    }

    let message_identity = format!("task:{lifecycle_id}");
    let existing_entry = context
        .message_index_by_id
        .get(message_identity.to_ascii_lowercase().as_str())
        .and_then(|index| context.messages.get(*index))
        .cloned();
    let existing_event = existing_entry
        .as_ref()
        .and_then(|entry| entry.tool_calls.as_ref())
        .and_then(|tool_calls| tool_calls.first());
    let mut merged_event = existing_event
        .and_then(Value::as_object)
        .cloned()
        .unwrap_or_default();
    if let Some(patch) = envelope.get("patch").and_then(Value::as_object) {
        for (key, value) in patch {
            merged_event.insert(key.clone(), value.clone());
        }
    }
    if let Some(event) = envelope.as_object() {
        for (key, value) in event {
            merged_event.insert(key.clone(), value.clone());
        }
    }
    merged_event.insert("type".to_owned(), Value::String("system".to_owned()));
    if let Some(task_id) = task_id {
        merged_event.insert("task_id".to_owned(), Value::String(task_id));
    }
    merged_event.insert(
        "tool_use_id".to_owned(),
        Value::String(lifecycle_id.clone()),
    );

    let subtype = normalize_value_string(merged_event.get("subtype"))
        .unwrap_or_else(|| "task_updated".to_owned());
    let description = normalize_value_string(merged_event.get("description"))
        .or_else(|| normalize_value_string(merged_event.get("summary")))
        .unwrap_or_else(|| lifecycle_id.clone());
    let text = match subtype.as_str() {
        "task_started" => format!("Task started: {description}"),
        "task_progress" => format!("Task progress: {description}"),
        "task_notification" => format!("Task finished: {description}"),
        _ => format!("Task updated: {description}"),
    };
    let turn_id = normalize_value_string(
        envelope
            .get("requestId")
            .or_else(|| envelope.get("request_id")),
    )
    .or_else(|| {
        existing_entry
            .as_ref()
            .and_then(|entry| entry.turn_id.clone())
    })
    .or_else(|| context.current_turn_id.clone());
    let entry = ClaudeTranscriptEntry {
        created_at: timestamp.map(|timestamp| timestamp.text),
        metadata: None,
        raw_message_id: Some(message_identity.clone()),
        resources: None,
        role: "tool".to_owned(),
        source_message_id: Some(message_identity.clone()),
        text,
        tool_call_id: Some(lifecycle_id),
        tool_calls: Some(vec![Value::Object(merged_event)]),
        turn_id,
    };
    upsert_claude_transcript_entry(context, entry, Some(message_identity), line_index);
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
    let is_synthetic_user_message = role == "user" && claude_message_is_synthetic(envelope);
    if claude_skips_transcript(envelope)
        || (role != "user" && claude_message_is_synthetic(envelope))
        || envelope
            .get("isCompactSummary")
            .and_then(Value::as_bool)
            .unwrap_or(false)
    {
        return;
    }

    let message = envelope.get("message");
    if role == "assistant" {
        context.model_id = normalize_value_string(message.and_then(|value| value.get("model")))
            .or_else(|| context.model_id.clone());
    }
    let content_value = message
        .and_then(|value| value.get("content"))
        .or_else(|| envelope.get("content"));
    let raw_message_id = normalize_value_string(envelope.get("uuid"))
        .or_else(|| normalize_value_string(message.and_then(|value| value.get("id"))));
    if raw_message_id
        .as_ref()
        .map(|identity| identity.trim().to_ascii_lowercase())
        .is_some_and(|identity| context.retracted_message_ids.contains(identity.as_str()))
    {
        return;
    }
    let explicit_turn_id = normalize_value_string(envelope.get("requestId"))
        .or_else(|| normalize_value_string(envelope.get("request_id")));
    let message_turn_id = normalize_value_string(message.and_then(|value| value.get("id")));
    let native_tool_result = (role == "user")
        .then(|| {
            envelope
                .get("toolUseResult")
                .or_else(|| envelope.get("tool_use_result"))
        })
        .flatten();
    let mut content_segments = extract_claude_message_content_segments_with_native_result(
        content_value,
        raw_message_id.as_deref(),
        native_tool_result,
        role == "user",
    );
    let mut correlated_turn_id = None;
    let mut has_tool_result = false;
    for segment in &mut content_segments {
        if !segment.is_tool_result {
            continue;
        }
        has_tool_result = true;
        for tool_call in &mut segment.tool_calls {
            let Some(tool_use_id) = read_claude_tool_call_id(tool_call) else {
                continue;
            };
            let Some(tool_context) = context.tool_call_context_by_id.get(tool_use_id.as_str())
            else {
                continue;
            };
            correlated_turn_id = correlated_turn_id.or_else(|| tool_context.turn_id.clone());
            if let (Some(tool_name), Some(tool_call)) =
                (tool_context.tool_name.as_ref(), tool_call.as_object_mut())
            {
                let has_tool_name = tool_call
                    .get("name")
                    .and_then(Value::as_str)
                    .is_some_and(|value| !value.trim().is_empty());
                if !has_tool_name {
                    tool_call.insert("name".to_owned(), Value::String(tool_name.clone()));
                }
            }
        }
    }
    if is_synthetic_user_message {
        content_segments.retain(|segment| segment.is_tool_result);
    }

    let turn_id = if role == "user" && has_tool_result {
        correlated_turn_id
            .or_else(|| context.current_turn_id.clone())
            .or(explicit_turn_id.clone())
            .or(message_turn_id.clone())
    } else if role == "user" {
        let turn_id = explicit_turn_id
            .clone()
            .or_else(|| raw_message_id.clone())
            .or_else(|| message_turn_id.clone())
            .or_else(|| context.current_turn_id.clone());
        context.current_turn_id = turn_id.clone();
        turn_id
    } else {
        context
            .current_turn_id
            .clone()
            .or(explicit_turn_id.clone())
            .or(message_turn_id.clone())
    };

    if content_segments.is_empty() {
        return;
    }

    context.has_transcript = true;
    let timestamp = parse_claude_timestamp(envelope.get("timestamp"));
    if let Some(timestamp) = timestamp.clone() {
        observe_claude_timestamp(context, timestamp, true);
    }

    if role == "user" && context.first_prompt.is_none() {
        let authored_text = content_segments
            .iter()
            .filter_map(|segment| {
                (!segment.is_tool_result && !segment.text.is_empty())
                    .then_some(segment.text.as_str())
            })
            .collect::<Vec<_>>()
            .join("\n");
        let (title, command_fallback) = normalize_claude_first_prompt(authored_text.as_str());
        if let Some(title) = title {
            context.first_prompt = Some(title);
        } else if context.command_title_fallback.is_none() {
            context.command_title_fallback = command_fallback;
        }
    }

    if !include_messages {
        return;
    }

    let metadata = build_claude_message_metadata(envelope, message);
    let segment_count = content_segments.len();
    let entries = content_segments
        .into_iter()
        .enumerate()
        .map(|(segment_index, content)| {
            let segment_role = if role == "user" && content.is_tool_result {
                "tool"
            } else {
                role
            };
            let segment_tool_call_ids = content
                .tool_calls
                .iter()
                .filter_map(read_claude_tool_call_id)
                .collect::<BTreeSet<_>>();
            let segment_tool_call_id = (segment_role == "tool" && segment_tool_call_ids.len() == 1)
                .then(|| segment_tool_call_ids.into_iter().next())
                .flatten();
            let segment_message_id = if segment_count == 1 {
                raw_message_id.clone()
            } else {
                Some(
                    raw_message_id
                        .as_ref()
                        .map(|message_id| format!("{message_id}:segment:{}", segment_index + 1))
                        .unwrap_or_else(|| {
                            format!("anonymous:{line_index}:segment:{}", segment_index + 1)
                        }),
                )
            };
            ClaudeTranscriptEntry {
                created_at: timestamp.as_ref().map(|timestamp| timestamp.text.clone()),
                metadata: metadata.clone(),
                raw_message_id: segment_message_id,
                resources: (!content.resources.is_empty()).then_some(content.resources),
                role: segment_role.to_owned(),
                source_message_id: raw_message_id.clone(),
                text: content.text,
                tool_call_id: segment_tool_call_id,
                tool_calls: (!content.tool_calls.is_empty()).then_some(content.tool_calls),
                turn_id: turn_id.clone(),
            }
        })
        .collect::<Vec<_>>();
    let entries = entries
        .into_iter()
        .filter(|entry| !claude_entry_matches_message_ids(entry, &context.retracted_message_ids))
        .collect::<Vec<_>>();
    if role == "assistant" {
        for entry in entries.iter().filter(|entry| entry.role == "assistant") {
            register_claude_tool_calls(
                context,
                entry.tool_calls.as_deref().unwrap_or_default(),
                entry.turn_id.as_deref(),
            );
        }
    }

    replace_claude_transcript_entries(context, entries, raw_message_id.as_deref(), line_index);
}

fn replace_claude_transcript_entries(
    context: &mut ClaudeSessionParseContext,
    entries: Vec<ClaudeTranscriptEntry>,
    source_message_id: Option<&str>,
    line_index: usize,
) {
    let Some(source_message_id) = source_message_id
        .map(str::trim)
        .filter(|identity| !identity.is_empty())
    else {
        for entry in entries {
            let message_identity = entry.raw_message_id.clone();
            upsert_claude_transcript_entry(context, entry, message_identity, line_index);
        }
        return;
    };
    let normalized_source_message_id = source_message_id.to_ascii_lowercase();
    let replaced_tool_call_ids =
        collect_claude_assistant_tool_call_ids(context.messages.iter().filter(|entry| {
            claude_entry_matches_source_message_id(entry, &normalized_source_message_id)
        }));
    let replacement_tool_call_ids = collect_claude_assistant_tool_call_ids(entries.iter());
    let stale_tool_call_ids = replaced_tool_call_ids
        .difference(&replacement_tool_call_ids)
        .cloned()
        .collect::<BTreeSet<_>>();
    let insertion_index = context
        .messages
        .iter()
        .position(|entry| {
            claude_entry_matches_source_message_id(entry, &normalized_source_message_id)
        })
        .unwrap_or(context.messages.len());
    context.messages.retain(|entry| {
        !claude_entry_matches_source_message_id(entry, &normalized_source_message_id)
    });
    let insertion_index = insertion_index.min(context.messages.len());
    context
        .messages
        .splice(insertion_index..insertion_index, entries);
    rebuild_claude_message_index(context);
    remove_claude_tool_call_contexts(context, &stale_tool_call_ids);
}

fn claude_entry_matches_source_message_id(
    entry: &ClaudeTranscriptEntry,
    normalized_source_message_id: &str,
) -> bool {
    entry
        .source_message_id
        .as_deref()
        .or(entry.raw_message_id.as_deref())
        .map(|identity| identity.trim().to_ascii_lowercase())
        .is_some_and(|identity| identity == normalized_source_message_id)
}

fn rebuild_claude_message_index(context: &mut ClaudeSessionParseContext) {
    context.message_index_by_id = context
        .messages
        .iter()
        .enumerate()
        .filter_map(|(index, entry)| {
            entry
                .raw_message_id
                .as_ref()
                .map(|identity| (identity.trim().to_ascii_lowercase(), index))
        })
        .collect();
}

fn upsert_claude_transcript_entry(
    context: &mut ClaudeSessionParseContext,
    entry: ClaudeTranscriptEntry,
    message_identity: Option<String>,
    line_index: usize,
) {
    let message_identity = message_identity
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| format!("anonymous:{line_index}:{}", context.messages.len()));
    if let Some(existing_index) = context.message_index_by_id.get(&message_identity).copied() {
        context.messages[existing_index] = entry;
        return;
    }
    context
        .message_index_by_id
        .insert(message_identity, context.messages.len());
    context.messages.push(entry);
}

fn register_claude_tool_calls(
    context: &mut ClaudeSessionParseContext,
    tool_calls: &[Value],
    turn_id: Option<&str>,
) {
    for tool_call in tool_calls {
        let tool_type = normalize_value_string(tool_call.get("type"));
        if !tool_type
            .as_deref()
            .is_some_and(|value| value == "tool_use" || value.ends_with("_tool_use"))
        {
            continue;
        }
        let Some(tool_use_id) = read_claude_tool_call_id(tool_call) else {
            continue;
        };
        context.tool_call_context_by_id.insert(
            tool_use_id,
            ClaudeToolCallContext {
                tool_name: normalize_value_string(tool_call.get("name")),
                turn_id: turn_id.map(str::to_owned),
            },
        );
    }
}

fn read_claude_tool_call_id(tool_call: &Value) -> Option<String> {
    normalize_value_string(tool_call.get("tool_use_id"))
        .or_else(|| normalize_value_string(tool_call.get("toolUseId")))
        .or_else(|| normalize_value_string(tool_call.get("id")))
}

fn extract_claude_tool_result_content(
    content: Option<&Value>,
    native_result: Option<&Value>,
) -> Option<ClaudeToolResultContent> {
    let blocks = match content {
        Some(Value::Array(blocks)) => blocks.as_slice(),
        Some(block) => std::slice::from_ref(block),
        None => return None,
    };
    let mut text_fragments = Vec::new();
    let mut tool_calls = Vec::new();

    for block in blocks {
        let block_type = normalize_value_string(block.get("type"));
        if !block_type
            .as_deref()
            .is_some_and(|value| value == "tool_result" || value.ends_with("_tool_result"))
        {
            continue;
        }
        let Some(tool_use_id) = read_claude_tool_call_id(block) else {
            continue;
        };
        let output = resolve_claude_tool_result_output(block, native_result);
        let output_text = output
            .as_ref()
            .and_then(extract_claude_tool_output_text)
            .unwrap_or_default();
        let status = resolve_claude_tool_result_status(block, native_result, output_text.as_str());
        let mut tool_call = block.as_object().cloned().unwrap_or_default();
        tool_call.insert("tool_use_id".to_owned(), Value::String(tool_use_id.clone()));
        tool_call.insert("status".to_owned(), Value::String(status.to_owned()));
        if let Some(output) = output.filter(|value| !value.is_null()) {
            tool_call.insert("output".to_owned(), output);
        }
        if !output_text.is_empty() {
            text_fragments.push(output_text);
        }
        tool_calls.push(Value::Object(tool_call));
    }

    if tool_calls.is_empty() {
        None
    } else {
        Some(ClaudeToolResultContent {
            text: text_fragments.join("\n"),
            tool_calls,
        })
    }
}

fn resolve_claude_tool_result_output(
    block: &Value,
    native_result: Option<&Value>,
) -> Option<Value> {
    let block_content = block.get("content").filter(|value| !value.is_null());
    if block_content.is_some_and(has_rich_claude_tool_result_content) {
        return block_content.cloned();
    }
    if let Some(text) = native_result.and_then(extract_claude_tool_output_text) {
        return Some(Value::String(text));
    }
    if let Some(text) = block_content.and_then(extract_claude_tool_output_text) {
        return Some(Value::String(text));
    }
    native_result
        .filter(|value| !value.is_null())
        .cloned()
        .or_else(|| block_content.cloned())
}

fn has_rich_claude_tool_result_content(value: &Value) -> bool {
    match value {
        Value::Array(values) => values.iter().any(has_rich_claude_tool_result_content),
        Value::Object(record) => record
            .get("type")
            .and_then(Value::as_str)
            .is_some_and(|value| {
                matches!(
                    value,
                    "audio" | "document" | "image" | "resource" | "resource_link"
                )
            }),
        _ => false,
    }
}

fn extract_claude_tool_output_text(value: &Value) -> Option<String> {
    match value {
        Value::String(value) => normalize_non_empty_string(value),
        Value::Array(values) => {
            let fragments = values
                .iter()
                .filter_map(extract_claude_tool_output_text)
                .collect::<Vec<_>>();
            normalize_non_empty_string(fragments.join("\n").as_str())
        }
        Value::Object(record) => {
            let stdout = record
                .get("stdout")
                .and_then(Value::as_str)
                .and_then(normalize_non_empty_string);
            let stderr = record
                .get("stderr")
                .and_then(Value::as_str)
                .and_then(normalize_non_empty_string);
            if stdout.is_some() || stderr.is_some() {
                return Some(
                    [stdout, stderr]
                        .into_iter()
                        .flatten()
                        .collect::<Vec<_>>()
                        .join("\n"),
                );
            }

            if let Some(file_content) = record
                .get("file")
                .and_then(Value::as_object)
                .and_then(|file| file.get("content"))
                .and_then(extract_claude_tool_output_text)
            {
                return Some(file_content);
            }

            for key in ["content", "output", "result", "text", "message", "error"] {
                if let Some(text) = record.get(key).and_then(extract_claude_tool_output_text) {
                    return Some(text);
                }
            }
            for key in ["filenames", "lines", "results"] {
                if let Some(text) = record.get(key).and_then(extract_claude_tool_output_text) {
                    return Some(text);
                }
            }
            None
        }
        _ => None,
    }
}

fn resolve_claude_tool_result_status(
    block: &Value,
    native_result: Option<&Value>,
    output_text: &str,
) -> &'static str {
    let native_status = native_result
        .and_then(Value::as_object)
        .and_then(|record| record.get("status"))
        .and_then(Value::as_str)
        .map(|value| value.trim().to_ascii_lowercase());
    let block_status = block
        .get("status")
        .and_then(Value::as_str)
        .map(|value| value.trim().to_ascii_lowercase());
    let has_cancellation_flag = std::iter::once(block)
        .chain(native_result)
        .filter_map(Value::as_object)
        .any(|record| {
            ["interrupted", "cancelled", "canceled", "aborted"]
                .into_iter()
                .any(|key| record.get(key).and_then(Value::as_bool) == Some(true))
        });
    let normalized_output = output_text.trim().to_ascii_lowercase();
    let has_cancellation_text = [
        "[request interrupted by user",
        "command was aborted before completion",
        "user rejected tool use",
        "tool use was rejected",
        "doesn't want to take this action",
        "does not want to take this action",
        "doesn't want to proceed with this tool use",
        "does not want to proceed with this tool use",
    ]
    .into_iter()
    .any(|marker| normalized_output.contains(marker));
    let has_cancelled_status = [block_status.as_deref(), native_status.as_deref()]
        .into_iter()
        .flatten()
        .any(|status| {
            matches!(
                status,
                "aborted" | "cancelled" | "canceled" | "rejected" | "stopped" | "terminated"
            )
        });
    if has_cancellation_flag || has_cancellation_text || has_cancelled_status {
        return "cancelled";
    }

    let native_error = native_result
        .and_then(Value::as_object)
        .is_some_and(|record| {
            record.get("ok").and_then(Value::as_bool) == Some(false)
                || record.get("success").and_then(Value::as_bool) == Some(false)
                || record
                    .get("error")
                    .is_some_and(has_meaningful_claude_error_value)
                || read_claude_boolean(record.get("isError").or_else(|| record.get("is_error")))
                    == Some(true)
        });
    let has_error_status = [block_status.as_deref(), native_status.as_deref()]
        .into_iter()
        .flatten()
        .any(|status| matches!(status, "error" | "failed" | "failure"));
    let has_error_text =
        normalized_output.starts_with("error:") || normalized_output.contains("<tool_use_error>");
    if read_claude_boolean(block.get("is_error").or_else(|| block.get("isError"))) == Some(true)
        || block
            .get("error")
            .is_some_and(has_meaningful_claude_error_value)
        || native_error
        || has_error_status
        || has_error_text
    {
        "error"
    } else {
        "completed"
    }
}

fn read_claude_boolean(value: Option<&Value>) -> Option<bool> {
    match value? {
        Value::Bool(value) => Some(*value),
        Value::String(value) if value.trim().eq_ignore_ascii_case("true") => Some(true),
        Value::String(value) if value.trim().eq_ignore_ascii_case("false") => Some(false),
        _ => None,
    }
}

fn has_meaningful_claude_error_value(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(value) => *value,
        Value::Number(value) => value.as_f64().is_some_and(|value| value != 0.0),
        Value::String(value) => {
            let value = value.trim();
            !value.is_empty()
                && !value.eq_ignore_ascii_case("false")
                && !value.eq_ignore_ascii_case("null")
        }
        Value::Array(values) => values.iter().any(has_meaningful_claude_error_value),
        Value::Object(record) => record.values().any(has_meaningful_claude_error_value),
    }
}

fn bounded_claude_resource_string(value: Option<&Value>, max_characters: usize) -> Option<String> {
    let value = value?.as_str()?.trim();
    (!value.is_empty()).then(|| value.chars().take(max_characters).collect::<String>())
}

fn bounded_claude_mime_type(value: Option<&Value>) -> Option<String> {
    let value = value?.as_str()?.trim();
    if value.len() > 128 {
        return None;
    }
    let mut parts = value.split('/');
    let type_name = parts.next()?;
    let subtype_name = parts.next()?;
    if type_name.is_empty() || subtype_name.is_empty() || parts.next().is_some() {
        return None;
    }
    let is_mime_token = |part: &str| {
        part.chars().all(|character| {
            character.is_ascii_alphanumeric()
                || matches!(
                    character,
                    '!' | '#'
                        | '$'
                        | '%'
                        | '&'
                        | '\''
                        | '*'
                        | '+'
                        | '-'
                        | '.'
                        | '^'
                        | '_'
                        | '`'
                        | '|'
                        | '~'
                )
        })
    };
    (is_mime_token(type_name) && is_mime_token(subtype_name)).then(|| value.to_ascii_lowercase())
}

fn is_claude_opaque_media_source(value: &str) -> bool {
    let normalized = value.trim().to_ascii_lowercase();
    normalized.starts_with("data:") || normalized.starts_with("blob:")
}

fn is_claude_https_uri(value: &str) -> bool {
    value.trim().to_ascii_lowercase().starts_with("https://")
}

fn claude_image_mime_is_embeddable(mime_type: &str) -> bool {
    matches!(
        mime_type,
        "image/gif" | "image/jpeg" | "image/png" | "image/webp"
    )
}

fn is_valid_claude_base64_data(value: &str) -> bool {
    if value.is_empty() || !value.len().is_multiple_of(4) || !value.is_ascii() {
        return false;
    }
    let padding_start = value.find('=').unwrap_or(value.len());
    let padding_length = value.len().saturating_sub(padding_start);
    padding_length <= 2
        && value[..padding_start]
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'/'))
        && value[padding_start..].bytes().all(|byte| byte == b'=')
}

fn project_claude_image_media_source(
    source: Option<&Value>,
    mime_type: Option<&str>,
    uri: Option<&str>,
) -> Option<String> {
    if let Some(uri) = uri {
        return Some(uri.to_owned());
    }
    let source = source?.as_object()?;
    let source_type = normalize_value_string(source.get("type"))?.to_ascii_lowercase();
    if !matches!(source_type.as_str(), "base64" | "data") {
        return None;
    }
    let data = source.get("data")?.as_str()?.trim();
    if data.is_empty() {
        return None;
    }
    if data
        .get(..5)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("data:"))
    {
        let separator_index = data.find(',')?;
        if separator_index > 256 {
            return None;
        }
        let header = data[..separator_index].to_ascii_lowercase();
        let embedded_mime_type = header.strip_prefix("data:")?.split(';').next()?;
        let payload = &data[separator_index + 1..];
        if !header.ends_with(";base64")
            || !claude_image_mime_is_embeddable(embedded_mime_type)
            || !is_valid_claude_base64_data(payload)
        {
            return None;
        }
        return (data.chars().count() <= CLAUDE_RESOURCE_MEDIA_SOURCE_CHARACTER_LIMIT)
            .then(|| data.to_owned());
    }
    if source_type != "base64" {
        return None;
    }
    if !is_valid_claude_base64_data(data) {
        return None;
    }
    let mime_type = mime_type.filter(|mime_type| claude_image_mime_is_embeddable(mime_type))?;
    let prefix = format!("data:{mime_type};base64,");
    if prefix.chars().count() + data.chars().count() > CLAUDE_RESOURCE_MEDIA_SOURCE_CHARACTER_LIMIT
    {
        return None;
    }
    Some(format!("{prefix}{data}"))
}

fn project_claude_message_resource(
    block: &Value,
    index: usize,
    message_id: Option<&str>,
) -> Option<CodeEngineSessionResourceRecord> {
    let block_type = normalize_value_string(block.get("type"))?.to_ascii_lowercase();
    if !matches!(block_type.as_str(), "image" | "document") {
        return None;
    }
    let source = block.get("source");
    let name = ["title", "name", "filename"]
        .into_iter()
        .find_map(|key| bounded_claude_resource_string(block.get(key), 256))
        .or_else(|| {
            Some(if block_type == "image" {
                "Image".to_owned()
            } else {
                "Document".to_owned()
            })
        });
    let mime_type = ["media_type", "mediaType", "mime_type", "mimeType"]
        .into_iter()
        .find_map(|key| {
            bounded_claude_mime_type(block.get(key))
                .or_else(|| bounded_claude_mime_type(source.and_then(|source| source.get(key))))
        });
    let path = bounded_claude_resource_string(block.get("path"), 4_096)
        .or_else(|| {
            bounded_claude_resource_string(source.and_then(|source| source.get("path")), 4_096)
        })
        .filter(|path| !is_claude_opaque_media_source(path));
    let uri = ["uri", "url"]
        .into_iter()
        .find_map(|key| {
            bounded_claude_resource_string(block.get(key), 4_096).or_else(|| {
                bounded_claude_resource_string(source.and_then(|source| source.get(key)), 4_096)
            })
        })
        .filter(|uri| is_claude_https_uri(uri));
    let description = ["context", "description"]
        .into_iter()
        .find_map(|key| bounded_claude_resource_string(block.get(key), 4_000));
    let stable_message_id = message_id.unwrap_or("claude-message");
    let media_source = (block_type == "image")
        .then(|| project_claude_image_media_source(source, mime_type.as_deref(), uri.as_deref()))
        .flatten();

    Some(CodeEngineSessionResourceRecord {
        id: format!("{stable_message_id}:attachment:{}", index + 1),
        kind: if block_type == "image" {
            "image".to_owned()
        } else {
            "file".to_owned()
        },
        name,
        path,
        uri,
        media_source,
        mime_type,
        description,
        origin: Some(CodeEngineSessionResourceOriginRecord {
            kind: "resource".to_owned(),
            name: Some("Claude message attachment".to_owned()),
            path: None,
            uri: None,
            client_name: Some("Claude Code".to_owned()),
            line_start: None,
            line_end: None,
            column_start: None,
            column_end: None,
            excerpt: None,
        }),
        citation: None,
    })
}

fn empty_claude_message_content() -> ClaudeMessageContent {
    ClaudeMessageContent {
        is_tool_result: false,
        resources: Vec::new(),
        text: String::new(),
        tool_calls: Vec::new(),
    }
}

fn append_claude_tool_content_segment(segments: &mut Vec<ClaudeMessageContent>, tool_call: Value) {
    let needs_tool_segment = segments.last().is_none_or(|segment| {
        segment.is_tool_result || !segment.text.is_empty() || !segment.resources.is_empty()
    });
    if needs_tool_segment {
        segments.push(empty_claude_message_content());
    }
    segments
        .last_mut()
        .expect("tool Claude segment")
        .tool_calls
        .push(tool_call);
}

fn append_claude_tool_result_content_segment(
    segments: &mut Vec<ClaudeMessageContent>,
    tool_result: ClaudeToolResultContent,
) {
    let needs_tool_result_segment = segments
        .last()
        .is_none_or(|segment| !segment.is_tool_result || !segment.resources.is_empty());
    if needs_tool_result_segment {
        let mut segment = empty_claude_message_content();
        segment.is_tool_result = true;
        segments.push(segment);
    }
    let segment = segments.last_mut().expect("tool-result Claude segment");
    if !segment.text.is_empty() && !tool_result.text.is_empty() {
        segment.text.push('\n');
    }
    segment.text.push_str(tool_result.text.as_str());
    segment.tool_calls.extend(tool_result.tool_calls);
}

#[cfg(test)]
fn extract_claude_message_content_segments(
    content: Option<&Value>,
    message_id: Option<&str>,
) -> Vec<ClaudeMessageContent> {
    extract_claude_message_content_segments_with_native_result(content, message_id, None, false)
}

fn extract_claude_message_content_segments_with_native_result(
    content: Option<&Value>,
    message_id: Option<&str>,
    native_tool_result: Option<&Value>,
    tool_results_are_user_messages: bool,
) -> Vec<ClaudeMessageContent> {
    let Some(content) = content else {
        return Vec::new();
    };
    if let Some(text) = normalize_value_string(Some(content)) {
        return vec![ClaudeMessageContent {
            is_tool_result: false,
            resources: Vec::new(),
            text,
            tool_calls: Vec::new(),
        }];
    }

    let mut segments = Vec::<ClaudeMessageContent>::new();
    for (index, block) in content.as_array().into_iter().flatten().enumerate() {
        let block_type = normalize_value_string(block.get("type"))
            .unwrap_or_default()
            .to_ascii_lowercase();
        match block_type.as_str() {
            "text" => {
                if let Some(text) = normalize_value_string(block.get("text")) {
                    let needs_authored_segment = segments.last().is_none_or(|segment| {
                        segment.is_tool_result
                            || !segment.tool_calls.is_empty()
                            || !segment.resources.is_empty()
                    });
                    if needs_authored_segment {
                        segments.push(empty_claude_message_content());
                    }
                    let segment = segments.last_mut().expect("authored Claude segment");
                    if !segment.text.is_empty() {
                        segment.text.push('\n');
                    }
                    segment.text.push_str(text.as_str());
                }
            }
            tool_type if tool_type == "tool_use" || tool_type.ends_with("_tool_use") => {
                append_claude_tool_content_segment(&mut segments, block.clone());
            }
            tool_result_type
                if tool_result_type == "tool_result"
                    || tool_result_type.ends_with("_tool_result") =>
            {
                if let Some(tool_result) =
                    extract_claude_tool_result_content(Some(block), native_tool_result)
                {
                    if tool_results_are_user_messages {
                        append_claude_tool_result_content_segment(&mut segments, tool_result);
                    } else {
                        for tool_call in tool_result.tool_calls {
                            append_claude_tool_content_segment(&mut segments, tool_call);
                        }
                    }
                }
            }
            "image" | "document" => {
                if let Some(resource) = project_claude_message_resource(block, index, message_id) {
                    let needs_resource_segment = segments.last().is_none_or(|segment| {
                        segment.is_tool_result
                            || !segment.tool_calls.is_empty()
                            || !segment.text.is_empty()
                    });
                    if needs_resource_segment {
                        segments.push(empty_claude_message_content());
                    }
                    segments
                        .last_mut()
                        .expect("resource Claude segment")
                        .resources
                        .push(resource);
                }
            }
            _ => {}
        }
    }

    segments.retain(|segment| {
        !segment.text.is_empty() || !segment.tool_calls.is_empty() || !segment.resources.is_empty()
    });
    segments
}

fn build_claude_message_metadata(
    envelope: &Value,
    message: Option<&Value>,
) -> Option<BTreeMap<String, String>> {
    let mut metadata = BTreeMap::new();
    if let Some(model_id) = normalize_value_string(message.and_then(|value| value.get("model"))) {
        metadata.insert("modelId".to_owned(), model_id);
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
    let runtime_status = match context.terminal_state {
        Some(ClaudeTerminalState::Failed) => "failed",
        Some(ClaudeTerminalState::Cancelled) => "terminated",
        Some(ClaudeTerminalState::Completed) | None => "completed",
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
    native_attributes.model_provider = Some("anthropic".to_owned());
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
                    tool_call_id: message.tool_call_id,
                    file_changes: None,
                    reasoning: None,
                    resources: message.resources.as_deref().and_then(|resources| {
                        let resources = sanitize_codeengine_session_resource_records(resources);
                        (!resources.is_empty()).then_some(resources)
                    }),
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
        collections::BTreeSet,
        fs,
        path::{Path, PathBuf},
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    use serde_json::{json, Value};

    use super::{
        extract_claude_message_content_segments,
        get_claude_code_session_detail_from_config_directory,
        list_claude_code_session_summaries_from_config_directory, parse_claude_code_session_detail,
        parse_claude_code_session_detail_with_record_limit, parse_claude_code_session_summary,
        project_claude_message_resource, CLAUDE_RESOURCE_MEDIA_SOURCE_CHARACTER_LIMIT,
        CLAUDE_RESULT_NOTICE_CHARACTER_LIMIT,
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
            summary.native_attributes.model_provider.as_deref(),
            Some("anthropic")
        );
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
            Some("2099-07-15T00:00:02Z")
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse Claude detail")
            .expect("Claude detail");
        assert_eq!(detail.messages.len(), 4);
        assert_eq!(detail.messages[0].role, "user");
        assert_eq!(detail.messages[0].content, "Inspect every provider session");
        assert_eq!(detail.messages[1].role, "assistant");
        assert_eq!(detail.messages[1].content, "I found the native history.");
        assert!(detail.messages[1].tool_calls.is_none());
        assert_eq!(detail.messages[2].role, "assistant");
        assert!(detail.messages[2].content.is_empty());
        assert_eq!(
            detail.messages[2].tool_calls.as_ref().map(Vec::len),
            Some(1)
        );
        assert_eq!(detail.messages[3].role, "tool");
        assert_eq!(detail.messages[3].content, "file contents");
        assert_eq!(
            detail.messages[3].tool_call_id.as_deref(),
            Some("tool-use-1")
        );
        assert_eq!(
            detail.messages[3].tool_calls.as_ref().unwrap()[0]["status"],
            "completed"
        );
        assert_eq!(
            detail.messages[3].tool_calls.as_ref().unwrap()[0]["output"],
            "file contents"
        );
        assert_eq!(
            detail.messages[3].tool_calls.as_ref().unwrap()[0]["name"],
            "Read"
        );
        assert_eq!(detail.messages[2].turn_id, detail.messages[3].turn_id);
        assert_ne!(detail.messages[1].id, detail.messages[2].id);
        assert!(detail.messages[0].id.ends_with("user-message-1"));
    }

    #[test]
    fn claude_session_parser_preserves_ordered_assistant_content_segments() {
        let fixture = TestDirectory::new("ordered-assistant-content");
        let session_id = "21212121-2121-4121-8121-212121212121";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-ordered-assistant-content")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "requestId": "ordered-turn",
                    "uuid": "ordered-user",
                    "timestamp": "2099-07-21T00:00:00Z",
                    "message": { "role": "user", "content": "Inspect in provider order" }
                }),
                json!({
                    "sessionId": session_id,
                    "type": "assistant",
                    "uuid": "ordered-assistant",
                    "timestamp": "2099-07-21T00:00:01Z",
                    "message": {
                        "id": "ordered-turn",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [
                            { "type": "text", "text": "Before tools." },
                            {
                                "type": "tool_use",
                                "id": "toolu-ordered-read",
                                "name": "Read",
                                "input": { "file_path": "src/ordered.rs" }
                            },
                            {
                                "type": "server_tool_use",
                                "id": "toolu-ordered-search",
                                "name": "web_search",
                                "input": { "query": "ordered" }
                            },
                            {
                                "type": "web_search_tool_result",
                                "tool_use_id": "toolu-ordered-search",
                                "content": [{
                                    "title": "Ordered provider events",
                                    "url": "https://example.com/ordered"
                                }]
                            },
                            { "type": "thinking", "thinking": "private reasoning must stay hidden" },
                            { "type": "text", "text": "Between tools." },
                            {
                                "type": "image",
                                "title": "ordered.png",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/png",
                                    "data": "aW1hZ2U="
                                }
                            },
                            {
                                "type": "tool_use",
                                "id": "toolu-ordered-write",
                                "name": "Write",
                                "input": { "file_path": "src/ordered.rs" }
                            },
                            { "type": "text", "text": "After tools." }
                        ]
                    }
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse ordered Claude content fixture")
            .expect("ordered Claude content detail");
        assert_eq!(detail.messages.len(), 7);
        let assistant_segments = &detail.messages[1..];
        assert_eq!(assistant_segments[0].content, "Before tools.");
        assert!(assistant_segments[0].tool_calls.is_none());
        assert_eq!(
            assistant_segments[1].tool_calls.as_ref().map(Vec::len),
            Some(3)
        );
        assert!(assistant_segments[1].content.is_empty());
        assert_eq!(
            assistant_segments[1].tool_calls.as_ref().unwrap()[2]["status"],
            "completed"
        );
        assert_eq!(assistant_segments[2].content, "Between tools.");
        assert_eq!(
            assistant_segments[3]
                .resources
                .as_ref()
                .and_then(|resources| resources.first())
                .and_then(|resource| resource.media_source.as_deref()),
            Some("data:image/png;base64,aW1hZ2U=")
        );
        assert_eq!(
            assistant_segments[4].tool_calls.as_ref().map(Vec::len),
            Some(1)
        );
        assert_eq!(assistant_segments[5].content, "After tools.");
        assert!(assistant_segments.iter().all(|message| {
            message.turn_id.as_deref() == Some("ordered-turn")
                && !message.content.contains("private reasoning")
        }));
        let message_ids = assistant_segments
            .iter()
            .map(|message| message.id.as_str())
            .collect::<BTreeSet<_>>();
        assert_eq!(message_ids.len(), assistant_segments.len());
    }

    #[test]
    fn claude_session_parser_preserves_mixed_user_text_and_tool_result_order() {
        let fixture = TestDirectory::new("mixed-user-tool-result");
        let session_id = "23232323-2323-4323-8323-232323232323";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-mixed-user-tool-result")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "requestId": "mixed-user-turn",
                    "uuid": "mixed-user-prompt",
                    "timestamp": "2099-07-21T01:00:00Z",
                    "message": { "role": "user", "content": "Inspect the file" }
                }),
                json!({
                    "sessionId": session_id,
                    "type": "assistant",
                    "uuid": "mixed-user-assistant",
                    "timestamp": "2099-07-21T01:00:01Z",
                    "message": {
                        "id": "mixed-user-turn",
                        "role": "assistant",
                        "content": [{
                            "type": "tool_use",
                            "id": "toolu-mixed-user-read",
                            "name": "Read",
                            "input": { "file_path": "src/mixed.rs" }
                        }]
                    }
                }),
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "uuid": "mixed-user-result",
                    "timestamp": "2099-07-21T01:00:02Z",
                    "message": {
                        "role": "user",
                        "content": [
                            { "type": "text", "text": "Before the result." },
                            {
                                "type": "tool_result",
                                "tool_use_id": "toolu-mixed-user-read",
                                "content": "file contents"
                            },
                            { "type": "text", "text": "After the result." }
                        ]
                    }
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse mixed Claude user fixture")
            .expect("mixed Claude user detail");
        assert_eq!(detail.messages.len(), 5);
        assert_eq!(detail.messages[2].role, "user");
        assert_eq!(detail.messages[2].content, "Before the result.");
        assert_eq!(detail.messages[3].role, "tool");
        assert_eq!(
            detail.messages[3].tool_call_id.as_deref(),
            Some("toolu-mixed-user-read")
        );
        assert_eq!(
            detail.messages[3].tool_calls.as_ref().unwrap()[0]["name"],
            "Read"
        );
        assert_eq!(detail.messages[4].role, "user");
        assert_eq!(detail.messages[4].content, "After the result.");
        assert!(detail.messages[2..]
            .iter()
            .all(|message| message.turn_id.as_deref() == Some("mixed-user-turn")));
    }

    #[test]
    fn claude_attachment_segments_preserve_text_and_resource_boundaries() {
        let segments = extract_claude_message_content_segments(
            Some(&json!([
                {
                    "type": "image",
                    "title": "before.png",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": "aW1hZ2U="
                    }
                },
                { "type": "text", "text": "Between attachments." },
                {
                    "type": "document",
                    "title": "contract.pdf",
                    "source": {
                        "type": "url",
                        "url": "https://example.com/contract.pdf",
                        "media_type": "application/pdf"
                    }
                },
                { "type": "text", "text": "After attachments." }
            ])),
            Some("ordered-attachments"),
        );

        assert_eq!(segments.len(), 4);
        assert_eq!(segments[0].resources.len(), 1);
        assert!(segments[0].text.is_empty());
        assert_eq!(segments[1].text, "Between attachments.");
        assert!(segments[1].resources.is_empty());
        assert_eq!(segments[2].resources.len(), 1);
        assert!(segments[2].text.is_empty());
        assert_eq!(segments[3].text, "After attachments.");
    }

    #[test]
    fn claude_session_parser_filters_synthetic_user_text_but_keeps_tool_results() {
        let fixture = TestDirectory::new("synthetic-user-messages");
        let session_id = "15151515-1515-4515-8515-151515151515";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-synthetic-user-messages")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "shouldQuery": false,
                    "message": {
                        "role": "user",
                        "content": "Authored queued transcript note"
                    },
                    "uuid": "authored-queued-user",
                    "timestamp": "2099-07-15T00:05:00Z"
                }),
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "isSynthetic": true,
                    "message": {
                        "role": "user",
                        "content": "Synthetic SDK bridge prompt"
                    },
                    "uuid": "synthetic-sdk-user",
                    "timestamp": "2099-07-15T00:05:01Z"
                }),
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "is_synthetic": true,
                    "message": {
                        "role": "user",
                        "content": "Synthetic snake-case bridge prompt"
                    },
                    "uuid": "synthetic-snake-user",
                    "timestamp": "2099-07-15T00:05:02Z"
                }),
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "isMeta": true,
                    "message": {
                        "role": "user",
                        "content": "Synthetic native-history prompt"
                    },
                    "uuid": "synthetic-meta-user",
                    "timestamp": "2099-07-15T00:05:03Z"
                }),
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "is_meta": true,
                    "message": {
                        "role": "user",
                        "content": "Synthetic snake-case native-history prompt"
                    },
                    "uuid": "synthetic-meta-snake-user",
                    "timestamp": "2099-07-15T00:05:04Z"
                }),
                json!({
                    "sessionId": session_id,
                    "type": "assistant",
                    "message": {
                        "id": "assistant-synthetic-tool-use",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [{
                            "type": "tool_use",
                            "id": "tool-synthetic-result",
                            "name": "Bash",
                            "input": {"command": "pnpm typecheck"}
                        }]
                    },
                    "uuid": "assistant-synthetic-tool-use-entry",
                    "timestamp": "2099-07-15T00:05:05Z"
                }),
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "isMeta": true,
                    "shouldQuery": false,
                    "toolUseResult": {
                        "stdout": "Structured SDK output",
                        "stderr": "",
                        "interrupted": false
                    },
                    "message": {
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": "tool-synthetic-result",
                            "content": "Model-facing tool output"
                        }]
                    },
                    "uuid": "synthetic-tool-result-entry",
                    "timestamp": "2099-07-15T00:05:06Z"
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse Claude synthetic-user detail")
            .expect("Claude synthetic-user detail");
        assert_eq!(detail.messages.len(), 3);
        assert_eq!(detail.messages[0].role, "user");
        assert_eq!(
            detail.messages[0].content,
            "Authored queued transcript note"
        );
        assert_eq!(detail.messages[1].role, "assistant");
        assert!(detail.messages[1].content.is_empty());
        assert_eq!(detail.messages[2].role, "tool");
        assert_eq!(
            detail.messages[2].tool_call_id.as_deref(),
            Some("tool-synthetic-result")
        );
        assert_eq!(
            detail.messages[2].tool_calls.as_ref().unwrap()[0]["name"],
            "Bash"
        );
        assert_eq!(
            detail.messages[2].tool_calls.as_ref().unwrap()[0]["output"],
            "Structured SDK output"
        );
        assert!(detail
            .messages
            .iter()
            .all(|message| !message.content.to_ascii_lowercase().contains("synthetic")));
    }

    #[test]
    fn claude_session_parser_correlates_success_error_and_cancelled_tool_results() {
        let fixture = TestDirectory::new("tool-lifecycle");
        let session_id = "14141414-1414-4414-8414-141414141414";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-tool-lifecycle")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "parentUuid": null,
                    "isSidechain": false,
                    "cwd": "E:/workspace/birdcoder",
                    "sessionId": session_id,
                    "type": "user",
                    "message": {
                        "role": "user",
                        "content": "Run the provider lifecycle checks"
                    },
                    "uuid": "tool-lifecycle-user",
                    "timestamp": "2099-07-15T00:10:00Z"
                }),
                json!({
                    "parentUuid": "tool-lifecycle-user",
                    "isSidechain": false,
                    "cwd": "E:/workspace/birdcoder",
                    "sessionId": session_id,
                    "type": "assistant",
                    "message": {
                        "id": "assistant-tool-lifecycle",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [
                            {
                                "type": "tool_use",
                                "id": "tool-success",
                                "name": "Bash",
                                "input": {"command": "pnpm typecheck"}
                            },
                            {
                                "type": "tool_use",
                                "id": "tool-error",
                                "name": "Read",
                                "input": {"file_path": "missing.ts"}
                            },
                            {
                                "type": "tool_use",
                                "id": "tool-cancelled",
                                "name": "Bash",
                                "input": {"command": "pnpm test"}
                            }
                        ]
                    },
                    "uuid": "assistant-tool-lifecycle-entry",
                    "timestamp": "2099-07-15T00:10:01Z"
                }),
                json!({
                    "parentUuid": "assistant-tool-lifecycle-entry",
                    "isSidechain": false,
                    "cwd": "E:/workspace/birdcoder",
                    "sessionId": session_id,
                    "type": "user",
                    "toolUseResult": {
                        "stdout": "Typecheck passed",
                        "stderr": "",
                        "interrupted": false,
                        "error": false
                    },
                    "message": {
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": "tool-success",
                            "content": "Typecheck passed"
                        }]
                    },
                    "uuid": "tool-success-result",
                    "timestamp": "2099-07-15T00:10:02Z"
                }),
                json!({
                    "parentUuid": "assistant-tool-lifecycle-entry",
                    "isSidechain": false,
                    "cwd": "E:/workspace/birdcoder",
                    "sessionId": session_id,
                    "type": "user",
                    "toolUseResult": "Error: permission denied",
                    "message": {
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": "tool-error",
                            "content": "<tool_use_error>Error: permission denied</tool_use_error>",
                            "is_error": true
                        }]
                    },
                    "uuid": "tool-error-result",
                    "timestamp": "2099-07-15T00:10:03Z"
                }),
                json!({
                    "parentUuid": "assistant-tool-lifecycle-entry",
                    "isSidechain": false,
                    "cwd": "E:/workspace/birdcoder",
                    "sessionId": session_id,
                    "type": "user",
                    "toolUseResult": {
                        "stdout": "Partial test output",
                        "stderr": "",
                        "interrupted": true
                    },
                    "message": {
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": "tool-cancelled",
                            "content": "Partial test output\n<error>Command was aborted before completion</error>",
                            "is_error": true
                        }]
                    },
                    "uuid": "tool-cancelled-result",
                    "timestamp": "2099-07-15T00:10:04Z"
                }),
                json!({
                    "parentUuid": "tool-cancelled-result",
                    "isSidechain": false,
                    "cwd": "E:/workspace/birdcoder",
                    "sessionId": session_id,
                    "type": "assistant",
                    "message": {
                        "id": "assistant-tool-lifecycle-final",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [{"type": "text", "text": "Lifecycle checks finished."}]
                    },
                    "uuid": "assistant-tool-lifecycle-final-entry",
                    "timestamp": "2099-07-15T00:10:05Z"
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse Claude tool lifecycle detail")
            .expect("Claude tool lifecycle detail");
        assert_eq!(detail.messages.len(), 6);
        let tool_request = &detail.messages[1];
        assert_eq!(tool_request.role, "assistant");
        assert!(tool_request.content.is_empty());
        assert_eq!(tool_request.tool_calls.as_ref().map(Vec::len), Some(3));
        assert!(detail
            .messages
            .iter()
            .all(|message| !message.content.contains("Tool call:")));

        let success = detail
            .messages
            .iter()
            .find(|message| message.tool_call_id.as_deref() == Some("tool-success"))
            .expect("successful Claude tool result");
        assert_eq!(success.role, "tool");
        assert_eq!(success.content, "Typecheck passed");
        assert_eq!(
            success.tool_calls.as_ref().unwrap()[0]["status"],
            "completed"
        );
        assert_eq!(
            success.tool_calls.as_ref().unwrap()[0]["output"],
            "Typecheck passed"
        );
        assert_eq!(success.tool_calls.as_ref().unwrap()[0]["name"], "Bash");

        let error = detail
            .messages
            .iter()
            .find(|message| message.tool_call_id.as_deref() == Some("tool-error"))
            .expect("failed Claude tool result");
        assert_eq!(error.role, "tool");
        assert_eq!(error.content, "Error: permission denied");
        assert_eq!(error.tool_calls.as_ref().unwrap()[0]["status"], "error");
        assert_eq!(
            error.tool_calls.as_ref().unwrap()[0]["output"],
            "Error: permission denied"
        );
        assert_eq!(error.tool_calls.as_ref().unwrap()[0]["name"], "Read");

        let cancelled = detail
            .messages
            .iter()
            .find(|message| message.tool_call_id.as_deref() == Some("tool-cancelled"))
            .expect("cancelled Claude tool result");
        assert_eq!(cancelled.role, "tool");
        assert_eq!(cancelled.content, "Partial test output");
        assert_eq!(
            cancelled.tool_calls.as_ref().unwrap()[0]["status"],
            "cancelled"
        );
        assert_eq!(
            cancelled.tool_calls.as_ref().unwrap()[0]["output"],
            "Partial test output"
        );
        assert_eq!(cancelled.tool_calls.as_ref().unwrap()[0]["name"], "Bash");

        let turn_id = detail.messages[0].turn_id.as_deref();
        assert_eq!(turn_id, Some("tool-lifecycle-user"));
        assert!(detail
            .messages
            .iter()
            .all(|message| message.turn_id.as_deref() == turn_id));
        assert_eq!(detail.messages[5].content, "Lifecycle checks finished.");
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

    #[test]
    fn claude_session_parser_merges_tasks_and_projects_lifecycle_notices() {
        let fixture = TestDirectory::new("lifecycle-events");
        let session_id = "66666666-6666-4666-8666-666666666666";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-birdcoder")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "type": "user",
                    "sessionId": session_id,
                    "cwd": "E:/workspace/birdcoder",
                    "uuid": "user-lifecycle",
                    "requestId": "turn-lifecycle",
                    "timestamp": "2099-07-20T00:00:00Z",
                    "message": { "role": "user", "content": "Run the background audit" }
                }),
                json!({
                    "type": "system",
                    "subtype": "task_started",
                    "sessionId": session_id,
                    "task_id": "task-audit",
                    "tool_use_id": "toolu-task-audit",
                    "description": "Audit providers",
                    "prompt": "Inspect native history",
                    "timestamp": "2099-07-20T00:00:01Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "task_updated",
                    "sessionId": session_id,
                    "task_id": "task-audit",
                    "patch": {
                        "description": "Audit all providers",
                        "status": "paused",
                        "error": "Waiting for evidence"
                    },
                    "timestamp": "2099-07-20T00:00:02Z"
                }),
                json!({
                    "type": "tool_use_summary",
                    "sessionId": session_id,
                    "uuid": "tool-summary-audit",
                    "summary": "Inspected the provider adapters",
                    "preceding_tool_use_ids": ["toolu-task-audit"],
                    "timestamp": "2099-07-20T00:00:02.500Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "task_notification",
                    "sessionId": session_id,
                    "task_id": "task-audit",
                    "status": "completed",
                    "summary": "must stay hidden",
                    "skip_transcript": true,
                    "timestamp": "2099-07-20T00:00:03Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "task_started",
                    "sessionId": session_id,
                    "task_id": "task-hidden",
                    "description": "Hidden task",
                    "skip_transcript": true,
                    "timestamp": "2099-07-20T00:00:04Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "background_tasks_changed",
                    "sessionId": session_id,
                    "backgroundTaskCount": 2,
                    "timestamp": "2099-07-20T00:00:05Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "permission_denied",
                    "sessionId": session_id,
                    "tool_use_id": "tool-denied",
                    "tool_name": "Write",
                    "decision_reason": "Workspace policy",
                    "timestamp": "2099-07-20T00:00:06Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "api_retry",
                    "sessionId": session_id,
                    "attempt": 2,
                    "message": "Temporary provider failure.",
                    "timestamp": "2099-07-20T00:00:07Z"
                }),
                json!({
                    "type": "mirror_error",
                    "sessionId": session_id,
                    "error": { "message": "Mirror persistence failed" },
                    "timestamp": "2099-07-20T00:00:08Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "model_refusal_fallback",
                    "sessionId": session_id,
                    "timestamp": "2099-07-20T00:00:08.100Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "model_refusal_no_fallback",
                    "sessionId": session_id,
                    "timestamp": "2099-07-20T00:00:08.200Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "notification",
                    "sessionId": session_id,
                    "uuid": "notification-credentials",
                    "key": "credentials",
                    "text": "Credentials expire soon",
                    "priority": "high",
                    "timestamp": "2099-07-20T00:00:08.300Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "memory_recall",
                    "sessionId": session_id,
                    "uuid": "memory-recall-1",
                    "mode": "select",
                    "memories": [{
                        "path": "E:/workspace/birdcoder/.claude/memory/provider.md",
                        "scope": "personal"
                    }, {
                        "path": "https://example.com/team-memory",
                        "scope": "organization",
                        "content": "Provider contract context"
                    }],
                    "timestamp": "2099-07-20T00:00:08.400Z"
                }),
                json!({
                    "type": "assistant",
                    "sessionId": session_id,
                    "uuid": "assistant-aborted",
                    "error": "aborted",
                    "timestamp": "2099-07-20T00:00:09Z",
                    "message": {
                        "id": "assistant-turn-aborted",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [{ "type": "text", "text": "Partial useful output" }]
                    }
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse Claude lifecycle fixture")
            .expect("Claude lifecycle detail");
        assert_eq!(detail.messages.len(), 12);
        let task_message = detail
            .messages
            .iter()
            .find(|message| message.tool_call_id.as_deref() == Some("toolu-task-audit"))
            .expect("merged Claude task message");
        let task_event = &task_message.tool_calls.as_ref().unwrap()[0];
        assert_eq!(task_event["subtype"], "task_updated");
        assert_eq!(task_event["description"], "Audit all providers");
        assert_eq!(task_event["prompt"], "Inspect native history");
        assert_eq!(task_event["status"], "paused");
        assert_eq!(task_event["task_id"], "task-audit");
        assert_eq!(task_event["tool_use_id"], "toolu-task-audit");
        assert_eq!(task_event["patch"]["error"], "Waiting for evidence");
        let tool_summary = detail
            .messages
            .iter()
            .find(|message| message.tool_call_id.as_deref() == Some("tool-summary-audit"))
            .expect("Claude tool use summary message");
        assert_eq!(tool_summary.content, "");
        assert_eq!(
            tool_summary.tool_calls.as_ref().unwrap()[0]["summary"],
            "Inspected the provider adapters"
        );
        assert!(detail
            .messages
            .iter()
            .all(|message| !message.content.contains("must stay hidden")));
        assert!(detail
            .messages
            .iter()
            .all(|message| message.tool_call_id.as_deref() != Some("task-hidden")));

        let notice_kinds = detail
            .messages
            .iter()
            .filter_map(|message| {
                message
                    .metadata
                    .as_ref()
                    .and_then(|metadata| metadata.get("noticeKind"))
                    .map(|kind| (kind.as_str(), message.content.as_str()))
            })
            .collect::<Vec<_>>();
        assert!(notice_kinds
            .iter()
            .any(|(kind, content)| { *kind == "retry" && content.contains("attempt 2") }));
        assert!(notice_kinds
            .iter()
            .any(|(kind, content)| *kind == "retry" && content.contains("fallback model")));
        assert!(notice_kinds.iter().any(|(kind, content)| {
            *kind == "failed" && content.contains("Mirror persistence failed")
        }));
        assert!(notice_kinds
            .iter()
            .any(|(kind, content)| { *kind == "failed" && content.contains("no fallback model") }));
        assert!(notice_kinds.iter().any(|(kind, content)| {
            *kind == "warning" && content.contains("Credentials expire soon")
        }));
        assert!(notice_kinds
            .iter()
            .any(|(kind, content)| *kind == "cancelled" && *content == "Generation cancelled."));
        assert!(detail.messages.iter().any(
            |message| message.role == "assistant" && message.content == "Partial useful output"
        ));
        let memory_message = detail
            .messages
            .iter()
            .find(|message| message.content == "Recalled from memory.")
            .expect("Claude memory recall message");
        let memory_resources = memory_message
            .resources
            .as_ref()
            .expect("Claude memory resources");
        assert_eq!(memory_resources.len(), 2);
        assert_eq!(
            memory_resources[0].path.as_deref(),
            Some("E:/workspace/birdcoder/.claude/memory/provider.md")
        );
        assert_eq!(
            memory_resources[1].uri.as_deref(),
            Some("https://example.com/team-memory")
        );
        assert_eq!(
            memory_resources[1].description.as_deref(),
            Some("Provider contract context")
        );
        let permission_message = detail
            .messages
            .iter()
            .find(|message| message.tool_call_id.as_deref() == Some("tool-denied"))
            .expect("Claude permission denial tool lifecycle");
        assert_eq!(permission_message.role, "tool");
        assert!(permission_message.content.contains("Workspace policy"));
        assert_eq!(
            permission_message.tool_calls.as_ref().unwrap()[0]["subtype"],
            "permission_denied"
        );
    }

    #[test]
    fn claude_session_parser_merges_tool_progress_hooks_and_compact_failures() {
        let fixture = TestDirectory::new("progress-hooks-compact-failure");
        let session_id = "68686868-6868-4868-8868-686868686868";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-progress-hooks")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "type": "user",
                    "sessionId": session_id,
                    "uuid": "progress-user",
                    "requestId": "progress-turn",
                    "timestamp": "2099-07-20T01:00:00Z",
                    "message": { "role": "user", "content": "Run the checks" }
                }),
                json!({
                    "type": "assistant",
                    "sessionId": session_id,
                    "uuid": "progress-assistant",
                    "timestamp": "2099-07-20T01:00:01Z",
                    "message": {
                        "id": "progress-turn",
                        "role": "assistant",
                        "content": [{
                            "type": "tool_use",
                            "id": "toolu-progress-check",
                            "name": "Bash",
                            "input": { "command": "pnpm test" }
                        }]
                    }
                }),
                json!({
                    "type": "tool_progress",
                    "session_id": session_id,
                    "uuid": "progress-update",
                    "tool_use_id": "toolu-progress-check",
                    "tool_name": "Bash",
                    "elapsed_time_seconds": 3.5,
                    "timestamp": "2099-07-20T01:00:02Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "hook_started",
                    "session_id": session_id,
                    "uuid": "hook-started",
                    "hook_id": "hook-lint",
                    "hook_name": "lint-policy",
                    "hook_event": "PostToolUse",
                    "timestamp": "2099-07-20T01:00:03Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "hook_progress",
                    "session_id": session_id,
                    "uuid": "hook-progress",
                    "hook_id": "hook-lint",
                    "hook_name": "lint-policy",
                    "hook_event": "PostToolUse",
                    "stdout": "Checking output",
                    "stderr": "",
                    "output": "",
                    "timestamp": "2099-07-20T01:00:04Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "hook_response",
                    "session_id": session_id,
                    "uuid": "hook-response",
                    "hook_id": "hook-lint",
                    "hook_name": "lint-policy",
                    "hook_event": "PostToolUse",
                    "stdout": "Checking output",
                    "stderr": "Lint policy rejected the output",
                    "output": "Hook failed",
                    "exit_code": 1,
                    "outcome": "error",
                    "timestamp": "2099-07-20T01:00:05Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "status",
                    "session_id": session_id,
                    "uuid": "compact-failed",
                    "status": null,
                    "compact_result": "failed",
                    "compact_error": "Compaction failed safely",
                    "timestamp": "2099-07-20T01:00:06Z"
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse Claude progress and hook fixture")
            .expect("Claude progress and hook detail");
        let progress = detail
            .messages
            .iter()
            .find(|message| message.tool_call_id.as_deref() == Some("toolu-progress-check"))
            .expect("Claude tool progress row");
        assert_eq!(
            progress.tool_calls.as_ref().unwrap()[0]["type"],
            "tool_progress"
        );
        assert_eq!(
            progress.tool_calls.as_ref().unwrap()[0]["status"],
            "running"
        );
        assert_eq!(
            progress.tool_calls.as_ref().unwrap()[0]["elapsed_time_seconds"],
            3.5
        );

        let hooks = detail
            .messages
            .iter()
            .filter(|message| message.tool_call_id.as_deref() == Some("hook:hook-lint"))
            .collect::<Vec<_>>();
        assert_eq!(hooks.len(), 1, "hook lifecycle must update one stable row");
        let hook = &hooks[0].tool_calls.as_ref().unwrap()[0];
        assert_eq!(hook["subtype"], "hook_response");
        assert_eq!(hook["status"], "failed");
        assert_eq!(hook["stderr"], "Lint policy rejected the output");
        assert_eq!(hook["exit_code"], 1);

        let compact_failure = detail
            .messages
            .iter()
            .find(|message| {
                message
                    .metadata
                    .as_ref()
                    .and_then(|metadata| metadata.get("noticeKind"))
                    .is_some_and(|kind| kind == "warning")
                    && message.content.contains("Compaction failed safely")
            })
            .expect("Claude compact failure warning");
        assert_eq!(compact_failure.role, "system");
    }

    #[test]
    fn claude_session_parser_projects_informational_notices_without_raw_envelopes() {
        let fixture = TestDirectory::new("informational-notices");
        let session_id = "67676767-6767-4767-8767-676767676767";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-birdcoder")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "type": "user",
                    "sessionId": session_id,
                    "cwd": "E:/workspace/birdcoder",
                    "uuid": "user-informational",
                    "timestamp": "2099-07-20T00:10:00Z",
                    "message": { "role": "user", "content": "Run provider hooks" }
                }),
                json!({
                    "type": "system",
                    "subtype": "informational",
                    "sessionId": session_id,
                    "uuid": "informational-warning",
                    "level": "warning",
                    "message": "Workspace policy may restrict this operation.",
                    "timestamp": "2099-07-20T00:10:01Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "informational",
                    "sessionId": session_id,
                    "uuid": "informational-notice",
                    "level": "notice",
                    "content": "Hook feedback is available.",
                    "timestamp": "2099-07-20T00:10:02Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "informational",
                    "sessionId": session_id,
                    "uuid": "informational-stopped-snake",
                    "level": "suggestion",
                    "message": "A hook stopped execution.",
                    "prevent_continuation": true,
                    "timestamp": "2099-07-20T00:10:03Z"
                }),
                json!({
                    "type": "informational",
                    "sessionId": session_id,
                    "uuid": "informational-stopped-camel",
                    "level": "info",
                    "content": { "internal": "must not leak into the transcript" },
                    "preventContinuation": true,
                    "timestamp": "2099-07-20T00:10:04Z"
                }),
                json!({
                    "type": "system",
                    "subtype": "local_command_output",
                    "sessionId": session_id,
                    "uuid": "local-command-output",
                    "content": "Slash command completed successfully.",
                    "timestamp": "2099-07-20T00:10:05Z"
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse Claude informational fixture")
            .expect("Claude informational detail");
        let notices = detail
            .messages
            .iter()
            .filter_map(|message| {
                message
                    .metadata
                    .as_ref()
                    .and_then(|metadata| metadata.get("noticeKind"))
                    .map(|kind| (kind.as_str(), message.content.as_str()))
            })
            .collect::<Vec<_>>();
        assert_eq!(
            notices,
            vec![
                ("warning", "Workspace policy may restrict this operation."),
                ("info", "Hook feedback is available."),
                ("stopped", "A hook stopped execution."),
                ("stopped", "Agent execution stopped."),
                ("info", "Slash command completed successfully."),
            ]
        );
        assert!(detail
            .messages
            .iter()
            .all(|message| !message.content.contains("must not leak")));
    }

    #[test]
    fn claude_session_parser_evicts_refusal_fallback_messages() {
        let fixture = TestDirectory::new("refusal-fallback-retractions");
        let session_id = "77777777-7777-4777-8777-777777777777";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-birdcoder")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "type": "user",
                    "sessionId": session_id,
                    "uuid": "refusal-user",
                    "requestId": "refusal-turn",
                    "timestamp": "2099-07-20T01:00:00Z",
                    "message": { "role": "user", "content": "Read the file" }
                }),
                json!({
                    "type": "assistant",
                    "sessionId": session_id,
                    "uuid": "refused-tool-use",
                    "timestamp": "2099-07-20T01:00:01Z",
                    "message": {
                        "id": "refusal-turn",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [{
                            "type": "tool_use",
                            "id": "toolu-refused-read",
                            "name": "Read",
                            "input": { "path": "src/stale.rs" }
                        }]
                    }
                }),
                json!({
                    "type": "user",
                    "sessionId": session_id,
                    "uuid": "refused-tool-result",
                    "timestamp": "2099-07-20T01:00:02Z",
                    "message": {
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": "toolu-refused-read",
                            "content": "stale tool output"
                        }]
                    }
                }),
                json!({
                    "type": "assistant",
                    "sessionId": session_id,
                    "uuid": "fallback-answer",
                    "supersedes": ["refused-tool-use", "refused-tool-result"],
                    "timestamp": "2099-07-20T01:00:03Z",
                    "message": {
                        "id": "refusal-turn",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [{
                            "type": "text",
                            "text": "Canonical fallback answer"
                        }]
                    }
                }),
                json!({
                    "type": "user",
                    "sessionId": session_id,
                    "uuid": "refused-tool-result",
                    "timestamp": "2099-07-20T01:00:03.500Z",
                    "message": {
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": "toolu-refused-read",
                            "content": "duplicate stale tool output"
                        }]
                    }
                }),
                json!({
                    "type": "system",
                    "subtype": "model_refusal_fallback",
                    "sessionId": session_id,
                    "uuid": "fallback-resolution",
                    "direction": "retry",
                    "retracted_message_uuids": ["refused-tool-use", "refused-tool-result"],
                    "timestamp": "2099-07-20T01:00:04Z"
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse Claude refusal fallback fixture")
            .expect("Claude refusal fallback detail");
        assert!(detail
            .messages
            .iter()
            .any(|message| message.content == "Canonical fallback answer"));
        assert!(detail.messages.iter().all(|message| {
            !message.content.contains("stale tool output")
                && !message.id.contains("refused-tool-use")
                && !message.id.contains("refused-tool-result")
                && message.tool_call_id.as_deref() != Some("toolu-refused-read")
        }));
        assert!(detail.messages.iter().any(|message| {
            message
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("noticeKind"))
                .is_some_and(|kind| kind == "retry")
        }));
    }

    #[test]
    fn claude_session_parser_projects_message_attachments_without_base64_placeholders() {
        let fixture = TestDirectory::new("message-attachments");
        let session_id = "19191919-1919-4919-8919-191919191919";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-message-attachments")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[json!({
                "sessionId": session_id,
                "type": "user",
                "uuid": "attachment-message",
                "timestamp": "2099-07-21T01:00:00Z",
                "message": {
                    "role": "user",
                    "content": [{
                        "type": "text",
                        "text": "Review the attached provider artifacts."
                    }, {
                        "type": "image",
                        "title": "provider-screen.png",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": "PRIVATE_IMAGE_BASE64_MUST_NOT_SURVIVE"
                        }
                    }, {
                        "type": "document",
                        "title": "provider-contract.pdf",
                        "path": "E:/workspace/birdcoder/docs/provider-contract.pdf",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": "PRIVATE_DOCUMENT_BASE64_MUST_NOT_SURVIVE"
                        }
                    }, {
                        "type": "document",
                        "title": "provider-reference.pdf",
                        "source": {
                            "type": "url",
                            "media_type": "application/pdf",
                            "url": "https://example.com/provider-reference.pdf"
                        }
                    }]
                }
            })],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse Claude attachment fixture")
            .expect("Claude attachment detail");
        assert_eq!(detail.messages.len(), 2);
        let authored_message = &detail.messages[0];
        assert_eq!(
            authored_message.content,
            "Review the attached provider artifacts."
        );
        assert!(authored_message.resources.is_none());
        let resource_message = &detail.messages[1];
        assert!(resource_message.content.is_empty());
        let resources = resource_message
            .resources
            .as_ref()
            .expect("attachment resources");
        assert_eq!(resources.len(), 3);
        assert_eq!(resources[0].kind, "image");
        assert_eq!(resources[0].name.as_deref(), Some("provider-screen.png"));
        assert_eq!(resources[0].mime_type.as_deref(), Some("image/png"));
        assert_eq!(resources[0].media_source, None);
        assert_eq!(
            resources[1].path.as_deref(),
            Some("E:/workspace/birdcoder/docs/provider-contract.pdf")
        );
        assert_eq!(resources[1].mime_type.as_deref(), Some("application/pdf"));
        assert_eq!(resources[1].name.as_deref(), Some("provider-contract.pdf"));
        assert_eq!(
            resources[2].uri.as_deref(),
            Some("https://example.com/provider-reference.pdf")
        );
        assert_eq!(resources[2].name.as_deref(), Some("provider-reference.pdf"));
        assert_eq!(resources[2].mime_type.as_deref(), Some("application/pdf"));
        assert_eq!(resources[2].media_source, None);
        let serialized = serde_json::to_string(resources).expect("serialize attachment resources");
        assert!(!serialized.contains("Image attachment."));
        assert!(!serialized.contains("Document attachment."));
        assert!(!serialized.contains("PRIVATE_IMAGE_BASE64_MUST_NOT_SURVIVE"));
        assert!(!serialized.contains("PRIVATE_DOCUMENT_BASE64_MUST_NOT_SURVIVE"));
    }

    #[test]
    fn claude_message_resource_enforces_total_media_source_boundary() {
        let media_prefix = "data:image/png;base64,";
        let maximum_payload_length =
            ((CLAUDE_RESOURCE_MEDIA_SOURCE_CHARACTER_LIMIT - media_prefix.len()) / 4) * 4;
        let bounded_image = project_claude_message_resource(
            &json!({
                "type": "image",
                "title": "bounded.png",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": "a".repeat(maximum_payload_length)
                }
            }),
            0,
            Some("bounded-image"),
        )
        .expect("bounded Claude image resource");
        let media_source = bounded_image
            .media_source
            .as_deref()
            .expect("bounded Claude image media source");
        assert!(media_source.chars().count() <= CLAUDE_RESOURCE_MEDIA_SOURCE_CHARACTER_LIMIT);

        let oversized_image = project_claude_message_resource(
            &json!({
                "type": "image",
                "title": "oversized.png",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": "a".repeat(maximum_payload_length + 4)
                }
            }),
            1,
            Some("oversized-image"),
        )
        .expect("oversized Claude image metadata");
        assert_eq!(oversized_image.media_source, None);

        let data_uri_image = project_claude_message_resource(
            &json!({
                "type": "image",
                "source": {
                    "type": "data",
                    "media_type": "image/png",
                    "data": "data:image/png;base64,aW1hZ2U="
                }
            }),
            2,
            Some("data-uri-image"),
        )
        .expect("Claude data URI image resource");
        assert_eq!(
            data_uri_image.media_source.as_deref(),
            Some("data:image/png;base64,aW1hZ2U=")
        );

        let document = project_claude_message_resource(
            &json!({
                "type": "document",
                "title": "private.pdf",
                "source": {
                    "type": "base64",
                    "media_type": "application/vnd.sdkwork~json",
                    "data": "ZmlsZQ=="
                }
            }),
            3,
            Some("private-document"),
        )
        .expect("Claude document metadata");
        assert_eq!(document.media_source, None);
        assert_eq!(
            document.mime_type.as_deref(),
            Some("application/vnd.sdkwork~json")
        );
        assert!(!serde_json::to_string(&document)
            .expect("serialize Claude document metadata")
            .contains("ZmlsZQ=="));
    }

    #[test]
    fn claude_session_parser_projects_result_failures_and_permission_denials_as_notices() {
        let fixture = TestDirectory::new("result-notices");
        let session_id = "20202020-2020-4020-8020-202020202020";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-result-notices")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "sessionId": session_id,
                    "type": "result",
                    "subtype": "error_during_execution",
                    "is_error": true,
                    "errors": ["Provider execution crashed", "Retry budget exhausted"],
                    "terminal_reason": "model_error",
                    "permission_denials": [{
                        "tool_name": "Write",
                        "tool_use_id": "toolu-unavailable-write",
                        "tool_input": { "file_path": "protected.rs" }
                    }],
                    "internal_envelope_secret": "must not enter the notice",
                    "uuid": "failed-result",
                    "timestamp": "2099-07-21T01:05:00Z"
                }),
                json!({
                    "sessionId": session_id,
                    "type": "result",
                    "subtype": "error_during_execution",
                    "is_error": false,
                    "errors": ["Tool execution stopped"],
                    "terminal_reason": "aborted_tools",
                    "permission_denials": [],
                    "uuid": "cancelled-result",
                    "timestamp": "2099-07-21T01:05:00.500Z"
                }),
                json!({
                    "sessionId": session_id,
                    "type": "result",
                    "subtype": "success",
                    "is_error": false,
                    "result": "Completed with one denied optional tool",
                    "permission_denials": [{
                        "tool_name": "Read",
                        "tool_use_id": "toolu-denied-read",
                        "tool_input": {"path": "secrets.txt"}
                    }],
                    "uuid": "permission-result",
                    "timestamp": "2099-07-21T01:05:01Z"
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse Claude result notice fixture")
            .expect("Claude result notice detail");
        assert_eq!(detail.summary.runtime_status.as_deref(), Some("completed"));
        let notices = detail
            .messages
            .iter()
            .map(|message| {
                (
                    message
                        .metadata
                        .as_ref()
                        .and_then(|metadata| metadata.get("noticeKind"))
                        .map(String::as_str),
                    message.content.as_str(),
                )
            })
            .collect::<Vec<_>>();
        assert_eq!(
            notices,
            vec![
                (
                    Some("failed"),
                    "Provider execution crashed\nRetry budget exhausted\nTerminal reason: model error."
                ),
                (Some("cancelled"), "Permission denied for Write."),
                (
                    Some("cancelled"),
                    "Tool execution stopped\nTerminal reason: aborted tools."
                ),
                (Some("cancelled"), "Permission denied for Read."),
            ]
        );
        assert!(detail.messages.iter().all(|message| {
            message.content.chars().count() <= CLAUDE_RESULT_NOTICE_CHARACTER_LIMIT
                && !message.content.contains("must not enter the notice")
        }));
    }

    #[test]
    fn claude_session_parser_correlates_result_permission_denials_without_failing_success() {
        let fixture = TestDirectory::new("correlated-result-permission-denials");
        let session_id = "22222222-2222-4222-8222-222222222222";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-correlated-result-permission-denials")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "requestId": "permission-turn",
                    "uuid": "permission-user",
                    "timestamp": "2099-07-21T01:10:00Z",
                    "message": { "role": "user", "content": "Read the protected file" }
                }),
                json!({
                    "sessionId": session_id,
                    "type": "assistant",
                    "uuid": "permission-assistant",
                    "timestamp": "2099-07-21T01:10:01Z",
                    "message": {
                        "id": "permission-turn",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [{
                            "type": "tool_use",
                            "id": "toolu-denied-read",
                            "name": "Read",
                            "input": { "file_path": "secrets.txt" }
                        }]
                    }
                }),
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "uuid": "permission-partial-tool-result",
                    "timestamp": "2099-07-21T01:10:01.500Z",
                    "message": {
                        "role": "user",
                        "content": [{
                            "type": "tool_result",
                            "tool_use_id": "toolu-denied-read",
                            "content": "partial output before denial"
                        }]
                    }
                }),
                json!({
                    "sessionId": session_id,
                    "type": "result",
                    "subtype": "success",
                    "is_error": false,
                    "result": "Completed with one denied optional tool",
                    "permission_denials": [{
                        "tool_name": "Read",
                        "tool_use_id": "toolu-denied-read",
                        "tool_input": { "file_path": "secrets.txt" }
                    }],
                    "uuid": "permission-result",
                    "timestamp": "2099-07-21T01:10:02Z"
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse correlated Claude result denial fixture")
            .expect("correlated Claude result denial detail");
        assert_eq!(detail.summary.runtime_status.as_deref(), Some("completed"));
        assert!(detail.messages.iter().all(|message| {
            message
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("noticeKind"))
                .is_none()
        }));
        let denied_tool = detail
            .messages
            .iter()
            .find(|message| message.tool_call_id.as_deref() == Some("toolu-denied-read"))
            .expect("correlated Claude permission denial lifecycle");
        assert_eq!(denied_tool.role, "tool");
        assert_eq!(denied_tool.turn_id.as_deref(), Some("permission-turn"));
        assert_eq!(
            denied_tool.tool_calls.as_ref().unwrap()[0]["subtype"],
            "permission_denied"
        );
        assert!(denied_tool.content.contains("Permission denied for Read"));
        assert!(!denied_tool.content.contains("partial output before denial"));
        assert_eq!(
            denied_tool.tool_calls.as_ref().unwrap()[0]["output"],
            "partial output before denial"
        );
    }

    #[test]
    fn claude_session_parser_retracts_split_message_by_segment_identity() {
        let fixture = TestDirectory::new("split-message-retraction");
        let session_id = "23232323-2323-4323-8323-232323232323";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-split-message-retraction")
            .join(format!("{session_id}.jsonl"));
        let split_assistant = json!({
            "sessionId": session_id,
            "type": "assistant",
            "uuid": "split-refused-message",
            "timestamp": "2099-07-21T02:00:01Z",
            "message": {
                "id": "split-retraction-turn",
                "role": "assistant",
                "model": "claude-sonnet-4-6",
                "content": [
                    { "type": "text", "text": "Keep the prefix." },
                    {
                        "type": "tool_use",
                        "id": "toolu-retracted-segment",
                        "name": "Read",
                        "input": { "file_path": "src/stale.rs" }
                    },
                    { "type": "text", "text": "Keep the suffix." }
                ]
            }
        });
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "requestId": "split-retraction-turn",
                    "uuid": "split-retraction-user",
                    "timestamp": "2099-07-21T02:00:00Z",
                    "message": { "role": "user", "content": "Inspect the file" }
                }),
                split_assistant.clone(),
                json!({
                    "sessionId": session_id,
                    "type": "system",
                    "subtype": "model_refusal_fallback",
                    "uuid": "split-retraction-resolution",
                    "retracted_message_uuids": ["split-refused-message:segment:2"],
                    "timestamp": "2099-07-21T02:00:02Z"
                }),
                split_assistant,
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse split retraction fixture")
            .expect("split retraction detail");
        assert!(detail
            .messages
            .iter()
            .any(|message| message.content == "Keep the prefix."));
        assert!(detail
            .messages
            .iter()
            .any(|message| message.content == "Keep the suffix."));
        assert!(detail.messages.iter().all(|message| {
            !message.id.ends_with("split-refused-message:segment:2")
                && !message.tool_calls.iter().flatten().any(|tool_call| {
                    tool_call.get("id").and_then(Value::as_str) == Some("toolu-retracted-segment")
                })
        }));
    }

    #[test]
    fn claude_message_replacement_clears_stale_tool_context() {
        let fixture = TestDirectory::new("replacement-tool-context");
        let session_id = "28282828-2828-4828-8828-282828282828";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-replacement-tool-context")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "requestId": "replacement-turn",
                    "uuid": "replacement-user",
                    "timestamp": "2099-07-21T02:05:00Z",
                    "message": { "role": "user", "content": "Inspect the file" }
                }),
                json!({
                    "sessionId": session_id,
                    "type": "assistant",
                    "uuid": "replaceable-assistant",
                    "timestamp": "2099-07-21T02:05:01Z",
                    "message": {
                        "id": "replacement-turn",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [{
                            "type": "tool_use",
                            "id": "toolu-replaced-read",
                            "name": "Read",
                            "input": { "file_path": "src/replaced.rs" }
                        }]
                    }
                }),
                json!({
                    "sessionId": session_id,
                    "type": "assistant",
                    "uuid": "replaceable-assistant",
                    "timestamp": "2099-07-21T02:05:02Z",
                    "message": {
                        "id": "replacement-turn",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [{
                            "type": "text",
                            "text": "The replacement no longer calls the tool."
                        }]
                    }
                }),
                json!({
                    "sessionId": session_id,
                    "type": "result",
                    "subtype": "success",
                    "is_error": false,
                    "permission_denials": [{
                        "tool_name": "Read",
                        "tool_use_id": "toolu-replaced-read",
                        "tool_input": { "file_path": "src/replaced.rs" }
                    }],
                    "uuid": "replacement-result",
                    "timestamp": "2099-07-21T02:05:03Z"
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse Claude replacement fixture")
            .expect("Claude replacement detail");
        assert!(detail
            .messages
            .iter()
            .any(|message| message.content == "The replacement no longer calls the tool."));
        assert!(detail.messages.iter().all(|message| {
            message.tool_call_id.as_deref() != Some("toolu-replaced-read")
                && !message.tool_calls.iter().flatten().any(|tool_call| {
                    ["tool_use_id", "toolUseId", "id"].into_iter().any(|key| {
                        tool_call.get(key).and_then(Value::as_str) == Some("toolu-replaced-read")
                    })
                })
        }));
        assert!(detail.messages.iter().any(|message| {
            message
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("noticeKind"))
                .is_some_and(|kind| kind == "cancelled")
                && message.content.contains("Permission denied for Read")
        }));
    }

    #[test]
    fn claude_result_permission_denial_preserves_richer_system_event() {
        let fixture = TestDirectory::new("permission-denial-merge");
        let session_id = "24242424-2424-4424-8424-242424242424";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-permission-denial-merge")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[
                json!({
                    "sessionId": session_id,
                    "type": "user",
                    "requestId": "permission-merge-turn",
                    "uuid": "permission-merge-user",
                    "timestamp": "2099-07-21T02:10:00Z",
                    "message": { "role": "user", "content": "Write the protected file" }
                }),
                json!({
                    "sessionId": session_id,
                    "type": "assistant",
                    "uuid": "permission-merge-assistant",
                    "timestamp": "2099-07-21T02:10:01Z",
                    "message": {
                        "id": "permission-merge-turn",
                        "role": "assistant",
                        "model": "claude-sonnet-4-6",
                        "content": [{
                            "type": "tool_use",
                            "id": "toolu-permission-merge",
                            "name": "Write",
                            "input": { "file_path": "protected.rs" }
                        }]
                    }
                }),
                json!({
                    "sessionId": session_id,
                    "type": "system",
                    "subtype": "permission_denied",
                    "uuid": "permission-denied-detail",
                    "tool_name": "Write",
                    "tool_use_id": "toolu-permission-merge",
                    "agent_id": "agent-security-review",
                    "decision_reason_type": "rule",
                    "decision_reason": "Workspace policy blocks generated writes",
                    "message": "The workspace policy denied this write.",
                    "timestamp": "2099-07-21T02:10:02Z"
                }),
                json!({
                    "sessionId": session_id,
                    "type": "result",
                    "subtype": "success",
                    "is_error": false,
                    "permission_denials": [{
                        "tool_name": "Write",
                        "tool_use_id": "toolu-permission-merge",
                        "tool_input": { "file_path": "protected.rs" }
                    }],
                    "uuid": "permission-merge-result",
                    "timestamp": "2099-07-21T02:10:03Z"
                }),
            ],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse permission merge fixture")
            .expect("permission merge detail");
        assert_eq!(detail.summary.runtime_status.as_deref(), Some("completed"));
        let denials = detail
            .messages
            .iter()
            .filter(|message| message.tool_call_id.as_deref() == Some("toolu-permission-merge"))
            .collect::<Vec<_>>();
        assert_eq!(denials.len(), 1);
        assert!(denials[0]
            .content
            .contains("workspace policy denied this write"));
        let event = &denials[0].tool_calls.as_ref().unwrap()[0];
        assert_eq!(event["decision_reason_type"], "rule");
        assert_eq!(event["agent_id"], "agent-security-review");
        assert_eq!(event["tool_input"]["file_path"], "protected.rs");
    }

    #[test]
    fn claude_latest_result_terminal_state_wins_across_turns() {
        let fixture = TestDirectory::new("latest-result-terminal-state");
        let recovered_session_id = "26262626-2626-4626-8626-262626262626";
        let recovered_session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-latest-result-terminal-state")
            .join(format!("{recovered_session_id}.jsonl"));
        write_jsonl(
            recovered_session_path.as_path(),
            &[
                json!({
                    "sessionId": recovered_session_id,
                    "type": "result",
                    "subtype": "error_during_execution",
                    "is_error": true,
                    "errors": ["First turn failed"],
                    "terminal_reason": "model_error",
                    "permission_denials": [],
                    "uuid": "failed-earlier-turn",
                    "timestamp": "2099-07-21T02:15:00Z"
                }),
                json!({
                    "sessionId": recovered_session_id,
                    "type": "result",
                    "subtype": "success",
                    "is_error": false,
                    "errors": [],
                    "terminal_reason": "completed",
                    "permission_denials": [],
                    "uuid": "successful-latest-turn",
                    "timestamp": "2099-07-21T02:16:00Z"
                }),
            ],
        );

        let recovered = parse_claude_code_session_detail(recovered_session_path.as_path())
            .expect("parse recovered Claude result fixture")
            .expect("recovered Claude result detail");
        assert_eq!(
            recovered.summary.runtime_status.as_deref(),
            Some("completed")
        );

        let failed_session_id = "27272727-2727-4727-8727-272727272727";
        let failed_session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-latest-result-terminal-state")
            .join(format!("{failed_session_id}.jsonl"));
        write_jsonl(
            failed_session_path.as_path(),
            &[
                json!({
                    "sessionId": failed_session_id,
                    "type": "result",
                    "subtype": "success",
                    "is_error": false,
                    "errors": [],
                    "terminal_reason": "completed",
                    "permission_denials": [],
                    "uuid": "successful-earlier-turn",
                    "timestamp": "2099-07-21T02:17:00Z"
                }),
                json!({
                    "sessionId": failed_session_id,
                    "type": "result",
                    "subtype": "error_during_execution",
                    "is_error": true,
                    "errors": ["Latest turn failed"],
                    "terminal_reason": "model_error",
                    "permission_denials": [],
                    "uuid": "failed-latest-turn",
                    "timestamp": "2099-07-21T02:18:00Z"
                }),
            ],
        );

        let failed = parse_claude_code_session_detail(failed_session_path.as_path())
            .expect("parse failed Claude result fixture")
            .expect("failed Claude result detail");
        assert_eq!(failed.summary.runtime_status.as_deref(), Some("failed"));
    }

    #[test]
    fn claude_cancelled_result_does_not_mark_session_failed() {
        let fixture = TestDirectory::new("cancelled-result-status");
        let session_id = "25252525-2525-4525-8525-252525252525";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-cancelled-result-status")
            .join(format!("{session_id}.jsonl"));
        write_jsonl(
            session_path.as_path(),
            &[json!({
                "sessionId": session_id,
                "type": "result",
                "subtype": "success",
                "is_error": false,
                "errors": [],
                "terminal_reason": "aborted_tools",
                "permission_denials": [],
                "uuid": "cancelled-only-result",
                "timestamp": "2099-07-21T02:20:00Z"
            })],
        );

        let detail = parse_claude_code_session_detail(session_path.as_path())
            .expect("parse cancelled result fixture")
            .expect("cancelled result detail");
        assert_eq!(detail.summary.runtime_status.as_deref(), Some("terminated"));
        assert_eq!(detail.summary.status, "completed");
        assert_eq!(
            detail.messages[0]
                .metadata
                .as_ref()
                .and_then(|metadata| metadata.get("noticeKind"))
                .map(String::as_str),
            Some("cancelled")
        );
    }

    #[test]
    fn claude_session_parser_resumes_after_an_oversized_jsonl_record() {
        let fixture = TestDirectory::new("oversized-jsonl-record");
        let session_id = "30303030-3030-4030-8030-303030303030";
        let session_path = fixture
            .path()
            .join("projects")
            .join("-workspace-oversized-jsonl-record")
            .join(format!("{session_id}.jsonl"));
        let max_record_bytes = 512;
        let valid_record = json!({
            "parentUuid": null,
            "isSidechain": false,
            "cwd": "E:/workspace/birdcoder",
            "sessionId": session_id,
            "type": "user",
            "message": {
                "role": "user",
                "content": "Hydrate the valid record after the oversized line"
            },
            "uuid": "valid-record-after-oversized-line",
            "timestamp": "2099-07-21T03:00:00Z"
        })
        .to_string();
        assert!(valid_record.len() <= max_record_bytes);
        let mut contents = vec![b'x'; max_record_bytes + 1];
        contents.push(b'\n');
        contents.extend_from_slice(valid_record.as_bytes());
        contents.push(b'\n');
        if let Some(parent) = session_path.parent() {
            fs::create_dir_all(parent).expect("create Claude oversized-record fixture directory");
        }
        fs::write(session_path.as_path(), contents).expect("write Claude oversized-record fixture");

        let detail = parse_claude_code_session_detail_with_record_limit(
            session_path.as_path(),
            max_record_bytes,
        )
        .expect("parse Claude fixture after oversized record")
        .expect("Claude detail after oversized record");

        assert_eq!(detail.messages.len(), 1);
        assert_eq!(detail.messages[0].role, "user");
        assert_eq!(
            detail.messages[0].content,
            "Hydrate the valid record after the oversized line"
        );
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
