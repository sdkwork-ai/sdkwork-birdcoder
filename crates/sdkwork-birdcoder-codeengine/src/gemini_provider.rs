use crate::{
    get_sdk_bridge_session_detail, list_sdk_bridge_session_summaries,
    list_sdk_bridge_session_summaries, lookup_standard_native_session_provider_registration,
    session_id_targets_engine, CodeEngineSessionDetailRecord, CodeEngineSessionSummaryRecord,
    NativeSessionProviderPlugin, NativeSessionProviderRegistration,
};

pub struct GeminiCodeEngineProvider;
const GEMINI_ENGINE_ID: &str = "gemini";

impl NativeSessionProviderPlugin for GeminiCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        lookup_standard_native_session_provider_registration(GEMINI_ENGINE_ID).unwrap_or_else(|| {
            panic!(
                "standard native session provider registration missing for engine {}",
                GEMINI_ENGINE_ID
            )
        })
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
