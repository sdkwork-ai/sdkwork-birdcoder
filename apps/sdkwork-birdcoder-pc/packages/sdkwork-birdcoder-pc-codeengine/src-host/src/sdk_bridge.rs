use std::{
    env, fs,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};

use crate::{
    build_native_session_id, extract_native_lookup_id_for_engine,
    map_codeengine_session_runtime_status, map_codeengine_session_status_from_runtime,
    map_codeengine_tool_command_status, resolve_codeengine_command_interaction_runtime_status,
    CodeEngineSessionCommandRecord, CodeEngineSessionDetailRecord, CodeEngineSessionMessageRecord,
    CodeEngineSessionSummaryRecord, CodeEngineTurnIdeContextRecord, CodeEngineTurnRequestRecord,
    CodeEngineTurnResultRecord, CodeEngineTurnStreamEventRecord,
};

pub const CODEENGINE_SDK_BRIDGE_SCRIPT_ENV: &str = "BIRDCODER_CODEENGINE_SDK_BRIDGE_SCRIPT";
pub const CODEENGINE_SDK_BRIDGE_NODE_ENV: &str = "BIRDCODER_CODEENGINE_SDK_BRIDGE_NODE";
pub const CODEENGINE_SDK_BRIDGE_HOME_ENV: &str = "BIRDCODER_CODEENGINE_SDK_BRIDGE_HOME";
pub const CODEENGINE_HOME_ENV: &str = "BIRDCODER_CODEENGINE_HOME";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialSdkBridgeTurnRequest<'a> {
    pub engine_id: &'a str,
    pub model_id: &'a str,
    pub prompt_text: &'a str,
    pub native_session_id: Option<&'a str>,
    pub working_directory: Option<&'a Path>,
    pub request_kind: &'a str,
    pub ide_context: Option<&'a CodeEngineTurnIdeContextRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OfficialSdkBridgeProcessRequest<'a> {
    #[serde(flatten)]
    request: &'a OfficialSdkBridgeTurnRequest<'a>,
    stream_events: bool,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OfficialSdkBridgeTurnResponse {
    assistant_content: String,
    native_session_id: Option<String>,
    commands: Option<Vec<CodeEngineSessionCommandRecord>>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct OfficialSdkBridgeStreamEnvelope {
    #[serde(rename = "type")]
    event_type: String,
    role: Option<String>,
    content_delta: Option<String>,
    payload: Option<serde_json::Value>,
    response: Option<OfficialSdkBridgeTurnResponse>,
}

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
    messages: Vec<SdkBridgeStoredMessage>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct SdkBridgeStoredMessage {
    id: String,
    turn_id: String,
    role: String,
    content: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    commands: Option<Vec<CodeEngineSessionCommandRecord>>,
    #[serde(
        default,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    file_changes: Option<Vec<serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    task_progress: Option<serde_json::Value>,
    created_at: String,
}

pub fn execute_official_sdk_bridge_turn(
    request: &OfficialSdkBridgeTurnRequest<'_>,
) -> Result<CodeEngineTurnResultRecord, String> {
    let bridge_script_path = resolve_sdk_bridge_script_path()?;
    let bridge_workspace_root = bridge_script_path
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .ok_or_else(|| {
            format!(
                "Could not resolve BirdCoder workspace root from SDK bridge script path {}.",
                bridge_script_path.display()
            )
        })?;
    let node_executable = env::var(CODEENGINE_SDK_BRIDGE_NODE_ENV)
        .ok()
        .and_then(|value| normalize_non_empty_string(Some(value.as_str())))
        .unwrap_or_else(|| "node".to_owned());
    let request_body = serialize_official_sdk_bridge_request(request, false)?;

    let mut child = Command::new(node_executable)
        .arg("--experimental-strip-types")
        .arg(&bridge_script_path)
        .current_dir(&bridge_workspace_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            format!(
                "spawn codeengine SDK bridge failed for {}. Set {} to a Node executable and {} to the bridge script when running outside the workspace. Cause: {error}",
                request.engine_id, CODEENGINE_SDK_BRIDGE_NODE_ENV, CODEENGINE_SDK_BRIDGE_SCRIPT_ENV
            )
        })?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(request_body.as_bytes())
            .map_err(|error| format!("write codeengine SDK bridge request failed: {error}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("wait for codeengine SDK bridge failed: {error}"))?;
    let stdout = String::from_utf8(output.stdout)
        .map_err(|error| format!("decode codeengine SDK bridge stdout failed: {error}"))?;
    let stderr = String::from_utf8_lossy(&output.stderr).into_owned();

    if !output.status.success() {
        let detail = normalize_non_empty_string(Some(stderr.as_str()))
            .or_else(|| normalize_non_empty_string(Some(stdout.as_str())))
            .unwrap_or_else(|| "Codeengine SDK bridge exited without an error payload.".to_owned());
        return Err(format!(
            "Codeengine SDK bridge failed for engine \"{}\": {detail}",
            request.engine_id
        ));
    }

    let bridge_response =
        serde_json::from_str::<OfficialSdkBridgeTurnResponse>(stdout.trim()).map_err(|error| {
            format!(
                "parse codeengine SDK bridge response failed for engine \"{}\": {error}. Output: {}",
                request.engine_id,
                stdout.trim()
            )
        })?;

    Ok(CodeEngineTurnResultRecord {
        assistant_content: bridge_response.assistant_content,
        native_session_id: bridge_response.native_session_id,
        commands: bridge_response.commands,
    })
}

pub fn execute_official_sdk_bridge_turn_with_events(
    request: &OfficialSdkBridgeTurnRequest<'_>,
    on_event: &mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>,
) -> Result<CodeEngineTurnResultRecord, String> {
    let bridge_script_path = resolve_sdk_bridge_script_path()?;
    let bridge_workspace_root = bridge_script_path
        .parent()
        .and_then(Path::parent)
        .map(Path::to_path_buf)
        .ok_or_else(|| {
            format!(
                "Could not resolve BirdCoder workspace root from SDK bridge script path {}.",
                bridge_script_path.display()
            )
        })?;
    let node_executable = env::var(CODEENGINE_SDK_BRIDGE_NODE_ENV)
        .ok()
        .and_then(|value| normalize_non_empty_string(Some(value.as_str())))
        .unwrap_or_else(|| "node".to_owned());
    let request_body = serialize_official_sdk_bridge_request(request, true)?;

    let mut child = Command::new(node_executable)
        .arg("--experimental-strip-types")
        .arg(&bridge_script_path)
        .current_dir(&bridge_workspace_root)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            format!(
                "spawn streaming codeengine SDK bridge failed for {}. Set {} to a Node executable and {} to the bridge script when running outside the workspace. Cause: {error}",
                request.engine_id, CODEENGINE_SDK_BRIDGE_NODE_ENV, CODEENGINE_SDK_BRIDGE_SCRIPT_ENV
            )
        })?;
    let stdout_pipe = child
        .stdout
        .take()
        .ok_or_else(|| "Codeengine SDK bridge stdout pipe was not available.".to_owned())?;
    let stderr_pipe = child
        .stderr
        .take()
        .ok_or_else(|| "Codeengine SDK bridge stderr pipe was not available.".to_owned())?;
    let stderr_reader = thread::spawn(move || {
        let mut stderr = String::new();
        let _ = BufReader::new(stderr_pipe).read_to_string(&mut stderr);
        stderr
    });

    if let Some(mut stdin) = child.stdin.take() {
        stdin.write_all(request_body.as_bytes()).map_err(|error| {
            format!("write streaming codeengine SDK bridge request failed: {error}")
        })?;
    }

    let mut stdout_lines = Vec::new();
    let mut bridge_response: Option<OfficialSdkBridgeTurnResponse> = None;
    let stdout_reader = BufReader::new(stdout_pipe);
    for line in stdout_reader.lines() {
        let line = line.map_err(|error| {
            format!("read streaming codeengine SDK bridge stdout failed: {error}")
        })?;
        let trimmed_line = line.trim();
        if trimmed_line.is_empty() {
            continue;
        }
        stdout_lines.push(trimmed_line.to_owned());

        if let Ok(envelope) = serde_json::from_str::<OfficialSdkBridgeStreamEnvelope>(trimmed_line)
        {
            match envelope.event_type.as_str() {
                "message.delta" => {
                    if let Some(content_delta) = envelope.content_delta {
                        if !content_delta.is_empty() {
                            on_event(CodeEngineTurnStreamEventRecord {
                                kind: "message.delta".to_owned(),
                                role: envelope.role.unwrap_or_else(|| "assistant".to_owned()),
                                content_delta,
                                payload: envelope.payload,
                                native_session_id: None,
                            })?;
                        }
                    }
                }
                "turn.completed" => {
                    bridge_response = envelope.response;
                }
                _ if is_bridge_coding_session_stream_event_kind(envelope.event_type.as_str()) => {
                    on_event(CodeEngineTurnStreamEventRecord {
                        kind: envelope.event_type,
                        role: envelope.role.unwrap_or_else(|| "assistant".to_owned()),
                        content_delta: envelope.content_delta.unwrap_or_default(),
                        payload: envelope.payload,
                        native_session_id: None,
                    })?;
                }
                _ => {}
            }
            continue;
        }

        bridge_response = Some(serde_json::from_str::<OfficialSdkBridgeTurnResponse>(trimmed_line).map_err(
            |error| {
                format!(
                    "parse streaming codeengine SDK bridge response failed for engine \"{}\": {error}. Output: {}",
                    request.engine_id, trimmed_line
                )
            },
        )?);
    }

    let status = child
        .wait()
        .map_err(|error| format!("wait for streaming codeengine SDK bridge failed: {error}"))?;
    let stderr = stderr_reader
        .join()
        .unwrap_or_else(|_| "Codeengine SDK bridge stderr reader panicked.".to_owned());
    let stdout = stdout_lines.join("\n");

    if !status.success() {
        let detail = normalize_non_empty_string(Some(stderr.as_str()))
            .or_else(|| normalize_non_empty_string(Some(stdout.as_str())))
            .unwrap_or_else(|| "Codeengine SDK bridge exited without an error payload.".to_owned());
        return Err(format!(
            "Codeengine SDK bridge failed for engine \"{}\": {detail}",
            request.engine_id
        ));
    }

    let bridge_response = bridge_response.ok_or_else(|| {
        format!(
            "streaming codeengine SDK bridge did not return a final response for engine \"{}\". Output: {}",
            request.engine_id, stdout
        )
    })?;

    Ok(CodeEngineTurnResultRecord {
        assistant_content: bridge_response.assistant_content,
        native_session_id: bridge_response.native_session_id,
        commands: bridge_response.commands,
    })
}

fn serialize_official_sdk_bridge_request(
    request: &OfficialSdkBridgeTurnRequest<'_>,
    stream_events: bool,
) -> Result<String, String> {
    serde_json::to_string(&OfficialSdkBridgeProcessRequest {
        request,
        stream_events,
    })
    .map_err(|error| format!("serialize codeengine SDK bridge request failed: {error}"))
}

fn is_bridge_coding_session_stream_event_kind(kind: &str) -> bool {
    matches!(
        kind,
        "tool.call.requested"
            | "tool.call.progress"
            | "tool.call.completed"
            | "approval.required"
            | "operation.updated"
            | "artifact.upserted"
            | "turn.failed"
    )
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
            task_progress: message.task_progress.clone(),
            metadata: None,
            created_at: message.created_at.clone(),
        })
        .collect();
    Ok(Some(CodeEngineSessionDetailRecord { summary, messages }))
}

