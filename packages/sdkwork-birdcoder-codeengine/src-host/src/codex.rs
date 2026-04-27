use std::{
    env,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
};

use serde_json::Value;

use crate::{
    build_native_session_id, map_codeengine_tool_command_status, CodeEngineSessionCommandRecord,
    CodeEngineTurnStreamEventRecord,
};

const CODEX_ENGINE_ID: &str = "codex";

#[derive(Clone, Debug, Default)]
pub struct CodexCliTurnRequest {
    pub prompt_text: String,
    pub model_id: String,
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
    pub commands: Option<Vec<CodeEngineSessionCommandRecord>>,
}

pub fn execute_codex_cli_turn(request: &CodexCliTurnRequest) -> Result<CodexCliTurnResult, String> {
    execute_codex_cli_turn_inner(request, None)
}

pub fn execute_codex_cli_turn_with_events(
    request: &CodexCliTurnRequest,
    on_event: &mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>,
) -> Result<CodexCliTurnResult, String> {
    execute_codex_cli_turn_inner(request, Some(on_event))
}

fn execute_codex_cli_turn_inner(
    request: &CodexCliTurnRequest,
    mut on_event: Option<&mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>>,
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
    let model_id = normalize_codex_cli_model_id(Some(request.model_id.as_str()))
        .ok_or_else(|| "Codex CLI turn requires explicit modelId.".to_owned())?;
    command.arg("--model").arg(model_id);
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
    let stdout_pipe = child
        .stdout
        .take()
        .ok_or_else(|| "Codex CLI stdout pipe was not available.".to_owned())?;
    let stderr_pipe = child
        .stderr
        .take()
        .ok_or_else(|| "Codex CLI stderr pipe was not available.".to_owned())?;
    let stderr_reader = thread::spawn(move || {
        let mut stderr = String::new();
        let _ = BufReader::new(stderr_pipe).read_to_string(&mut stderr);
        stderr
    });

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(request.prompt_text.as_bytes())
            .map_err(|error| format!("write codex cli prompt failed: {error}"))?;
    }

    let mut stdout = String::new();
    let mut streamed_assistant_content = String::new();
    let mut streamed_native_session_id = native_session_id.clone();
    let stdout_reader = BufReader::new(stdout_pipe);
    for line in stdout_reader.lines() {
        let line = line.map_err(|error| format!("read codex cli stdout failed: {error}"))?;
        stdout.push_str(line.as_str());
        stdout.push('\n');
        if let Some(callback) = on_event.as_deref_mut() {
            emit_codex_cli_stream_delta_from_line(
                line.as_str(),
                &mut streamed_assistant_content,
                &mut streamed_native_session_id,
                callback,
            )?;
        }
    }

    let status = child
        .wait()
        .map_err(|error| format!("wait for codex cli failed: {error}"))?;
    let stderr = stderr_reader
        .join()
        .unwrap_or_else(|_| "Codex CLI stderr reader panicked.".to_owned());

    let parsed_turn = parse_codex_cli_turn_output(stdout.as_str(), native_session_id.clone())?;

    if let Some(turn_error) = parsed_turn.turn_error {
        return Err(format_codex_cli_error(&turn_error));
    }

    if !status.success() {
        let detail = stderr.trim();
        return Err(if detail.is_empty() {
            format!("codex cli exited with status {}", status)
        } else {
            format!(
                "codex cli exited with status {}: {}",
                status,
                format_codex_cli_error(detail)
            )
        });
    }

    let assistant_content = parsed_turn.assistant_content;

    Ok(CodexCliTurnResult {
        assistant_content,
        native_session_id: parsed_turn.native_session_id,
        commands: parsed_turn.commands,
    })
}

