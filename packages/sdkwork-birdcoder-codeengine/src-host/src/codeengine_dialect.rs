use std::collections::BTreeMap;

use serde_json::Value;

const CODEENGINE_COMMAND_TEXT_ARGUMENT_KEYS: &[&str] = &[
    "command",
    "cmd",
    "shell",
    "script",
    "query",
    "path",
    "filePath",
    "file_path",
    "filename",
    "targetFile",
    "target_file",
];

const CODEENGINE_PATH_ARGUMENT_KEYS: &[&str] = &[
    "path",
    "filePath",
    "file_path",
    "filename",
    "targetFile",
    "target_file",
];

const CODEENGINE_PROMPT_ARGUMENT_KEYS: &[&str] = &["question", "prompt", "title", "header"];

const CODEENGINE_TOOL_CALL_ID_KEYS: &[&str] = &[
    "toolCallId",
    "toolCallID",
    "tool_call_id",
    "callId",
    "callID",
    "call_id",
    "toolUseId",
    "toolUseID",
    "tool_use_id",
    "id",
];

const CODEENGINE_USER_QUESTION_ID_KEYS: &[&str] = &[
    "questionId",
    "questionID",
    "question_id",
    "requestId",
    "requestID",
    "request_id",
    "promptId",
    "promptID",
    "prompt_id",
    "id",
];

const CODEENGINE_APPROVAL_ID_KEYS: &[&str] = &[
    "approvalId",
    "approvalID",
    "approval_id",
    "permissionId",
    "permissionID",
    "permission_id",
    "requestId",
    "requestID",
    "request_id",
    "id",
];

const CODEENGINE_CHECKPOINT_ID_KEYS: &[&str] = &["checkpointId", "checkpointID", "checkpoint_id"];

const CODEENGINE_PERMISSION_ROOT_TARGET_KEYS: &[&str] = &[
    "title",
    "tool",
    "command",
    "path",
    "filePath",
    "file_path",
    "filename",
    "targetFile",
    "target_file",
    "permission",
    "pattern",
];

const CODEENGINE_PERMISSION_NAMED_TARGET_KEYS: &[&str] = &["title", "command", "tool", "name"];

const CODEENGINE_PERMISSION_REQUEST_ARGUMENT_KEYS: &[&str] = &[
    "command",
    "cmd",
    "path",
    "filePath",
    "file_path",
    "filename",
    "targetFile",
    "target_file",
];

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct CodeEngineCommandInteractionState {
    pub is_running: bool,
    pub requires_approval: bool,
    pub requires_reply: bool,
}

pub fn normalize_codeengine_dialect_key(value: &str) -> Option<String> {
    let normalized = value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_whitespace() || character == '-' {
                '_'
            } else {
                character
            }
        })
        .collect::<String>();

    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

pub fn map_codeengine_tool_kind(tool_name: &str) -> &'static str {
    match normalize_codeengine_dialect_key(tool_name).as_deref() {
        Some(
            "ask_question" | "ask_user" | "input_request" | "prompt_user" | "question"
            | "user_input" | "user_question",
        ) => "user_question",
        Some(
            "approval"
            | "approval_request"
            | "authorization"
            | "authorization_request"
            | "confirm"
            | "confirmation"
            | "confirmation_request"
            | "permission"
            | "permission_request"
            | "request_approval"
            | "request_permission",
        ) => "approval",
        Some(
            "bash" | "command" | "command_execution" | "execute_command" | "pty_exec"
            | "run_command" | "shell" | "shell_command",
        ) => "command",
        Some(
            "apply_patch" | "create_file" | "edit_file" | "multi_edit" | "replace_file"
            | "str_replace_editor" | "write_file",
        ) => "file_change",
        Some("todo" | "todowrite" | "update_todo" | "write_todo") => "task",
        _ => "tool",
    }
}