pub fn persist_sdk_bridge_turn(
    engine_id: &str,
    request: &CodeEngineTurnRequestRecord,
    assistant_content: &str,
    commands: Option<Vec<CodeEngineSessionCommandRecord>>,
    bridge_native_session_id: Option<String>,
) -> Result<String, String> {
    let native_session_id = bridge_native_session_id
        .as_deref()
        .and_then(|value| normalize_non_empty_string(Some(value)))
        .or_else(|| {
            request
                .native_session_id
                .as_deref()
                .and_then(|value| normalize_non_empty_string(Some(value)))
        });
    let raw_session_id = match native_session_id {
        Some(native_session_id) => {
            extract_native_lookup_id_for_engine(&native_session_id, engine_id)?
        }
        None => generate_sdk_bridge_session_lookup_id(engine_id),
    };
    let full_session_id = build_native_session_id(engine_id, raw_session_id.as_str());
    let session_path = sdk_bridge_session_file_path(engine_id, raw_session_id.as_str());
    let now = current_timestamp();
    let turn_index = session_path
        .exists()
        .then(|| read_sdk_bridge_stored_session(session_path.as_path()))
        .transpose()?
        .map(|session| session.messages.len() / 2 + 1)
        .unwrap_or(1);
    let mut stored_session = if session_path.exists() {
        read_sdk_bridge_stored_session(session_path.as_path())?
    } else {
        SdkBridgeStoredSession {
            id: full_session_id.clone(),
            engine_id: engine_id.to_owned(),
            model_id: request.model_id.clone(),
            title: truncate_title(request.input_summary.as_str()),
            status: "completed".to_owned(),
            host_mode: "server".to_owned(),
            kind: "coding".to_owned(),
            created_at: now.clone(),
            updated_at: now.clone(),
            last_turn_at: None,
            native_cwd: normalize_path_string(request.working_directory.as_deref()),
            messages: Vec::new(),
        }
    };

    let turn_id = format!("sdk-bridge-turn-{turn_index}");
    stored_session.id = full_session_id.clone();
    stored_session.model_id = request.model_id.clone();
    let turn_runtime_status =
        resolve_sdk_bridge_commands_runtime_status(commands.as_deref()).unwrap_or("completed");
    stored_session.status =
        map_codeengine_session_status_from_runtime(turn_runtime_status).to_owned();
    stored_session.updated_at = now.clone();
    stored_session.last_turn_at = Some(now.clone());
    if stored_session.native_cwd.is_none() {
        stored_session.native_cwd = normalize_path_string(request.working_directory.as_deref());
    }
    stored_session.messages.push(SdkBridgeStoredMessage {
        id: format!("{full_session_id}:message:{turn_index}:user"),
        turn_id: turn_id.clone(),
        role: "user".to_owned(),
        content: request.input_summary.clone(),
        commands: None,
        tool_calls: None,
        tool_call_id: None,
        file_changes: None,
        task_progress: None,
        created_at: now.clone(),
    });
    stored_session.messages.push(SdkBridgeStoredMessage {
        id: format!("{full_session_id}:message:{turn_index}:assistant"),
        turn_id,
        role: "assistant".to_owned(),
        content: assistant_content.to_owned(),
        commands,
        tool_calls: None,
        tool_call_id: None,
        file_changes: None,
        task_progress: None,
        created_at: now,
    });

    if let Some(parent) = session_path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            format!(
                "create SDK bridge session directory {} failed: {error}",
                parent.display()
            )
        })?;
    }
    fs::write(
        &session_path,
        serde_json::to_string_pretty(&stored_session)
            .map_err(|error| format!("serialize SDK bridge session failed: {error}"))?,
    )
    .map_err(|error| {
        format!(
            "write SDK bridge session file {} failed: {error}",
            session_path.display()
        )
    })?;

    Ok(full_session_id)
}

