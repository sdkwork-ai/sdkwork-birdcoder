use std::{
    env, fs,
    fs::File,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Deserializer, Serialize};

use crate::{
    bounded_json::{
        deserialize_bounded_vec, deserialize_optional_bounded_vec, from_bounded_json_reader,
    },
    build_native_session_id, extract_native_lookup_id_for_engine,
    map_codeengine_session_runtime_status, map_codeengine_session_status_from_runtime,
    map_codeengine_tool_command_status, resolve_codeengine_command_interaction_runtime_status,
    sanitize_codeengine_session_reasoning_records, sanitize_codeengine_session_resource_records,
    CodeEngineSessionCommandRecord, CodeEngineSessionDetailRecord, CodeEngineSessionMessageRecord,
    CodeEngineSessionReasoningRecord, CodeEngineSessionResourceRecord,
    CodeEngineSessionSummaryRecord,
};

pub const CODEENGINE_SDK_BRIDGE_HOME_ENV: &str = "BIRDCODER_CODEENGINE_SDK_BRIDGE_HOME";
pub const CODEENGINE_HOME_ENV: &str = "BIRDCODER_CODEENGINE_HOME";

const SDK_BRIDGE_SESSION_FILE_BYTE_LIMIT: usize = 128 * 1024 * 1024;
const SDK_BRIDGE_SESSION_MESSAGE_ITEM_LIMIT: usize = 16_384;
const SDK_BRIDGE_MESSAGE_COMMAND_ITEM_LIMIT: usize = 1_024;
const SDK_BRIDGE_MESSAGE_TOOL_CALL_ITEM_LIMIT: usize = 1_024;
const SDK_BRIDGE_MESSAGE_FILE_CHANGE_ITEM_LIMIT: usize = 4_096;
const SDK_BRIDGE_MESSAGE_REASONING_ITEM_LIMIT: usize = 128;
const SDK_BRIDGE_MESSAGE_RESOURCE_ITEM_LIMIT: usize = 128;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SdkBridgeStoredSession {
    id: String,
    engine_id: String,
    model_id: String,
    title: String,
    status: String,
    host_mode: String,
    kind: String,
    created_at: String,
    updated_at: String,
    last_turn_at: Option<String>,
    native_cwd: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    workspace_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    project_id: Option<String>,
    #[serde(deserialize_with = "deserialize_sdk_bridge_messages")]
    messages: Vec<SdkBridgeStoredMessage>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SdkBridgeStoredMessage {
    id: String,
    turn_id: String,
    role: String,
    content: String,
    #[serde(
        default,
        deserialize_with = "deserialize_sdk_bridge_commands",
        skip_serializing_if = "Option::is_none"
    )]
    commands: Option<Vec<CodeEngineSessionCommandRecord>>,
    #[serde(
        default,
        deserialize_with = "deserialize_sdk_bridge_tool_calls",
        rename = "tool_calls",
        skip_serializing_if = "Option::is_none"
    )]
    tool_calls: Option<Vec<serde_json::Value>>,
    #[serde(
        default,
        rename = "tool_call_id",
        skip_serializing_if = "Option::is_none"
    )]
    tool_call_id: Option<String>,
    #[serde(
        default,
        deserialize_with = "deserialize_sdk_bridge_file_changes",
        skip_serializing_if = "Option::is_none"
    )]
    file_changes: Option<Vec<serde_json::Value>>,
    #[serde(
        default,
        deserialize_with = "deserialize_sdk_bridge_reasoning",
        skip_serializing_if = "Option::is_none"
    )]
    reasoning: Option<Vec<CodeEngineSessionReasoningRecord>>,
    #[serde(
        default,
        deserialize_with = "deserialize_sdk_bridge_resources",
        skip_serializing_if = "Option::is_none"
    )]
    resources: Option<Vec<CodeEngineSessionResourceRecord>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    task_progress: Option<serde_json::Value>,
    created_at: String,
}

fn deserialize_sdk_bridge_messages<'de, D>(
    deserializer: D,
) -> Result<Vec<SdkBridgeStoredMessage>, D::Error>
where
    D: Deserializer<'de>,
{
    deserialize_bounded_vec(deserializer, SDK_BRIDGE_SESSION_MESSAGE_ITEM_LIMIT)
}

