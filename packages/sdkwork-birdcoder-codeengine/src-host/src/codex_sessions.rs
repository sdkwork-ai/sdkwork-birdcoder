use std::{
    collections::{BTreeMap, BTreeSet, HashMap},
    fs::{self, File},
    io::{BufRead, BufReader, Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    build_native_session_id, find_codeengine_descriptor, native_session_prefix_for_engine,
    CodeEngineSessionCommandRecord, CodeEngineSessionDetailRecord, CodeEngineSessionMessageRecord,
    CodeEngineSessionSummaryRecord,
};

const CODEX_SESSIONS_DIRECTORY_NAME: &str = "sessions";
const CODEX_SESSION_INDEX_FILE_NAME: &str = "session_index.jsonl";
const CODEX_SESSION_CATALOG_CACHE_TTL_MILLIS: u128 = 10_000;
const CODEX_SUMMARY_HEAD_LINE_LIMIT: usize = 64;
const CODEX_SUMMARY_TAIL_BYTE_LIMIT: u64 = 32 * 1024;
const CODEX_TOOL_CONTENT_CHAR_LIMIT: usize = 1_200;
const CODEX_TOOL_OUTPUT_CHAR_LIMIT: usize = 16_000;
const CODEX_ENGINE_ID: &str = "codex";

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexSessionIndexEntry {
    pub thread_name: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct CodexSessionFileStamp {
    file_size_bytes: u64,
    modified_at_millis: u128,
}

#[derive(Clone)]
struct CodexSessionFileEntry {
    path: PathBuf,
    raw_session_id: Option<String>,
    stamp: CodexSessionFileStamp,
}

#[derive(Clone, Default)]
struct CodexSessionCatalogSnapshot {
    generation: u64,
    session_index: BTreeMap<String, CodexSessionIndexEntry>,
    files: Vec<CodexSessionFileEntry>,
    session_id_to_path: BTreeMap<String, PathBuf>,
}

#[derive(Clone)]
struct CachedCodexSessionSummary {
    stamp: CodexSessionFileStamp,
    summary: CodeEngineSessionSummaryRecord,
}

#[derive(Clone)]
struct CachedCodexSessionDetail {
    stamp: CodexSessionFileStamp,
    detail: CodeEngineSessionDetailRecord,
}

#[derive(Default)]
struct CodexSessionCatalogCache {
    codex_home: Option<PathBuf>,
    refreshed_at_millis: u128,
    generation: u64,
    snapshot: CodexSessionCatalogSnapshot,
    summary_cache: BTreeMap<String, CachedCodexSessionSummary>,
    detail_cache: BTreeMap<String, CachedCodexSessionDetail>,
}

#[derive(Clone)]
struct SessionLineContext {
    created_at: Option<String>,
    consumed_tool_call_ids: BTreeSet<String>,
    fallback_title: Option<String>,
    has_error: bool,
    has_task_complete: bool,
    has_task_started: bool,
    has_turn_aborted: bool,
    latest_timestamp: Option<String>,
    latest_transcript_timestamp: Option<String>,
    latest_user_timestamp: Option<String>,
    model_id: Option<String>,
    native_cwd: Option<String>,
    native_session_id: Option<String>,
    pending_tool_calls: BTreeMap<String, PendingCodexToolCall>,
    title: Option<String>,
    title_source: SessionTitleSource,
    transcript_entries: Vec<TranscriptEntry>,
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
enum SessionTitleSource {
    None,
    ResponseUserMessage,
    EventUserMessage,
}

impl Default for SessionLineContext {
    fn default() -> Self {
        Self {
            created_at: None,
            consumed_tool_call_ids: BTreeSet::new(),
            fallback_title: None,
            has_error: false,
            has_task_complete: false,
            has_task_started: false,
            has_turn_aborted: false,
            latest_timestamp: None,
            latest_transcript_timestamp: None,
            latest_user_timestamp: None,
            model_id: None,
            native_cwd: None,
            native_session_id: None,
            pending_tool_calls: BTreeMap::new(),
            title: None,
            title_source: SessionTitleSource::None,
            transcript_entries: Vec::new(),
        }
    }
}

#[derive(Clone, Default)]
struct PendingCodexToolCall {
    created_at: Option<String>,
    command: Option<String>,
    tool_name: Option<String>,
    turn_id: Option<String>,
}

#[derive(Clone)]
struct TranscriptEntry {
    created_at: String,
    role: String,
    content: String,
    turn_id: Option<String>,
    commands: Option<Vec<CodeEngineSessionCommandRecord>>,
}

#[derive(Eq, Hash, PartialEq)]
struct TranscriptEntryDedupeKey {
    role: String,
    content: String,
    turn_id: Option<String>,
    commands: Option<Vec<CodeEngineSessionCommandRecord>>,
}

static CODEX_SESSION_CATALOG_CACHE: OnceLock<Mutex<CodexSessionCatalogCache>> = OnceLock::new();

pub fn list_codex_session_summaries() -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
    let snapshot = get_codex_session_catalog_snapshot()?;
    let mut summaries = Vec::new();

    for file_entry in &snapshot.files {
        if let Some(summary) = read_cached_codex_session_summary(&snapshot, file_entry)? {
            summaries.push(summary);
        }
    }

    summaries.sort_by(|left, right| {
        right
            .sort_timestamp
            .cmp(&left.sort_timestamp)
            .then_with(|| left.id.cmp(&right.id))
    });
    Ok(summaries)
}

pub fn get_codex_session_detail(
    session_id: &str,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    let snapshot = get_codex_session_catalog_snapshot()?;
    let lookup_id = extract_native_lookup_id_for_codex(session_id);
    let mut candidate_files = Vec::new();

    if let Some(file_entry) = find_codex_session_file_entry(&snapshot, &lookup_id) {
        candidate_files.push(file_entry);
    } else if should_fallback_scan_codex_session_lookup(&snapshot, &lookup_id) {
        candidate_files.extend(snapshot.files.clone());
    } else {
        return Ok(None);
    }

    for file_entry in candidate_files {
        let Some(detail) = read_cached_codex_session_detail(&snapshot, &file_entry)? else {
            continue;
        };
        let detail_lookup_id = extract_native_lookup_id_for_codex(detail.summary.id.as_str());
        if detail_lookup_id == lookup_id {
            return Ok(Some(detail));
        }
    }

    Ok(None)
}

pub fn get_codex_session_summary(
    session_id: &str,
) -> Result<Option<CodeEngineSessionSummaryRecord>, String> {
    let snapshot = get_codex_session_catalog_snapshot()?;
    let lookup_id = extract_native_lookup_id_for_codex(session_id);
    let mut candidate_files = Vec::new();

    if let Some(file_entry) = find_codex_session_file_entry(&snapshot, &lookup_id) {
        candidate_files.push(file_entry);
    } else if should_fallback_scan_codex_session_lookup(&snapshot, &lookup_id) {
        candidate_files.extend(snapshot.files.clone());
    } else {
        return Ok(None);
    }

    for file_entry in candidate_files {
        let Some(summary) = read_cached_codex_session_summary(&snapshot, &file_entry)? else {
            continue;
        };
        let summary_lookup_id = extract_native_lookup_id_for_codex(summary.id.as_str());
        if summary_lookup_id == lookup_id {
            return Ok(Some(summary));
        }
    }

    Ok(None)
}

pub fn parse_codex_session_summary(
    file_path: &Path,
    session_index: &BTreeMap<String, CodexSessionIndexEntry>,
) -> Result<Option<CodeEngineSessionSummaryRecord>, String> {
    parse_codex_session_summary_fast(file_path, session_index)
}

pub fn parse_codex_session_detail(
    file_path: &Path,
    session_index: &BTreeMap<String, CodexSessionIndexEntry>,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    parse_codex_session(file_path, session_index, true)
}

pub fn normalize_codex_prompt_title(value: &str) -> Option<String> {
    let normalized_content = normalize_codex_prompt_content(value)?;
    let trimmed = normalized_content.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(truncate_title(trimmed))
}

fn codex_session_catalog_cache() -> &'static Mutex<CodexSessionCatalogCache> {
    CODEX_SESSION_CATALOG_CACHE.get_or_init(|| Mutex::new(CodexSessionCatalogCache::default()))
}

fn current_system_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

fn file_cache_key(file_path: &Path) -> String {
    file_path.to_string_lossy().into_owned()
}

fn read_codex_session_file_stamp(file_path: &Path) -> Option<CodexSessionFileStamp> {
    let metadata = fs::metadata(file_path).ok()?;
    let modified_at_millis = metadata
        .modified()
        .ok()
        .and_then(|timestamp| timestamp.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    Some(CodexSessionFileStamp {
        file_size_bytes: metadata.len(),
        modified_at_millis,
    })
}

fn resolve_live_codex_session_file_stamp(file_entry: &CodexSessionFileEntry) -> CodexSessionFileStamp {
    read_codex_session_file_stamp(&file_entry.path).unwrap_or_else(|| file_entry.stamp.clone())
}

fn should_refresh_codex_session_catalog(
    cache: &CodexSessionCatalogCache,
    codex_home: &Option<PathBuf>,
) -> bool {
    if cache.codex_home != *codex_home {
        return true;
    }

    current_system_millis().saturating_sub(cache.refreshed_at_millis)
        > CODEX_SESSION_CATALOG_CACHE_TTL_MILLIS
}

fn build_codex_session_catalog_snapshot() -> Result<CodexSessionCatalogSnapshot, String> {
    let session_index = read_codex_session_index()?;
    let mut files = Vec::new();
    let mut session_id_to_file: BTreeMap<String, (CodexSessionFileStamp, PathBuf)> =
        BTreeMap::new();

    for file_path in list_codex_session_files()? {
        let Some(stamp) = read_codex_session_file_stamp(&file_path) else {
            continue;
        };
        let raw_session_id = extract_session_id_from_file_path(&file_path);
        if let Some(session_id) = raw_session_id.as_ref() {
            let should_replace = session_id_to_file
                .get(session_id)
                .map(|(current_stamp, current_path)| {
                    stamp.modified_at_millis > current_stamp.modified_at_millis
                        || (stamp.modified_at_millis == current_stamp.modified_at_millis
                            && file_path < *current_path)
                })
                .unwrap_or(true);
            if should_replace {
                session_id_to_file
                    .insert(session_id.clone(), (stamp.clone(), file_path.clone()));
            }
        }
        files.push(CodexSessionFileEntry {
            path: file_path,
            raw_session_id,
            stamp,
        });
    }

    Ok(CodexSessionCatalogSnapshot {
        generation: 0,
        session_index,
        files,
        session_id_to_path: session_id_to_file
            .into_iter()
            .map(|(session_id, (_, path))| (session_id, path))
            .collect(),
    })
}

fn get_codex_session_catalog_snapshot() -> Result<CodexSessionCatalogSnapshot, String> {
    let codex_home = resolve_codex_home_directory();
    {
        let cache = codex_session_catalog_cache()
            .lock()
            .map_err(|_| "lock Codex session catalog cache failed.".to_owned())?;
        if !should_refresh_codex_session_catalog(&cache, &codex_home) {
            return Ok(cache.snapshot.clone());
        }
    }

    let mut snapshot = build_codex_session_catalog_snapshot()?;
    let mut cache = codex_session_catalog_cache()
        .lock()
        .map_err(|_| "lock Codex session catalog cache failed.".to_owned())?;
    if !should_refresh_codex_session_catalog(&cache, &codex_home) {
        return Ok(cache.snapshot.clone());
    }

    let should_reset_entry_caches = cache.codex_home != codex_home;
    cache.codex_home = codex_home;
    cache.refreshed_at_millis = current_system_millis();
    cache.generation = cache.generation.saturating_add(1);
    snapshot.generation = cache.generation;
    cache.snapshot = snapshot.clone();
    if should_reset_entry_caches {
        cache.summary_cache.clear();
        cache.detail_cache.clear();
    }
    Ok(snapshot)
}

fn find_codex_session_file_entry(
    snapshot: &CodexSessionCatalogSnapshot,
    lookup_id: &str,
) -> Option<CodexSessionFileEntry> {
    if let Some(file_entry) = snapshot
        .files
        .iter()
        .find(|entry| entry.raw_session_id.as_deref() == Some(lookup_id))
        .cloned()
    {
        return Some(file_entry);
    }

    let file_path = snapshot.session_id_to_path.get(lookup_id)?;
    snapshot
        .files
        .iter()
        .find(|entry| entry.path == *file_path)
        .cloned()
}

fn should_fallback_scan_codex_session_lookup(
    snapshot: &CodexSessionCatalogSnapshot,
    lookup_id: &str,
) -> bool {
    snapshot.session_index.contains_key(lookup_id)
}

fn read_cached_codex_session_summary(
    snapshot: &CodexSessionCatalogSnapshot,
    file_entry: &CodexSessionFileEntry,
) -> Result<Option<CodeEngineSessionSummaryRecord>, String> {
    let cache_key = file_cache_key(&file_entry.path);
    let effective_stamp = resolve_live_codex_session_file_stamp(file_entry);
    {
        let cache = codex_session_catalog_cache()
            .lock()
            .map_err(|_| "lock Codex session catalog cache failed.".to_owned())?;
        if cache.snapshot.generation == snapshot.generation {
            if let Some(cached) = cache.summary_cache.get(&cache_key) {
                if cached.stamp == effective_stamp {
                    return Ok(Some(cached.summary.clone()));
                }
            }
        }
    }

    let summary = parse_codex_session_summary(&file_entry.path, &snapshot.session_index)?;
    if let Some(summary) = summary.as_ref() {
        let mut cache = codex_session_catalog_cache()
            .lock()
            .map_err(|_| "lock Codex session catalog cache failed.".to_owned())?;
        if cache.snapshot.generation == snapshot.generation {
            cache.summary_cache.insert(
                cache_key,
                CachedCodexSessionSummary {
                    stamp: effective_stamp,
                    summary: summary.clone(),
                },
            );
        }
    }

    Ok(summary)
}

fn read_cached_codex_session_detail(
    snapshot: &CodexSessionCatalogSnapshot,
    file_entry: &CodexSessionFileEntry,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    let cache_key = file_cache_key(&file_entry.path);
    let effective_stamp = resolve_live_codex_session_file_stamp(file_entry);
    {
        let cache = codex_session_catalog_cache()
            .lock()
            .map_err(|_| "lock Codex session catalog cache failed.".to_owned())?;
        if cache.snapshot.generation == snapshot.generation {
            if let Some(cached) = cache.detail_cache.get(&cache_key) {
                if cached.stamp == effective_stamp {
                    return Ok(Some(cached.detail.clone()));
                }
            }
        }
    }

    let detail = parse_codex_session_detail(&file_entry.path, &snapshot.session_index)?;
    if let Some(detail) = detail.as_ref() {
        let mut cache = codex_session_catalog_cache()
            .lock()
            .map_err(|_| "lock Codex session catalog cache failed.".to_owned())?;
        if cache.snapshot.generation == snapshot.generation {
            cache.detail_cache.insert(
                cache_key,
                CachedCodexSessionDetail {
                    stamp: effective_stamp,
                    detail: detail.clone(),
                },
            );
        }
    }

    Ok(detail)
}

fn resolve_codex_home_directory() -> Option<PathBuf> {
    if let Some(explicit) = std::env::var_os("CODEX_HOME").map(PathBuf::from) {
        return Some(explicit);
    }

    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)?;
    Some(home.join(".codex"))
}

fn read_codex_session_index() -> Result<BTreeMap<String, CodexSessionIndexEntry>, String> {
    let mut entries = BTreeMap::new();
    let Some(codex_home) = resolve_codex_home_directory() else {
        return Ok(entries);
    };

    let session_index_path = codex_home.join(CODEX_SESSION_INDEX_FILE_NAME);
    if !session_index_path.exists() {
        return Ok(entries);
    }

    let file = File::open(&session_index_path).map_err(|error| {
        format!(
            "open Codex session index {} failed: {error}",
            session_index_path.display()
        )
    })?;
    let reader = BufReader::new(file);

    for line in reader.lines() {
        let line = line.map_err(|error| {
            format!(
                "read Codex session index {} failed: {error}",
                session_index_path.display()
            )
        })?;
        if line.trim().is_empty() {
            continue;
        }

        let parsed = serde_json::from_str::<Value>(&line).map_err(|error| {
            format!(
                "parse Codex session index {} failed: {error}",
                session_index_path.display()
            )
        })?;
        let Some(id) = normalize_value_string(parsed.get("id")) else {
            continue;
        };
        entries.insert(
            id,
            CodexSessionIndexEntry {
                thread_name: normalize_value_string(parsed.get("thread_name")),
                updated_at: normalize_timestamp(parsed.get("updated_at")),
            },
        );
    }

    Ok(entries)
}

fn list_codex_session_files() -> Result<Vec<PathBuf>, String> {
    let Some(codex_home) = resolve_codex_home_directory() else {
        return Ok(Vec::new());
    };
    let sessions_directory = codex_home.join(CODEX_SESSIONS_DIRECTORY_NAME);
    if !sessions_directory.exists() {
        return Ok(Vec::new());
    }

    let mut file_paths = Vec::new();
    collect_jsonl_files(&sessions_directory, &mut file_paths)?;
    Ok(file_paths)
}

fn collect_jsonl_files(directory: &Path, file_paths: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) => {
            return Err(format!(
                "read Codex session directory {} failed: {error}",
                directory.display()
            ))
        }
    };

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl_files(&path, file_paths)?;
            continue;
        }
        if path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("jsonl"))
        {
            file_paths.push(path);
        }
    }

    Ok(())
}

