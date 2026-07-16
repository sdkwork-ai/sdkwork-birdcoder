use std::{collections::BTreeMap, sync::Arc};

use sdkwork_utils_rust::{is_blank, trim as trim_string};

use crate::context::CodingSessionContext;
use crate::domain::commands::{
    AppendCodingSessionRealtimeEventInput, CodingSessionInteractionKind, CreateCodingSessionInput,
    CreateCodingSessionRequest, CreateCodingSessionTurnInput, CreateCodingSessionTurnRequest,
    EditCodingSessionMessageInput, EditCodingSessionMessageRequest, ForkCodingSessionInput,
    ForkCodingSessionRequest, SubmitApprovalDecisionInput, SubmitApprovalDecisionRequest,
    SubmitUserQuestionAnswerInput, SubmitUserQuestionAnswerRequest, UpdateCodingSessionInput,
    UpdateCodingSessionRequest,
};
use crate::domain::models::{
    CodingSessionListQuery, CodingSessionTurnCurrentFileContextPayload,
    CodingSessionTurnIdeContextPayload, CodingSessionTurnOptionsPayload,
};
use crate::domain::results::{
    ApprovalDecisionPayload, ClaimedCodingSessionInteraction, CodingSessionArtifactPayload,
    CodingSessionCheckpointPayload, CodingSessionEventPayload, CodingSessionListPage,
    CodingSessionPayload, CodingSessionReplayPage, DeleteCodingSessionMessagePayload,
    DeleteEntityPayload, EditCodingSessionMessagePayload, OperationPayload,
    PendingProjectionTurnExecution, PendingTurnResult, UserQuestionAnswerPayload,
};
use crate::error::CodingSessionError;
use crate::ports::engine_validator::EngineValidator;
use crate::ports::events::{CodingSessionRealtimeEventInput, RealtimeEventPublisher};
use crate::ports::project_execution_scope::ProjectExecutionScopeResolver;
use crate::ports::provider::{
    CodeEngineProvider, CodeEngineTurnStreamEvent, CodeEngineTurnStreamSink,
};
use crate::ports::repository::CodingSessionRepository;

use super::turn_stream_delta_batcher::TurnStreamDeltaBatcher;

#[derive(Clone)]
pub struct CodingSessionService {
    repository: Arc<dyn CodingSessionRepository>,
    provider: Arc<dyn CodeEngineProvider>,
    event_publisher: Arc<dyn RealtimeEventPublisher>,
    engine_validator: Arc<dyn EngineValidator>,
    project_execution_scope_resolver: Arc<dyn ProjectExecutionScopeResolver>,
}

const TURN_STREAM_CHANNEL_CAPACITY: usize = 128;

struct DurableTurnStreamSink {
    sender: tokio::sync::mpsc::Sender<CodeEngineTurnStreamEvent>,
}

impl CodeEngineTurnStreamSink for DurableTurnStreamSink {
    fn push_event(&self, event: CodeEngineTurnStreamEvent) -> Result<(), CodingSessionError> {
        self.sender.blocking_send(event).map_err(|_| {
            CodingSessionError::Unavailable(
                "coding-session stream consumer is no longer available".into(),
            )
        })
    }
}

/// A committed coding-session mutation remains recoverable even when the
/// best-effort realtime fan-out is unavailable. `EventPublish` is therefore
/// observable but non-terminal; a client can refresh or resume the durable
/// session stream.
async fn publish_replayable_coding_session_event(
    event_publisher: &dyn RealtimeEventPublisher,
    ctx: &CodingSessionContext,
    event: &CodingSessionRealtimeEventInput,
) -> Result<(), CodingSessionError> {
    match event_publisher
        .publish_coding_session_event(ctx, event)
        .await
    {
        Err(CodingSessionError::EventPublish(reason)) => {
            tracing::warn!(
                coding_session_id = %event.coding_session_id,
                event_kind = %event.event_kind,
                reason = %reason,
                "committed coding-session update fan-out failed; clients must refresh or resume from durable state"
            );
            Ok(())
        }
        result => result,
    }
}

