use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::json;

use super::{get_gemini_session_detail_from_roots, list_gemini_session_summaries_from_roots};
use crate::gemini_sessions::project::legacy_project_hash;

const MAIN_SESSION_FIXTURE: &str = include_str!("../../tests/fixtures/gemini/session-main.json");

#[test]
fn gemini_history_fixture_builds_project_scoped_summary_and_detail() {
    let fixture = GeminiHistoryTestFixture::new("slug-summary-detail");
    let project_directory = fixture.root.join("tmp").join("sdkwork-birdcoder");
    write_project_marker(
        project_directory.as_path(),
        r"E:\sdkwork-space\sdkwork-birdcoder",
    );
    write_session_fixture(project_directory.as_path(), MAIN_SESSION_FIXTURE);

    let summaries = list_gemini_session_summaries_from_roots(std::slice::from_ref(&fixture.root))
        .expect("list Gemini fixture summaries");
    assert_eq!(summaries.len(), 1);
    let summary = &summaries[0];
    assert_eq!(summary.id, "gemini-session-main");
    assert_eq!(summary.engine_id, "gemini");
    assert_eq!(summary.model_id, "gemini-2.5-pro");
    assert_eq!(summary.title, "Align Gemini native session inventory");
    assert_eq!(
        summary.native_cwd.as_deref(),
        Some("E:/sdkwork-space/sdkwork-birdcoder")
    );
    assert_eq!(summary.updated_at, "2026-07-15T08:05:00.000Z");
    assert_eq!(
        summary.native_attributes.project_id.as_deref(),
        Some("sdkwork-birdcoder")
    );
    assert_eq!(
        summary.native_attributes.title.as_deref(),
        Some("Align Gemini native session inventory")
    );
    assert_eq!(
        summary.native_attributes.preview.as_deref(),
        Some("Load every Gemini CLI session for this project.")
    );
    assert_eq!(
        summary.native_attributes.model_provider.as_deref(),
        Some("google")
    );

    let detail = get_gemini_session_detail_from_roots(
        "gemini-session-main",
        std::slice::from_ref(&fixture.root),
    )
    .expect("get Gemini fixture detail")
    .expect("Gemini fixture detail exists");
    assert_eq!(detail.messages.len(), 2);
    assert_eq!(detail.messages[0].role, "user");
    assert_eq!(
        detail.messages[0].content,
        "Load every Gemini CLI session for this project."
    );
    assert_eq!(detail.messages[1].role, "assistant");
    let command = detail.messages[1]
        .commands
        .as_ref()
        .and_then(|commands| commands.first())
        .expect("Gemini tool command");
    assert_eq!(
        command.command,
        "cargo test -p sdkwork-birdcoder-codeengine"
    );
    assert_eq!(command.status, "success");
    assert_eq!(command.output.as_deref(), Some("test result: ok"));
}

#[test]
fn gemini_thought_only_history_does_not_create_an_empty_assistant_record() {
    let fixture = GeminiHistoryTestFixture::new("thought-only");
    let project_directory = fixture.root.join("tmp").join("thought-only-project");
    write_project_marker(project_directory.as_path(), "E:/thought-only-project");
    write_session_fixture(
        project_directory.as_path(),
        &serde_json::to_string_pretty(&json!({
            "sessionId": "gemini-thought-only",
            "projectHash": "thought-only-project",
            "startTime": "2026-07-20T08:00:00.000Z",
            "lastUpdated": "2026-07-20T08:01:00.000Z",
            "messages": [
                {
                    "id": "message-user",
                    "timestamp": "2026-07-20T08:00:00.000Z",
                    "type": "user",
                    "content": [{ "text": "Inspect the project." }]
                },
                {
                    "id": "message-thought-only",
                    "timestamp": "2026-07-20T08:01:00.000Z",
                    "type": "gemini",
                    "content": "",
                    "thoughts": [{
                        "subject": "Private analysis",
                        "description": "Internal thought must not render as the assistant answer."
                    }]
                }
            ]
        }))
        .expect("serialize Gemini thought-only fixture"),
    );

    let detail = get_gemini_session_detail_from_roots(
        "gemini-thought-only",
        std::slice::from_ref(&fixture.root),
    )
    .expect("get Gemini thought-only detail")
    .expect("Gemini thought-only detail exists");

    assert_eq!(detail.messages.len(), 1);
    assert_eq!(detail.messages[0].role, "user");
    assert_eq!(detail.messages[0].turn_id.as_deref(), Some("message-user"));
}

