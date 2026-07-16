use sdkwork_birdcoder_codeengine::{
    build_codeengine_turn_prompt, map_codeengine_tool_kind, CodeEngineSessionCommandRecord,
    CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord,
};

use crate::engine_registry::KernelEngineSlot;
use sdkwork_agents_runtime_facade::{
    execute_code_engine_turn_with_stream, execute_code_engine_turn_with_stream_sink,
    CodeEngineTurnInput, KernelError, KernelResult, ModelStreamChunk, ModelStreamSink,
};

/// Product-neutral incremental output boundary for the BirdCoder kernel bridge.
///
/// The bridge owns translation from the kernel stream SPI. Consumers receive
/// only assistant content deltas and never provider protocol objects.
pub trait BirdcoderTurnStreamSink: Send {
    fn push_content_delta(&mut self, content_delta: String) -> Result<(), String>;
}

struct KernelToBirdcoderTurnStreamSink<'a> {
    inner: &'a mut dyn BirdcoderTurnStreamSink,
}

impl ModelStreamSink for KernelToBirdcoderTurnStreamSink<'_> {
    fn push_chunk(&mut self, chunk: ModelStreamChunk) -> KernelResult<()> {
        self.inner
            .push_content_delta(chunk.content)
            .map_err(|_| KernelError::cancelled("BirdCoder stream consumer rejected output"))
    }
}

pub fn execute_kernel_turn(
    slot: &KernelEngineSlot,
    request: &CodeEngineTurnRequestRecord,
) -> Result<CodeEngineTurnResultRecord, String> {
    let prompt = build_codeengine_turn_prompt(
        &request.request_kind,
        &request.input_summary,
        request.ide_context.as_ref(),
    );
    let input = build_runtime_turn_input(request, prompt);
    let output =
        execute_code_engine_turn_with_stream(slot, &input).map_err(|error| error.to_string())?;
    validate_provider_output(&output.assistant_content)?;
    let commands = map_kernel_tool_calls(output.tool_calls.as_slice())?;
    Ok(CodeEngineTurnResultRecord {
        assistant_content: output.assistant_content,
        native_session_id: output.native_session_id,
        commands: (!commands.is_empty()).then_some(commands),
        stream_deltas: output.stream_deltas,
    })
}

/// Executes a resumable turn while forwarding provider-neutral chunks through
/// the kernel `ModelStreamSink` SPI. Product services project these chunks to
/// `message.delta`; this bridge never depends on provider wire formats.
pub fn execute_kernel_turn_with_stream_sink(
    slot: &KernelEngineSlot,
    request: &CodeEngineTurnRequestRecord,
    sink: &mut dyn BirdcoderTurnStreamSink,
) -> Result<CodeEngineTurnResultRecord, String> {
    let prompt = build_codeengine_turn_prompt(
        &request.request_kind,
        &request.input_summary,
        request.ide_context.as_ref(),
    );
    let input = build_runtime_turn_input(request, prompt);
    let mut kernel_sink = KernelToBirdcoderTurnStreamSink { inner: sink };
    let output = execute_code_engine_turn_with_stream_sink(slot, &input, &mut kernel_sink)
        .map_err(|error| error.to_string())?;
    validate_provider_output(&output.assistant_content)?;
    let commands = map_kernel_tool_calls(output.tool_calls.as_slice())?;
    Ok(CodeEngineTurnResultRecord {
        assistant_content: output.assistant_content,
        native_session_id: output.native_session_id,
        commands: (!commands.is_empty()).then_some(commands),
        stream_deltas: output.stream_deltas,
    })
}

fn map_tool_call(
    tool_call: &sdkwork_agents_runtime_facade::ToolCall,
) -> Result<CodeEngineSessionCommandRecord, String> {
    let interaction = tool_call_interaction_state(tool_call)?;
    Ok(CodeEngineSessionCommandRecord {
        command: if tool_call.arguments.trim().is_empty() {
            tool_call.tool_id.clone()
        } else {
            tool_call.arguments.clone()
        },
        status: "pending".to_owned(),
        kind: Some("tool_call".to_owned()),
        tool_name: Some(tool_call.tool_id.clone()),
        tool_call_id: Some(tool_call.tool_call_id.clone()),
        runtime_status: Some(interaction.runtime_status().to_owned()),
        output: None,
        requires_approval: interaction.requires_approval(),
        requires_reply: interaction.requires_reply(),
    })
}