fn deserialize_sdk_bridge_commands<'de, D>(
    deserializer: D,
) -> Result<Option<Vec<CodeEngineSessionCommandRecord>>, D::Error>
where
    D: Deserializer<'de>,
{
    deserialize_optional_bounded_vec(deserializer, SDK_BRIDGE_MESSAGE_COMMAND_ITEM_LIMIT)
}

fn deserialize_sdk_bridge_tool_calls<'de, D>(
    deserializer: D,
) -> Result<Option<Vec<serde_json::Value>>, D::Error>
where
    D: Deserializer<'de>,
{
    deserialize_optional_bounded_vec(deserializer, SDK_BRIDGE_MESSAGE_TOOL_CALL_ITEM_LIMIT)
}

fn deserialize_sdk_bridge_file_changes<'de, D>(
    deserializer: D,
) -> Result<Option<Vec<serde_json::Value>>, D::Error>
where
    D: Deserializer<'de>,
{
    deserialize_optional_bounded_vec(deserializer, SDK_BRIDGE_MESSAGE_FILE_CHANGE_ITEM_LIMIT)
}

fn deserialize_sdk_bridge_reasoning<'de, D>(
    deserializer: D,
) -> Result<Option<Vec<CodeEngineSessionReasoningRecord>>, D::Error>
where
    D: Deserializer<'de>,
{
    deserialize_optional_bounded_vec(deserializer, SDK_BRIDGE_MESSAGE_REASONING_ITEM_LIMIT)
}

fn deserialize_sdk_bridge_resources<'de, D>(
    deserializer: D,
) -> Result<Option<Vec<CodeEngineSessionResourceRecord>>, D::Error>
where
    D: Deserializer<'de>,
{
    deserialize_optional_bounded_vec(deserializer, SDK_BRIDGE_MESSAGE_RESOURCE_ITEM_LIMIT)
}

pub fn list_sdk_bridge_session_summaries(
    engine_id: &str,
) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
    let engine_directory = sdk_bridge_session_engine_directory(engine_id);
    if !engine_directory.exists() {
        return Ok(Vec::new());
    }

    let mut summaries = Vec::new();
    for entry in fs::read_dir(&engine_directory).map_err(|error| {
        format!(
            "read SDK bridge session directory {} failed: {error}",
            engine_directory.display()
        )
    })? {
        let entry = entry.map_err(|error| {
            format!(
                "read SDK bridge session directory entry {} failed: {error}",
                engine_directory.display()
            )
        })?;
        let path = entry.path();
        if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
            continue;
        }
        let stored_session = read_sdk_bridge_stored_session(path.as_path())?;
        if stored_session.engine_id == engine_id {
            summaries.push(build_sdk_bridge_session_summary_record(&stored_session));
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

pub fn get_sdk_bridge_session_detail(
    session_id: &str,
    engine_id: &str,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    let lookup_id = extract_native_lookup_id_for_engine(session_id, engine_id)?;
    let session_path = sdk_bridge_session_file_path(engine_id, lookup_id.as_str());
    if !session_path.exists() {
        return Ok(None);
    }

    let stored_session = read_sdk_bridge_stored_session(session_path.as_path())?;
    if stored_session.engine_id != engine_id {
        return Ok(None);
    }

    let summary = build_sdk_bridge_session_summary_record(&stored_session);
    let messages = stored_session
        .messages
        .iter()
        .map(|message| CodeEngineSessionMessageRecord {
            id: message.id.clone(),
            turn_id: Some(message.turn_id.clone()),
            role: message.role.clone(),
            content: message.content.clone(),
            commands: message.commands.clone(),
            tool_calls: message.tool_calls.clone(),
            tool_call_id: message.tool_call_id.clone(),
            file_changes: message.file_changes.clone(),
            reasoning: message.reasoning.as_ref().and_then(|reasoning| {
                let reasoning = sanitize_codeengine_session_reasoning_records(reasoning);
                (!reasoning.is_empty()).then_some(reasoning)
            }),
            resources: message.resources.as_deref().and_then(|resources| {
                let resources = sanitize_codeengine_session_resource_records(resources);
                (!resources.is_empty()).then_some(resources)
            }),
            task_progress: message.task_progress.clone(),
            metadata: None,
            created_at: message.created_at.clone(),
        })
        .collect();
    Ok(Some(CodeEngineSessionDetailRecord { summary, messages }))
}

fn sdk_bridge_session_engine_directory(engine_id: &str) -> PathBuf {
    sdk_bridge_session_home_directory().join(sanitize_bridge_session_filename(engine_id))
}

fn sdk_bridge_session_file_path(engine_id: &str, lookup_id: &str) -> PathBuf {
    sdk_bridge_session_engine_directory(engine_id).join(format!(
        "{}.json",
        sanitize_bridge_session_filename(lookup_id)
    ))
}

fn sdk_bridge_session_home_directory() -> PathBuf {
    if let Some(configured) = env::var(CODEENGINE_SDK_BRIDGE_HOME_ENV)
        .ok()
        .and_then(|value| normalize_non_empty_string(Some(value.as_str())))
    {
        return PathBuf::from(configured);
    }

    if let Some(configured) = env::var(CODEENGINE_HOME_ENV)
        .ok()
        .and_then(|value| normalize_non_empty_string(Some(value.as_str())))
    {
        return PathBuf::from(configured).join("sdk-bridge-sessions");
    }

    default_user_home_directory()
        .unwrap_or_else(env::temp_dir)
        .join(".sdkwork-birdcoder")
        .join("codeengine-sdk-bridge")
}

fn default_user_home_directory() -> Option<PathBuf> {
    env::var_os("HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            env::var_os("USERPROFILE")
                .filter(|value| !value.is_empty())
                .map(PathBuf::from)
        })
}