#[test]
fn gemini_tool_only_history_keeps_activity_without_function_placeholders() {
    let fixture = GeminiHistoryTestFixture::new("tool-only");
    let project_directory = fixture.root.join("tmp").join("tool-only-project");
    write_project_marker(project_directory.as_path(), "E:/tool-only-project");
    write_session_fixture(
        project_directory.as_path(),
        &serde_json::to_string_pretty(&json!({
            "sessionId": "gemini-tool-only",
            "projectHash": "tool-only-project",
            "startTime": "2026-07-20T09:00:00.000Z",
            "lastUpdated": "2026-07-20T09:01:00.000Z",
            "messages": [
                {
                    "id": "message-user",
                    "timestamp": "2026-07-20T09:00:00.000Z",
                    "type": "user",
                    "content": [{ "text": "Run the focused tests." }]
                },
                {
                    "id": "message-tool-only",
                    "timestamp": "2026-07-20T09:01:00.000Z",
                    "type": "gemini",
                    "content": [
                        {
                            "functionCall": {
                                "name": "run_shell_command",
                                "args": { "command": "pnpm test" }
                            }
                        },
                        {
                            "functionResponse": {
                                "name": "run_shell_command",
                                "response": { "output": "tests passed" }
                            }
                        }
                    ],
                    "toolCalls": [{
                        "id": "tool-call-only",
                        "name": "run_shell_command",
                        "args": { "command": "pnpm test" },
                        "result": { "output": "tests passed" },
                        "status": "success"
                    }]
                }
            ]
        }))
        .expect("serialize Gemini tool-only fixture"),
    );

    let detail = get_gemini_session_detail_from_roots(
        "gemini-tool-only",
        std::slice::from_ref(&fixture.root),
    )
    .expect("get Gemini tool-only detail")
    .expect("Gemini tool-only detail exists");
    let assistant = &detail.messages[1];

    assert_eq!(assistant.role, "assistant");
    assert_eq!(assistant.turn_id.as_deref(), Some("message-user"));
    assert!(assistant.content.is_empty());
    let tool_calls = assistant
        .tool_calls
        .as_ref()
        .expect("preserve Gemini native tool calls");
    assert_eq!(tool_calls.len(), 1);
    assert_eq!(tool_calls[0]["id"], "tool-call-only");
    let commands = assistant
        .commands
        .as_ref()
        .expect("project Gemini tool commands");
    assert_eq!(commands.len(), 1);
    assert_eq!(commands[0].command, "pnpm test");
    assert_eq!(commands[0].output.as_deref(), Some("tests passed"));
}

