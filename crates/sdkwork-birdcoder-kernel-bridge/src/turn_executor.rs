use sdkwork_birdcoder_codeengine::{
    build_codeengine_turn_prompt, CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord,
};

use crate::engine_registry::KernelEngineSlot;
use sdkwork_agents_runtime_facade::{execute_code_engine_turn, CodeEngineTurnInput};

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
    let output = execute_code_engine_turn(slot, &input).map_err(|error| error.to_string())?;
    validate_provider_output(&output.assistant_content)?;
    Ok(CodeEngineTurnResultRecord {
        assistant_content: output.assistant_content,
        native_session_id: output.native_session_id,
        commands: None,
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
