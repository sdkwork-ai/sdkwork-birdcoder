use crate::{
    extract_native_lookup_id_for_engine, get_codex_session_detail, get_codex_session_summary,
    list_codex_session_summaries, resolved_native_session_provider_registration,
    session_id_targets_engine, CodeEngineSessionDetailRecord, CodeEngineSessionSummaryRecord,
    NativeSessionProviderPlugin, NativeSessionProviderRegistration,
};

pub struct CodexCodeEngineProvider;
const CODEX_ENGINE_ID: &str = "codex";

impl NativeSessionProviderPlugin for CodexCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        resolved_native_session_provider_registration(CODEX_ENGINE_ID).unwrap_or_else(|error| {
            panic!("{error}")
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
}