fn parse_codex_session(
    file_path: &Path,
    session_index: &BTreeMap<String, CodexSessionIndexEntry>,
    include_messages: bool,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    let file = match File::open(file_path) {
        Ok(file) => file,
        Err(_) => return Ok(None),
    };
    let reader = BufReader::new(file);
    let mut context = SessionLineContext::default();

    for line in reader.lines() {
        let line = match line {
            Ok(line) => line,
            Err(_) => continue,
        };
        if line.trim().is_empty() {
            continue;
        }
        let envelope = match serde_json::from_str::<Value>(&line) {
            Ok(envelope) => envelope,
            Err(_) => continue,
        };
        apply_codex_session_line(&mut context, &envelope, include_messages);
    }

    let summary = build_codex_summary(file_path, session_index, &context)?;
    let messages = if include_messages {
        dedupe_transcript_entries(&context.transcript_entries)
            .into_iter()
            .enumerate()
            .map(|(index, entry)| CodeEngineSessionMessageRecord {
                id: format!("{}:native-message:{}", summary.id, index + 1),
                turn_id: entry.turn_id,
                role: entry.role,
                content: entry.content,
                commands: entry.commands,
                metadata: None,
                created_at: entry.created_at,
            })
            .collect()
    } else {
        Vec::new()
    };

    Ok(Some(CodeEngineSessionDetailRecord { summary, messages }))
}

