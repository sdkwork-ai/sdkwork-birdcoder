use std::{
    collections::{BTreeMap, BTreeSet},
    io::{BufRead, BufReader},
    path::Path,
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde_json::Value;

use crate::{
    build_native_session_id, canonicalize_codeengine_tool_name, map_codeengine_tool_command_status,
    map_codeengine_tool_kind, map_codeengine_tool_runtime_status, opencode_server_attach_url_env,
    resolve_codeengine_command_interaction_state, CodeEngineTurnStreamEventRecord,
};

struct OpencodeServerHandle {
    base_url: String,
    child: Option<Child>,
}

impl OpencodeServerHandle {
    fn is_alive(&mut self) -> bool {
        match self.child.as_mut() {
            Some(child) => matches!(child.try_wait(), Ok(None)),
            None => true,
        }
    }
}

static OPENCODE_SERVER_HANDLE: OnceLock<Mutex<Option<OpencodeServerHandle>>> = OnceLock::new();
static OPENCODE_TRANSPORT_AVAILABLE: OnceLock<bool> = OnceLock::new();

#[derive(Default)]
struct OpencodeStreamProjectionState {
    text_by_part_id: BTreeMap<String, String>,
    seen_tool_call_ids: BTreeSet<String>,
}

fn opencode_server_handle() -> &'static Mutex<Option<OpencodeServerHandle>> {
    OPENCODE_SERVER_HANDLE.get_or_init(|| Mutex::new(None))
}

pub fn is_opencode_transport_available() -> bool {
    *OPENCODE_TRANSPORT_AVAILABLE.get_or_init(|| {
        std::env::var(opencode_server_attach_url_env())
            .ok()
            .and_then(|value| normalize_non_empty_string(Some(value.as_str())))
            .is_some()
            || probe_command_available(create_opencode_cli_command(), &["--version"])
    })
}

fn ensure_opencode_server_base_url() -> Result<String, String> {
    let mut handle_guard = opencode_server_handle()
        .lock()
        .map_err(|_| "OpenCode server handle mutex is poisoned.".to_owned())?;

    if let Some(existing) = handle_guard.as_mut() {
        if existing.is_alive() {
            return Ok(existing.base_url.clone());
        }
        *handle_guard = None;
    }

    let new_handle = start_opencode_server()?;
    let base_url = new_handle.base_url.clone();
    *handle_guard = Some(new_handle);
    Ok(base_url)
}

