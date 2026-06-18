use std::path::PathBuf;
use std::sync::Arc;

use sdkwork_birdcoder_codeengine::{
    find_codeengine_descriptor, standard_codeengine_provider_registry, CodeEngineTurnConfigRecord,
    CodeEngineTurnIdeContextRecord, CodeEngineTurnRequestRecord, CodeEngineUserQuestionAnswerRecord,
};
use sdkwork_birdcoder_coding_sessions_service::context::CodingSessionContext;
use sdkwork_birdcoder_coding_sessions_service::domain::commands::{
    SubmitApprovalDecisionInput, SubmitUserQuestionAnswerInput,
};
use sdkwork_birdcoder_coding_sessions_service::domain::models::{
    CodingSessionTurnCurrentFileContextPayload, CodingSessionTurnIdeContextPayload,
};
use sdkwork_birdcoder_coding_sessions_service::domain::results::{
    CodingSessionEventPayload, FinalizedProjectionTurnExecution, PendingProjectionTurnExecution,
};
use sdkwork_birdcoder_coding_sessions_service::error::CodingSessionError;
use sdkwork_birdcoder_coding_sessions_service::event_payload::build_succeeded_coding_session_turn_events;
use sdkwork_birdcoder_coding_sessions_service::ports::provider::CodeEngineProvider;
use sdkwork_birdcoder_coding_sessions_service::ports::engine_validator::EngineValidator;
use sdkwork_birdcoder_coding_sessions_service::domain::models::AuthoritativeEngineRuntimeProfile;

use crate::bootstrap::config::BirdServerConfig;

pub struct Adapters {
    pub project_root: Option<String>,
}

pub fn wire_adapters(config: &BirdServerConfig) -> Adapters {
    Adapters {
        project_root: config.project_root.clone(),
    }
}

pub fn wire_code_engine_provider(config: &BirdServerConfig) -> Arc<dyn CodeEngineProvider> {
    Arc::new(RegistryCodeEngineProvider {
        project_root: config.project_root.clone(),
    })
}

pub fn wire_engine_validator() -> Arc<dyn EngineValidator> {
    Arc::new(CatalogEngineValidator)
}

struct RegistryCodeEngineProvider {
    project_root: Option<String>,
}

#[async_trait::async_trait]
impl CodeEngineProvider for RegistryCodeEngineProvider {
    async fn execute_turn(
        &self,
        _ctx: &CodingSessionContext,
        pending: &PendingProjectionTurnExecution,
    ) -> Result<FinalizedProjectionTurnExecution, CodingSessionError> {
        let engine_id = pending.session.engine_id.clone();
        let registry = standard_codeengine_provider_registry();
        let providers = registry
            .resolve_provider(Some(engine_id.as_str()))
            .map_err(|error| CodingSessionError::Repository(error))?;
        let plugin = providers
            .first()
            .copied()
            .ok_or_else(|| CodingSessionError::Repository("code engine provider not found".into()))?;

        let request = build_turn_request(pending, self.project_root.as_deref());
        let turn_id = pending.turn.id.clone();
        let session_id = pending.session.id.clone();
        let runtime_id = pending
            .turn
            .runtime_id
            .clone()
            .unwrap_or_else(|| pending.operation.operation_id.clone());
        let operation_id = pending.operation.operation_id.clone();

        let result = tokio::task::spawn_blocking(move || plugin.execute_turn(&request))
            .await
            .map_err(|error| CodingSessionError::Repository(error.to_string()))?
            .map_err(|error| CodingSessionError::Repository(error))?;

        let completed_at = time::OffsetDateTime::now_utc()
            .format(&time::format_description::well_known::Iso8601::DEFAULT)
            .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_string());

        let commands = result.commands.as_ref().map(|items| {
            items
                .iter()
                .map(|command| sdkwork_birdcoder_coding_sessions_service::native_session_types::NativeSessionCommandPayload {
                    command: command.command.clone(),
                    status: command.status.clone(),
                    output: command.output.clone(),
                    ..Default::default()
                })
                .collect::<Vec<_>>()
        });