fn map_kernel_tool_calls(
    tool_calls: &[sdkwork_agents_runtime_facade::ToolCall],
) -> Result<Vec<CodeEngineSessionCommandRecord>, String> {
    tool_calls.iter().map(map_tool_call).collect()
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum ToolCallInteractionState {
    None,
    Approval,
    UserQuestion,
}

impl ToolCallInteractionState {
    const fn runtime_status(self) -> &'static str {
        match self {
            Self::None => "awaiting",
            Self::Approval => "awaiting_approval",
            Self::UserQuestion => "awaiting_user",
        }
    }

    const fn requires_approval(self) -> Option<bool> {
        match self {
            Self::Approval => Some(true),
            Self::None | Self::UserQuestion => None,
        }
    }

    const fn requires_reply(self) -> Option<bool> {
        match self {
            Self::UserQuestion => Some(true),
            Self::None | Self::Approval => None,
        }
    }
}

fn tool_call_interaction_state(
    tool_call: &sdkwork_agents_runtime_facade::ToolCall,
) -> Result<ToolCallInteractionState, String> {
    let arguments = serde_json::from_str::<serde_json::Value>(tool_call.arguments.as_str()).ok();
    let explicit_kind = arguments
        .as_ref()
        .and_then(|value| value.get("interactionKind"))
        .and_then(serde_json::Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let requires_approval = arguments
        .as_ref()
        .and_then(|value| value.get("requiresApproval"))
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    let requires_reply = arguments
        .as_ref()
        .and_then(|value| value.get("requiresReply"))
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    if requires_approval && requires_reply {
        return Err(format!(
            "provider tool call {} cannot require approval and a user reply simultaneously",
            tool_call.tool_call_id
        ));
    }
    let explicit_state = match explicit_kind {
        Some("approval") => Some(ToolCallInteractionState::Approval),
        Some("user_question") => Some(ToolCallInteractionState::UserQuestion),
        Some(value) => {
            return Err(format!(
                "provider tool call {} has unsupported interactionKind {value:?}",
                tool_call.tool_call_id
            ));
        }
        None => None,
    };
    if matches!(
        (explicit_state, requires_approval, requires_reply),
        (Some(ToolCallInteractionState::Approval), _, true)
            | (Some(ToolCallInteractionState::UserQuestion), true, _)
    ) {
        return Err(format!(
            "provider tool call {} has conflicting interactionKind and reply requirements",
            tool_call.tool_call_id
        ));
    }
    if let Some(explicit_state) = explicit_state {
        return Ok(explicit_state);
    }
    if requires_approval {
        return Ok(ToolCallInteractionState::Approval);
    }
    if requires_reply {
        return Ok(ToolCallInteractionState::UserQuestion);
    }

    Ok(match map_codeengine_tool_kind(tool_call.tool_id.as_str()) {
        "approval" => ToolCallInteractionState::Approval,
        "user_question" => ToolCallInteractionState::UserQuestion,
        _ => ToolCallInteractionState::None,
    })
}

fn build_runtime_turn_input(
    request: &CodeEngineTurnRequestRecord,
    prompt: String,
) -> CodeEngineTurnInput {
    CodeEngineTurnInput {
        engine_key: request.engine_id.clone(),
        model_id: request.model_id.clone(),
        native_session_id: request.native_session_id.clone(),
        prompt,
        working_directory: request.working_directory.clone(),
        timeout_ms: request.timeout_ms,
        approval_policy: request
            .config
            .approval_policy
            .clone()
            .or_else(|| Some("on-failure".to_owned())),
        sandbox_mode: request
            .config
            .sandbox_mode
            .clone()
            .or_else(|| Some("workspace-write".to_owned())),
        full_auto: request.config.full_auto,
        skip_git_repo_check: request.config.skip_git_repo_check,
        ephemeral: request.config.ephemeral,
        require_live_provider: true,
        max_output_bytes: request.max_output_bytes,
        temperature: request.config.temperature,
        top_p: request.config.top_p,
        max_tokens: request.config.max_tokens,
    }
}

fn validate_provider_output(content: &str) -> Result<(), String> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err("code-engine provider returned empty output".to_owned());
    }

    let normalized = trimmed.to_ascii_lowercase();
    if normalized.contains("sdk_probe")
        || normalized.contains("sdk probe")
        || normalized.contains("mock response")
        || normalized.contains("streaming mock")
        || normalized.contains(" stub]")
        || normalized == "stub"
        || normalized.starts_with("stub:")
    {
        return Err("code-engine provider returned stub or probe output".to_owned());
    }

    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(trimmed) {
        if payload
            .get("mode")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|mode| {
                matches!(
                    mode.trim().to_ascii_lowercase().as_str(),
                    "stub" | "sdk_probe" | "sdk_live_failed"
                )
            })
        {
            return Err("code-engine provider returned a non-live runtime payload".to_owned());
        }
        if payload.get("ok").and_then(serde_json::Value::as_bool) == Some(false) {
            return Err("code-engine provider returned ok=false".to_owned());
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_turn_input_preserves_execution_context_and_budget() {
        let request = CodeEngineTurnRequestRecord {
            engine_id: "codex".to_owned(),
            model_id: "gpt-5-codex".to_owned(),
            request_kind: "user_message".to_owned(),
            input_summary: "implement the change".to_owned(),
            working_directory: Some(std::path::PathBuf::from("C:/workspace/project")),
            timeout_ms: Some(90_000),
            max_output_bytes: Some(65_536),
            config: sdkwork_birdcoder_codeengine::CodeEngineTurnConfigRecord {
                approval_policy: Some("on-request".to_owned()),
                sandbox_mode: Some("workspace-write".to_owned()),
                full_auto: true,
                skip_git_repo_check: true,
                ephemeral: true,
                temperature: Some(0.2),
                top_p: Some(0.9),
                max_tokens: Some(4096),
            },
            ..Default::default()
        };

        let input = build_runtime_turn_input(&request, "prompt".to_owned());
        assert_eq!(input.working_directory, request.working_directory);
        assert_eq!(input.timeout_ms, Some(90_000));
        assert_eq!(input.max_output_bytes, Some(65_536));
        assert_eq!(input.approval_policy.as_deref(), Some("on-request"));
        assert_eq!(input.sandbox_mode.as_deref(), Some("workspace-write"));
        assert!(input.full_auto);
        assert!(input.skip_git_repo_check);
        assert!(input.ephemeral);
        assert!(input.require_live_provider);
        assert_eq!(input.temperature, Some(0.2));
        assert_eq!(input.top_p, Some(0.9));
        assert_eq!(input.max_tokens, Some(4096));
    }

    #[test]
    fn rejects_empty_provider_output() {
        assert!(validate_provider_output("   ").is_err());
    }

    #[test]
    fn maps_kernel_tool_calls_to_coding_session_commands() {
        let tool_call = sdkwork_agents_runtime_facade::ToolCall::new(
            "call-1",
            "codex.shell",
            r#"{"command":"cargo test"}"#,
        );
        let command = map_tool_call(&tool_call).expect("ordinary tool call should map");

        assert_eq!(command.status, "pending");
        assert_eq!(command.kind.as_deref(), Some("tool_call"));
        assert_eq!(command.tool_name.as_deref(), Some("codex.shell"));
        assert_eq!(command.tool_call_id.as_deref(), Some("call-1"));
    }

    #[test]
    fn maps_canonical_question_tool_calls_to_pending_interactions() {
        let tool_call = sdkwork_agents_runtime_facade::ToolCall::new(
            "provider-question-1",
            "tool.provider.native",
            r#"{"interactionKind":"user_question","requestID":"provider-question-1","questions":[{"question":"Run unit tests?"}]}"#,
        );

        let command = map_tool_call(&tool_call).expect("canonical interaction should map");

        assert_eq!(command.runtime_status.as_deref(), Some("awaiting_user"));
        assert_eq!(command.requires_reply, Some(true));
        assert_eq!(command.requires_approval, None);
    }

    #[test]
    fn rejects_ambiguous_provider_interaction_tool_calls() {
        let tool_call = sdkwork_agents_runtime_facade::ToolCall::new(
            "provider-ambiguous-1",
            "tool.provider.native",
            r#"{"requiresApproval":true,"requiresReply":true}"#,
        );

        let error = map_tool_call(&tool_call)
            .expect_err("one provider interaction cannot require two incompatible replies");

        assert!(error.contains("provider-ambiguous-1"));
    }

    #[test]
    fn rejects_conflicting_explicit_interaction_kind_and_reply_flag() {
        let tool_call = sdkwork_agents_runtime_facade::ToolCall::new(
            "provider-conflicting-1",
            "tool.provider.native",
            r#"{"interactionKind":"approval","requiresReply":true}"#,
        );

        let error = map_tool_call(&tool_call)
            .expect_err("a declared approval cannot also require a user answer");

        assert!(error.contains("provider-conflicting-1"));
    }

    #[test]
    fn rejects_unknown_canonical_interaction_kind() {
        let tool_call = sdkwork_agents_runtime_facade::ToolCall::new(
            "provider-unknown-kind-1",
            "tool.provider.native",
            r#"{"interactionKind":"approval_and_question"}"#,
        );

        let error = map_tool_call(&tool_call)
            .expect_err("unknown canonical interaction kinds cannot be routed safely");

        assert!(error.contains("provider-unknown-kind-1"));
    }

    #[test]
    fn rejects_obvious_stub_and_probe_provider_output() {
        for output in [
            "[codex stub] hello",
            "Mock response to request",
            "sdk_probe: package available",
            r#"{"mode":"stub","messages":["hello"]}"#,
            r#"{"mode":"sdk_live_failed","messages":[]}"#,
            r#"{"ok":false,"error":"provider unavailable"}"#,
        ] {
            assert!(
                validate_provider_output(output).is_err(),
                "stub output must not complete: {output}"
            );
        }
    }

    #[test]
    fn accepts_live_provider_text() {
        assert!(validate_provider_output("Implemented the requested change.").is_ok());
    }
}
