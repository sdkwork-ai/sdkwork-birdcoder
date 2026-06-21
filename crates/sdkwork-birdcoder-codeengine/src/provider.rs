use std::{collections::BTreeMap, sync::OnceLock};

use crate::{
    format_missing_native_session_provider_error, native_session_prefix_for_engine,
    resolve_native_session_engine_id, CodeEngineApprovalDecisionRecord,
    CodeEngineSessionDetailRecord, CodeEngineSessionSummaryRecord,
    CodeEngineUserQuestionAnswerRecord, NativeSessionDiscoveryMode,
    NativeSessionProviderRegistration,
};

/// BirdCoder-owned native session inventory provider.
///
/// Agent turn execution belongs to `sdkwork-birdcoder-kernel-bridge`, not this trait.
pub trait NativeSessionProviderPlugin: Send + Sync {
    fn registration(&self) -> &'static NativeSessionProviderRegistration;

    fn list_sessions(&self) -> Result<Vec<CodeEngineSessionSummaryRecord>, String>;

    fn get_session(
        &self,
        session_id: &str,
    ) -> Result<Option<CodeEngineSessionDetailRecord>, String>;

    fn get_session_summary(
        &self,
        session_id: &str,
    ) -> Result<Option<CodeEngineSessionSummaryRecord>, String> {
        Ok(self.get_session(session_id)?.map(|detail| detail.summary))
    }

    fn supports_live_approval_decision_replies(&self) -> bool {
        false
    }

    fn supports_live_user_question_replies(&self) -> bool {
        false
    }

    fn submit_approval_decision(
        &self,
        decision: &CodeEngineApprovalDecisionRecord,
    ) -> Result<(), String> {
        Err(format!(
            "Native code engine provider \"{}\" does not support live approval decision replies for approval {}.",
            self.registration().engine_id,
            decision.approval_id
        ))
    }

    fn submit_user_question_answer(
        &self,
        answer: &CodeEngineUserQuestionAnswerRecord,
    ) -> Result<(), String> {
        Err(format!(
            "Native code engine provider \"{}\" does not support live user-question replies for question {}.",
            self.registration().engine_id,
            answer.question_id
        ))
    }
}

pub struct NativeSessionProviderRegistry {
    providers: BTreeMap<String, Box<dyn NativeSessionProviderPlugin>>,
}

impl NativeSessionProviderRegistry {
    pub fn new_standard() -> Self {
        let mut providers: BTreeMap<String, Box<dyn NativeSessionProviderPlugin>> = BTreeMap::new();

        let codex_provider = Box::new(crate::codex_provider::CodexCodeEngineProvider);
        providers.insert(
            codex_provider.registration().engine_id.clone(),
            codex_provider,
        );

        let claude_code_provider = Box::new(crate::claude_code_provider::ClaudeCodeEngineProvider);
        providers.insert(
            claude_code_provider.registration().engine_id.clone(),
            claude_code_provider,
        );

        let gemini_provider = Box::new(crate::gemini_provider::GeminiCodeEngineProvider);
        providers.insert(
            gemini_provider.registration().engine_id.clone(),
            gemini_provider,
        );

        let opencode_provider = Box::new(crate::opencode_provider::OpencodeCodeEngineProvider);
        providers.insert(
            opencode_provider.registration().engine_id.clone(),
            opencode_provider,
        );

        Self { providers }
    }

    pub fn resolve_provider(
        &self,
        engine_id: Option<&str>,
    ) -> Result<Vec<&dyn NativeSessionProviderPlugin>, String> {
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

pub fn standard_native_session_provider_registry() -> &'static NativeSessionProviderRegistry {
    static STANDARD_NATIVE_SESSION_PROVIDER_REGISTRY: OnceLock<NativeSessionProviderRegistry> =
        OnceLock::new();
    STANDARD_NATIVE_SESSION_PROVIDER_REGISTRY
        .get_or_init(NativeSessionProviderRegistry::new_standard)
}

#[deprecated(
    since = "0.2.0",
    note = "Use standard_native_session_provider_registry(); turn execution moved to sdkwork-birdcoder-kernel-bridge."
)]
pub fn standard_codeengine_provider_registry() -> &'static NativeSessionProviderRegistry {
    standard_native_session_provider_registry()
}

pub type CodeEngineProviderPlugin = NativeSessionProviderPlugin;
pub type CodeEngineProviderRegistry = NativeSessionProviderRegistry;

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

fn normalize_non_empty_string(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}
