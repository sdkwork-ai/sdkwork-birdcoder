use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock, Weak};

use tokio::sync::{OwnedSemaphorePermit, Semaphore};

use sdkwork_birdcoder_codeengine::CodeEngineApprovalDecisionRecord;
use sdkwork_birdcoder_codeengine::CodeEngineUserQuestionAnswerRecord;
use sdkwork_birdcoder_codeengine::{
    find_codeengine_descriptor, find_codeengine_model_catalog_entry, CodeEngineTurnConfigRecord,
    CodeEngineTurnIdeContextRecord, CodeEngineTurnRequestRecord,
};
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::commands::{
    SubmitApprovalDecisionInput, SubmitUserQuestionAnswerInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::models::{
    AuthoritativeEngineRuntimeProfile, CodingSessionTurnIdeContextPayload,
};
use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    CodingSessionEventPayload, FinalizedProjectionTurnExecution, PendingProjectionTurnExecution,
};
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::event_payload::{
    build_projection_turn_event_id, build_succeeded_coding_session_turn_events,
    SucceededCodingSessionTurnEventInput,
};
use sdkwork_birdcoder_coding_sessions_service::native_session_types::NativeSessionCommandPayload;
use sdkwork_birdcoder_coding_sessions_service::ports::engine_validator::EngineValidator;
use sdkwork_birdcoder_coding_sessions_service::ports::project_execution_scope::ProjectExecutionScopeResolver;
use sdkwork_birdcoder_coding_sessions_service::ports::provider::{
    CodeEngineProvider, CodeEngineTurnStreamEvent, CodeEngineTurnStreamSink,
};
use sdkwork_birdcoder_kernel_bridge::{
    project_provider_neutral_interactions, BirdcoderKernelHost, BirdcoderTurnStreamSink,
};
use sdkwork_birdcoder_project_service::context::ProjectContext;
use sdkwork_birdcoder_project_service::domain::runtime_location::RuntimeLocationCapability;
use sdkwork_birdcoder_project_service::error::ProjectError;
use sdkwork_birdcoder_project_service::service::project_service::ProjectService;

use crate::bootstrap::config::{BirdServerConfig, CodeExecutionCapability};
use crate::bootstrap::runner_isolation::{ProviderRunnerBinding, ProviderRunnerIsolationError};

const DEFAULT_CODE_ENGINE_TURN_TIMEOUT_MS: u64 = 5 * 60 * 1_000;
const DEFAULT_CODE_ENGINE_TURN_MAX_OUTPUT_BYTES: usize = 2 * 1024 * 1024;
const CODE_ENGINE_TURN_ADMISSION_SATURATED: &str = "code-engine turn admission is saturated";
const CODE_ENGINE_USER_TURN_ADMISSION_SATURATED: &str =
    "code-engine turn admission for this user is saturated";
const DEFAULT_MAX_CONCURRENT_CODE_ENGINE_TURNS: usize = 4;
const DEFAULT_MAX_CONCURRENT_CODE_ENGINE_TURNS_PER_USER: usize = 1;

fn max_concurrent_code_engine_turns() -> usize {
    static MAX: OnceLock<usize> = OnceLock::new();
    *MAX.get_or_init(|| {
        std::env::var("BIRDCODER_MAX_CONCURRENT_CODE_ENGINE_TURNS")
            .ok()
            .and_then(|v| v.parse().ok())
            .filter(|v| *v >= 1)
            .unwrap_or(DEFAULT_MAX_CONCURRENT_CODE_ENGINE_TURNS)
    })
}

fn max_concurrent_code_engine_turns_per_user() -> usize {
    static MAX: OnceLock<usize> = OnceLock::new();
    *MAX.get_or_init(|| {
        std::env::var("BIRDCODER_MAX_CONCURRENT_CODE_ENGINE_TURNS_PER_USER")
            .ok()
            .and_then(|v| v.parse().ok())
            .filter(|v| *v >= 1)
            .unwrap_or(DEFAULT_MAX_CONCURRENT_CODE_ENGINE_TURNS_PER_USER)
    })
}

#[derive(Clone)]
pub struct GatewayProjectExecutionScopeResolver {
    project_service: Arc<ProjectService>,
}

pub fn wire_project_execution_scope_resolver(
    project_service: Arc<ProjectService>,
) -> Arc<dyn ProjectExecutionScopeResolver> {
    Arc::new(GatewayProjectExecutionScopeResolver { project_service })
}

#[async_trait::async_trait]
impl ProjectExecutionScopeResolver for GatewayProjectExecutionScopeResolver {
    async fn resolve_execution_root(
        &self,
        context: &CodingSessionContext,
        workspace_id: &str,
        project_id: &str,
        runtime_location_id: &str,
    ) -> Result<PathBuf, CodingSessionError> {
        let project_context = ProjectContext {
            tenant_id: context.tenant_id.clone(),
            organization_id: context.organization_id.clone(),
            user_id: context.user_id.clone(),
        };
        self.project_service
            // The project service verifies workspace membership, project write
            // authority, and project ownership before resolving this exact
            // runtime location. It never selects a preference or root fallback.
            .resolve_runtime_location_execution_root(
                &project_context,
                workspace_id,
                project_id,
                runtime_location_id,
                RuntimeLocationCapability::Terminal,
            )
            .await
            .map_err(map_project_execution_scope_error)
    }
}

fn map_project_execution_scope_error(error: ProjectError) -> CodingSessionError {
    match error {
        ProjectError::NotFound(_) | ProjectError::Forbidden(_) => {
            CodingSessionError::NotFound("Project was not found.".to_owned())
        }
        ProjectError::InvalidInput(message) => CodingSessionError::InvalidInput(message),
        // Coding-session operations do not expose project-resource If-Match
        // semantics, so an unexpected upstream precondition is a session
        // state conflict at this adapter boundary.
        ProjectError::PreconditionRequired(message) => CodingSessionError::Conflict(message),
        ProjectError::PreconditionFailed(message) => CodingSessionError::Conflict(message),
        ProjectError::Conflict(message) => CodingSessionError::Conflict(message),
        ProjectError::Unavailable(_) => CodingSessionError::Unavailable(
            "Project execution is unavailable for the selected runtime location.".to_owned(),
        ),
        ProjectError::Repository(message) => CodingSessionError::Repository(message),
        ProjectError::EventPublish(message) => CodingSessionError::EventPublish(message),
        ProjectError::GitOperation(message) | ProjectError::Internal(message) => {
            CodingSessionError::Internal(message)
        }
    }
}

fn kernel_host() -> Result<Arc<BirdcoderKernelHost>, String> {
    static HOST: OnceLock<Result<Arc<BirdcoderKernelHost>, String>> = OnceLock::new();
    HOST.get_or_init(|| {
        BirdcoderKernelHost::bootstrap()
            .map(Arc::new)
            .map_err(|error| format!("BirdCoder kernel host bootstrap failed: {error}"))
    })
    .clone()
}

fn code_engine_turn_admission() -> Arc<Semaphore> {
    static TURN_ADMISSION: OnceLock<Arc<Semaphore>> = OnceLock::new();
    TURN_ADMISSION
        .get_or_init(|| Arc::new(Semaphore::new(max_concurrent_code_engine_turns())))
        .clone()
}

type UserTurnAdmissionRegistry = HashMap<(String, String), Weak<Semaphore>>;