#[test]
fn gemini_history_normalizes_structured_output_errors_and_protocol_notices() {
    let fixture = GeminiHistoryTestFixture::new("structured-tool-results");
    let project_directory = fixture
        .root
        .join("tmp")
        .join("structured-tool-results-project");
    write_project_marker(
        project_directory.as_path(),
        "E:/structured-tool-results-project",
    );
    write_session_fixture(
        project_directory.as_path(),
        &serde_json::to_string_pretty(&json!({
            "sessionId": "gemini-structured-tool-results",
            "projectHash": "structured-tool-results-project",
            "startTime": "2026-07-20T09:30:00.000Z",
            "lastUpdated": "2026-07-20T09:31:00.000Z",
            "messages": [
                {
                    "id": "message-empty-user",
                    "timestamp": "2026-07-20T09:30:00.000Z",
                    "type": "user",
                    "content": ""
                },
                {
                    "id": "message-user",
                    "timestamp": "2026-07-20T09:30:01.000Z",
                    "type": "user",
                    "content": [{ "text": "Normalize the provider results." }]
                },
                {
                    "id": "message-tools",
                    "timestamp": "2026-07-20T09:30:02.000Z",
                    "type": "gemini",
                    "content": "",
                    "toolCalls": [
                        {
                            "id": "tool-ansi",
                            "name": "run_shell_command",
                            "args": { "command": "pnpm typecheck" },
                            "status": "success",
                            "resultDisplay": [
                                [
                                    { "text": "TypeScript ", "bold": false },
                                    { "text": "passed", "bold": true }
                                ],
                                [{ "text": "0 errors", "bold": false }]
                            ]
                        },
                        {
                            "id": "tool-cancelled",
                            "name": "run_shell_command",
                            "args": { "command": "pnpm test" },
                            "status": "success",
                            "resultDisplay": "Cancelled"
                        },
                        {
                            "id": "tool-false-error",
                            "name": "run_shell_command",
                            "args": { "command": "pnpm lint" },
                            "status": "success",
                            "result": { "error": false }
                        },
                        {
                            "id": "tool-file-diff",
                            "name": "replace",
                            "args": { "file_path": "src/provider.ts" },
                            "status": "success",
                            "resultDisplay": {
                                "fileDiff": "@@ -1 +1 @@\n-old\n+new",
                                "filePath": "src/provider.ts",
                                "originalContent": "old",
                                "newContent": "new"
                            }
                        },
                        {
                            "id": "tool-file-diff-failed",
                            "name": "replace",
                            "args": { "file_path": "src/failed.ts" },
                            "status": "error",
                            "resultDisplay": {
                                "fileDiff": "@@ -0,0 +1 @@\n+not-applied",
                                "filePath": "src/failed.ts",
                                "originalContent": "",
                                "newContent": "not-applied"
                            }
                        },
                        {
                            "id": "tool-todos",
                            "name": "write_todos",
                            "args": { "todos": [] },
                            "status": "success",
                            "resultDisplay": {
                                "todos": [
                                    { "description": "Project file diff", "status": "completed" },
                                    { "description": "Verify rendering", "status": "in_progress" }
                                ]
                            }
                        }
                    ]
                },
                {
                    "id": "message-warning",
                    "timestamp": "2026-07-20T09:30:03.000Z",
                    "type": "warning",
                    "content": "Provider capacity is constrained."
                },
                {
                    "id": "message-error",
                    "timestamp": "2026-07-20T09:31:00.000Z",
                    "type": "error",
                    "content": "Provider request failed."
                }
            ]
        }))
        .expect("serialize Gemini structured-result fixture"),
    );

    let detail = get_gemini_session_detail_from_roots(
        "gemini-structured-tool-results",
        std::slice::from_ref(&fixture.root),
    )
    .expect("get Gemini structured-result detail")
    .expect("Gemini structured-result detail exists");

    assert_eq!(detail.summary.status, "paused");
    assert_eq!(detail.summary.runtime_status.as_deref(), Some("failed"));
    assert_eq!(detail.messages.len(), 4);
    assert_eq!(detail.messages[0].id.ends_with("message-user"), true);
    let assistant = &detail.messages[1];
    assert_eq!(assistant.turn_id.as_deref(), Some("message-user"));
    let commands = assistant.commands.as_ref().expect("Gemini commands");
    let command_by_id = |id: &str| {
        commands
            .iter()
            .find(|command| command.tool_call_id.as_deref() == Some(id))
            .expect("Gemini command by id")
    };
    assert_eq!(
        command_by_id("tool-ansi").output.as_deref(),
        Some("TypeScript passed\n0 errors")
    );
    assert_eq!(command_by_id("tool-cancelled").status, "error");
    assert_eq!(
        command_by_id("tool-cancelled").output.as_deref(),
        Some("Cancelled")
    );
    assert_eq!(command_by_id("tool-false-error").status, "success");
    assert_eq!(command_by_id("tool-false-error").output, None);
    assert_eq!(command_by_id("tool-file-diff").output, None);
    let file_changes = assistant
        .file_changes
        .as_ref()
        .expect("promote successful Gemini FileDiff");
    assert_eq!(file_changes.len(), 1);
    assert_eq!(file_changes[0]["path"], "src/provider.ts");
    assert_eq!(file_changes[0]["additions"], 1);
    assert_eq!(file_changes[0]["deletions"], 1);
    assert_eq!(file_changes[0]["content"], "new");
    assert_eq!(file_changes[0]["originalContent"], "old");
    assert_eq!(
        assistant.task_progress,
        Some(json!({ "total": 2, "completed": 1 }))
    );

    let warning = &detail.messages[2];
    assert_eq!(warning.role, "system");
    assert_eq!(warning.content, "Provider capacity is constrained.");
    assert_eq!(
        warning
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("noticeKind"))
            .map(String::as_str),
        Some("warning")
    );

    let notice = &detail.messages[3];
    assert_eq!(notice.role, "system");
    assert_eq!(notice.turn_id.as_deref(), Some("message-user"));
    assert_eq!(
        notice
            .metadata
            .as_ref()
            .and_then(|metadata| metadata.get("noticeKind"))
            .map(String::as_str),
        Some("failed")
    );
}

