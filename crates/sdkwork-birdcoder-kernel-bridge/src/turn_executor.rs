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
    let input = CodeEngineTurnInput {
        engine_key: request.engine_id.clone(),
        model_id: request.model_id.clone(),
        native_session_id: request.native_session_id.clone(),
        prompt,
    };
    let output = execute_code_engine_turn(slot, &input).map_err(|error| error.to_string())?;
    Ok(CodeEngineTurnResultRecord {
        assistant_content: output.assistant_content,
        native_session_id: output.native_session_id,
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
