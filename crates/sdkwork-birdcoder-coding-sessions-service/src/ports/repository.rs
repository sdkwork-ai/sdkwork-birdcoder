use crate::context::SessionContext;
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
    CodingSessionTurnPayload,
    OperationPayload,
    UserQuestionAnswerPayload,
};
use crate::error::CodingSessionError;

#[async_trait::async_trait]
pub trait CodingSessionRepository: Send + Sync {
    async fn list_sessions(
        &self,
        ctx: &SessionContext,
        query: &CodingSessionListQuery,
    ) -> Result<Vec<CodingSessionPayload>, CodingSessionError>;

    async fn get_session(
        &self,
        ctx: &SessionContext,
        session_id: &str,
    ) -> Result<CodingSessionPayload, CodingSessionError>;

    async fn create_session(
        &self,
        ctx: &SessionContext,
        input: &CreateCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError>;

    async fn update_session(
        &self,
        ctx: &SessionContext,
        session_id: &str,
        input: &UpdateCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError>;

    async fn delete_session(
        &self,
        ctx: &SessionContext,
        session_id: &str,
    ) -> Result<(), CodingSessionError>;

    async fn fork_session(
        &self,
        ctx: &SessionContext,
        session_id: &str,
        input: &ForkCodingSessionInput,
    ) -> Result<CodingSessionPayload, CodingSessionError>;

    async fn list_turns(
        &self,
        ctx: &SessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionTurnPayload>, CodingSessionError>;

    async fn get_turn(
        &self,
        ctx: &SessionContext,
        session_id: &str,
        turn_id: &str,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError>;

    async fn create_turn(
        &self,
        ctx: &SessionContext,
        session_id: &str,
        input: &CreateCodingSessionTurnInput,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError>;

    async fn edit_message(
        &self,
        ctx: &SessionContext,
        session_id: &str,
        turn_id: &str,
        input: &EditCodingSessionMessageInput,
    ) -> Result<CodingSessionTurnPayload, CodingSessionError>;

    async fn list_events(
        &self,
        ctx: &SessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionEventPayload>, CodingSessionError>;

    async fn list_artifacts(
        &self,
        ctx: &SessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionArtifactPayload>, CodingSessionError>;

    async fn list_checkpoints(
        &self,
        ctx: &SessionContext,
        session_id: &str,
    ) -> Result<Vec<CodingSessionCheckpointPayload>, CodingSessionError>;

    async fn submit_approval_decision(
        &self,
        ctx: &SessionContext,
        session_id: &str,
        checkpoint_id: &str,
        input: &SubmitApprovalDecisionInput,
    ) -> Result<ApprovalDecisionPayload, CodingSessionError>;

    async fn submit_user_question_answer(
        &self,
        ctx: &SessionContext,
        session_id: &str,
        question_id: &str,
        input: &SubmitUserQuestionAnswerInput,
    ) -> Result<UserQuestionAnswerPayload, CodingSessionError>;

    async fn get_operation(
        &self,
        ctx: &SessionContext,
        session_id: &str,
        operation_id: &str,
    ) -> Result<OperationPayload, CodingSessionError>;
}