pub fn canonicalize_codeengine_tool_name(tool_name: &str) -> String {
    let normalized_tool_name = normalize_codeengine_dialect_key(tool_name);
    match map_codeengine_tool_kind(tool_name) {
        "user_question" => return "user_question".to_owned(),
        "approval" => return "permission_request".to_owned(),
        _ => {}
    }

    match normalized_tool_name.as_deref() {
        Some(
            "bash" | "command" | "command_execution" | "execute_command" | "shell"
            | "shell_command",
        ) => "run_command".to_owned(),
        Some("todo" | "todowrite" | "todo_write" | "update_todo") => "write_todo".to_owned(),
        Some("todoread" | "todo_read") => "read_todo".to_owned(),
        _ => tool_name.trim().to_owned(),
    }
}

fn resolve_codeengine_provider_tool_name_alias(
    provider: &str,
    tool_name: &str,
) -> Option<&'static str> {
    let provider_key = normalize_codeengine_dialect_key(provider)?;
    let tool_name_key = normalize_codeengine_dialect_key(tool_name)?;

    match provider_key.as_str() {
        "claude" | "claude_code" => match tool_name_key.as_str() {
            "bash" => Some("run_command"),
            "edit" => Some("edit_file"),
            "exit_plan_mode" | "exitplanmode" => Some("exit_plan_mode"),
            "glob" => Some("search_code"),
            "grep" => Some("grep_code"),
            "ls" => Some("list_files"),
            "multi_edit" | "multiedit" => Some("multi_edit"),
            "notebook_edit" | "notebookedit" => Some("edit_notebook"),
            "read" => Some("read_file"),
            "task" => Some("task"),
            "todo_read" | "todoread" => Some("read_todo"),
            "todo_write" | "todowrite" => Some("write_todo"),
            "web_fetch" | "webfetch" => Some("web_fetch"),
            "web_search" | "websearch" => Some("web_search"),
            "write" => Some("write_file"),
            _ => None,
        },
        "codex" => match tool_name_key.as_str() {
            "command_execution" | "execute_command" => Some("run_command"),
            "file_change" => Some("apply_patch"),
            "todo_list" => Some("write_todo"),
            _ => None,
        },
        _ => None,
    }
}

pub fn canonicalize_codeengine_provider_tool_name(
    provider: &str,
    tool_name: &str,
    fallback_tool_name: &str,
) -> String {
    let fallback_tool_name = match fallback_tool_name.trim() {
        "" => "tool_use",
        trimmed => trimmed,
    };
    let raw_tool_name = tool_name.trim();
    if raw_tool_name.is_empty() {
        return fallback_tool_name.to_owned();
    }

    let provider_tool_name = resolve_codeengine_provider_tool_name_alias(provider, raw_tool_name)
        .unwrap_or(raw_tool_name);
    canonicalize_codeengine_tool_name(provider_tool_name)
}

fn normalize_codeengine_json_string(value: Option<&Value>) -> Option<String> {
    let value = value?.as_str()?.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_owned())
    }
}

fn read_codeengine_record_string(record: Option<&Value>, field_names: &[&str]) -> Option<String> {
    let record = record?;
    for field_name in field_names {
        if let Some(value) = normalize_codeengine_json_string(record.get(*field_name)) {
            return Some(value);
        }
    }

    None
}

fn normalize_codeengine_identifier_value(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(value) => normalize_codeengine_string_identifier(Some(value.as_str())),
        Value::Number(value) => Some(value.to_string()),
        _ => None,
    }
}

fn normalize_codeengine_string_identifier(value: Option<&str>) -> Option<String> {
    let value = value?.trim();
    if value.is_empty() {
        None
    } else {
        Some(value.to_owned())
    }
}

fn read_codeengine_map_identifier(
    record: Option<&BTreeMap<String, String>>,
    field_name: &str,
) -> Option<String> {
    normalize_codeengine_string_identifier(record?.get(field_name).map(String::as_str))
}

fn read_codeengine_value_identifier(record: Option<&Value>, field_name: &str) -> Option<String> {
    normalize_codeengine_identifier_value(record?.get(field_name))
}

fn read_codeengine_identity_from_records(
    field_names: &[&str],
    map_records: &[Option<&BTreeMap<String, String>>],
    value_records: &[Option<&Value>],
) -> Option<String> {
    for field_name in field_names {
        for record in map_records {
            if let Some(value) = read_codeengine_map_identifier(*record, field_name) {
                return Some(value);
            }
        }
        for record in value_records {
            if let Some(value) = read_codeengine_value_identifier(*record, field_name) {
                return Some(value);
            }
        }
    }

    None
}

