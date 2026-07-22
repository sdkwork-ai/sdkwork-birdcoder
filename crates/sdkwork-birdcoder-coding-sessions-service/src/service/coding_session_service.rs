use std::{collections::BTreeMap, sync::Arc};

use sdkwork_birdcoder_native_sessions_service::service::native_session_service::{
    NativeSessionAttributesPayload as ProviderNativeSessionAttributesPayload,
    NativeSessionDetailPayload as ProviderNativeSessionDetailPayload, NativeSessionLookup,
    NativeSessionQuery, NativeSessionReader, NativeSessionSummaryPayload,
};
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
    CodingSessionDiscoveryScope, CodingSessionListQuery,
    CodingSessionTurnCurrentFileContextPayload, CodingSessionTurnIdeContextPayload,
    CodingSessionTurnOptionsPayload, DiscoveredNativeSessionInput,
    NativeSessionHistoryReconciliationInput, ReconciledCodingSessionEventInput,
    ReconciledCodingSessionMessageInput,
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
    native_session_reader: Option<Arc<dyn NativeSessionReader>>,
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
            native_session_reader: None,
        }
    }

    /// Adds provider-history discovery without changing the service's legacy
    /// constructor contract used by focused tests and non-hosted consumers.
    pub fn with_native_session_reader(mut self, reader: Arc<dyn NativeSessionReader>) -> Self {
        self.native_session_reader = Some(reader);
        self
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

    /// Lazily imports provider-authored history behind the durable logical
    /// coding-session authority. Filesystem resolution always starts from the
    /// persisted owner-scoped session; request parameters and provider CWD
    /// metadata never select the root.
    async fn reconcile_native_session_history_if_required(
        &self,
        ctx: &CodingSessionContext,
        session: &CodingSessionPayload,
    ) -> Result<(), CodingSessionError> {
        let Some(reader) = self.native_session_reader.as_ref() else {
            return Ok(());
        };
        let Some(binding) = native_session_history_binding(session) else {
            return Ok(());
        };

        if !self
            .repository
            .native_session_history_refresh_required(
                ctx,
                session.id.as_str(),
                binding.engine_id.as_str(),
                binding.native_session_id.as_str(),
                binding.source_revision.as_str(),
            )
            .await?
        {
            return Ok(());
        }

        let project_root = match self
            .project_execution_scope_resolver
            .resolve_execution_root(
                ctx,
                session.workspace_id.as_str(),
                session.project_id.as_str(),
                binding.runtime_location_id.as_str(),
            )
            .await
        {
            Ok(project_root) => project_root,
            Err(error) => {
                tracing::warn!(
                    coding_session_id = %session.id,
                    engine_id = %binding.engine_id,
                    reason = %error,
                    "provider history root is unavailable; serving the existing durable transcript"
                );
                return Ok(());
            }
        };

        let lookup = NativeSessionLookup {
            session_id: binding.native_session_id.clone(),
            engine_id: Some(binding.engine_id.clone()),
            workspace_id: Some(session.workspace_id.clone()),
            project_id: Some(session.project_id.clone()),
            runtime_location_id: Some(binding.runtime_location_id),
            project_root: Some(project_root.to_string_lossy().into_owned()),
        };
        let reader = Arc::clone(reader);
        let detail =
            match tokio::task::spawn_blocking(move || reader.get_session_detail(&lookup)).await {
                Ok(Ok(detail)) => detail,
                Ok(Err(error)) => {
                    tracing::warn!(
                        coding_session_id = %session.id,
                        engine_id = %binding.engine_id,
                        reason = %error,
                        "provider history read failed; serving the existing durable transcript"
                    );
                    return Ok(());
                }
                Err(error) => {
                    tracing::warn!(
                        coding_session_id = %session.id,
                        engine_id = %binding.engine_id,
                        reason = %error,
                        "provider history task failed; serving the existing durable transcript"
                    );
                    return Ok(());
                }
            };

        let Some(input) = build_native_session_history_reconciliation_input(session, detail)?
        else {
            tracing::warn!(
                coding_session_id = %session.id,
                engine_id = %binding.engine_id,
                "provider history did not match the persisted session binding; durable transcript was not changed"
            );
            return Ok(());
        };
        self.repository
            .reconcile_native_session_history(ctx, session.id.as_str(), &input)
            .await
    }

    pub async fn list_sessions(
        &self,
        ctx: &CodingSessionContext,
        query: &CodingSessionListQuery,
    ) -> Result<CodingSessionListPage, CodingSessionError> {
        if let (Some(reader), Some(scope)) = (
            self.native_session_reader.as_ref(),
            coding_session_discovery_scope(query),
        ) {
            let Some(project_root) = resolve_provider_discovery_root(
                self.project_execution_scope_resolver.as_ref(),
                ctx,
                &scope,
            )
            .await
            else {
                return self.repository.list_sessions(ctx, query).await;
            };
            let native_query = NativeSessionQuery {
                workspace_id: Some(scope.workspace_id.clone()),
                project_id: Some(scope.project_id.clone()),
                runtime_location_id: Some(scope.runtime_location_id.clone()),
                engine_id: normalize_borrowed_string(query.engine_id.as_deref()),
                project_root: Some(project_root.to_string_lossy().into_owned()),
            };
            let reader = Arc::clone(reader);
            match tokio::task::spawn_blocking(move || reader.discover_sessions(&native_query)).await
            {
                Ok(Ok(snapshot)) => {
                    let discovered = normalize_discovered_native_sessions(snapshot);
                    if !discovered.is_empty() {
                        self.repository
                            .upsert_discovered_native_sessions(ctx, &scope, discovered.as_slice())
                            .await?;
                    }
                }
                Ok(Err(error)) => {
                    // Durable sessions remain authoritative and readable when
                    // one local provider inventory is temporarily unavailable.
                    tracing::warn!(%error, "native coding-session discovery failed; retaining the durable inventory");
                }
                Err(error) => {
                    tracing::warn!(%error, "native coding-session discovery task failed; retaining the durable inventory");
                }
            }
        }
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

        let session = self.repository.get_session(ctx, &session_id).await?;
        self.reconcile_native_session_history_if_required(ctx, &session)
            .await?;
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

        if high_watermark.is_none() {
            let session = self.repository.get_session(ctx, &session_id).await?;
            self.reconcile_native_session_history_if_required(ctx, &session)
                .await?;
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

async fn resolve_provider_discovery_root(
    resolver: &dyn ProjectExecutionScopeResolver,
    ctx: &CodingSessionContext,
    scope: &CodingSessionDiscoveryScope,
) -> Option<std::path::PathBuf> {
    match resolver
        .resolve_execution_root(
            ctx,
            scope.workspace_id.as_str(),
            scope.project_id.as_str(),
            scope.runtime_location_id.as_str(),
        )
        .await
    {
        Ok(project_root) => Some(project_root),
        Err(error) => {
            tracing::warn!(
                workspace_id = %scope.workspace_id,
                project_id = %scope.project_id,
                runtime_location_id = %scope.runtime_location_id,
                reason = %error,
                "provider discovery root is unavailable; retaining the durable inventory"
            );
            None
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct NativeSessionHistoryBinding {
    engine_id: String,
    native_session_id: String,
    runtime_location_id: String,
    source_revision: String,
}

fn native_session_history_binding(
    session: &CodingSessionPayload,
) -> Option<NativeSessionHistoryBinding> {
    let engine_id =
        normalize_borrowed_string(Some(session.engine_id.as_str()))?.to_ascii_lowercase();
    let native_session_id = normalize_borrowed_string(session.native_session_id.as_deref())?;
    let runtime_location_id = normalize_borrowed_string(session.runtime_location_id.as_deref())?;
    normalize_borrowed_string(Some(session.workspace_id.as_str()))?;
    normalize_borrowed_string(Some(session.project_id.as_str()))?;
    let source_revision = session
        .transcript_updated_at
        .as_deref()
        .and_then(|value| normalize_borrowed_string(Some(value)))
        .or_else(|| normalize_borrowed_string(Some(session.updated_at.as_str())))
        .unwrap_or_else(|| session.sort_timestamp.to_string());

    Some(NativeSessionHistoryBinding {
        engine_id,
        native_session_id,
        runtime_location_id,
        source_revision,
    })
}

fn native_history_record_id(
    record_kind: &str,
    coding_session_id: &str,
    engine_id: &str,
    native_session_id: &str,
    source_message_id: &str,
    occurrence: usize,
) -> String {
    let seed = serde_json::json!([
        "sdkwork-birdcoder-native-history-v2",
        record_kind,
        coding_session_id,
        engine_id,
        native_session_id,
        source_message_id,
        occurrence,
    ])
    .to_string();
    format!(
        "provider-history:{record_kind}:{}",
        uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_OID, seed.as_bytes())
    )
}

fn serialize_provider_items<T: serde::Serialize>(
    items: Option<Vec<T>>,
    field: &str,
) -> Result<Option<Vec<serde_json::Value>>, CodingSessionError> {
    items
        .map(|items| {
            items
                .into_iter()
                .map(|item| {
                    serde_json::to_value(item).map_err(|error| {
                        CodingSessionError::Internal(format!(
                            "failed to normalize provider history {field}: {error}"
                        ))
                    })
                })
                .collect::<Result<Vec<_>, CodingSessionError>>()
        })
        .transpose()
        .map(|items| items.filter(|items| !items.is_empty()))
}

fn provider_history_detail_matches_session(
    session: &CodingSessionPayload,
    binding: &NativeSessionHistoryBinding,
    detail: &ProviderNativeSessionDetailPayload,
) -> bool {
    let summary = &detail.summary;
    let detail_engine_id = normalize_borrowed_string(Some(summary.engine_id.as_str()))
        .map(|value| value.to_ascii_lowercase());
    let detail_native_session_id = summary
        .native_session_id
        .as_deref()
        .and_then(|value| normalize_borrowed_string(Some(value)))
        .or_else(|| normalize_borrowed_string(Some(summary.id.as_str())));

    detail_engine_id.as_deref() == Some(binding.engine_id.as_str())
        && detail_native_session_id.as_deref() == Some(binding.native_session_id.as_str())
        && normalize_borrowed_string(Some(summary.workspace_id.as_str())).as_deref()
            == Some(session.workspace_id.trim())
        && normalize_borrowed_string(Some(summary.project_id.as_str())).as_deref()
            == Some(session.project_id.trim())
}

fn normalize_provider_history_content(role: &str, content: String) -> String {
    let is_wrapped_user_prompt = role.eq_ignore_ascii_case("user")
        && (content.contains("IDE context:")
            || content.contains("User request:")
            || content.contains("My request for Codex:")
            || content.contains("<environment_context>")
            || content.contains("<turn_aborted>"));
    if !is_wrapped_user_prompt {
        return content;
    }

    crate::event_payload::normalize_projection_overlay_message_content(content.as_str())
        .unwrap_or(content)
}

fn build_native_session_history_reconciliation_input(
    session: &CodingSessionPayload,
    detail: ProviderNativeSessionDetailPayload,
) -> Result<Option<NativeSessionHistoryReconciliationInput>, CodingSessionError> {
    let Some(binding) = native_session_history_binding(session) else {
        return Ok(None);
    };
    if !provider_history_detail_matches_session(session, &binding, &detail) {
        return Ok(None);
    }

    let source_revision = detail
        .summary
        .transcript_updated_at
        .as_deref()
        .and_then(|value| normalize_borrowed_string(Some(value)))
        .or_else(|| normalize_borrowed_string(Some(detail.summary.updated_at.as_str())))
        .unwrap_or(binding.source_revision.clone());
    let fallback_created_at = detail.summary.updated_at.clone();
    let mut source_occurrences = BTreeMap::<String, usize>::new();
    let mut messages = Vec::with_capacity(detail.messages.len());
    let mut events = Vec::with_capacity(detail.messages.len());

    for (index, message) in detail.messages.into_iter().enumerate() {
        let Some(role) = normalize_borrowed_string(Some(message.role.as_str())) else {
            tracing::warn!(
                coding_session_id = %session.id,
                provider_message_index = index,
                "ignoring provider history message without a role"
            );
            continue;
        };
        let source_message_id = normalize_borrowed_string(Some(message.id.as_str()))
            .unwrap_or_else(|| format!("message-{index}"));
        let occurrence = source_occurrences
            .entry(source_message_id.clone())
            .or_default();
        let message_id = native_history_record_id(
            "message",
            session.id.as_str(),
            binding.engine_id.as_str(),
            binding.native_session_id.as_str(),
            source_message_id.as_str(),
            *occurrence,
        );
        let event_id = native_history_record_id(
            "event",
            session.id.as_str(),
            binding.engine_id.as_str(),
            binding.native_session_id.as_str(),
            source_message_id.as_str(),
            *occurrence,
        );
        *occurrence += 1;

        let turn_id = message
            .turn_id
            .as_deref()
            .and_then(|value| normalize_borrowed_string(Some(value)));
        let content = normalize_provider_history_content(role.as_str(), message.content);
        let created_at = normalize_borrowed_string(Some(message.created_at.as_str()))
            .unwrap_or_else(|| fallback_created_at.clone());
        let commands = serialize_provider_items(message.commands, "commands")?;
        let reasoning = serialize_provider_items(message.reasoning, "reasoning")?;
        let tool_calls = message.tool_calls.filter(|items| !items.is_empty());
        let file_changes = message.file_changes.filter(|items| !items.is_empty());
        let resources = message.resources.filter(|items| !items.is_empty());
        let tool_call_id = message
            .tool_call_id
            .as_deref()
            .and_then(|value| normalize_borrowed_string(Some(value)));
        let metadata = message.metadata.unwrap_or_default();

        let mut payload = BTreeMap::new();
        payload.insert("role".to_owned(), serde_json::Value::String(role.clone()));
        payload.insert(
            "content".to_owned(),
            serde_json::Value::String(content.clone()),
        );
        payload.insert(
            "messageId".to_owned(),
            serde_json::Value::String(message_id.clone()),
        );
        payload.insert(
            "runtimeStatus".to_owned(),
            serde_json::Value::String("completed".to_owned()),
        );
        payload.insert(
            "nativeSessionId".to_owned(),
            serde_json::Value::String(binding.native_session_id.clone()),
        );
        if let Some(items) = commands.as_ref() {
            payload.insert(
                "commands".to_owned(),
                serde_json::Value::Array(items.clone()),
            );
        }
        if let Some(items) = tool_calls.as_ref() {
            payload.insert(
                "toolCalls".to_owned(),
                serde_json::Value::Array(items.clone()),
            );
        }
        if let Some(value) = tool_call_id.as_ref() {
            payload.insert(
                "toolCallId".to_owned(),
                serde_json::Value::String(value.clone()),
            );
        }
        if let Some(items) = file_changes.as_ref() {
            payload.insert(
                "fileChanges".to_owned(),
                serde_json::Value::Array(items.clone()),
            );
        }
        if let Some(items) = reasoning.as_ref() {
            payload.insert(
                "reasoning".to_owned(),
                serde_json::Value::Array(items.clone()),
            );
        }
        if let Some(items) = resources.as_ref() {
            payload.insert(
                "resources".to_owned(),
                serde_json::Value::Array(items.clone()),
            );
        }
        if let Some(value) = message.task_progress.as_ref() {
            payload.insert("taskProgress".to_owned(), value.clone());
        }
        if !metadata.is_empty() {
            payload.insert("metadata".to_owned(), serde_json::json!(&metadata));
        }

        messages.push(ReconciledCodingSessionMessageInput {
            id: message_id.clone(),
            turn_id: turn_id.clone(),
            role,
            content,
            metadata,
            tool_calls,
            tool_call_id,
            file_changes,
            commands,
            task_progress: message.task_progress,
            created_at: created_at.clone(),
        });
        events.push(ReconciledCodingSessionEventInput {
            id: event_id,
            message_id,
            turn_id,
            kind: "message.completed".to_owned(),
            payload,
            created_at,
        });
    }

    Ok(Some(NativeSessionHistoryReconciliationInput {
        engine_id: binding.engine_id,
        native_session_id: binding.native_session_id,
        refresh_revision: binding.source_revision,
        source_revision,
        messages,
        events,
    }))
}

fn coding_session_discovery_scope(
    query: &CodingSessionListQuery,
) -> Option<CodingSessionDiscoveryScope> {
    Some(CodingSessionDiscoveryScope {
        workspace_id: normalize_borrowed_string(query.workspace_id.as_deref())?,
        project_id: normalize_borrowed_string(query.project_id.as_deref())?,
        runtime_location_id: normalize_borrowed_string(query.runtime_location_id.as_deref())?,
    })
}

fn normalize_discovered_native_sessions(
    snapshot: Vec<NativeSessionSummaryPayload>,
) -> Vec<DiscoveredNativeSessionInput> {
    let mut sessions = BTreeMap::<(String, String), DiscoveredNativeSessionInput>::new();
    for summary in snapshot {
        if !summary.kind.trim().eq_ignore_ascii_case("coding") {
            continue;
        }
        let Some(engine_id) = normalize_borrowed_string(Some(summary.engine_id.as_str())) else {
            continue;
        };
        let engine_id = engine_id.to_ascii_lowercase();
        let Some(native_session_id) = summary
            .native_session_id
            .as_deref()
            .and_then(|value| normalize_borrowed_string(Some(value)))
        else {
            tracing::warn!(
                provider_session_id = %summary.id,
                engine_id,
                "ignoring provider session without a raw native identity"
            );
            continue;
        };
        let candidate = DiscoveredNativeSessionInput {
            title: summary.title,
            status: summary.status,
            host_mode: summary.host_mode,
            engine_id: engine_id.clone(),
            model_id: summary.model_id,
            native_session_id: native_session_id.clone(),
            created_at: summary.created_at,
            updated_at: summary.updated_at,
            last_turn_at: summary.last_turn_at,
            sort_timestamp: summary.sort_timestamp,
            transcript_updated_at: summary.transcript_updated_at,
            native_attributes: map_provider_native_session_attributes(summary.native_attributes),
        };
        let key = (engine_id, native_session_id);
        match sessions.entry(key) {
            std::collections::btree_map::Entry::Vacant(entry) => {
                entry.insert(candidate);
            }
            std::collections::btree_map::Entry::Occupied(mut entry) => {
                let current = entry.get();
                if (candidate.sort_timestamp, candidate.updated_at.as_str())
                    > (current.sort_timestamp, current.updated_at.as_str())
                {
                    entry.insert(candidate);
                }
            }
        }
    }
    sessions.into_values().collect()
}

fn map_provider_native_session_attributes(
    attributes: ProviderNativeSessionAttributesPayload,
) -> crate::native_session_types::NativeSessionAttributesPayload {
    crate::native_session_types::NativeSessionAttributesPayload {
        schema_version: attributes.schema_version,
        session_tree_id: attributes.session_tree_id,
        parent_session_id: attributes.parent_session_id,
        forked_from_session_id: attributes.forked_from_session_id,
        title: attributes.title,
        preview: attributes.preview,
        source: attributes.source,
        provider_version: attributes.provider_version,
        model_provider: attributes.model_provider,
        project_id: attributes.project_id,
        cwd: attributes.cwd,
        git_branch: attributes.git_branch,
        git_commit: attributes.git_commit,
        git_repository_url: attributes.git_repository_url,
        agent_name: attributes.agent_name,
        agent_role: attributes.agent_role,
        is_ephemeral: attributes.is_ephemeral,
        is_sidechain: attributes.is_sidechain,
        metadata: attributes.metadata,
    }
}

fn normalize_borrowed_string(value: Option<&str>) -> Option<String> {
    let normalized = value?.trim();
    (!normalized.is_empty()).then(|| normalized.to_owned())
}

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

    use sdkwork_birdcoder_native_sessions_service::service::native_session_service::{
        NativeSessionCommandPayload as ProviderNativeSessionCommandPayload,
        NativeSessionMessagePayload as ProviderNativeSessionMessagePayload,
        NativeSessionReasoningPayload as ProviderNativeSessionReasoningPayload,
    };

    use super::*;

    fn native_summary(
        engine_id: &str,
        native_session_id: Option<&str>,
        kind: &str,
        sort_timestamp: i64,
        updated_at: &str,
    ) -> NativeSessionSummaryPayload {
        NativeSessionSummaryPayload {
            id: format!("provider-{engine_id}-{sort_timestamp}"),
            workspace_id: "workspace-1".to_owned(),
            project_id: "project-1".to_owned(),
            title: format!("Session {sort_timestamp}"),
            status: "active".to_owned(),
            host_mode: "desktop".to_owned(),
            engine_id: engine_id.to_owned(),
            model_id: "provider-model".to_owned(),
            native_session_id: native_session_id.map(str::to_owned),
            created_at: "2026-07-22T00:00:00Z".to_owned(),
            updated_at: updated_at.to_owned(),
            last_turn_at: Some(updated_at.to_owned()),
            transcript_updated_at: Some(updated_at.to_owned()),
            sort_timestamp,
            kind: kind.to_owned(),
            native_attributes: ProviderNativeSessionAttributesPayload::default(),
        }
    }

    #[test]
    fn provider_discovery_requires_a_complete_authorized_scope() {
        let complete = CodingSessionListQuery {
            workspace_id: Some(" workspace-1 ".to_owned()),
            project_id: Some(" project-1 ".to_owned()),
            runtime_location_id: Some(" runtime-1 ".to_owned()),
            ..CodingSessionListQuery::default()
        };

        assert_eq!(
            coding_session_discovery_scope(&complete),
            Some(CodingSessionDiscoveryScope {
                workspace_id: "workspace-1".to_owned(),
                project_id: "project-1".to_owned(),
                runtime_location_id: "runtime-1".to_owned(),
            })
        );

        let missing_runtime_location = CodingSessionListQuery {
            runtime_location_id: None,
            ..complete
        };
        assert_eq!(
            coding_session_discovery_scope(&missing_runtime_location),
            None
        );
    }

    #[test]
    fn provider_snapshot_is_filtered_and_deduplicated_by_engine_and_raw_identity() {
        let discovered = normalize_discovered_native_sessions(vec![
            native_summary(
                "Codex",
                Some("shared-native-id"),
                "coding",
                1,
                "2026-07-22T00:01:00Z",
            ),
            native_summary(
                "codex",
                Some("shared-native-id"),
                "coding",
                2,
                "2026-07-22T00:02:00Z",
            ),
            native_summary(
                "claude-code",
                Some("shared-native-id"),
                "coding",
                3,
                "2026-07-22T00:03:00Z",
            ),
            native_summary(
                "gemini",
                Some("non-coding-id"),
                "chat",
                4,
                "2026-07-22T00:04:00Z",
            ),
            native_summary("opencode", None, "coding", 5, "2026-07-22T00:05:00Z"),
        ]);

        assert_eq!(discovered.len(), 2);
        let codex = discovered
            .iter()
            .find(|session| session.engine_id == "codex")
            .expect("Codex snapshot is retained");
        assert_eq!(codex.sort_timestamp, 2);
        assert_eq!(codex.title, "Session 2");
        assert!(discovered.iter().any(|session| {
            session.engine_id == "claude-code" && session.native_session_id == "shared-native-id"
        }));
    }

    fn durable_provider_session(engine_id: &str, native_session_id: &str) -> CodingSessionPayload {
        CodingSessionPayload {
            id: "logical-session-1".to_owned(),
            workspace_id: "workspace-1".to_owned(),
            project_id: "project-1".to_owned(),
            runtime_location_id: Some("runtime-location-1".to_owned()),
            title: "Provider history".to_owned(),
            status: "completed".to_owned(),
            host_mode: "desktop".to_owned(),
            engine_id: engine_id.to_owned(),
            model_id: "provider-model".to_owned(),
            native_session_id: Some(native_session_id.to_owned()),
            created_at: "2026-07-22T00:00:00Z".to_owned(),
            updated_at: "2026-07-22T00:02:00Z".to_owned(),
            last_turn_at: Some("2026-07-22T00:02:00Z".to_owned()),
            runtime_status: Some("completed".to_owned()),
            sort_timestamp: 2,
            transcript_updated_at: Some("2026-07-22T00:02:00Z".to_owned()),
            native_attributes: Default::default(),
        }
    }

    #[test]
    fn provider_history_projection_is_complete_stable_and_provider_isolated() {
        let session = durable_provider_session("codex", "shared-native-id");
        let mut summary = native_summary(
            "codex",
            Some("shared-native-id"),
            "coding",
            2,
            "2026-07-22T00:02:00Z",
        );
        summary.native_attributes.cwd = Some("C:/private/project".to_owned());
        let detail = ProviderNativeSessionDetailPayload {
            summary,
            messages: vec![
                ProviderNativeSessionMessagePayload {
                    id: "provider-message".to_owned(),
                    coding_session_id: "shared-native-id".to_owned(),
                    turn_id: Some("provider-turn-1".to_owned()),
                    role: "user".to_owned(),
                    content:
                        "IDE context:\n- Project ID: project-1\n\nUser request:\nRun all checks"
                            .to_owned(),
                    commands: None,
                    tool_calls: None,
                    tool_call_id: None,
                    file_changes: None,
                    reasoning: None,
                    resources: None,
                    task_progress: None,
                    metadata: None,
                    created_at: "2026-07-22T00:01:00Z".to_owned(),
                },
                ProviderNativeSessionMessagePayload {
                    id: "provider-message".to_owned(),
                    coding_session_id: "shared-native-id".to_owned(),
                    turn_id: Some("provider-turn-1".to_owned()),
                    role: "assistant".to_owned(),
                    content: String::new(),
                    commands: Some(vec![ProviderNativeSessionCommandPayload {
                        command: "cargo test".to_owned(),
                        status: "completed".to_owned(),
                        output: Some("ok".to_owned()),
                        ..Default::default()
                    }]),
                    tool_calls: Some(vec![serde_json::json!({"id": "tool-1"})]),
                    tool_call_id: Some("tool-1".to_owned()),
                    file_changes: Some(vec![serde_json::json!({"path": "src/lib.rs"})]),
                    reasoning: Some(vec![ProviderNativeSessionReasoningPayload {
                        id: "reasoning-1".to_owned(),
                        summary: "Checked the workspace.".to_owned(),
                        title: None,
                        created_at: None,
                        started_at: None,
                        completed_at: None,
                        duration_ms: Some(10),
                    }]),
                    resources: Some(vec![serde_json::json!({"id": "resource-1"})]),
                    task_progress: Some(serde_json::json!({"completed": 1, "total": 1})),
                    metadata: Some(BTreeMap::from([(
                        "providerKind".to_owned(),
                        "tool-result".to_owned(),
                    )])),
                    created_at: "2026-07-22T00:02:00Z".to_owned(),
                },
            ],
        };

        let first = build_native_session_history_reconciliation_input(&session, detail.clone())
            .expect("project provider history")
            .expect("matching provider binding");
        let second = build_native_session_history_reconciliation_input(&session, detail)
            .expect("project provider history again")
            .expect("matching provider binding");

        assert_eq!(first, second, "the same snapshot must be idempotent");
        assert_eq!(first.messages.len(), 2);
        assert_eq!(first.events.len(), 2);
        assert_eq!(first.messages[0].content, "Run all checks");
        assert_ne!(first.messages[0].id, first.messages[1].id);
        assert_eq!(first.events[1].message_id, first.messages[1].id);
        assert_eq!(
            first.events[1].payload.get("reasoning"),
            Some(&serde_json::json!([{
                "id": "reasoning-1",
                "summary": "Checked the workspace.",
                "durationMs": 10
            }]))
        );
        assert_eq!(
            first.events[1].payload.get("resources"),
            Some(&serde_json::json!([{"id": "resource-1"}]))
        );
        assert!(!first.events[0].id.contains("shared-native-id"));
        assert!(!format!("{:?}", first.events).contains("C:/private/project"));

        let wrong_provider_session = durable_provider_session("claude-code", "shared-native-id");
        let mismatched_detail = ProviderNativeSessionDetailPayload {
            summary: native_summary(
                "codex",
                Some("shared-native-id"),
                "coding",
                2,
                "2026-07-22T00:02:00Z",
            ),
            messages: Vec::new(),
        };
        assert!(build_native_session_history_reconciliation_input(
            &wrong_provider_session,
            mismatched_detail,
        )
        .expect("validate provider isolation")
        .is_none());
        assert_ne!(
            native_history_record_id(
                "event",
                "coding-session-1",
                "codex",
                "same-id",
                "message",
                0,
            ),
            native_history_record_id(
                "event",
                "coding-session-1",
                "claude-code",
                "same-id",
                "message",
                0,
            ),
        );
        assert_ne!(
            native_history_record_id(
                "event",
                "coding-session-1",
                "codex",
                "same-id",
                "message",
                0,
            ),
            native_history_record_id(
                "event",
                "coding-session-2",
                "codex",
                "same-id",
                "message",
                0,
            ),
        );
    }

    #[test]
    fn provider_history_requires_a_persisted_runtime_binding() {
        let mut session = durable_provider_session("gemini", "native-session-1");
        assert!(native_session_history_binding(&session).is_some());
        session.runtime_location_id = None;
        assert_eq!(native_session_history_binding(&session), None);
    }

    struct UnavailableProjectExecutionScopeResolver;

    #[async_trait::async_trait]
    impl ProjectExecutionScopeResolver for UnavailableProjectExecutionScopeResolver {
        async fn resolve_execution_root(
            &self,
            _context: &CodingSessionContext,
            _workspace_id: &str,
            _project_id: &str,
            _runtime_location_id: &str,
        ) -> Result<std::path::PathBuf, CodingSessionError> {
            Err(CodingSessionError::Unavailable(
                "runtime location is temporarily unavailable".to_owned(),
            ))
        }
    }

    #[tokio::test]
    async fn unavailable_provider_discovery_root_is_nonterminal() {
        let root = resolve_provider_discovery_root(
            &UnavailableProjectExecutionScopeResolver,
            &CodingSessionContext {
                tenant_id: "tenant-1".to_owned(),
                organization_id: "organization-1".to_owned(),
                user_id: "user-1".to_owned(),
                session_id: "request-session-1".to_owned(),
            },
            &CodingSessionDiscoveryScope {
                workspace_id: "workspace-1".to_owned(),
                project_id: "project-1".to_owned(),
                runtime_location_id: "runtime-location-1".to_owned(),
            },
        )
        .await;

        assert_eq!(root, None);
    }

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
