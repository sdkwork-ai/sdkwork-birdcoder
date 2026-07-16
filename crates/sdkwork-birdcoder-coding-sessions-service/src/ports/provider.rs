use std::sync::Arc;

use crate::context::CodingSessionContext;
use crate::domain::commands::{SubmitApprovalDecisionInput, SubmitUserQuestionAnswerInput};
use crate::domain::results::{FinalizedProjectionTurnExecution, PendingProjectionTurnExecution};
use crate::error::CodingSessionError;

/// Provider-neutral incremental assistant output.
///
/// The service assigns durable event sequence numbers. Providers must not
/// expose transport or provider-local sequence values through this contract.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CodeEngineTurnStreamEvent {
    pub content_delta: String,
}

impl CodeEngineTurnStreamEvent {
    pub fn assistant_delta(content_delta: String) -> Self {
        Self { content_delta }
    }
}

/// Receives normalized provider output while a code-engine turn is executing.
///
/// Implementations must apply bounded backpressure. Returning an error stops
/// the upstream provider stream before the adapter can emit non-durable output.
/// This is synchronous because it bridges the kernel callback SPI; adapters
/// must call it from a blocking provider context or perform an equivalent
/// async-safe handoff before invoking it.
pub trait CodeEngineTurnStreamSink: Send + Sync {
    fn push_event(&self, event: CodeEngineTurnStreamEvent) -> Result<(), CodingSessionError>;
}

#[async_trait::async_trait]
pub trait CodeEngineProvider: Send + Sync {
    fn ensure_execution_available(&self) -> Result<(), CodingSessionError> {
        Ok(())
    }

    async fn execute_turn(
        &self,
        ctx: &CodingSessionContext,
        pending: &PendingProjectionTurnExecution,
    ) -> Result<FinalizedProjectionTurnExecution, CodingSessionError>;

    /// Executes a turn and forwards normalized incremental output to `sink`.
    ///
    /// The default preserves compatibility for providers that have not yet
    /// implemented streaming. Production providers should override it.
    async fn execute_turn_with_stream_sink(
        &self,
        ctx: &CodingSessionContext,
        pending: &PendingProjectionTurnExecution,
        sink: Arc<dyn CodeEngineTurnStreamSink>,
    ) -> Result<FinalizedProjectionTurnExecution, CodingSessionError> {
        let _ = sink;
        self.execute_turn(ctx, pending).await
    }

    async fn submit_approval(
        &self,
        ctx: &CodingSessionContext,
        engine_id: &str,
        native_session_id: Option<&str>,
        interaction_id: &str,
        input: &SubmitApprovalDecisionInput,
    ) -> Result<(), CodingSessionError>;

    async fn submit_question_answer(
        &self,
        ctx: &CodingSessionContext,
        engine_id: &str,
        native_session_id: Option<&str>,
        question_id: &str,
        input: &SubmitUserQuestionAnswerInput,
    ) -> Result<(), CodingSessionError>;
}
