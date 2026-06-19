use std::{
    collections::BTreeMap,
    path::{Path as FsPath, PathBuf},
};

use sdkwork_birdcoder_codeengine::{
    build_native_session_id as build_standard_native_session_id,
    is_authority_backed_native_session_id as is_standard_authority_backed_native_session_id,
    map_codeengine_session_runtime_status, map_codeengine_session_status_from_runtime,
    resolve_native_session_engine_id as resolve_standard_native_session_engine_id,
    standard_codeengine_provider_registry, CodeEngineApprovalDecisionRecord,
    CodeEngineSessionCommandRecord, CodeEngineSessionDetailRecord, CodeEngineSessionMessageRecord,
    CodeEngineSessionSummaryRecord, CodeEngineTurnConfigRecord,
    CodeEngineTurnCurrentFileContextRecord, CodeEngineTurnIdeContextRecord,
    CodeEngineTurnRequestRecord, CodeEngineTurnResultRecord, CodeEngineTurnStreamEventRecord,
    CodeEngineUserQuestionAnswerRecord,
};
use serde::{Deserialize, Deserializer, Serialize, Serializer};

use super::ProjectPayload;

#[derive(Clone, Default)]
pub(crate) struct NativeSessionQuery {
    pub(crate) workspace_id: Option<String>,
    pub(crate) project_id: Option<String>,
    pub(crate) engine_id: Option<String>,
    pub(crate) limit: Option<usize>,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionLookup {
    pub(crate) session_id: String,
    pub(crate) engine_id: Option<String>,
    pub(crate) workspace_id: Option<String>,
    pub(crate) project_id: Option<String>,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionTurnConfig {
    pub(crate) approval_policy: Option<String>,
    pub(crate) ephemeral: bool,
    pub(crate) full_auto: bool,
    pub(crate) sandbox_mode: Option<String>,
    pub(crate) skip_git_repo_check: bool,
    pub(crate) temperature: Option<f64>,
    pub(crate) top_p: Option<f64>,
    pub(crate) max_tokens: Option<i64>,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionTurnRequest {
    pub(crate) engine_id: String,
    pub(crate) model_id: String,
    pub(crate) native_session_id: Option<String>,
    pub(crate) request_kind: String,
    pub(crate) input_summary: String,
    pub(crate) ide_context: Option<NativeSessionTurnIdeContext>,
    pub(crate) working_directory: Option<PathBuf>,
    pub(crate) config: NativeSessionTurnConfig,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionTurnCurrentFileContext {
    pub(crate) path: String,
    pub(crate) content: Option<String>,
    pub(crate) language: Option<String>,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionTurnIdeContext {
    pub(crate) workspace_id: Option<String>,
    pub(crate) project_id: Option<String>,
    pub(crate) session_id: Option<String>,
    pub(crate) current_file: Option<NativeSessionTurnCurrentFileContext>,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionTurnResult {
    pub(crate) assistant_content: String,
    pub(crate) native_session_id: Option<String>,
    pub(crate) commands: Option<Vec<NativeSessionCommandPayload>>,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionTurnStreamEvent {
    pub(crate) kind: String,
    pub(crate) role: String,
    pub(crate) content_delta: String,
    pub(crate) payload: Option<serde_json::Value>,
    pub(crate) native_session_id: Option<String>,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionApprovalDecision {
    pub(crate) native_session_id: Option<String>,
    pub(crate) approval_id: String,
    pub(crate) decision: String,
    pub(crate) reason: Option<String>,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionUserQuestionAnswer {
    pub(crate) native_session_id: Option<String>,
    pub(crate) question_id: String,
    pub(crate) answer: String,
    pub(crate) option_id: Option<String>,
    pub(crate) option_label: Option<String>,
    pub(crate) rejected: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeSessionCommandPayload {
    pub(crate) command: String,
    pub(crate) status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) runtime_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) requires_approval: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) requires_reply: Option<bool>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeSessionMessagePayload {
    pub(crate) id: String,
    pub(crate) coding_session_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) turn_id: Option<String>,
    pub(crate) role: String,
    pub(crate) content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) commands: Option<Vec<NativeSessionCommandPayload>>,
    #[serde(
        default,
        rename = "tool_calls",
        skip_serializing_if = "Option::is_none"
    )]
    pub(crate) tool_calls: Option<Vec<serde_json::Value>>,
    #[serde(
        default,
        rename = "tool_call_id",
        skip_serializing_if = "Option::is_none"
    )]
    pub(crate) tool_call_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) file_changes: Option<Vec<serde_json::Value>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub(crate) task_progress: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) metadata: Option<BTreeMap<String, String>>,
    pub(crate) created_at: String,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeSessionSummaryPayload {
    pub(crate) created_at: String,
    pub(crate) id: String,
    pub(crate) workspace_id: String,
    pub(crate) project_id: String,
    pub(crate) title: String,
    pub(crate) status: String,
    pub(crate) host_mode: String,
    pub(crate) engine_id: String,
    pub(crate) model_id: String,
    pub(crate) updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) last_turn_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) runtime_status: Option<String>,
    pub(crate) kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) native_cwd: Option<String>,
    #[serde(
        deserialize_with = "deserialize_i64_from_decimal_string_or_number",
        serialize_with = "serialize_i64_as_decimal_string"
    )]
    pub(crate) sort_timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) transcript_updated_at: Option<String>,
}