fn parse_codex_session_summary_fast(
    file_path: &Path,
    session_index: &BTreeMap<String, CodexSessionIndexEntry>,
) -> Result<Option<CodeEngineSessionSummaryRecord>, String> {
    let file = match File::open(file_path) {
        Ok(file) => file,
        Err(_) => return Ok(None),
    };
    let reader = BufReader::new(file);
    let mut context = SessionLineContext::default();

    for (line_index, line) in reader.lines().enumerate() {
        let line = match line {
            Ok(line) => line,
            Err(_) => continue,
        };
        if line.trim().is_empty() {
            continue;
        }
        apply_codex_session_json_line(&mut context, line.as_str(), false);
        if line_index + 1 >= CODEX_SUMMARY_HEAD_LINE_LIMIT
            && can_finish_codex_summary_scan(&context)
        {
            break;
        }
    }

    apply_codex_session_tail_snapshot(file_path, &mut context)?;
    Ok(Some(build_codex_summary(
        file_path,
        session_index,
        &context,
    )?))
}

fn can_finish_codex_summary_scan(context: &SessionLineContext) -> bool {
    context.native_cwd.is_some() && (context.title.is_some() || context.fallback_title.is_some())
}

fn apply_codex_session_tail_snapshot(
    file_path: &Path,
    context: &mut SessionLineContext,
) -> Result<(), String> {
    let mut file = match File::open(file_path) {
        Ok(file) => file,
        Err(_) => return Ok(()),
    };
    let file_length = file
        .metadata()
        .map_err(|error| {
            format!(
                "read Codex session metadata {} failed: {error}",
                file_path.display()
            )
        })?
        .len();
    if file_length == 0 {
        return Ok(());
    }

    let start_offset = file_length.saturating_sub(CODEX_SUMMARY_TAIL_BYTE_LIMIT);
    file.seek(SeekFrom::Start(start_offset)).map_err(|error| {
        format!(
            "seek Codex session tail {} failed: {error}",
            file_path.display()
        )
    })?;

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer).map_err(|error| {
        format!(
            "read Codex session tail {} failed: {error}",
            file_path.display()
        )
    })?;

    let tail_snapshot = String::from_utf8_lossy(&buffer);
    let mut lines = tail_snapshot.lines();
    if start_offset > 0 {
        let _ = lines.next();
    }

    for line in lines {
        if line.trim().is_empty() {
            continue;
        }
        apply_codex_session_json_line(context, line, false);
    }

    Ok(())
}

fn apply_codex_session_json_line(
    context: &mut SessionLineContext,
    line: &str,
    include_messages: bool,
) {
    let envelope = match serde_json::from_str::<Value>(line) {
        Ok(envelope) => envelope,
        Err(_) => return,
    };
    apply_codex_session_line(context, &envelope, include_messages);
}

