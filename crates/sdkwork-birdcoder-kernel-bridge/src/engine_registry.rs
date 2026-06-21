use sdkwork_agent_adapter_claude_code::ClaudeCodeSdkIntegration;
use sdkwork_agent_adapter_codex::CodexSdkIntegration;
use sdkwork_agent_adapter_gemini_cli::GeminiCliSdkIntegration;
use sdkwork_agent_adapter_opencode::OpenCodeSdkIntegration;
use sdkwork_agent_kernel::{KernelResult, ModelProvider, ModelRequest, ModelResponse};

/// Canonical BirdCoder engine ids aligned with sdkwork-kernel agent bindings.
pub const CANONICAL_ENGINE_KEYS: [&str; 4] = ["codex", "claude-code", "gemini", "opencode"];

pub fn canonical_engine_keys() -> &'static [&'static str] {
    &CANONICAL_ENGINE_KEYS
}

pub fn is_canonical_engine_key(engine_key: &str) -> bool {
    CANONICAL_ENGINE_KEYS.contains(&engine_key)
}

pub fn kernel_agent_id_for_engine(engine_key: &str) -> Option<&'static str> {
    match engine_key {
        "codex" => Some("agent.intelligence.codex"),
        "claude-code" => Some("agent.intelligence.claude-code"),
        "gemini" => Some("agent.intelligence.gemini"),
        "opencode" => Some("agent.intelligence.opencode"),
        _ => None,
    }
}

pub fn kernel_binding_id_for_engine(engine_key: &str) -> Option<&'static str> {
    match engine_key {
        "codex" => Some("binding.agent-sdk.codex"),
        "claude-code" => Some("binding.agent-sdk.claude-code"),
        "gemini" => Some("binding.agent-sdk.gemini-cli"),
        "opencode" => Some("binding.agent-sdk.opencode"),
        _ => None,
    }
}

#[derive(Debug)]
pub enum KernelBootstrapError {
    UnsupportedEngine(String),
    Bootstrap(String),
}

impl std::fmt::Display for KernelBootstrapError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UnsupportedEngine(engine) => {
                write!(f, "unsupported engine for kernel bootstrap: {engine}")
            }
            Self::Bootstrap(message) => write!(f, "kernel bootstrap failed: {message}"),
        }
    }
}

impl std::error::Error for KernelBootstrapError {}

/// Bootstrapped kernel slot for one canonical engine.
pub enum KernelEngineSlot {
    Codex(CodexSdkIntegration),
    ClaudeCode(ClaudeCodeSdkIntegration),
    Gemini(GeminiCliSdkIntegration),
    OpenCode(OpenCodeSdkIntegration),
}

impl KernelEngineSlot {
    pub fn engine_key(&self) -> &'static str {
        match self {
            Self::Codex(_) => "codex",
            Self::ClaudeCode(_) => "claude-code",
            Self::Gemini(_) => "gemini",
            Self::OpenCode(_) => "opencode",
        }
    }

    pub fn binding_id(&self) -> &str {
        match self {
            Self::Codex(integration) => integration.binding_id(),
            Self::ClaudeCode(integration) => integration.binding_id(),
            Self::Gemini(integration) => integration.binding_id(),
            Self::OpenCode(integration) => integration.binding_id(),
        }
    }

    pub fn list_model_ids(&self) -> Vec<String> {
        self.model_provider()
            .list_models()
            .into_iter()
            .map(|descriptor| descriptor.model_id)
            .collect()
    }

    pub fn invoke_model(&self, request: ModelRequest) -> KernelResult<ModelResponse> {
        self.model_provider().invoke(request)
    }

    fn model_provider(&self) -> &dyn ModelProvider {
        match self {
            Self::Codex(integration) => &integration.model,
            Self::ClaudeCode(integration) => &integration.model,
            Self::Gemini(integration) => &integration.model,
            Self::OpenCode(integration) => &integration.model,
        }
    }
}

pub fn bootstrap_kernel_slot(engine_key: &str) -> Result<KernelEngineSlot, KernelBootstrapError> {
    match engine_key {
        "codex" => CodexSdkIntegration::bootstrap()
            .map(KernelEngineSlot::Codex)
            .map_err(|error| KernelBootstrapError::Bootstrap(error.to_string())),
        "claude-code" => ClaudeCodeSdkIntegration::bootstrap()
            .map(KernelEngineSlot::ClaudeCode)
            .map_err(|error| KernelBootstrapError::Bootstrap(error.to_string())),
        "gemini" => GeminiCliSdkIntegration::bootstrap()
            .map(KernelEngineSlot::Gemini)
            .map_err(|error| KernelBootstrapError::Bootstrap(error.to_string())),
        "opencode" => OpenCodeSdkIntegration::bootstrap()
            .map(KernelEngineSlot::OpenCode)
            .map_err(|error| KernelBootstrapError::Bootstrap(error.to_string())),
        other => Err(KernelBootstrapError::UnsupportedEngine(other.to_string())),
    }
}

pub fn bootstrap_codex_kernel_slot() -> Result<KernelEngineSlot, KernelBootstrapError> {
    bootstrap_kernel_slot("codex")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_engine_keys_match_kernel_bindings() {
        for engine in canonical_engine_keys() {
            assert!(kernel_agent_id_for_engine(engine).is_some());
            assert!(kernel_binding_id_for_engine(engine).is_some());
        }
    }

    #[test]
    fn all_canonical_kernel_slots_bootstrap() {
        for engine in canonical_engine_keys() {
            let slot = bootstrap_kernel_slot(engine).unwrap_or_else(|error| {
                panic!("bootstrap failed for {engine}: {error}");
            });
            assert_eq!(slot.engine_key(), *engine);
            assert!(!slot.list_model_ids().is_empty());
        }
    }
}
