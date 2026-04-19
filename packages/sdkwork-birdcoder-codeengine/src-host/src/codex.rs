use std::{
    io::Write,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

use serde_json::Value;

use crate::build_native_session_id;

const CODEX_ENGINE_ID: &str = "codex";

#[derive(Clone, Debug, Default)]
pub struct CodexCliTurnRequest {
    pub prompt_text: String,
    pub model_id: Option<String>,
    pub native_session_id: Option<String>,
    pub working_directory: Option<PathBuf>,
    pub full_auto: bool,
    pub skip_git_repo_check: bool,
    pub ephemeral: bool,
}

#[derive(Clone, Debug, Default)]
pub struct CodexCliTurnResult {
    pub assistant_content: String,
    pub native_session_id: Option<String>,
}

pub fn execute_codex_cli_turn(
    request: &CodexCliTurnRequest,
) -> Result<CodexCliTurnResult, String> {
    let mut command = create_codex_cli_command();
    command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::piped());

    let native_session_id = request
        .native_session_id
        .as_deref()
        .map(extract_native_lookup_id_for_codex);

    if native_session_id.is_some() {
        command.arg("exec").arg("resume");
    } else {
        command.arg("exec");
    }

    command.arg("--json");
    if request.full_auto {
        command.arg("--full-auto");
    }
    if request.skip_git_repo_check {
        command.arg("--skip-git-repo-check");
    }
    if request.ephemeral {
        command.arg("--ephemeral");
    }
    if let Some(model_id) = normalize_non_empty_string(request.model_id.as_deref()) {
        command.arg("--model").arg(model_id);
    }
    if native_session_id.is_none() {
        if let Some(directory) = existing_directory(request.working_directory.as_deref()) {
            command.arg("--cd").arg(directory);
            command.current_dir(directory);
        }
    } else if let Some(directory) = existing_directory(request.working_directory.as_deref()) {
        command.current_dir(directory);
    }

    if let Some(native_session_id) = native_session_id.as_deref() {
        command.arg(native_session_id);
    }
    command.arg("-");

    let mut child = command
        .spawn()
        .map_err(|error| format!("spawn codex cli failed: {error}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(request.prompt_text.as_bytes())
            .map_err(|error| format!("write codex cli prompt failed: {error}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("wait for codex cli failed: {error}"))?;
    let stdout = String::from_utf8(output.stdout)
        .map_err(|error| format!("decode codex cli stdout failed: {error}"))?;
    let stderr = String::from_utf8(output.stderr)
        .map_err(|error| format!("decode codex cli stderr failed: {error}"))?;

    let mut assistant_content: Option<String> = None;
    let mut resolved_native_session_id = request.native_session_id.clone();
    let mut turn_error: Option<String> = None;

    for line in stdout
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        let parsed = serde_json::from_str::<Value>(line)
            .map_err(|error| format!("parse codex cli jsonl event failed: {error}; line: {line}"))?;

        if let Some(thread_id) = normalize_value_string(parsed.get("thread_id"))
            .or_else(|| normalize_value_string(parsed.get("threadId")))
        {
            resolved_native_session_id =
                Some(build_native_session_id(CODEX_ENGINE_ID, thread_id.as_str()));
        }

        match parsed.get("type").and_then(Value::as_str) {
            Some("item.updated") | Some("item.completed") => {
                let item = parsed.get("item");
                if item
                    .and_then(|item| item.get("type"))
                    .and_then(Value::as_str)
                    == Some("agent_message")
                {
                    if let Some(text) = item
                        .and_then(|item| item.get("text"))
                        .and_then(Value::as_str)
                    {
                        assistant_content = Some(text.to_owned());
                    }
                }
            }
            Some("turn.failed") => {
                turn_error = parsed
                    .get("error")
                    .and_then(|error| error.get("message"))
                    .and_then(Value::as_str)
                    .map(str::to_owned)
                    .or(turn_error);
            }
            Some("error") => {
                turn_error = parsed
                    .get("message")
                    .and_then(Value::as_str)
                    .map(str::to_owned)
                    .or(turn_error);
            }
            _ => {}
        }
    }

    if let Some(turn_error) = turn_error {
        return Err(format_codex_cli_error(&turn_error));
    }

    if !output.status.success() {
        let detail = stderr.trim();
        return Err(if detail.is_empty() {
            format!("codex cli exited with status {}", output.status)
        } else {
            format!(
                "codex cli exited with status {}: {}",
                output.status,
                format_codex_cli_error(detail)
            )
        });
    }

    let assistant_content =
        assistant_content.ok_or_else(|| "Codex CLI did not return an assistant response.".to_owned())?;

    Ok(CodexCliTurnResult {
        assistant_content,
        native_session_id: resolved_native_session_id,
    })
}

fn create_codex_cli_command() -> Command {
    if cfg!(windows) {
        let mut command = Command::new("cmd");
        command.arg("/C").arg("codex.cmd");
        command
    } else {
        Command::new("codex")
    }
}

fn existing_directory(path: Option<&Path>) -> Option<&Path> {
    let path = path?;
    if path.exists() {
        Some(path)
    } else {
        None
    }
}

fn extract_native_lookup_id_for_codex(session_id: &str) -> String {
    session_id
        .trim()
        .strip_prefix("codex-native:")
        .map(str::to_owned)
        .unwrap_or_else(|| session_id.trim().to_owned())
}

fn format_codex_cli_error(message: &str) -> String {
    let trimmed = message.trim();
    if is_codex_cli_authentication_error(trimmed) {
        "Codex CLI authentication is not configured. BirdCoder reuses your existing Codex auth from `CODEX_HOME` or `~/.codex`; if none is configured, set `OPENAI_API_KEY` or run `codex login --with-api-key`.".to_owned()
    } else if trimmed.is_empty() {
        "Codex CLI turn failed.".to_owned()
    } else {
        trimmed.to_owned()
    }
}

fn is_codex_cli_authentication_error(message: &str) -> bool {
    let normalized = message.trim().to_ascii_lowercase();
    normalized.contains("401 unauthorized")
        || normalized.contains("missing bearer or basic authentication")
        || normalized.contains("login")
        || normalized.contains("api key")
        || normalized.contains("authentication")
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