fn apply_codex_session_line(
    context: &mut SessionLineContext,
    envelope: &Value,
    include_messages: bool,
) {
    let envelope_type = normalize_value_string(envelope.get("type"));
    let timestamp = normalize_timestamp(envelope.get("timestamp"))
        .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_owned());
    context.latest_timestamp =
        resolve_more_recent_timestamp(context.latest_timestamp.take(), Some(timestamp.clone()));

    match envelope_type.as_deref() {
        Some("session_meta") | Some("turn_context") => apply_codex_context_payload(
            context,
            envelope.get("payload"),
            timestamp.as_str(),
        ),
        Some("response_item") => {
            let payload = envelope.get("payload");
            let payload_type =
                normalize_value_string(payload.and_then(|payload| payload.get("type")));
            match payload_type.as_deref() {
                Some("message") => {
                    let role =
                        normalize_value_string(payload.and_then(|payload| payload.get("role")));
                    let content =
                        extract_message_text(payload.and_then(|payload| payload.get("content")));
                    if let (Some(role), Some(content)) = (role, content) {
                        if role != "user" && role != "assistant" {
                            return;
                        }
                        let transcript_content = if role == "user" {
                            normalize_codex_prompt_content(&content)
                        } else {
                            Some(content.clone())
                        };
                        if include_messages {
                            let Some(transcript_content) = transcript_content.clone() else {
                                return;
                            };
                            push_transcript_entry(
                                context,
                                TranscriptEntry {
                                    created_at: timestamp.clone(),
                                    role: role.clone(),
                                    content: transcript_content,
                                    turn_id: normalize_value_string(
                                        payload.and_then(|payload| payload.get("turnId")),
                                    )
                                    .or_else(|| {
                                        normalize_value_string(
                                            payload.and_then(|payload| payload.get("turn_id")),
                                        )
                                    }),
                                    commands: None,
                                },
                            );
                        }
                        if role == "user" {
                            set_context_title(
                                context,
                                transcript_content
                                    .clone()
                                    .and_then(|value| normalize_codex_prompt_title(&value)),
                                SessionTitleSource::ResponseUserMessage,
                            );
                            context.latest_user_timestamp = resolve_more_recent_timestamp(
                                context.latest_user_timestamp.take(),
                                Some(timestamp.clone()),
                            );
                        }
                    }
                }
                Some("reasoning") => {
                    if !include_messages {
                        return;
                    }
                    if let Some(content) = extract_reasoning_text(payload) {
                        push_transcript_entry(
                            context,
                            TranscriptEntry {
                                created_at: timestamp,
                                role: "planner".to_owned(),
                                content,
                                turn_id: None,
                                commands: None,
                            },
                        );
                    }
                }
                Some("function_call") | Some("custom_tool_call") => {
                    register_pending_codex_tool_call(context, payload, &timestamp);
                }
                Some("function_call_output") | Some("custom_tool_call_output") => {
                    if !include_messages {
                        return;
                    }

                    if let Some(entry) =
                        build_codex_tool_output_transcript_entry(context, payload, &timestamp)
                    {
                        push_transcript_entry(context, entry);
                    }
                }
                Some("web_search_call") => {
                    if !include_messages {
                        return;
                    }

                    if let Some(entry) = build_codex_web_search_transcript_entry(
                        context,
                        payload,
                        &timestamp,
                        "web_search_call",
                    ) {
                        push_transcript_entry(context, entry);
                    }
                }
                _ => {}
            }
        }
        Some("event_msg") => {
            let payload = envelope.get("payload");
            let event_type =
                normalize_value_string(payload.and_then(|payload| payload.get("type")));
            match event_type.as_deref() {
                Some("task_started") => context.has_task_started = true,
                Some("task_complete") => context.has_task_complete = true,
                Some("turn_aborted") => context.has_turn_aborted = true,
                Some("error") => context.has_error = true,
                Some("user_message") => {
                    if let Some(content) =
                        extract_message_text(payload.and_then(|payload| payload.get("message")))
                            .or_else(|| {
                                extract_message_text(
                                    payload.and_then(|payload| payload.get("content")),
                                )
                            })
                            .or_else(|| {
                                normalize_value_string(
                                    payload.and_then(|payload| payload.get("text")),
                                )
                            })
                    {
                        let normalized_content =
                            normalize_codex_prompt_content(&content).unwrap_or(content.clone());
                        if include_messages {
                            push_transcript_entry(
                                context,
                                TranscriptEntry {
                                    created_at: timestamp.clone(),
                                    role: "user".to_owned(),
                                    content: normalized_content.clone(),
                                    turn_id: normalize_value_string(
                                        payload.and_then(|payload| payload.get("turnId")),
                                    )
                                    .or_else(|| {
                                        normalize_value_string(
                                            payload.and_then(|payload| payload.get("turn_id")),
                                        )
                                    }),
                                    commands: None,
                                },
                            );
                        }
                        set_context_title(
                            context,
                            normalize_codex_prompt_title(&normalized_content),
                            SessionTitleSource::EventUserMessage,
                        );
                        context.latest_user_timestamp = resolve_more_recent_timestamp(
                            context.latest_user_timestamp.take(),
                            Some(timestamp),
                        );
                    }
                }
                Some("agent_message") => {
                    if !include_messages {
                        return;
                    }
                    if let Some(content) =
                        extract_message_text(payload.and_then(|payload| payload.get("message")))
                            .or_else(|| {
                                extract_message_text(
                                    payload.and_then(|payload| payload.get("content")),
                                )
                            })
                            .or_else(|| {
                                normalize_value_string(
                                    payload.and_then(|payload| payload.get("text")),
                                )
                            })
                    {
                        push_transcript_entry(
                            context,
                            TranscriptEntry {
                                created_at: timestamp,
                                role: "assistant".to_owned(),
                                content,
                                turn_id: normalize_value_string(
                                    payload.and_then(|payload| payload.get("turnId")),
                                )
                                .or_else(|| {
                                    normalize_value_string(
                                        payload.and_then(|payload| payload.get("turn_id")),
                                    )
                                }),
                                commands: None,
                            },
                        );
                    }
                }
                Some("agent_reasoning") => {
                    if !include_messages {
                        return;
                    }
                    if let Some(content) =
                        normalize_value_string(payload.and_then(|payload| payload.get("text")))
                    {
                        push_transcript_entry(
                            context,
                            TranscriptEntry {
                                created_at: timestamp,
                                role: "planner".to_owned(),
                                content,
                                turn_id: None,
                                commands: None,
                            },
                        );
                    }
                }
                Some("entered_review_mode") => {
                    if !include_messages {
                        return;
                    }
                    push_transcript_entry(
                        context,
                        TranscriptEntry {
                            created_at: timestamp,
                            role: "reviewer".to_owned(),
                            content: normalize_value_string(
                                payload.and_then(|payload| payload.get("user_facing_hint")),
                            )
                            .or_else(|| {
                                normalize_value_string(
                                    payload.and_then(|payload| payload.get("userFacingHint")),
                                )
                            })
                            .unwrap_or_else(|| "Review requested.".to_owned()),
                            turn_id: normalize_value_string(
                                payload.and_then(|payload| payload.get("turnId")),
                            )
                            .or_else(|| {
                                normalize_value_string(
                                    payload.and_then(|payload| payload.get("turn_id")),
                                )
                            }),
                            commands: None,
                        },
                    );
                }
                Some("exited_review_mode") => {
                    if !include_messages {
                        return;
                    }
                    let content = payload
                        .and_then(|payload| payload.get("review_output"))
                        .and_then(|value| {
                            normalize_value_string(value.get("overall_explanation"))
                                .or_else(|| normalize_value_string(value.get("overallExplanation")))
                        })
                        .or_else(|| {
                            payload
                                .and_then(|payload| payload.get("reviewOutput"))
                                .and_then(|value| {
                                    normalize_value_string(value.get("overall_explanation"))
                                        .or_else(|| {
                                            normalize_value_string(value.get("overallExplanation"))
                                        })
                                })
                        })
                        .unwrap_or_else(|| "Review completed.".to_owned());
                    push_transcript_entry(
                        context,
                        TranscriptEntry {
                            created_at: timestamp,
                            role: "reviewer".to_owned(),
                            content,
                            turn_id: normalize_value_string(
                                payload.and_then(|payload| payload.get("turnId")),
                            )
                            .or_else(|| {
                                normalize_value_string(
                                    payload.and_then(|payload| payload.get("turn_id")),
                                )
                            }),
                            commands: None,
                        },
                    );
                }
                Some("exec_command_begin") | Some("exec_command_end") => {
                    if !include_messages {
                        return;
                    }
                    if let Some(command) =
                        normalize_command_text(payload.and_then(|payload| payload.get("command")))
                            .or_else(|| {
                                normalize_command_text(
                                    payload.and_then(|payload| payload.get("argv")),
                                )
                            })
                    {
                        let is_success = payload
                            .and_then(|payload| payload.get("exit_code"))
                            .and_then(Value::as_i64)
                            .unwrap_or(0)
                            == 0;
                        let output = normalize_value_string(
                            payload.and_then(|payload| payload.get("stdout")),
                        )
                        .or_else(|| {
                            normalize_value_string(
                                payload.and_then(|payload| payload.get("stderr")),
                            )
                        });
                        if event_type.as_deref() == Some("exec_command_end") && !is_success {
                            context.has_error = true;
                        }
                        let pending_tool_call = read_codex_call_id(payload)
                            .as_deref()
                            .and_then(|value| consume_pending_codex_tool_call(context, value));
                        push_transcript_entry(
                            context,
                            TranscriptEntry {
                                created_at: timestamp,
                                role: "tool".to_owned(),
                                content: format!(
                                    "{}: {}",
                                    if event_type.as_deref() == Some("exec_command_begin") {
                                        "Command running"
                                    } else if is_success {
                                        "Command completed"
                                    } else {
                                        "Command failed"
                                    },
                                    command
                                ),
                                turn_id: normalize_value_string(
                                    payload.and_then(|payload| payload.get("turnId")),
                                )
                                .or_else(|| {
                                    normalize_value_string(
                                        payload.and_then(|payload| payload.get("turn_id")),
                                    )
                                })
                                .or_else(|| {
                                    pending_tool_call
                                        .as_ref()
                                        .and_then(|tool_call| tool_call.turn_id.clone())
                                }),
                                commands: Some(vec![CodeEngineSessionCommandRecord {
                                    command: pending_tool_call
                                        .as_ref()
                                        .and_then(|tool_call| tool_call.command.clone())
                                        .unwrap_or(command),
                                    status: if event_type.as_deref() == Some("exec_command_begin") {
                                        "running".to_owned()
                                    } else if is_success {
                                        "success".to_owned()
                                    } else {
                                        "error".to_owned()
                                    },
                                    output: sanitize_codex_tool_output(
                                        output.as_deref().unwrap_or_default(),
                                    ),
                                }]),
                            },
                        );
                    }
                }
                Some("patch_apply_end") => {
                    if !include_messages {
                        return;
                    }
                    if let Some(entry) =
                        build_codex_patch_apply_transcript_entry(context, payload, &timestamp)
                    {
                        push_transcript_entry(context, entry);
                    }
                }
                Some("web_search_call") | Some("web_search_end") => {
                    if !include_messages {
                        return;
                    }
                    if let Some(entry) = build_codex_web_search_transcript_entry(
                        context,
                        payload,
                        &timestamp,
                        event_type.as_deref().unwrap_or_default(),
                    ) {
                        push_transcript_entry(context, entry);
                    }
                }
                Some("context_compacted") | Some("compacted") => {
                    if !include_messages {
                        return;
                    }
                    push_transcript_entry(
                        context,
                        TranscriptEntry {
                            created_at: timestamp,
                            role: "tool".to_owned(),
                            content:
                                "Context compacted to keep the session responsive.".to_owned(),
                            turn_id: read_codex_turn_id(payload),
                            commands: Some(vec![CodeEngineSessionCommandRecord {
                                command: "context_compact".to_owned(),
                                status: "success".to_owned(),
                                output: None,
                            }]),
                        },
                    );
                }
                _ => {}
            }
        }
        Some("compacted") => {
            if !include_messages {
                return;
            }
            push_transcript_entry(
                context,
                TranscriptEntry {
                    created_at: timestamp,
                    role: "tool".to_owned(),
                    content: "Context compacted to keep the session responsive.".to_owned(),
                    turn_id: read_codex_turn_id(envelope.get("payload")),
                    commands: Some(vec![CodeEngineSessionCommandRecord {
                        command: "context_compact".to_owned(),
                        status: "success".to_owned(),
                        output: None,
                    }]),
                },
            );
        }
        _ => {}
    }
}

