use std::collections::HashMap;

use sdkwork_birdcoder_codeengine::{
    find_codeengine_descriptor, CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord,
};

use crate::engine_registry::{
    bootstrap_kernel_slot, canonical_engine_keys, KernelBootstrapError, KernelEngineSlot,
};
use crate::turn_executor::execute_kernel_turn;

/// BirdCoder integration host for sdkwork-kernel agent runtime slots.
pub struct BirdcoderKernelHost {
    slots: HashMap<String, KernelEngineSlot>,
}

impl BirdcoderKernelHost {
    pub fn bootstrap() -> Result<Self, KernelBootstrapError> {
        let mut slots = HashMap::new();
        for engine_key in canonical_engine_keys() {
            let slot = bootstrap_kernel_slot(engine_key)?;
            slots.insert(engine_key.to_string(), slot);
        }
        Ok(Self { slots })
    }

    pub fn slot(&self, engine_key: &str) -> Option<&KernelEngineSlot> {
        self.slots.get(engine_key)
    }

    pub fn engine_keys(&self) -> impl Iterator<Item = &str> {
        self.slots.keys().map(String::as_str)
    }

    pub fn execute_turn(
        &self,
        request: &CodeEngineTurnRequestRecord,
    ) -> Result<CodeEngineTurnResultRecord, String> {
        let slot = self
            .slots
            .get(request.engine_id.as_str())
            .ok_or_else(|| format!("unsupported engineId \"{}\".", request.engine_id))?;
        execute_kernel_turn(slot, request)
    }

    pub fn validate_engine_id(&self, engine_id: &str) -> Result<(), String> {
        if self.slots.contains_key(engine_id) {
            return Ok(());
        }
        if find_codeengine_descriptor(engine_id).is_some() {
            return Err(format!(
                "engineId \"{engine_id}\" is cataloged but kernel slot is unavailable."
            ));
        }
        Err(format!("unknown engineId \"{engine_id}\"."))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_bootstraps_all_canonical_engines() {
        let host = BirdcoderKernelHost::bootstrap().expect("host bootstrap");
        assert_eq!(host.slots.len(), 4);
    }
}
