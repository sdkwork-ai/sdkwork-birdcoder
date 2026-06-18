use crate::context::CodingSessionContext;
use crate::domain::commands::{
    SubmitApprovalDecisionInput,
    SubmitUserQuestionAnswerInput,
};
use crate::domain::results::{
    FinalizedProjectionTurnExecution,
    PendingProjectionTurnExecution,
};
use crate::error::CodingSessionError;

#[async_trait::async_trait]
pub trait CodeEngineProvider: Send + Sync {
    async fn execute_turn(
        &self,
        ctx: &CodingSessionContext,
        pending: &PendingProjectionTurnExecution,
    ) -> Result<FinalizedProjectionTurnExecution, CodingSessionError>;

    async fn submit_approval(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        checkpoint_id: &str,
        input: &SubmitApprovalDecisionInput,
    ) -> Result<(), CodingSessionError>;

    async fn submit_question_answer(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        question_id: &str,
        input: &SubmitUserQuestionAnswerInput,
    ) -> Result<(), CodingSessionError>;
}
