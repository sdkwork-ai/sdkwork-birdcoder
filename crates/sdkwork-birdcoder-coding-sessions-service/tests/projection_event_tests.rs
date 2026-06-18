use sdkwork_birdcoder_coding_sessions_service::event_payload::*;
use sdkwork_birdcoder_coding_sessions_service::native_session_types::*;

#[test]
fn build_projection_session_events_with_native_detail_preserves_projection_user_message() {
    let snapshot = ProjectionSnapshot {
        session: None,
        turns: Vec::new(),
        operations: Vec::new(),
        events: vec![
            CodingSessionEventPayload {
                id: "coding-session-demo:turn-1:event:0".to_owned(),
                coding_session_id: "coding-session-demo".to_owned(),
                turn_id: Some("turn-1".to_owned()),
                runtime_id: Some("coding-session-demo:runtime".to_owned()),
                kind: "turn.completed".to_owned(),
                sequence: 0,
                payload: build_event_payload_strings(&[
                    ("finishReason".to_owned(), "stop".to_owned()),
                    ("runtimeStatus".to_owned(), "completed".to_owned()),
                ]),
                created_at: "2026-04-20T09:00:00Z".to_owned(),
            },
            CodingSessionEventPayload {
                id: "coding-session-demo:turn-1:event:1".to_owned(),
                coding_session_id: "coding-session-demo".to_owned(),
                turn_id: Some("turn-1".to_owned()),
                runtime_id: Some("coding-session-demo:runtime".to_owned()),
                kind: "message.completed".to_owned(),
                sequence: 1,
                payload: build_event_payload_strings(&[
                    (
                        "content".to_owned(),
                        "Explain why the transcript is empty.".to_owned(),
                    ),
                    ("role".to_owned(), "user".to_owned()),
                    ("runtimeStatus".to_owned(), "completed".to_owned()),
                ]),
                created_at: "2026-04-20T09:00:00Z".to_owned(),
            },
        ],
        artifacts: Vec::new(),
        checkpoints: Vec::new(),
    };
    let detail = NativeSessionDetailPayload {
        summary: NativeSessionSummaryPayload {
            created_at: "2026-04-20T09:00:00Z".to_owned(),
            id: "019d-demo".to_owned(),
            workspace_id: BOOTSTRAP_WORKSPACE_ID.to_owned(),
            project_id: "project-demo".to_owned(),
            title: "Transcript bug demo".to_owned(),
            status: "completed".to_owned(),
            host_mode: "server".to_owned(),
            engine_id: "codex".to_owned(),
            model_id: "gpt-5.4".to_owned(),
            updated_at: "2026-04-20T09:00:01Z".to_owned(),
            last_turn_at: Some("2026-04-20T09:00:01Z".to_owned()),
            runtime_status: Some("completed".to_owned()),
            kind: "native".to_owned(),
            native_cwd: Some("D:/demo".to_owned()),
            sort_timestamp: 1,
            transcript_updated_at: Some("2026-04-20T09:00:01Z".to_owned()),
        },
        messages: vec![
            NativeSessionMessagePayload {
                id: "native-user".to_owned(),
                coding_session_id: "019d-demo".to_owned(),
                turn_id: Some("turn-1".to_owned()),
                role: "user".to_owned(),
                content: format!(
                    "IDE context:\n- Workspace ID: {}\n- Project ID: project-demo\n- Session ID: coding-session-demo\n\nCurrent file path: /demo/package.json\nCurrent file language: json\n\nCurrent file content:\n```json\n{{\"name\":\"demo\"}}\n```\n\nUser request:\nExplain why the transcript is empty.",
                    BOOTSTRAP_WORKSPACE_ID
                ),
                commands: None,
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                task_progress: None,
                metadata: None,
                created_at: "2026-04-20T09:00:00Z".to_owned(),
            },
            NativeSessionMessagePayload {
                id: "native-assistant".to_owned(),
                coding_session_id: "019d-demo".to_owned(),
                turn_id: Some("turn-1".to_owned()),
                role: "assistant".to_owned(),
                content: "The transcript was empty because the visible user message was replaced by the engine prompt.".to_owned(),
                commands: None,
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                task_progress: None,
                metadata: None,
                created_at: "2026-04-20T09:00:01Z".to_owned(),
            },
        ],
    };

    let events = build_projection_session_events_with_native_detail(
        &snapshot,
        &detail,
        "coding-session-demo",
    );
    let user_messages = events
        .iter()
        .filter(|event| {
            event.kind == "message.completed"
                && event_payload_role(&event.payload) == Some("user")
        })
        .collect::<Vec<_>>();
    let assistant_messages = events
        .iter()
        .filter(|event| {
            event.kind == "message.completed"
                && event_payload_role(&event.payload) == Some("assistant")
        })
        .collect::<Vec<_>>();

    assert_eq!(user_messages.len(), 1);
    assert_eq!(
        payload_string_ref(&user_messages[0].payload, "content"),
        Some("Explain why the transcript is empty.")
    );
    assert_eq!(assistant_messages.len(), 1);
    assert_eq!(
        payload_string_ref(&assistant_messages[0].payload, "content"),
        Some(
            "The transcript was empty because the visible user message was replaced by the engine prompt."
        )
    );
}

