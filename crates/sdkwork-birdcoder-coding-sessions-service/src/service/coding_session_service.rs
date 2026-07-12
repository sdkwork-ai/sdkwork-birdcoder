use std::sync::Arc;

use sdkwork_utils_rust::{is_blank, trim as trim_string};

use crate::context::CodingSessionContext;
use crate::domain::commands::{
    CreateCodingSessionInput, CreateCodingSessionRequest, CreateCodingSessionTurnInput,
    CreateCodingSessionTurnRequest, EditCodingSessionMessageInput, EditCodingSessionMessageRequest,
    ForkCodingSessionInput, ForkCodingSessionRequest, SubmitApprovalDecisionInput,
    SubmitApprovalDecisionRequest, SubmitUserQuestionAnswerInput, SubmitUserQuestionAnswerRequest,
    UpdateCodingSessionInput, UpdateCodingSessionRequest,
};
use crate::domain::models::{
    CodingSessionListQuery, CodingSessionTurnCurrentFileContextPayload,
    CodingSessionTurnIdeContextPayload, CodingSessionTurnOptionsPayload,
};
use crate::domain::results::{
    ApprovalDecisionPayload, CodingSessionArtifactPayload, CodingSessionCheckpointPayload,
    CodingSessionEventPayload, CodingSessionListPage, CodingSessionPayload,
    DeleteCodingSessionMessagePayload, DeleteEntityPayload, EditCodingSessionMessagePayload,
    OperationPayload, PendingProjectionTurnExecution, PendingTurnResult, UserQuestionAnswerPayload,
};
use crate::error::CodingSessionError;
use crate::ports::engine_validator::EngineValidator;
use crate::ports::events::{CodingSessionRealtimeEventInput, RealtimeEventPublisher};
use crate::ports::provider::CodeEngineProvider;
use crate::ports::repository::CodingSessionRepository;

#[derive(Clone)]
pub struct CodingSessionService {
    repository: Arc<dyn CodingSessionRepository>,
    provider: Arc<dyn CodeEngineProvider>,
    event_publisher: Arc<dyn RealtimeEventPublisher>,
    engine_validator: Arc<dyn EngineValidator>,
    default_working_directory: Option<String>,
}

impl CodingSessionService {
    pub fn new(
        repository: Arc<dyn CodingSessionRepository>,
        provider: Arc<dyn CodeEngineProvider>,
        event_publisher: Arc<dyn RealtimeEventPublisher>,
        engine_validator: Arc<dyn EngineValidator>,
    ) -> Self {
        Self {
            repository,
            provider,
            event_publisher,
            engine_validator,
            default_working_directory: None,
        }
    }

    pub fn with_default_working_directory(mut self, working_directory: Option<String>) -> Self {
        self.default_working_directory = working_directory;
        self
    }

    // ── List sessions ────────────────────────────────────────────────────

    pub async fn list_sessions(
        &self,
        ctx: &CodingSessionContext,
        query: &CodingSessionListQuery,
    ) -> Result<CodingSessionListPage, CodingSessionError> {
        self.repository.list_sessions(ctx, query).await
    }

    // ── Get session ──────────────────────────────────────────────────────