fn is_definitive_provider_interaction_rejection(error: &CodingSessionError) -> bool {
    matches!(
        error,
        CodingSessionError::InvalidInput(_)
            | CodingSessionError::NotFound(_)
            | CodingSessionError::Conflict(_)
    )
}

impl CodingSessionService {
    pub fn new(
        repository: Arc<dyn CodingSessionRepository>,
        provider: Arc<dyn CodeEngineProvider>,
        event_publisher: Arc<dyn RealtimeEventPublisher>,
        engine_validator: Arc<dyn EngineValidator>,
        project_execution_scope_resolver: Arc<dyn ProjectExecutionScopeResolver>,
    ) -> Self {
        Self {
            repository,
            provider,
            event_publisher,
            engine_validator,
            project_execution_scope_resolver,
        }
    }

    async fn release_interaction_claim(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        claimed: &ClaimedCodingSessionInteraction,
        reason: &str,
    ) {
        if let Err(release_error) = self
            .repository
            .release_durable_interaction_claim(
                ctx,
                session_id,
                &claimed.interaction.event_id,
                claimed.interaction.interaction_kind,
                &claimed.claim_id,
            )
            .await
        {
            tracing::warn!(
                coding_session_id = %session_id,
                interaction_event_id = %claimed.interaction.event_id,
                reason = %reason,
                release_error = %release_error,
                "failed to release a rejected coding-session interaction claim"
            );
        }
    }

    async fn append_and_publish_turn_delta(
        &self,
        ctx: &CodingSessionContext,
        session: &CodingSessionPayload,
        pending: &PendingProjectionTurnExecution,
        content_delta: String,
    ) -> Result<CodingSessionEventPayload, CodingSessionError> {
        let mut payload = BTreeMap::new();
        payload.insert("role".into(), serde_json::Value::String("assistant".into()));
        payload.insert(
            "contentDelta".into(),
            serde_json::Value::String(content_delta),
        );
        payload.insert(
            "operationId".into(),
            serde_json::Value::String(pending.operation.operation_id.clone()),
        );
        payload.insert(
            "runtimeStatus".into(),
            serde_json::Value::String("streaming".into()),
        );
        if let Some(native_session_id) = pending.native_session_id.as_ref() {
            payload.insert(
                "nativeSessionId".into(),
                serde_json::Value::String(native_session_id.clone()),
            );
        }

        let persisted = self
            .repository
            .append_realtime_event(
                ctx,
                &session.id,
                &AppendCodingSessionRealtimeEventInput {
                    turn_id: Some(pending.turn.id.clone()),
                    runtime_id: pending.turn.runtime_id.clone(),
                    kind: "message.delta".into(),
                    payload,
                },
            )
            .await?;
        self.publish_persisted_turn_event(
            ctx,
            session,
            &persisted,
            pending.native_session_id.clone(),
            "coding-session.updated",
        )
        .await?;
        Ok(persisted)
    }

    async fn persist_turn_stream_event_or_record_failure(
        &self,
        ctx: &CodingSessionContext,
        session: &CodingSessionPayload,
        pending: &PendingProjectionTurnExecution,
        event: CodeEngineTurnStreamEvent,
        persistence_error: &mut Option<CodingSessionError>,
    ) {
        if persistence_error.is_some() || event.content_delta.is_empty() {
            return;
        }

        if let Err(error) = self
            .append_and_publish_turn_delta(ctx, session, pending, event.content_delta)
            .await
        {
            tracing::error!(
                coding_session_id = %session.id,
                turn_id = %pending.turn.id,
                reason = %error,
                "durable streaming projection failed; draining the current provider execution before marking the turn failed"
            );
            *persistence_error = Some(error);
        }
    }

