use crate::{
    get_sdk_bridge_session_detail, known_standard_provider_registration,
    list_sdk_bridge_session_summaries,
    CodeEngineSessionDetailRecord, CodeEngineSessionSummaryRecord, NativeSessionProviderPlugin,
    NativeSessionProviderRegistration, session_id_targets_engine,
};

pub struct ClaudeCodeEngineProvider;
const CLAUDE_CODE_ENGINE_ID: &str = "claude-code";

impl NativeSessionProviderPlugin for ClaudeCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        known_standard_provider_registration(CLAUDE_CODE_ENGINE_ID)
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
}
