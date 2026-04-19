use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum NativeSessionDiscoveryModeRecord {
    ExplicitOnly,
    PassiveGlobal,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineCapabilityMatrixRecord {
    pub chat: bool,
    pub streaming: bool,
    pub structured_output: bool,
    pub tool_calls: bool,
    pub planning: bool,
    pub patch_artifacts: bool,
    pub command_artifacts: bool,
    pub todo_artifacts: bool,
    pub pty_artifacts: bool,
    pub preview_artifacts: bool,
    pub test_artifacts: bool,
    pub approval_checkpoints: bool,
    pub session_resume: bool,
    pub remote_bridge: bool,
    pub mcp: bool,
}

#[derive(Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PartialCodeEngineCapabilityMatrixRecord {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chat: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub streaming: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub structured_output: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub planning: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub patch_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub command_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub todo_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pty_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub test_artifacts: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub approval_checkpoints: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_resume: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remote_bridge: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mcp: Option<bool>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineDescriptorRecord {
    pub engine_key: String,
    pub display_name: String,
    pub vendor: String,
    pub installation_kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_model_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    pub supported_host_modes: Vec<String>,
    pub transport_kinds: Vec<String>,
    pub capability_matrix: CodeEngineCapabilityMatrixRecord,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_plan: Option<CodeEngineAccessPlanRecord>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CodeEngineAccessStrategyKindRecord {
    RustNative,
    GrpcBridge,
    OpenapiProxy,
    RemoteControl,
    CliSpawn,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CodeEngineAccessLaneStatusRecord {
    Ready,
    Planned,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CodeEngineRuntimeOwnerRecord {
    RustServer,
    TypescriptBridge,
    ExternalService,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CodeEngineBridgeProtocolRecord {
    Direct,
    Grpc,
    Http,
    Websocket,
    Stdio,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineAccessLaneRecord {
    pub lane_id: String,
    pub label: String,
    pub strategy_kind: CodeEngineAccessStrategyKindRecord,
    pub runtime_owner: CodeEngineRuntimeOwnerRecord,
    pub bridge_protocol: CodeEngineBridgeProtocolRecord,
    pub transport_kind: String,
    pub status: CodeEngineAccessLaneStatusRecord,
    pub enabled_by_default: bool,
    pub host_modes: Vec<String>,
    pub description: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineAccessPlanRecord {
    pub primary_lane_id: String,
    pub fallback_lane_ids: Vec<String>,
    pub lanes: Vec<CodeEngineAccessLaneRecord>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineModelCatalogEntryRecord {
    pub engine_key: String,
    pub model_id: String,
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
    pub status: String,
    pub default_for_engine: bool,
    pub transport_kinds: Vec<String>,
    pub capability_matrix: PartialCodeEngineCapabilityMatrixRecord,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionProviderCatalogRecord {
    pub engine_id: String,
    pub display_name: String,
    pub native_session_id_prefix: String,
    pub transport_kinds: Vec<String>,
    pub discovery_mode: NativeSessionDiscoveryModeRecord,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SharedCodeEngineCatalogRecord {
    pub engines: Vec<CodeEngineDescriptorRecord>,
    pub models: Vec<CodeEngineModelCatalogEntryRecord>,
    #[serde(default)]
    pub native_providers: Vec<NativeSessionProviderCatalogRecord>,
}

fn fallback_native_session_provider_catalog_entries(
) -> &'static [NativeSessionProviderCatalogRecord] {
    static FALLBACK_NATIVE_SESSION_PROVIDER_CATALOG: OnceLock<
        Vec<NativeSessionProviderCatalogRecord>,
    > = OnceLock::new();
    FALLBACK_NATIVE_SESSION_PROVIDER_CATALOG
        .get_or_init(|| {
            vec![
                NativeSessionProviderCatalogRecord {
                    engine_id: "codex".to_owned(),
                    display_name: "Codex".to_owned(),
                    native_session_id_prefix: "codex-native:".to_owned(),
                    transport_kinds: vec!["sdk-stream".to_owned(), "cli-jsonl".to_owned()],
                    discovery_mode: NativeSessionDiscoveryModeRecord::PassiveGlobal,
                },
                NativeSessionProviderCatalogRecord {
                    engine_id: "claude-code".to_owned(),
                    display_name: "Claude Code".to_owned(),
                    native_session_id_prefix: "claude-code-native:".to_owned(),
                    transport_kinds: vec![
                        "sdk-stream".to_owned(),
                        "remote-control-http".to_owned(),
                    ],
                    discovery_mode: NativeSessionDiscoveryModeRecord::ExplicitOnly,
                },
                NativeSessionProviderCatalogRecord {
                    engine_id: "gemini".to_owned(),
                    display_name: "Gemini".to_owned(),
                    native_session_id_prefix: "gemini-native:".to_owned(),
                    transport_kinds: vec!["sdk-stream".to_owned(), "openapi-http".to_owned()],
                    discovery_mode: NativeSessionDiscoveryModeRecord::ExplicitOnly,
                },
                NativeSessionProviderCatalogRecord {
                    engine_id: "opencode".to_owned(),
                    display_name: "OpenCode".to_owned(),
                    native_session_id_prefix: "opencode-native:".to_owned(),
                    transport_kinds: vec![
                        "sdk-stream".to_owned(),
                        "openapi-http".to_owned(),
                        "cli-jsonl".to_owned(),
                    ],
                    discovery_mode: NativeSessionDiscoveryModeRecord::ExplicitOnly,
                },
            ]
        })
        .as_slice()
}

pub fn native_session_provider_catalog_entries(
) -> &'static [NativeSessionProviderCatalogRecord] {
    let generated_entries = shared_codeengine_catalog().native_providers.as_slice();
    if generated_entries.is_empty() {
        return fallback_native_session_provider_catalog_entries();
    }

    generated_entries
}

pub fn shared_codeengine_catalog() -> &'static SharedCodeEngineCatalogRecord {
    static SHARED_CODEENGINE_CATALOG: OnceLock<SharedCodeEngineCatalogRecord> = OnceLock::new();
    SHARED_CODEENGINE_CATALOG.get_or_init(|| {
        serde_json::from_str(include_str!("../generated/engine-catalog.json"))
            .expect("parse generated codeengine catalog")
    })
}

pub fn list_codeengine_descriptors() -> Vec<CodeEngineDescriptorRecord> {
    shared_codeengine_catalog().engines.clone()
}

pub fn list_codeengine_model_catalog_entries() -> Vec<CodeEngineModelCatalogEntryRecord> {
    shared_codeengine_catalog().models.clone()
}

pub fn list_native_session_provider_catalog_entries() -> Vec<NativeSessionProviderCatalogRecord> {
    native_session_provider_catalog_entries().to_vec()
}

pub fn find_codeengine_descriptor(engine_key: &str) -> Option<CodeEngineDescriptorRecord> {
    let normalized_engine_key = engine_key.trim().to_ascii_lowercase();
    shared_codeengine_catalog()
        .engines
        .iter()
        .find(|engine| {
            engine
                .engine_key
                .eq_ignore_ascii_case(normalized_engine_key.as_str())
        })
        .cloned()
}

pub fn find_native_session_provider_catalog_entry(
    engine_id: &str,
) -> Option<&'static NativeSessionProviderCatalogRecord> {
    let normalized_engine_id = engine_id.trim().to_ascii_lowercase();
    native_session_provider_catalog_entries()
        .iter()
        .find(|provider| provider.engine_id.eq_ignore_ascii_case(normalized_engine_id.as_str()))
}
