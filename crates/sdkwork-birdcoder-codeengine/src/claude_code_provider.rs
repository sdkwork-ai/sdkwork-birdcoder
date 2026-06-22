use crate::{
    get_sdk_bridge_session_detail, list_sdk_bridge_session_summaries,
    resolved_native_session_provider_registration, session_id_targets_engine,
    CodeEngineSessionDetailRecord, CodeEngineSessionSummaryRecord, NativeSessionProviderPlugin,
    NativeSessionProviderRegistration,
};

pub struct ClaudeCodeEngineProvider;
const CLAUDE_CODE_ENGINE_ID: &str = "claude-code";

impl NativeSessionProviderPlugin for ClaudeCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        resolved_native_session_provider_registration(CLAUDE_CODE_ENGINE_ID).unwrap_or_else(|error| {
            panic!("{error}")
        })
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