#[test]
fn build_projection_session_events_with_native_detail_dedupes_mismatched_native_turn_ids() {
    let snapshot = ProjectionSnapshot {
        session: None,
        turns: Vec::new(),
        operations: Vec::new(),
        events: vec![
            CodingSessionEventPayload {
                id: "runtime-demo:birdcoder-turn:event:1".to_owned(),
                coding_session_id: "coding-session-demo".to_owned(),
                turn_id: Some("birdcoder-turn".to_owned()),
                runtime_id: Some("runtime-demo".to_owned()),
                kind: "message.completed".to_owned(),
                sequence: 1,
                payload: build_event_payload_strings(&[
                    ("content".to_owned(), "Run lint".to_owned()),
                    ("role".to_owned(), "user".to_owned()),
                    ("runtimeStatus".to_owned(), "completed".to_owned()),
                ]),
                created_at: "2026-04-20T09:00:00Z".to_owned(),
            },
            CodingSessionEventPayload {
                id: "runtime-demo:birdcoder-turn:event:2".to_owned(),
                coding_session_id: "coding-session-demo".to_owned(),
                turn_id: Some("birdcoder-turn".to_owned()),
                runtime_id: Some("runtime-demo".to_owned()),
                kind: "message.completed".to_owned(),
                sequence: 2,
                payload: build_event_payload_strings(&[
                    ("content".to_owned(), "Lint completed.".to_owned()),
                    ("role".to_owned(), "assistant".to_owned()),
                    ("runtimeStatus".to_owned(), "completed".to_owned()),
                ]),
                created_at: "2026-04-20T09:00:01Z".to_owned(),
            },
        ],
        artifacts: Vec::new(),
        checkpoints: Vec::new(),
    };
    let detail = NativeSessionDetailPayload {
        summary: NativeSessionSummaryPayload {
            created_at: "2026-04-20T09:00:00Z".to_owned(),
            id: "019d-demo".to_owned(),
            workspace_id: BOOTSTRAP_WORKSPACE_ID.to_owned(),
            project_id: "project-demo".to_owned(),
            title: "Transcript overlay demo".to_owned(),
            status: "completed".to_owned(),
            host_mode: "server".to_owned(),
            engine_id: "codex".to_owned(),
            model_id: "gpt-5.4".to_owned(),
            updated_at: "2026-04-20T09:00:04Z".to_owned(),
            last_turn_at: Some("2026-04-20T09:00:04Z".to_owned()),
            runtime_status: Some("completed".to_owned()),
            kind: "native".to_owned(),
            native_cwd: Some("D:/demo".to_owned()),
            sort_timestamp: 1,
            transcript_updated_at: Some("2026-04-20T09:00:04Z".to_owned()),
        },
        messages: vec![
            NativeSessionMessagePayload {
                id: "native-user-same-turn".to_owned(),
                coding_session_id: "019d-demo".to_owned(),
                turn_id: Some("codex-turn".to_owned()),
                role: "user".to_owned(),
                content:
                    "IDE context:\n- Session ID: coding-session-demo\n\nUser request:\nRun lint"
                        .to_owned(),
                commands: None,
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                task_progress: None,
                metadata: None,
                created_at: "2026-04-20T09:00:00Z".to_owned(),
            },
            NativeSessionMessagePayload {
                id: "native-assistant-same-turn".to_owned(),
                coding_session_id: "019d-demo".to_owned(),
                turn_id: Some("codex-turn".to_owned()),
                role: "assistant".to_owned(),
                content: "Lint completed.".to_owned(),
                commands: None,
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                task_progress: None,
                metadata: None,
                created_at: "2026-04-20T09:00:01Z".to_owned(),
            },
            NativeSessionMessagePayload {
                id: "native-user-external".to_owned(),
                coding_session_id: "019d-demo".to_owned(),
                turn_id: Some("codex-turn-external".to_owned()),
                role: "user".to_owned(),
                content: "External CLI follow-up".to_owned(),
                commands: None,
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                task_progress: None,
                metadata: None,
                created_at: "2026-04-20T09:00:03Z".to_owned(),
            },
            NativeSessionMessagePayload {
                id: "native-assistant-external".to_owned(),
                coding_session_id: "019d-demo".to_owned(),
                turn_id: Some("codex-turn-external".to_owned()),
                role: "assistant".to_owned(),
                content: "External CLI reply.".to_owned(),
                commands: None,
                tool_calls: None,
                tool_call_id: None,
                file_changes: None,
                task_progress: None,
                metadata: None,
                created_at: "2026-04-20T09:00:04Z".to_owned(),
            },
        ],
    };

    let events = build_projection_session_events_with_native_detail(
        &snapshot,
        &detail,
        "coding-session-demo",
    );
    let messages = events
        .iter()
        .filter(|event| event.kind == "message.completed")
        .map(|event| {
            (
                event_payload_role(&event.payload)
                    .unwrap_or_default()
                    .to_owned(),
                payload_string_value(&event.payload, "content").unwrap_or_default(),
            )
        })
        .collect::<Vec<_>>();

    assert_eq!(
        messages,
        vec![
            ("user".to_owned(), "Run lint".to_owned()),
            ("assistant".to_owned(), "Lint completed.".to_owned()),
            ("user".to_owned(), "External CLI follow-up".to_owned()),
            ("assistant".to_owned(), "External CLI reply.".to_owned()),
        ]
    );
}