fn resolve_sdk_bridge_script_path() -> Result<PathBuf, String> {
    if let Some(configured_path) = env::var(CODEENGINE_SDK_BRIDGE_SCRIPT_ENV)
        .ok()
        .and_then(|value| normalize_non_empty_string(Some(value.as_str())))
    {
        let path = normalize_configured_bridge_script_path(PathBuf::from(configured_path));
        if path.is_file() {
            return Ok(path);
        }
        return Err(format!(
            "{} points to {}, but that file does not exist.",
            CODEENGINE_SDK_BRIDGE_SCRIPT_ENV,
            path.display()
        ));
    }

    let candidates = [
        env::current_dir().ok().map(|directory| {
            directory
                .join("scripts")
                .join("codeengine-official-sdk-bridge.ts")
        }),
        Some(
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("..")
                .join("..")
                .join("..")
                .join("scripts")
                .join("codeengine-official-sdk-bridge.ts"),
        ),
    ];

    candidates
        .into_iter()
        .flatten()
        .map(normalize_path)
        .find(|path| path.is_file())
        .ok_or_else(|| {
            format!(
                "Codeengine SDK bridge script was not found. Set {} to scripts/codeengine-official-sdk-bridge.ts.",
                CODEENGINE_SDK_BRIDGE_SCRIPT_ENV
            )
        })
}

