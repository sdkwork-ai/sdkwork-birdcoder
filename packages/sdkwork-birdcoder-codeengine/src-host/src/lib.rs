mod catalog;
mod claude_code_provider;
mod codeengine_dialect;
mod codex;
mod codex_provider;
mod codex_sessions;
mod gemini_provider;
mod opencode;
mod opencode_provider;
mod provider;
mod sdk_bridge;
mod session_records;
mod turns;

pub use catalog::{
    find_codeengine_descriptor, find_native_session_provider_catalog_entry,
    list_codeengine_descriptors, list_codeengine_model_catalog_entries,
    list_native_session_provider_catalog_entries, native_session_provider_catalog_entries,
    shared_codeengine_catalog, CodeEngineAccessLaneStatusRecord,
    CodeEngineAccessStrategyKindRecord, CodeEngineBridgeProtocolRecord,
    CodeEngineCapabilityMatrixRecord, CodeEngineDescriptorRecord,
    CodeEngineModelCatalogEntryRecord, CodeEngineRuntimeOwnerRecord,
    NativeSessionDiscoveryModeRecord as NativeSessionDiscoveryMode,
    NativeSessionProviderCatalogRecord,
    NativeSessionProviderCatalogRecord as NativeSessionProviderRegistration,
    PartialCodeEngineCapabilityMatrixRecord, SharedCodeEngineCatalogRecord,
};
pub use claude_code_provider::ClaudeCodeEngineProvider;
pub use codeengine_dialect::{
    canonicalize_codeengine_provider_tool_name, canonicalize_codeengine_tool_name,
    map_codeengine_session_runtime_status, map_codeengine_session_status_from_runtime,
    map_codeengine_tool_command_status, map_codeengine_tool_kind,
    map_codeengine_tool_runtime_status, normalize_codeengine_dialect_key,
    normalize_codeengine_runtime_status, normalize_codeengine_tool_lifecycle_status,
    resolve_codeengine_approval_id, resolve_codeengine_approval_runtime_status,
    resolve_codeengine_checkpoint_id, resolve_codeengine_command_interaction_runtime_status,
    resolve_codeengine_command_interaction_state, resolve_codeengine_command_text,
    resolve_codeengine_tool_call_id, resolve_codeengine_user_question_id,
    resolve_codeengine_user_question_runtime_status, CodeEngineCommandInteractionState,
};
pub use codex::{
    execute_codex_cli_turn, execute_codex_cli_turn_with_events, CodexCliTurnRequest,
    CodexCliTurnResult,
};
pub use codex_provider::CodexCodeEngineProvider;
pub use codex_sessions::{
    get_codex_session_detail, get_codex_session_summary, list_codex_session_summaries,
    normalize_codex_prompt_title, parse_codex_session_detail, parse_codex_session_summary,
    CodexSessionIndexEntry,
};
pub use gemini_provider::GeminiCodeEngineProvider;
pub use opencode::{
    create_opencode_session, get_opencode_session, get_opencode_session_messages,
    is_opencode_transport_available, list_opencode_session_status_map, list_opencode_sessions,
    prompt_opencode_session,
};
pub use opencode_provider::OpencodeCodeEngineProvider;
pub use provider::{
    extract_native_lookup_id_for_engine, session_id_targets_engine,
    standard_codeengine_provider_registry, CodeEngineProviderPlugin, CodeEngineProviderRegistry,
};
pub use sdk_bridge::{
    execute_official_sdk_bridge_turn, execute_official_sdk_bridge_turn_with_events,
    get_sdk_bridge_session_detail, list_sdk_bridge_session_summaries, persist_sdk_bridge_turn,
    OfficialSdkBridgeTurnRequest, CODEENGINE_HOME_ENV, CODEENGINE_SDK_BRIDGE_HOME_ENV,
    CODEENGINE_SDK_BRIDGE_NODE_ENV, CODEENGINE_SDK_BRIDGE_SCRIPT_ENV,
};
pub use session_records::{
    CodeEngineSessionCommandRecord, CodeEngineSessionDetailRecord, CodeEngineSessionMessageRecord,
    CodeEngineSessionSummaryRecord,
};
pub use turns::{
    build_codeengine_turn_prompt, CodeEngineTurnConfigRecord,
    CodeEngineTurnCurrentFileContextRecord, CodeEngineTurnIdeContextRecord,
    CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord, CodeEngineTurnStreamEventRecord,
};

pub const OPENCODE_SERVER_ATTACH_URL_ENV: &str = "OPENCODE_SERVER_URL";

pub fn standard_native_session_provider_registrations(
) -> &'static [NativeSessionProviderRegistration] {
    native_session_provider_catalog_entries()
}

pub fn lookup_standard_native_session_provider_registration(
    engine_id: &str,
) -> Option<&'static NativeSessionProviderRegistration> {
    find_native_session_provider_catalog_entry(engine_id)
}

pub fn format_missing_native_session_provider_error(engine_id: &str) -> String {
    format!(
        "Native session provider for engine \"{engine_id}\" is not registered in the standard code engine provider registry."
    )
}

pub fn native_session_prefix_for_engine(engine_id: &str) -> Option<&'static str> {
    lookup_standard_native_session_provider_registration(engine_id)
        .map(|registration| registration.native_session_id_prefix.as_str())
}

pub fn resolve_native_session_engine_id(session_id: &str) -> Option<&'static str> {
    let normalized = session_id.trim();
    if normalized.is_empty() {
        return None;
    }

    standard_native_session_provider_registrations()
        .iter()
        .find_map(|registration| {
            normalized
                .strip_prefix(registration.native_session_id_prefix.as_str())
                .map(|_| registration.engine_id.as_str())
        })
}

pub fn is_authority_backed_native_session_id(session_id: &str) -> bool {
    resolve_native_session_engine_id(session_id).is_some()
}

pub fn build_native_session_id(_engine_id: &str, native_session_id: &str) -> String {
    let normalized = native_session_id.trim();
    if normalized.is_empty() {
        return String::new();
    }

    if let Some(resolved_engine_id) = resolve_native_session_engine_id(normalized) {
        if let Some(prefix) = native_session_prefix_for_engine(resolved_engine_id) {
            return normalized
                .strip_prefix(prefix)
                .unwrap_or(normalized)
                .trim()
                .to_owned();
        }
    }

    normalized.to_owned()
}

pub fn opencode_server_attach_url_env() -> &'static str {
    OPENCODE_SERVER_ATTACH_URL_ENV
}

#[cfg(test)]
mod tests {
    use super::{build_native_session_id, resolve_native_session_engine_id};

    #[test]
    fn build_native_session_id_keeps_raw_provider_id() {
        assert_eq!(
            build_native_session_id("codex", "019dc9ed-5e34-7ac1-9176-746135cb324b"),
            "019dc9ed-5e34-7ac1-9176-746135cb324b"
        );
    }

    #[test]
    fn build_native_session_id_strips_legacy_provider_prefix() {
        assert_eq!(
            build_native_session_id("codex", "codex-native:legacy-session"),
            "legacy-session"
        );
    }

    #[test]
    fn build_native_session_id_strips_any_legacy_provider_prefix() {
        assert_eq!(
            build_native_session_id("codex", "opencode-native:legacy-session"),
            "legacy-session"
        );
    }

    #[test]
    fn resolve_native_session_engine_id_only_handles_legacy_prefixed_ids() {
        assert_eq!(
            resolve_native_session_engine_id("codex-native:legacy-session"),
            Some("codex")
        );
        assert_eq!(resolve_native_session_engine_id("legacy-session"), None);
    }
}
