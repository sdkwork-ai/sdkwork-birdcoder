use std::sync::OnceLock;

use serde::{Deserialize, Serialize};

const ENGINE_CATALOG_CANONICAL_TIMESTAMP: &str = "2026-04-24T00:00:00.000Z";
const ENGINE_CATALOG_DEFAULT_TENANT_ID: &str = "0";

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
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub uuid: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    pub engine_key: String,
    pub display_name: String,
    pub vendor: String,
    pub installation_kind: String,
    pub default_model_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub homepage: Option<String>,
    pub supported_host_modes: Vec<String>,
    pub transport_kinds: Vec<String>,
    pub capability_matrix: CodeEngineCapabilityMatrixRecord,
    #[serde(default)]
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub access_plan: Option<CodeEngineAccessPlanRecord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub official_integration: Option<CodeEngineOfficialIntegrationRecord>,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CodeEngineIntegrationClassRecord {
    OfficialSdk,
    OfficialProtocol,
    SourceDerived,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CodeEngineRuntimeModeRecord {
    Sdk,
    Headless,
    RemoteControl,
    ProtocolFallback,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineOfficialEntryRecord {
    pub package_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub package_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sdk_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cli_package_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_mirror_path: Option<String>,
    #[serde(default)]
    pub supplemental_lanes: Vec<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodeEngineOfficialIntegrationRecord {
    pub integration_class: CodeEngineIntegrationClassRecord,
    pub runtime_mode: CodeEngineRuntimeModeRecord,
    pub official_entry: CodeEngineOfficialEntryRecord,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
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
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub uuid: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tenant_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization_id: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    pub engine_key: String,
    pub model_id: String,
    pub display_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
    #[serde(default)]
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
                    transport_kinds: vec!["cli-jsonl".to_owned()],
                    discovery_mode: NativeSessionDiscoveryModeRecord::PassiveGlobal,
                },
                NativeSessionProviderCatalogRecord {
                    engine_id: "opencode".to_owned(),
                    display_name: "OpenCode".to_owned(),
                    native_session_id_prefix: "opencode-native:".to_owned(),
                    transport_kinds: vec!["openapi-http".to_owned()],
                    discovery_mode: NativeSessionDiscoveryModeRecord::ExplicitOnly,
                },
            ]
        })
        .as_slice()
}

fn build_stable_catalog_uuid(seed: &str) -> String {
    let mut hex = seed
        .as_bytes()
        .iter()
        .map(|value| format!("{value:02x}"))
        .collect::<String>();
    if hex.len() < 32 {
        hex.push_str("0123456789abcdef0123456789abcdef");
    }
    let normalized = &hex[..32];
    format!(
        "{}-{}-{}-{}-{}",
        &normalized[..8],
        &normalized[8..12],
        &normalized[12..16],
        &normalized[16..20],
        &normalized[20..32]
    )
}

fn backfill_codeengine_descriptor_record(record: &mut CodeEngineDescriptorRecord) {
    let identity_seed = format!("engine-registry:{}", record.engine_key);
    if record.id.trim().is_empty() {
        record.id = identity_seed.clone();
    }
    if record.uuid.trim().is_empty() {
        record.uuid = build_stable_catalog_uuid(identity_seed.as_str());
    }
    if record.created_at.trim().is_empty() {
        record.created_at = ENGINE_CATALOG_CANONICAL_TIMESTAMP.to_owned();
    }
    if record.updated_at.trim().is_empty() {
        record.updated_at = ENGINE_CATALOG_CANONICAL_TIMESTAMP.to_owned();
    }
    if record.status.trim().is_empty() {
        record.status = "active".to_owned();
    }
    if record
        .tenant_id
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .is_empty()
    {
        record.tenant_id = Some(ENGINE_CATALOG_DEFAULT_TENANT_ID.to_owned());
    }
    if record
        .organization_id
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .is_empty()
    {
        record.organization_id = None;
    }
}

fn backfill_codeengine_model_catalog_record(record: &mut CodeEngineModelCatalogEntryRecord) {
    let identity_seed = format!("model-catalog:{}:{}", record.engine_key, record.model_id);
    if record.id.trim().is_empty() {
        record.id = identity_seed.clone();
    }
    if record.uuid.trim().is_empty() {
        record.uuid = build_stable_catalog_uuid(identity_seed.as_str());
    }
    if record.created_at.trim().is_empty() {
        record.created_at = ENGINE_CATALOG_CANONICAL_TIMESTAMP.to_owned();
    }
    if record.updated_at.trim().is_empty() {
        record.updated_at = ENGINE_CATALOG_CANONICAL_TIMESTAMP.to_owned();
    }
    if record.status.trim().is_empty() {
        record.status = "active".to_owned();
    }
    if record
        .tenant_id
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .is_empty()
    {
        record.tenant_id = Some(ENGINE_CATALOG_DEFAULT_TENANT_ID.to_owned());
    }
    if record
        .organization_id
        .as_deref()
        .map(str::trim)
        .unwrap_or_default()
        .is_empty()
    {
        record.organization_id = None;
    }
}

fn hydrate_shared_codeengine_catalog(
    mut catalog: SharedCodeEngineCatalogRecord,
) -> SharedCodeEngineCatalogRecord {
    for record in catalog.engines.iter_mut() {
        backfill_codeengine_descriptor_record(record);
    }
    for record in catalog.models.iter_mut() {
        backfill_codeengine_model_catalog_record(record);
    }
    catalog
}

pub fn native_session_provider_catalog_entries() -> &'static [NativeSessionProviderCatalogRecord] {
    let generated_entries = shared_codeengine_catalog().native_providers.as_slice();
    if generated_entries.is_empty() {
        return fallback_native_session_provider_catalog_entries();
    }

    generated_entries
}

pub fn shared_codeengine_catalog() -> &'static SharedCodeEngineCatalogRecord {
    static SHARED_CODEENGINE_CATALOG: OnceLock<SharedCodeEngineCatalogRecord> = OnceLock::new();
    SHARED_CODEENGINE_CATALOG.get_or_init(|| {
        hydrate_shared_codeengine_catalog(
            serde_json::from_str(include_str!("../generated/engine-catalog.json"))
                .expect("parse generated codeengine catalog"),
        )
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
        .find(|provider| {
            provider
                .engine_id
                .eq_ignore_ascii_case(normalized_engine_id.as_str())
        })
}