fn user_code_engine_turn_admission(
    ctx: &CodingSessionContext,
) -> Result<Arc<Semaphore>, CodingSessionError> {
    let tenant_id = ctx.tenant_id.trim();
    let user_id = ctx.user_id.trim();
    if tenant_id.is_empty() || user_id.is_empty() {
        return Err(CodingSessionError::InvalidInput(
            "tenant and user identity are required for code-engine execution.".into(),
        ));
    }

    static USER_TURN_ADMISSIONS: OnceLock<Mutex<UserTurnAdmissionRegistry>> = OnceLock::new();
    let mut admissions = USER_TURN_ADMISSIONS
        .get_or_init(|| Mutex::new(HashMap::new()))
        .lock()
        .map_err(|_| {
            CodingSessionError::Repository(
                "code-engine user admission registry is unavailable.".into(),
            )
        })?;
    // Opportunistic cleanup: remove entries where the Arc<Semaphore> has been
    // dropped (no active turns for that user). This bounds memory growth without
    // requiring a background sweeper task.
    admissions.retain(|_, admission| admission.strong_count() > 0);

    let key = (tenant_id.to_owned(), user_id.to_owned());
    if let Some(admission) = admissions.get(&key).and_then(Weak::upgrade) {
        return Ok(admission);
    }

    let admission = Arc::new(Semaphore::new(max_concurrent_code_engine_turns_per_user()));
    admissions.insert(key, Arc::downgrade(&admission));
    Ok(admission)
}

pub fn wire_code_engine_provider(config: &BirdServerConfig) -> Arc<dyn CodeEngineProvider> {
    wire_code_engine_provider_with_kernel_host(config, kernel_host)
}

fn wire_code_engine_provider_with_kernel_host<F>(
    config: &BirdServerConfig,
    kernel_host_factory: F,
) -> Arc<dyn CodeEngineProvider>
where
    F: FnOnce() -> Result<Arc<BirdcoderKernelHost>, String>,
{
    let execution_capability = config.code_execution_capability();
    let host = if execution_capability == CodeExecutionCapability::LocalHost {
        match kernel_host_factory() {
            Ok(host) => Some(host),
            Err(error) => {
                tracing::error!(
                    error = %error,
                    "BirdCoder kernel host unavailable; coding session turns will fail until kernel bootstrap succeeds"
                );
                None
            }
        }
    } else {
        None
    };
    let (runner_root, turn_admission) =
        if execution_capability == CodeExecutionCapability::LocalHost {
            // The coding-session service supplies an authorization-checked runtime
            // location for every turn. The gateway retains no project-root fallback.
            (None, code_engine_turn_admission())
        } else {
            // The unavailable provider must not retain a local path or runner root.
            (None, Arc::new(Semaphore::new(0)))
        };

    Arc::new(KernelBridgeCodeEngineProvider {
        host,
        execution_capability,
        runner_root,
        turn_admission,
    })
}

pub fn wire_engine_validator(config: &BirdServerConfig) -> Arc<dyn EngineValidator> {
    wire_engine_validator_with_kernel_host(config, kernel_host)
}

fn wire_engine_validator_with_kernel_host<F>(
    config: &BirdServerConfig,
    kernel_host_factory: F,
) -> Arc<dyn EngineValidator>
where
    F: FnOnce() -> Result<Arc<BirdcoderKernelHost>, String>,
{
    let execution_capability = config.code_execution_capability();
    let host = if execution_capability == CodeExecutionCapability::LocalHost {
        kernel_host_factory().ok()
    } else {
        None
    };

    Arc::new(CatalogEngineValidator {
        execution_capability,
        host,
    })
}

struct KernelBridgeCodeEngineProvider {
    host: Option<Arc<BirdcoderKernelHost>>,
    execution_capability: CodeExecutionCapability,
    runner_root: Option<PathBuf>,
    turn_admission: Arc<Semaphore>,
}

struct CatalogEngineValidator {
    execution_capability: CodeExecutionCapability,
    host: Option<Arc<BirdcoderKernelHost>>,
}

struct TurnAdmissionPermits {
    _process: OwnedSemaphorePermit,
    _user: OwnedSemaphorePermit,
}

struct GatewayCodeEngineTurnStreamSink {
    downstream: Arc<dyn CodeEngineTurnStreamSink>,
    emitted_delta_count: usize,
    rejection: Option<CodingSessionError>,
}

impl GatewayCodeEngineTurnStreamSink {
    fn new(downstream: Arc<dyn CodeEngineTurnStreamSink>) -> Self {
        Self {
            downstream,
            emitted_delta_count: 0,
            rejection: None,
        }
    }
}

impl BirdcoderTurnStreamSink for GatewayCodeEngineTurnStreamSink {
    fn push_content_delta(&mut self, content_delta: String) -> Result<(), String> {
        if content_delta.is_empty() {
            return Ok(());
        }
        if self.rejection.is_some() {
            return Ok(());
        }

        match self
            .downstream
            .push_event(CodeEngineTurnStreamEvent::assistant_delta(content_delta))
        {
            Ok(()) => {
                self.emitted_delta_count += 1;
                Ok(())
            }
            Err(error) => {
                // The runtime facade treats an error before its first collected
                // chunk as permission to invoke the provider again. Record the
                // projection failure and discard later chunks so this provider
                // execution remains exactly-once from BirdCoder's perspective.
                self.rejection = Some(error);
                Ok(())
            }
        }
    }
}

fn require_kernel_host(
    host: &Option<Arc<BirdcoderKernelHost>>,
) -> Result<Arc<BirdcoderKernelHost>, CodingSessionError> {
    host.as_ref().cloned().ok_or_else(|| {
        CodingSessionError::Repository("BirdCoder kernel host is unavailable.".into())
    })
}

fn ensure_execution_capability_available(
    execution_capability: CodeExecutionCapability,
) -> Result<(), CodingSessionError> {
    if let Some(reason) = execution_capability.unavailable_reason() {
        return Err(CodingSessionError::Unavailable(reason.to_owned()));
    }

    Ok(())
}

async fn execute_admitted_blocking_turn<T, F>(
    turn_admission: TurnAdmissionPermits,
    execute: F,
) -> Result<T, CodingSessionError>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tokio::task::spawn_blocking(move || {
        let _turn_admission = turn_admission;
        execute()
    })
    .await
    .map_err(|error| CodingSessionError::Repository(error.to_string()))?
    .map_err(CodingSessionError::Repository)
}

fn finalize_kernel_turn_execution(
    pending: &PendingProjectionTurnExecution,
    result: &sdkwork_birdcoder_codeengine::CodeEngineTurnResultRecord,
    stream_deltas: &[String],
) -> Result<FinalizedProjectionTurnExecution, CodingSessionError> {
    let turn_id = pending.turn.id.clone();
    let session_id = pending.session.id.clone();
    let runtime_id = pending
        .turn
        .runtime_id
        .clone()
        .unwrap_or_else(|| pending.operation.operation_id.clone());
    let operation_id = pending.operation.operation_id.clone();
    let completed_at = time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Iso8601::DEFAULT)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string());
    let projected_commands = map_kernel_commands(result.commands.as_deref());
    let mut events =
        build_succeeded_coding_session_turn_events(SucceededCodingSessionTurnEventInput {
            coding_session_id: &session_id,
            runtime_id: &runtime_id,
            turn_id: &turn_id,
            operation_id: &operation_id,
            assistant_content: &result.assistant_content,
            stream_deltas,
            commands: projected_commands.as_deref(),
            base_sequence: 0,
            completed_at: &completed_at,
            native_session_id: result.native_session_id.as_deref(),
        })
        .into_iter()
        .map(map_projection_event)
        .collect::<Vec<_>>();
    append_provider_neutral_interaction_events(
        &mut events,
        &session_id,
        &runtime_id,
        &turn_id,
        &completed_at,
        result.native_session_id.as_deref(),
        result.commands.as_deref(),
    )?;

    let mut turn = pending.turn.clone();
    turn.status = "completed".to_string();
    turn.started_at = turn.started_at.or_else(|| Some(completed_at.clone()));
    turn.completed_at = Some(completed_at);

    Ok(FinalizedProjectionTurnExecution {
        turn,
        events,
        native_session_id: result.native_session_id.clone(),
    })
}