fn apply_codex_context_payload(
    context: &mut SessionLineContext,
    payload: Option<&Value>,
    fallback_timestamp: &str,
) {
    context.native_session_id = normalize_value_string(payload.and_then(|value| value.get("id")))
        .or_else(|| normalize_value_string(payload.and_then(|value| value.get("session_id"))))
        .or_else(|| normalize_value_string(payload.and_then(|value| value.get("sessionId"))))
        .or_else(|| context.native_session_id.clone());
    context.created_at = context
        .created_at
        .clone()
        .or_else(|| normalize_timestamp(payload.and_then(|value| value.get("timestamp"))))
        .or_else(|| Some(fallback_timestamp.to_owned()));
    context.native_cwd = normalize_path_string(payload.and_then(|value| value.get("cwd")))
        .or_else(|| normalize_path_string(payload.and_then(|value| value.get("directory"))))
        .or_else(|| context.native_cwd.clone());
    context.fallback_title =
        normalize_working_directory_title(payload.and_then(|value| value.get("cwd")))
            .or_else(|| {
                normalize_working_directory_title(payload.and_then(|value| value.get("directory")))
            })
            .or_else(|| context.fallback_title.clone());
    context.model_id = normalize_value_string(payload.and_then(|value| value.get("model")))
        .or_else(|| normalize_value_string(payload.and_then(|value| value.get("model_name"))))
        .or_else(|| normalize_value_string(payload.and_then(|value| value.get("modelName"))))
        .or_else(|| normalize_value_string(payload.and_then(|value| value.get("model_provider"))))
        .or_else(|| {
            normalize_value_string(payload.and_then(|value| value.get("modelProvider")))
        })
        .or_else(|| context.model_id.clone());
}