    async fn publish_persisted_turn_event(
        &self,
        ctx: &CodingSessionContext,
        session: &CodingSessionPayload,
        event: &CodingSessionEventPayload,
        native_session_id: Option<String>,
        realtime_event_kind: &str,
    ) -> Result<(), CodingSessionError> {
        let realtime_event = CodingSessionRealtimeEventInput {
            event_kind: realtime_event_kind.into(),
            source_surface: "core".into(),
            workspace_id: session.workspace_id.clone(),
            project_id: session.project_id.clone(),
            coding_session_runtime_location_id: session.runtime_location_id.clone(),
            coding_session_id: session.id.clone(),
            coding_session_title: session.title.clone(),
            coding_session_status: session.status.clone(),
            coding_session_host_mode: session.host_mode.clone(),
            coding_session_engine_id: session.engine_id.clone(),
            coding_session_model_id: session.model_id.clone(),
            coding_session_runtime_status: event
                .payload
                .get("runtimeStatus")
                .and_then(serde_json::Value::as_str)
                .map(str::to_owned),
            coding_session_event_id: Some(event.id.clone()),
            coding_session_event_kind: Some(event.kind.clone()),
            coding_session_event_payload: Some(serde_json::json!(event.payload)),
            coding_session_event_sequence: Some(event.sequence.to_string()),
            native_session_id,
            coding_session_updated_at: Some(event.created_at.clone()),
            turn_id: event.turn_id.clone(),
        };
        publish_replayable_coding_session_event(self.event_publisher.as_ref(), ctx, &realtime_event)
            .await
    }