fn start_opencode_server() -> Result<OpencodeServerHandle, String> {
    if let Some(base_url) = std::env::var(opencode_server_attach_url_env())
        .ok()
        .and_then(|value| normalize_non_empty_string(Some(value.as_str())))
    {
        return Ok(OpencodeServerHandle {
            base_url,
            child: None,
        });
    }

    let mut command = create_opencode_cli_command();
    command
        .arg("serve")
        .arg("--hostname=127.0.0.1")
        .arg("--port=0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());

    let mut child = command
        .spawn()
        .map_err(|error| format!("spawn opencode server failed: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "OpenCode server stdout pipe was not available.".to_owned())?;
    let (sender, receiver) = std::sync::mpsc::channel::<String>();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            if sender.send(line).is_err() {
                break;
            }
        }
    });

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(8);
    let mut startup_output = Vec::new();

    loop {
        if let Ok(Some(status)) = child.try_wait() {
            return Err(if startup_output.is_empty() {
                format!("OpenCode server exited before startup completed with status {status}.")
            } else {
                format!(
                    "OpenCode server exited before startup completed with status {status}. Startup output: {}",
                    startup_output.join(" | ")
                )
            });
        }

        let now = std::time::Instant::now();
        if now >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err(if startup_output.is_empty() {
                "Timed out waiting for OpenCode server startup.".to_owned()
            } else {
                format!(
                    "Timed out waiting for OpenCode server startup. Startup output: {}",
                    startup_output.join(" | ")
                )
            });
        }

        let wait_for = deadline
            .saturating_duration_since(now)
            .min(std::time::Duration::from_millis(100));

        match receiver.recv_timeout(wait_for) {
            Ok(line) => {
                if !line.trim().is_empty() {
                    startup_output.push(line.clone());
                }
                if let Some(base_url) = parse_opencode_listen_url(&line) {
                    return Ok(OpencodeServerHandle {
                        base_url,
                        child: Some(child),
                    });
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => continue,
        }
    }
}

fn parse_opencode_listen_url(line: &str) -> Option<String> {
    normalize_non_empty_string(
        line.trim()
            .strip_prefix("opencode server listening on ")
            .map(str::trim),
    )
}

pub fn list_opencode_sessions() -> Result<Vec<Value>, String> {
    let response = opencode_request_json("GET", "/session", &[], None, false)?
        .unwrap_or(Value::Array(Vec::new()));
    match response {
        Value::Array(sessions) => Ok(sessions),
        _ => Err("OpenCode session list response was not an array.".to_owned()),
    }
}

pub fn list_opencode_session_status_map() -> Result<BTreeMap<String, String>, String> {
    let response = opencode_request_json("GET", "/session/status", &[], None, false)?
        .unwrap_or(Value::Object(serde_json::Map::new()));
    let Value::Object(entries) = response else {
        return Err("OpenCode session status response was not an object.".to_owned());
    };

    Ok(entries
        .into_iter()
        .filter_map(|(session_id, status)| {
            normalize_value_string(status.get("type")).map(|status_type| (session_id, status_type))
        })
        .collect())
}

pub fn get_opencode_session(session_id: &str) -> Result<Option<Value>, String> {
    let path = format!("/session/{session_id}");
    opencode_request_json("GET", path.as_str(), &[], None, true)
}

pub fn get_opencode_session_messages(session_id: &str) -> Result<Vec<Value>, String> {
    let path = format!("/session/{session_id}/message");
    let response = opencode_request_json("GET", path.as_str(), &[], None, false)?
        .unwrap_or(Value::Array(Vec::new()));
    match response {
        Value::Array(messages) => Ok(messages),
        _ => Err(format!(
            "OpenCode session messages response for {session_id} was not an array."
        )),
    }
}

pub fn create_opencode_session(directory: &Path, title: Option<&str>) -> Result<Value, String> {
    let mut request_body = serde_json::Map::new();
    if let Some(title) = title.and_then(|value| normalize_non_empty_string(Some(value))) {
        request_body.insert("title".to_owned(), Value::String(title));
    }

    let query = vec![("directory", directory.display().to_string())];
    opencode_request_json(
        "POST",
        "/session",
        &query,
        Some(Value::Object(request_body)),
        false,
    )?
    .ok_or_else(|| "OpenCode create session returned an empty response.".to_owned())
}

pub fn prompt_opencode_session(
    session_id: &str,
    prompt_text: &str,
    model_id: Option<&str>,
) -> Result<Value, String> {
    let prompt_path = format!("/session/{session_id}/message");
    opencode_request_json(
        "POST",
        prompt_path.as_str(),
        &[],
        Some(build_opencode_prompt_body(prompt_text, model_id)),
        false,
    )?
    .ok_or_else(|| "OpenCode prompt response was empty.".to_owned())
}

pub fn prompt_opencode_session_async(
    session_id: &str,
    prompt_text: &str,
    model_id: Option<&str>,
) -> Result<(), String> {
    let prompt_path = format!("/session/{session_id}/prompt_async");
    let _ = opencode_request_json(
        "POST",
        prompt_path.as_str(),
        &[],
        Some(build_opencode_prompt_body(prompt_text, model_id)),
        false,
    )?;
    Ok(())
}

pub fn reply_opencode_permission_request(
    request_id: &str,
    decision: &str,
    message: Option<&str>,
) -> Result<(), String> {
    let request_id = normalize_non_empty_string(Some(request_id))
        .ok_or_else(|| "OpenCode permission reply requires a request id.".to_owned())?;
    let reply = map_opencode_permission_reply(decision)?;
    let mut body = serde_json::Map::new();
    body.insert("reply".to_owned(), Value::String(reply));
    if let Some(message) = normalize_non_empty_string(message) {
        body.insert("message".to_owned(), Value::String(message));
    }
    let path = format!("/permission/{request_id}/reply");
    let _ = opencode_request_json("POST", path.as_str(), &[], Some(Value::Object(body)), false)?;
    Ok(())
}

pub fn reply_opencode_question_request(
    request_id: &str,
    answer: &str,
    option_label: Option<&str>,
) -> Result<(), String> {
    let request_id = normalize_non_empty_string(Some(request_id))
        .ok_or_else(|| "OpenCode question reply requires a request id.".to_owned())?;
    let answer_text = normalize_non_empty_string(option_label)
        .or_else(|| normalize_non_empty_string(Some(answer)))
        .ok_or_else(|| "OpenCode question reply requires a non-empty answer.".to_owned())?;
    let path = format!("/question/{request_id}/reply");
    let _ = opencode_request_json(
        "POST",
        path.as_str(),
        &[],
        Some(serde_json::json!({
            "answers": [[answer_text]],
        })),
        false,
    )?;
    Ok(())
}

pub fn reject_opencode_question_request(request_id: &str) -> Result<(), String> {
    let request_id = normalize_non_empty_string(Some(request_id))
        .ok_or_else(|| "OpenCode question reject requires a request id.".to_owned())?;
    let path = format!("/question/{request_id}/reject");
    let _ = opencode_request_json("POST", path.as_str(), &[], None, false)?;
    Ok(())
}

pub fn stream_opencode_session_events<F>(
    session_id: &str,
    on_stream_ready: F,
    on_event: &mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>,
) -> Result<(), String>
where
    F: FnOnce() -> Result<(), String>,
{
    let base_url = ensure_opencode_server_base_url()?;
    let url = format!("{}/event", base_url.trim_end_matches('/'));
    let agent = ureq::agent();
    let request = agent
        .get(url.as_str())
        .set("Accept", "text/event-stream")
        .set("Cache-Control", "no-cache");
    let request = if let Some(authorization) = build_opencode_authorization_header() {
        request.set("Authorization", authorization.as_str())
    } else {
        request
    };
    let response = match request.call() {
        Ok(response) => response,
        Err(ureq::Error::Status(status, response)) => {
            let body = response.into_string().unwrap_or_default();
            return Err(format!(
                "OpenCode event stream failed with status {status}: {}",
                format_opencode_http_error(&body)
            ));
        }
        Err(ureq::Error::Transport(error)) => {
            return Err(format!("OpenCode event stream failed: {error}"));
        }
    };

    on_stream_ready()?;

    let mut reader = BufReader::new(response.into_reader());
    let mut projection_state = OpencodeStreamProjectionState::default();
    let mut line = String::new();
    loop {
        line.clear();
        let read = reader
            .read_line(&mut line)
            .map_err(|error| format!("read OpenCode event stream failed: {error}"))?;
        if read == 0 {
            return Err(format!(
                "OpenCode event stream ended before session {session_id} became idle."
            ));
        }

        let trimmed_line = line.trim();
        let Some(payload_text) = trimmed_line.strip_prefix("data:") else {
            continue;
        };
        let payload_text = payload_text.trim();
        if payload_text.is_empty() {
            continue;
        }

        let event = serde_json::from_str::<Value>(payload_text).map_err(|error| {
            format!("parse OpenCode event stream payload failed: {error}. Payload: {payload_text}")
        })?;
        if let Some(error_message) = opencode_session_error_message(session_id, &event) {
            return Err(error_message);
        }
        let stream_events =
            project_opencode_stream_events(session_id, &event, &mut projection_state);
        if !stream_events.is_empty() {
            for stream_event in stream_events {
                on_event(stream_event)?;
            }
            continue;
        }
        if opencode_session_is_idle_event(session_id, &event) {
            return Ok(());
        }
    }
}

fn build_opencode_prompt_body(prompt_text: &str, model_id: Option<&str>) -> Value {
    let mut request_body = serde_json::Map::new();
    request_body.insert("agent".to_owned(), Value::String("build".to_owned()));
    request_body.insert(
        "parts".to_owned(),
        Value::Array(vec![serde_json::json!({
            "type": "text",
            "text": prompt_text,
        })]),
    );
    if let Some(model) = build_opencode_model_payload(model_id) {
        request_body.insert("model".to_owned(), model);
    }

    Value::Object(request_body)
}

fn build_opencode_model_payload(model_id: Option<&str>) -> Option<Value> {
    let normalized_model_id = normalize_non_empty_string(model_id)?;
    if normalized_model_id.eq_ignore_ascii_case("opencode") {
        return None;
    }
    let (provider_id, model_id) = normalized_model_id.split_once('/')?;
    Some(serde_json::json!({
        "providerID": provider_id,
        "modelID": model_id,
    }))
}

fn project_opencode_stream_events(
    session_id: &str,
    event: &Value,
    state: &mut OpencodeStreamProjectionState,
) -> Vec<CodeEngineTurnStreamEventRecord> {
    if !opencode_event_targets_session(session_id, event) {
        return Vec::new();
    }

    let Some(event_type) = normalize_value_string(event.get("type")) else {
        return Vec::new();
    };

    match event_type.as_str() {
        "message.part.delta" | "message.part.updated" => {
            let mut events = Vec::new();
            if let Some(delta_event) = project_opencode_text_event(session_id, event, state) {
                events.push(delta_event);
            }
            if let Some(tool_event) = project_opencode_tool_part_event(session_id, event, state) {
                events.push(tool_event);
            }
            events
        }
        "permission.asked" => project_opencode_permission_asked_events(session_id, event, state),
        "permission.updated" => {
            project_opencode_permission_updated_events(session_id, event, state)
        }
        "question.asked" => project_opencode_question_asked_events(session_id, event, state),
        "question.replied" => project_opencode_question_replied_events(session_id, event, state),
        "question.rejected" => project_opencode_question_rejected_events(session_id, event, state),
        _ => Vec::new(),
    }
}

fn project_opencode_text_event(
    session_id: &str,
    event: &Value,
    state: &mut OpencodeStreamProjectionState,
) -> Option<CodeEngineTurnStreamEventRecord> {
    let event_type = normalize_value_string(event.get("type"))?;
    let properties = event.get("properties")?;
    let part = properties.get("part");
    let part_key = resolve_opencode_text_part_key(properties, part);
    let content_delta = match event_type.as_str() {
        "message.part.delta" => {
            let field = normalize_value_string(properties.get("field"))
                .unwrap_or_else(|| "text".to_owned());
            if field != "text" {
                return None;
            }
            let delta = read_opencode_text_value(properties.get("delta"))?;
            if let Some(part_key) = part_key.as_deref() {
                let previous = state
                    .text_by_part_id
                    .get(part_key)
                    .cloned()
                    .unwrap_or_default();
                state
                    .text_by_part_id
                    .insert(part_key.to_owned(), format!("{previous}{delta}"));
            }
            delta
        }
        "message.part.updated" => {
            if let Some(delta) = read_opencode_text_value(properties.get("delta")) {
                if let Some(part_key) = part_key.as_deref() {
                    let next_text = if part
                        .and_then(|value| value.get("type"))
                        .and_then(Value::as_str)
                        == Some("text")
                    {
                        read_opencode_text_value(part.and_then(|value| value.get("text")))
                            .unwrap_or_else(|| {
                                let previous = state
                                    .text_by_part_id
                                    .get(part_key)
                                    .cloned()
                                    .unwrap_or_default();
                                format!("{previous}{delta}")
                            })
                    } else {
                        let previous = state
                            .text_by_part_id
                            .get(part_key)
                            .cloned()
                            .unwrap_or_default();
                        format!("{previous}{delta}")
                    };
                    state.text_by_part_id.insert(part_key.to_owned(), next_text);
                }
                delta
            } else {
                if part
                    .and_then(|value| value.get("type"))
                    .and_then(Value::as_str)
                    != Some("text")
                {
                    return None;
                }
                let next_text = read_opencode_text_value(part.and_then(|value| value.get("text")))?;
                if let Some(part_key) = part_key.as_deref() {
                    let previous_text = state
                        .text_by_part_id
                        .get(part_key)
                        .cloned()
                        .unwrap_or_default();
                    state
                        .text_by_part_id
                        .insert(part_key.to_owned(), next_text.clone());
                    resolve_cumulative_text_delta(previous_text.as_str(), next_text.as_str())
                } else {
                    next_text
                }
            }
        }
        _ => return None,
    };

    if content_delta.is_empty() {
        return None;
    }

    Some(CodeEngineTurnStreamEventRecord {
        kind: "message.delta".to_owned(),
        role: "assistant".to_owned(),
        content_delta,
        payload: None,
        native_session_id: Some(build_native_session_id("opencode", session_id)),
    })
}

fn project_opencode_tool_part_event(
    session_id: &str,
    event: &Value,
    state: &mut OpencodeStreamProjectionState,
) -> Option<CodeEngineTurnStreamEventRecord> {
    if normalize_value_string(event.get("type")).as_deref() != Some("message.part.updated") {
        return None;
    }
    let part = event.get("properties")?.get("part")?;
    if part.get("type").and_then(Value::as_str) != Some("tool") {
        return None;
    }
    let raw_tool_name =
        normalize_value_string(part.get("tool")).unwrap_or_else(|| "tool".to_owned());
    let tool_name = canonicalize_codeengine_tool_name(raw_tool_name.as_str());
    let state_value = part.get("state");
    let tool_arguments = build_opencode_stream_tool_arguments(part);
    let status_value = state_value.and_then(|value| value.get("status"));
    let status = map_codeengine_tool_command_status(status_value.and_then(Value::as_str), None);
    let kind = map_codeengine_tool_kind(tool_name.as_str());
    let runtime_status =
        map_codeengine_tool_runtime_status(kind, status_value.and_then(Value::as_str), None);
    let interaction_state = resolve_codeengine_command_interaction_state(
        kind,
        status.as_str(),
        Some(runtime_status),
        false,
        false,
    );
    let tool_call_id = normalize_value_string(part.get("callID"))
        .or_else(|| normalize_value_string(part.get("id")))
        .unwrap_or_else(|| format!("opencode-tool-{}", state.seen_tool_call_ids.len() + 1));

    Some(build_opencode_tool_stream_event(
        session_id,
        state,
        tool_name,
        tool_call_id,
        tool_arguments,
        status,
        runtime_status.to_owned(),
        interaction_state.requires_approval,
        interaction_state.requires_reply,
    ))
}

fn project_opencode_permission_asked_events(
    session_id: &str,
    event: &Value,
    state: &mut OpencodeStreamProjectionState,
) -> Vec<CodeEngineTurnStreamEventRecord> {
    let Some(properties) = event.get("properties") else {
        return Vec::new();
    };
    let permission_id = resolve_opencode_request_id(properties, "opencode-permission");
    let payload = json_object_from_entries([
        (
            "status",
            Some(Value::String("awaiting_approval".to_owned())),
        ),
        ("permissionId", Some(Value::String(permission_id.clone()))),
        ("permission", properties.get("permission").cloned()),
        ("patterns", properties.get("patterns").cloned()),
        ("metadata", properties.get("metadata").cloned()),
        ("always", properties.get("always").cloned()),
        ("tool", properties.get("tool").cloned()),
    ]);
    let event = build_opencode_tool_stream_event(
        session_id,
        state,
        "permission_request".to_owned(),
        permission_id,
        Value::Object(payload),
        "running".to_owned(),
        "awaiting_approval".to_owned(),
        true,
        false,
    );
    let mut approval_event = event.clone();
    approval_event.kind = "approval.required".to_owned();
    vec![event, approval_event]
}

fn project_opencode_permission_updated_events(
    session_id: &str,
    event: &Value,
    state: &mut OpencodeStreamProjectionState,
) -> Vec<CodeEngineTurnStreamEventRecord> {
    let Some(properties) = event.get("properties") else {
        return Vec::new();
    };
    let permission_id = resolve_opencode_request_id(properties, "opencode-permission");
    let status_source = properties
        .get("status")
        .or_else(|| properties.get("type"))
        .and_then(Value::as_str);
    let status = map_codeengine_tool_command_status(status_source, None);
    let runtime_status = map_codeengine_tool_runtime_status("approval", status_source, None);
    let payload = json_object_from_entries([
        (
            "status",
            properties
                .get("status")
                .cloned()
                .or_else(|| properties.get("type").cloned()),
        ),
        (
            "runtimeStatus",
            Some(Value::String(runtime_status.to_owned())),
        ),
        ("permissionId", Some(Value::String(permission_id.clone()))),
        ("type", properties.get("type").cloned()),
        ("title", properties.get("title").cloned()),
        ("pattern", properties.get("pattern").cloned()),
        ("metadata", properties.get("metadata").cloned()),
    ]);

    vec![build_opencode_tool_stream_event(
        session_id,
        state,
        "permission_request".to_owned(),
        permission_id,
        Value::Object(payload),
        status,
        runtime_status.to_owned(),
        false,
        false,
    )]
}

fn project_opencode_question_asked_events(
    session_id: &str,
    event: &Value,
    state: &mut OpencodeStreamProjectionState,
) -> Vec<CodeEngineTurnStreamEventRecord> {
    let Some(properties) = event.get("properties") else {
        return Vec::new();
    };
    let request_id = resolve_opencode_request_id(properties, "opencode-question");
    let payload = json_object_from_entries([
        ("status", Some(Value::String("awaiting_user".to_owned()))),
        ("requestId", Some(Value::String(request_id.clone()))),
        ("sessionID", Some(Value::String(session_id.to_owned()))),
        ("questions", properties.get("questions").cloned()),
        ("tool", properties.get("tool").cloned()),
    ]);

    vec![build_opencode_tool_stream_event(
        session_id,
        state,
        "user_question".to_owned(),
        request_id,
        Value::Object(payload),
        "running".to_owned(),
        "awaiting_user".to_owned(),
        false,
        true,
    )]
}

fn project_opencode_question_replied_events(
    session_id: &str,
    event: &Value,
    state: &mut OpencodeStreamProjectionState,
) -> Vec<CodeEngineTurnStreamEventRecord> {
    let Some(properties) = event.get("properties") else {
        return Vec::new();
    };
    let request_id = resolve_opencode_request_id(properties, "opencode-question");
    let answer = first_opencode_question_answer(properties.get("answers"));
    let payload = json_object_from_entries([
        ("status", Some(Value::String("completed".to_owned()))),
        (
            "runtimeStatus",
            Some(Value::String("awaiting_tool".to_owned())),
        ),
        ("requestId", Some(Value::String(request_id.clone()))),
        ("sessionID", Some(Value::String(session_id.to_owned()))),
        ("answer", answer.map(Value::String)),
        ("answers", properties.get("answers").cloned()),
    ]);

    vec![build_opencode_tool_stream_event(
        session_id,
        state,
        "user_question".to_owned(),
        request_id,
        Value::Object(payload),
        "success".to_owned(),
        "awaiting_tool".to_owned(),
        false,
        false,
    )]
}

fn project_opencode_question_rejected_events(
    session_id: &str,
    event: &Value,
    state: &mut OpencodeStreamProjectionState,
) -> Vec<CodeEngineTurnStreamEventRecord> {
    let Some(properties) = event.get("properties") else {
        return Vec::new();
    };
    let request_id = resolve_opencode_request_id(properties, "opencode-question");
    let payload = json_object_from_entries([
        ("status", Some(Value::String("rejected".to_owned()))),
        ("runtimeStatus", Some(Value::String("failed".to_owned()))),
        ("requestId", Some(Value::String(request_id.clone()))),
        ("sessionID", Some(Value::String(session_id.to_owned()))),
    ]);

    vec![build_opencode_tool_stream_event(
        session_id,
        state,
        "user_question".to_owned(),
        request_id,
        Value::Object(payload),
        "error".to_owned(),
        "failed".to_owned(),
        false,
        false,
    )]
}

fn build_opencode_tool_stream_event(
    session_id: &str,
    state: &mut OpencodeStreamProjectionState,
    tool_name: String,
    tool_call_id: String,
    tool_arguments: Value,
    status: String,
    runtime_status: String,
    requires_approval: bool,
    requires_reply: bool,
) -> CodeEngineTurnStreamEventRecord {
    let is_terminal = status == "success"
        || status == "error"
        || matches!(
            runtime_status.as_str(),
            "completed" | "failed" | "terminated" | "awaiting_tool"
        );
    let was_seen = !state.seen_tool_call_ids.insert(tool_call_id.clone());
    let kind = if is_terminal {
        "tool.call.completed"
    } else if was_seen {
        "tool.call.progress"
    } else {
        "tool.call.requested"
    };

    let mut payload = serde_json::Map::new();
    payload.insert("toolName".to_owned(), Value::String(tool_name));
    payload.insert("toolCallId".to_owned(), Value::String(tool_call_id));
    payload.insert("toolArguments".to_owned(), tool_arguments);
    payload.insert("status".to_owned(), Value::String(status));
    payload.insert("runtimeStatus".to_owned(), Value::String(runtime_status));
    payload.insert(
        "requiresApproval".to_owned(),
        Value::Bool(requires_approval),
    );
    payload.insert("requiresReply".to_owned(), Value::Bool(requires_reply));

    CodeEngineTurnStreamEventRecord {
        kind: kind.to_owned(),
        role: "assistant".to_owned(),
        content_delta: String::new(),
        payload: Some(Value::Object(payload)),
        native_session_id: Some(build_native_session_id("opencode", session_id)),
    }
}

fn opencode_event_targets_session(session_id: &str, event: &Value) -> bool {
    match resolve_opencode_event_session_id(event) {
        Some(event_session_id) => event_session_id == session_id,
        None => true,
    }
}

fn resolve_opencode_event_session_id(event: &Value) -> Option<String> {
    let properties = event.get("properties")?;
    normalize_value_string(properties.get("sessionID")).or_else(|| {
        properties
            .get("part")
            .and_then(|part| normalize_value_string(part.get("sessionID")))
    })
}

fn resolve_opencode_text_part_key(properties: &Value, part: Option<&Value>) -> Option<String> {
    normalize_value_string(properties.get("partID"))
        .or_else(|| normalize_value_string(properties.get("partId")))
        .or_else(|| part.and_then(|part| normalize_value_string(part.get("id"))))
        .or_else(|| {
            normalize_value_string(properties.get("messageID"))
                .or_else(|| normalize_value_string(properties.get("messageId")))
                .or_else(|| part.and_then(|part| normalize_value_string(part.get("messageID"))))
                .map(|message_id| format!("{message_id}:text"))
        })
}

fn resolve_cumulative_text_delta(previous_text: &str, next_text: &str) -> String {
    if next_text == previous_text {
        return String::new();
    }

    next_text
        .strip_prefix(previous_text)
        .map(str::to_owned)
        .unwrap_or_else(|| next_text.to_owned())
}

fn read_opencode_text_value(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(value) => Some(value.to_owned()),
        Value::Number(value) => Some(value.to_string()),
        Value::Bool(value) => Some(value.to_string()),
        _ => None,
    }
}

