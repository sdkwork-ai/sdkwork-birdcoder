mod catalog;
mod codex;
mod codex_provider;
mod codex_sessions;
mod opencode;
mod opencode_provider;
mod provider;
mod session_records;
mod turns;

pub use catalog::{
    CodeEngineAccessLaneStatusRecord, CodeEngineAccessStrategyKindRecord,
    CodeEngineBridgeProtocolRecord, CodeEngineRuntimeOwnerRecord,
    find_codeengine_descriptor, find_native_session_provider_catalog_entry,
    list_codeengine_descriptors, list_codeengine_model_catalog_entries,
    list_native_session_provider_catalog_entries, native_session_provider_catalog_entries,
    shared_codeengine_catalog,
    CodeEngineCapabilityMatrixRecord, CodeEngineDescriptorRecord,
    NativeSessionProviderCatalogRecord,
    NativeSessionDiscoveryModeRecord as NativeSessionDiscoveryMode,
    NativeSessionProviderCatalogRecord as NativeSessionProviderRegistration,
    CodeEngineModelCatalogEntryRecord, PartialCodeEngineCapabilityMatrixRecord,
    SharedCodeEngineCatalogRecord,
};
pub use codex::{CodexCliTurnRequest, CodexCliTurnResult, execute_codex_cli_turn};
pub use codex_sessions::{
    CodexSessionIndexEntry, get_codex_session_detail, get_codex_session_summary,
    list_codex_session_summaries, normalize_codex_prompt_title, parse_codex_session_detail,
    parse_codex_session_summary,
};
pub use codex_provider::CodexCodeEngineProvider;
pub use opencode::{
    create_opencode_session, get_opencode_session, get_opencode_session_messages,
    is_opencode_transport_available, list_opencode_session_status_map, list_opencode_sessions,
    prompt_opencode_session,
};
pub use opencode_provider::OpencodeCodeEngineProvider;
pub use provider::{
    extract_native_lookup_id_for_engine, session_id_targets_engine, standard_codeengine_provider_registry,
    CodeEngineProviderPlugin, CodeEngineProviderRegistry,
};
pub use session_records::{
    CodeEngineSessionCommandRecord, CodeEngineSessionDetailRecord,
    CodeEngineSessionMessageRecord, CodeEngineSessionSummaryRecord,
};
pub use turns::{
    build_codeengine_turn_prompt, CodeEngineTurnConfigRecord,
    CodeEngineTurnCurrentFileContextRecord, CodeEngineTurnIdeContextRecord,
    CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord,
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
        "Native session provider for engine \"{engine_id}\" is not implemented yet. TODO: add an engine plugin under sdkwork-birdcoder-codeengine/src-host."
    )
}

pub fn format_unimplemented_native_session_provider_error(
    registration: &NativeSessionProviderRegistration,
) -> String {
    let transport_summary = registration.transport_kinds.join(", ");
    format!(
        "Native session provider for engine \"{}\" ({}) is registered but not implemented in the Rust server yet. TODO: add a dedicated provider plugin under sdkwork-birdcoder-codeengine/src-host for transport(s): {}.",
        registration.engine_id, registration.display_name, transport_summary
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

pub fn build_native_session_id(engine_id: &str, native_session_id: &str) -> String {
    let prefix = native_session_prefix_for_engine(engine_id).unwrap_or_default();
    format!("{prefix}{}", native_session_id.trim())
}

pub fn opencode_server_attach_url_env() -> &'static str {
    OPENCODE_SERVER_ATTACH_URL_ENV
}
