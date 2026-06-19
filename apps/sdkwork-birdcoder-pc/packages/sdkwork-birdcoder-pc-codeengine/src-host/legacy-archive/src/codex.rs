use std::{
    env,
    ffi::OsString,
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
};

use serde_json::{Map, Value};

use crate::{
    build_native_session_id, canonicalize_codeengine_provider_tool_name,
    map_codeengine_tool_command_status, map_codeengine_tool_kind,
    map_codeengine_tool_runtime_status, resolve_codeengine_command_text,
    CodeEngineSessionCommandRecord, CodeEngineTurnStreamEventRecord,
};

const CODEX_ENGINE_ID: &str = "codex";

#[derive(Clone, Debug, Default)]
pub struct CodexCliTurnRequest {
    pub prompt_text: String,
    pub model_id: String,
    pub native_session_id: Option<String>,
    pub working_directory: Option<PathBuf>,
    pub approval_policy: Option<String>,
    pub full_auto: bool,
    pub sandbox_mode: Option<String>,
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

    command.args(build_codex_cli_turn_args(
        request,
        native_session_id.as_deref(),
    )?);
    if native_session_id.is_none() {
        if let Some(directory) = existing_directory(request.working_directory.as_deref()) {
            command.current_dir(directory);
        }
    } else if let Some(directory) = existing_directory(request.working_directory.as_deref()) {
        command.current_dir(directory);
    }

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

fn build_codex_cli_turn_args(
    request: &CodexCliTurnRequest,
    native_session_id: Option<&str>,
) -> Result<Vec<OsString>, String> {
    let mut args: Vec<OsString> = vec!["exec".into(), "--json".into()];
    let sandbox_mode = normalize_codex_cli_sandbox_mode(request.sandbox_mode.as_deref())?;
    let approval_policy = normalize_codex_cli_approval_policy(request.approval_policy.as_deref())?;
    let should_expand_full_auto =
        request.full_auto && (sandbox_mode.is_some() || approval_policy.is_some());

    if request.full_auto && !should_expand_full_auto {
        args.push("--full-auto".into());
    }
    if request.skip_git_repo_check {
        args.push("--skip-git-repo-check".into());
    }
    if request.ephemeral {
        args.push("--ephemeral".into());
    }

    let model_id = normalize_codex_cli_model_id(Some(request.model_id.as_str()))
        .ok_or_else(|| "Codex CLI turn requires explicit modelId.".to_owned())?;
    args.push("--model".into());
    args.push(model_id.into());

    if let Some(sandbox_mode) = sandbox_mode.or_else(|| {
        if should_expand_full_auto {
            Some("workspace-write".to_owned())
        } else {
            None
        }
    }) {
        args.push("--sandbox".into());
        args.push(sandbox_mode.into());
    }

    if let Some(approval_policy) = approval_policy.or_else(|| {
        if should_expand_full_auto {
            Some("never".to_owned())
        } else {
            None
        }
    }) {
        args.push("--config".into());
        args.push(format!("approval_policy=\"{approval_policy}\"").into());
    }

    if native_session_id.is_none() {
        if let Some(directory) = existing_directory(request.working_directory.as_deref()) {
            args.push("--cd".into());
            args.push(directory.as_os_str().to_os_string());
        }
    }

    if let Some(native_session_id) = native_session_id {
        args.push("resume".into());
        args.push(native_session_id.into());
    }
    args.push("-".into());

    Ok(args)
}

fn emit_codex_cli_stream_delta_from_line(
    line: &str,
    streamed_assistant_content: &mut String,
    streamed_native_session_id: &mut Option<String>,
    on_event: &mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>,
) -> Result<(), String> {
    let parsed = serde_json::from_str::<Value>(line)
        .map_err(|error| format!("parse codex cli stream event failed: {error}; line: {line}"))?;
    let event_type = parsed.get("type").and_then(Value::as_str);

    if let Some(thread_id) = normalize_value_string(parsed.get("thread_id"))
        .or_else(|| normalize_value_string(parsed.get("threadId")))
    {
        *streamed_native_session_id =
            Some(build_native_session_id(CODEX_ENGINE_ID, thread_id.as_str()));
    }

    match event_type {
        Some("item.started" | "item.updated" | "item.completed") => {
            emit_codex_cli_item_stream_event(
                event_type.unwrap_or_default(),
                parsed.get("item"),
                streamed_assistant_content,
                streamed_native_session_id,
                on_event,
            )?;
        }
        Some("turn.failed" | "error") => {
            if let Some(event) =
                project_codex_cli_failure_stream_event(&parsed, streamed_native_session_id.clone())
            {
                on_event(event)?;
            }
        }
        _ => {}
    }

    Ok(())
}

fn emit_codex_cli_item_stream_event(
    event_type: &str,
    item: Option<&Value>,
    streamed_assistant_content: &mut String,
    streamed_native_session_id: &Option<String>,
    on_event: &mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>,
) -> Result<(), String> {
    if item
        .and_then(|item| item.get("type"))
        .and_then(Value::as_str)
        == Some("agent_message")
    {
        emit_codex_cli_agent_message_delta(
            item,
            streamed_assistant_content,
            streamed_native_session_id,
            on_event,
        )?;
        return Ok(());
    }

    if let Some(event) =
        project_codex_cli_tool_stream_event(event_type, item, streamed_native_session_id.clone())
    {
        on_event(event)?;
    }

    Ok(())
}

fn emit_codex_cli_agent_message_delta(
    item: Option<&Value>,
    streamed_assistant_content: &mut String,
    streamed_native_session_id: &Option<String>,
    on_event: &mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>,
) -> Result<(), String> {
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
        kind: "message.delta".to_owned(),
        role: "assistant".to_owned(),
        content_delta: content_delta.to_owned(),
        payload: None,
        native_session_id: streamed_native_session_id.clone(),
    })
}

