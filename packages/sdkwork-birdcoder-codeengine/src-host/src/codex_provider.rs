use crate::{
    build_codeengine_turn_prompt, execute_codex_cli_turn, execute_codex_cli_turn_with_events,
    extract_native_lookup_id_for_engine, get_codex_session_detail, get_codex_session_summary,
    list_codex_session_summaries, lookup_standard_native_session_provider_registration,
    session_id_targets_engine, CodeEngineProviderPlugin, CodeEngineSessionDetailRecord,
    CodeEngineSessionSummaryRecord, CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord,
    CodeEngineTurnStreamEventRecord, CodexCliTurnRequest, NativeSessionProviderRegistration,
};

pub struct CodexCodeEngineProvider;
const CODEX_ENGINE_ID: &str = "codex";

impl CodeEngineProviderPlugin for CodexCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        lookup_standard_native_session_provider_registration(CODEX_ENGINE_ID).unwrap_or_else(|| {
            panic!(
                "standard native session provider registration missing for engine {}",
                CODEX_ENGINE_ID
            )
        })
    }

    fn list_sessions(&self) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
        let mut summaries = list_codex_session_summaries()?;
        summaries.sort_by(|left, right| {
            right
                .sort_timestamp
                .cmp(&left.sort_timestamp)
                .then_with(|| left.id.cmp(&right.id))
        });
        Ok(summaries)
    }

    fn get_session(
        &self,
        session_id: &str,
    ) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
        if !session_id_targets_engine(session_id, CODEX_ENGINE_ID) {
            return Ok(None);
        }
        let lookup_id = extract_native_lookup_id_for_engine(session_id, CODEX_ENGINE_ID)?;
        get_codex_session_detail(lookup_id.as_str())
    }

    fn get_session_summary(
        &self,
        session_id: &str,
    ) -> Result<Option<CodeEngineSessionSummaryRecord>, String> {
        if !session_id_targets_engine(session_id, CODEX_ENGINE_ID) {
            return Ok(None);
        }
        let lookup_id = extract_native_lookup_id_for_engine(session_id, CODEX_ENGINE_ID)?;
        get_codex_session_summary(lookup_id.as_str())
    }

    fn execute_turn(
        &self,
        request: &CodeEngineTurnRequestRecord,
    ) -> Result<CodeEngineTurnResultRecord, String> {
        execute_codex_provider_turn(request, None)
    }

    fn execute_turn_with_events(
        &self,
        request: &CodeEngineTurnRequestRecord,
        on_event: &mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>,
    ) -> Result<CodeEngineTurnResultRecord, String> {
        execute_codex_provider_turn(request, Some(on_event))
    }
}

fn execute_codex_provider_turn(
    request: &CodeEngineTurnRequestRecord,
    on_event: Option<&mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>>,
) -> Result<CodeEngineTurnResultRecord, String> {
    let prompt = build_codeengine_turn_prompt(
        &request.request_kind,
        &request.input_summary,
        request.ide_context.as_ref(),
    );
    let turn_request = CodexCliTurnRequest {
        prompt_text: prompt,
        model_id: request.model_id.clone(),
        native_session_id: request.native_session_id.clone(),
        working_directory: request.working_directory.clone(),
        full_auto: request.config.full_auto,
        skip_git_repo_check: request.config.skip_git_repo_check,
        ephemeral: request.config.ephemeral,
    };
    let result = match on_event {
        Some(callback) => execute_codex_cli_turn_with_events(&turn_request, callback)?,
        None => execute_codex_cli_turn(&turn_request)?,
    };

    if request.config.sandbox_mode.is_some() || request.config.approval_policy.is_some() {
        // TODO: codex exec resume currently does not expose the full interactive sandbox or
        // approval switch set on every invocation. The standardized turn contract lives in
        // sdkwork-birdcoder-codeengine now, so future Codex provider upgrades should wire the
        // missing switches here without touching server callers.
    }

    Ok(CodeEngineTurnResultRecord {
        assistant_content: result.assistant_content,
        native_session_id: result.native_session_id,
        commands: result.commands,
    })
}