fn resolve_opencode_request_id(properties: &Value, fallback_prefix: &str) -> String {
    normalize_value_string(properties.get("requestID"))
        .or_else(|| normalize_value_string(properties.get("requestId")))
        .or_else(|| normalize_value_string(properties.get("id")))
        .or_else(|| normalize_value_string(properties.get("callID")))
        .or_else(|| {
            properties
                .get("tool")
                .and_then(|tool| normalize_value_string(tool.get("callID")))
        })
        .unwrap_or_else(|| format!("{fallback_prefix}-unknown"))
}

fn first_opencode_question_answer(value: Option<&Value>) -> Option<String> {
    value.and_then(Value::as_array)?.iter().find_map(|entry| {
        entry
            .as_array()
            .and_then(|answers| {
                answers
                    .iter()
                    .find_map(|answer| normalize_value_string(Some(answer)))
            })
            .or_else(|| normalize_value_string(Some(entry)))
    })
}

fn build_opencode_stream_tool_arguments(part: &Value) -> Value {
    let state = part.get("state");
    let mut arguments =
        normalize_opencode_tool_input_arguments(state.and_then(|value| value.get("input")));
    if let Some(status) = state.and_then(|value| value.get("status")).cloned() {
        arguments.entry("status".to_owned()).or_insert(status);
    }
    if let Some(title) = state.and_then(|value| value.get("title")).cloned() {
        arguments.entry("title".to_owned()).or_insert(title);
    }
    if let Some(output) = state.and_then(|value| value.get("output")).cloned() {
        arguments.entry("output".to_owned()).or_insert(output);
    }
    if let Some(result) = state.and_then(|value| value.get("result")).cloned() {
        arguments.entry("result".to_owned()).or_insert(result);
    }
    if let Some(state) = state.cloned() {
        arguments.insert("openCodeState".to_owned(), state);
    }
    if let Some(metadata) = part.get("metadata").cloned() {
        arguments.insert("metadata".to_owned(), metadata);
    }
    Value::Object(arguments)
}