pub fn resolve_codeengine_tool_call_id(
    payload: Option<&BTreeMap<String, String>>,
    tool_arguments: Option<&Value>,
    checkpoint_state: Option<&BTreeMap<String, String>>,
) -> Option<String> {
    read_codeengine_identity_from_records(
        CODEENGINE_TOOL_CALL_ID_KEYS,
        &[payload, checkpoint_state],
        &[tool_arguments],
    )
}

pub fn resolve_codeengine_user_question_id(
    payload: Option<&BTreeMap<String, String>>,
    tool_arguments: Option<&Value>,
    checkpoint_state: Option<&BTreeMap<String, String>>,
    tool_call_id: Option<&str>,
) -> Option<String> {
    read_codeengine_identity_from_records(
        CODEENGINE_USER_QUESTION_ID_KEYS,
        &[payload, checkpoint_state],
        &[tool_arguments],
    )
    .or_else(|| normalize_codeengine_string_identifier(tool_call_id))
    .or_else(|| resolve_codeengine_tool_call_id(payload, tool_arguments, checkpoint_state))
}

pub fn resolve_codeengine_approval_id(
    payload: Option<&BTreeMap<String, String>>,
    tool_arguments: Option<&Value>,
    checkpoint_state: Option<&BTreeMap<String, String>>,
) -> Option<String> {
    read_codeengine_identity_from_records(
        CODEENGINE_APPROVAL_ID_KEYS,
        &[payload, checkpoint_state],
        &[tool_arguments],
    )
}

pub fn resolve_codeengine_checkpoint_id(
    payload: Option<&BTreeMap<String, String>>,
    tool_arguments: Option<&Value>,
    checkpoint_state: Option<&BTreeMap<String, String>>,
) -> Option<String> {
    read_codeengine_identity_from_records(
        CODEENGINE_CHECKPOINT_ID_KEYS,
        &[payload, checkpoint_state],
        &[tool_arguments],
    )
}

fn resolve_codeengine_prompt_text(args: Option<&Value>) -> Option<String> {
    if let Some(prompt) = read_codeengine_record_string(args, CODEENGINE_PROMPT_ARGUMENT_KEYS) {
        return Some(prompt);
    }

    let questions = args
        .and_then(|value| value.get("questions"))
        .and_then(Value::as_array)?;
    questions.iter().find_map(|question| {
        read_codeengine_record_string(Some(question), CODEENGINE_PROMPT_ARGUMENT_KEYS)
    })
}

fn resolve_codeengine_permission_request_text(args: Option<&Value>) -> String {
    let details = args.and_then(|value| value.get("details"));
    let metadata = args.and_then(|value| value.get("metadata"));
    let request = args.and_then(|value| value.get("request"));
    let request_args = request.and_then(|value| value.get("args"));
    let target = read_codeengine_record_string(details, CODEENGINE_PERMISSION_NAMED_TARGET_KEYS)
        .or_else(|| {
            read_codeengine_record_string(metadata, CODEENGINE_PERMISSION_NAMED_TARGET_KEYS)
        })
        .or_else(|| read_codeengine_record_string(args, CODEENGINE_PERMISSION_ROOT_TARGET_KEYS))
        .or_else(|| {
            read_codeengine_record_string(request_args, CODEENGINE_PERMISSION_REQUEST_ARGUMENT_KEYS)
        })
        .or_else(|| read_codeengine_record_string(request, &["name", "tool"]));

    target
        .map(|target| format!("Permission required: {target}"))
        .unwrap_or_else(|| "Permission required".to_owned())
}