    pub async fn get_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;
        self.repository.get_session(ctx, &session_id).await
    }

    // ── Create session ───────────────────────────────────────────────────

    #[tracing::instrument(
        name = "coding_session.create",
        skip(self, ctx, request),
        fields(
            tenant_id = %ctx.tenant_id,
            user_id = %ctx.user_id,
            session_id = tracing::field::Empty,
            workspace_id = tracing::field::Empty,
        ),
        err
    )]
    pub async fn create_session(
        &self,
        ctx: &CodingSessionContext,
        request: CreateCodingSessionRequest,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let input = Self::validate_create_session_request(request, self.engine_validator.as_ref())?;

        let session = self.repository.create_session(ctx, &input).await?;

        tracing::Span::current()
            .record("session_id", session.id.as_str())
            .record("workspace_id", session.workspace_id.as_str());

        self.event_publisher
            .publish_coding_session_event(
                ctx,
                &build_session_realtime_event("coding-session.created", "core", &session, None),
            )
            .await?;

        Ok(session)
    }

    // ── Update session ───────────────────────────────────────────────────

    pub async fn update_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        request: UpdateCodingSessionRequest,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;

        let existing = self.repository.get_session(ctx, &session_id).await?;

        let input = Self::validate_update_session_request(request)?;
        Self::ensure_engine_model_immutable(&existing, &input)?;

        let session = self
            .repository
            .update_session(ctx, &session_id, &input)
            .await?;

        self.event_publisher
            .publish_coding_session_event(
                ctx,
                &build_session_realtime_event("coding-session.updated", "core", &session, None),
            )
            .await?;

        Ok(session)
    }

    // ── Delete session ───────────────────────────────────────────────────

    pub async fn delete_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
    ) -> Result<DeleteEntityPayload, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;

        let existing = self.repository.get_session(ctx, &session_id).await?;

        self.repository.delete_session(ctx, &session_id).await?;

        self.event_publisher
            .publish_coding_session_event(
                ctx,
                &build_session_realtime_event("coding-session.deleted", "core", &existing, None),
            )
            .await?;

        Ok(DeleteEntityPayload { id: session_id })
    }

    // ── Fork session ─────────────────────────────────────────────────────

    pub async fn fork_session(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        request: ForkCodingSessionRequest,
    ) -> Result<CodingSessionPayload, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;

        let input = Self::validate_fork_session_request(request)?;

        let source_session = self.repository.get_session(ctx, &session_id).await?;

        if is_blank(Some(&source_session.workspace_id))
            || is_blank(Some(&source_session.project_id))
        {
            return Err(CodingSessionError::InvalidInput(
                "Only project-scoped coding sessions can be forked.".into(),
            ));
        }

        let session = self
            .repository
            .fork_session(ctx, &session_id, &input)
            .await?;

        self.event_publisher
            .publish_coding_session_event(
                ctx,
                &build_session_realtime_event("coding-session.created", "core", &session, None),
            )
            .await?;

        Ok(session)
    }

    // ── Edit coding session message ──────────────────────────────────────

    pub async fn edit_coding_session_message(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        message_id: &str,
        request: EditCodingSessionMessageRequest,
    ) -> Result<EditCodingSessionMessagePayload, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;
        let message_id = normalize_required_string(message_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("message_id is required.".into()))?;

        let content = normalize_required_string(&request.content)
            .ok_or_else(|| CodingSessionError::InvalidInput("content is required.".into()))?;

        let session = self.repository.get_session(ctx, &session_id).await?;
        let result = self
            .repository
            .edit_message(
                ctx,
                &session_id,
                &message_id,
                &EditCodingSessionMessageInput {
                    content: content.clone(),
                },
            )
            .await?;

        self.event_publisher
            .publish_coding_session_event(
                ctx,
                &build_session_realtime_event(
                    "coding-session.message.edited",
                    "core",
                    &session,
                    None,
                ),
            )
            .await?;

        Ok(result)
    }

    // ── Delete coding session message ────────────────────────────────────

    pub async fn delete_coding_session_message(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        message_id: &str,
    ) -> Result<DeleteCodingSessionMessagePayload, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;
        let message_id = normalize_required_string(message_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("message_id is required.".into()))?;

        let session = self.repository.get_session(ctx, &session_id).await?;
        let result = self
            .repository
            .delete_message(ctx, &session_id, &message_id)
            .await?;

        self.event_publisher
            .publish_coding_session_event(
                ctx,
                &build_session_realtime_event(
                    "coding-session.message.deleted",
                    "core",
                    &session,
                    None,
                ),
            )
            .await?;

        Ok(result)
    }

    // ── Create turn ──────────────────────────────────────────────────────

    #[tracing::instrument(
        name = "turn.execute",
        skip(self, ctx, request),
        fields(
            tenant_id = %ctx.tenant_id,
            user_id = %ctx.user_id,
            session_id = %session_id,
            workspace_id = tracing::field::Empty,
            turn_id = tracing::field::Empty,
            engine_id = tracing::field::Empty,
        ),
        err
    )]
    pub async fn create_turn(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        request: CreateCodingSessionTurnRequest,
    ) -> Result<PendingTurnResult, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;

        let input = Self::validate_create_turn_request(request)?;

        let session = self.repository.get_session(ctx, &session_id).await?;
        let project_working_directory = self
            .repository
            .resolve_project_working_directory(ctx, &session.project_id)
            .await?
            .or_else(|| self.default_working_directory.clone());

        if project_working_directory.is_none() {
            return Err(CodingSessionError::InvalidInput(
                "The selected project does not have an executable root path.".into(),
            ));
        }

        tracing::Span::current()
            .record("workspace_id", session.workspace_id.as_str())
            .record("engine_id", session.engine_id.as_str());

        let turn = self
            .repository
            .create_turn(ctx, &session_id, &input)
            .await?;

        tracing::Span::current().record("turn_id", turn.id.as_str());

        self.event_publisher
            .publish_coding_session_event(
                ctx,
                &CodingSessionRealtimeEventInput {
                    event_kind: "coding-session.turn.created".into(),
                    source_surface: "core".into(),
                    workspace_id: session.workspace_id.clone(),
                    project_id: session.project_id.clone(),
                    coding_session_id: session.id.clone(),
                    coding_session_title: session.title.clone(),
                    coding_session_status: session.status.clone(),
                    coding_session_host_mode: session.host_mode.clone(),
                    coding_session_engine_id: session.engine_id.clone(),
                    coding_session_model_id: session.model_id.clone(),
                    coding_session_runtime_status: Some("streaming".into()),
                    native_session_id: session.native_session_id.clone(),
                    coding_session_updated_at: turn.started_at.clone(),
                    turn_id: Some(turn.id.clone()),
                },
            )
            .await?;

        let turn_model_id = input
            .model_id
            .clone()
            .unwrap_or_else(|| session.model_id.clone());
        let operation_id = format!("{}:operation", turn.id);
        let pending_execution = PendingProjectionTurnExecution {
            session: session.clone(),
            turn: turn.clone(),
            operation: OperationPayload {
                operation_id: operation_id.clone(),
                status: "running".to_string(),
                artifact_refs: Vec::new(),
                stream_url: String::new(),
                stream_kind: "none".to_string(),
            },
            native_session_id: session.native_session_id.clone(),
            turn_model_id: turn_model_id.clone(),
            ide_context: input.ide_context.clone(),
            options: input.options.clone(),
            working_directory: project_working_directory.map(std::path::PathBuf::from),
        };

        let finalized = match self.provider.execute_turn(ctx, &pending_execution).await {
            Ok(finalized) => finalized,
            Err(error) => {
                let _ = self
                    .repository
                    .mark_turn_failed(ctx, &session_id, &turn.id)
                    .await;
                return Err(error);
            }
        };
        let finalized_native_session_id = finalized
            .native_session_id
            .clone()
            .or_else(|| session.native_session_id.clone());

        let turn = self
            .repository
            .finalize_turn_execution(ctx, &session_id, &finalized)
            .await?;

        self.event_publisher
            .publish_coding_session_event(
                ctx,
                &CodingSessionRealtimeEventInput {
                    event_kind: "coding-session.turn.completed".into(),
                    source_surface: "core".into(),
                    workspace_id: session.workspace_id.clone(),
                    project_id: session.project_id.clone(),
                    coding_session_id: session.id.clone(),
                    coding_session_title: session.title.clone(),
                    coding_session_status: session.status.clone(),
                    coding_session_host_mode: session.host_mode.clone(),
                    coding_session_engine_id: session.engine_id.clone(),
                    coding_session_model_id: session.model_id.clone(),
                    coding_session_runtime_status: Some("completed".into()),
                    native_session_id: finalized_native_session_id.clone(),
                    coding_session_updated_at: turn.completed_at.clone(),
                    turn_id: Some(turn.id.clone()),
                },
            )
            .await?;

        Ok(PendingTurnResult {
            session: CodingSessionPayload {
                native_session_id: finalized_native_session_id.clone(),
                ..session
            },
            turn,
            native_session_id: finalized_native_session_id,
            turn_model_id,
        })
    }

    // ── List events ──────────────────────────────────────────────────────

    pub async fn list_events(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionEventPayload>, usize), CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;

        self.repository.get_session(ctx, &session_id).await?;
        self.repository
            .list_events(ctx, &session_id, offset, limit)
            .await
    }

    // ── List artifacts ───────────────────────────────────────────────────

    pub async fn list_artifacts(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionArtifactPayload>, usize), CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;

        self.repository.get_session(ctx, &session_id).await?;
        self.repository
            .list_artifacts(ctx, &session_id, offset, limit)
            .await
    }

    // ── List checkpoints ─────────────────────────────────────────────────

    pub async fn list_checkpoints(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionCheckpointPayload>, usize), CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;

        self.repository.get_session(ctx, &session_id).await?;
        self.repository
            .list_checkpoints(ctx, &session_id, offset, limit)
            .await
    }

    // ── Submit approval decision ─────────────────────────────────────────

    pub async fn submit_approval_decision(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        checkpoint_id: &str,
        request: SubmitApprovalDecisionRequest,
    ) -> Result<ApprovalDecisionPayload, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;
        let checkpoint_id = normalize_required_string(checkpoint_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("checkpoint_id is required.".into()))?;

        let input = Self::validate_approval_decision_request(request)?;

        let session = self.repository.get_session(ctx, &session_id).await?;

        self.provider
            .submit_approval(
                ctx,
                session.engine_id.as_str(),
                session.native_session_id.as_deref(),
                &checkpoint_id,
                &input,
            )
            .await?;

        let approval = self
            .repository
            .submit_approval_decision(ctx, &session_id, &checkpoint_id, &input)
            .await?;

        self.event_publisher
            .publish_coding_session_event(
                ctx,
                &CodingSessionRealtimeEventInput {
                    event_kind: "coding-session.approval.decided".into(),
                    source_surface: "core".into(),
                    workspace_id: String::new(),
                    project_id: String::new(),
                    coding_session_id: approval.coding_session_id.clone(),
                    coding_session_title: String::new(),
                    coding_session_status: String::new(),
                    coding_session_host_mode: String::new(),
                    coding_session_engine_id: String::new(),
                    coding_session_model_id: String::new(),
                    coding_session_runtime_status: Some(approval.runtime_status.clone()),
                    native_session_id: approval.runtime_id.clone(),
                    coding_session_updated_at: Some(approval.decided_at.clone()),
                    turn_id: approval.turn_id.clone(),
                },
            )
            .await?;

        Ok(approval)
    }

    // ── Submit user question answer ──────────────────────────────────────

    pub async fn submit_user_question_answer(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        question_id: &str,
        request: SubmitUserQuestionAnswerRequest,
    ) -> Result<UserQuestionAnswerPayload, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;
        let question_id = normalize_required_string(question_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("question_id is required.".into()))?;

        let input = Self::validate_user_question_answer_request(request)?;

        let session = self.repository.get_session(ctx, &session_id).await?;

        self.provider
            .submit_question_answer(
                ctx,
                session.engine_id.as_str(),
                session.native_session_id.as_deref(),
                &question_id,
                &input,
            )
            .await?;

        let answer = self
            .repository
            .submit_user_question_answer(ctx, &session_id, &question_id, &input)
            .await?;

        self.event_publisher
            .publish_coding_session_event(
                ctx,
                &CodingSessionRealtimeEventInput {
                    event_kind: "coding-session.question.answered".into(),
                    source_surface: "core".into(),
                    workspace_id: String::new(),
                    project_id: String::new(),
                    coding_session_id: answer.coding_session_id.clone(),
                    coding_session_title: String::new(),
                    coding_session_status: String::new(),
                    coding_session_host_mode: String::new(),
                    coding_session_engine_id: String::new(),
                    coding_session_model_id: String::new(),
                    coding_session_runtime_status: Some(answer.runtime_status.clone()),
                    native_session_id: answer.runtime_id.clone(),
                    coding_session_updated_at: Some(answer.answered_at.clone()),
                    turn_id: answer.turn_id.clone(),
                },
            )
            .await?;

        Ok(answer)
    }

    // ── Get operation ────────────────────────────────────────────────────

    pub async fn get_operation(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        operation_id: &str,
    ) -> Result<OperationPayload, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;
        let operation_id = normalize_required_string(operation_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("operation_id is required.".into()))?;

        self.repository
            .get_operation(ctx, &session_id, &operation_id)
            .await
    }

    // ── Validation helpers ───────────────────────────────────────────────

    fn validate_create_session_request(
        request: CreateCodingSessionRequest,
        engine_validator: &dyn EngineValidator,
    ) -> Result<CreateCodingSessionInput, CodingSessionError> {
        let workspace_id = normalize_required_string(&request.workspace_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("workspaceId is required.".into()))?;
        let project_id = normalize_required_string(&request.project_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("projectId is required.".into()))?;
        let title =
            normalize_optional_string(request.title).unwrap_or_else(|| "New Session".to_owned());
        let host_mode =
            normalize_optional_string(request.host_mode).unwrap_or_else(|| "server".to_owned());

        if !matches!(host_mode.as_str(), "web" | "desktop" | "server") {
            return Err(CodingSessionError::InvalidInput(
                "hostMode must be one of web/desktop/server.".into(),
            ));
        }

        let engine_id = normalize_optional_string(request.engine_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("engineId is required.".into()))?;

        engine_validator.validate_engine_runtime_profile(&engine_id, &host_mode)?;

        let model_id = normalize_optional_string(request.model_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("modelId is required.".into()))?;

        Ok(CreateCodingSessionInput {
            workspace_id,
            project_id,
            title,
            host_mode,
            engine_id,
            model_id,
        })
    }

    fn validate_update_session_request(
        request: UpdateCodingSessionRequest,
    ) -> Result<UpdateCodingSessionInput, CodingSessionError> {
        let title = normalize_optional_string(request.title);
        let status = normalize_optional_string(request.status);
        let host_mode = normalize_optional_string(request.host_mode);
        let engine_id = normalize_optional_string(request.engine_id);
        let model_id = normalize_optional_string(request.model_id);

        if title.is_none()
            && status.is_none()
            && host_mode.is_none()
            && engine_id.is_none()
            && model_id.is_none()
        {
            return Err(CodingSessionError::InvalidInput(
                "At least one coding session field must be provided.".into(),
            ));
        }

        if host_mode
            .as_deref()
            .is_some_and(|v| !matches!(v, "web" | "desktop" | "server"))
        {
            return Err(CodingSessionError::InvalidInput(
                "hostMode must be one of web/desktop/server.".into(),
            ));
        }

        if status
            .as_deref()
            .is_some_and(|v| !matches!(v, "draft" | "active" | "paused" | "completed" | "archived"))
        {
            return Err(CodingSessionError::InvalidInput(
                "status must be one of draft/active/paused/completed/archived.".into(),
            ));
        }

        Ok(UpdateCodingSessionInput {
            title,
            status,
            host_mode,
            engine_id,
            model_id,
        })
    }

    fn validate_fork_session_request(
        request: ForkCodingSessionRequest,
    ) -> Result<ForkCodingSessionInput, CodingSessionError> {
        Ok(ForkCodingSessionInput {
            title: normalize_optional_string(request.title),
        })
    }

    fn validate_create_turn_request(
        request: CreateCodingSessionTurnRequest,
    ) -> Result<CreateCodingSessionTurnInput, CodingSessionError> {
        let request_kind = normalize_required_string(&request.request_kind)
            .ok_or_else(|| CodingSessionError::InvalidInput("requestKind is required.".into()))?;
        let input_summary = normalize_required_string(&request.input_summary)
            .ok_or_else(|| CodingSessionError::InvalidInput("inputSummary is required.".into()))?;

        if !matches!(
            request_kind.as_str(),
            "chat" | "plan" | "tool" | "review" | "apply"
        ) {
            return Err(CodingSessionError::InvalidInput(
                "requestKind must be one of chat/plan/tool/review/apply.".into(),
            ));
        }

        Ok(CreateCodingSessionTurnInput {
            runtime_id: normalize_optional_string(request.runtime_id),
            engine_id: normalize_optional_string(request.engine_id),
            model_id: normalize_optional_string(request.model_id),
            request_kind,
            input_summary,
            stream: true,
            ide_context: normalize_turn_ide_context(request.ide_context),
            options: normalize_turn_options(request.options),
        })
    }

    fn validate_approval_decision_request(
        request: SubmitApprovalDecisionRequest,
    ) -> Result<SubmitApprovalDecisionInput, CodingSessionError> {
        let decision = normalize_required_string(&request.decision)
            .ok_or_else(|| CodingSessionError::InvalidInput("decision is required.".into()))?;

        if !matches!(decision.as_str(), "approved" | "denied" | "blocked") {
            return Err(CodingSessionError::InvalidInput(
                "decision must be one of approved/denied/blocked.".into(),
            ));
        }

        Ok(SubmitApprovalDecisionInput {
            decision,
            reason: normalize_optional_string(request.reason),
        })
    }

    fn validate_user_question_answer_request(
        request: SubmitUserQuestionAnswerRequest,
    ) -> Result<SubmitUserQuestionAnswerInput, CodingSessionError> {
        let rejected = request.rejected.unwrap_or(false);
        let answer =
            if rejected {
                None
            } else {
                Some(normalize_optional_string(request.answer).ok_or_else(|| {
                    CodingSessionError::InvalidInput("answer is required.".into())
                })?)
            };

        Ok(SubmitUserQuestionAnswerInput {
            answer,
            option_id: normalize_optional_string(request.option_id),
            option_label: normalize_optional_string(request.option_label),
            rejected,
        })
    }

    fn ensure_engine_model_immutable(
        session: &CodingSessionPayload,
        input: &UpdateCodingSessionInput,
    ) -> Result<(), CodingSessionError> {
        if let Some(engine_id) = input.engine_id.as_deref() {
            if !engine_id.eq_ignore_ascii_case(session.engine_id.as_str()) {
                return Err(CodingSessionError::InvalidInput(format!(
                    "coding session engineId is immutable after creation. Expected \"{}\".",
                    session.engine_id
                )));
            }
        }
        if let Some(model_id) = input.model_id.as_deref() {
            if !model_id.eq_ignore_ascii_case(session.model_id.as_str()) {
                return Err(CodingSessionError::InvalidInput(format!(
                    "coding session modelId is immutable after creation. Expected \"{}\".",
                    session.model_id
                )));
            }
        }
        Ok(())
    }
}