fn read_sdk_bridge_stored_session(path: &Path) -> Result<SdkBridgeStoredSession, String> {
    read_sdk_bridge_stored_session_with_limit(path, SDK_BRIDGE_SESSION_FILE_BYTE_LIMIT)
}

fn read_sdk_bridge_stored_session_with_limit(
    path: &Path,
    max_bytes: usize,
) -> Result<SdkBridgeStoredSession, String> {
    let file = File::open(path).map_err(|error| {
        format!(
            "read SDK bridge session file {} failed: {error}",
            path.display()
        )
    })?;
    let metadata = file.metadata().map_err(|error| {
        format!(
            "read SDK bridge session metadata {} failed: {error}",
            path.display()
        )
    })?;
    let max_bytes_u64 = u64::try_from(max_bytes).unwrap_or(u64::MAX);
    if metadata.len() > max_bytes_u64 {
        return Err(format!(
            "read SDK bridge session file {} failed: JSON input exceeds the configured {max_bytes} byte limit",
            path.display()
        ));
    }

    from_bounded_json_reader::<_, SdkBridgeStoredSession>(file, max_bytes).map_err(|error| {
        format!(
            "parse SDK bridge session file {} failed: {error}",
            path.display()
        )
    })
}

fn build_sdk_bridge_session_summary_record(
    stored_session: &SdkBridgeStoredSession,
) -> CodeEngineSessionSummaryRecord {
    let runtime_status = resolve_sdk_bridge_session_runtime_status(stored_session);
    let status = map_codeengine_session_status_from_runtime(runtime_status).to_owned();

    CodeEngineSessionSummaryRecord {
        created_at: stored_session.created_at.clone(),
        id: build_native_session_id(
            stored_session.engine_id.as_str(),
            stored_session.id.as_str(),
        ),
        title: stored_session.title.clone(),
        status,
        runtime_status: Some(runtime_status.to_owned()),
        host_mode: stored_session.host_mode.clone(),
        engine_id: stored_session.engine_id.clone(),
        model_id: stored_session.model_id.clone(),
        updated_at: stored_session.updated_at.clone(),
        last_turn_at: stored_session.last_turn_at.clone(),
        kind: stored_session.kind.clone(),
        native_cwd: stored_session.native_cwd.clone(),
        sort_timestamp: parse_timestamp_millis(stored_session.updated_at.as_str())
            .unwrap_or_default(),
        transcript_updated_at: Some(stored_session.updated_at.clone()),
        workspace_id: stored_session.workspace_id.clone(),
        project_id: stored_session.project_id.clone(),
        native_attributes: Default::default(),
    }
}