/// Inserts canonical provider interactions before terminal turn events. The
/// durable repository owns final ids and sequences, but this projection keeps
/// interaction events correlated with the same source turn and runtime.
fn append_provider_neutral_interaction_events(
    events: &mut Vec<CodingSessionEventPayload>,
    coding_session_id: &str,
    runtime_id: &str,
    turn_id: &str,
    created_at: &str,
    native_session_id: Option<&str>,
    commands: Option<&[sdkwork_birdcoder_codeengine::CodeEngineSessionCommandRecord]>,
) -> Result<(), CodingSessionError> {
    let interactions = project_provider_neutral_interactions(commands)
        .map_err(|error| CodingSessionError::Provider(error.to_string()))?;
    if interactions.is_empty() {
        return Ok(());
    }

    let insertion_index = events
        .iter()
        .position(|event| event.kind == "message.completed")
        .unwrap_or(events.len());
    let projected_events = interactions.into_iter().map(|interaction| {
        let mut payload = interaction.payload;
        if let Some(native_session_id) = native_session_id {
            payload
                .entry("nativeSessionId".to_owned())
                .or_insert_with(|| serde_json::Value::String(native_session_id.to_owned()));
        }
        CodingSessionEventPayload {
            id: String::new(),
            coding_session_id: coding_session_id.to_owned(),
            turn_id: Some(turn_id.to_owned()),
            runtime_id: Some(runtime_id.to_owned()),
            kind: interaction.event_kind.to_owned(),
            sequence: 0,
            payload,
            created_at: created_at.to_owned(),
        }
    });
    events.splice(insertion_index..insertion_index, projected_events);

    for (sequence, event) in events.iter_mut().enumerate() {
        event.sequence = sequence;
        event.id = build_projection_turn_event_id(runtime_id, turn_id, sequence);
    }

    Ok(())
}

/// Ensures a streaming turn has a durable delta before its terminal event.
///
/// Some provider capabilities establish a native session through a non-stream
/// invoke on the first turn. That fallback is not real-time, but it must still
/// use the same durable delta path so the completed content is replayable and
/// matches the ordered delta aggregation.
fn emit_terminal_output_when_stream_is_empty(
    stream_sink: &mut GatewayCodeEngineTurnStreamSink,
    result: &Result<sdkwork_birdcoder_codeengine::CodeEngineTurnResultRecord, String>,
) {
    let Ok(result) = result.as_ref() else {
        return;
    };
    if stream_sink.rejection.is_some() || stream_sink.emitted_delta_count != 0 {
        return;
    }

    for content_delta in &result.stream_deltas {
        if stream_sink
            .push_content_delta(content_delta.clone())
            .is_err()
        {
            return;
        }
    }
    if stream_sink.emitted_delta_count == 0 && !result.assistant_content.is_empty() {
        let _ = stream_sink.push_content_delta(result.assistant_content.clone());
    }
}

#[async_trait::async_trait]
impl CodeEngineProvider for KernelBridgeCodeEngineProvider {
    fn ensure_execution_available(&self) -> Result<(), CodingSessionError> {
        ensure_execution_capability_available(self.execution_capability)
    }

    async fn execute_turn(
        &self,
        ctx: &CodingSessionContext,
        pending: &PendingProjectionTurnExecution,
    ) -> Result<FinalizedProjectionTurnExecution, CodingSessionError> {
        self.ensure_execution_available()?;
        let result = {
            let process_turn_admission =
                self.turn_admission
                    .clone()
                    .try_acquire_owned()
                    .map_err(|_| {
                        CodingSessionError::RateLimited(CODE_ENGINE_TURN_ADMISSION_SATURATED.into())
                    })?;
            let user_turn_admission = user_code_engine_turn_admission(ctx)?
                .try_acquire_owned()
                .map_err(|_| {
                    CodingSessionError::RateLimited(
                        CODE_ENGINE_USER_TURN_ADMISSION_SATURATED.into(),
                    )
                })?;
            let runner_binding = prepare_runner_binding(
                self.runner_root.as_deref(),
                ctx,
                &pending.session.workspace_id,
            )?;
            let request = build_turn_request_with_runner_binding(pending, runner_binding.as_ref())?;
            let host = require_kernel_host(&self.host)?;
            let turn_admission = TurnAdmissionPermits {
                _process: process_turn_admission,
                _user: user_turn_admission,
            };

            execute_admitted_blocking_turn(turn_admission, move || Ok(host.execute_turn(&request)))
                .await?
                .map_err(CodingSessionError::Provider)?
        };

        finalize_kernel_turn_execution(pending, &result, &result.stream_deltas)
    }

    async fn execute_turn_with_stream_sink(
        &self,
        ctx: &CodingSessionContext,
        pending: &PendingProjectionTurnExecution,
        sink: Arc<dyn CodeEngineTurnStreamSink>,
    ) -> Result<FinalizedProjectionTurnExecution, CodingSessionError> {
        self.ensure_execution_available()?;
        let (result, rejection, emitted_delta_count) = {
            let process_turn_admission =
                self.turn_admission
                    .clone()
                    .try_acquire_owned()
                    .map_err(|_| {
                        CodingSessionError::RateLimited(CODE_ENGINE_TURN_ADMISSION_SATURATED.into())
                    })?;
            let user_turn_admission = user_code_engine_turn_admission(ctx)?
                .try_acquire_owned()
                .map_err(|_| {
                    CodingSessionError::RateLimited(
                        CODE_ENGINE_USER_TURN_ADMISSION_SATURATED.into(),
                    )
                })?;
            let runner_binding = prepare_runner_binding(
                self.runner_root.as_deref(),
                ctx,
                &pending.session.workspace_id,
            )?;
            let request = build_turn_request_with_runner_binding(pending, runner_binding.as_ref())?;
            let host = require_kernel_host(&self.host)?;
            let turn_admission = TurnAdmissionPermits {
                _process: process_turn_admission,
                _user: user_turn_admission,
            };

            execute_admitted_blocking_turn(turn_admission, move || {
                let mut stream_sink = GatewayCodeEngineTurnStreamSink::new(sink);
                let result = host.execute_turn_with_stream_sink(&request, &mut stream_sink);
                emit_terminal_output_when_stream_is_empty(&mut stream_sink, &result);
                Ok((
                    result,
                    stream_sink.rejection,
                    stream_sink.emitted_delta_count,
                ))
            })
            .await?
        };

        if let Some(error) = rejection {
            return Err(error);
        }
        let result = result.map_err(CodingSessionError::Provider)?;
        debug_assert!(
            emitted_delta_count > 0,
            "live output must have a durable delta"
        );

        finalize_kernel_turn_execution(pending, &result, &[])
    }

    async fn submit_approval(
        &self,
        _ctx: &CodingSessionContext,
        engine_id: &str,
        native_session_id: Option<&str>,
        interaction_id: &str,
        input: &SubmitApprovalDecisionInput,
    ) -> Result<(), CodingSessionError> {
        if input.decision.is_empty() {
            return Err(CodingSessionError::InvalidInput(
                "decision is required.".into(),
            ));
        }
        let interaction_id = interaction_id.trim();
        if interaction_id.is_empty() {
            return Err(CodingSessionError::InvalidInput(
                "provider interactionId is required.".into(),
            ));
        }
        self.ensure_execution_available()?;
        let host = require_kernel_host(&self.host)?;
        let decision = CodeEngineApprovalDecisionRecord {
            native_session_id: native_session_id.map(str::to_string),
            // The service resolves a durable event UUID to this immutable
            // provider-native id before entering the adapter. The provider
            // uses it as both reply target and idempotency key.
            approval_id: interaction_id.to_string(),
            decision: input.decision.clone(),
            reason: input.reason.clone(),
        };
        let engine_id = engine_id.to_string();

        tokio::task::spawn_blocking(move || {
            host.submit_approval_decision(engine_id.as_str(), &decision)
        })
        .await
        .map_err(|error| CodingSessionError::Repository(error.to_string()))?
        .map_err(CodingSessionError::Repository)
    }