pub(crate) fn build_opencode_tool_command_arguments(state: Option<&Value>) -> Option<Value> {
    let state = state?;
    let mut arguments = normalize_opencode_tool_input_arguments(state.get("input"));
    if !arguments.contains_key("title") {
        if let Some(title) = normalize_value_string(state.get("title")) {
            arguments.insert("title".to_owned(), Value::String(title));
        }
    }

    if arguments.is_empty() {
        None
    } else {
        Some(Value::Object(arguments))
    }
}

fn normalize_opencode_tool_input_arguments(
    input: Option<&Value>,
) -> serde_json::Map<String, Value> {
    match input {
        Some(Value::Object(arguments)) => arguments.clone(),
        Some(Value::String(value)) => {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                return serde_json::Map::new();
            }
            match serde_json::from_str::<Value>(trimmed) {
                Ok(Value::Object(arguments)) => arguments,
                Ok(parsed_value) => {
                    let mut arguments = serde_json::Map::new();
                    arguments.insert("input".to_owned(), parsed_value);
                    arguments
                }
                Err(_) => {
                    let mut arguments = serde_json::Map::new();
                    arguments.insert("input".to_owned(), Value::String(value.to_owned()));
                    arguments
                }
            }
        }
        Some(value) => {
            let mut arguments = serde_json::Map::new();
            arguments.insert("input".to_owned(), value.clone());
            arguments
        }
        None => serde_json::Map::new(),
    }
}