fn resolve_sdk_bridge_session_runtime_status(
    stored_session: &SdkBridgeStoredSession,
) -> &'static str {
    for message in stored_session.messages.iter().rev() {
        if message.role != "assistant" {
            continue;
        }
        if let Some(runtime_status) =
            resolve_sdk_bridge_commands_runtime_status(message.commands.as_deref())
        {
            return runtime_status;
        }
    }

    map_codeengine_session_runtime_status(Some(stored_session.status.as_str()))
}

fn resolve_sdk_bridge_commands_runtime_status(
    commands: Option<&[CodeEngineSessionCommandRecord]>,
) -> Option<&'static str> {
    let commands = commands?;
    let mut saw_completed = false;
    let mut saw_failed = false;

    for command in commands.iter().rev() {
        match resolve_sdk_bridge_command_runtime_status(command) {
            Some("awaiting_user") => return Some("awaiting_user"),
            Some("awaiting_approval") => return Some("awaiting_approval"),
            Some("awaiting_tool") => return Some("awaiting_tool"),
            Some("streaming") => return Some("streaming"),
            Some("failed") => saw_failed = true,
            Some("completed") => saw_completed = true,
            _ => {}
        }
    }

    if saw_failed {
        Some("failed")
    } else if saw_completed {
        Some("completed")
    } else {
        None
    }
}

fn resolve_sdk_bridge_command_runtime_status(
    command: &CodeEngineSessionCommandRecord,
) -> Option<&'static str> {
    let command_status = map_codeengine_tool_command_status(Some(command.status.as_str()), None);
    let kind = command.kind.as_deref().unwrap_or_default();
    resolve_codeengine_command_interaction_runtime_status(
        kind,
        command_status.as_str(),
        command.runtime_status.as_deref(),
        command.requires_approval == Some(true),
        command.requires_reply == Some(true),
    )
}

fn sanitize_bridge_session_filename(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
                character
            } else {
                '_'
            }
        })
        .collect::<String>();
    let trimmed = sanitized.trim_matches('_');
    if trimmed.is_empty() {
        "session".to_owned()
    } else {
        trimmed.to_owned()
    }
}

fn parse_timestamp_millis(value: &str) -> Option<i64> {
    let timestamp = value.trim();
    if timestamp.is_empty() {
        return None;
    }

    let parsed =
        time::OffsetDateTime::parse(timestamp, &time::format_description::well_known::Rfc3339)
            .ok()?;
    Some((parsed.unix_timestamp_nanos() / 1_000_000) as i64)
}