fn resolve_codeengine_change_paths(args: Option<&Value>) -> Vec<String> {
    args.and_then(|value| value.get("changes"))
        .and_then(Value::as_array)
        .map(|changes| {
            changes
                .iter()
                .filter_map(|change| {
                    read_codeengine_record_string(Some(change), CODEENGINE_PATH_ARGUMENT_KEYS)
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

pub fn resolve_codeengine_command_text(
    tool_name: &str,
    args: Option<&Value>,
    fallback_arguments: Option<&str>,
) -> String {
    let tool_name = tool_name.trim();
    let tool_name = if tool_name.is_empty() {
        "tool"
    } else {
        tool_name
    };
    let change_paths = resolve_codeengine_change_paths(args);
    if !change_paths.is_empty() {
        return format!("{tool_name}: {}", change_paths.join(", "));
    }

    match map_codeengine_tool_kind(tool_name) {
        "approval" => return resolve_codeengine_permission_request_text(args),
        "user_question" => {
            if let Some(prompt) = resolve_codeengine_prompt_text(args) {
                return prompt;
            }
            if let Some(answer) = read_codeengine_record_string(args, &["answer"]) {
                return answer;
            }
        }
        _ => {
            if let Some(prompt) = resolve_codeengine_prompt_text(args) {
                return prompt;
            }
        }
    }

    if let Some(command) =
        read_codeengine_record_string(args, CODEENGINE_COMMAND_TEXT_ARGUMENT_KEYS)
    {
        return command;
    }

    let fallback_arguments = fallback_arguments.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });
    fallback_arguments
        .map(|arguments| format!("{tool_name} {arguments}"))
        .unwrap_or_else(|| tool_name.to_owned())
}

pub fn normalize_codeengine_runtime_status(value: &str) -> Option<&'static str> {
    match normalize_codeengine_dialect_key(value).as_deref() {
        Some("active" | "busy") => Some("streaming"),
        Some("archived") => Some("completed"),
        Some("abort" | "aborted" | "cancelled" | "canceled" | "terminated") => Some("terminated"),
        Some("awaiting_approval" | "needs_approval" | "pending_approval" | "permission_asked") => {
            Some("awaiting_approval")
        }
        Some("awaiting_tool") => Some("awaiting_tool"),
        Some(
            "awaiting_user"
            | "needs_user"
            | "pending_user"
            | "user_input_required"
            | "waiting_for_user",
        ) => Some("awaiting_user"),
        Some("complete" | "completed" | "done" | "success" | "succeeded") => Some("completed"),
        Some("draft") => Some("ready"),
        Some("failed" | "failure") => Some("failed"),
        Some("initializing") => Some("initializing"),
        Some("paused" | "retry") => Some("failed"),
        Some("ready") => Some("ready"),
        Some("running" | "started") => Some("streaming"),
        Some("streaming") => Some("streaming"),
        _ => None,
    }
}

pub fn map_codeengine_session_runtime_status(status: Option<&str>) -> &'static str {
    match status {
        None => "completed",
        Some(value) => normalize_codeengine_runtime_status(value).unwrap_or("ready"),
    }
}

pub fn map_codeengine_session_status_from_runtime(runtime_status: &str) -> &'static str {
    match normalize_codeengine_runtime_status(runtime_status) {
        Some("completed" | "terminated") => "completed",
        Some("failed") => "paused",
        _ => "active",
    }
}

pub fn normalize_codeengine_tool_lifecycle_status(value: &str) -> Option<&'static str> {
    match normalize_codeengine_dialect_key(value).as_deref() {
        Some("abort" | "aborted" | "cancelled" | "canceled" | "terminated") => Some("cancelled"),
        Some(
            "accept" | "accepted" | "allow" | "allowed" | "approve" | "approved" | "complete"
            | "completed" | "done" | "finished" | "grant" | "granted" | "ok" | "passed" | "success"
            | "succeeded" | "yes",
        ) => Some("completed"),
        Some("awaiting_approval" | "needs_approval" | "pending_approval" | "permission_asked") => {
            Some("awaiting_approval")
        }
        Some(
            "awaiting_user"
            | "needs_user"
            | "pending_user"
            | "user_input_required"
            | "waiting_for_user",
        ) => Some("awaiting_user"),
        Some(
            "awaiting" | "awaiting_tool" | "executing" | "in_progress" | "pending" | "processing"
            | "queued" | "requested" | "running" | "started",
        ) => Some("running"),
        Some(
            "blocked" | "decline" | "declined" | "deny" | "denied" | "disallow" | "disallowed"
            | "error" | "errored" | "failed" | "failure" | "no" | "reject" | "rejected",
        ) => Some("failed"),
        _ => None,
    }
}