fn serialize_i64_as_decimal_string<S>(value: &i64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

fn parse_i64_decimal_string<E>(value: &str) -> Result<i64, E>
where
    E: serde::de::Error,
{
    value
        .trim()
        .parse::<i64>()
        .map_err(|_| E::custom("expected an i64 decimal string"))
}

fn deserialize_i64_from_decimal_string_or_number<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    match value {
        serde_json::Value::String(value) => parse_i64_decimal_string::<D::Error>(&value),
        serde_json::Value::Number(value) => value
            .as_i64()
            .ok_or_else(|| serde::de::Error::custom("expected an i64 JSON number")),
        _ => Err(serde::de::Error::custom("expected an i64 decimal string")),
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeSessionDetailPayload {
    pub(crate) summary: NativeSessionSummaryPayload,
    pub(crate) messages: Vec<NativeSessionMessagePayload>,
}

fn map_codeengine_command_record(
    command: CodeEngineSessionCommandRecord,
) -> NativeSessionCommandPayload {
    NativeSessionCommandPayload {
        command: command.command,
        status: command.status,
        output: command.output,
        kind: command.kind,
        tool_name: command.tool_name,
        tool_call_id: command.tool_call_id,
        runtime_status: command.runtime_status,
        requires_approval: command.requires_approval,
        requires_reply: command.requires_reply,
    }
}

fn map_codeengine_message_record(
    coding_session_id: &str,
    message: CodeEngineSessionMessageRecord,
) -> NativeSessionMessagePayload {
    NativeSessionMessagePayload {
        id: message.id,
        coding_session_id: coding_session_id.to_owned(),
        turn_id: message.turn_id,
        role: message.role,
        content: message.content,
        commands: message.commands.map(|commands| {
            commands
                .into_iter()
                .map(map_codeengine_command_record)
                .collect()
        }),
        tool_calls: message.tool_calls,
        tool_call_id: message.tool_call_id,
        file_changes: message.file_changes,
        task_progress: message.task_progress,
        metadata: message.metadata,
        created_at: message.created_at,
    }
}

fn map_codeengine_summary_record(
    summary: CodeEngineSessionSummaryRecord,
) -> NativeSessionSummaryPayload {
    let runtime_status = map_codeengine_session_runtime_status(
        summary
            .runtime_status
            .as_deref()
            .or(Some(summary.status.as_str())),
    )
    .to_owned();
    let status = map_codeengine_session_status_from_runtime(runtime_status.as_str()).to_owned();
    NativeSessionSummaryPayload {
        created_at: summary.created_at,
        id: summary.id,
        workspace_id: String::new(),
        project_id: String::new(),
        title: summary.title,
        status,
        host_mode: summary.host_mode,
        engine_id: summary.engine_id,
        model_id: summary.model_id,
        updated_at: summary.updated_at,
        last_turn_at: summary.last_turn_at,
        runtime_status: Some(runtime_status),
        kind: summary.kind,
        native_cwd: summary.native_cwd,
        sort_timestamp: summary.sort_timestamp,
        transcript_updated_at: summary.transcript_updated_at,
    }
}

fn map_codeengine_detail_record(
    detail: CodeEngineSessionDetailRecord,
) -> NativeSessionDetailPayload {
    let summary = map_codeengine_summary_record(detail.summary);
    let coding_session_id = summary.id.clone();
    NativeSessionDetailPayload {
        messages: detail
            .messages
            .into_iter()
            .map(|message| map_codeengine_message_record(coding_session_id.as_str(), message))
            .collect(),
        summary,
    }
}

pub(crate) fn is_authority_backed_native_session_id(session_id: &str) -> bool {
    is_standard_authority_backed_native_session_id(session_id)
}

pub(crate) fn resolve_native_session_engine_id(session_id: &str) -> Option<String> {
    resolve_standard_native_session_engine_id(session_id).map(str::to_owned)
}

pub(crate) fn list_native_sessions(
    projects: &[ProjectPayload],
    query: &NativeSessionQuery,
) -> Result<Vec<NativeSessionSummaryPayload>, String> {
    let providers =
        standard_codeengine_provider_registry().resolve_provider(query.engine_id.as_deref())?;
    let mut sessions = Vec::new();

    for provider in providers {
        for record in provider.list_sessions()? {
            let mut summary = map_codeengine_summary_record(record);
            let native_cwd = summary.native_cwd.clone();
            attach_project_scope(&mut summary, &native_cwd, FsPath::new(""), projects);
            if is_project_scoped_native_session_summary(&summary)
                && matches_native_session_filters(projects, &summary, query)
            {
                sessions.push(summary);
            }
        }
    }

    sessions.sort_by(|left, right| {
        right
            .sort_timestamp
            .cmp(&left.sort_timestamp)
            .then_with(|| left.id.cmp(&right.id))
    });

    if let Some(limit) = query.limit {
        sessions.truncate(limit);
    }

    Ok(sessions)
}

pub(crate) fn get_native_session(
    projects: &[ProjectPayload],
    lookup: &NativeSessionLookup,
) -> Result<Option<NativeSessionDetailPayload>, String> {
    let resolved_engine_id =
        normalize_non_empty_string(lookup.engine_id.as_deref()).or_else(|| {
            resolve_standard_native_session_engine_id(lookup.session_id.as_str()).map(str::to_owned)
        });
    let providers =
        standard_codeengine_provider_registry().resolve_provider(resolved_engine_id.as_deref())?;

    for provider in providers {
        if let Some(detail_record) = provider.get_session(lookup.session_id.as_str())? {
            let mut detail = map_codeengine_detail_record(detail_record);
            let native_cwd = detail.summary.native_cwd.clone();
            attach_project_scope(&mut detail.summary, &native_cwd, FsPath::new(""), projects);
            if !is_project_scoped_native_session_summary(&detail.summary) {
                return Ok(None);
            }
            if !matches_native_session_lookup_scope(&detail.summary, lookup) {
                return Ok(None);
            }
            return Ok(Some(detail));
        }
    }

    Ok(None)
}

pub(crate) fn get_native_session_summary(
    projects: &[ProjectPayload],
    lookup: &NativeSessionLookup,
) -> Result<Option<NativeSessionSummaryPayload>, String> {
    let resolved_engine_id =
        normalize_non_empty_string(lookup.engine_id.as_deref()).or_else(|| {
            resolve_standard_native_session_engine_id(lookup.session_id.as_str()).map(str::to_owned)
        });
    let providers =
        standard_codeengine_provider_registry().resolve_provider(resolved_engine_id.as_deref())?;

    for provider in providers {
        if let Some(summary_record) = provider.get_session_summary(lookup.session_id.as_str())? {
            let mut summary = map_codeengine_summary_record(summary_record);
            let native_cwd = summary.native_cwd.clone();
            attach_project_scope(&mut summary, &native_cwd, FsPath::new(""), projects);
            if !is_project_scoped_native_session_summary(&summary) {
                return Ok(None);
            }
            if !matches_native_session_lookup_scope(&summary, lookup) {
                return Ok(None);
            }
            return Ok(Some(summary));
        }
    }

    Ok(None)
}

pub(crate) fn is_project_scoped_native_session_summary(
    summary: &NativeSessionSummaryPayload,
) -> bool {
    !summary.workspace_id.trim().is_empty() && !summary.project_id.trim().is_empty()
}

fn matches_native_session_lookup_scope(
    summary: &NativeSessionSummaryPayload,
    lookup: &NativeSessionLookup,
) -> bool {
    if let Some(project_id) = normalize_non_empty_string(lookup.project_id.as_deref()) {
        if summary.project_id != project_id {
            return false;
        }
    }

    if let Some(workspace_id) = normalize_non_empty_string(lookup.workspace_id.as_deref()) {
        if summary.workspace_id != workspace_id {
            return false;
        }
    }

    true
}

pub(crate) fn execute_native_session_turn(
    request: &NativeSessionTurnRequest,
) -> Result<NativeSessionTurnResult, String> {
    execute_native_session_turn_with_events(request, |_| Ok(()))
}

pub(crate) fn execute_native_session_turn_with_events(
    request: &NativeSessionTurnRequest,
    mut on_event: impl FnMut(NativeSessionTurnStreamEvent) -> Result<(), String>,
) -> Result<NativeSessionTurnResult, String> {
    let providers = standard_codeengine_provider_registry()
        .resolve_provider(Some(request.engine_id.as_str()))?;
    let provider = providers.into_iter().next().ok_or_else(|| {
        "Native session provider registry did not resolve an engine provider.".to_owned()
    })?;
    let result = provider
        .execute_turn_with_events(&map_codeengine_turn_request_record(request), &mut |event| {
            on_event(map_codeengine_turn_stream_event_record(event))
        })?;
    Ok(map_codeengine_turn_result_record(result))
}

pub(crate) fn submit_native_session_approval_decision(
    engine_id: &str,
    decision: &NativeSessionApprovalDecision,
) -> Result<bool, String> {
    let providers = standard_codeengine_provider_registry().resolve_provider(Some(engine_id))?;
    let provider = providers.into_iter().next().ok_or_else(|| {
        "Native session provider registry did not resolve an engine provider.".to_owned()
    })?;
    if !provider.supports_live_approval_decision_replies() {
        return Ok(false);
    }

    provider.submit_approval_decision(&CodeEngineApprovalDecisionRecord {
        native_session_id: decision.native_session_id.clone(),
        approval_id: decision.approval_id.clone(),
        decision: decision.decision.clone(),
        reason: decision.reason.clone(),
    })?;
    Ok(true)
}

pub(crate) fn submit_native_session_user_question_answer(
    engine_id: &str,
    answer: &NativeSessionUserQuestionAnswer,
) -> Result<bool, String> {
    let providers = standard_codeengine_provider_registry().resolve_provider(Some(engine_id))?;
    let provider = providers.into_iter().next().ok_or_else(|| {
        "Native session provider registry did not resolve an engine provider.".to_owned()
    })?;
    if !provider.supports_live_user_question_replies() {
        return Ok(false);
    }

    provider.submit_user_question_answer(&CodeEngineUserQuestionAnswerRecord {
        native_session_id: answer.native_session_id.clone(),
        question_id: answer.question_id.clone(),
        answer: answer.answer.clone(),
        option_id: answer.option_id.clone(),
        option_label: answer.option_label.clone(),
        rejected: answer.rejected,
    })?;
    Ok(true)
}

pub(crate) fn build_native_session_id(engine_id: &str, native_session_id: &str) -> String {
    build_standard_native_session_id(engine_id, native_session_id)
}

fn map_codeengine_turn_request_record(
    request: &NativeSessionTurnRequest,
) -> CodeEngineTurnRequestRecord {
    CodeEngineTurnRequestRecord {
        engine_id: request.engine_id.clone(),
        model_id: request.model_id.clone(),
        native_session_id: request.native_session_id.clone(),
        request_kind: request.request_kind.clone(),
        input_summary: request.input_summary.clone(),
        ide_context: request
            .ide_context
            .as_ref()
            .map(map_codeengine_turn_ide_context_record),
        working_directory: request.working_directory.clone(),
        config: map_codeengine_turn_config_record(&request.config),
    }
}

fn map_codeengine_turn_config_record(
    config: &NativeSessionTurnConfig,
) -> CodeEngineTurnConfigRecord {
    CodeEngineTurnConfigRecord {
        approval_policy: config.approval_policy.clone(),
        ephemeral: config.ephemeral,
        full_auto: config.full_auto,
        sandbox_mode: config.sandbox_mode.clone(),
        skip_git_repo_check: config.skip_git_repo_check,
        temperature: config.temperature,
        top_p: config.top_p,
        max_tokens: config.max_tokens,
    }
}

fn map_codeengine_turn_ide_context_record(
    ide_context: &NativeSessionTurnIdeContext,
) -> CodeEngineTurnIdeContextRecord {
    CodeEngineTurnIdeContextRecord {
        workspace_id: ide_context.workspace_id.clone(),
        project_id: ide_context.project_id.clone(),
        session_id: ide_context.session_id.clone(),
        current_file: ide_context
            .current_file
            .as_ref()
            .map(map_codeengine_turn_current_file_context_record),
    }
}

fn map_codeengine_turn_current_file_context_record(
    current_file: &NativeSessionTurnCurrentFileContext,
) -> CodeEngineTurnCurrentFileContextRecord {
    CodeEngineTurnCurrentFileContextRecord {
        path: current_file.path.clone(),
        content: current_file.content.clone(),
        language: current_file.language.clone(),
    }
}

fn map_codeengine_turn_result_record(
    result: CodeEngineTurnResultRecord,
) -> NativeSessionTurnResult {
    NativeSessionTurnResult {
        assistant_content: result.assistant_content,
        native_session_id: result.native_session_id,
        commands: result.commands.map(|commands| {
            commands
                .into_iter()
                .map(map_codeengine_command_record)
                .collect()
        }),
    }
}

fn map_codeengine_turn_stream_event_record(
    event: CodeEngineTurnStreamEventRecord,
) -> NativeSessionTurnStreamEvent {
    NativeSessionTurnStreamEvent {
        kind: event.kind,
        role: event.role,
        content_delta: event.content_delta,
        payload: event.payload,
        native_session_id: event.native_session_id,
    }
}

fn matches_native_session_filters(
    projects: &[ProjectPayload],
    summary: &NativeSessionSummaryPayload,
    query: &NativeSessionQuery,
) -> bool {
    if let Some(engine_id) = normalize_non_empty_string(query.engine_id.as_deref()) {
        if summary.engine_id != engine_id {
            return false;
        }
    }

    let mut scoped_summary = summary.clone();
    attach_project_scope(
        &mut scoped_summary,
        &summary.native_cwd,
        FsPath::new(""),
        projects,
    );

    if let Some(project_id) = normalize_non_empty_string(query.project_id.as_deref()) {
        return scoped_summary.project_id == project_id;
    }

    if let Some(workspace_id) = normalize_non_empty_string(query.workspace_id.as_deref()) {
        return scoped_summary.workspace_id == workspace_id;
    }

    true
}

fn attach_project_scope(
    summary: &mut NativeSessionSummaryPayload,
    native_cwd: &Option<String>,
    _file_path: &FsPath,
    projects: &[ProjectPayload],
) {
    let Some(native_cwd) = native_cwd.as_deref() else {
        return;
    };
    let Some(project) = match_project_by_cwd(projects, native_cwd) else {
        return;
    };

    summary.project_id = project.id.clone();
    summary.workspace_id = project.workspace_id.clone();
}

fn match_project_by_cwd<'a>(
    projects: &'a [ProjectPayload],
    native_cwd: &str,
) -> Option<&'a ProjectPayload> {
    let normalized_cwd = super::normalize_project_root_path_for_lookup(native_cwd);
    projects
        .iter()
        .filter_map(|project| {
            let root_path = project.root_path.as_deref()?;
            let normalized_root = super::normalize_project_root_path_for_lookup(root_path);
            if normalized_root.is_empty() {
                return None;
            }
            let is_match = normalized_cwd == normalized_root
                || matches!(
                    normalized_cwd.strip_prefix(normalized_root.as_str()),
                    Some(suffix) if suffix.starts_with('/')
                );
            if !is_match {
                return None;
            }
            Some((normalized_root.len(), project))
        })
        .max_by(|left, right| left.0.cmp(&right.0))
        .map(|(_, project)| project)
}

