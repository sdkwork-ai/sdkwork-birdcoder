use sdkwork_agents_runtime_facade::{
    bootstrap_code_engine, canonical_code_engine_keys, code_engine_agent_id,
    code_engine_binding_id, is_canonical_code_engine, CodeEngineBootstrapError, CodeEngineSlot,
};

/// Canonical BirdCoder engine ids aligned with sdkwork-agents runtime facade.
pub fn canonical_engine_keys() -> &'static [&'static str] {
    canonical_code_engine_keys()
}

pub fn is_canonical_engine_key(engine_key: &str) -> bool {
    is_canonical_code_engine(engine_key)
}

pub fn kernel_agent_id_for_engine(engine_key: &str) -> Option<&'static str> {
    code_engine_agent_id(engine_key)
}

pub fn kernel_binding_id_for_engine(engine_key: &str) -> Option<&'static str> {
    code_engine_binding_id(engine_key)
}

pub type KernelBootstrapError = CodeEngineBootstrapError;
pub type KernelEngineSlot = CodeEngineSlot;

pub fn bootstrap_kernel_slot(engine_key: &str) -> Result<KernelEngineSlot, KernelBootstrapError> {
    bootstrap_code_engine(engine_key)
}

pub fn bootstrap_codex_kernel_slot() -> Result<KernelEngineSlot, KernelBootstrapError> {
    bootstrap_kernel_slot("codex")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_engine_keys_match_agents_facade() {
        assert_eq!(canonical_engine_keys(), canonical_code_engine_keys());
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
