use sdkwork_birdcoder_codeengine::CodeEngineTurnRequestRecord;

use crate::engine_registry::{bootstrap_kernel_slot, KernelBootstrapError};
use crate::turn_executor::execute_kernel_turn;

const DEFAULT_MOBILE_CHAT_ENGINE: &str = "codex";

/// Generates an assistant reply for mobile chat user messages through the
/// canonical code-engine turn lane (Codex primary, structured error on failure).
pub fn generate_mobile_chat_assistant_reply(user_content: &str) -> Result<String, String> {
    let content = user_content.trim();
    if content.is_empty() {
        return Err("user message content is required.".to_string());
    }

    let slot = bootstrap_kernel_slot(DEFAULT_MOBILE_CHAT_ENGINE).map_err(format_bootstrap_error)?;
    let model_id = slot
        .list_model_ids()
        .first()
        .cloned()
        .ok_or_else(|| format!("engine {DEFAULT_MOBILE_CHAT_ENGINE} has no models."))?;

    let result = execute_kernel_turn(
        &slot,
        &CodeEngineTurnRequestRecord {
            engine_id: DEFAULT_MOBILE_CHAT_ENGINE.to_string(),
            model_id,
            request_kind: "mobile_chat_user_message".to_string(),
            input_summary: content.to_string(),
            ..Default::default()
        },
    )?;

    let reply = result.assistant_content.trim().to_string();
    if reply.is_empty() {
        return Err("assistant reply was empty.".to_string());
    }
    Ok(reply)
}

fn format_bootstrap_error(error: KernelBootstrapError) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_blank_user_content() {
        let error = generate_mobile_chat_assistant_reply("   ").expect_err("blank content");
        assert!(error.contains("required"));
    }

    #[test]
    fn generates_assistant_reply_when_codex_bootstraps() {
        let reply = generate_mobile_chat_assistant_reply("hello mobile chat").unwrap_or_else(|error| {
            panic!("expected codex bootstrap for mobile chat assistant: {error}");
        });
        assert!(!reply.trim().is_empty());
    }
}