fn normalize_non_empty_string(value: Option<&str>) -> Option<String> {
    value.and_then(|value| {
        let normalized = value.trim();
        if normalized.is_empty() {
            None
        } else {
            Some(normalized.to_owned())
        }
    })
}

#[cfg(test)]
mod tests {
    use sdkwork_birdcoder_codeengine::{
        normalize_codex_prompt_title, parse_codex_session_detail, parse_codex_session_summary,
        CodeEngineSessionSummaryRecord, CodexSessionIndexEntry as SessionIndexEntry,
    };
    use std::{
        collections::BTreeMap,
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn write_temp_jsonl(name: &str, contents: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("unix epoch")
            .as_nanos();
        path.push(format!("sdkwork-birdcoder-{name}-{unique}.jsonl"));
        fs::write(&path, contents).expect("write codex jsonl fixture");
        path
    }

    #[test]
    fn codeengine_summary_runtime_status_precedes_generic_session_status() {
        let summary = CodeEngineSessionSummaryRecord {
            created_at: "2026-04-26T00:00:00.000Z".to_owned(),
            id: "busy-session".to_owned(),
            title: "Busy session".to_owned(),
            status: "completed".to_owned(),
            runtime_status: Some("busy".to_owned()),
            host_mode: "server".to_owned(),
            engine_id: "opencode".to_owned(),
            model_id: "opencode/test".to_owned(),
            updated_at: "2026-04-26T00:00:01.000Z".to_owned(),
            last_turn_at: Some("2026-04-26T00:00:01.000Z".to_owned()),
            kind: "coding".to_owned(),
            native_cwd: Some("D:/workspace".to_owned()),
            sort_timestamp: 1,
            transcript_updated_at: Some("2026-04-26T00:00:01.000Z".to_owned()),
        };

        let mapped_summary = super::map_codeengine_summary_record(summary);

        assert_eq!(mapped_summary.runtime_status.as_deref(), Some("streaming"));
        assert_eq!(mapped_summary.status.as_str(), "active");
    }

    #[test]
    fn codeengine_summary_retry_alias_maps_to_paused_session_status() {
        let summary = CodeEngineSessionSummaryRecord {
            created_at: "2026-04-26T00:00:00.000Z".to_owned(),
            id: "retry-session".to_owned(),
            title: "Retry session".to_owned(),
            status: "active".to_owned(),
            runtime_status: Some("retry".to_owned()),
            host_mode: "server".to_owned(),
            engine_id: "opencode".to_owned(),
            model_id: "opencode/test".to_owned(),
            updated_at: "2026-04-26T00:00:01.000Z".to_owned(),
            last_turn_at: Some("2026-04-26T00:00:01.000Z".to_owned()),
            kind: "coding".to_owned(),
            native_cwd: Some("D:/workspace".to_owned()),
            sort_timestamp: 1,
            transcript_updated_at: Some("2026-04-26T00:00:01.000Z".to_owned()),
        };

        let mapped_summary = super::map_codeengine_summary_record(summary);

        assert_eq!(mapped_summary.runtime_status.as_deref(), Some("failed"));
        assert_eq!(mapped_summary.status.as_str(), "paused");
    }

    #[test]
    fn normalize_codex_prompt_title_extracts_actual_request_suffix() {
        let prompt = "# IDE context\n- editor: vscode\n## My request for Codex:\nFix workspace import dedupe and persist absolute path";
        assert_eq!(
            normalize_codex_prompt_title(prompt).as_deref(),
            Some("Fix workspace import dedupe and persist absolute path")
        );
    }

    #[test]
    fn codex_summary_prefers_real_user_prompt_over_session_index_thread_name() {
        let fixture_path = write_temp_jsonl(
            "codex-summary-title",
            concat!(
                "{\"timestamp\":\"2026-04-17T05:00:00Z\",\"type\":\"session_meta\",\"payload\":{\"id\":\"019d-session-a\",\"timestamp\":\"2026-04-17T05:00:00Z\",\"cwd\":\"D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/sdkwork-birdcoder\",\"model\":\"gpt-5.4\"}}\n",
                "{\"timestamp\":\"2026-04-17T05:00:01Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"developer\",\"content\":[{\"type\":\"input_text\",\"text\":\"developer instructions\"}]}}\n",
                "{\"timestamp\":\"2026-04-17T05:00:02Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"# AGENTS.md instructions for D:/repo\\n<environment_context>cwd</environment_context>\"}]}}\n",
                "{\"timestamp\":\"2026-04-17T05:00:03Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"user_message\",\"message\":\"修复 open folder 重复导入，并正确显示 session 标题\"}}\n"
            ),
        );
        let mut session_index = BTreeMap::new();
        session_index.insert(
            "019d-session-a".to_owned(),
            SessionIndexEntry {
                thread_name: Some("Wrong Session Index Title".to_owned()),
                updated_at: Some("2026-04-17T05:00:04Z".to_owned()),
            },
        );

        let summary = parse_codex_session_summary(&fixture_path, &session_index)
            .expect("parse summary")
            .expect("summary");

        assert_eq!(
            summary.title,
            "修复 open folder 重复导入，并正确显示 session 标题"
        );
        assert_eq!(
            summary.native_cwd.as_deref(),
            Some("D:/javasource/spring-ai-plus/spring-ai-plus-business/apps/sdkwork-birdcoder")
        );

        fs::remove_file(&fixture_path).expect("remove codex summary fixture");
    }

    #[test]
    fn codex_detail_ignores_developer_response_items_in_transcript() {
        let fixture_path = write_temp_jsonl(
            "codex-detail-transcript",
            concat!(
                "{\"timestamp\":\"2026-04-17T06:00:00Z\",\"type\":\"session_meta\",\"payload\":{\"id\":\"019d-session-b\",\"timestamp\":\"2026-04-17T06:00:00Z\",\"cwd\":\"D:/repo/demo\",\"model\":\"gpt-5.4\"}}\n",
                "{\"timestamp\":\"2026-04-17T06:00:01Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"developer\",\"content\":[{\"type\":\"input_text\",\"text\":\"developer instructions should not appear\"}]}}\n",
                "{\"timestamp\":\"2026-04-17T06:00:02Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"user\",\"content\":[{\"type\":\"input_text\",\"text\":\"## My request for Codex:\\nBuild the server-backed session reader\"}]}}\n",
                "{\"timestamp\":\"2026-04-17T06:00:03Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"message\",\"role\":\"assistant\",\"content\":[{\"type\":\"output_text\",\"text\":\"I will inspect the server provider first.\"}]}}\n",
                "{\"timestamp\":\"2026-04-17T06:00:04Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"user_message\",\"message\":\"Build the server-backed session reader\"}}\n"
            ),
        );

        let detail = parse_codex_session_detail(&fixture_path, &BTreeMap::new())
            .expect("parse detail")
            .expect("detail");

        assert_eq!(
            detail.summary.title,
            "Build the server-backed session reader"
        );
        assert_eq!(detail.messages.len(), 2);
        assert_eq!(detail.messages[0].role, "user");
        assert_eq!(
            detail.messages[0].content,
            "Build the server-backed session reader"
        );
        assert_eq!(detail.messages[1].role, "assistant");
        assert_eq!(
            detail.messages[1].content,
            "I will inspect the server provider first."
        );

        fs::remove_file(&fixture_path).expect("remove codex detail fixture");
    }

    #[test]
    fn codex_summary_extracts_turn_context_metadata_without_session_meta() {
        let fixture_path = write_temp_jsonl(
            "codex-turn-context-summary",
            concat!(
                "{\"timestamp\":\"2026-04-18T09:00:00Z\",\"type\":\"turn_context\",\"payload\":{\"turn_id\":\"turn-context-1\",\"cwd\":\"D:/repo/demo/subdir\",\"model\":\"gpt-5.4\",\"approval_policy\":\"never\"}}\n",
                "{\"timestamp\":\"2026-04-18T09:00:01Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"user_message\",\"message\":\"Fix the missing project attribution for Codex sessions\"}}\n",
                "{\"timestamp\":\"2026-04-18T09:00:02Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"agent_message\",\"message\":\"I will inspect the authority parser first.\"}}\n"
            ),
        );

        let summary = parse_codex_session_summary(&fixture_path, &BTreeMap::new())
            .expect("parse summary")
            .expect("summary");

        assert_eq!(summary.native_cwd.as_deref(), Some("D:/repo/demo/subdir"));
        assert_eq!(summary.model_id, "gpt-5.4");
        assert_eq!(
            summary.title,
            "Fix the missing project attribution for Codex sessions"
        );

        let detail = parse_codex_session_detail(&fixture_path, &BTreeMap::new())
            .expect("parse detail")
            .expect("detail");
        assert_eq!(detail.messages.len(), 2);
        assert_eq!(detail.messages[0].role, "user");
        assert_eq!(detail.messages[1].role, "assistant");

        fs::remove_file(&fixture_path).expect("remove codex turn context fixture");
    }

    #[test]
    fn codex_summary_requires_explicit_model_id() {
        let fixture_path = write_temp_jsonl(
            "codex-summary-missing-model",
            concat!(
                "{\"timestamp\":\"2026-04-18T09:20:00Z\",\"type\":\"session_meta\",\"payload\":{\"id\":\"019d-session-missing-model\",\"timestamp\":\"2026-04-18T09:20:00Z\",\"cwd\":\"D:/repo/demo\"}}\n",
                "{\"timestamp\":\"2026-04-18T09:20:01Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"user_message\",\"message\":\"Implement strict model contract\"}}\n"
            ),
        );

        let summary = parse_codex_session_summary(&fixture_path, &BTreeMap::new())
            .expect("parse summary with default model fallback")
            .expect("summary");
        let expected_default_model =
            sdkwork_birdcoder_codeengine::find_codeengine_descriptor("codex")
                .expect("codex descriptor")
                .default_model_id;

        assert_eq!(summary.model_id, expected_default_model);

        fs::remove_file(&fixture_path).expect("remove codex missing model fixture");
    }

    #[test]
    fn map_codeengine_turn_request_record_keeps_explicit_model_id() {
        let request = super::NativeSessionTurnRequest {
            engine_id: "codex".to_owned(),
            model_id: "gpt-5.4".to_owned(),
            native_session_id: Some("thread-1".to_owned()),
            request_kind: "chat".to_owned(),
            input_summary: "Implement strict turn contract".to_owned(),
            ide_context: None,
            working_directory: None,
            config: super::NativeSessionTurnConfig::default(),
        };

        let mapped = super::map_codeengine_turn_request_record(&request);

        assert_eq!(mapped.engine_id, "codex");
        assert_eq!(mapped.model_id, "gpt-5.4");
    }

    #[test]
    fn codex_detail_projects_response_item_web_search_call() {
        let fixture_path = write_temp_jsonl(
            "codex-web-search-call",
            concat!(
                "{\"timestamp\":\"2026-04-18T09:10:00Z\",\"type\":\"turn_context\",\"payload\":{\"turn_id\":\"turn-search-1\",\"cwd\":\"D:/repo/demo\",\"model\":\"gpt-5.4\"}}\n",
                "{\"timestamp\":\"2026-04-18T09:10:01Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"web_search_call\",\"call_id\":\"call-search-1\",\"query\":\"Rust axum websocket workspace realtime\"}}\n"
            ),
        );

        let detail = parse_codex_session_detail(&fixture_path, &BTreeMap::new())
            .expect("parse detail")
            .expect("detail");

        assert_eq!(detail.messages.len(), 1);
        assert_eq!(detail.messages[0].role, "tool");
        assert_eq!(
            detail.messages[0].content,
            "Web search started: Rust axum websocket workspace realtime"
        );
        assert_eq!(
            detail.messages[0]
                .commands
                .as_ref()
                .and_then(|commands| commands.first())
                .map(|command| command.command.as_str()),
            Some("web_search: Rust axum websocket workspace realtime")
        );
        assert_eq!(
            detail.messages[0]
                .commands
                .as_ref()
                .and_then(|commands| commands.first())
                .map(|command| command.status.as_str()),
            Some("running")
        );

        fs::remove_file(&fixture_path).expect("remove codex web search fixture");
    }

    #[test]
    fn codex_detail_projects_shell_command_output_without_runtime_event() {
        let fixture_path = write_temp_jsonl(
            "codex-shell-command-output",
            concat!(
                "{\"timestamp\":\"2026-04-18T08:00:00Z\",\"type\":\"session_meta\",\"payload\":{\"id\":\"019d-session-c\",\"timestamp\":\"2026-04-18T08:00:00Z\",\"cwd\":\"D:/repo/demo\",\"model\":\"gpt-5.4\"}}\n",
                "{\"timestamp\":\"2026-04-18T08:00:01Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"function_call\",\"name\":\"shell_command\",\"arguments\":\"{\\\"command\\\":\\\"Get-Content foo.txt\\\"}\",\"call_id\":\"call-shell-1\"}}\n",
                "{\"timestamp\":\"2026-04-18T08:00:02Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"function_call_output\",\"call_id\":\"call-shell-1\",\"output\":\". : C:\\\\Users\\\\admin\\\\Documents\\\\WindowsPowerShell\\\\profile.ps1\\nhttps:/go.microsoft.com/fwlink/?LinkID=135170\\nCategoryInfo\\nFullyQualifiedErrorId\\nActual output line\"}}\n"
            ),
        );

        let detail = parse_codex_session_detail(&fixture_path, &BTreeMap::new())
            .expect("parse detail")
            .expect("detail");

        assert_eq!(detail.messages.len(), 1);
        assert_eq!(detail.messages[0].role, "tool");
        assert_eq!(
            detail.messages[0]
                .commands
                .as_ref()
                .and_then(|commands| commands.first())
                .map(|command| command.command.as_str()),
            Some("Get-Content foo.txt")
        );
        assert_eq!(
            detail.messages[0]
                .commands
                .as_ref()
                .and_then(|commands| commands.first())
                .and_then(|command| command.output.as_deref()),
            Some("Actual output line")
        );

        fs::remove_file(&fixture_path).expect("remove codex shell command fixture");
    }

    #[test]
    fn codex_detail_projects_custom_tool_output_without_runtime_event() {
        let fixture_path = write_temp_jsonl(
            "codex-custom-tool-output",
            concat!(
                "{\"timestamp\":\"2026-04-18T08:10:00Z\",\"type\":\"session_meta\",\"payload\":{\"id\":\"019d-session-d\",\"timestamp\":\"2026-04-18T08:10:00Z\",\"cwd\":\"D:/repo/demo\",\"model\":\"gpt-5.4\"}}\n",
                "{\"timestamp\":\"2026-04-18T08:10:01Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"custom_tool_call\",\"status\":\"completed\",\"call_id\":\"call-patch-1\",\"name\":\"apply_patch\",\"input\":\"*** Begin Patch\"}}\n",
                "{\"timestamp\":\"2026-04-18T08:10:02Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"custom_tool_call_output\",\"call_id\":\"call-patch-1\",\"output\":\"{\\\"output\\\":\\\"Success. Updated the following files:\\nA src/example.ts\\n\\\",\\\"metadata\\\":{\\\"exit_code\\\":0}}\"}}\n"
            ),
        );

        let detail = parse_codex_session_detail(&fixture_path, &BTreeMap::new())
            .expect("parse detail")
            .expect("detail");

        assert_eq!(detail.messages.len(), 1);
        assert_eq!(detail.messages[0].role, "tool");
        assert_eq!(
            detail.messages[0]
                .commands
                .as_ref()
                .and_then(|commands| commands.first())
                .map(|command| command.command.as_str()),
            Some("apply_patch")
        );
        assert!(detail.messages[0]
            .content
            .contains("Success. Updated the following files:"));

        fs::remove_file(&fixture_path).expect("remove codex custom tool fixture");
    }

    #[test]
    fn codex_detail_ignores_duplicate_custom_tool_output_after_patch_apply_event() {
        let fixture_path = write_temp_jsonl(
            "codex-patch-apply-event",
            concat!(
                "{\"timestamp\":\"2026-04-18T08:20:00Z\",\"type\":\"session_meta\",\"payload\":{\"id\":\"019d-session-e\",\"timestamp\":\"2026-04-18T08:20:00Z\",\"cwd\":\"D:/repo/demo\",\"model\":\"gpt-5.4\"}}\n",
                "{\"timestamp\":\"2026-04-18T08:20:01Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"custom_tool_call\",\"status\":\"completed\",\"call_id\":\"call-patch-2\",\"name\":\"apply_patch\",\"input\":\"*** Begin Patch\"}}\n",
                "{\"timestamp\":\"2026-04-18T08:20:02Z\",\"type\":\"event_msg\",\"payload\":{\"type\":\"patch_apply_end\",\"call_id\":\"call-patch-2\",\"turn_id\":\"turn-patch-2\",\"stdout\":\"Success. Updated the following files:\\nM src/example.ts\\n\",\"stderr\":\"\",\"success\":true}}\n",
                "{\"timestamp\":\"2026-04-18T08:20:03Z\",\"type\":\"response_item\",\"payload\":{\"type\":\"custom_tool_call_output\",\"call_id\":\"call-patch-2\",\"output\":\"{\\\"output\\\":\\\"Success. Updated the following files:\\nM src/example.ts\\n\\\",\\\"metadata\\\":{\\\"exit_code\\\":0}}\"}}\n"
            ),
        );

        let detail = parse_codex_session_detail(&fixture_path, &BTreeMap::new())
            .expect("parse detail")
            .expect("detail");

        assert_eq!(detail.messages.len(), 1);
        assert_eq!(detail.messages[0].role, "tool");
        assert_eq!(
            detail.messages[0]
                .commands
                .as_ref()
                .and_then(|commands| commands.first())
                .map(|command| command.command.as_str()),
            Some("apply_patch")
        );

        fs::remove_file(&fixture_path).expect("remove codex patch apply fixture");
    }
}
