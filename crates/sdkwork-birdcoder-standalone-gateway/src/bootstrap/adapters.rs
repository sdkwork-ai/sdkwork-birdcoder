use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, OnceLock, Weak};

use tokio::sync::{OwnedSemaphorePermit, Semaphore};

use sdkwork_birdcoder_codeengine::CodeEngineApprovalDecisionRecord;
use sdkwork_birdcoder_codeengine::CodeEngineUserQuestionAnswerRecord;
use sdkwork_birdcoder_codeengine::{
    find_codeengine_descriptor, CodeEngineTurnConfigRecord, CodeEngineTurnIdeContextRecord,
    CodeEngineTurnRequestRecord,
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
    build_succeeded_coding_session_turn_events, SucceededCodingSessionTurnEventInput,
};
use sdkwork_birdcoder_coding_sessions_service::ports::engine_validator::EngineValidator;
use sdkwork_birdcoder_coding_sessions_service::ports::provider::CodeEngineProvider;
use sdkwork_birdcoder_kernel_bridge::BirdcoderKernelHost;

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

pub struct Adapters {
    pub project_root: Option<String>,
}

pub fn wire_adapters(config: &BirdServerConfig) -> Adapters {
    Adapters {
        project_root: config.project_root.clone(),
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

    static USER_TURN_ADMISSIONS: OnceLock<Mutex<HashMap<(String, String), Weak<Semaphore>>>> =
        OnceLock::new();
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
    let (project_root, runner_root, turn_admission) =
        if execution_capability == CodeExecutionCapability::LocalHost {
            (
                config.project_root.clone(),
                config.provider_runner_root(),
                code_engine_turn_admission(),
            )
        } else {
            // The unavailable provider must not retain a local path or runner root.
            (None, None, Arc::new(Semaphore::new(0)))
        };

    Arc::new(KernelBridgeCodeEngineProvider {
        host,
        execution_capability,
        project_root,
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
    project_root: Option<String>,
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
            let request = build_turn_request_with_runner_binding(
                pending,
                self.project_root.as_deref(),
                runner_binding.as_ref(),
            )?;
            let host = require_kernel_host(&self.host)?;
            let turn_admission = TurnAdmissionPermits {
                _process: process_turn_admission,
                _user: user_turn_admission,
            };

            execute_admitted_blocking_turn(turn_admission, move || host.execute_turn(&request))
                .await?
        };

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

        let events =
            build_succeeded_coding_session_turn_events(SucceededCodingSessionTurnEventInput {
                coding_session_id: &session_id,
                runtime_id: &runtime_id,
                turn_id: &turn_id,
                operation_id: &operation_id,
                assistant_content: &result.assistant_content,
                commands: None,
                base_sequence: 0,
                completed_at: &completed_at,
                native_session_id: result.native_session_id.as_deref(),
            })
            .into_iter()
            .map(map_projection_event)
            .collect();

        let mut turn = pending.turn.clone();
        turn.status = "completed".to_string();
        turn.started_at = turn.started_at.or_else(|| Some(completed_at.clone()));
        turn.completed_at = Some(completed_at);

        Ok(FinalizedProjectionTurnExecution {
            turn,
            events,
            native_session_id: result.native_session_id,
        })
    }

    async fn submit_approval(
        &self,
        _ctx: &CodingSessionContext,
        engine_id: &str,
        native_session_id: Option<&str>,
        checkpoint_id: &str,
        input: &SubmitApprovalDecisionInput,
    ) -> Result<(), CodingSessionError> {
        if input.decision.is_empty() {
            return Err(CodingSessionError::InvalidInput(
                "decision is required.".into(),
            ));
        }

        self.ensure_execution_available()?;
        let host = require_kernel_host(&self.host)?;
        let decision = CodeEngineApprovalDecisionRecord {
            native_session_id: native_session_id.map(str::to_string),
            approval_id: checkpoint_id.to_string(),
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
        question_id: &str,
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

        self.ensure_execution_available()?;
        let host = require_kernel_host(&self.host)?;
        let answer = CodeEngineUserQuestionAnswerRecord {
            native_session_id: native_session_id.map(str::to_string),
            question_id: question_id.to_string(),
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
}

fn build_turn_request(
    pending: &PendingProjectionTurnExecution,
    project_root: Option<&str>,
) -> Result<CodeEngineTurnRequestRecord, CodingSessionError> {
    build_turn_request_with_runner_binding(pending, project_root, None)
}

fn build_turn_request_with_runner_binding(
    pending: &PendingProjectionTurnExecution,
    project_root: Option<&str>,
    runner_binding: Option<&ProviderRunnerBinding>,
) -> Result<CodeEngineTurnRequestRecord, CodingSessionError> {
    let model_id = if pending.turn_model_id.is_empty() {
        pending.session.model_id.clone()
    } else {
        pending.turn_model_id.clone()
    };

    Ok(CodeEngineTurnRequestRecord {
        engine_id: pending.session.engine_id.clone(),
        model_id,
        native_session_id: pending
            .native_session_id
            .clone()
            .or_else(|| pending.session.native_session_id.clone()),
        request_kind: pending.turn.request_kind.clone(),
        input_summary: pending.turn.input_summary.clone(),
        ide_context: map_ide_context(pending.ide_context.as_ref(), &pending.session.id),
        working_directory: resolve_working_directory(
            pending.working_directory.as_deref(),
            project_root,
            runner_binding,
        )?,
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
    if error.is_invalid_input() {
        CodingSessionError::InvalidInput(error.to_string())
    } else {
        CodingSessionError::Repository(error.to_string())
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

fn resolve_working_directory(
    requested_directory: Option<&Path>,
    project_root: Option<&str>,
    runner_binding: Option<&ProviderRunnerBinding>,
) -> Result<Option<PathBuf>, CodingSessionError> {
    if let Some(runner_binding) = runner_binding {
        return runner_binding
            .resolve_working_directory(requested_directory)
            .map(Some)
            .map_err(map_runner_isolation_error);
    }
    let canonical_project_root = project_root
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .map(|path| canonicalize_project_root(&path))
        .transpose()?;

    let Some(requested_directory) = requested_directory else {
        return Ok(canonical_project_root);
    };
    let canonical_requested_directory =
        std::fs::canonicalize(requested_directory).map_err(|_| {
            CodingSessionError::InvalidInput("working directory does not exist.".into())
        })?;
    if !canonical_requested_directory.is_dir() {
        return Err(CodingSessionError::InvalidInput(
            "working directory must be a directory.".into(),
        ));
    }
    if let Some(canonical_project_root) = canonical_project_root {
        if !canonical_requested_directory.starts_with(&canonical_project_root) {
            return Err(CodingSessionError::InvalidInput(format!(
                "working directory must stay within the configured project root."
            )));
        }
    }

    Ok(Some(canonical_requested_directory))
}

fn canonicalize_project_root(project_root: &Path) -> Result<PathBuf, CodingSessionError> {
    let canonical_project_root = std::fs::canonicalize(project_root).map_err(|_| {
        CodingSessionError::Repository("configured project root does not exist.".into())
    })?;
    if !canonical_project_root.is_dir() {
        return Err(CodingSessionError::Repository(
            "configured project root must be a directory.".into(),
        ));
    }
    Ok(canonical_project_root)
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
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
    use sdkwork_birdcoder_coding_sessions_service::domain::models::CodingSessionTurnOptionsPayload;
    use sdkwork_birdcoder_coding_sessions_service::domain::results::{
        CodingSessionPayload, CodingSessionTurnPayload, OperationPayload,
        PendingProjectionTurnExecution,
    };
    use sdkwork_birdcoder_coding_sessions_service::ports::engine_validator::EngineValidator;
    use tokio::sync::Semaphore;

    use crate::bootstrap::config::{
        BirdDeploymentProfile, BirdEnvironment, BirdRuntimeTarget, BirdServerConfig,
        CodeExecutionCapability,
    };
    use crate::bootstrap::runner_isolation::ProviderRunnerBinding;

    use super::{
        build_turn_request, build_turn_request_with_runner_binding, code_engine_turn_admission,
        execute_admitted_blocking_turn, prepare_runner_binding, user_code_engine_turn_admission,
        wire_code_engine_provider_with_kernel_host, wire_engine_validator_with_kernel_host,
        CodeEngineProvider, CodingSessionError, KernelBridgeCodeEngineProvider,
        TurnAdmissionPermits, CODE_ENGINE_USER_TURN_ADMISSION_SATURATED,
        DEFAULT_CODE_ENGINE_TURN_MAX_OUTPUT_BYTES, DEFAULT_CODE_ENGINE_TURN_TIMEOUT_MS,
    };

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
            project_root: None,
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
            project_root: None,
            runner_root: None,
            turn_admission: turn_admission.clone(),
        };

        let result = provider
            .execute_turn(&coding_session_context(), &pending_turn_execution())
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
            project_root: None,
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

        let request = build_turn_request(&pending, root.root.to_str())
            .expect("build a project-scoped turn request");

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
    }

    #[test]
    fn build_turn_request_falls_back_to_the_canonical_project_root() {
        let root = TestDirectory::new();
        let pending = pending_turn_execution();

        let request = build_turn_request(&pending, root.root.to_str())
            .expect("build a project-root turn request");

        assert_eq!(
            request.working_directory,
            Some(std::fs::canonicalize(&root.root).expect("canonical project root"))
        );
    }

    #[test]
    fn build_turn_request_rejects_a_directory_outside_the_project_root() {
        let root = TestDirectory::new();
        let outside = TestDirectory::new();
        let mut pending = pending_turn_execution();
        pending.working_directory = Some(outside.root.clone());

        let result = build_turn_request(&pending, root.root.to_str());

        assert!(matches!(
            result,
            Err(CodingSessionError::InvalidInput(ref message))
                if message.contains("configured project root")
        ));
    }

    #[test]
    fn build_turn_request_accepts_an_authoritative_project_directory_without_global_fallback() {
        let project = TestDirectory::new();
        let mut pending = pending_turn_execution();
        pending.working_directory = Some(project.root.clone());

        let request =
            build_turn_request(&pending, None).expect("accept a server-resolved project directory");

        assert_eq!(
            request.working_directory,
            Some(std::fs::canonicalize(&project.root).expect("canonical project directory"))
        );
    }

    #[test]
    fn build_turn_request_uses_the_runner_bound_workspace_root() {
        let runner_root = TestDirectory::new();
        let unrelated_local_project = TestDirectory::new();
        let pending = pending_turn_execution();
        let runner_binding = ProviderRunnerBinding::prepare(
            &runner_root.root,
            "100000000000000001",
            "100000000000000002",
            &pending.session.workspace_id,
        )
        .expect("prepare cloud runner binding");

        let request = build_turn_request_with_runner_binding(
            &pending,
            unrelated_local_project.root.to_str(),
            Some(&runner_binding),
        )
        .expect("build isolated cloud turn request");

        assert_eq!(
            request.working_directory,
            Some(runner_binding.workspace_root)
        );
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

        let result = build_turn_request_with_runner_binding(&pending, None, Some(&runner_binding));

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
            turn_model_id: "gpt-5".to_string(),
            ide_context: None,
            options: None,
            working_directory: None,
        }
    }
}
