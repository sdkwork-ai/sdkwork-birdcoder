use sdkwork_birdcoder_coding_sessions_service::event_payload::*;
use sdkwork_birdcoder_coding_sessions_service::native_session_types::*;

#[test]
fn native_session_events_preserve_rich_message_payloads() {
    let detail = NativeSessionDetailPayload {
        summary: NativeSessionSummaryPayload {
            created_at: "2026-04-20T10:00:00Z".to_owned(),
            id: "rich-session".to_owned(),
            workspace_id: BOOTSTRAP_WORKSPACE_ID.to_owned(),
            project_id: "project-rich".to_owned(),
            title: "Rich native transcript".to_owned(),
            status: "completed".to_owned(),
            host_mode: "server".to_owned(),
            engine_id: "codex".to_owned(),
            model_id: "gpt-5.4".to_owned(),
            updated_at: "2026-04-20T10:00:01Z".to_owned(),
            last_turn_at: Some("2026-04-20T10:00:01Z".to_owned()),
            runtime_status: Some("completed".to_owned()),
            kind: "native".to_owned(),
            native_cwd: Some("D:/project-rich".to_owned()),
            sort_timestamp: 1,
            transcript_updated_at: Some("2026-04-20T10:00:01Z".to_owned()),
        },
        messages: vec![
            NativeSessionMessagePayload {
                id: "rich-assistant".to_owned(),
                coding_session_id: "rich-session".to_owned(),
                turn_id: Some("rich-turn".to_owned()),
                role: "assistant".to_owned(),
                content: "Updated files and ran tests.".to_owned(),
                commands: Some(vec![NativeSessionCommandPayload {
                    command: "pnpm test".to_owned(),
                    status: "success".to_owned(),
                    output: Some("ok".to_owned()),
                    kind: Some("command".to_owned()),
                    tool_name: Some("run_command".to_owned()),
                    tool_call_id: Some("tool-run-tests".to_owned()),
                    runtime_status: Some("completed".to_owned()),
                    requires_approval: Some(false),
                    requires_reply: Some(false),
                }]),
                tool_calls: Some(vec![serde_json::json!({
                    "id": "tool-run-tests",
                    "type": "function",
                    "function": {
                        "name": "run_command",
                        "arguments": "{\"command\":\"pnpm test\"}"
                    }
                })]),
                tool_call_id: None,
                file_changes: Some(vec![serde_json::json!({
                    "path": "src/App.tsx",
                    "additions": 1,
                    "deletions": 1
                })]),
                task_progress: Some(serde_json::json!({
                    "total": 2,
                    "completed": 2
                })),
                metadata: None,
                created_at: "2026-04-20T10:00:01Z".to_owned(),
            },
            NativeSessionMessagePayload {
                id: "rich-tool".to_owned(),
                coding_session_id: "rich-session".to_owned(),
                turn_id: Some("rich-turn".to_owned()),
                role: "tool".to_owned(),
                content: "ok".to_owned(),
                commands: None,
                tool_calls: None,
                tool_call_id: Some("tool-run-tests".to_owned()),
                file_changes: None,
                task_progress: None,
                metadata: None,
                created_at: "2026-04-20T10:00:02Z".to_owned(),
            },
        ],
    };

    let events =
        build_native_session_events_for_coding_session(&detail, "coding-session-rich", 0);
    let assistant_event = events
        .iter()
        .find(|event| event_payload_role(&event.payload) == Some("assistant"))
        .expect("assistant event");
    let tool_event = events
        .iter()
        .find(|event| event_payload_role(&event.payload) == Some("tool"))
        .expect("tool event");

    assert_eq!(
        assistant_event.payload.get("commands"),
        Some(
            &serde_json::to_value(
                detail.messages[0]
                    .commands
                    .as_ref()
                    .expect("assistant commands fixture")
            )
            .expect("commands serialize to JSON value")
        )
    );
    assert_eq!(
        assistant_event.payload.get("toolCalls"),
        Some(&serde_json::json!([{
            "function": {
                "arguments": "{\"command\":\"pnpm test\"}",
                "name": "run_command"
            },
            "id": "tool-run-tests",
            "type": "function"
        }]))
    );
    assert_eq!(
        assistant_event.payload.get("fileChanges"),
        Some(&serde_json::json!([{
            "additions": 1,
            "deletions": 1,
            "path": "src/App.tsx"
        }]))
    );
    assert_eq!(
        assistant_event.payload.get("taskProgress"),
        Some(&serde_json::json!({
            "completed": 2,
            "total": 2
        }))
    );
    assert_eq!(assistant_event.payload.get("commandsJson"), None);
    assert_eq!(assistant_event.payload.get("toolCallsJson"), None);
    assert_eq!(assistant_event.payload.get("fileChangesJson"), None);
    assert_eq!(assistant_event.payload.get("taskProgressJson"), None);
    assert_eq!(
        payload_string_ref(&tool_event.payload, "toolCallId"),
        Some("tool-run-tests")
    );
}

