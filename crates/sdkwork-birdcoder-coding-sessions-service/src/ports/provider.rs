use crate::context::CodingSessionContext;
use crate::domain::commands::{SubmitApprovalDecisionInput, SubmitUserQuestionAnswerInput};
use crate::domain::results::{FinalizedProjectionTurnExecution, PendingProjectionTurnExecution};
use crate::error::CodingSessionError;

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

    async fn submit_approval(
        &self,
        ctx: &CodingSessionContext,
        engine_id: &str,
        native_session_id: Option<&str>,
        checkpoint_id: &str,
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