#[test]
fn gemini_history_resolves_legacy_hash_directory_from_projects_registry() {
    let fixture = GeminiHistoryTestFixture::new("legacy-hash");
    let project_root = r"E:\legacy\GeminiProject";
    let legacy_hash = legacy_project_hash(project_root);
    let project_directory = fixture.root.join("tmp").join(legacy_hash);
    write_session_fixture(project_directory.as_path(), MAIN_SESSION_FIXTURE);
    fs::write(
        fixture.root.join("projects.json"),
        serde_json::to_vec_pretty(&json!({
            "projects": {
                project_root: "gemini-project"
            }
        }))
        .expect("serialize Gemini projects registry"),
    )
    .expect("write Gemini projects registry");

    let summaries = list_gemini_session_summaries_from_roots(std::slice::from_ref(&fixture.root))
        .expect("list legacy Gemini fixture summaries");
    assert_eq!(summaries.len(), 1);
    assert_eq!(
        summaries[0].native_cwd.as_deref(),
        Some("E:/legacy/GeminiProject")
    );
}

#[test]
fn gemini_history_skips_subagents_and_system_only_conversations() {
    let fixture = GeminiHistoryTestFixture::new("skip-non-main");
    let project_directory = fixture.root.join("tmp").join("project");
    write_project_marker(project_directory.as_path(), "E:/project");
    write_session_fixture(project_directory.as_path(), MAIN_SESSION_FIXTURE);
    write_named_session(
        project_directory.as_path(),
        "session-subagent.json",
        &MAIN_SESSION_FIXTURE.replace(
            "\"messages\": [",
            "\"kind\": \"subagent\",\n  \"messages\": [",
        ),
    );
    write_named_session(
        project_directory.as_path(),
        "session-system-only.json",
        &serde_json::to_string_pretty(&json!({
            "sessionId": "system-only",
            "projectHash": "project",
            "startTime": "2026-07-15T09:00:00.000Z",
            "lastUpdated": "2026-07-15T09:01:00.000Z",
            "messages": [{
                "id": "info-1",
                "timestamp": "2026-07-15T09:01:00.000Z",
                "type": "info",
                "content": "Update available."
            }]
        }))
        .expect("serialize system-only Gemini session"),
    );

    let summaries = list_gemini_session_summaries_from_roots(std::slice::from_ref(&fixture.root))
        .expect("list filtered Gemini fixture summaries");
    assert_eq!(summaries.len(), 1);
    assert_eq!(summaries[0].id, "gemini-session-main");
}

#[test]
fn gemini_history_keeps_newest_duplicate_raw_session_id() {
    let fixture = GeminiHistoryTestFixture::new("duplicate-id");
    let older_directory = fixture.root.join("tmp").join("older");
    let newer_directory = fixture.root.join("tmp").join("newer");
    write_project_marker(older_directory.as_path(), "E:/older");
    write_project_marker(newer_directory.as_path(), "E:/newer");
    write_session_fixture(older_directory.as_path(), MAIN_SESSION_FIXTURE);
    write_session_fixture(
        newer_directory.as_path(),
        &MAIN_SESSION_FIXTURE
            .replace("2026-07-15T08:05:00.000Z", "2026-07-15T10:05:00.000Z")
            .replace(
                "Align Gemini native session inventory",
                "Newest duplicate Gemini session",
            ),
    );

    let summaries = list_gemini_session_summaries_from_roots(std::slice::from_ref(&fixture.root))
        .expect("list duplicate Gemini fixture summaries");
    assert_eq!(summaries.len(), 1);
    assert_eq!(summaries[0].title, "Newest duplicate Gemini session");
    assert_eq!(summaries[0].native_cwd.as_deref(), Some("E:/newer"));
}

struct GeminiHistoryTestFixture {
    root: PathBuf,
}

impl GeminiHistoryTestFixture {
    fn new(label: &str) -> Self {
        static NEXT_FIXTURE_ID: AtomicU64 = AtomicU64::new(1);
        let unique = NEXT_FIXTURE_ID.fetch_add(1, Ordering::Relaxed);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "birdcoder-gemini-history-{label}-{}-{timestamp}-{unique}",
            std::process::id()
        ));
        fs::create_dir_all(&root).expect("create Gemini history fixture root");
        Self { root }
    }
}

impl Drop for GeminiHistoryTestFixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn write_project_marker(project_directory: &Path, project_root: &str) {
    fs::create_dir_all(project_directory).expect("create Gemini project fixture directory");
    fs::write(project_directory.join(".project_root"), project_root)
        .expect("write Gemini project root marker");
}

fn write_session_fixture(project_directory: &Path, contents: &str) {
    write_named_session(
        project_directory,
        "session-2026-07-15T08-00-gemini-s.json",
        contents,
    );
}

fn write_named_session(project_directory: &Path, file_name: &str, contents: &str) {
    let chats_directory = project_directory.join("chats");
    fs::create_dir_all(&chats_directory).expect("create Gemini chats fixture directory");
    fs::write(chats_directory.join(file_name), contents).expect("write Gemini session fixture");
}
