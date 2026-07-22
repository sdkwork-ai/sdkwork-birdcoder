use crate::context::CodingSessionContext;
use crate::domain::commands::{
    AppendCodingSessionRealtimeEventInput, CodingSessionInteractionKind, CreateCodingSessionInput,
    CreateCodingSessionTurnInput, EditCodingSessionMessageInput, ForkCodingSessionInput,
    SubmitApprovalDecisionInput, SubmitUserQuestionAnswerInput, UpdateCodingSessionInput,
};
use crate::domain::models::{
    ClaimCodingSessionOperationInput, CodingSessionDiscoveryScope, CodingSessionListQuery,
    CompleteCodingSessionOperationInput, DiscoveredNativeSessionInput,
    DurableCodingSessionOperation, EnqueueCodingSessionOperationInput,
    FailCodingSessionOperationInput, NativeSessionHistoryReconciliationInput,
    RenewCodingSessionOperationLeaseInput,
};
use crate::domain::results::{
    ApprovalDecisionPayload, ClaimedCodingSessionInteraction, CodingSessionArtifactPayload,
    CodingSessionCheckpointPayload, CodingSessionEventPayload, CodingSessionListPage,
    CodingSessionPayload, CodingSessionReplayPage, CodingSessionTurnPayload,
    DeleteCodingSessionMessagePayload, EditCodingSessionMessagePayload, OperationPayload,
    PersistedCodingSessionMutation, ResolvedCodingSessionInteraction, UserQuestionAnswerPayload,
};
use crate::error::CodingSessionError;

#[async_trait::async_trait]
pub trait CodingSessionRepository: Send + Sync {
    /// Idempotently materializes one complete provider snapshot before public
    /// coding-session pagination is evaluated. Implementations must preserve
    /// an existing logical session id for the same owner + engine + raw native
    /// identity.
    async fn upsert_discovered_native_sessions(
        &self,
        ctx: &CodingSessionContext,
        scope: &CodingSessionDiscoveryScope,
        sessions: &[DiscoveredNativeSessionInput],
    ) -> Result<(), CodingSessionError>;

    /// Returns whether the provider transcript must be read before the next
    /// durable event page is served. Implementations may return `false` only
    /// when the owner-scoped logical session still has the exact expected
    /// engine/native binding and the persisted reconciliation revision is
    /// covered by a short freshness lease. This check runs for every offset
    /// request so a direct first request with `offset > 0` remains correct,
    /// while normal multi-page reads avoid repeatedly scanning provider files.
    async fn native_session_history_refresh_required(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        engine_id: &str,
        native_session_id: &str,
        source_revision: &str,
    ) -> Result<bool, CodingSessionError>;

    /// Transactionally reconciles one complete provider transcript into the
    /// durable, provider-neutral message and event projections for an existing
    /// logical coding session.
    ///
    /// Implementations must lock and revalidate tenant, user, session,
    /// engine, and raw native identity before writing; preserve the logical
    /// session id; upsert deterministic message/event ids idempotently; keep
    /// existing event sequence numbers on updates; allocate new sequences in
    /// input order; suppress provider candidates already represented by an
    /// equivalent durable local message/final event or aggregate delta; and
    /// advance the reconciliation revision/freshness marker only after
    /// messages, events, and session transcript timestamps commit together.
    async fn reconcile_native_session_history(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        input: &NativeSessionHistoryReconciliationInput,
    ) -> Result<(), CodingSessionError>;

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

    /// Copies messages, turns, events, and artifacts from the source session to
    /// the target session. Called after `fork_session` to preserve conversation
    /// history in the forked session.
    async fn copy_session_history(
        &self,
        ctx: &CodingSessionContext,
        source_session_id: &str,
        target_session_id: &str,
    ) -> Result<usize, CodingSessionError>;