fn build_codex_summary(
    file_path: &Path,
    session_index: &BTreeMap<String, CodexSessionIndexEntry>,
    context: &SessionLineContext,
) -> Result<CodeEngineSessionSummaryRecord, String> {
    let file_metadata = fs::metadata(file_path).map_err(|error| {
        format!(
            "read Codex session metadata {} failed: {error}",
            file_path.display()
        )
    })?;
    let file_modified_at = file_metadata
        .modified()
        .ok()
        .and_then(|timestamp| timestamp.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default();
    let file_modified_iso = timestamp_from_millis(file_modified_at);
    let raw_session_id = context
        .native_session_id
        .clone()
        .or_else(|| extract_session_id_from_file_path(file_path))
        .ok_or_else(|| {
            format!(
                "resolve native Codex session id from {} failed.",
                file_path.display()
            )
        })?;
    let summary_id = build_native_session_id(CODEX_ENGINE_ID, raw_session_id.as_str());
    let index_entry = session_index
        .get(&raw_session_id)
        .cloned()
        .unwrap_or_default();
    let created_at = context
        .created_at
        .clone()
        .or_else(|| context.latest_timestamp.clone())
        .unwrap_or_else(|| file_modified_iso.clone());
    let updated_at = resolve_more_recent_timestamp(
        context.latest_timestamp.clone(),
        index_entry.updated_at.clone(),
    )
    .unwrap_or_else(|| file_modified_iso.clone());
    let last_turn_at = context
        .latest_user_timestamp
        .clone()
        .or_else(|| context.latest_timestamp.clone())
        .or_else(|| Some(updated_at.clone()));
    let title = context
        .title
        .clone()
        .or_else(|| normalize_session_index_title(index_entry.thread_name.as_deref()))
        .or_else(|| context.fallback_title.clone())
        .or_else(|| derive_working_directory_title_from_path(context.native_cwd.as_deref()))
        .unwrap_or_else(|| {
            format!(
                "Session {}",
                shorten_native_session_id(raw_session_id.as_str())
            )
        });
    let status = if context.has_task_complete {
        "completed"
    } else if context.has_turn_aborted || context.has_error {
        "paused"
    } else if context.has_task_started {
        "active"
    } else {
        "completed"
    };
    let transcript_updated_at = context.latest_transcript_timestamp.clone();
    let model_id = context.model_id.clone().unwrap_or_else(|| {
        find_codeengine_descriptor(CODEX_ENGINE_ID)
            .map(|descriptor| descriptor.default_model_id)
            .unwrap_or_else(|| "gpt-5-codex".to_owned())
    });

    Ok(CodeEngineSessionSummaryRecord {
        created_at,
        id: summary_id,
        title,
        status: status.to_owned(),
        host_mode: "desktop".to_owned(),
        engine_id: CODEX_ENGINE_ID.to_owned(),
        model_id,
        updated_at: updated_at.clone(),
        last_turn_at,
        kind: "coding".to_owned(),
        native_cwd: context.native_cwd.clone(),
        sort_timestamp: parse_timestamp_millis(&updated_at).unwrap_or(file_modified_at),
        transcript_updated_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{env, fs, path::PathBuf};

    fn create_test_codex_session_file(file_name: &str) -> PathBuf {
        let file_path = env::temp_dir().join(file_name);
        fs::write(&file_path, b"{}\n").expect("write temp codex session file");
        file_path
    }

    #[test]
    fn build_codex_summary_falls_back_to_default_model_when_context_model_missing() {
        let file_path = create_test_codex_session_file("codex-summary-missing-model.jsonl");
        let context = SessionLineContext {
            native_session_id: Some("019d54b7-f3da-79b1-bb78-10770953da2d".to_owned()),
            latest_timestamp: Some("2026-04-20T10:00:00.000Z".to_owned()),
            ..SessionLineContext::default()
        };

        let summary = build_codex_summary(&file_path, &BTreeMap::new(), &context)
            .expect("build codex summary with default model");
        let expected_default_model = find_codeengine_descriptor(CODEX_ENGINE_ID)
            .expect("codex descriptor")
            .default_model_id;

        assert_eq!(summary.model_id, expected_default_model);

        let _ = fs::remove_file(file_path);
    }

    #[test]
    fn normalize_codex_prompt_content_extracts_user_request_from_contextual_prompt() {
        let normalized = normalize_codex_prompt_content(
            "IDE context:\n- Workspace ID: 100000000000000101\n- Project ID: project-demo\n- Session ID: coding-session-demo\n\nCurrent file path: /demo/package.json\nCurrent file language: json\n\nCurrent file content:\n```json\n{\"name\":\"demo\"}\n```\n\nUser request:\nExplain why the transcript is empty.",
        )
        .expect("normalize contextual codex prompt");

        assert_eq!(normalized, "Explain why the transcript is empty.");
    }
}

fn dedupe_transcript_entries(entries: &[TranscriptEntry]) -> Vec<TranscriptEntry> {
    let mut deduped = Vec::with_capacity(entries.len());
    let mut last_kept_timestamp_by_key = HashMap::<TranscriptEntryDedupeKey, i64>::new();

    for entry in entries {
        let created_at_millis = parse_timestamp_millis(entry.created_at.as_str());
        let dedupe_key = TranscriptEntryDedupeKey {
            role: entry.role.clone(),
            content: entry.content.clone(),
            turn_id: entry.turn_id.clone(),
            commands: entry.commands.clone(),
        };

        let is_duplicate = last_kept_timestamp_by_key
            .get(&dedupe_key)
            .copied()
            .zip(created_at_millis)
            .map(|(previous_millis, current_millis)| {
                (previous_millis - current_millis).abs() <= 5_000
            })
            .unwrap_or(false);

        if is_duplicate {
            continue;
        }

        if let Some(created_at_millis) = created_at_millis {
            last_kept_timestamp_by_key.insert(dedupe_key, created_at_millis);
        }

        deduped.push(entry.clone());
    }

    deduped
}

fn push_transcript_entry(context: &mut SessionLineContext, entry: TranscriptEntry) {
    context.latest_transcript_timestamp = resolve_more_recent_timestamp(
        context.latest_transcript_timestamp.take(),
        Some(entry.created_at.clone()),
    );
    context.transcript_entries.push(entry);
}

fn read_codex_call_id(payload: Option<&Value>) -> Option<String> {
    let payload = payload?;
    normalize_value_string(payload.get("call_id"))
        .or_else(|| normalize_value_string(payload.get("callId")))
}

fn read_codex_turn_id(payload: Option<&Value>) -> Option<String> {
    let payload = payload?;
    normalize_value_string(payload.get("turn_id"))
        .or_else(|| normalize_value_string(payload.get("turnId")))
}

fn register_pending_codex_tool_call(
    context: &mut SessionLineContext,
    payload: Option<&Value>,
    timestamp: &str,
) {
    let Some(payload) = payload else {
        return;
    };
    let Some(call_id) = read_codex_call_id(Some(payload)) else {
        return;
    };

    let tool_name = normalize_value_string(payload.get("name"));
    let command = tool_name
        .as_deref()
        .and_then(|name| extract_codex_tool_command(name, payload))
        .or_else(|| tool_name.clone());
    let turn_id = read_codex_turn_id(Some(payload));

    context
        .pending_tool_calls
        .entry(call_id)
        .and_modify(|pending| {
            pending.created_at = pending.created_at.clone().or_else(|| Some(timestamp.to_owned()));
            pending.command = pending.command.clone().or_else(|| command.clone());
            pending.tool_name = pending.tool_name.clone().or_else(|| tool_name.clone());
            pending.turn_id = pending.turn_id.clone().or_else(|| turn_id.clone());
        })
        .or_insert(PendingCodexToolCall {
            created_at: Some(timestamp.to_owned()),
            command,
            tool_name,
            turn_id,
        });
}

fn consume_pending_codex_tool_call(
    context: &mut SessionLineContext,
    call_id: &str,
) -> Option<PendingCodexToolCall> {
    let normalized_call_id = call_id.trim();
    if normalized_call_id.is_empty() {
        return None;
    }

    context
        .consumed_tool_call_ids
        .insert(normalized_call_id.to_owned());
    context.pending_tool_calls.remove(normalized_call_id)
}

fn extract_codex_tool_command(tool_name: &str, payload: &Value) -> Option<String> {
    if tool_name == "shell_command" {
        let arguments = normalize_value_string(payload.get("arguments"))?;
        let parsed_arguments = serde_json::from_str::<Value>(&arguments).ok()?;
        return normalize_command_text(parsed_arguments.get("command"))
            .or_else(|| normalize_command_text(parsed_arguments.get("argv")));
    }

    normalize_non_empty_string(Some(tool_name))
}

fn truncate_codex_text(value: &str, limit: usize) -> String {
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

fn sanitize_codex_tool_output(raw_output: &str) -> Option<String> {
    let normalized_output = raw_output.replace("\r\n", "\n").replace('\r', "\n");
    let mut filtered_lines = Vec::new();

    for line in normalized_output.lines() {
        let trimmed_line = line.trim();
        if trimmed_line.contains("WindowsPowerShell\\profile.ps1")
            || trimmed_line.contains("WindowsPowerShell\\Microsoft.PowerShell_profile.ps1")
            || trimmed_line.contains("about_Execution_Policies")
            || trimmed_line.contains("go.microsoft.com/fwlink/?LinkID=135170")
            || trimmed_line.contains("PSSecurityException")
            || trimmed_line.contains("CategoryInfo")
            || trimmed_line.contains("FullyQualifiedErrorId")
            || trimmed_line.starts_with("+ . '")
            || trimmed_line.starts_with("+   ~")
        {
            continue;
        }

        filtered_lines.push(line);
    }

    let collapsed_output = filtered_lines.join("\n").trim().to_owned();
    if collapsed_output.is_empty() {
        return None;
    }

    Some(truncate_codex_text(
        collapsed_output.as_str(),
        CODEX_TOOL_OUTPUT_CHAR_LIMIT,
    ))
}

fn summarize_codex_tool_output(raw_output: &str) -> Option<String> {
    let output = sanitize_codex_tool_output(raw_output)?;
    let preview = output
        .lines()
        .take(6)
        .collect::<Vec<_>>()
        .join("\n")
        .trim()
        .to_owned();
    if preview.is_empty() {
        return None;
    }

    Some(truncate_codex_text(
        preview.as_str(),
        CODEX_TOOL_CONTENT_CHAR_LIMIT,
    ))
}

fn read_codex_tool_output_status(payload: Option<&Value>) -> String {
    let Some(payload) = payload else {
        return "success".to_owned();
    };

    if let Some(success) = payload.get("success").and_then(Value::as_bool) {
        return if success {
            "success".to_owned()
        } else {
            "error".to_owned()
        };
    }

    if let Some(status) = normalize_value_string(payload.get("status")) {
        return match status.as_str() {
            "completed" | "success" => "success".to_owned(),
            "failed" | "error" => "error".to_owned(),
            other => other.to_owned(),
        };
    }

    if let Some(exit_code) = payload
        .get("metadata")
        .and_then(|metadata| metadata.get("exit_code"))
        .and_then(Value::as_i64)
    {
        return if exit_code == 0 {
            "success".to_owned()
        } else {
            "error".to_owned()
        };
    }

    "success".to_owned()
}

fn extract_codex_tool_output_text(payload: Option<&Value>) -> Option<String> {
    let payload = payload?;
    let raw_output = normalize_value_string(payload.get("output"))
        .or_else(|| extract_message_text(payload.get("output")))
        .or_else(|| extract_message_text(Some(payload)))?;

    if let Ok(parsed_output) = serde_json::from_str::<Value>(&raw_output) {
        return sanitize_codex_tool_output(
            normalize_value_string(parsed_output.get("output"))
                .or_else(|| extract_message_text(Some(&parsed_output)))
                .unwrap_or(raw_output)
                .as_str(),
        );
    }

    sanitize_codex_tool_output(raw_output.as_str())
}

fn build_codex_tool_output_transcript_entry(
    context: &mut SessionLineContext,
    payload: Option<&Value>,
    timestamp: &str,
) -> Option<TranscriptEntry> {
    let call_id = read_codex_call_id(payload);
    if call_id
        .as_ref()
        .is_some_and(|value| context.consumed_tool_call_ids.contains(value))
    {
        return None;
    }

    let pending_tool_call = call_id
        .as_deref()
        .and_then(|value| consume_pending_codex_tool_call(context, value));
    let tool_name = pending_tool_call
        .as_ref()
        .and_then(|tool_call| tool_call.tool_name.clone())
        .or_else(|| payload.and_then(|value| normalize_value_string(value.get("name"))));
    let command = pending_tool_call
        .as_ref()
        .and_then(|tool_call| tool_call.command.clone())
        .or_else(|| tool_name.clone());
    let output = extract_codex_tool_output_text(payload);
    let status = read_codex_tool_output_status(payload);

    if command.is_none() && output.is_none() {
        return None;
    }

    let content = if let Some(command) = command.as_deref() {
        if command == "apply_patch" {
            summarize_codex_tool_output(output.as_deref().unwrap_or_default())
                .unwrap_or_else(|| "Patch applied.".to_owned())
        } else if command == "shell_command" {
            summarize_codex_tool_output(output.as_deref().unwrap_or_default())
                .map(|summary| format!("Command completed.\n{summary}"))
                .unwrap_or_else(|| "Command completed.".to_owned())
        } else if let Some(summary) =
            summarize_codex_tool_output(output.as_deref().unwrap_or_default())
        {
            format!("{command}\n{summary}")
        } else {
            format!("Tool completed: {command}")
        }
    } else {
        summarize_codex_tool_output(output.as_deref().unwrap_or_default())?
    };

    Some(TranscriptEntry {
        created_at: pending_tool_call
            .as_ref()
            .and_then(|tool_call| tool_call.created_at.clone())
            .unwrap_or_else(|| timestamp.to_owned()),
        role: "tool".to_owned(),
        content,
        turn_id: pending_tool_call
            .as_ref()
            .and_then(|tool_call| tool_call.turn_id.clone())
            .or_else(|| read_codex_turn_id(payload)),
        commands: Some(vec![CodeEngineSessionCommandRecord {
            command: command.unwrap_or_else(|| "tool".to_owned()),
            status,
            output,
        }]),
    })
}

fn build_codex_patch_apply_transcript_entry(
    context: &mut SessionLineContext,
    payload: Option<&Value>,
    timestamp: &str,
) -> Option<TranscriptEntry> {
    let payload = payload?;
    let pending_tool_call = read_codex_call_id(Some(payload))
        .as_deref()
        .and_then(|value| consume_pending_codex_tool_call(context, value));
    let status = read_codex_tool_output_status(Some(payload));
    let output = sanitize_codex_tool_output(
        normalize_value_string(payload.get("stdout"))
            .or_else(|| normalize_value_string(payload.get("stderr")))
            .unwrap_or_default()
            .as_str(),
    );
    let content = summarize_codex_tool_output(output.as_deref().unwrap_or_default())
        .unwrap_or_else(|| {
            if status == "success" {
                "Patch applied.".to_owned()
            } else {
                "Patch apply failed.".to_owned()
            }
        });

    Some(TranscriptEntry {
        created_at: timestamp.to_owned(),
        role: "tool".to_owned(),
        content,
        turn_id: pending_tool_call
            .as_ref()
            .and_then(|tool_call| tool_call.turn_id.clone())
            .or_else(|| read_codex_turn_id(Some(payload))),
        commands: Some(vec![CodeEngineSessionCommandRecord {
            command: pending_tool_call
                .as_ref()
                .and_then(|tool_call| tool_call.command.clone())
                .unwrap_or_else(|| "apply_patch".to_owned()),
            status,
            output,
        }]),
    })
}

fn build_codex_web_search_transcript_entry(
    context: &mut SessionLineContext,
    payload: Option<&Value>,
    timestamp: &str,
    event_type: &str,
) -> Option<TranscriptEntry> {
    let payload = payload?;
    let query = normalize_value_string(payload.get("query"));
    let action_type = payload
        .get("action")
        .and_then(|action| normalize_value_string(action.get("type")));
    let command = query
        .as_ref()
        .map(|value| format!("web_search: {value}"))
        .unwrap_or_else(|| "web_search".to_owned());
    let output = action_type
        .as_ref()
        .map(|value| format!("Action: {value}"))
        .and_then(|value| sanitize_codex_tool_output(value.as_str()));
    let content = if event_type == "web_search_end" {
        query.as_ref()
            .map(|value| format!("Web search completed: {value}"))
            .unwrap_or_else(|| "Web search completed.".to_owned())
    } else {
        query.as_ref()
            .map(|value| format!("Web search started: {value}"))
            .unwrap_or_else(|| "Web search started.".to_owned())
    };

    if let Some(call_id) = read_codex_call_id(Some(payload)).as_deref() {
        context.consumed_tool_call_ids.insert(call_id.to_owned());
    }

    Some(TranscriptEntry {
        created_at: timestamp.to_owned(),
        role: "tool".to_owned(),
        content,
        turn_id: read_codex_turn_id(Some(payload)),
        commands: Some(vec![CodeEngineSessionCommandRecord {
            command,
            status: if event_type == "web_search_end" {
                "success".to_owned()
            } else {
                "running".to_owned()
            },
            output,
        }]),
    })
}

fn extract_session_id_from_file_path(file_path: &Path) -> Option<String> {
    let stem = file_path.file_stem()?.to_str()?;
    let trimmed_stem = stem.trim();
    if trimmed_stem.is_empty() {
        return None;
    }

    let parts = trimmed_stem.split('-').collect::<Vec<_>>();
    let candidate = if parts.len() >= 7
        && parts[1].len() == 4
        && parts[1].chars().all(|character| character.is_ascii_digit())
        && parts[2].len() == 2
        && parts[2].chars().all(|character| character.is_ascii_digit())
        && parts[3].len() == 5
        && parts[3].chars().enumerate().all(|(index, character)| {
            if index == 2 {
                character == 'T'
            } else {
                character.is_ascii_digit()
            }
        })
        && parts[4].len() == 2
        && parts[4].chars().all(|character| character.is_ascii_digit())
        && parts[5].len() == 2
        && parts[5].chars().all(|character| character.is_ascii_digit())
    {
        parts[6..].join("-")
    } else {
        trimmed_stem.to_owned()
    };

    let normalized_candidate = candidate.trim();
    if normalized_candidate.is_empty() {
        return None;
    }

    Some(normalized_candidate.to_owned())
}

fn extract_native_lookup_id_for_codex(session_id: &str) -> String {
    let prefix = native_session_prefix_for_engine(CODEX_ENGINE_ID).unwrap_or_default();
    session_id
        .trim()
        .strip_prefix(prefix)
        .map(str::to_owned)
        .unwrap_or_else(|| session_id.trim().to_owned())
}

fn normalize_non_empty_string(value: Option<&str>) -> Option<String> {
    value.and_then(|value| {
        let normalized = value.trim();
        if normalized.is_empty() {
            None
        } else {
            Some(normalized.to_owned())
        }
    })
}

fn normalize_value_string(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(value)) => normalize_non_empty_string(Some(value.as_str())),
        Some(Value::Number(value)) => Some(value.to_string()),
        Some(Value::Bool(value)) => Some(value.to_string()),
        _ => None,
    }
}

fn normalize_timestamp(value: Option<&Value>) -> Option<String> {
    let value = normalize_value_string(value)?;
    parse_timestamp_millis(&value)?;
    Some(value)
}

fn normalize_path_string(value: Option<&Value>) -> Option<String> {
    let value = normalize_value_string(value)?;
    Some(value.replace('\\', "/"))
}

fn normalize_command_text(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(value)) => normalize_non_empty_string(Some(value.as_str())),
        Some(Value::Array(values)) => {
            let parts = values
                .iter()
                .filter_map(|value| normalize_value_string(Some(value)))
                .collect::<Vec<_>>();
            if parts.is_empty() {
                None
            } else {
                Some(parts.join(" "))
            }
        }
        _ => None,
    }
}