    async fn submit_question_answer(
        &self,
        _ctx: &CodingSessionContext,
        engine_id: &str,
        native_session_id: Option<&str>,
        interaction_id: &str,
        input: &SubmitUserQuestionAnswerInput,
    ) -> Result<(), CodingSessionError> {
        if input
            .answer
            .as_ref()
            .is_none_or(|value| value.trim().is_empty())
            && !input.rejected
        {
            return Err(CodingSessionError::InvalidInput(
                "answer is required.".into(),
            ));
        }
        let interaction_id = interaction_id.trim();
        if interaction_id.is_empty() {
            return Err(CodingSessionError::InvalidInput(
                "provider interactionId is required.".into(),
            ));
        }
        self.ensure_execution_available()?;
        let host = require_kernel_host(&self.host)?;
        let answer = CodeEngineUserQuestionAnswerRecord {
            native_session_id: native_session_id.map(str::to_string),
            // Do not send the durable event id to the provider. This remains
            // the canonical provider-native reply target/idempotency key.
            question_id: interaction_id.to_string(),
            answer: input.answer.clone().unwrap_or_default(),
            option_id: input.option_id.clone(),
            option_label: input.option_label.clone(),
            rejected: input.rejected,
        };
        let engine_id = engine_id.to_string();

        tokio::task::spawn_blocking(move || {
            host.submit_user_question_answer(engine_id.as_str(), &answer)
        })
        .await
        .map_err(|error| CodingSessionError::Repository(error.to_string()))?
        .map_err(CodingSessionError::Repository)
    }
}

fn map_kernel_commands(
    commands: Option<&[sdkwork_birdcoder_codeengine::CodeEngineSessionCommandRecord]>,
) -> Option<Vec<NativeSessionCommandPayload>> {
    commands.map(|commands| {
        commands
            .iter()
            .map(|command| NativeSessionCommandPayload {
                command: command.command.clone(),
                status: command.status.clone(),
                output: command.output.clone(),
                kind: command.kind.clone(),
                tool_name: command.tool_name.clone(),
                tool_call_id: command.tool_call_id.clone(),
                runtime_status: command.runtime_status.clone(),
                requires_approval: command.requires_approval,
                requires_reply: command.requires_reply,
            })
            .collect()
    })
}

#[async_trait::async_trait]
impl EngineValidator for CatalogEngineValidator {
    fn validate_engine_runtime_profile(
        &self,
        engine_id: &str,
        _host_mode: &str,
    ) -> Result<AuthoritativeEngineRuntimeProfile, CodingSessionError> {
        ensure_execution_capability_available(self.execution_capability)?;
        require_kernel_host(&self.host)?
            .validate_engine_id(engine_id)
            .map_err(CodingSessionError::InvalidInput)?;

        let descriptor = find_codeengine_descriptor(engine_id).ok_or_else(|| {
            CodingSessionError::InvalidInput(format!("unknown engineId \"{engine_id}\"."))
        })?;
        let transport_kind = descriptor
            .transport_kinds
            .first()
            .cloned()
            .unwrap_or_else(|| "sdk-stream".to_string());
        Ok(AuthoritativeEngineRuntimeProfile {
            transport_kind,
            capability_snapshot_json: "{}".to_string(),
        })
    }

    fn validate_engine_model(
        &self,
        engine_id: &str,
        model_id: &str,
    ) -> Result<(), CodingSessionError> {
        let Some(model) = find_codeengine_model_catalog_entry(engine_id, model_id) else {
            return Err(CodingSessionError::InvalidInput(format!(
                "modelId \"{model_id}\" is not registered for engineId \"{engine_id}\"."
            )));
        };
        if !model.status.eq_ignore_ascii_case("active") {
            return Err(CodingSessionError::InvalidInput(format!(
                "modelId \"{model_id}\" is not active for engineId \"{engine_id}\"."
            )));
        }
        Ok(())
    }
}

#[cfg(test)]
fn build_turn_request(
    pending: &PendingProjectionTurnExecution,
) -> Result<CodeEngineTurnRequestRecord, CodingSessionError> {
    build_turn_request_with_runner_binding(pending, None)
}

fn build_turn_request_with_runner_binding(
    pending: &PendingProjectionTurnExecution,
    runner_binding: Option<&ProviderRunnerBinding>,
) -> Result<CodeEngineTurnRequestRecord, CodingSessionError> {
    Ok(CodeEngineTurnRequestRecord {
        engine_id: pending.session.engine_id.clone(),
        model_id: pending.session.model_id.clone(),
        native_session_id: pending
            .native_session_id
            .clone()
            .or_else(|| pending.session.native_session_id.clone()),
        request_kind: pending.turn.request_kind.clone(),
        input_summary: pending.turn.input_summary.clone(),
        ide_context: map_ide_context(pending.ide_context.as_ref(), &pending.session.id),
        working_directory: Some(resolve_authorized_working_directory(
            pending.working_directory.as_deref(),
            runner_binding,
        )?),
        timeout_ms: Some(DEFAULT_CODE_ENGINE_TURN_TIMEOUT_MS),
        max_output_bytes: Some(DEFAULT_CODE_ENGINE_TURN_MAX_OUTPUT_BYTES),
        config: map_turn_config(pending.options.as_ref()),
    })
}

fn prepare_runner_binding(
    runner_root: Option<&Path>,
    ctx: &CodingSessionContext,
    workspace_id: &str,
) -> Result<Option<ProviderRunnerBinding>, CodingSessionError> {
    runner_root
        .map(|runner_root| {
            ProviderRunnerBinding::prepare(
                runner_root,
                ctx.tenant_id.as_str(),
                ctx.user_id.as_str(),
                workspace_id,
            )
        })
        .transpose()
        .map_err(map_runner_isolation_error)
}

fn map_runner_isolation_error(error: ProviderRunnerIsolationError) -> CodingSessionError {
    match error {
        ProviderRunnerIsolationError::MissingAuthorizedWorkingDirectory => {
            CodingSessionError::Unavailable(
                "Project execution requires synchronized runner source, which is not configured."
                    .to_owned(),
            )
        }
        error if error.is_invalid_input() => CodingSessionError::InvalidInput(error.to_string()),
        error => CodingSessionError::Repository(error.to_string()),
    }
}

fn map_ide_context(
    ide_context: Option<&CodingSessionTurnIdeContextPayload>,
    session_id: &str,
) -> Option<CodeEngineTurnIdeContextRecord> {
    let ide_context = ide_context?;
    Some(CodeEngineTurnIdeContextRecord {
        workspace_id: ide_context.workspace_id.clone(),
        project_id: ide_context.project_id.clone(),
        session_id: Some(session_id.to_string()),
        current_file: ide_context.current_file.as_ref().map(|current_file| {
            sdkwork_birdcoder_codeengine::CodeEngineTurnCurrentFileContextRecord {
                path: current_file.path.clone(),
                content: current_file.content.clone(),
                language: current_file.language.clone(),
            }
        }),
    })
}

