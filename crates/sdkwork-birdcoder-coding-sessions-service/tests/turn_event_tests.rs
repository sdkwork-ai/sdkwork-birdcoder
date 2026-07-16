use sdkwork_birdcoder_coding_sessions_service::event_payload::*;
use sdkwork_birdcoder_coding_sessions_service::native_session_types::*;

#[test]
fn succeeded_coding_session_turn_events_attach_command_payloads() {
    let commands = vec![NativeSessionCommandPayload {
        command: "pnpm lint".to_owned(),
        status: "success".to_owned(),
        output: Some("ok".to_owned()),
        ..Default::default()
    }];

    let events = build_succeeded_coding_session_turn_events(SucceededCodingSessionTurnEventInput {
        coding_session_id: "coding-session-1",
        runtime_id: "runtime-1",
        turn_id: "turn-1",
        operation_id: "operation-1",
        assistant_content: "Done.",
        stream_deltas: &[],
        commands: Some(commands.as_slice()),
        base_sequence: 4,
        completed_at: "2026-04-26T00:00:00Z",
        native_session_id: Some("session-1"),
    });

    assert_eq!(events[0].kind, "message.completed");
    assert_eq!(
        events[0].payload.get("commands"),
        Some(&serde_json::to_value(&commands).expect("commands serialize to JSON value"))
    );
    assert_eq!(events[0].payload.get("commandsJson"), None);
}

#[test]
fn succeeded_coding_session_turn_events_preserve_stream_delta_order() {
    let stream_deltas = vec!["Hello".to_owned(), " ".to_owned(), "world".to_owned()];
    let events = build_succeeded_coding_session_turn_events(SucceededCodingSessionTurnEventInput {
        coding_session_id: "coding-session-stream",
        runtime_id: "runtime-stream",
        turn_id: "turn-stream",
        operation_id: "operation-stream",
        assistant_content: "Hello world",
        stream_deltas: &stream_deltas,
        commands: None,
        base_sequence: 9,
        completed_at: "2026-07-15T00:00:00Z",
        native_session_id: Some("native-session-stream"),
    });

    assert_eq!(events.len(), 6);
    assert!(events[..3]
        .iter()
        .all(|event| event.kind == "message.delta"));
    assert_eq!(events[0].sequence, 9);
    assert_eq!(events[2].sequence, 11);
    assert_eq!(events[3].kind, "message.completed");
    assert_eq!(events[3].sequence, 12);
    assert_eq!(
        events[3]
            .payload
            .get("content")
            .and_then(serde_json::Value::as_str),
        Some("Hello world")
    );
}