fn json_object_from_entries<const N: usize>(
    entries: [(&str, Option<Value>); N],
) -> serde_json::Map<String, Value> {
    entries
        .into_iter()
        .filter_map(|(key, value)| value.map(|value| (key.to_owned(), value)))
        .collect()
}

fn map_opencode_permission_reply(decision: &str) -> Result<String, String> {
    match decision.trim().to_ascii_lowercase().as_str() {
        "approved" | "approve" | "allow" | "allowed" | "once" | "accept" | "accepted" => {
            Ok("once".to_owned())
        }
        "always" | "approved_for_session" | "allow_for_session" | "for_session" => {
            Ok("always".to_owned())
        }
        "denied" | "deny" | "blocked" | "reject" | "rejected" => Ok("reject".to_owned()),
        value if value.is_empty() => {
            Err("OpenCode permission reply requires a decision.".to_owned())
        }
        value => Err(format!(
            "OpenCode permission reply does not support decision \"{value}\"."
        )),
    }
}

fn opencode_session_is_idle_event(session_id: &str, event: &Value) -> bool {
    let Some(event_type) = normalize_value_string(event.get("type")) else {
        return false;
    };
    let Some(properties) = event.get("properties") else {
        return false;
    };
    if normalize_value_string(properties.get("sessionID")).as_deref() != Some(session_id) {
        return false;
    }

    if event_type == "session.idle" {
        return true;
    }
    event_type == "session.status"
        && normalize_value_string(
            properties
                .get("status")
                .and_then(|status| status.get("type")),
        )
        .as_deref()
            == Some("idle")
}