fn emit_codex_cli_stream_delta_from_line(
    line: &str,
    streamed_assistant_content: &mut String,
    streamed_native_session_id: &mut Option<String>,
    on_event: &mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>,
) -> Result<(), String> {
    let parsed = serde_json::from_str::<Value>(line)
        .map_err(|error| format!("parse codex cli stream event failed: {error}; line: {line}"))?;

    if let Some(thread_id) = normalize_value_string(parsed.get("thread_id"))
        .or_else(|| normalize_value_string(parsed.get("threadId")))
    {
        *streamed_native_session_id =
            Some(build_native_session_id(CODEX_ENGINE_ID, thread_id.as_str()));
    }

    if !matches!(
        parsed.get("type").and_then(Value::as_str),
        Some("item.updated") | Some("item.completed")
    ) {
        return Ok(());
    }

    let item = parsed.get("item");
    if item
        .and_then(|item| item.get("type"))
        .and_then(Value::as_str)
        != Some("agent_message")
    {
        return Ok(());
    }

    let Some(next_content) = item
        .and_then(|item| item.get("text"))
        .and_then(Value::as_str)
    else {
        return Ok(());
    };

    if next_content == streamed_assistant_content {
        return Ok(());
    }

    if !streamed_assistant_content.is_empty()
        && !next_content.starts_with(streamed_assistant_content.as_str())
    {
        *streamed_assistant_content = next_content.to_owned();
        return Ok(());
    }

    let content_delta = &next_content[streamed_assistant_content.len()..];
    *streamed_assistant_content = next_content.to_owned();
    if content_delta.is_empty() {
        return Ok(());
    }

    on_event(CodeEngineTurnStreamEventRecord {
        role: "assistant".to_owned(),
        content_delta: content_delta.to_owned(),
        native_session_id: streamed_native_session_id.clone(),
    })
}

#[derive(Clone, Debug, Default)]
struct ParsedCodexCliTurnOutput {
    assistant_content: String,
    native_session_id: Option<String>,
    commands: Option<Vec<CodeEngineSessionCommandRecord>>,
    turn_error: Option<String>,
}

