use std::{collections::BTreeMap, sync::OnceLock};

use crate::{
    format_missing_native_session_provider_error, format_unimplemented_native_session_provider_error,
    lookup_standard_native_session_provider_registration, native_session_prefix_for_engine,
    resolve_native_session_engine_id, CodeEngineSessionDetailRecord, CodeEngineSessionSummaryRecord,
    CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord, NativeSessionDiscoveryMode,
    NativeSessionProviderRegistration, standard_native_session_provider_registrations,
};

pub trait CodeEngineProviderPlugin: Send + Sync {
    fn registration(&self) -> &'static NativeSessionProviderRegistration;

    fn list_sessions(&self) -> Result<Vec<CodeEngineSessionSummaryRecord>, String>;

    fn get_session(&self, session_id: &str) -> Result<Option<CodeEngineSessionDetailRecord>, String>;

    fn get_session_summary(
        &self,
        session_id: &str,
    ) -> Result<Option<CodeEngineSessionSummaryRecord>, String> {
        Ok(self.get_session(session_id)?.map(|detail| detail.summary))
    }

    fn execute_turn(
        &self,
        request: &CodeEngineTurnRequestRecord,
    ) -> Result<CodeEngineTurnResultRecord, String>;
}

pub struct CodeEngineProviderRegistry {
    providers: BTreeMap<String, Box<dyn CodeEngineProviderPlugin>>,
}

impl CodeEngineProviderRegistry {
    pub fn new_standard() -> Self {
        let mut providers: BTreeMap<String, Box<dyn CodeEngineProviderPlugin>> = BTreeMap::new();

        let codex_provider = Box::new(crate::codex_provider::CodexCodeEngineProvider);
        providers.insert(codex_provider.registration().engine_id.clone(), codex_provider);

        let opencode_provider = Box::new(crate::opencode_provider::OpencodeCodeEngineProvider);
        providers.insert(
            opencode_provider.registration().engine_id.clone(),
            opencode_provider,
        );

        for registration in standard_native_session_provider_registrations() {
            providers
                .entry(registration.engine_id.clone())
                .or_insert_with(|| {
                    Box::new(UnsupportedCodeEngineProvider::new(
                        registration.engine_id.as_str(),
                    ))
                });
        }

        Self { providers }
    }

    pub fn resolve_provider(
        &self,
        engine_id: Option<&str>,
    ) -> Result<Vec<&dyn CodeEngineProviderPlugin>, String> {
        if let Some(engine_id) = normalize_non_empty_string(engine_id) {
            let provider = self
                .providers
                .get(engine_id.as_str())
                .ok_or_else(|| format_missing_native_session_provider_error(engine_id.as_str()))?;
            return Ok(vec![provider.as_ref()]);
        }

        Ok(self
            .providers
            .values()
            .filter(|provider| {
                provider.registration().discovery_mode == NativeSessionDiscoveryMode::PassiveGlobal
            })
            .map(|provider| provider.as_ref())
            .collect())
    }
}

pub fn standard_codeengine_provider_registry() -> &'static CodeEngineProviderRegistry {
    static STANDARD_CODEENGINE_PROVIDER_REGISTRY: OnceLock<CodeEngineProviderRegistry> =
        OnceLock::new();
    STANDARD_CODEENGINE_PROVIDER_REGISTRY.get_or_init(CodeEngineProviderRegistry::new_standard)
}

pub fn session_id_targets_engine(session_id: &str, engine_id: &str) -> bool {
    resolve_native_session_engine_id(session_id)
        .map(|resolved_engine_id| resolved_engine_id == engine_id.trim().to_ascii_lowercase())
        .unwrap_or(true)
}

pub fn extract_native_lookup_id_for_engine(
    session_id: &str,
    engine_id: &str,
) -> Result<String, String> {
    let normalized = session_id.trim();
    if normalized.is_empty() {
        return Err("Native session id is required.".to_owned());
    }

    let Some(prefix) = native_session_prefix_for_engine(engine_id) else {
        return Ok(normalized.to_owned());
    };

    if let Some(resolved_engine_id) = resolve_native_session_engine_id(normalized) {
        if resolved_engine_id != engine_id.trim().to_ascii_lowercase() {
            return Err(format!(
                "Native session id \"{normalized}\" belongs to engine \"{resolved_engine_id}\", not \"{engine_id}\"."
            ));
        }
    }

    Ok(normalized
        .strip_prefix(prefix)
        .unwrap_or(normalized)
        .trim()
        .to_owned())
}

struct UnsupportedCodeEngineProvider {
    registration: &'static NativeSessionProviderRegistration,
}

impl UnsupportedCodeEngineProvider {
    fn new(engine_id: &'static str) -> Self {
        Self {
            registration: lookup_standard_native_session_provider_registration(engine_id)
                .unwrap_or_else(|| {
                    panic!(
                        "standard native session provider registration missing for engine {engine_id}"
                    )
                }),
        }
    }

    fn create_not_implemented_error(&self) -> String {
        format_unimplemented_native_session_provider_error(self.registration)
    }
}

impl CodeEngineProviderPlugin for UnsupportedCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        self.registration
    }

    fn list_sessions(&self) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
        Ok(Vec::new())
    }

    fn get_session(
        &self,
        _session_id: &str,
    ) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
        Ok(None)
    }

    fn execute_turn(
        &self,
        _request: &CodeEngineTurnRequestRecord,
    ) -> Result<CodeEngineTurnResultRecord, String> {
        Err(self.create_not_implemented_error())
    }
}

fn normalize_non_empty_string(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}