#[test]
fn build_projection_session_events_with_native_detail_dedupes_native_final_against_projection_deltas(
) {
    let snapshot = ProjectionSnapshot {
        session: None,
        turns: Vec::new(),
        operations: Vec::new(),
        events: vec![
            CodingSessionEventPayload {
                id: "runtime-demo:birdcoder-turn:event:1".to_owned(),
                coding_session_id: "coding-session-demo".to_owned(),
                turn_id: Some("birdcoder-turn".to_owned()),
                runtime_id: Some("runtime-demo".to_owned()),
                kind: "message.delta".to_owned(),
                sequence: 1,
                payload: build_event_payload_strings(&[
                    ("contentDelta".to_owned(), "Lint ".to_owned()),
                    ("role".to_owned(), "assistant".to_owned()),
                    ("runtimeStatus".to_owned(), "streaming".to_owned()),
                ]),
                created_at: "2026-04-20T09:00:01Z".to_owned(),
            },
            CodingSessionEventPayload {
                id: "runtime-demo:birdcoder-turn:event:2".to_owned(),
                coding_session_id: "coding-session-demo".to_owned(),
                turn_id: Some("birdcoder-turn".to_owned()),
                runtime_id: Some("runtime-demo".to_owned()),
                kind: "message.delta".to_owned(),
                sequence: 2,
                payload: build_event_payload_strings(&[
                    ("contentDelta".to_owned(), "completed.".to_owned()),
                    ("role".to_owned(), "assistant".to_owned()),
                    ("runtimeStatus".to_owned(), "streaming".to_owned()),
                ]),
                created_at: "2026-04-20T09:00:02Z".to_owned(),
            },
        ],
        artifacts: Vec::new(),
        checkpoints: Vec::new(),
    };
    let detail = NativeSessionDetailPayload {
        summary: NativeSessionSummaryPayload {
            created_at: "2026-04-20T09:00:00Z".to_owned(),
            id: "019d-demo".to_owned(),
            workspace_id: BOOTSTRAP_WORKSPACE_ID.to_owned(),
            project_id: "project-demo".to_owned(),
            title: "Transcript overlay delta demo".to_owned(),
            status: "completed".to_owned(),
            host_mode: "server".to_owned(),
            engine_id: "codex".to_owned(),
            model_id: "gpt-5.4".to_owned(),
            updated_at: "2026-04-20T09:00:03Z".to_owned(),
            last_turn_at: Some("2026-04-20T09:00:03Z".to_owned()),
            runtime_status: Some("completed".to_owned()),
            kind: "native".to_owned(),
            native_cwd: Some("D:/demo".to_owned()),
            sort_timestamp: 1,
            transcript_updated_at: Some("2026-04-20T09:00:03Z".to_owned()),
        },
        messages: vec![NativeSessionMessagePayload {
            id: "native-assistant-final".to_owned(),
            coding_session_id: "019d-demo".to_owned(),
            turn_id: Some("codex-turn".to_owned()),
            role: "assistant".to_owned(),
            content: "Lint completed.".to_owned(),
            commands: None,
            tool_calls: None,
            tool_call_id: None,
            file_changes: None,
            task_progress: None,
            metadata: None,
            created_at: "2026-04-20T09:00:03Z".to_owned(),
        }],
    };

    let events = build_projection_session_events_with_native_detail(
        &snapshot,
        &detail,
        "coding-session-demo",
    );
    let assistant_messages = events
        .iter()
        .filter(|event| {
            matches!(event.kind.as_str(), "message.completed" | "message.delta")
                && event_payload_role(&event.payload) == Some("assistant")
        })
        .collect::<Vec<_>>();

    assert_eq!(assistant_messages.len(), 2);
    assert!(
        assistant_messages
            .iter()
            .all(|event| event.kind == "message.delta"),
        "native final assistant message must not be appended when projection deltas already represent the same reply"
    );
}