fn extract_reasoning_text(payload: Option<&Value>) -> Option<String> {
    let payload = payload?;
    if let Some(summary_items) = payload.get("summary").and_then(Value::as_array) {
        let parts = summary_items
            .iter()
            .filter_map(|item| normalize_value_string(item.get("text")))
            .collect::<Vec<_>>();
        if !parts.is_empty() {
            return Some(parts.join("\n"));
        }
    }

    extract_message_text(payload.get("content"))
        .or_else(|| normalize_value_string(payload.get("text")))
}

fn extract_message_text(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(value)) => normalize_non_empty_string(Some(value.as_str())),
        Some(Value::Array(values)) => {
            let parts = values
                .iter()
                .filter_map(|item| extract_message_text(Some(item)))
                .collect::<Vec<_>>();
            if parts.is_empty() {
                None
            } else {
                Some(parts.join("\n"))
            }
        }
        Some(Value::Object(object)) => {
            let type_name = object
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_ascii_lowercase();
            if matches!(
                type_name.as_str(),
                "input_text" | "output_text" | "text" | "summary_text"
            ) {
                return normalize_value_string(object.get("text"));
            }
            normalize_value_string(object.get("text"))
                .or_else(|| extract_message_text(object.get("content")))
                .or_else(|| extract_message_text(object.get("message")))
        }
        _ => None,
    }
}