fn status_transitions_to_awaiting_tool(status: Option<&str>) -> bool {
    matches!(
        status.and_then(normalize_codeengine_runtime_status),
        Some("awaiting_tool")
    ) || matches!(
        status.and_then(normalize_codeengine_tool_lifecycle_status),
        Some("completed")
    )
}

fn status_transitions_to_failed(status: Option<&str>) -> bool {
    matches!(
        status.and_then(normalize_codeengine_runtime_status),
        Some("failed" | "terminated")
    ) || matches!(
        status.and_then(normalize_codeengine_tool_lifecycle_status),
        Some("failed" | "cancelled")
    )
}

pub fn resolve_codeengine_user_question_runtime_status(
    status: Option<&str>,
    runtime_status: Option<&str>,
    has_answer: bool,
) -> &'static str {
    let explicit_runtime_status = runtime_status.and_then(normalize_codeengine_runtime_status);
    if explicit_runtime_status == Some("completed")
        && (has_answer || status_transitions_to_awaiting_tool(status))
    {
        return "awaiting_tool";
    }
    if let Some(runtime_status) = explicit_runtime_status {
        return runtime_status;
    }
    if has_answer || status_transitions_to_awaiting_tool(status) {
        return "awaiting_tool";
    }
    if status_transitions_to_failed(status) {
        return "failed";
    }

    "awaiting_user"
}

pub fn resolve_codeengine_approval_runtime_status(
    status: Option<&str>,
    runtime_status: Option<&str>,
) -> &'static str {
    if status_transitions_to_awaiting_tool(status) {
        return "awaiting_tool";
    }
    if status_transitions_to_failed(status) {
        return "failed";
    }

    let explicit_runtime_status = runtime_status.and_then(normalize_codeengine_runtime_status);
    if explicit_runtime_status == Some("completed") {
        return "awaiting_tool";
    }
    if let Some(runtime_status) = explicit_runtime_status {
        return runtime_status;
    }

    "awaiting_approval"
}

pub fn map_codeengine_tool_runtime_status(
    kind: &str,
    status: Option<&str>,
    runtime_status: Option<&str>,
) -> &'static str {
    match kind {
        "user_question" => {
            return resolve_codeengine_user_question_runtime_status(status, runtime_status, false);
        }
        "approval" => return resolve_codeengine_approval_runtime_status(status, runtime_status),
        _ => {}
    }

    if let Some(runtime_status) = runtime_status.and_then(normalize_codeengine_runtime_status) {
        return runtime_status;
    }

    match status.and_then(normalize_codeengine_tool_lifecycle_status) {
        Some("completed") => "completed",
        Some("failed" | "cancelled") => "failed",
        Some("awaiting_approval") => "awaiting_approval",
        Some("awaiting_user") => "awaiting_user",
        Some("running") => "streaming",
        _ => "streaming",
    }
}

pub fn map_codeengine_tool_command_status(status: Option<&str>, exit_code: Option<&str>) -> String {
    if let Some(exit_code) = exit_code.and_then(|value| value.trim().parse::<i64>().ok()) {
        return if exit_code == 0 {
            "success".to_owned()
        } else {
            "error".to_owned()
        };
    }

    match status.and_then(normalize_codeengine_tool_lifecycle_status) {
        Some("completed") => "success".to_owned(),
        Some("failed" | "cancelled") => "error".to_owned(),
        Some("awaiting_approval" | "awaiting_user" | "running") => "running".to_owned(),
        _ => match status.and_then(normalize_codeengine_runtime_status) {
            Some("completed") => "success".to_owned(),
            Some("failed" | "terminated") => "error".to_owned(),
            _ => "running".to_owned(),
        },
    }
}

