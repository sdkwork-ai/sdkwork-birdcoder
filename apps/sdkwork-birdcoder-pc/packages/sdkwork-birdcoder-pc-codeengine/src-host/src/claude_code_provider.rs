use crate::{
    build_codeengine_turn_prompt, execute_official_sdk_bridge_turn,
    execute_official_sdk_bridge_turn_with_events, get_sdk_bridge_session_detail,
    list_sdk_bridge_session_summaries, lookup_standard_native_session_provider_registration,
    persist_sdk_bridge_turn, session_id_targets_engine, CodeEngineProviderPlugin,
    CodeEngineSessionDetailRecord, CodeEngineSessionSummaryRecord, CodeEngineTurnRequestRecord,
    CodeEngineTurnResultRecord, CodeEngineTurnStreamEventRecord, NativeSessionProviderRegistration,
    OfficialSdkBridgeTurnRequest,
};

pub struct ClaudeCodeEngineProvider;
const CLAUDE_CODE_ENGINE_ID: &str = "claude-code";

impl CodeEngineProviderPlugin for ClaudeCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        lookup_standard_native_session_provider_registration(CLAUDE_CODE_ENGINE_ID).unwrap_or_else(
            || {
                panic!(
                    "standard native session provider registration missing for engine {}",
                    CLAUDE_CODE_ENGINE_ID
                )
            },
        )
    }

    fn list_sessions(&self) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
        list_sdk_bridge_session_summaries(CLAUDE_CODE_ENGINE_ID)
    }

    fn get_session(
        &self,
        session_id: &str,
    ) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
        if !session_id_targets_engine(session_id, CLAUDE_CODE_ENGINE_ID) {
            return Ok(None);
        }
        get_sdk_bridge_session_detail(session_id, CLAUDE_CODE_ENGINE_ID)
    }

    fn execute_turn(
        &self,
        request: &CodeEngineTurnRequestRecord,
    ) -> Result<CodeEngineTurnResultRecord, String> {
        execute_claude_code_provider_turn(request, None)
    }

    fn execute_turn_with_events(
        &self,
        request: &CodeEngineTurnRequestRecord,
        on_event: &mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>,
    ) -> Result<CodeEngineTurnResultRecord, String> {
        execute_claude_code_provider_turn(request, Some(on_event))
    }
}

fn execute_claude_code_provider_turn(
    request: &CodeEngineTurnRequestRecord,
    on_event: Option<&mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>>,
) -> Result<CodeEngineTurnResultRecord, String> {
    let prompt = build_codeengine_turn_prompt(
        &request.request_kind,
        &request.input_summary,
        request.ide_context.as_ref(),
    );
    let turn_request = OfficialSdkBridgeTurnRequest {
        engine_id: CLAUDE_CODE_ENGINE_ID,
        model_id: request.model_id.as_str(),
        prompt_text: prompt.as_str(),
        native_session_id: request.native_session_id.as_deref(),
        working_directory: request.working_directory.as_deref(),
        request_kind: request.request_kind.as_str(),
        ide_context: request.ide_context.as_ref(),
        temperature: request.config.temperature,
        top_p: request.config.top_p,
        max_tokens: request.config.max_tokens,
    };
    let bridge_result = match on_event {
        Some(callback) => execute_official_sdk_bridge_turn_with_events(&turn_request, callback)?,
        None => execute_official_sdk_bridge_turn(&turn_request)?,
    };
    let commands = bridge_result.commands.clone();
    let native_session_id = persist_sdk_bridge_turn(
        CLAUDE_CODE_ENGINE_ID,
        request,
        bridge_result.assistant_content.as_str(),
        commands.clone(),
        bridge_result.native_session_id,
    )?;

    Ok(CodeEngineTurnResultRecord {
        assistant_content: bridge_result.assistant_content,
        native_session_id: Some(native_session_id),
        commands,
    })
}