fn normalize_non_empty_string(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
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

    use super::{
        build_sdk_bridge_session_summary_record, read_sdk_bridge_stored_session_with_limit,
        sanitize_bridge_session_filename, SdkBridgeStoredMessage, SdkBridgeStoredSession,
        SDK_BRIDGE_MESSAGE_RESOURCE_ITEM_LIMIT,
    };
    use crate::{CodeEngineSessionCommandRecord, CodeEngineSessionResourceRecord};

    static TEMP_DIRECTORY_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    #[test]
    fn sanitize_bridge_session_filename_removes_filesystem_unsafe_characters() {
        assert_eq!(
            sanitize_bridge_session_filename("claude-code-native:session/one"),
            "claude-code-native_session_one"
        );
        assert_eq!(sanitize_bridge_session_filename("::::"), "session");
    }

    #[test]
    fn sdk_bridge_summary_uses_persisted_transcript_timestamp_for_sorting() {
        let summary = build_sdk_bridge_session_summary_record(&SdkBridgeStoredSession {
            id: "session-1".to_owned(),
            engine_id: "gemini".to_owned(),
            model_id: "gemini".to_owned(),
            title: "Bridge turn".to_owned(),
            status: "completed".to_owned(),
            host_mode: "server".to_owned(),
            kind: "coding".to_owned(),
            created_at: "2026-04-24T00:00:00Z".to_owned(),
            updated_at: "2026-04-24T00:00:01Z".to_owned(),
            last_turn_at: Some("2026-04-24T00:00:01Z".to_owned()),
            native_cwd: Some("D:/repo/demo".to_owned()),
            workspace_id: None,
            project_id: None,
            messages: Vec::new(),
        });

        assert_eq!(summary.id, "session-1");
        assert_eq!(summary.engine_id, "gemini");
        assert!(summary.sort_timestamp > 0);
        assert_eq!(
            summary.transcript_updated_at.as_deref(),
            Some("2026-04-24T00:00:01Z")
        );
    }

    #[test]
    fn sdk_bridge_summary_uses_latest_waiting_command_runtime_status() {
        let summary = build_sdk_bridge_session_summary_record(&SdkBridgeStoredSession {
            id: "session-awaiting-user".to_owned(),
            engine_id: "gemini".to_owned(),
            model_id: "gemini".to_owned(),
            title: "Bridge turn".to_owned(),
            status: "completed".to_owned(),
            host_mode: "server".to_owned(),
            kind: "coding".to_owned(),
            created_at: "2026-04-24T00:00:00Z".to_owned(),
            updated_at: "2026-04-24T00:00:01Z".to_owned(),
            last_turn_at: Some("2026-04-24T00:00:01Z".to_owned()),
            native_cwd: Some("D:/repo/demo".to_owned()),
            workspace_id: None,
            project_id: None,
            messages: vec![SdkBridgeStoredMessage {
                id: "session-awaiting-user:message:1:assistant".to_owned(),
                turn_id: "sdk-bridge-turn-1".to_owned(),
                role: "assistant".to_owned(),
                content: "Need input".to_owned(),
                commands: Some(vec![CodeEngineSessionCommandRecord {
                    command: "Which tests should I run?".to_owned(),
                    status: "running".to_owned(),
                    output: None,
                    kind: Some("user_question".to_owned()),
                    tool_name: Some("user_question".to_owned()),
                    tool_call_id: Some("tool-question-1".to_owned()),
                    runtime_status: Some("awaiting_user".to_owned()),
                    requires_approval: Some(false),
                    requires_reply: Some(true),
                }]),
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                reasoning: None,
                resources: None,
                task_progress: None,
                created_at: "2026-04-24T00:00:01Z".to_owned(),
            }],
        });

        assert_eq!(summary.status, "active");
        assert_eq!(summary.runtime_status.as_deref(), Some("awaiting_user"));
    }

    #[test]
    fn sdk_bridge_summary_keeps_approved_permission_commands_awaiting_tool() {
        let summary = build_sdk_bridge_session_summary_record(&SdkBridgeStoredSession {
            id: "session-awaiting-tool".to_owned(),
            engine_id: "claude-code".to_owned(),
            model_id: "claude-code".to_owned(),
            title: "Bridge turn".to_owned(),
            status: "completed".to_owned(),
            host_mode: "server".to_owned(),
            kind: "coding".to_owned(),
            created_at: "2026-04-24T00:00:00Z".to_owned(),
            updated_at: "2026-04-24T00:00:01Z".to_owned(),
            last_turn_at: Some("2026-04-24T00:00:01Z".to_owned()),
            native_cwd: Some("D:/repo/demo".to_owned()),
            workspace_id: None,
            project_id: None,
            messages: vec![SdkBridgeStoredMessage {
                id: "session-awaiting-tool:message:1:assistant".to_owned(),
                turn_id: "sdk-bridge-turn-1".to_owned(),
                role: "assistant".to_owned(),
                content: "Approved".to_owned(),
                commands: Some(vec![CodeEngineSessionCommandRecord {
                    command: "Permission required: edit_file".to_owned(),
                    status: "success".to_owned(),
                    output: None,
                    kind: Some("approval".to_owned()),
                    tool_name: Some("permission_request".to_owned()),
                    tool_call_id: Some("tool-approval-1".to_owned()),
                    runtime_status: Some("awaiting_tool".to_owned()),
                    requires_approval: Some(false),
                    requires_reply: Some(false),
                }]),
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                reasoning: None,
                resources: None,
                task_progress: None,
                created_at: "2026-04-24T00:00:01Z".to_owned(),
            }],
        });

        assert_eq!(summary.status, "active");
        assert_eq!(summary.runtime_status.as_deref(), Some("awaiting_tool"));
    }

    #[test]
    fn sdk_bridge_summary_ignores_stale_waiting_runtime_status_after_command_settles() {
        let summary = build_sdk_bridge_session_summary_record(&SdkBridgeStoredSession {
            id: "session-stale-awaiting-user".to_owned(),
            engine_id: "gemini".to_owned(),
            model_id: "gemini".to_owned(),
            title: "Bridge turn".to_owned(),
            status: "completed".to_owned(),
            host_mode: "server".to_owned(),
            kind: "coding".to_owned(),
            created_at: "2026-04-24T00:00:00Z".to_owned(),
            updated_at: "2026-04-24T00:00:01Z".to_owned(),
            last_turn_at: Some("2026-04-24T00:00:01Z".to_owned()),
            native_cwd: Some("D:/repo/demo".to_owned()),
            workspace_id: None,
            project_id: None,
            messages: vec![SdkBridgeStoredMessage {
                id: "session-stale-awaiting-user:message:1:assistant".to_owned(),
                turn_id: "sdk-bridge-turn-1".to_owned(),
                role: "assistant".to_owned(),
                content: "Answered".to_owned(),
                commands: Some(vec![CodeEngineSessionCommandRecord {
                    command: "Which tests should I run?".to_owned(),
                    status: "success".to_owned(),
                    output: Some("Unit".to_owned()),
                    kind: Some("user_question".to_owned()),
                    tool_name: Some("user_question".to_owned()),
                    tool_call_id: Some("tool-question-1".to_owned()),
                    runtime_status: Some("awaiting_user".to_owned()),
                    requires_approval: Some(false),
                    requires_reply: Some(false),
                }]),
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                reasoning: None,
                resources: None,
                task_progress: None,
                created_at: "2026-04-24T00:00:01Z".to_owned(),
            }],
        });

        assert_eq!(summary.status, "completed");
        assert_eq!(summary.runtime_status.as_deref(), Some("completed"));
    }

    #[test]
    fn sdk_bridge_summary_maps_failed_runtime_to_paused_session_status() {
        let summary = build_sdk_bridge_session_summary_record(&SdkBridgeStoredSession {
            id: "session-failed".to_owned(),
            engine_id: "claude-code".to_owned(),
            model_id: "claude-code".to_owned(),
            title: "Bridge turn".to_owned(),
            status: "completed".to_owned(),
            host_mode: "server".to_owned(),
            kind: "coding".to_owned(),
            created_at: "2026-04-24T00:00:00Z".to_owned(),
            updated_at: "2026-04-24T00:00:01Z".to_owned(),
            last_turn_at: Some("2026-04-24T00:00:01Z".to_owned()),
            native_cwd: Some("D:/repo/demo".to_owned()),
            workspace_id: None,
            project_id: None,
            messages: vec![SdkBridgeStoredMessage {
                id: "session-failed:message:1:assistant".to_owned(),
                turn_id: "sdk-bridge-turn-1".to_owned(),
                role: "assistant".to_owned(),
                content: "Failed".to_owned(),
                commands: Some(vec![CodeEngineSessionCommandRecord {
                    command: "pnpm test".to_owned(),
                    status: "error".to_owned(),
                    output: Some("failed".to_owned()),
                    kind: Some("command".to_owned()),
                    tool_name: Some("run_command".to_owned()),
                    tool_call_id: Some("tool-command-1".to_owned()),
                    runtime_status: Some("failed".to_owned()),
                    requires_approval: Some(false),
                    requires_reply: Some(false),
                }]),
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                reasoning: None,
                resources: None,
                task_progress: None,
                created_at: "2026-04-24T00:00:01Z".to_owned(),
            }],
        });

        assert_eq!(summary.status, "paused");
        assert_eq!(summary.runtime_status.as_deref(), Some("failed"));
    }

    #[test]
    fn sdk_bridge_reader_accepts_an_exact_file_limit_and_rejects_one_byte_more() {
        let fixture = TestDirectory::new("file-byte-limit");
        let session_path = fixture.path().join("session.json");
        let stored_session = sdk_bridge_test_session(Vec::new());
        let serialized = serde_json::to_vec(&stored_session).expect("serialize SDK bridge fixture");
        fs::write(session_path.as_path(), serialized.as_slice()).expect("write SDK bridge fixture");

        let parsed =
            read_sdk_bridge_stored_session_with_limit(session_path.as_path(), serialized.len())
                .expect("parse SDK bridge fixture at exact byte limit");
        assert_eq!(parsed.id, stored_session.id);

        let error =
            read_sdk_bridge_stored_session_with_limit(session_path.as_path(), serialized.len() - 1)
                .expect_err("reject SDK bridge fixture beyond byte limit");
        assert!(error.contains("exceeds the configured"));
        assert!(error.contains("byte limit"));
    }

    #[test]
    fn sdk_bridge_reader_bounds_nested_resource_collections() {
        let fixture = TestDirectory::new("resource-item-limit");
        let session_path = fixture.path().join("session.json");
        let exact_resources = (0..SDK_BRIDGE_MESSAGE_RESOURCE_ITEM_LIMIT)
            .map(sdk_bridge_test_resource)
            .collect::<Vec<_>>();
        let exact_session =
            sdk_bridge_test_session(vec![sdk_bridge_test_message(Some(exact_resources.clone()))]);
        let exact_serialized =
            serde_json::to_vec(&exact_session).expect("serialize exact resource-limit fixture");
        fs::write(session_path.as_path(), exact_serialized.as_slice())
            .expect("write exact resource-limit fixture");

        let parsed = read_sdk_bridge_stored_session_with_limit(
            session_path.as_path(),
            exact_serialized.len(),
        )
        .expect("accept exact SDK bridge resource item limit");
        assert_eq!(
            parsed.messages[0].resources.as_ref().map(Vec::len),
            Some(SDK_BRIDGE_MESSAGE_RESOURCE_ITEM_LIMIT)
        );

        let mut oversized_resources = exact_resources;
        oversized_resources.push(sdk_bridge_test_resource(
            SDK_BRIDGE_MESSAGE_RESOURCE_ITEM_LIMIT,
        ));
        let oversized_session =
            sdk_bridge_test_session(vec![sdk_bridge_test_message(Some(oversized_resources))]);
        let oversized_serialized = serde_json::to_vec(&oversized_session)
            .expect("serialize oversized resource-limit fixture");
        fs::write(session_path.as_path(), oversized_serialized.as_slice())
            .expect("write oversized resource-limit fixture");

        let error = read_sdk_bridge_stored_session_with_limit(
            session_path.as_path(),
            oversized_serialized.len(),
        )
        .expect_err("reject oversized SDK bridge resource collection");
        assert!(error.contains("JSON array exceeds the configured 128 item limit"));
    }

    fn sdk_bridge_test_session(messages: Vec<SdkBridgeStoredMessage>) -> SdkBridgeStoredSession {
        SdkBridgeStoredSession {
            id: "sdk-bridge-bounded-session".to_owned(),
            engine_id: "claude-code".to_owned(),
            model_id: "claude-sonnet-4-6".to_owned(),
            title: "Bounded bridge session".to_owned(),
            status: "completed".to_owned(),
            host_mode: "server".to_owned(),
            kind: "coding".to_owned(),
            created_at: "2026-07-21T00:00:00Z".to_owned(),
            updated_at: "2026-07-21T00:00:01Z".to_owned(),
            last_turn_at: Some("2026-07-21T00:00:01Z".to_owned()),
            native_cwd: Some("E:/workspace/birdcoder".to_owned()),
            workspace_id: None,
            project_id: None,
            messages,
        }
    }

    fn sdk_bridge_test_message(
        resources: Option<Vec<CodeEngineSessionResourceRecord>>,
    ) -> SdkBridgeStoredMessage {
        SdkBridgeStoredMessage {
            id: "sdk-bridge-bounded-session:message:1:user".to_owned(),
            turn_id: "sdk-bridge-bounded-turn".to_owned(),
            role: "user".to_owned(),
            content: "Inspect the bounded bridge session".to_owned(),
            commands: None,
            tool_calls: None,
            tool_call_id: None,
            file_changes: None,
            reasoning: None,
            resources,
            task_progress: None,
            created_at: "2026-07-21T00:00:00Z".to_owned(),
        }
    }

    fn sdk_bridge_test_resource(index: usize) -> CodeEngineSessionResourceRecord {
        CodeEngineSessionResourceRecord {
            id: format!("resource-{index}"),
            kind: "file".to_owned(),
            name: Some(format!("resource-{index}.rs")),
            path: Some(format!("src/resource-{index}.rs")),
            uri: None,
            media_source: None,
            mime_type: Some("text/plain".to_owned()),
            description: None,
            origin: None,
            citation: None,
        }
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
                "sdkwork-birdcoder-sdk-bridge-{label}-{}-{now}-{sequence}",
                std::process::id()
            ));
            fs::create_dir_all(path.as_path()).expect("create SDK bridge test directory");
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