fn parse_codex_cli_turn_output(
    stdout: &str,
    initial_native_session_id: Option<String>,
) -> Result<ParsedCodexCliTurnOutput, String> {
    let mut assistant_content: Option<String> = None;
    let mut resolved_native_session_id = initial_native_session_id;
    let mut turn_error: Option<String> = None;
    let mut commands = Vec::new();

    for line in stdout
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        let parsed = serde_json::from_str::<Value>(line).map_err(|error| {
            format!("parse codex cli jsonl event failed: {error}; line: {line}")
        })?;

        if let Some(thread_id) = normalize_value_string(parsed.get("thread_id"))
            .or_else(|| normalize_value_string(parsed.get("threadId")))
        {
            resolved_native_session_id =
                Some(build_native_session_id(CODEX_ENGINE_ID, thread_id.as_str()));
        }

        match parsed.get("type").and_then(Value::as_str) {
            Some("item.updated") | Some("item.completed") => {
                let item = parsed.get("item");
                match item
                    .and_then(|item| item.get("type"))
                    .and_then(Value::as_str)
                {
                    Some("agent_message") => {
                        if let Some(text) = item
                            .and_then(|item| item.get("text"))
                            .and_then(Value::as_str)
                        {
                            assistant_content = Some(text.to_owned());
                        }
                    }
                    Some("command_execution") => {
                        if let Some(command) = build_codex_command_record(item) {
                            commands.push(command);
                        }
                    }
                    _ => {}
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

    let assistant_content = match assistant_content {
        Some(assistant_content) => assistant_content,
        None if turn_error.is_some() => String::new(),
        None if !commands.is_empty() => String::new(),
        None => return Err("Codex CLI did not return an assistant response.".to_owned()),
    };

    Ok(ParsedCodexCliTurnOutput {
        assistant_content,
        native_session_id: resolved_native_session_id,
        commands: if commands.is_empty() {
            None
        } else {
            Some(commands)
        },
        turn_error,
    })
}

fn build_codex_command_record(item: Option<&Value>) -> Option<CodeEngineSessionCommandRecord> {
    let item = item?;
    let command = normalize_value_string(item.get("command"))
        .or_else(|| normalize_value_string(item.get("cmd")))
        .or_else(|| normalize_value_string(item.get("name")))?;
    let status = map_codeengine_tool_command_status(
        normalize_value_string(item.get("status")).as_deref(),
        normalize_value_string(item.get("exit_code"))
            .or_else(|| normalize_value_string(item.get("exitCode")))
            .as_deref(),
    );
    let output = normalize_value_string(item.get("aggregated_output"))
        .or_else(|| normalize_value_string(item.get("output")))
        .or_else(|| normalize_value_string(item.get("error")));

    Some(CodeEngineSessionCommandRecord {
        command,
        status,
        output,
        ..Default::default()
    })
}

fn create_codex_cli_command() -> Command {
    if cfg!(windows) {
        create_windows_cli_command("codex")
    } else {
        Command::new("codex")
    }
}

fn create_windows_cli_command(base_name: &str) -> Command {
    if let Some(resolved_path) = resolve_windows_cli_path(base_name) {
        return create_windows_command_for_resolved_path(resolved_path.as_path());
    }

    let mut command = Command::new("cmd");
    command.arg("/C").arg(format!("{base_name}.cmd"));
    command
}

fn create_windows_command_for_resolved_path(path: &Path) -> Command {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.to_ascii_lowercase())
        .as_deref()
    {
        Some("cmd") | Some("bat") => {
            let mut command = Command::new("cmd");
            command.arg("/C").arg(path);
            command
        }
        Some("ps1") => {
            let mut command = Command::new("powershell");
            command
                .arg("-NoProfile")
                .arg("-ExecutionPolicy")
                .arg("Bypass")
                .arg("-File")
                .arg(path);
            command
        }
        _ => Command::new(path),
    }
}

fn resolve_windows_cli_path(base_name: &str) -> Option<PathBuf> {
    let candidate_names = [
        format!("{base_name}.cmd"),
        format!("{base_name}.bat"),
        format!("{base_name}.ps1"),
        format!("{base_name}.exe"),
        base_name.to_owned(),
    ];

    for directory in collect_windows_cli_search_dirs() {
        for candidate_name in candidate_names.iter() {
            let candidate_path = directory.join(candidate_name);
            if candidate_path.is_file() {
                return Some(candidate_path);
            }
        }
    }

    None
}

fn collect_windows_cli_search_dirs() -> Vec<PathBuf> {
    let mut directories = Vec::new();

    if let Some(path) = env::var_os("PATH") {
        for directory in env::split_paths(&path) {
            push_unique_existing_directory(&mut directories, directory);
        }
    }

    if let Some(directory) = env::var_os("NVM_SYMLINK").map(PathBuf::from) {
        push_unique_existing_directory(&mut directories, directory);
    }

    if let Some(directory) = env::var_os("APPDATA").map(|value| PathBuf::from(value).join("npm")) {
        push_unique_existing_directory(&mut directories, directory);
    }

    if let Some(directory) = env::var_os("LOCALAPPDATA").map(|value| {
        PathBuf::from(value)
            .join("Microsoft")
            .join("WinGet")
            .join("Links")
    }) {
        push_unique_existing_directory(&mut directories, directory);
    }

    if let Some(directory) =
        env::var_os("ProgramFiles").map(|value| PathBuf::from(value).join("nodejs"))
    {
        push_unique_existing_directory(&mut directories, directory);
    }

    if let Some(directory) =
        env::var_os("ProgramFiles(x86)").map(|value| PathBuf::from(value).join("nodejs"))
    {
        push_unique_existing_directory(&mut directories, directory);
    }

    directories
}

fn push_unique_existing_directory(directories: &mut Vec<PathBuf>, directory: PathBuf) {
    if !directory.is_dir() {
        return;
    }

    if directories.iter().any(|existing| existing == &directory) {
        return;
    }

    directories.push(directory);
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

fn normalize_codex_cli_model_id(value: Option<&str>) -> Option<String> {
    let normalized = normalize_non_empty_string(value)?;
    if normalized.eq_ignore_ascii_case("codex") {
        None
    } else {
        Some(normalized)
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
    use super::parse_codex_cli_turn_output;

    #[test]
    fn parse_codex_cli_turn_output_preserves_command_execution_items() {
        let output = r#"
{"type":"item.completed","item":{"id":"cmd-1","type":"command_execution","command":"pnpm lint","aggregated_output":"ok","status":"completed"}}
{"type":"item.completed","item":{"id":"msg-1","type":"agent_message","text":"Done."}}
"#;

        let result = parse_codex_cli_turn_output(output, None).expect("parse codex turn output");

        assert_eq!(result.assistant_content, "Done.");
        assert_eq!(
            result
                .commands
                .expect("commands")
                .into_iter()
                .map(|command| { (command.command, command.status, command.output) })
                .collect::<Vec<_>>(),
            vec![(
                "pnpm lint".to_owned(),
                "success".to_owned(),
                Some("ok".to_owned())
            )],
        );
    }

    #[test]
    fn parse_codex_cli_turn_output_accepts_command_only_turns() {
        let output = r#"
{"type":"item.completed","item":{"id":"cmd-1","type":"command_execution","command":"pnpm test","aggregated_output":"ok","status":"completed"}}
"#;

        let result =
            parse_codex_cli_turn_output(output, None).expect("parse command-only codex turn");

        assert_eq!(result.assistant_content, "");
        assert_eq!(
            result
                .commands
                .expect("commands")
                .into_iter()
                .map(|command| { (command.command, command.status, command.output) })
                .collect::<Vec<_>>(),
            vec![(
                "pnpm test".to_owned(),
                "success".to_owned(),
                Some("ok".to_owned())
            )],
        );
    }
}
