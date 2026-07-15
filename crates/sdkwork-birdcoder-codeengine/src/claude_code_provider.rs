use std::collections::BTreeMap;

use crate::{
    get_claude_code_session_detail, get_sdk_bridge_session_detail,
    known_standard_provider_registration, list_claude_code_session_summaries,
    list_sdk_bridge_session_summaries, session_id_targets_engine, CodeEngineSessionDetailRecord,
    CodeEngineSessionSummaryRecord, NativeSessionProviderPlugin, NativeSessionProviderRegistration,
};

pub struct ClaudeCodeEngineProvider;
const CLAUDE_CODE_ENGINE_ID: &str = "claude-code";

impl NativeSessionProviderPlugin for ClaudeCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        known_standard_provider_registration(CLAUDE_CODE_ENGINE_ID)
    }

    fn list_sessions(&self) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
        let native_result = list_claude_code_session_summaries();
        let bridge_result = list_sdk_bridge_session_summaries(CLAUDE_CODE_ENGINE_ID);
        match (native_result, bridge_result) {
            (Ok(native), Ok(bridge)) => Ok(merge_claude_code_session_summaries(native, bridge)),
            (Ok(native), Err(error)) => {
                tracing::warn!(
                    error = %error,
                    "Claude Code SDK bridge session inventory is unavailable; using native history"
                );
                Ok(merge_claude_code_session_summaries(native, Vec::new()))
            }
            (Err(error), Ok(bridge)) => {
                tracing::warn!(
                    error = %error,
                    "Claude Code native session inventory is unavailable; using SDK bridge history"
                );
                Ok(merge_claude_code_session_summaries(Vec::new(), bridge))
            }
            (Err(native_error), Err(bridge_error)) => Err(format!(
                "Claude Code native session inventory failed: {native_error}; SDK bridge inventory failed: {bridge_error}"
            )),
        }
    }

    fn get_session(
        &self,
        session_id: &str,
    ) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
        if !session_id_targets_engine(session_id, CLAUDE_CODE_ENGINE_ID) {
            return Ok(None);
        }

        match get_claude_code_session_detail(session_id) {
            Ok(Some(detail)) => Ok(Some(detail)),
            Ok(None) => get_sdk_bridge_session_detail(session_id, CLAUDE_CODE_ENGINE_ID),
            Err(native_error) => {
                tracing::warn!(
                    error = %native_error,
                    session_id,
                    "Claude Code native session detail is unavailable; checking SDK bridge history"
                );
                get_sdk_bridge_session_detail(session_id, CLAUDE_CODE_ENGINE_ID).map_err(
                    |bridge_error| {
                        format!(
                            "Claude Code native session detail failed: {native_error}; SDK bridge detail failed: {bridge_error}"
                        )
                    },
                )
            }
        }
    }
}

fn merge_claude_code_session_summaries(
    native: Vec<CodeEngineSessionSummaryRecord>,
    bridge: Vec<CodeEngineSessionSummaryRecord>,
) -> Vec<CodeEngineSessionSummaryRecord> {
    let mut sessions_by_identity = BTreeMap::new();
    for session in native {
        sessions_by_identity.insert(claude_code_session_identity(&session), session);
    }
    for session in bridge {
        sessions_by_identity
            .entry(claude_code_session_identity(&session))
            .or_insert(session);
    }

    let mut sessions = sessions_by_identity.into_values().collect::<Vec<_>>();
    sessions.sort_by(|left, right| {
        right
            .sort_timestamp
            .cmp(&left.sort_timestamp)
            .then_with(|| left.id.cmp(&right.id))
    });
    sessions
}

fn claude_code_session_identity(session: &CodeEngineSessionSummaryRecord) -> String {
    format!(
        "{}:{}",
        session.engine_id.trim().to_ascii_lowercase(),
        session.id.trim().to_ascii_lowercase()
    )
}

#[cfg(test)]
mod tests {
    use super::merge_claude_code_session_summaries;
    use crate::CodeEngineSessionSummaryRecord;

    #[test]
    fn native_claude_session_wins_over_sdk_bridge_duplicate() {
        let native = session_summary("shared-session", "Native title", 100);
        let bridge = session_summary("shared-session", "Bridge title", 200);
        let bridge_only = session_summary("bridge-only", "Bridge only", 300);

        let merged =
            merge_claude_code_session_summaries(vec![native], vec![bridge, bridge_only.clone()]);

        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0].id, bridge_only.id);
        let shared = merged
            .iter()
            .find(|session| session.id == "shared-session")
            .expect("shared Claude session");
        assert_eq!(shared.title, "Native title");
    }

    fn session_summary(
        id: &str,
        title: &str,
        sort_timestamp: i64,
    ) -> CodeEngineSessionSummaryRecord {
        CodeEngineSessionSummaryRecord {
            created_at: "2026-07-15T00:00:00Z".to_owned(),
            id: id.to_owned(),
            title: title.to_owned(),
            status: "completed".to_owned(),
            runtime_status: Some("completed".to_owned()),
            host_mode: "desktop".to_owned(),
            engine_id: "claude-code".to_owned(),
            model_id: "claude-sonnet-4-6".to_owned(),
            updated_at: "2026-07-15T00:00:00Z".to_owned(),
            last_turn_at: Some("2026-07-15T00:00:00Z".to_owned()),
            kind: "coding".to_owned(),
            native_cwd: Some("E:/repo".to_owned()),
            sort_timestamp,
            transcript_updated_at: Some("2026-07-15T00:00:00Z".to_owned()),
            workspace_id: None,
            project_id: None,
        }
    }
}