    async fn mark_and_publish_turn_failed(
        &self,
        ctx: &CodingSessionContext,
        session: &CodingSessionPayload,
        pending: &PendingProjectionTurnExecution,
    ) -> Result<(), CodingSessionError> {
        let Some(event) = self
            .repository
            .mark_turn_failed(ctx, &session.id, &pending.turn.id)
            .await?
        else {
            return Ok(());
        };
        self.publish_persisted_turn_event(
            ctx,
            session,
            &event,
            pending.native_session_id.clone(),
            "coding-session.updated",
        )
        .await
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

        let realtime_event =
            build_session_realtime_event("coding-session.created", "core", &session, None);
        publish_replayable_coding_session_event(
            self.event_publisher.as_ref(),
            ctx,
            &realtime_event,
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

        let input = Self::validate_update_session_request(request)?;

        let session = self
            .repository
            .update_session(ctx, &session_id, &input)
            .await?;

        let realtime_event =
            build_session_realtime_event("coding-session.updated", "core", &session, None);
        publish_replayable_coding_session_event(
            self.event_publisher.as_ref(),
            ctx,
            &realtime_event,
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

        let realtime_event =
            build_session_realtime_event("coding-session.deleted", "core", &existing, None);
        publish_replayable_coding_session_event(
            self.event_publisher.as_ref(),
            ctx,
            &realtime_event,
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
        if source_session
            .runtime_location_id
            .as_deref()
            .is_none_or(|value| is_blank(Some(value)))
        {
            return Err(CodingSessionError::Unavailable(
                "Coding session execution is unavailable until a runtime location is bound.".into(),
            ));
        }

        let session = self
            .repository
            .fork_session(ctx, &session_id, &input)
            .await?;

        let realtime_event =
            build_session_realtime_event("coding-session.created", "core", &session, None);
        publish_replayable_coding_session_event(
            self.event_publisher.as_ref(),
            ctx,
            &realtime_event,
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

        let realtime_event =
            build_session_realtime_event("coding-session.message.edited", "core", &session, None);
        publish_replayable_coding_session_event(
            self.event_publisher.as_ref(),
            ctx,
            &realtime_event,
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

        let realtime_event =
            build_session_realtime_event("coding-session.message.deleted", "core", &session, None);
        publish_replayable_coding_session_event(
            self.event_publisher.as_ref(),
            ctx,
            &realtime_event,
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
        let runtime_location_id = session
            .runtime_location_id
            .as_deref()
            .filter(|value| !is_blank(Some(*value)))
            .ok_or_else(|| {
                CodingSessionError::Unavailable(
                    "Coding session execution is unavailable until a runtime location is bound."
                        .into(),
                )
            })?;
        self.provider.ensure_execution_available()?;
        let project_working_directory = self
            .project_execution_scope_resolver
            .resolve_execution_root(
                ctx,
                &session.workspace_id,
                &session.project_id,
                runtime_location_id,
            )
            .await?;

        tracing::Span::current()
            .record("workspace_id", session.workspace_id.as_str())
            .record("engine_id", session.engine_id.as_str());

        let turn = self
            .repository
            .create_turn(ctx, &session_id, &input)
            .await?;

        tracing::Span::current().record("turn_id", turn.id.as_str());

        let turn_created_event = CodingSessionRealtimeEventInput {
            event_kind: "coding-session.turn.created".into(),
            source_surface: "core".into(),
            workspace_id: session.workspace_id.clone(),
            project_id: session.project_id.clone(),
            coding_session_runtime_location_id: session.runtime_location_id.clone(),
            coding_session_id: session.id.clone(),
            coding_session_title: session.title.clone(),
            coding_session_status: session.status.clone(),
            coding_session_host_mode: session.host_mode.clone(),
            coding_session_engine_id: session.engine_id.clone(),
            coding_session_model_id: session.model_id.clone(),
            coding_session_runtime_status: Some("streaming".into()),
            coding_session_event_id: None,
            coding_session_event_kind: None,
            coding_session_event_payload: None,
            coding_session_event_sequence: None,
            native_session_id: session.native_session_id.clone(),
            coding_session_updated_at: turn.started_at.clone(),
            turn_id: Some(turn.id.clone()),
        };
        publish_replayable_coding_session_event(
            self.event_publisher.as_ref(),
            ctx,
            &turn_created_event,
        )
        .await?;

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
            ide_context: input.ide_context.clone(),
            options: input.options.clone(),
            working_directory: Some(project_working_directory),
        };

        let (stream_sender, stream_receiver) =
            tokio::sync::mpsc::channel(TURN_STREAM_CHANNEL_CAPACITY);
        let mut stream_batcher = TurnStreamDeltaBatcher::new(stream_receiver);
        let stream_sink: Arc<dyn CodeEngineTurnStreamSink> = Arc::new(DurableTurnStreamSink {
            sender: stream_sender,
        });
        let mut execution = Box::pin(self.provider.execute_turn_with_stream_sink(
            ctx,
            &pending_execution,
            stream_sink,
        ));
        let mut stream_open = true;
        let mut persistence_error = None;
        let finalized_result = loop {
            tokio::select! {
                result = &mut execution => break result,
                maybe_event = stream_batcher.recv(), if stream_open => {
                    let Some(event) = maybe_event else {
                        stream_open = false;
                        continue;
                    };
                    self.persist_turn_stream_event_or_record_failure(
                        ctx,
                        &session,
                        &pending_execution,
                        event,
                        &mut persistence_error,
                    ).await;
                }
            }
        };

        // The provider completion result owns terminal and interaction
        // projections. Drain every accepted delta before those projections are
        // finalized so coalescing cannot reorder or swallow either boundary.
        while let Ok(event) = stream_batcher.try_recv() {
            self.persist_turn_stream_event_or_record_failure(
                ctx,
                &session,
                &pending_execution,
                event,
                &mut persistence_error,
            )
            .await;
        }

        if let Some(error) = persistence_error {
            let _ = self
                .mark_and_publish_turn_failed(ctx, &session, &pending_execution)
                .await;
            return Err(error);
        }

        let finalized = match finalized_result {
            Ok(finalized) => finalized,
            Err(error) => {
                let _ = self
                    .mark_and_publish_turn_failed(ctx, &session, &pending_execution)
                    .await;
                return Err(error);
            }
        };
        let finalized_native_session_id = finalized
            .native_session_id
            .clone()
            .or_else(|| session.native_session_id.clone());

        let persisted = match self
            .repository
            .finalize_turn_execution(ctx, &session_id, &finalized)
            .await
        {
            Ok(persisted) => persisted,
            Err(error) => {
                let _ = self
                    .mark_and_publish_turn_failed(ctx, &session, &pending_execution)
                    .await;
                return Err(error);
            }
        };

        for projection_event in &persisted.events {
            self.publish_persisted_turn_event(
                ctx,
                &session,
                projection_event,
                finalized_native_session_id.clone(),
                "coding-session.updated",
            )
            .await?;
        }
        let turn = persisted.turn;

        let turn_completed_event = CodingSessionRealtimeEventInput {
            event_kind: "coding-session.turn.completed".into(),
            source_surface: "core".into(),
            workspace_id: session.workspace_id.clone(),
            project_id: session.project_id.clone(),
            coding_session_runtime_location_id: session.runtime_location_id.clone(),
            coding_session_id: session.id.clone(),
            coding_session_title: session.title.clone(),
            coding_session_status: session.status.clone(),
            coding_session_host_mode: session.host_mode.clone(),
            coding_session_engine_id: session.engine_id.clone(),
            coding_session_model_id: session.model_id.clone(),
            coding_session_runtime_status: Some("completed".into()),
            coding_session_event_id: None,
            coding_session_event_kind: None,
            coding_session_event_payload: None,
            coding_session_event_sequence: None,
            native_session_id: finalized_native_session_id.clone(),
            coding_session_updated_at: turn.completed_at.clone(),
            turn_id: Some(turn.id.clone()),
        };
        publish_replayable_coding_session_event(
            self.event_publisher.as_ref(),
            ctx,
            &turn_completed_event,
        )
        .await?;

        Ok(PendingTurnResult {
            session: CodingSessionPayload {
                native_session_id: finalized_native_session_id.clone(),
                ..session
            },
            turn,
            native_session_id: finalized_native_session_id,
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

    /// Replays a stable, append-only event window without an offset scan or a
    /// count query. The first page captures the sequence high watermark; all
    /// later pages must reuse it.
    pub async fn replay_events(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        after_sequence: Option<usize>,
        high_watermark: Option<usize>,
        limit: usize,
    ) -> Result<CodingSessionReplayPage, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;
        if !(1..=200).contains(&limit) {
            return Err(CodingSessionError::InvalidInput(
                "replay page size must be between 1 and 200".into(),
            ));
        }

        self.repository
            .replay_events(ctx, &session_id, after_sequence, high_watermark, limit)
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
        interaction_event_id: &str,
        request: SubmitApprovalDecisionRequest,
    ) -> Result<ApprovalDecisionPayload, CodingSessionError> {
        let session_id = normalize_required_string(session_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("session_id is required.".into()))?;
        let interaction_event_id =
            normalize_required_string(interaction_event_id).ok_or_else(|| {
                CodingSessionError::InvalidInput("interaction_event_id is required.".into())
            })?;

        let input = Self::validate_approval_decision_request(request)?;

        let session = self.repository.get_session(ctx, &session_id).await?;
        self.provider.ensure_execution_available()?;
        let claimed = self
            .repository
            .claim_durable_interaction(
                ctx,
                &session_id,
                &interaction_event_id,
                CodingSessionInteractionKind::Approval,
            )
            .await?;

        if let Err(error) = self
            .provider
            .submit_approval(
                ctx,
                session.engine_id.as_str(),
                session.native_session_id.as_deref(),
                &claimed.interaction.interaction_id,
                &input,
            )
            .await
        {
            if is_definitive_provider_interaction_rejection(&error) {
                self.release_interaction_claim(
                    ctx,
                    &session_id,
                    &claimed,
                    "provider rejected approval decision",
                )
                .await;
            } else {
                tracing::warn!(
                    coding_session_id = %session_id,
                    interaction_event_id = %claimed.interaction.event_id,
                    reason = %error,
                    "approval provider result is unknown; retaining durable interaction claim until expiry"
                );
            }
            return Err(error);
        }

        let persisted = match self
            .repository
            .submit_approval_decision(
                ctx,
                &session_id,
                &claimed.interaction.event_id,
                &claimed.claim_id,
                &input,
            )
            .await
        {
            Ok(persisted) => persisted,
            Err(error) => {
                tracing::warn!(
                    coding_session_id = %session_id,
                    interaction_event_id = %claimed.interaction.event_id,
                    reason = %error,
                    "approval provider submission completed but durable settlement failed; retaining claim to prevent duplicate submission"
                );
                return Err(error);
            }
        };

        self.publish_persisted_turn_event(
            ctx,
            &session,
            &persisted.event,
            session.native_session_id.clone(),
            "coding-session.approval.decided",
        )
        .await?;

        Ok(persisted.payload)
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
        self.provider.ensure_execution_available()?;
        let claimed = self
            .repository
            .claim_durable_interaction(
                ctx,
                &session_id,
                &question_id,
                CodingSessionInteractionKind::UserQuestion,
            )
            .await?;

        if let Err(error) = self
            .provider
            .submit_question_answer(
                ctx,
                session.engine_id.as_str(),
                session.native_session_id.as_deref(),
                &claimed.interaction.interaction_id,
                &input,
            )
            .await
        {
            if is_definitive_provider_interaction_rejection(&error) {
                self.release_interaction_claim(
                    ctx,
                    &session_id,
                    &claimed,
                    "provider rejected user-question answer",
                )
                .await;
            } else {
                tracing::warn!(
                    coding_session_id = %session_id,
                    interaction_event_id = %claimed.interaction.event_id,
                    reason = %error,
                    "question provider result is unknown; retaining durable interaction claim until expiry"
                );
            }
            return Err(error);
        }

        let persisted = match self
            .repository
            .submit_user_question_answer(
                ctx,
                &session_id,
                &claimed.interaction.event_id,
                &claimed.claim_id,
                &input,
            )
            .await
        {
            Ok(persisted) => persisted,
            Err(error) => {
                tracing::warn!(
                    coding_session_id = %session_id,
                    interaction_event_id = %claimed.interaction.event_id,
                    reason = %error,
                    "question provider submission completed but durable settlement failed; retaining claim to prevent duplicate submission"
                );
                return Err(error);
            }
        };

        self.publish_persisted_turn_event(
            ctx,
            &session,
            &persisted.event,
            session.native_session_id.clone(),
            "coding-session.question.answered",
        )
        .await?;

        Ok(persisted.payload)
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
        let runtime_location_id = normalize_required_string(&request.runtime_location_id)
            .ok_or_else(|| {
                CodingSessionError::InvalidInput("runtimeLocationId is required.".into())
            })?;
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

        let model_id = normalize_optional_string(request.model_id)
            .ok_or_else(|| CodingSessionError::InvalidInput("modelId is required.".into()))?;

        engine_validator.validate_engine_runtime_profile(&engine_id, &host_mode)?;
        engine_validator.validate_engine_model(&engine_id, &model_id)?;

        Ok(CreateCodingSessionInput {
            workspace_id,
            project_id,
            runtime_location_id,
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

        if title.is_none() && status.is_none() && host_mode.is_none() {
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
        coding_session_runtime_location_id: session.runtime_location_id.clone(),
        coding_session_id: session.id.clone(),
        coding_session_title: session.title.clone(),
        coding_session_status: session.status.clone(),
        coding_session_host_mode: session.host_mode.clone(),
        coding_session_engine_id: session.engine_id.clone(),
        coding_session_model_id: session.model_id.clone(),
        coding_session_runtime_status: session.runtime_status.clone(),
        coding_session_event_id: None,
        coding_session_event_kind: None,
        coding_session_event_payload: None,
        coding_session_event_sequence: None,
        native_session_id: session.native_session_id.clone(),
        coding_session_updated_at: Some(session.updated_at.clone()),
        turn_id,
    }
}

#[cfg(test)]
mod tests {
    use std::{
        sync::{
            atomic::{AtomicUsize, Ordering},
            Arc,
        },
        time::Duration,
    };

    use super::*;

    #[derive(Default)]
    struct FailingRealtimeEventPublisher {
        coding_session_publish_calls: AtomicUsize,
    }

    #[async_trait::async_trait]
    impl RealtimeEventPublisher for FailingRealtimeEventPublisher {
        async fn publish_workspace_event(
            &self,
            _ctx: &CodingSessionContext,
            _workspace_id: &str,
            _event_kind: &str,
            _payload_json: &str,
        ) -> Result<(), CodingSessionError> {
            Ok(())
        }

        async fn publish_coding_session_event(
            &self,
            _ctx: &CodingSessionContext,
            _event: &CodingSessionRealtimeEventInput,
        ) -> Result<(), CodingSessionError> {
            self.coding_session_publish_calls
                .fetch_add(1, Ordering::Relaxed);
            Err(CodingSessionError::EventPublish(
                "realtime hub unavailable".to_owned(),
            ))
        }
    }

    #[tokio::test]
    async fn durable_turn_stream_sink_applies_backpressure_without_rejecting_saturation() {
        let (sender, mut receiver) = tokio::sync::mpsc::channel(1);
        let sink = Arc::new(DurableTurnStreamSink { sender });

        let first_sink = sink.clone();
        let first_push = tokio::task::spawn_blocking(move || {
            first_sink.push_event(CodeEngineTurnStreamEvent::assistant_delta(
                "first".to_owned(),
            ))
        })
        .await
        .expect("first blocking sender task completes");
        first_push.expect("first event fits the empty bounded channel");

        let (started_sender, started_receiver) = std::sync::mpsc::channel();
        let second_sink = sink.clone();
        let second_push = tokio::task::spawn_blocking(move || {
            started_sender
                .send(())
                .expect("notify that the second sender started");
            second_sink.push_event(CodeEngineTurnStreamEvent::assistant_delta(
                "second".to_owned(),
            ))
        });
        started_receiver
            .recv_timeout(Duration::from_secs(1))
            .expect("second sender starts");
        std::thread::sleep(Duration::from_millis(25));
        assert!(
            !second_push.is_finished(),
            "a full bounded channel must backpressure instead of rejecting the provider chunk"
        );

        assert_eq!(
            receiver
                .recv()
                .await
                .expect("receive first event")
                .content_delta,
            "first"
        );
        second_push
            .await
            .expect("second blocking sender task completes")
            .expect("second event is accepted after capacity becomes available");
        assert_eq!(
            receiver
                .recv()
                .await
                .expect("receive second event")
                .content_delta,
            "second"
        );
    }

    #[tokio::test]
    async fn persisted_event_publish_failure_is_replayable_and_nonterminal() {
        let publisher = FailingRealtimeEventPublisher::default();
        let context = CodingSessionContext {
            tenant_id: "tenant-1".to_owned(),
            organization_id: "organization-1".to_owned(),
            user_id: "user-1".to_owned(),
            session_id: "request-1".to_owned(),
        };
        let persisted_event = CodingSessionRealtimeEventInput {
            event_kind: "coding-session.updated".to_owned(),
            source_surface: "core".to_owned(),
            workspace_id: "workspace-1".to_owned(),
            project_id: "project-1".to_owned(),
            coding_session_runtime_location_id: Some("runtime-location-1".to_owned()),
            coding_session_id: "coding-session-1".to_owned(),
            coding_session_title: "Session".to_owned(),
            coding_session_status: "active".to_owned(),
            coding_session_host_mode: "server".to_owned(),
            coding_session_engine_id: "codex".to_owned(),
            coding_session_model_id: "gpt-5".to_owned(),
            coding_session_runtime_status: Some("completed".to_owned()),
            coding_session_event_id: Some("durable-event-1".to_owned()),
            coding_session_event_kind: Some("turn.completed".to_owned()),
            coding_session_event_payload: Some(serde_json::json!({ "status": "completed" })),
            coding_session_event_sequence: Some("4".to_owned()),
            native_session_id: Some("native-session-1".to_owned()),
            coding_session_updated_at: Some("2026-07-16T00:00:00Z".to_owned()),
            turn_id: Some("turn-1".to_owned()),
        };

        let result =
            publish_replayable_coding_session_event(&publisher, &context, &persisted_event).await;

        assert!(
            result.is_ok(),
            "a realtime fan-out failure must not override an already-persisted terminal event"
        );
        assert_eq!(
            publisher
                .coding_session_publish_calls
                .load(Ordering::Relaxed),
            1
        );
        assert_eq!(
            persisted_event.coding_session_event_id.as_deref(),
            Some("durable-event-1")
        );
    }
}