fn map_turn_config(
    options: Option<
        &sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionTurnOptionsPayload,
    >,
) -> CodeEngineTurnConfigRecord {
    let mut config = CodeEngineTurnConfigRecord {
        approval_policy: Some("on-failure".to_owned()),
        sandbox_mode: Some("workspace-write".to_owned()),
        ..Default::default()
    };
    if let Some(options) = options {
        config.temperature = options.temperature;
        config.top_p = options.top_p;
        config.max_tokens = options.max_tokens;
    }
    config
}

fn resolve_authorized_working_directory(
    requested_directory: Option<&Path>,
    runner_binding: Option<&ProviderRunnerBinding>,
) -> Result<PathBuf, CodingSessionError> {
    if let Some(runner_binding) = runner_binding {
        return runner_binding
            .resolve_working_directory(requested_directory)
            .map_err(map_runner_isolation_error);
    }

    let requested_directory = requested_directory.ok_or_else(|| {
        CodingSessionError::Unavailable(
            "Coding session execution is unavailable until a runtime location is bound.".into(),
        )
    })?;
    let canonical_requested_directory =
        std::fs::canonicalize(requested_directory).map_err(|_| {
            CodingSessionError::Unavailable(
                "Project execution is unavailable for the selected runtime location.".into(),
            )
        })?;
    if !canonical_requested_directory.is_dir() {
        return Err(CodingSessionError::Unavailable(
            "Project execution is unavailable for the selected runtime location.".into(),
        ));
    }
    Ok(canonical_requested_directory)
}

