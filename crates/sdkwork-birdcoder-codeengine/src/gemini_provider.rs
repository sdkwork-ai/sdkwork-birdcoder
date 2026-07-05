use crate::{
    get_sdk_bridge_session_detail, known_standard_provider_registration,
    list_sdk_bridge_session_summaries,
    CodeEngineSessionDetailRecord, CodeEngineSessionSummaryRecord, NativeSessionProviderPlugin,
    NativeSessionProviderRegistration, session_id_targets_engine,
};

pub struct GeminiCodeEngineProvider;
const GEMINI_ENGINE_ID: &str = "gemini";

impl NativeSessionProviderPlugin for GeminiCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        known_standard_provider_registration(GEMINI_ENGINE_ID)
    }

    fn list_sessions(&self) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
        list_sdk_bridge_session_summaries(GEMINI_ENGINE_ID)
    }

    fn get_session(
        &self,
        session_id: &str,
    ) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
        if !session_id_targets_engine(session_id, GEMINI_ENGINE_ID) {
            return Ok(None);
        }
        get_sdk_bridge_session_detail(session_id, GEMINI_ENGINE_ID)
    }
}
