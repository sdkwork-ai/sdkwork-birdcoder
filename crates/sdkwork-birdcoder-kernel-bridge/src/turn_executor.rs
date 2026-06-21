use sdkwork_agent_kernel::ModelRequest;
use sdkwork_birdcoder_codeengine::{
    build_codeengine_turn_prompt, CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord,
};

use crate::engine_registry::KernelEngineSlot;

pub fn execute_kernel_turn(
    slot: &KernelEngineSlot,
    request: &CodeEngineTurnRequestRecord,
) -> Result<CodeEngineTurnResultRecord, String> {
    if slot.engine_key() != request.engine_id {
        return Err(format!(
            "engine mismatch: slot={} request={}",
            slot.engine_key(),
            request.engine_id
        ));
    }

    let prompt = build_codeengine_turn_prompt(
        &request.request_kind,
        &request.input_summary,
        request.ide_context.as_ref(),
    );
    let model_request_id = format!("birdcoder-turn-{}", uuid::Uuid::new_v4());
    let mut model_request = ModelRequest::new(model_request_id, vec![prompt]);
    if !request.model_id.trim().is_empty() {
        model_request.model_id = Some(request.model_id.clone());
    }
    if let Some(native_session_id) = request.native_session_id.as_ref() {
        model_request.session_id = Some(native_session_id.clone());
    }

    let response = slot
        .invoke_model(model_request)
        .map_err(|error| error.to_string())?;

    Ok(CodeEngineTurnResultRecord {
        assistant_content: response.messages.join("\n"),
        native_session_id: request.native_session_id.clone(),
        commands: None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine_registry::bootstrap_kernel_slot;

    #[test]
    fn executes_kernel_turn_for_codex() {
        let slot = bootstrap_kernel_slot("codex").expect("codex bootstrap");
        let result = execute_kernel_turn(
            &slot,
            &CodeEngineTurnRequestRecord {
                engine_id: "codex".to_string(),
                model_id: slot.list_model_ids()[0].clone(),
                request_kind: "user_message".to_string(),
                input_summary: "hello kernel".to_string(),
                ..Default::default()
            },
        )
        .expect("turn execution");
        assert!(!result.assistant_content.trim().is_empty());
    }
}
