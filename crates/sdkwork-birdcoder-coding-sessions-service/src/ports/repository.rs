use crate::context::CodingSessionContext;
use crate::domain::commands::{
    CreateCodingSessionInput,
    CreateCodingSessionTurnInput,
    EditCodingSessionMessageInput,
    ForkCodingSessionInput,
    SubmitApprovalDecisionInput,
    SubmitUserQuestionAnswerInput,
    UpdateCodingSessionInput,
};
use crate::domain::models::CodingSessionListQuery;
use crate::domain::results::{
    ApprovalDecisionPayload,
    CodingSessionArtifactPayload,
    CodingSessionCheckpointPayload,
    CodingSessionEventPayload,
    CodingSessionPayload,
    CodingSessionListPage,
    CodingSessionTurnPayload,
    DeleteCodingSessionMessagePayload,
    EditCodingSessionMessagePayload,
    OperationPayload,
    UserQuestionAnswerPayload,
};
use crate::error::CodingSessionError;

#[async_trait::async_trait]
pub trait CodingSessionRepository: Send + Sync {
    async fn list_sessions(
        &self,
        ctx: &CodingSessionContext,
        query: &CodingSessionListQuery,
    ) -> Result<CodingSessionListPage, CodingSessionError>;

    async fn get_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<CodingSessionPayload, CodingSessionError>;

    async fn create_session(
        &self,
        ctx: &CodingSessionContext,
        input: &CreateCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError>;

    async fn update_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        input: &UpdateCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError>;

    async fn delete_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<(), CodingSessionError>;

    async fn fork_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        input: &ForkCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError>;

    async fn list_turns(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionTurnPayload>, CodingSessionError>;

    async fn get_turn(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        turn_id: &str,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError>;

    async fn create_turn(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        input: &CreateCodingSessionTurnInput,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError>;

    async fn edit_message(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        message_id: &str,
        input: &EditCodingSessionMessageInput,
    ) -> Result<EditCodingSessionMessagePayload, CodingSessionError>;

    async fn delete_message(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        message_id: &str,
    ) -> Result<DeleteCodingSessionMessagePayload, CodingSessionError>;

    async fn list_events(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionEventPayload>, CodingSessionError>;

    async fn list_artifacts(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionArtifactPayload>, CodingSessionError>;

    async fn list_checkpoints(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionCheckpointPayload>, CodingSessionError>;

    async fn submit_approval_decision(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        checkpoint_id: &str,
        input: &SubmitApprovalDecisionInput,
    ) -> Result<ApprovalDecisionPayload, CodingSessionError>;

    async fn submit_user_question_answer(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        question_id: &str,
        input: &SubmitUserQuestionAnswerInput,
    ) -> Result<UserQuestionAnswerPayload, CodingSessionError>;

    async fn get_operation(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        operation_id: &str,
    ) -> Result<OperationPayload, CodingSessionError>;

    async fn finalize_turn_execution(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        finalized: &crate::domain::results::FinalizedProjectionTurnExecution,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError>;

    async fn mark_turn_failed(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        turn_id: &str,
    ) -> Result<(), CodingSessionError>;
}