fn truncate_title(value: &str) -> String {
    const TITLE_LIMIT: usize = 120;
    let collapsed = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.chars().count() <= TITLE_LIMIT {
        return collapsed;
    }

    let mut truncated = collapsed
        .chars()
        .take(TITLE_LIMIT.saturating_sub(3))
        .collect::<String>();
    truncated = truncated.trim_end().to_owned();
    format!("{truncated}...")
}

fn strip_tag_block(value: &str, tag_name: &str) -> String {
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

fn strip_codex_control_tags(value: &str) -> String {
    let without_environment_context = strip_tag_block(value, "environment_context");
    strip_tag_block(without_environment_context.as_str(), "turn_aborted")
}

fn extract_codex_request_segment(value: &str) -> &str {
    if value.contains("IDE context:")
        || value.contains("Current file path:")
        || value.contains("Current file content:")
    {
        if let Some(start_index) = value.find("User request:") {
            return &value[start_index + "User request:".len()..];
        }
    }

    const REQUEST_MARKERS: [&str; 3] = [
        "## My request for Codex:",
        "# My request for Codex:",
        "My request for Codex:",
    ];

    for marker in REQUEST_MARKERS {
        if let Some(start_index) = value.find(marker) {
            return &value[start_index + marker.len()..];
        }
    }

    value
}

fn normalize_codex_prompt_content(value: &str) -> Option<String> {
    let extracted_request = extract_codex_request_segment(value);
    let stripped = strip_codex_control_tags(extracted_request);
    let normalized = stripped.split_whitespace().collect::<Vec<_>>().join(" ");
    let trimmed = normalized.trim();
    if trimmed.is_empty() {
        return None;
    }

    if value.contains("## My request for Codex:") || value.contains("# My request for Codex:") {
        return Some(trimmed.to_owned());
    }

    if trimmed.starts_with("# AGENTS.md instructions for ")
        || trimmed.starts_with("Another language model started to solve this problem")
    {
        return None;
    }

    Some(trimmed.to_owned())
}

fn normalize_session_index_title(value: Option<&str>) -> Option<String> {
    let normalized = normalize_non_empty_string(value)?;
    Some(truncate_title(normalized.as_str()))
}

fn normalize_working_directory_title(value: Option<&Value>) -> Option<String> {
    derive_working_directory_title_from_path(normalize_path_string(value).as_deref())
}

fn derive_working_directory_title_from_path(value: Option<&str>) -> Option<String> {
    let normalized_path = normalize_non_empty_string(value)?;
    let trimmed = normalized_path.trim_end_matches('/').trim();
    if trimmed.is_empty() {
        return None;
    }

    trimmed
        .rsplit(['/', '\\'])
        .find(|segment| !segment.trim().is_empty())
        .map(|segment| truncate_title(segment.trim()))
}

fn shorten_native_session_id(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return "session".to_owned();
    }

    trimmed.chars().take(8).collect()
}

fn set_context_title(
    context: &mut SessionLineContext,
    candidate: Option<String>,
    source: SessionTitleSource,
) {
    let Some(candidate) = candidate else {
        return;
    };
    if context.title.is_none() || context.title_source < source {
        context.title = Some(candidate);
        context.title_source = source;
    }
}

fn parse_timestamp_millis(value: &str) -> Option<i64> {
    let timestamp = value.trim();
    if timestamp.is_empty() {
        return None;
    }

    let parsed = chrono_like_to_millis(timestamp)?;
    Some(parsed)
}

fn chrono_like_to_millis(timestamp: &str) -> Option<i64> {
    let normalized = timestamp.trim();
    let parsed =
        time::OffsetDateTime::parse(normalized, &time::format_description::well_known::Rfc3339)
            .ok()?;
    Some((parsed.unix_timestamp_nanos() / 1_000_000) as i64)
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

fn resolve_more_recent_timestamp(left: Option<String>, right: Option<String>) -> Option<String> {
    match (left, right) {
        (Some(left), Some(right)) => {
            let left_millis = parse_timestamp_millis(&left).unwrap_or_default();
            let right_millis = parse_timestamp_millis(&right).unwrap_or_default();
            if left_millis >= right_millis {
                Some(left)
            } else {
                Some(right)
            }
        }
        (Some(left), None) => Some(left),
        (None, Some(right)) => Some(right),
        (None, None) => None,
    }
}