pub fn resolve_codeengine_command_interaction_runtime_status(
    kind: &str,
    command_status: &str,
    runtime_status: Option<&str>,
    requires_approval: bool,
    requires_reply: bool,
) -> Option<&'static str> {
    let normalized_runtime_status = runtime_status.and_then(normalize_codeengine_runtime_status);

    if command_status == "running" {
        if requires_reply
            || kind == "user_question"
            || normalized_runtime_status == Some("awaiting_user")
        {
            return Some("awaiting_user");
        }
        if requires_approval
            || kind == "approval"
            || normalized_runtime_status == Some("awaiting_approval")
        {
            return Some("awaiting_approval");
        }
        if normalized_runtime_status == Some("awaiting_tool") {
            return Some("awaiting_tool");
        }
        return Some("streaming");
    }

    match normalized_runtime_status {
        Some("awaiting_tool") => Some("awaiting_tool"),
        Some("failed") => Some("failed"),
        Some("completed") => Some("completed"),
        Some("terminated") => Some("completed"),
        _ => match command_status {
            "success" => Some("completed"),
            "error" => Some("failed"),
            _ => None,
        },
    }
}

pub fn resolve_codeengine_command_interaction_state(
    kind: &str,
    command_status: &str,
    runtime_status: Option<&str>,
    requires_approval: bool,
    requires_reply: bool,
) -> CodeEngineCommandInteractionState {
    let normalized_runtime_status = runtime_status.and_then(normalize_codeengine_runtime_status);
    let is_running = command_status == "running";
    CodeEngineCommandInteractionState {
        is_running,
        requires_approval: is_running
            && (requires_approval
                || kind == "approval"
                || normalized_runtime_status == Some("awaiting_approval")),
        requires_reply: is_running
            && (requires_reply
                || kind == "user_question"
                || normalized_runtime_status == Some("awaiting_user")),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        map_codeengine_tool_command_status, normalize_codeengine_tool_lifecycle_status,
        resolve_codeengine_approval_id, resolve_codeengine_approval_runtime_status,
        resolve_codeengine_tool_call_id, resolve_codeengine_user_question_id,
    };
    use serde_json::json;
    use std::collections::BTreeMap;

    #[test]
    fn codeengine_lifecycle_status_normalizes_provider_approval_verbs() {
        assert_eq!(
            normalize_codeengine_tool_lifecycle_status("allow"),
            Some("completed")
        );
        assert_eq!(
            normalize_codeengine_tool_lifecycle_status("approve"),
            Some("completed")
        );
        assert_eq!(
            normalize_codeengine_tool_lifecycle_status("grant"),
            Some("completed")
        );
        assert_eq!(
            normalize_codeengine_tool_lifecycle_status("deny"),
            Some("failed")
        );
        assert_eq!(
            normalize_codeengine_tool_lifecycle_status("decline"),
            Some("failed")
        );
        assert_eq!(
            normalize_codeengine_tool_lifecycle_status("reject"),
            Some("failed")
        );
    }

    #[test]
    fn codeengine_approval_runtime_status_settles_provider_approval_verbs() {
        assert_eq!(
            resolve_codeengine_approval_runtime_status(Some("allow"), None),
            "awaiting_tool"
        );
        assert_eq!(
            resolve_codeengine_approval_runtime_status(Some("deny"), None),
            "failed"
        );
        assert_eq!(
            map_codeengine_tool_command_status(Some("allow"), None),
            "success"
        );
        assert_eq!(
            map_codeengine_tool_command_status(Some("deny"), None),
            "error"
        );
    }

    #[test]
    fn codeengine_identity_resolvers_prefer_specific_provider_fields_over_generic_ids() {
        let payload = BTreeMap::from([("id".to_owned(), "generic-payload-id".to_owned())]);
        let tool_arguments = json!({
            "toolCallId": "specific-tool-argument-id",
            "requestID": "question-provider-1",
            "permissionId": "permission-provider-1"
        });

        assert_eq!(
            resolve_codeengine_tool_call_id(Some(&payload), Some(&tool_arguments), None).as_deref(),
            Some("specific-tool-argument-id")
        );
        assert_eq!(
            resolve_codeengine_user_question_id(Some(&payload), Some(&tool_arguments), None, None,)
                .as_deref(),
            Some("question-provider-1")
        );
        assert_eq!(
            resolve_codeengine_approval_id(Some(&payload), Some(&tool_arguments), None).as_deref(),
            Some("permission-provider-1")
        );
    }
}