// ── String normalization helpers ─────────────────────────────────────

fn normalize_required_string(value: &str) -> Option<String> {
    if is_blank(Some(value)) {
        None
    } else {
        Some(trim_string(value))
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|v| normalize_required_string(&v))
}

fn normalize_turn_current_file_context(
    value: Option<CodingSessionTurnCurrentFileContextPayload>,
) -> Option<CodingSessionTurnCurrentFileContextPayload> {
    let value = value?;
    let path = normalize_required_string(&value.path)?;
    Some(CodingSessionTurnCurrentFileContextPayload {
        path,
        content: normalize_optional_string(value.content),
        language: normalize_optional_string(value.language),
    })
}

fn normalize_turn_ide_context(
    value: Option<CodingSessionTurnIdeContextPayload>,
) -> Option<CodingSessionTurnIdeContextPayload> {
    let value = value?;
    let normalized = CodingSessionTurnIdeContextPayload {
        workspace_id: normalize_optional_string(value.workspace_id),
        project_id: normalize_optional_string(value.project_id),
        session_id: normalize_optional_string(value.session_id),
        current_file: normalize_turn_current_file_context(value.current_file),
    };

    if normalized.workspace_id.is_none()
        && normalized.project_id.is_none()
        && normalized.session_id.is_none()
        && normalized.current_file.is_none()
    {
        None
    } else {
        Some(normalized)
    }
}

