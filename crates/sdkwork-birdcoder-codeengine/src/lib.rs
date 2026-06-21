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

pub mod codex_cli;
pub mod native_session;
mod native_session_catalog;

pub use native_session::{
    build_native_session_id, format_missing_native_session_provider_error,
    is_authority_backed_native_session_id, lookup_standard_native_session_provider_registration,
    native_session_prefix_for_engine, resolve_native_session_engine_id,
    standard_native_session_provider_registrations,
};
pub use native_session_catalog::{
    get_codeengine_native_session_detail, get_codeengine_native_session_summary,
    list_codeengine_native_session_summaries,
};

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
    prompt_opencode_session, prompt_opencode_session_async, reject_opencode_question_request,
    reply_opencode_permission_request, reply_opencode_question_request,
    stream_opencode_session_events,
};
pub use opencode_provider::OpencodeCodeEngineProvider;
pub use provider::{
    extract_native_lookup_id_for_engine, session_id_targets_engine,
    standard_native_session_provider_registry, NativeSessionProviderPlugin,
    NativeSessionProviderRegistry,
    #[deprecated(note = "Use standard_native_session_provider_registry()")]
    standard_codeengine_provider_registry,
    #[deprecated(note = "Use NativeSessionProviderPlugin")]
    CodeEngineProviderPlugin,
    #[deprecated(note = "Use NativeSessionProviderRegistry")]
    CodeEngineProviderRegistry,
};
pub use sdk_bridge::{
    get_sdk_bridge_session_detail, list_sdk_bridge_session_summaries, CODEENGINE_HOME_ENV,
    CODEENGINE_SDK_BRIDGE_HOME_ENV,
};
pub use session_records::{
    CodeEngineSessionCommandRecord, CodeEngineSessionDetailRecord, CodeEngineSessionMessageRecord,
    CodeEngineSessionSummaryRecord,
};
pub use turns::{
    build_codeengine_turn_prompt, CodeEngineApprovalDecisionRecord, CodeEngineTurnConfigRecord,
    CodeEngineTurnCurrentFileContextRecord, CodeEngineTurnIdeContextRecord,
    CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord, CodeEngineTurnStreamEventRecord,
    CodeEngineUserQuestionAnswerRecord,
};

pub const OPENCODE_SERVER_ATTACH_URL_ENV: &str = "OPENCODE_SERVER_URL";

pub fn opencode_server_attach_url_env() -> &'static str {
    OPENCODE_SERVER_ATTACH_URL_ENV
}