fn opencode_session_error_message(session_id: &str, event: &Value) -> Option<String> {
    if normalize_value_string(event.get("type")).as_deref() != Some("session.error") {
        return None;
    }
    let properties = event.get("properties")?;
    if let Some(event_session_id) = normalize_value_string(properties.get("sessionID")) {
        if event_session_id != session_id {
            return None;
        }
    }

    let error = properties.get("error")?;
    let message = normalize_value_string(error.get("message"))
        .or_else(|| normalize_value_string(error.get("name")))
        .unwrap_or_else(|| error.to_string());
    Some(format!("OpenCode session {session_id} failed: {message}"))
}

fn opencode_request_json(
    method: &str,
    path: &str,
    query: &[(&str, String)],
    body: Option<Value>,
    allow_not_found: bool,
) -> Result<Option<Value>, String> {
    let base_url = ensure_opencode_server_base_url()?;
    let url = format!("{}{}", base_url.trim_end_matches('/'), path);
    let agent = ureq::agent();
    let request = match method {
        "GET" => agent.get(url.as_str()),
        "POST" => agent.post(url.as_str()),
        _ => {
            return Err(format!(
                "Unsupported OpenCode HTTP method \"{method}\" for {path}."
            ))
        }
    };
    let request = query
        .iter()
        .fold(request, |request, (key, value)| {
            request.query(key, value.as_str())
        })
        .set("Accept", "application/json");
    let request = if let Some(authorization) = build_opencode_authorization_header() {
        request.set("Authorization", authorization.as_str())
    } else {
        request
    };

    let response = match body {
        Some(body) => {
            let serialized_body = body.to_string();
            request
                .set("Content-Type", "application/json")
                .send_string(serialized_body.as_str())
        }
        None => request.call(),
    };

    match response {
        Ok(response) => {
            let body = response.into_string().map_err(|error| {
                format!("read OpenCode response body for {path} failed: {error}")
            })?;
            if body.trim().is_empty() {
                Ok(Some(Value::Null))
            } else {
                serde_json::from_str::<Value>(&body)
                    .map(Some)
                    .map_err(|error| {
                        format!("parse OpenCode response body for {path} failed: {error}")
                    })
            }
        }
        Err(ureq::Error::Status(404, response)) if allow_not_found => {
            let _ = response.into_string();
            Ok(None)
        }
        Err(ureq::Error::Status(status, response)) => {
            let body = response.into_string().unwrap_or_default();
            Err(format!(
                "OpenCode request {method} {path} failed with status {status}: {}",
                format_opencode_http_error(&body)
            ))
        }
        Err(ureq::Error::Transport(error)) => {
            Err(format!("OpenCode request {method} {path} failed: {error}"))
        }
    }
}

