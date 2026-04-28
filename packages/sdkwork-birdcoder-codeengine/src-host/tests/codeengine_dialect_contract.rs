use std::{fs, path::Path};

use sdkwork_birdcoder_codeengine::{
    canonicalize_codeengine_provider_tool_name, canonicalize_codeengine_tool_name,
    map_codeengine_session_runtime_status, map_codeengine_session_status_from_runtime,
    map_codeengine_tool_command_status, map_codeengine_tool_kind,
    map_codeengine_tool_runtime_status, normalize_codeengine_dialect_key,
    resolve_codeengine_approval_id, resolve_codeengine_approval_runtime_status,
    resolve_codeengine_checkpoint_id, resolve_codeengine_command_interaction_runtime_status,
    resolve_codeengine_command_interaction_state, resolve_codeengine_command_text,
    resolve_codeengine_tool_call_id, resolve_codeengine_user_question_id,
    resolve_codeengine_user_question_runtime_status, CodeEngineCommandInteractionState,
};
use serde_json::json;

#[test]
fn codeengine_dialect_standardizes_tool_aliases_and_lifecycle_statuses() {
    assert_eq!(
        normalize_codeengine_dialect_key("permission request"),
        Some("permission_request".to_owned())
    );
    assert_eq!(
        normalize_codeengine_dialect_key("ask-user"),
        Some("ask_user".to_owned())
    );

    assert_eq!(map_codeengine_tool_kind("question"), "user_question");
    assert_eq!(map_codeengine_tool_kind("ask-user"), "user_question");
    assert_eq!(
        map_codeengine_tool_kind("authorization-request"),
        "approval"
    );
    assert_eq!(map_codeengine_tool_kind("request permission"), "approval");
    assert_eq!(map_codeengine_tool_kind("shell-command"), "command");
    assert_eq!(map_codeengine_tool_kind("multi_edit"), "file_change");
    assert_eq!(map_codeengine_tool_kind("write_todo"), "task");

    assert_eq!(
        canonicalize_codeengine_tool_name("approval_request"),
        "permission_request"
    );
    assert_eq!(
        canonicalize_codeengine_tool_name("prompt user"),
        "user_question"
    );
    assert_eq!(canonicalize_codeengine_tool_name("read_file"), "read_file");
    assert_eq!(canonicalize_codeengine_tool_name("bash"), "run_command");
    assert_eq!(
        canonicalize_codeengine_tool_name("shell-command"),
        "run_command"
    );
    assert_eq!(
        canonicalize_codeengine_tool_name("execute_command"),
        "run_command"
    );
    assert_eq!(
        canonicalize_codeengine_tool_name("command_execution"),
        "run_command"
    );
    assert_eq!(canonicalize_codeengine_tool_name("todoWrite"), "write_todo");
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("claude-code", "Bash", "tool_use"),
        "run_command"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("claude code", "Read", "tool_use"),
        "read_file"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("claude-code", "Edit", "tool_use"),
        "edit_file"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("claude-code", "Write", "tool_use"),
        "write_file"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("claude-code", "MultiEdit", "tool_use"),
        "multi_edit"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("claude-code", "Grep", "tool_use"),
        "grep_code"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("claude-code", "Glob", "tool_use"),
        "search_code"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("claude-code", "TodoWrite", "tool_use"),
        "write_todo"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("gemini", "shell-command", "tool_use"),
        "run_command"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("gemini", "approval-request", "tool_use"),
        "permission_request"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("codex", "command_execution", "tool_use"),
        "run_command"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("opencode", "bash", "tool_use"),
        "run_command"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("opencode", "question", "tool_use"),
        "user_question"
    );
    assert_eq!(
        canonicalize_codeengine_provider_tool_name("claude-code", "   ", "tool_use"),
        "tool_use"
    );
    assert_eq!(
        resolve_codeengine_command_text("search_code", Some(&json!({ "query": "TODO" })), None),
        "TODO"
    );
    assert_eq!(
        resolve_codeengine_command_text(
            "permission_request",
            Some(&json!({
                "request": {
                    "args": {
                        "file_path": "src/App.tsx"
                    }
                }
            })),
            None,
        ),
        "Permission required: src/App.tsx"
    );
    assert_eq!(
        resolve_codeengine_command_text(
            "apply_patch",
            Some(&json!({
                "changes": [
                    { "path": "src/App.tsx" },
                    { "file_path": "src/index.ts" }
                ]
            })),
            Some("{\"changes\":[]}"),
        ),
        "apply_patch: src/App.tsx, src/index.ts"
    );
    assert_eq!(
        resolve_codeengine_command_text(
            "question",
            Some(&json!({
                "status": "awaiting_user",
                "questions": [
                    {
                        "question": "Which tests should I run?"
                    }
                ]
            })),
            None,
        ),
        "Which tests should I run?"
    );
    assert_eq!(
        resolve_codeengine_command_text(
            "user_question",
            Some(&json!({
                "status": "completed",
                "answer": "Unit"
            })),
            None,
        ),
        "Unit"
    );

    assert_eq!(
        resolve_codeengine_user_question_runtime_status(Some("completed"), None, false),
        "awaiting_tool"
    );
    assert_eq!(
        resolve_codeengine_user_question_runtime_status(None, Some("completed"), true),
        "awaiting_tool"
    );
    assert_eq!(
        resolve_codeengine_user_question_runtime_status(Some("rejected"), None, false),
        "failed"
    );
    assert_eq!(
        resolve_codeengine_approval_runtime_status(Some("approved"), None),
        "awaiting_tool"
    );
    assert_eq!(
        resolve_codeengine_approval_runtime_status(Some("allow"), None),
        "awaiting_tool"
    );
    assert_eq!(
        resolve_codeengine_approval_runtime_status(Some("denied"), None),
        "failed"
    );
    assert_eq!(
        resolve_codeengine_approval_runtime_status(Some("deny"), None),
        "failed"
    );

    assert_eq!(
        map_codeengine_tool_runtime_status("approval", Some("approved"), None),
        "awaiting_tool"
    );
    assert_eq!(
        map_codeengine_tool_runtime_status("user_question", Some("cancelled"), None),
        "failed"
    );
    assert_eq!(
        map_codeengine_tool_runtime_status("command", Some("in progress"), None),
        "streaming"
    );
    assert_eq!(
        map_codeengine_tool_command_status(Some("approved"), None),
        "success"
    );
    assert_eq!(
        map_codeengine_tool_command_status(Some("allow"), None),
        "success"
    );
    assert_eq!(
        map_codeengine_tool_command_status(Some("blocked"), None),
        "error"
    );
    assert_eq!(
        map_codeengine_tool_command_status(Some("deny"), None),
        "error"
    );
    let generic_id_payload =
        std::collections::BTreeMap::from([("id".to_owned(), json!("generic-payload-id"))]);
    let provider_identity_args = json!({
        "toolCallId": "specific-tool-argument-id",
        "requestID": "question-provider-1",
        "permissionId": "permission-provider-1"
    });
    assert_eq!(
        resolve_codeengine_tool_call_id(
            Some(&generic_id_payload),
            Some(&provider_identity_args),
            None
        )
        .as_deref(),
        Some("specific-tool-argument-id")
    );
    assert_eq!(
        resolve_codeengine_user_question_id(
            Some(&generic_id_payload),
            Some(&provider_identity_args),
            None,
            None
        )
        .as_deref(),
        Some("question-provider-1")
    );
    assert_eq!(
        resolve_codeengine_approval_id(
            Some(&generic_id_payload),
            Some(&provider_identity_args),
            None
        )
        .as_deref(),
        Some("permission-provider-1")
    );
    let checkpoint_identity_state = std::collections::BTreeMap::from([
        ("permissionId".to_owned(), json!("permission-checkpoint-1")),
        ("checkpointID".to_owned(), json!(9007199254740991_i64)),
    ]);
    assert_eq!(
        resolve_codeengine_approval_id(None, None, Some(&checkpoint_identity_state)).as_deref(),
        Some("permission-checkpoint-1")
    );
    assert_eq!(
        resolve_codeengine_checkpoint_id(None, None, Some(&checkpoint_identity_state)).as_deref(),
        Some("9007199254740991")
    );
    assert_eq!(
        map_codeengine_tool_command_status(None, Some("0")),
        "success"
    );
    assert_eq!(map_codeengine_tool_command_status(None, Some("2")), "error");
    assert_eq!(
        map_codeengine_session_runtime_status(Some("busy")),
        "streaming"
    );
    assert_eq!(
        map_codeengine_session_runtime_status(Some("retry")),
        "failed"
    );
    assert_eq!(
        map_codeengine_session_runtime_status(Some("active")),
        "streaming"
    );
    assert_eq!(
        map_codeengine_session_runtime_status(Some("paused")),
        "failed"
    );
    assert_eq!(
        map_codeengine_session_runtime_status(Some("archived")),
        "completed"
    );
    assert_eq!(map_codeengine_session_runtime_status(None), "completed");
    assert_eq!(
        map_codeengine_session_runtime_status(Some("unknown")),
        "ready"
    );
    assert_eq!(
        map_codeengine_session_status_from_runtime("streaming"),
        "active"
    );
    assert_eq!(
        map_codeengine_session_status_from_runtime("awaiting_user"),
        "active"
    );
    assert_eq!(
        map_codeengine_session_status_from_runtime("failed"),
        "paused"
    );
    assert_eq!(
        map_codeengine_session_status_from_runtime("completed"),
        "completed"
    );
    assert_eq!(
        resolve_codeengine_command_interaction_runtime_status(
            "user_question",
            "running",
            Some("awaiting_user"),
            false,
            true
        ),
        Some("awaiting_user")
    );
    assert_eq!(
        resolve_codeengine_command_interaction_runtime_status(
            "user_question",
            "success",
            Some("awaiting_user"),
            false,
            false
        ),
        Some("completed")
    );
    assert_eq!(
        resolve_codeengine_command_interaction_runtime_status(
            "approval",
            "success",
            Some("awaiting_tool"),
            false,
            false
        ),
        Some("awaiting_tool")
    );
    assert_eq!(
        resolve_codeengine_command_interaction_state(
            "approval",
            "running",
            Some("awaiting_approval"),
            false,
            false
        ),
        CodeEngineCommandInteractionState {
            is_running: true,
            requires_approval: true,
            requires_reply: false,
        }
    );
    assert_eq!(
        resolve_codeengine_command_interaction_state(
            "approval",
            "success",
            Some("awaiting_approval"),
            false,
            false
        ),
        CodeEngineCommandInteractionState {
            is_running: false,
            requires_approval: false,
            requires_reply: false,
        }
    );
    assert_eq!(
        resolve_codeengine_command_interaction_state(
            "user_question",
            "running",
            Some("awaiting_user"),
            false,
            false
        ),
        CodeEngineCommandInteractionState {
            is_running: true,
            requires_approval: false,
            requires_reply: true,
        }
    );
}

