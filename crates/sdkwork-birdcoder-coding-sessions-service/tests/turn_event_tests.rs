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

    let events = build_succeeded_coding_session_turn_events(
        "coding-session-1",
        "runtime-1",
        "turn-1",
        "operation-1",
        "Done.",
        Some(commands.as_slice()),
        4,
        "2026-04-26T00:00:00Z",
        Some("session-1"),
    );

    assert_eq!(events[0].kind, "message.completed");
    assert_eq!(
        events[0].payload.get("commands"),
        Some(&serde_json::to_value(&commands).expect("commands serialize to JSON value"))
    );
    assert_eq!(events[0].payload.get("commandsJson"), None);
}