    async fn list_turns(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionTurnPayload>, usize), CodingSessionError>;

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
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionEventPayload>, usize), CodingSessionError>;

    /// Reads one stable replay window using sequence keyset pagination. The
    /// first page supplies `None` for `high_watermark`; later pages reuse the
    /// returned value to exclude concurrently appended events.
    async fn replay_events(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        after_sequence: Option<usize>,
        high_watermark: Option<usize>,
        limit: usize,
    ) -> Result<CodingSessionReplayPage, CodingSessionError>;

    /// Appends one provider-neutral realtime event after assigning its durable
    /// session sequence in the same transaction. A caller may publish the
    /// returned event only after this method succeeds.
    async fn append_realtime_event(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        input: &AppendCodingSessionRealtimeEventInput,
    ) -> Result<CodingSessionEventPayload, CodingSessionError>;

    async fn list_artifacts(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionArtifactPayload>, usize), CodingSessionError>;

    async fn list_checkpoints(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        offset: usize,
        limit: usize,
    ) -> Result<(Vec<CodingSessionCheckpointPayload>, usize), CodingSessionError>;

    /// Resolves a mutation target by durable event UUID. The repository enforces
    /// event kind, tenant, user, session, turn, runtime, and canonical payload
    /// pairing before the service can invoke a provider.
    async fn resolve_durable_interaction(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        interaction_event_id: &str,
        interaction_kind: CodingSessionInteractionKind,
    ) -> Result<ResolvedCodingSessionInteraction, CodingSessionError>;

    /// Atomically resolves and reserves an unresolved interaction before a
    /// provider call. A successful claim is exclusive across service
    /// processes until it is settled, released, or expires.
    async fn claim_durable_interaction(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        interaction_event_id: &str,
        interaction_kind: CodingSessionInteractionKind,
    ) -> Result<ClaimedCodingSessionInteraction, CodingSessionError>;

    /// Releases a pre-provider claim only when it is still owned by
    /// `claim_id`. This is used after a definite provider rejection; unknown
    /// provider outcomes intentionally retain the claim until expiry.
    async fn release_durable_interaction_claim(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        interaction_event_id: &str,
        interaction_kind: CodingSessionInteractionKind,
        claim_id: &str,
    ) -> Result<(), CodingSessionError>;

    async fn submit_approval_decision(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        interaction_event_id: &str,
        interaction_claim_id: &str,
        input: &SubmitApprovalDecisionInput,
    ) -> Result<PersistedCodingSessionMutation<ApprovalDecisionPayload>, CodingSessionError>;

    async fn submit_user_question_answer(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        question_id: &str,
        interaction_claim_id: &str,
        input: &SubmitUserQuestionAnswerInput,
    ) -> Result<PersistedCodingSessionMutation<UserQuestionAnswerPayload>, CodingSessionError>;

    async fn get_operation(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        operation_id: &str,
    ) -> Result<OperationPayload, CodingSessionError>;

    async fn get_durable_operation(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        operation_id: &str,
    ) -> Result<DurableCodingSessionOperation, CodingSessionError>;

    async fn enqueue_operation(
        &self,
        ctx: &CodingSessionContext,
        input: &EnqueueCodingSessionOperationInput,
    ) -> Result<DurableCodingSessionOperation, CodingSessionError>;

    /// Claims the next eligible operation across all owners. This internal
    /// worker boundary intentionally has no end-user request context.
    async fn claim_operation(
        &self,
        input: &ClaimCodingSessionOperationInput,
    ) -> Result<Option<DurableCodingSessionOperation>, CodingSessionError>;

    async fn renew_operation_lease(
        &self,
        input: &RenewCodingSessionOperationLeaseInput,
    ) -> Result<DurableCodingSessionOperation, CodingSessionError>;

    async fn complete_operation(
        &self,
        input: &CompleteCodingSessionOperationInput,
    ) -> Result<DurableCodingSessionOperation, CodingSessionError>;

    async fn fail_operation(
        &self,
        input: &FailCodingSessionOperationInput,
    ) -> Result<DurableCodingSessionOperation, CodingSessionError>;

    async fn finalize_turn_execution(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        finalized: &crate::domain::results::FinalizedProjectionTurnExecution,
    ) -> Result<crate::domain::results::PersistedProjectionTurnExecution, CodingSessionError>;

    async fn mark_turn_failed(
        &self,
        ctx: &CodingSessionContext,
        session_id: &str,
        turn_id: &str,
    ) -> Result<Option<CodingSessionEventPayload>, CodingSessionError>;
}