fn map_projection_event(
    event: sdkwork_birdcoder_coding_sessions_service::event_payload::CodingSessionEventPayload,
) -> CodingSessionEventPayload {
    CodingSessionEventPayload {
        id: event.id,
        coding_session_id: event.coding_session_id,
        turn_id: event.turn_id,
        runtime_id: event.runtime_id,
        kind: event.kind,
        sequence: event.sequence,
        payload: event.payload,
        created_at: event.created_at,
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;
    use std::sync::atomic::{AtomicBool, AtomicU64, AtomicUsize, Ordering};
    use std::sync::{Arc, Mutex};
    use std::time::Duration;

    use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
    use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionTurnOptionsPayload;
    use sdkwork_birdcoder_coding_sessions_service::domain::results::{
        CodingSessionPayload, CodingSessionTurnPayload, OperationPayload,
        PendingProjectionTurnExecution,
    };
    use sdkwork_birdcoder_coding_sessions_service::ports::provider::{
        CodeEngineTurnStreamEvent, CodeEngineTurnStreamSink,
    };
    use sdkwork_birdcoder_kernel_bridge::BirdcoderTurnStreamSink;
    use serde_json::json;
    use tokio::sync::Semaphore;

    use crate::bootstrap::config::{
        BirdDeploymentProfile, BirdEnvironment, BirdRuntimeTarget, BirdServerConfig,
        CodeExecutionCapability,
    };
    use crate::bootstrap::runner_isolation::ProviderRunnerBinding;

    use super::{
        build_turn_request, build_turn_request_with_runner_binding, code_engine_turn_admission,
        execute_admitted_blocking_turn, map_kernel_commands, prepare_runner_binding,
        user_code_engine_turn_admission, wire_code_engine_provider_with_kernel_host,
        wire_engine_validator_with_kernel_host, CatalogEngineValidator, CodeEngineProvider,
        CodingSessionError, EngineValidator, GatewayCodeEngineTurnStreamSink,
        KernelBridgeCodeEngineProvider, SubmitApprovalDecisionInput, SubmitUserQuestionAnswerInput,
        TurnAdmissionPermits, CODE_ENGINE_USER_TURN_ADMISSION_SATURATED,
        DEFAULT_CODE_ENGINE_TURN_MAX_OUTPUT_BYTES, DEFAULT_CODE_ENGINE_TURN_TIMEOUT_MS,
    };

    #[derive(Default)]
    struct RecordingTurnStreamSink {
        events: Mutex<Vec<CodeEngineTurnStreamEvent>>,
    }

    impl CodeEngineTurnStreamSink for RecordingTurnStreamSink {
        fn push_event(&self, event: CodeEngineTurnStreamEvent) -> Result<(), CodingSessionError> {
            self.events.lock().expect("record stream event").push(event);
            Ok(())
        }
    }

    #[derive(Default)]
    struct RejectingTurnStreamSink {
        push_attempts: AtomicUsize,
    }

    impl CodeEngineTurnStreamSink for RejectingTurnStreamSink {
        fn push_event(&self, _event: CodeEngineTurnStreamEvent) -> Result<(), CodingSessionError> {
            self.push_attempts.fetch_add(1, Ordering::Relaxed);
            Err(CodingSessionError::Repository(
                "durable event append failed".to_owned(),
            ))
        }
    }

    #[test]
    fn gateway_stream_sink_projects_only_non_empty_content_deltas() {
        let downstream = Arc::new(RecordingTurnStreamSink::default());
        let mut stream_sink = GatewayCodeEngineTurnStreamSink::new(downstream.clone());

        stream_sink
            .push_content_delta("first".to_owned())
            .expect("first delta");
        stream_sink
            .push_content_delta(String::new())
            .expect("empty provider chunk is ignored");
        stream_sink
            .push_content_delta(" second".to_owned())
            .expect("second delta");

        let events = downstream
            .events
            .lock()
            .expect("read stream events")
            .clone();
        assert_eq!(
            events
                .iter()
                .map(|event| event.content_delta.as_str())
                .collect::<Vec<_>>(),
            ["first", " second"]
        );
        assert_eq!(stream_sink.emitted_delta_count, 2);
        assert!(stream_sink.rejection.is_none());
    }

    #[test]
    fn gateway_stream_sink_records_a_non_durable_delta_without_triggering_a_provider_fallback() {
        let downstream = Arc::new(RejectingTurnStreamSink::default());
        let mut stream_sink = GatewayCodeEngineTurnStreamSink::new(downstream.clone());

        stream_sink
            .push_content_delta("unsafe to broadcast".to_owned())
            .expect(
                "the facade must not interpret projection failure as a retryable stream failure",
            );
        stream_sink
            .push_content_delta("discarded after failure".to_owned())
            .expect("subsequent chunks are discarded while the original execution drains");

        assert_eq!(stream_sink.emitted_delta_count, 0);
        assert!(matches!(
            stream_sink.rejection,
            Some(CodingSessionError::Repository(ref message)) if message == "durable event append failed"
        ));
        assert_eq!(
            downstream.push_attempts.load(Ordering::Relaxed),
            1,
            "a rejected downstream sink must not receive later chunks or a second provider invocation fallback"
        );
    }

    #[test]
    fn gateway_stream_sink_emits_a_durable_fallback_for_invoke_only_turns() {
        let downstream = Arc::new(RecordingTurnStreamSink::default());
        let mut stream_sink = GatewayCodeEngineTurnStreamSink::new(downstream.clone());
        let result = Ok(sdkwork_birdcoder_codeengine::CodeEngineTurnResultRecord {
            assistant_content: "first streamed segment".to_owned(),
            stream_deltas: vec!["first ".to_owned(), "streamed segment".to_owned()],
            ..Default::default()
        });

        super::emit_terminal_output_when_stream_is_empty(&mut stream_sink, &result);

        let events = downstream
            .events
            .lock()
            .expect("read stream events")
            .clone();
        assert_eq!(
            events
                .iter()
                .map(|event| event.content_delta.as_str())
                .collect::<Vec<_>>(),
            ["first ", "streamed segment"]
        );
        assert_eq!(stream_sink.emitted_delta_count, 2);
        assert!(stream_sink.rejection.is_none());
    }

    #[test]
    fn gateway_does_not_emit_terminal_fallback_after_a_stream_projection_rejection() {
        let downstream = Arc::new(RejectingTurnStreamSink::default());
        let mut stream_sink = GatewayCodeEngineTurnStreamSink::new(downstream.clone());
        stream_sink
            .push_content_delta("first rejected chunk".to_owned())
            .expect("record the projection rejection without surfacing a facade stream error");
        let result = Ok(sdkwork_birdcoder_codeengine::CodeEngineTurnResultRecord {
            assistant_content: "terminal output must not be replayed".to_owned(),
            stream_deltas: vec!["terminal ".to_owned(), "output".to_owned()],
            ..Default::default()
        });

        super::emit_terminal_output_when_stream_is_empty(&mut stream_sink, &result);

        assert_eq!(stream_sink.emitted_delta_count, 0);
        assert_eq!(
            downstream.push_attempts.load(Ordering::Relaxed),
            1,
            "a recorded stream rejection must suppress the terminal-output fallback"
        );
    }

    #[test]
    fn kernel_commands_are_preserved_for_session_event_projection() {
        let commands = vec![
            sdkwork_birdcoder_codeengine::CodeEngineSessionCommandRecord {
                command: r#"{"command":"cargo test"}"#.to_owned(),
                status: "pending".to_owned(),
                kind: Some("tool_call".to_owned()),
                tool_name: Some("codex.shell".to_owned()),
                tool_call_id: Some("call-1".to_owned()),
                runtime_status: Some("awaiting".to_owned()),
                ..Default::default()
            },
        ];

        let projected = map_kernel_commands(Some(&commands)).expect("projected commands");

        assert_eq!(projected.len(), 1);
        assert_eq!(projected[0].tool_name.as_deref(), Some("codex.shell"));
        assert_eq!(projected[0].tool_call_id.as_deref(), Some("call-1"));
        assert_eq!(projected[0].command, r#"{"command":"cargo test"}"#);
    }

    #[test]
    fn finalize_persists_provider_neutral_approval_and_question_events_before_terminal_events() {
        let commands = vec![
            sdkwork_birdcoder_codeengine::CodeEngineSessionCommandRecord {
                command: json!({
                    "checkpointId": "native-approval-1",
                    "permission": "bash",
                    "metadata": {"command": "cargo test"},
                    "tool": {"messageID": "approval-message-1", "callID": "approval-call-1"}
                })
                .to_string(),
                status: "running".to_owned(),
                tool_name: Some("permission_request".to_owned()),
                tool_call_id: Some("approval-call-1".to_owned()),
                runtime_status: Some("awaiting_approval".to_owned()),
                requires_approval: Some(true),
                ..Default::default()
            },
            sdkwork_birdcoder_codeengine::CodeEngineSessionCommandRecord {
                command: json!({
                    "requestID": "native-question-1",
                    "questions": [{
                        "header": "Test scope",
                        "question": "Which tests should run?",
                        "options": [{"label": "Unit", "description": "Unit tests"}]
                    }],
                    "tool": {"messageID": "question-message-1", "callID": "question-call-1"}
                })
                .to_string(),
                status: "pending".to_owned(),
                tool_name: Some("user_question".to_owned()),
                tool_call_id: Some("question-call-1".to_owned()),
                runtime_status: Some("awaiting_user".to_owned()),
                requires_reply: Some(true),
                ..Default::default()
            },
        ];
        let result = sdkwork_birdcoder_codeengine::CodeEngineTurnResultRecord {
            assistant_content: "I need your input before continuing.".to_owned(),
            native_session_id: Some("native-session-1".to_owned()),
            commands: Some(commands),
            ..Default::default()
        };

        let finalized =
            super::finalize_kernel_turn_execution(&pending_turn_execution(), &result, &[])
                .expect("canonical interactions should be included in finalized projection events");

        let approval = finalized
            .events
            .iter()
            .find(|event| event.kind == "approval.required")
            .expect("approval interaction event");
        let question = finalized
            .events
            .iter()
            .find(|event| event.kind == "user.question.required")
            .expect("user question interaction event");
        let terminal_index = finalized
            .events
            .iter()
            .position(|event| event.kind == "message.completed")
            .expect("terminal message event");
        let approval_index = finalized
            .events
            .iter()
            .position(|event| event.kind == "approval.required")
            .expect("approval event index");
        let question_index = finalized
            .events
            .iter()
            .position(|event| event.kind == "user.question.required")
            .expect("question event index");

        assert!(approval_index < terminal_index);
        assert!(question_index < terminal_index);
        assert_eq!(approval.turn_id.as_deref(), Some("turn-1"));
        assert_eq!(approval.runtime_id.as_deref(), Some("runtime-1"));
        assert_eq!(
            approval.payload.get("interactionId"),
            Some(&json!("native-approval-1"))
        );
        assert_eq!(
            approval.payload.get("interactionKind"),
            Some(&json!("approval"))
        );
        assert_eq!(
            question.payload.get("interactionId"),
            Some(&json!("native-question-1"))
        );
        assert_eq!(
            question.payload.get("interactionKind"),
            Some(&json!("user_question"))
        );
        assert!(question.payload.contains_key("questions"));
        assert_eq!(
            question
                .payload
                .get("tool")
                .and_then(|value| value.get("messageId")),
            Some(&json!("question-message-1"))
        );
        assert_eq!(
            question
                .payload
                .get("toolArguments")
                .and_then(|value| value.get("requestID")),
            None,
            "provider request aliases must not leak through canonical payloads"
        );
        assert_eq!(
            approval.payload.get("nativeSessionId"),
            Some(&json!("native-session-1"))
        );
        assert!(
            finalized
                .events
                .iter()
                .enumerate()
                .all(|(sequence, event)| event.sequence == sequence),
            "canonical interaction insertion must preserve a contiguous projection order"
        );
    }

    #[tokio::test]
    async fn provider_rejects_blank_resolved_interaction_ids_before_external_dispatch() {
        let provider = KernelBridgeCodeEngineProvider {
            host: None,
            execution_capability: CodeExecutionCapability::LocalHost,
            runner_root: None,
            turn_admission: Arc::new(Semaphore::new(1)),
        };
        let context = coding_session_context();

        let approval_error = provider
            .submit_approval(
                &context,
                "opencode",
                None,
                "  ",
                &SubmitApprovalDecisionInput {
                    decision: "approved".to_owned(),
                    reason: None,
                },
            )
            .await
            .expect_err("blank provider interaction ids must be rejected before host dispatch");
        assert!(matches!(
            approval_error,
            CodingSessionError::InvalidInput(_)
        ));

        let question_error = provider
            .submit_question_answer(
                &context,
                "opencode",
                None,
                "  ",
                &SubmitUserQuestionAnswerInput {
                    answer: Some("Unit".to_owned()),
                    option_id: None,
                    option_label: None,
                    rejected: false,
                },
            )
            .await
            .expect_err("blank provider interaction ids must be rejected before host dispatch");
        assert!(matches!(
            question_error,
            CodingSessionError::InvalidInput(_)
        ));
    }

    struct TestDirectory {
        root: PathBuf,
    }

    impl TestDirectory {
        fn new() -> Self {
            let root = std::env::temp_dir()
                .join(format!("sdkwork-birdcoder-turn-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(&root).expect("create turn test directory");
            Self { root }
        }

        fn child(&self, name: &str) -> PathBuf {
            let path = self.root.join(name);
            std::fs::create_dir_all(&path).expect("create turn test child directory");
            path
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.root);
        }
    }

    fn unavailable_cloud_config() -> BirdServerConfig {
        BirdServerConfig {
            environment: BirdEnvironment::Production,
            deployment_profile: BirdDeploymentProfile::Cloud,
            runtime_target: BirdRuntimeTarget::Container,
            host: "0.0.0.0".to_owned(),
            port: 0,
            sqlite_file: PathBuf::from("target/test/birdcoder.sqlite"),
            allowed_origins: vec!["https://birdcoder.example.test".to_owned()],
            project_root: Some("local-project-root-must-not-be-retained".to_owned()),
            rate_limit_enabled: true,
            rate_limit_max_requests: 1,
            rate_limit_window_secs: 1,
        }
    }

    #[test]
    fn unavailable_factories_do_not_bootstrap_the_kernel_host() {
        let config = unavailable_cloud_config();
        let provider_factory_called = Arc::new(AtomicBool::new(false));
        let provider_factory_called_by_closure = provider_factory_called.clone();
        let provider = wire_code_engine_provider_with_kernel_host(&config, move || {
            provider_factory_called_by_closure.store(true, Ordering::SeqCst);
            panic!("unavailable provider must not bootstrap the kernel host");
        });

        assert!(!provider_factory_called.load(Ordering::SeqCst));
        assert!(matches!(
            provider.ensure_execution_available(),
            Err(CodingSessionError::Unavailable(_))
        ));

        let validator_factory_called = Arc::new(AtomicBool::new(false));
        let validator_factory_called_by_closure = validator_factory_called.clone();
        let validator = wire_engine_validator_with_kernel_host(&config, move || {
            validator_factory_called_by_closure.store(true, Ordering::SeqCst);
            panic!("unavailable validator must not bootstrap the kernel host");
        });

        assert!(!validator_factory_called.load(Ordering::SeqCst));
        assert!(matches!(
            validator.validate_engine_runtime_profile("codex", "server"),
            Err(CodingSessionError::Unavailable(_))
        ));
    }

    #[test]
    fn catalog_engine_validator_rejects_models_owned_by_another_engine() {
        let validator = CatalogEngineValidator {
            execution_capability: CodeExecutionCapability::LocalHost,
            host: None,
        };

        validator
            .validate_engine_model("gemini", "gemini-2.5-pro")
            .expect("Gemini catalog model should be accepted for Gemini");
        assert!(matches!(
            validator.validate_engine_model("gemini", "gpt-5.4"),
            Err(CodingSessionError::InvalidInput(_))
        ));
    }

    #[tokio::test]
    async fn execute_turn_rejects_a_saturated_admission_gate_before_resolving_the_kernel_host() {
        let turn_admission = Arc::new(Semaphore::new(1));
        let _held_permit = turn_admission
            .clone()
            .try_acquire_owned()
            .expect("hold the only code-engine turn admission permit");
        let provider = KernelBridgeCodeEngineProvider {
            host: None,
            execution_capability: CodeExecutionCapability::LocalHost,
            runner_root: None,
            turn_admission,
        };

        let result = tokio::time::timeout(
            Duration::from_millis(100),
            provider.execute_turn(&coding_session_context(), &pending_turn_execution()),
        )
        .await
        .expect("a saturated admission gate must reject immediately");

        assert!(
            matches!(
                result,
                Err(CodingSessionError::RateLimited(ref message))
                    if message == "code-engine turn admission is saturated"
            ),
            "the saturated gate must return overload before the kernel host is used; got {result:?}"
        );
    }

    #[tokio::test]
    async fn execute_turn_releases_admission_when_kernel_host_resolution_fails() {
        let turn_admission = Arc::new(Semaphore::new(1));
        let provider = KernelBridgeCodeEngineProvider {
            host: None,
            execution_capability: CodeExecutionCapability::LocalHost,
            runner_root: None,
            turn_admission: turn_admission.clone(),
        };
        let project = TestDirectory::new();
        let mut pending = pending_turn_execution();
        pending.working_directory = Some(project.root.clone());

        let result = provider
            .execute_turn(&coding_session_context(), &pending)
            .await;

        assert!(matches!(result, Err(CodingSessionError::Repository(_))));
        let _released_permit = turn_admission
            .try_acquire_owned()
            .expect("a failed host lookup must release the turn admission permit");
    }

    #[tokio::test]
    async fn admitted_blocking_turn_keeps_its_permit_after_the_waiter_is_cancelled() {
        let turn_admission = Arc::new(Semaphore::new(1));
        let process_permit = turn_admission
            .clone()
            .try_acquire_owned()
            .expect("acquire the only turn admission permit");
        let user_turn_admission = Arc::new(Semaphore::new(1));
        let user_permit = user_turn_admission
            .clone()
            .try_acquire_owned()
            .expect("acquire the only user turn admission permit");
        let permits = TurnAdmissionPermits {
            _process: process_permit,
            _user: user_permit,
        };
        let (started_sender, started_receiver) = std::sync::mpsc::sync_channel(1);
        let (finish_sender, finish_receiver) = std::sync::mpsc::sync_channel(1);
        let task = tokio::spawn(execute_admitted_blocking_turn(permits, move || {
            started_sender
                .send(())
                .map_err(|error| format!("signal blocked turn start: {error}"))?;
            finish_receiver
                .recv()
                .map_err(|error| format!("wait for blocked turn completion: {error}"))?;
            Ok(())
        }));

        tokio::task::spawn_blocking(move || {
            started_receiver
                .recv_timeout(Duration::from_secs(1))
                .expect("the blocking turn started")
        })
        .await
        .expect("join start signal wait");

        task.abort();
        assert!(task
            .await
            .expect_err("the outer async waiter must be cancelled")
            .is_cancelled());
        assert!(
            turn_admission.clone().try_acquire_owned().is_err(),
            "the detached blocking turn must retain its admission permit"
        );
        assert!(
            user_turn_admission.clone().try_acquire_owned().is_err(),
            "the detached blocking turn must retain its user admission permit"
        );

        finish_sender
            .send(())
            .expect("release the blocked turn for cleanup");
        let _released_permit = tokio::time::timeout(Duration::from_secs(1), async {
            loop {
                if let Ok(permit) = turn_admission.clone().try_acquire_owned() {
                    return permit;
                }
                tokio::task::yield_now().await;
            }
        })
        .await
        .expect("the completed blocking turn must release its permit");
        let _released_user_permit = user_turn_admission
            .try_acquire_owned()
            .expect("the completed blocking turn must release its user permit");
    }

    #[test]
    fn code_engine_turn_admission_is_shared_within_the_process() {
        let first = code_engine_turn_admission();
        let second = code_engine_turn_admission();

        assert!(
            Arc::ptr_eq(&first, &second),
            "every production provider must use the same process-local admission gate"
        );
    }

    #[test]
    fn user_turn_admission_is_shared_per_identity_and_isolated_between_users() {
        let context = coding_session_context();
        let first = user_code_engine_turn_admission(&context)
            .expect("create the first user turn admission");
        let second = user_code_engine_turn_admission(&context)
            .expect("resolve the same user turn admission");
        assert!(Arc::ptr_eq(&first, &second));

        let _held_permit = first
            .clone()
            .try_acquire_owned()
            .expect("hold the user's only turn permit");
        assert!(
            second.try_acquire_owned().is_err(),
            "the same tenant and user must share the turn limit"
        );

        let mut other_user = context;
        other_user.user_id = "900000000000000001".to_owned();
        let isolated = user_code_engine_turn_admission(&other_user)
            .expect("create the other user's turn admission");
        let _isolated_permit = isolated
            .try_acquire_owned()
            .expect("a different user must retain an independent turn slot");
    }

    #[tokio::test]
    async fn execute_turn_rejects_a_saturated_user_without_consuming_the_process_slot() {
        let context = coding_session_context();
        let user_turn_admission =
            user_code_engine_turn_admission(&context).expect("resolve the user turn admission");
        let _held_user_permit = user_turn_admission
            .try_acquire_owned()
            .expect("hold the user's only turn permit");
        let turn_admission = Arc::new(Semaphore::new(1));
        let provider = KernelBridgeCodeEngineProvider {
            host: None,
            execution_capability: CodeExecutionCapability::LocalHost,
            runner_root: None,
            turn_admission: turn_admission.clone(),
        };

        let result = provider
            .execute_turn(&context, &pending_turn_execution())
            .await;

        assert!(matches!(
            result,
            Err(CodingSessionError::RateLimited(ref message))
                if message == CODE_ENGINE_USER_TURN_ADMISSION_SATURATED
        ));
        let _released_process_permit = turn_admission
            .try_acquire_owned()
            .expect("a user-level rejection must release the process turn permit");
    }

    #[test]
    fn build_turn_request_uses_pending_directory_options_and_budgets() {
        let root = TestDirectory::new();
        let project = root.child("project");
        let mut pending = pending_turn_execution();
        pending.working_directory = Some(project.clone());
        pending.options = Some(CodingSessionTurnOptionsPayload {
            temperature: Some(0.2),
            top_p: Some(0.9),
            max_tokens: Some(4096),
        });

        let request = build_turn_request(&pending).expect("build a project-scoped turn request");

        assert_eq!(
            request.working_directory,
            Some(std::fs::canonicalize(project).expect("canonical project directory"))
        );
        assert_eq!(request.config.temperature, Some(0.2));
        assert_eq!(request.config.top_p, Some(0.9));
        assert_eq!(request.config.max_tokens, Some(4096));
        assert_eq!(
            request.config.approval_policy.as_deref(),
            Some("on-failure")
        );
        assert_eq!(
            request.config.sandbox_mode.as_deref(),
            Some("workspace-write")
        );
        assert!(!request.config.full_auto);
        assert!(!request.config.skip_git_repo_check);
        assert_eq!(
            request.timeout_ms,
            Some(DEFAULT_CODE_ENGINE_TURN_TIMEOUT_MS)
        );
        assert_eq!(
            request.max_output_bytes,
            Some(DEFAULT_CODE_ENGINE_TURN_MAX_OUTPUT_BYTES)
        );
        assert_eq!(request.engine_id, pending.session.engine_id);
        assert_eq!(request.model_id, pending.session.model_id);
    }

    #[test]
    fn build_turn_request_rejects_a_missing_authorized_runtime_location_directory() {
        let pending = pending_turn_execution();

        assert!(matches!(
            build_turn_request(&pending),
            Err(CodingSessionError::Unavailable(ref message))
                if message.contains("runtime location")
        ));
    }

    #[test]
    fn build_turn_request_rejects_an_unavailable_authorized_runtime_location_directory() {
        let mut pending = pending_turn_execution();
        pending.working_directory = Some(PathBuf::from("missing-authorized-runtime-location"));

        let result = build_turn_request(&pending);

        assert!(matches!(
            result,
            Err(CodingSessionError::Unavailable(ref message))
                if message.contains("selected runtime location")
        ));
    }

    #[test]
    fn build_turn_request_accepts_an_authoritative_project_directory_without_global_fallback() {
        let project = TestDirectory::new();
        let mut pending = pending_turn_execution();
        pending.working_directory = Some(project.root.clone());

        let request = build_turn_request(&pending)
            .expect("accept a server-resolved project runtime-location directory");

        assert_eq!(
            request.working_directory,
            Some(std::fs::canonicalize(&project.root).expect("canonical project directory"))
        );
    }

    #[test]
    fn build_turn_request_rejects_an_unsynchronized_runner_root() {
        let runner_root = TestDirectory::new();
        let pending = pending_turn_execution();
        let runner_binding = ProviderRunnerBinding::prepare(
            &runner_root.root,
            "100000000000000001",
            "100000000000000002",
            &pending.session.workspace_id,
        )
        .expect("prepare cloud runner binding");

        let result = build_turn_request_with_runner_binding(&pending, Some(&runner_binding));

        assert!(matches!(result, Err(CodingSessionError::Unavailable(_))));
    }

    #[test]
    fn build_turn_request_rejects_a_directory_outside_the_isolated_workspace() {
        let runner_root = TestDirectory::new();
        let outside = TestDirectory::new();
        let mut pending = pending_turn_execution();
        pending.working_directory = Some(outside.root.clone());
        let runner_binding = ProviderRunnerBinding::prepare(
            &runner_root.root,
            "100000000000000001",
            "100000000000000002",
            &pending.session.workspace_id,
        )
        .expect("prepare cloud runner binding");

        let result = build_turn_request_with_runner_binding(&pending, Some(&runner_binding));

        assert!(matches!(
            result,
            Err(CodingSessionError::InvalidInput(ref message))
                if message.contains("isolated runner workspace")
        ));
    }

    #[test]
    fn prepare_runner_binding_uses_authoritative_context_identity() {
        let runner_root = TestDirectory::new();
        let context = CodingSessionContext {
            tenant_id: "000100000000000001".to_owned(),
            organization_id: "0".to_owned(),
            user_id: "000100000000000002".to_owned(),
            session_id: "session-1".to_owned(),
        };

        let binding = prepare_runner_binding(Some(&runner_root.root), &context, "workspace-alpha")
            .expect("prepare runner binding")
            .expect("runner binding must be present");

        assert_eq!(binding.tenant_id, "100000000000001");
        assert_eq!(binding.user_id, "100000000000002");
        assert_eq!(binding.workspace_id, "workspace-alpha");
        assert_eq!(
            binding.environment().sdkwork_workspace_root,
            binding.workspace_root
        );
    }

    fn coding_session_context() -> CodingSessionContext {
        static NEXT_USER_ID: AtomicU64 = AtomicU64::new(100_000_000_000_000_002);
        CodingSessionContext {
            tenant_id: "100000000000000001".to_string(),
            organization_id: "0".to_string(),
            user_id: NEXT_USER_ID.fetch_add(1, Ordering::Relaxed).to_string(),
            session_id: "session-1".to_string(),
        }
    }

    fn pending_turn_execution() -> PendingProjectionTurnExecution {
        PendingProjectionTurnExecution {
            session: CodingSessionPayload {
                id: "session-1".to_string(),
                workspace_id: "workspace-1".to_string(),
                project_id: "project-1".to_string(),
                runtime_location_id: Some("runtime-location-1".to_string()),
                title: "Admission test".to_string(),
                status: "running".to_string(),
                host_mode: "standalone".to_string(),
                engine_id: "codex".to_string(),
                model_id: "gpt-5".to_string(),
                native_session_id: None,
                created_at: "2026-07-10T00:00:00Z".to_string(),
                updated_at: "2026-07-10T00:00:00Z".to_string(),
                last_turn_at: None,
                runtime_status: None,
                sort_timestamp: 0,
                transcript_updated_at: None,
                native_attributes: Default::default(),
            },
            turn: CodingSessionTurnPayload {
                id: "turn-1".to_string(),
                coding_session_id: "session-1".to_string(),
                runtime_id: Some("runtime-1".to_string()),
                request_kind: "user_message".to_string(),
                status: "pending".to_string(),
                input_summary: "test request".to_string(),
                started_at: None,
                completed_at: None,
            },
            operation: OperationPayload {
                operation_id: "operation-1".to_string(),
                status: "running".to_string(),
                artifact_refs: Vec::new(),
                stream_url: "/app/v3/api/operations/operation-1/stream".to_string(),
                stream_kind: "sse".to_string(),
            },
            native_session_id: None,
            ide_context: None,
            options: None,
            working_directory: None,
        }
    }
}