fn project_codex_cli_tool_stream_event(
    event_type: &str,
    item: Option<&Value>,
    native_session_id: Option<String>,
) -> Option<CodeEngineTurnStreamEventRecord> {
    let item = item?;
    let item_type = item.get("type").and_then(Value::as_str)?;
    let tool_name = resolve_codex_cli_stream_item_tool_name(item_type, item)?;
    let kind = map_codeengine_tool_kind(tool_name.as_str());
    let status_input = normalize_value_string(item.get("status")).or_else(|| match event_type {
        "item.completed" => Some("completed".to_owned()),
        "item.started" | "item.updated" => Some("running".to_owned()),
        _ => None,
    });
    let exit_code = normalize_value_string(item.get("exit_code"))
        .or_else(|| normalize_value_string(item.get("exitCode")));
    let command_status =
        map_codeengine_tool_command_status(status_input.as_deref(), exit_code.as_deref());
    let runtime_status =
        map_codeengine_tool_runtime_status(kind, status_input.as_deref(), None).to_owned();
    let event_kind = resolve_codex_cli_tool_stream_event_kind(event_type, runtime_status.as_str());

    let mut payload = Map::new();
    payload.insert("toolName".to_owned(), Value::String(tool_name));
    if let Some(tool_call_id) = normalize_value_string(item.get("id")) {
        payload.insert("toolCallId".to_owned(), Value::String(tool_call_id));
    }
    payload.insert(
        "toolArguments".to_owned(),
        build_codex_cli_tool_arguments(item),
    );
    payload.insert("status".to_owned(), Value::String(command_status));
    payload.insert("runtimeStatus".to_owned(), Value::String(runtime_status));
    payload.insert("requiresApproval".to_owned(), Value::Bool(false));
    payload.insert("requiresReply".to_owned(), Value::Bool(false));

    Some(CodeEngineTurnStreamEventRecord {
        kind: event_kind.to_owned(),
        role: "assistant".to_owned(),
        content_delta: String::new(),
        payload: Some(Value::Object(payload)),
        native_session_id,
    })
}

fn resolve_codex_cli_stream_item_tool_name(item_type: &str, item: &Value) -> Option<String> {
    match item_type {
        "command_execution" => Some("run_command".to_owned()),
        "file_change" => Some("apply_patch".to_owned()),
        "mcp_tool_call" => {
            let raw_tool_name = normalize_value_string(item.get("tool"))
                .unwrap_or_else(|| "mcp_tool_call".to_owned());
            Some(canonicalize_codeengine_provider_tool_name(
                CODEX_ENGINE_ID,
                raw_tool_name.as_str(),
                "mcp_tool_call",
            ))
        }
        "web_search" => Some("web_search".to_owned()),
        "todo_list" => Some("write_todo".to_owned()),
        "error" => Some("error".to_owned()),
        _ => None,
    }
}

fn resolve_codex_cli_tool_stream_event_kind(
    event_type: &str,
    runtime_status: &str,
) -> &'static str {
    if matches!(runtime_status, "completed" | "failed" | "terminated")
        || event_type == "item.completed"
    {
        "tool.call.completed"
    } else if event_type == "item.started" {
        "tool.call.requested"
    } else {
        "tool.call.progress"
    }
}