        let events = build_succeeded_coding_session_turn_events(
            &session_id,
            &runtime_id,
            &turn_id,
            &operation_id,
            &result.assistant_content,
            commands.as_deref(),
            0,
            &completed_at,
            result.native_session_id.as_deref(),
        )
        .into_iter()
        .map(map_projection_event)
        .collect();

        let mut turn = pending.turn.clone();
        turn.status = "completed".to_string();
        turn.started_at = turn.started_at.or_else(|| Some(completed_at.clone()));
        turn.completed_at = Some(completed_at);

        Ok(FinalizedProjectionTurnExecution { turn, events })
    }

    async fn submit_approval(
        &self,
        _ctx: &CodingSessionContext,
        _session_id: &str,
        _checkpoint_id: &str,
        input: &SubmitApprovalDecisionInput,
    ) -> Result<(), CodingSessionError> {
        if input.decision.is_empty() {
            return Err(CodingSessionError::InvalidInput("decision is required.".into()));
        }
        Ok(())
    }

    async fn submit_question_answer(
        &self,
        _ctx: &CodingSessionContext,
        _session_id: &str,
        question_id: &str,
        input: &SubmitUserQuestionAnswerInput,
    ) -> Result<(), CodingSessionError> {
        let registry = standard_codeengine_provider_registry();
        let providers = registry
            .resolve_provider(None)
            .map_err(|error| CodingSessionError::Repository(error))?;
        for plugin in providers {
            if !plugin.supports_live_user_question_replies() {
                continue;
            }
            let answer = CodeEngineUserQuestionAnswerRecord {
                question_id: question_id.to_string(),
                answer: input.answer.clone().unwrap_or_default(),
                option_id: input.option_id.clone(),
                option_label: input.option_label.clone(),
                rejected: input.rejected,
                native_session_id: None,
            };
            return plugin
                .submit_user_question_answer(&answer)
                .map_err(|error| CodingSessionError::Repository(error));
        }
        Ok(())
    }
}

struct CatalogEngineValidator;

#[async_trait::async_trait]
impl EngineValidator for CatalogEngineValidator {
    fn validate_engine_runtime_profile(
        &self,
        engine_id: &str,
        _host_mode: &str,
    ) -> Result<AuthoritativeEngineRuntimeProfile, CodingSessionError> {
        let descriptor = find_codeengine_descriptor(engine_id).ok_or_else(|| {
            CodingSessionError::InvalidInput(format!("unknown engineId \"{engine_id}\"."))
        })?;
        let transport_kind = descriptor
            .transport_kinds
            .first()
            .cloned()
            .unwrap_or_else(|| "stdio".to_string());
        Ok(AuthoritativeEngineRuntimeProfile {
            transport_kind,
            capability_snapshot_json: "{}".to_string(),
        })
    }
}

fn build_turn_request(
    pending: &PendingProjectionTurnExecution,
    project_root: Option<&str>,
) -> CodeEngineTurnRequestRecord {
    let model_id = if pending.turn_model_id.is_empty() {
        pending.session.model_id.clone()
    } else {
        pending.turn_model_id.clone()
    };

    CodeEngineTurnRequestRecord {
        engine_id: pending.session.engine_id.clone(),
        model_id,
        native_session_id: pending
            .native_session_id
            .clone()
            .or_else(|| pending.session.native_session_id.clone()),
        request_kind: pending.turn.request_kind.clone(),
        input_summary: pending.turn.input_summary.clone(),
        ide_context: map_ide_context(pending.ide_context.as_ref(), &pending.session.id),
        working_directory: resolve_working_directory(project_root),
        config: CodeEngineTurnConfigRecord::default(),
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
        current_file: ide_context.current_file.as_ref().map(map_current_file),
    })
}

fn map_current_file(
    current_file: &CodingSessionTurnCurrentFileContextPayload,
) -> sdkwork_birdcoder_codeengine::CodeEngineTurnCurrentFileContextRecord {
    sdkwork_birdcoder_codeengine::CodeEngineTurnCurrentFileContextRecord {
        path: current_file.path.clone(),
        content: current_file.content.clone(),
        language: current_file.language.clone(),
    }
}

fn resolve_working_directory(project_root: Option<&str>) -> Option<PathBuf> {
    project_root
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
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
