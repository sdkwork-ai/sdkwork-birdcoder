use std::{
    collections::BTreeMap,
    io::{BufRead, BufReader},
    path::Path,
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde_json::Value;

use crate::opencode_server_attach_url_env;

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

    let prompt_path = format!("/session/{session_id}/message");
    opencode_request_json(
        "POST",
        prompt_path.as_str(),
        &[],
        Some(Value::Object(request_body)),
        false,
    )?
    .ok_or_else(|| "OpenCode prompt response was empty.".to_owned())
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
        .fold(request, |request, (key, value)| request.query(key, value.as_str()))
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
            let body = response
                .into_string()
                .map_err(|error| format!("read OpenCode response body for {path} failed: {error}"))?;
            if body.trim().is_empty() {
                Ok(Some(Value::Null))
            } else {
                serde_json::from_str::<Value>(&body)
                    .map(Some)
                    .map_err(|error| format!("parse OpenCode response body for {path} failed: {error}"))
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
