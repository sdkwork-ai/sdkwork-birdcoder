use std::sync::Arc;

use sdkwork_agents_runtime_facade::{
    AgentsCodeEngineHost, ApprovalDecision, EngineLiveInteraction, LiveInteractionRegistry,
    RuntimeFacadeError, UserQuestionAnswer,
};
use sdkwork_birdcoder_codeengine::{
    find_codeengine_descriptor, reject_opencode_question_request,
    reply_opencode_permission_request, reply_opencode_question_request,
    CodeEngineApprovalDecisionRecord, CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord,
    CodeEngineUserQuestionAnswerRecord,
};

use crate::turn_executor::execute_kernel_turn;

struct OpenCodeLiveInteraction;

impl EngineLiveInteraction for OpenCodeLiveInteraction {
    fn submit_approval(&self, decision: &ApprovalDecision) -> Result<(), RuntimeFacadeError> {
        reply_opencode_permission_request(
            decision.approval_id.as_str(),
            decision.decision.as_str(),
            decision.reason.as_deref(),
        )
        .map_err(RuntimeFacadeError::Handler)
    }

    fn submit_user_question(&self, answer: &UserQuestionAnswer) -> Result<(), RuntimeFacadeError> {
        if answer.rejected {
            return reject_opencode_question_request(answer.question_id.as_str())
                .map_err(RuntimeFacadeError::Handler);
        }
        reply_opencode_question_request(
            answer.question_id.as_str(),
            answer.answer.as_str(),
            answer.option_label.as_deref(),
        )
        .map_err(RuntimeFacadeError::Handler)
    }
}

fn build_live_registry() -> LiveInteractionRegistry {
    let mut live = LiveInteractionRegistry::new();
    live.register("opencode", Arc::new(OpenCodeLiveInteraction));
    live
}

/// BirdCoder integration host backed by `sdkwork-agents` runtime facade.
pub struct BirdcoderKernelHost {
    inner: AgentsCodeEngineHost,
}

impl BirdcoderKernelHost {
    pub fn bootstrap() -> Result<Self, sdkwork_agents_runtime_facade::CodeEngineBootstrapError> {
        Ok(Self {
            inner: AgentsCodeEngineHost::bootstrap_selected(
                crate::canonical_engine_keys(),
                build_live_registry(),
            ),
        })
    }

    pub fn slot(&self, engine_key: &str) -> Option<&sdkwork_agents_runtime_facade::CodeEngineSlot> {
        crate::is_canonical_engine_key(engine_key)
            .then(|| self.inner.slot(engine_key))
            .flatten()
    }

    pub fn engine_keys(&self) -> impl Iterator<Item = &str> {
        self.inner
            .engine_keys()
            .filter(|engine_key| crate::is_canonical_engine_key(engine_key))
    }

    pub fn execute_turn(
        &self,
        request: &CodeEngineTurnRequestRecord,
    ) -> Result<CodeEngineTurnResultRecord, String> {
        let slot = self
            .slot(request.engine_id.as_str())
            .ok_or_else(|| format!("unsupported engineId \"{}\".", request.engine_id))?;
        execute_kernel_turn(slot, request)
    }

    pub fn submit_approval_decision(
        &self,
        engine_id: &str,
        decision: &CodeEngineApprovalDecisionRecord,
    ) -> Result<(), String> {
        self.validate_engine_id(engine_id)?;
        self.inner
            .submit_approval_decision(
                engine_id,
                &ApprovalDecision {
                    native_session_id: decision.native_session_id.clone(),
                    approval_id: decision.approval_id.clone(),
                    decision: decision.decision.clone(),
                    reason: decision.reason.clone(),
                },
            )
            .map_err(|error| error.to_string())
    }

    pub fn submit_user_question_answer(
        &self,
        engine_id: &str,
        answer: &CodeEngineUserQuestionAnswerRecord,
    ) -> Result<(), String> {
        self.validate_engine_id(engine_id)?;
        self.inner
            .submit_user_question_answer(
                engine_id,
                &UserQuestionAnswer {
                    native_session_id: answer.native_session_id.clone(),
                    question_id: answer.question_id.clone(),
                    answer: answer.answer.clone(),
                    rejected: answer.rejected,
                    option_label: answer.option_label.clone(),
                },
            )
            .map_err(|error| error.to_string())
    }

    pub fn validate_engine_id(&self, engine_id: &str) -> Result<(), String> {
        if !crate::is_canonical_engine_key(engine_id) {
            return Err(format!(
                "engineId \"{engine_id}\" is not enabled for BirdCoder."
            ));
        }
        if self.inner.validate_engine_key(engine_id).is_ok() {
            return Ok(());
        }
        if find_codeengine_descriptor(engine_id).is_some() {
            return Err(format!(
                "engineId \"{engine_id}\" is cataloged but agents runtime slot is unavailable."
            ));
        }
        Err(format!("unknown engineId \"{engine_id}\"."))
    }
}

pub fn submit_approval_decision(
    engine_id: &str,
    decision: &CodeEngineApprovalDecisionRecord,
) -> Result<(), String> {
    let host = BirdcoderKernelHost::bootstrap().map_err(|error| error.to_string())?;
    host.submit_approval_decision(engine_id, decision)
}

pub fn submit_user_question_answer(
    engine_id: &str,
    answer: &CodeEngineUserQuestionAnswerRecord,
) -> Result<(), String> {
    let host = BirdcoderKernelHost::bootstrap().map_err(|error| error.to_string())?;
    host.submit_user_question_answer(engine_id, answer)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_bootstraps_all_canonical_engines() {
        let host = BirdcoderKernelHost::bootstrap().expect("host bootstrap");
        for engine_key in crate::canonical_engine_keys() {
            assert!(
                host.engine_keys().any(|key| key == *engine_key),
                "missing canonical engine {engine_key}"
            );
        }
    }

    #[test]
    fn unsupported_engine_returns_clear_error_for_approval() {
        let err = submit_approval_decision(
            "codex",
            &CodeEngineApprovalDecisionRecord {
                approval_id: "perm-1".to_string(),
                decision: "approve".to_string(),
                ..Default::default()
            },
        )
        .expect_err("codex should not support live approval yet");
        assert!(err.contains("codex"));
    }

    #[test]
    fn product_host_does_not_expose_t2_engines() {
        let host = BirdcoderKernelHost::bootstrap().expect("host bootstrap");

        for engine_key in ["openclaw", "hermes"] {
            assert!(
                host.slot(engine_key).is_none(),
                "{engine_key} must not be available through the BirdCoder product host"
            );
            assert!(
                host.validate_engine_id(engine_key).is_err(),
                "{engine_key} must be rejected by the BirdCoder product host"
            );
        }
        assert!(
            host.engine_keys().all(crate::is_canonical_engine_key),
            "only canonical BirdCoder engines may be enumerated"
        );
    }
}