#[test]
fn native_session_paths_consume_the_shared_codeengine_dialect_standard() {
    let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let source_files = [
        manifest_dir.join("src/opencode_provider.rs"),
        manifest_dir.join("src/sdk_bridge.rs"),
        manifest_dir.join("src/codex.rs"),
        manifest_dir.join("src/codex_sessions.rs"),
    ];
    let forbidden_fragments = [
        "fn canonicalize_opencode_tool_name",
        "fn normalize_opencode_tool_key",
        "fn normalize_opencode_status_key",
        "fn map_opencode_tool_runtime_status",
        "fn map_opencode_tool_status",
        "fn normalize_sdk_bridge_lifecycle_key",
        "fn extract_opencode_tool_input_label",
        "fn extract_opencode_question_prompt",
        "requires_approval: Some(kind ==",
        "requires_reply: Some(kind ==",
        "fn map_codex_command_status",
        "fn map_opencode_session_status",
        "fn map_opencode_session_runtime_status",
        "fn map_codex_session_runtime_status",
        "fn map_sdk_bridge_session_status_from_runtime",
        "fn map_sdk_bridge_session_runtime_status",
        "\"completed\" | \"success\" => \"success\"",
        "\"failed\" | \"error\" => \"error\"",
    ];

    for source_file in source_files {
        let source = fs::read_to_string(&source_file)
            .unwrap_or_else(|error| panic!("read {} failed: {error}", source_file.display()));
        for forbidden_fragment in forbidden_fragments {
            assert!(
                !source.contains(forbidden_fragment),
                "{} must consume the shared codeengine dialect helper instead of defining {forbidden_fragment}",
                source_file.display()
            );
        }
    }
}