fn normalize_turn_options(
    value: Option<CodingSessionTurnOptionsPayload>,
) -> Option<CodingSessionTurnOptionsPayload> {
    let value = value?;
    let temperature = value
        .temperature
        .filter(|v| v.is_finite())
        .map(|v| v.clamp(0.0, 2.0));
    let top_p = value
        .top_p
        .filter(|v| v.is_finite())
        .map(|v| v.clamp(0.0, 1.0));
    let max_tokens = value.max_tokens.filter(|v| *v > 0).map(|v| v.min(128_000));

    if temperature.is_none() && top_p.is_none() && max_tokens.is_none() {
        None
    } else {
        Some(CodingSessionTurnOptionsPayload {
            temperature,
            top_p,
            max_tokens,
        })
    }
}

// ── Realtime event builder ───────────────────────────────────────────

fn build_session_realtime_event(
    event_kind: &str,
    source_surface: &str,
    session: &CodingSessionPayload,
    turn_id: Option<String>,
) -> CodingSessionRealtimeEventInput {
    CodingSessionRealtimeEventInput {
        event_kind: event_kind.into(),
        source_surface: source_surface.into(),
        workspace_id: session.workspace_id.clone(),
        project_id: session.project_id.clone(),
        coding_session_id: session.id.clone(),
        coding_session_title: session.title.clone(),
        coding_session_status: session.status.clone(),
        coding_session_host_mode: session.host_mode.clone(),
        coding_session_engine_id: session.engine_id.clone(),
        coding_session_model_id: session.model_id.clone(),
        coding_session_runtime_status: session.runtime_status.clone(),
        native_session_id: session.native_session_id.clone(),
        coding_session_updated_at: Some(session.updated_at.clone()),
        turn_id,
    }
}