fn normalize_configured_bridge_script_path(path: PathBuf) -> PathBuf {
    let absolute_path = if path.is_absolute() {
        path
    } else {
        env::current_dir()
            .unwrap_or_else(|_| PathBuf::from("."))
            .join(path)
    };
    let normalized_path = normalize_path(absolute_path);
    fs::canonicalize(&normalized_path).unwrap_or(normalized_path)
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
        .unwrap_or_else(|| env::current_dir().unwrap_or_else(|_| PathBuf::from(".")))
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
    let contents = fs::read_to_string(path).map_err(|error| {
        format!(
            "read SDK bridge session file {} failed: {error}",
            path.display()
        )
    })?;
    serde_json::from_str::<SdkBridgeStoredSession>(contents.as_str()).map_err(|error| {
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

fn generate_sdk_bridge_session_lookup_id(engine_id: &str) -> String {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    format!(
        "{}-bridge-{}-{}",
        sanitize_bridge_session_filename(engine_id),
        std::process::id(),
        timestamp
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

fn normalize_path(path: PathBuf) -> PathBuf {
    path.components().collect()
}

fn normalize_path_string(path: Option<&Path>) -> Option<String> {
    let path = path?;
    if !path.exists() {
        return None;
    }
    Some(path.display().to_string().replace('\\', "/"))
}

fn truncate_title(value: &str) -> String {
    const TITLE_LIMIT: usize = 120;
    let collapsed = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.is_empty() {
        return "SDK bridge session".to_owned();
    }
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

fn current_timestamp() -> String {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
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
        env, fs,
        sync::{Mutex, OnceLock},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::{
        build_sdk_bridge_session_summary_record, resolve_sdk_bridge_script_path,
        sanitize_bridge_session_filename, truncate_title, SdkBridgeStoredMessage,
        SdkBridgeStoredSession, CODEENGINE_SDK_BRIDGE_SCRIPT_ENV,
    };
    use crate::CodeEngineSessionCommandRecord;

    fn bridge_env_lock() -> &'static Mutex<()> {
        static BRIDGE_ENV_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        BRIDGE_ENV_LOCK.get_or_init(|| Mutex::new(()))
    }

    #[test]
    fn sanitize_bridge_session_filename_removes_filesystem_unsafe_characters() {
        assert_eq!(
            sanitize_bridge_session_filename("claude-code-native:session/one"),
            "claude-code-native_session_one"
        );
        assert_eq!(sanitize_bridge_session_filename("::::"), "session");
    }

    #[test]
    fn truncate_title_collapses_whitespace_and_preserves_short_requests() {
        assert_eq!(
            truncate_title("  Implement   the bridge\nprovider  "),
            "Implement the bridge provider"
        );
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
                task_progress: None,
                created_at: "2026-04-24T00:00:01Z".to_owned(),
            }],
        });

        assert_eq!(summary.status, "paused");
        assert_eq!(summary.runtime_status.as_deref(), Some("failed"));
    }

    #[test]
    fn sdk_bridge_script_env_override_resolves_relative_paths_to_absolute_files() {
        let _guard = bridge_env_lock().lock().expect("bridge env lock poisoned");
        let previous_bridge_script = env::var(CODEENGINE_SDK_BRIDGE_SCRIPT_ENV).ok();
        let unique_suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos())
            .unwrap_or_default();
        let relative_script_path = format!(
            "target/sdk-bridge-test-{unique_suffix}/scripts/codeengine-official-sdk-bridge.ts"
        );
        let script_path = env::current_dir()
            .expect("current dir is available")
            .join(relative_script_path.as_str());

        fs::create_dir_all(script_path.parent().expect("script parent exists"))
            .expect("create bridge script test directory");
        fs::write(&script_path, "console.log('{}');\n").expect("write bridge script fixture");
        env::set_var(
            CODEENGINE_SDK_BRIDGE_SCRIPT_ENV,
            relative_script_path.as_str(),
        );

        let resolved_path_result = resolve_sdk_bridge_script_path();

        match previous_bridge_script {
            Some(previous_bridge_script) => {
                env::set_var(CODEENGINE_SDK_BRIDGE_SCRIPT_ENV, previous_bridge_script)
            }
            None => env::remove_var(CODEENGINE_SDK_BRIDGE_SCRIPT_ENV),
        }

        let resolved_path = resolved_path_result.expect("relative bridge script resolves");
        assert!(
            resolved_path.is_absolute(),
            "relative bridge script override should be normalized to an absolute path"
        );
        let normalized_script_path: std::path::PathBuf = script_path.components().collect();
        let expected_path =
            fs::canonicalize(&normalized_script_path).unwrap_or(normalized_script_path);
        assert_eq!(resolved_path, expected_path);
    }
}
