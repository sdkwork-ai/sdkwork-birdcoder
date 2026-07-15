use crate::{
    extract_native_lookup_id_for_engine, get_gemini_session_detail, get_sdk_bridge_session_detail,
    known_standard_provider_registration, list_gemini_session_summaries,
    list_sdk_bridge_session_summaries, session_id_targets_engine, CodeEngineSessionDetailRecord,
    CodeEngineSessionSummaryRecord, NativeSessionProviderPlugin, NativeSessionProviderRegistration,
};

pub struct GeminiCodeEngineProvider;
const GEMINI_ENGINE_ID: &str = "gemini";

impl NativeSessionProviderPlugin for GeminiCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        known_standard_provider_registration(GEMINI_ENGINE_ID)
    }

    fn list_sessions(&self) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
        let native = list_gemini_session_summaries();
        let bridge = list_sdk_bridge_session_summaries(GEMINI_ENGINE_ID);
        match (native, bridge) {
            (Ok(native), Ok(bridge)) => Ok(merge_gemini_session_summaries(native, bridge)),
            (Ok(native), Err(error)) if !native.is_empty() => {
                tracing::warn!(
                    error = %error,
                    "Gemini SDK bridge inventory is unavailable; using native CLI history"
                );
                Ok(native)
            }
            (Err(error), Ok(bridge)) if !bridge.is_empty() => {
                tracing::warn!(
                    error = %error,
                    "Gemini native CLI history is unavailable; using SDK bridge inventory"
                );
                Ok(bridge)
            }
            (Ok(summaries), Err(_)) | (Err(_), Ok(summaries)) => Ok(summaries),
            (Err(native_error), Err(bridge_error)) => Err(format!(
                "list Gemini native and SDK bridge sessions failed: native: {native_error}; bridge: {bridge_error}"
            )),
        }
    }

    fn get_session(
        &self,
        session_id: &str,
    ) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
        if !session_id_targets_engine(session_id, GEMINI_ENGINE_ID) {
            return Ok(None);
        }
        let lookup_id = extract_native_lookup_id_for_engine(session_id, GEMINI_ENGINE_ID)?;
        match get_gemini_session_detail(lookup_id.as_str()) {
            Ok(Some(detail)) => Ok(Some(detail)),
            Ok(None) => get_sdk_bridge_session_detail(session_id, GEMINI_ENGINE_ID),
            Err(native_error) => {
                match get_sdk_bridge_session_detail(session_id, GEMINI_ENGINE_ID) {
                    Ok(Some(detail)) => Ok(Some(detail)),
                    Ok(None) => Err(native_error),
                    Err(bridge_error) => Err(format!(
                        "get Gemini native and SDK bridge session {lookup_id} failed: native: {native_error}; bridge: {bridge_error}"
                    )),
                }
            }
        }
    }
}

fn merge_gemini_session_summaries(
    native: Vec<CodeEngineSessionSummaryRecord>,
    bridge: Vec<CodeEngineSessionSummaryRecord>,
) -> Vec<CodeEngineSessionSummaryRecord> {
    let mut summaries_by_raw_id = std::collections::BTreeMap::new();
    for summary in native {
        summaries_by_raw_id.insert(gemini_raw_session_id(summary.id.as_str()), summary);
    }
    for summary in bridge {
        summaries_by_raw_id
            .entry(gemini_raw_session_id(summary.id.as_str()))
            .or_insert(summary);
    }

    let mut summaries = summaries_by_raw_id.into_values().collect::<Vec<_>>();
    summaries.sort_by(|left, right| {
        right
            .sort_timestamp
            .cmp(&left.sort_timestamp)
            .then_with(|| left.id.cmp(&right.id))
    });
    summaries
}

fn gemini_raw_session_id(session_id: &str) -> String {
    extract_native_lookup_id_for_engine(session_id, GEMINI_ENGINE_ID)
        .unwrap_or_else(|_| session_id.trim().to_owned())
}

#[cfg(test)]
mod tests {
    use super::merge_gemini_session_summaries;
    use crate::CodeEngineSessionSummaryRecord;

    #[test]
    fn native_gemini_summary_wins_bridge_duplicate_by_raw_id() {
        let native = summary("gemini-session-1", "Native Gemini", 10);
        let bridge = summary("gemini-native:gemini-session-1", "Bridge Gemini", 20);

        let merged = merge_gemini_session_summaries(vec![native], vec![bridge]);

        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].title, "Native Gemini");
    }

    fn summary(id: &str, title: &str, sort_timestamp: i64) -> CodeEngineSessionSummaryRecord {
        CodeEngineSessionSummaryRecord {
            created_at: "2026-07-15T08:00:00Z".to_owned(),
            id: id.to_owned(),
            title: title.to_owned(),
            status: "completed".to_owned(),
            runtime_status: Some("completed".to_owned()),
            host_mode: "desktop".to_owned(),
            engine_id: "gemini".to_owned(),
            model_id: "gemini-2.5-pro".to_owned(),
            updated_at: "2026-07-15T08:00:00Z".to_owned(),
            last_turn_at: Some("2026-07-15T08:00:00Z".to_owned()),
            kind: "coding".to_owned(),
            native_cwd: Some("E:/project".to_owned()),
            sort_timestamp,
            transcript_updated_at: Some("2026-07-15T08:00:00Z".to_owned()),
            workspace_id: None,
            project_id: None,
        }
    }
}