fn build_codex_cli_tool_arguments(item: &Value) -> Value {
    if item.get("type").and_then(Value::as_str) == Some("mcp_tool_call") {
        return normalize_codex_mcp_tool_arguments(item.get("arguments"));
    }

    let Some(object) = item.as_object() else {
        return Value::Object(Map::new());
    };

    let mut arguments = Map::new();
    for (key, value) in object {
        if key == "id" || key == "type" {
            continue;
        }
        arguments.insert(key.clone(), value.clone());
    }
    Value::Object(arguments)
}

fn normalize_codex_mcp_tool_arguments(value: Option<&Value>) -> Value {
    match value {
        Some(Value::String(value)) => serde_json::from_str::<Value>(value)
            .ok()
            .filter(|parsed| parsed.is_object())
            .unwrap_or_else(|| {
                let mut arguments = Map::new();
                arguments.insert("input".to_owned(), Value::String(value.to_owned()));
                Value::Object(arguments)
            }),
        Some(Value::Object(_)) => value.cloned().unwrap_or_else(|| Value::Object(Map::new())),
        Some(value) => {
            let mut arguments = Map::new();
            arguments.insert("input".to_owned(), value.clone());
            Value::Object(arguments)
        }
        None => Value::Object(Map::new()),
    }
}

fn project_codex_cli_failure_stream_event(
    parsed: &Value,
    native_session_id: Option<String>,
) -> Option<CodeEngineTurnStreamEventRecord> {
    let message = parsed
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .or_else(|| parsed.get("message").and_then(Value::as_str))
        .and_then(|value| normalize_non_empty_string(Some(value)))?;
    let mut payload = Map::new();
    payload.insert("errorMessage".to_owned(), Value::String(message));
    payload.insert(
        "runtimeStatus".to_owned(),
        Value::String("failed".to_owned()),
    );
    payload.insert(
        "provider".to_owned(),
        Value::String(CODEX_ENGINE_ID.to_owned()),
    );
    if let Some(source_event_type) = parsed.get("type").and_then(Value::as_str) {
        payload.insert(
            "sourceEventType".to_owned(),
            Value::String(source_event_type.to_owned()),
        );
    }

    Some(CodeEngineTurnStreamEventRecord {
        kind: "turn.failed".to_owned(),
        role: "assistant".to_owned(),
        content_delta: String::new(),
        payload: Some(Value::Object(payload)),
        native_session_id,
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
                    Some(
                        "command_execution" | "file_change" | "mcp_tool_call" | "todo_list"
                        | "web_search",
                    ) => {
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
    let item_type = item.get("type").and_then(Value::as_str)?;
    let tool_name = resolve_codex_cli_stream_item_tool_name(item_type, item)?;
    let tool_arguments = build_codex_cli_tool_arguments(item);
    let kind = map_codeengine_tool_kind(tool_name.as_str());
    let command = resolve_codeengine_command_text(tool_name.as_str(), Some(&tool_arguments), None);
    if command.trim().is_empty() {
        return None;
    }
    let status_input = normalize_value_string(item.get("status")).or_else(|| match item_type {
        "command_execution" => Some("running".to_owned()),
        _ => Some("completed".to_owned()),
    });
    let exit_code = normalize_value_string(item.get("exit_code"))
        .or_else(|| normalize_value_string(item.get("exitCode")));
    let status = map_codeengine_tool_command_status(status_input.as_deref(), exit_code.as_deref());
    let runtime_status =
        map_codeengine_tool_runtime_status(kind, status_input.as_deref(), None).to_owned();
    let output = resolve_codex_command_output(item_type, &tool_arguments);

    Some(CodeEngineSessionCommandRecord {
        command,
        status,
        output,
        kind: Some(kind.to_owned()),
        tool_name: Some(tool_name),
        tool_call_id: normalize_value_string(item.get("id")),
        runtime_status: Some(runtime_status),
        requires_approval: Some(false),
        requires_reply: Some(false),
    })
}

fn resolve_codex_command_output(item_type: &str, tool_arguments: &Value) -> Option<String> {
    match item_type {
        "command_execution" => normalize_value_string(tool_arguments.get("aggregated_output"))
            .or_else(|| normalize_value_string(tool_arguments.get("output")))
            .or_else(|| normalize_value_string(tool_arguments.get("error"))),
        "mcp_tool_call" => normalize_codex_command_output_value(tool_arguments.get("result"))
            .or_else(|| {
                tool_arguments
                    .get("error")
                    .and_then(|error| normalize_value_string(error.get("message")))
            })
            .or_else(|| normalize_codex_command_output_value(Some(tool_arguments))),
        _ => normalize_codex_command_output_value(Some(tool_arguments)),
    }
}

fn normalize_codex_command_output_value(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(value) => normalize_non_empty_string(Some(value.as_str())),
        Value::Number(value) => Some(value.to_string()),
        Value::Bool(value) => Some(value.to_string()),
        Value::Object(object) if object.is_empty() => None,
        Value::Array(array) if array.is_empty() => None,
        value => serde_json::to_string(value).ok(),
    }
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

fn normalize_codex_cli_config_key(value: &str) -> String {
    value
        .trim()
        .chars()
        .filter(|character| !matches!(character, '-' | '_' | ' ' | '\t' | '\n' | '\r'))
        .flat_map(char::to_lowercase)
        .collect()
}

fn normalize_codex_cli_sandbox_mode(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(normalized) = normalize_non_empty_string(value) else {
        return Ok(None);
    };

    match normalize_codex_cli_config_key(normalized.as_str()).as_str() {
        "readonly" => Ok(Some("read-only".to_owned())),
        "workspacewrite" => Ok(Some("workspace-write".to_owned())),
        "dangerfullaccess" | "dangerouslybypassapprovalsandsandbox" | "none" => {
            Ok(Some("danger-full-access".to_owned()))
        }
        _ => Err(format!(
            "Unsupported Codex CLI sandbox mode \"{normalized}\". Expected read-only, workspace-write, or danger-full-access."
        )),
    }
}

fn normalize_codex_cli_approval_policy(value: Option<&str>) -> Result<Option<String>, String> {
    let Some(normalized) = normalize_non_empty_string(value) else {
        return Ok(None);
    };

    match normalize_codex_cli_config_key(normalized.as_str()).as_str() {
        "autoallow" | "never" => Ok(Some("never".to_owned())),
        "onrequest" => Ok(Some("on-request".to_owned())),
        "restricted" | "untrusted" | "unlesstrusted" => Ok(Some("untrusted".to_owned())),
        "releaseonly" | "onfailure" => Ok(Some("on-failure".to_owned())),
        _ => Err(format!(
            "Unsupported Codex CLI approval policy \"{normalized}\". Expected AutoAllow, OnRequest, Restricted, ReleaseOnly, never, untrusted, on-failure, or on-request."
        )),
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
    use super::{
        build_codex_cli_turn_args, emit_codex_cli_stream_delta_from_line,
        parse_codex_cli_turn_output, CodexCliTurnRequest,
    };
    use crate::CodeEngineTurnStreamEventRecord;

    fn collect_codex_stream_events(lines: &[&str]) -> Vec<CodeEngineTurnStreamEventRecord> {
        let mut streamed_assistant_content = String::new();
        let mut streamed_native_session_id = None;
        let mut events = Vec::new();

        for line in lines {
            emit_codex_cli_stream_delta_from_line(
                line,
                &mut streamed_assistant_content,
                &mut streamed_native_session_id,
                &mut |event| {
                    events.push(event);
                    Ok(())
                },
            )
            .expect("project codex stream line");
        }

        events
    }

    fn codex_cli_args_to_strings(
        request: &CodexCliTurnRequest,
        native_session_id: Option<&str>,
    ) -> Vec<String> {
        build_codex_cli_turn_args(request, native_session_id)
            .expect("build codex cli args")
            .into_iter()
            .map(|arg| arg.to_string_lossy().into_owned())
            .collect()
    }

    #[test]
    fn codex_cli_turn_args_preserve_sandbox_and_approval_overrides_on_resume() {
        let args = codex_cli_args_to_strings(
            &CodexCliTurnRequest {
                prompt_text: "continue".to_owned(),
                model_id: "gpt-5.4".to_owned(),
                native_session_id: Some("thread-1".to_owned()),
                working_directory: None,
                approval_policy: Some("OnRequest".to_owned()),
                full_auto: true,
                sandbox_mode: Some("workspace_write".to_owned()),
                skip_git_repo_check: true,
                ephemeral: true,
            },
            Some("thread-1"),
        );

        assert_eq!(
            args,
            vec![
                "exec",
                "--json",
                "--skip-git-repo-check",
                "--ephemeral",
                "--model",
                "gpt-5.4",
                "--sandbox",
                "workspace-write",
                "--config",
                "approval_policy=\"on-request\"",
                "resume",
                "thread-1",
                "-",
            ]
        );
    }

    #[test]
    fn codex_stream_projects_command_execution_lifecycle_events() {
        let events = collect_codex_stream_events(&[
            r#"{"type":"item.started","thread_id":"thread-1","item":{"id":"cmd-1","type":"command_execution","command":"pnpm lint","aggregated_output":"","status":"in_progress"}}"#,
            r#"{"type":"item.updated","thread_id":"thread-1","item":{"id":"cmd-1","type":"command_execution","command":"pnpm lint","aggregated_output":"checking...","status":"in_progress"}}"#,
            r#"{"type":"item.completed","thread_id":"thread-1","item":{"id":"cmd-1","type":"command_execution","command":"pnpm lint","aggregated_output":"ok","exit_code":0,"status":"completed"}}"#,
        ]);

        assert_eq!(events.len(), 3);
        assert_eq!(events[0].kind, "tool.call.requested");
        assert_eq!(events[1].kind, "tool.call.progress");
        assert_eq!(events[2].kind, "tool.call.completed");

        let first_payload = events[0].payload.as_ref().expect("first payload");
        assert_eq!(first_payload["toolName"], "run_command");
        assert_eq!(first_payload["toolCallId"], "cmd-1");
        assert_eq!(first_payload["toolArguments"]["command"], "pnpm lint");
        assert_eq!(first_payload["status"], "running");
        assert_eq!(first_payload["runtimeStatus"], "streaming");
        assert_eq!(events[0].native_session_id.as_deref(), Some("thread-1"));

        let completed_payload = events[2].payload.as_ref().expect("completed payload");
        assert_eq!(
            completed_payload["toolArguments"]["aggregated_output"],
            "ok"
        );
        assert_eq!(completed_payload["toolArguments"]["exit_code"], 0);
        assert_eq!(completed_payload["status"], "success");
        assert_eq!(completed_payload["runtimeStatus"], "completed");
    }

    #[test]
    fn codex_stream_projects_turn_failed_and_error_events() {
        let events = collect_codex_stream_events(&[
            r#"{"type":"turn.failed","thread_id":"thread-1","error":{"message":"quota exceeded"}}"#,
            r#"{"type":"error","thread_id":"thread-1","message":"stream crashed"}"#,
        ]);

        assert_eq!(events.len(), 2);
        assert!(events.iter().all(|event| event.kind == "turn.failed"));
        assert_eq!(
            events[0].payload.as_ref().expect("turn failed payload")["errorMessage"],
            "quota exceeded"
        );
        assert_eq!(
            events[1].payload.as_ref().expect("error payload")["errorMessage"],
            "stream crashed"
        );
        assert!(events.iter().all(|event| {
            event
                .payload
                .as_ref()
                .and_then(|payload| payload.get("runtimeStatus"))
                == Some(&serde_json::json!("failed"))
        }));
    }

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

    #[test]
    fn parse_codex_cli_turn_output_preserves_official_thread_tool_items() {
        let output = r#"
{"type":"item.completed","item":{"id":"patch-1","type":"file_change","changes":[{"path":"src/App.tsx","kind":"update"}],"status":"completed"}}
{"type":"item.completed","item":{"id":"todo-1","type":"todo_list","items":[{"text":"Run regression contracts","status":"completed"}],"status":"completed"}}
{"type":"item.completed","item":{"id":"mcp-1","type":"mcp_tool_call","tool":"shell-command","arguments":{"command":"pnpm test","requestId":101777208078558035},"status":"completed"}}
{"type":"item.completed","item":{"id":"search-1","type":"web_search","query":"BirdCoder stream event standard"}}
"#;

        let result =
            parse_codex_cli_turn_output(output, None).expect("parse codex thread tool items");
        let commands = result.commands.expect("commands");

        assert_eq!(commands.len(), 4);
        assert_eq!(commands[0].command, "apply_patch: src/App.tsx");
        assert_eq!(commands[0].kind.as_deref(), Some("file_change"));
        assert_eq!(commands[0].tool_name.as_deref(), Some("apply_patch"));
        assert_eq!(commands[0].tool_call_id.as_deref(), Some("patch-1"));
        assert_eq!(commands[0].runtime_status.as_deref(), Some("completed"));
        assert_eq!(commands[1].command, "write_todo");
        assert_eq!(commands[1].kind.as_deref(), Some("task"));
        assert_eq!(commands[1].tool_name.as_deref(), Some("write_todo"));
        assert_eq!(commands[2].command, "pnpm test");
        assert_eq!(commands[2].kind.as_deref(), Some("command"));
        assert_eq!(commands[2].tool_name.as_deref(), Some("run_command"));
        assert_eq!(
            commands[2].output.as_deref(),
            Some(r#"{"command":"pnpm test","requestId":101777208078558035}"#)
        );
        assert_eq!(commands[3].command, "BirdCoder stream event standard");
        assert_eq!(commands[3].kind.as_deref(), Some("tool"));
        assert_eq!(commands[3].tool_name.as_deref(), Some("web_search"));
    }
}