fn build_opencode_authorization_header() -> Option<String> {
    let password = std::env::var("OPENCODE_SERVER_PASSWORD")
        .ok()
        .and_then(|value| normalize_non_empty_string(Some(value.as_str())))?;
    let username = std::env::var("OPENCODE_SERVER_USERNAME")
        .ok()
        .and_then(|value| normalize_non_empty_string(Some(value.as_str())))
        .unwrap_or_else(|| "opencode".to_owned());
    Some(format!(
        "Basic {}",
        BASE64_STANDARD.encode(format!("{username}:{password}"))
    ))
}

fn format_opencode_http_error(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return "OpenCode server request failed.".to_owned();
    }

    if let Ok(parsed) = serde_json::from_str::<Value>(trimmed) {
        return parsed
            .get("data")
            .and_then(|data| normalize_value_string(data.get("message")))
            .or_else(|| normalize_value_string(parsed.get("error")))
            .or_else(|| normalize_value_string(parsed.get("message")))
            .unwrap_or_else(|| trimmed.to_owned());
    }

    trimmed.to_owned()
}

fn probe_command_available(mut command: Command, args: &[&str]) -> bool {
    command
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    command
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn create_opencode_cli_command() -> Command {
    if cfg!(windows) {
        let mut command = Command::new("cmd");
        command.arg("/C").arg("opencode.cmd");
        command
    } else {
        Command::new("opencode")
    }
}

fn normalize_non_empty_string(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
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

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{
        build_opencode_model_payload, project_opencode_stream_events, OpencodeStreamProjectionState,
    };

    #[test]
    fn build_opencode_model_payload_omits_birdcoder_engine_sentinels() {
        assert!(build_opencode_model_payload(Some("opencode")).is_none());
        assert!(build_opencode_model_payload(Some(" open-code ")).is_none());
        assert!(build_opencode_model_payload(Some("open code")).is_none());
    }

    #[test]
    fn build_opencode_model_payload_preserves_provider_scoped_model_ids() {
        assert_eq!(
            build_opencode_model_payload(Some(" openai/gpt-5.4 ")),
            Some(json!({
                "providerID": "openai",
                "modelID": "gpt-5.4",
            })),
        );
    }

    #[test]
    fn build_opencode_model_payload_rejects_bare_model_ids() {
        assert!(build_opencode_model_payload(Some("gpt-5.4")).is_none());
    }

    #[test]
    fn opencode_stream_projection_normalizes_cumulative_text_snapshots_to_deltas() {
        let mut state = OpencodeStreamProjectionState::default();

        let first_events = project_opencode_stream_events(
            "session-1",
            &json!({
                "type": "message.part.updated",
                "properties": {
                    "part": {
                        "id": "part-text-1",
                        "sessionID": "session-1",
                        "messageID": "message-1",
                        "type": "text",
                        "text": "OpenCode "
                    }
                }
            }),
            &mut state,
        );
        let second_events = project_opencode_stream_events(
            "session-1",
            &json!({
                "type": "message.part.updated",
                "properties": {
                    "part": {
                        "id": "part-text-1",
                        "sessionID": "session-1",
                        "messageID": "message-1",
                        "type": "text",
                        "text": "OpenCode response"
                    }
                }
            }),
            &mut state,
        );

        assert_eq!(first_events.len(), 1);
        assert_eq!(first_events[0].kind, "message.delta");
        assert_eq!(first_events[0].content_delta, "OpenCode ");
        assert_eq!(second_events.len(), 1);
        assert_eq!(second_events[0].kind, "message.delta");
        assert_eq!(second_events[0].content_delta, "response");
    }

    #[test]
    fn opencode_stream_projection_projects_tool_part_updates_to_canonical_tool_events() {
        let mut state = OpencodeStreamProjectionState::default();

        let events = project_opencode_stream_events(
            "session-1",
            &json!({
                "type": "message.part.updated",
                "properties": {
                    "part": {
                        "id": "part-tool-1",
                        "sessionID": "session-1",
                        "messageID": "message-1",
                        "type": "tool",
                        "callID": "tool-command-1",
                        "tool": "bash",
                        "state": {
                            "status": "running",
                            "input": {
                                "command": "pnpm lint",
                                "cwd": "D:/workspace/demo"
                            },
                            "time": {
                                "start": 1710000000000_i64
                            }
                        }
                    }
                }
            }),
            &mut state,
        );

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].kind, "tool.call.requested");
        assert_eq!(events[0].content_delta, "");
        assert_eq!(events[0].native_session_id.as_deref(), Some("session-1"));
        assert_eq!(
            events[0].payload,
            Some(json!({
                "toolName": "run_command",
                "toolCallId": "tool-command-1",
                "toolArguments": {
                    "command": "pnpm lint",
                    "cwd": "D:/workspace/demo",
                    "status": "running",
                    "openCodeState": {
                        "status": "running",
                        "input": {
                            "command": "pnpm lint",
                            "cwd": "D:/workspace/demo"
                        },
                        "time": {
                            "start": 1710000000000_i64
                        }
                    }
                },
                "status": "running",
                "runtimeStatus": "streaming",
                "requiresApproval": false,
                "requiresReply": false
            })),
        );
    }

    #[test]
    fn opencode_stream_projection_emits_approval_required_for_permission_events() {
        let mut state = OpencodeStreamProjectionState::default();

        let events = project_opencode_stream_events(
            "session-1",
            &json!({
                "type": "permission.asked",
                "properties": {
                    "id": "permission-1",
                    "sessionID": "session-1",
                    "permission": "bash",
                    "patterns": ["pnpm test"],
                    "metadata": {
                        "command": "pnpm test"
                    },
                    "always": [],
                    "tool": {
                        "messageID": "message-permission-1",
                        "callID": "tool-permission-1"
                    }
                }
            }),
            &mut state,
        );

        assert_eq!(events.len(), 2);
        assert_eq!(events[0].kind, "tool.call.requested");
        assert_eq!(events[1].kind, "approval.required");
        assert_eq!(
            events[1].payload,
            Some(json!({
                "toolName": "permission_request",
                "toolCallId": "permission-1",
                "toolArguments": {
                    "status": "awaiting_approval",
                    "permissionId": "permission-1",
                    "permission": "bash",
                    "patterns": ["pnpm test"],
                    "metadata": {
                        "command": "pnpm test"
                    },
                    "always": [],
                    "tool": {
                        "messageID": "message-permission-1",
                        "callID": "tool-permission-1"
                    }
                },
                "status": "running",
                "runtimeStatus": "awaiting_approval",
                "requiresApproval": true,
                "requiresReply": false
            })),
        );
    }

    #[test]
    fn opencode_stream_projection_settles_user_question_lifecycle_events() {
        let mut state = OpencodeStreamProjectionState::default();

        let asked_events = project_opencode_stream_events(
            "session-1",
            &json!({
                "type": "question.asked",
                "properties": {
                    "requestID": "question-request-1",
                    "sessionID": "session-1",
                    "questions": [
                        {
                            "header": "Test scope",
                            "question": "Which tests should I run?",
                            "options": [
                                {
                                    "label": "Unit",
                                    "description": "Run unit tests only"
                                }
                            ]
                        }
                    ],
                    "tool": {
                        "messageID": "message-question-1",
                        "callID": "tool-question-1"
                    }
                }
            }),
            &mut state,
        );
        let replied_events = project_opencode_stream_events(
            "session-1",
            &json!({
                "type": "question.replied",
                "properties": {
                    "requestID": "question-request-1",
                    "sessionID": "session-1",
                    "answers": [["Unit"]]
                }
            }),
            &mut state,
        );

        assert_eq!(asked_events.len(), 1);
        assert_eq!(asked_events[0].kind, "tool.call.requested");
        assert_eq!(
            asked_events[0]
                .payload
                .as_ref()
                .and_then(|payload| payload.get("runtimeStatus")),
            Some(&json!("awaiting_user")),
        );
        assert_eq!(replied_events.len(), 1);
        assert_eq!(replied_events[0].kind, "tool.call.completed");
        assert_eq!(
            replied_events[0].payload,
            Some(json!({
                "toolName": "user_question",
                "toolCallId": "question-request-1",
                "toolArguments": {
                    "status": "completed",
                    "runtimeStatus": "awaiting_tool",
                    "requestId": "question-request-1",
                    "sessionID": "session-1",
                    "answer": "Unit",
                    "answers": [["Unit"]]
                },
                "status": "success",
                "runtimeStatus": "awaiting_tool",
                "requiresApproval": false,
                "requiresReply": false
            })),
        );
    }
}
