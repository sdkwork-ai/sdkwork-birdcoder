use std::collections::HashMap;

use sdkwork_birdcoder_codeengine::{
    find_codeengine_descriptor, CodeEngineApprovalDecisionRecord, CodeEngineTurnRequestRecord,
    CodeEngineTurnResultRecord, CodeEngineUserQuestionAnswerRecord,
};

use crate::engine_registry::{
    bootstrap_kernel_slot, canonical_engine_keys, KernelBootstrapError, KernelEngineSlot,
};
use crate::live_interaction::{
    submit_approval_decision as route_approval_decision,
    submit_user_question_answer as route_user_question_answer,
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

    pub fn submit_approval_decision(
        &self,
        engine_id: &str,
        decision: &CodeEngineApprovalDecisionRecord,
    ) -> Result<(), String> {
        self.validate_engine_id(engine_id)?;
        route_approval_decision(engine_id, decision)
    }

    pub fn submit_user_question_answer(
        &self,
        engine_id: &str,
        answer: &CodeEngineUserQuestionAnswerRecord,
    ) -> Result<(), String> {
        self.validate_engine_id(engine_id)?;
        route_user_question_answer(engine_id, answer)
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
