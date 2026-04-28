use std::collections::BTreeMap;

use serde_json::Value;

use crate::opencode::build_opencode_tool_command_arguments;

use crate::{
    build_codeengine_turn_prompt, build_native_session_id, canonicalize_codeengine_tool_name,
    create_opencode_session, extract_native_lookup_id_for_engine, get_opencode_session,
    get_opencode_session_messages, is_opencode_transport_available,
    list_opencode_session_status_map, list_opencode_sessions,
    lookup_standard_native_session_provider_registration, map_codeengine_session_runtime_status,
    map_codeengine_session_status_from_runtime, map_codeengine_tool_command_status,
    map_codeengine_tool_kind, map_codeengine_tool_runtime_status, prompt_opencode_session,
    prompt_opencode_session_async, reject_opencode_question_request,
    reply_opencode_permission_request, reply_opencode_question_request,
    resolve_codeengine_command_interaction_state, resolve_codeengine_command_text,
    session_id_targets_engine, stream_opencode_session_events, CodeEngineApprovalDecisionRecord,
    CodeEngineProviderPlugin, CodeEngineSessionCommandRecord, CodeEngineSessionDetailRecord,
    CodeEngineSessionMessageRecord, CodeEngineSessionSummaryRecord, CodeEngineTurnRequestRecord,
    CodeEngineTurnResultRecord, CodeEngineTurnStreamEventRecord,
    CodeEngineUserQuestionAnswerRecord, NativeSessionProviderRegistration,
};

pub struct OpencodeCodeEngineProvider;
const OPENCODE_ENGINE_ID: &str = "opencode";

impl CodeEngineProviderPlugin for OpencodeCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        lookup_standard_native_session_provider_registration(OPENCODE_ENGINE_ID).unwrap_or_else(
            || {
                panic!(
                    "standard native session provider registration missing for engine {}",
                    OPENCODE_ENGINE_ID
                )
            },
        )
    }

    fn list_sessions(&self) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
        if !is_opencode_transport_available() {
            return Ok(Vec::new());
        }

        let sessions = list_opencode_sessions()?;
        let session_status_map = list_opencode_session_status_map().unwrap_or_default();
        let mut summaries = sessions
            .iter()
            .filter_map(|session| {
                build_opencode_session_summary_record(
                    session,
                    &session_status_map,
                    load_opencode_session_model_id(session),
                )
            })
            .collect::<Vec<_>>();

        summaries.sort_by(|left, right| {
            right
                .sort_timestamp
                .cmp(&left.sort_timestamp)
                .then_with(|| left.id.cmp(&right.id))
        });
        Ok(summaries)
    }

    fn get_session(
        &self,
        session_id: &str,
    ) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
        if !is_opencode_transport_available()
            || !session_id_targets_engine(session_id, OPENCODE_ENGINE_ID)
        {
            return Ok(None);
        }

        let lookup_id = extract_native_lookup_id_for_engine(session_id, OPENCODE_ENGINE_ID)?;
        let Some(session) = get_opencode_session(lookup_id.as_str())? else {
            return Ok(None);
        };
        let session_status_map = list_opencode_session_status_map().unwrap_or_default();
        let messages = get_opencode_session_messages(lookup_id.as_str())?;
        let model_id = extract_opencode_session_model_id(&messages);
        let Some(summary) =
            build_opencode_session_summary_record(&session, &session_status_map, model_id)
        else {
            return Ok(None);
        };

        Ok(Some(CodeEngineSessionDetailRecord {
            summary: summary.clone(),
            messages: build_opencode_message_records(summary.id.as_str(), &messages),
        }))
    }

    fn get_session_summary(
        &self,
        session_id: &str,
    ) -> Result<Option<CodeEngineSessionSummaryRecord>, String> {
        if !is_opencode_transport_available()
            || !session_id_targets_engine(session_id, OPENCODE_ENGINE_ID)
        {
            return Ok(None);
        }

        let lookup_id = extract_native_lookup_id_for_engine(session_id, OPENCODE_ENGINE_ID)?;
        let Some(session) = get_opencode_session(lookup_id.as_str())? else {
            return Ok(None);
        };
        let session_status_map = list_opencode_session_status_map().unwrap_or_default();
        let model_id = get_opencode_session_messages(lookup_id.as_str())
            .ok()
            .and_then(|messages| extract_opencode_session_model_id(&messages));
        Ok(build_opencode_session_summary_record(
            &session,
            &session_status_map,
            model_id,
        ))
    }

    fn execute_turn(
        &self,
        request: &CodeEngineTurnRequestRecord,
    ) -> Result<CodeEngineTurnResultRecord, String> {
        if !is_opencode_transport_available() {
            return Err(
                "OpenCode native transport is unavailable. Install `opencode` or set `OPENCODE_SERVER_URL` to an existing OpenCode server.".to_owned(),
            );
        }

        let raw_session_id = resolve_opencode_turn_session_id(request)?;

        let prompt_response = prompt_opencode_session(
            raw_session_id.as_str(),
            build_codeengine_turn_prompt(
                &request.request_kind,
                &request.input_summary,
                request.ide_context.as_ref(),
            )
            .as_str(),
            Some(request.model_id.as_str()),
        )?;
        let prompt_parts = prompt_response
            .get("parts")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let prompt_commands = extract_opencode_message_commands(&prompt_parts);
        let assistant_content = Some(extract_opencode_message_content(
            &prompt_parts,
            prompt_commands.as_slice(),
        ))
        .filter(|content| !content.trim().is_empty())
        .ok_or_else(|| {
            "OpenCode prompt response did not include an assistant message payload.".to_owned()
        })?;
        let resolved_session_id = normalize_value_string(
            prompt_response
                .get("info")
                .and_then(|info| info.get("sessionID")),
        )
        .unwrap_or(raw_session_id);

        Ok(CodeEngineTurnResultRecord {
            assistant_content,
            native_session_id: Some(build_native_session_id(
                OPENCODE_ENGINE_ID,
                &resolved_session_id,
            )),
            commands: if prompt_commands.is_empty() {
                None
            } else {
                Some(prompt_commands)
            },
        })
    }

    fn execute_turn_with_events(
        &self,
        request: &CodeEngineTurnRequestRecord,
        on_event: &mut dyn FnMut(CodeEngineTurnStreamEventRecord) -> Result<(), String>,
    ) -> Result<CodeEngineTurnResultRecord, String> {
        if !is_opencode_transport_available() {
            return Err(
                "OpenCode native transport is unavailable. Install `opencode` or set `OPENCODE_SERVER_URL` to an existing OpenCode server.".to_owned(),
            );
        }

        let raw_session_id = resolve_opencode_turn_session_id(request)?;
        let prompt_text = build_codeengine_turn_prompt(
            &request.request_kind,
            &request.input_summary,
            request.ide_context.as_ref(),
        );
        let mut streamed_content = String::new();
        stream_opencode_session_events(
            raw_session_id.as_str(),
            || {
                prompt_opencode_session_async(
                    raw_session_id.as_str(),
                    prompt_text.as_str(),
                    Some(request.model_id.as_str()),
                )
            },
            &mut |event| {
                streamed_content.push_str(event.content_delta.as_str());
                on_event(event)
            },
        )?;

        let messages = get_opencode_session_messages(raw_session_id.as_str())?;
        let (assistant_content, commands) =
            extract_latest_opencode_assistant_turn_payload(&messages)
                .or_else(|| {
                    Some((
                        streamed_content.clone(),
                        Vec::<CodeEngineSessionCommandRecord>::new(),
                    ))
                    .filter(|(content, _)| !content.trim().is_empty())
                })
                .ok_or_else(|| {
                    "OpenCode streamed turn completed without an assistant message payload."
                        .to_owned()
                })?;

        Ok(CodeEngineTurnResultRecord {
            assistant_content,
            native_session_id: Some(build_native_session_id(OPENCODE_ENGINE_ID, &raw_session_id)),
            commands: if commands.is_empty() {
                None
            } else {
                Some(commands)
            },
        })
    }

    fn supports_live_approval_decision_replies(&self) -> bool {
        true
    }

    fn supports_live_user_question_replies(&self) -> bool {
        true
    }

    fn submit_approval_decision(
        &self,
        decision: &CodeEngineApprovalDecisionRecord,
    ) -> Result<(), String> {
        if !is_opencode_transport_available() {
            return Err(
                "OpenCode native transport is unavailable. Install `opencode` or set `OPENCODE_SERVER_URL` to an existing OpenCode server.".to_owned(),
            );
        }

        reply_opencode_permission_request(
            decision.approval_id.as_str(),
            decision.decision.as_str(),
            decision.reason.as_deref(),
        )
    }

    fn submit_user_question_answer(
        &self,
        answer: &CodeEngineUserQuestionAnswerRecord,
    ) -> Result<(), String> {
        if !is_opencode_transport_available() {
            return Err(
                "OpenCode native transport is unavailable. Install `opencode` or set `OPENCODE_SERVER_URL` to an existing OpenCode server.".to_owned(),
            );
        }

        if answer.rejected {
            return reject_opencode_question_request(answer.question_id.as_str());
        }

        reply_opencode_question_request(
            answer.question_id.as_str(),
            answer.answer.as_str(),
            answer.option_label.as_deref(),
        )
    }
}

fn resolve_opencode_turn_session_id(
    request: &CodeEngineTurnRequestRecord,
) -> Result<String, String> {
    if let Some(native_session_id) = request.native_session_id.as_deref() {
        return extract_native_lookup_id_for_engine(native_session_id, OPENCODE_ENGINE_ID);
    }

    let working_directory = request
        .working_directory
        .as_deref()
        .filter(|directory| directory.exists())
        .ok_or_else(|| {
            "OpenCode native session requires an existing project directory for session creation."
                .to_owned()
        })?;
    let create_title = truncate_title(&request.input_summary);
    let created_session = create_opencode_session(working_directory, Some(create_title.as_str()))?;
    normalize_value_string(created_session.get("id"))
        .ok_or_else(|| "OpenCode create session response did not include an id.".to_owned())
}

fn build_opencode_session_summary_record(
    session: &Value,
    session_status_map: &BTreeMap<String, String>,
    model_id: Option<String>,
) -> Option<CodeEngineSessionSummaryRecord> {
    let model_id = model_id?;
    let raw_session_id = normalize_value_string(session.get("id"))?;
    let created_at =
        timestamp_from_value_millis(session.get("time").and_then(|time| time.get("created")))
            .unwrap_or_else(|| timestamp_from_millis(0));
    let updated_at =
        timestamp_from_value_millis(session.get("time").and_then(|time| time.get("updated")))
            .unwrap_or_else(|| created_at.clone());
    let native_cwd = normalize_path_string(session.get("directory"));
    let title = normalize_value_string(session.get("title"))
        .or_else(|| derive_working_directory_title_from_path(native_cwd.as_deref()))
        .unwrap_or_else(|| {
            format!(
                "Session {}",
                shorten_native_session_id(raw_session_id.as_str())
            )
        });

    let raw_status = session_status_map.get(&raw_session_id);
    let runtime_status =
        map_codeengine_session_runtime_status(raw_status.map(|value| value.as_str()));
    Some(CodeEngineSessionSummaryRecord {
        created_at: created_at.clone(),
        id: build_native_session_id(OPENCODE_ENGINE_ID, raw_session_id.as_str()),
        title,
        status: map_codeengine_session_status_from_runtime(runtime_status).to_owned(),
        runtime_status: Some(runtime_status.to_owned()),
        host_mode: "server".to_owned(),
        engine_id: OPENCODE_ENGINE_ID.to_owned(),
        model_id,
        updated_at: updated_at.clone(),
        last_turn_at: Some(updated_at.clone()),
        kind: "coding".to_owned(),
        native_cwd,
        sort_timestamp: parse_timestamp_millis(&updated_at).unwrap_or_default(),
        transcript_updated_at: Some(updated_at),
    })
}

fn load_opencode_session_model_id(session: &Value) -> Option<String> {
    let raw_session_id = normalize_value_string(session.get("id"))?;
    let messages = get_opencode_session_messages(raw_session_id.as_str()).ok()?;
    extract_opencode_session_model_id(&messages)
}

fn extract_opencode_session_model_id(messages: &[Value]) -> Option<String> {
    messages
        .iter()
        .rev()
        .find_map(|message| build_opencode_message_model_id(message.get("info")))
}

fn build_opencode_message_model_id(info: Option<&Value>) -> Option<String> {
    let info = info?;
    let model_id = normalize_value_string(info.get("modelID"))?;
    if let Some(provider_id) = normalize_value_string(info.get("providerID")) {
        return Some(format!("{provider_id}/{model_id}"));
    }
    Some(model_id)
}

fn build_opencode_message_records(
    coding_session_id: &str,
    messages: &[Value],
) -> Vec<CodeEngineSessionMessageRecord> {
    messages
        .iter()
        .filter_map(|message| build_opencode_message_record(coding_session_id, message))
        .collect()
}

fn extract_latest_opencode_assistant_turn_payload(
    messages: &[Value],
) -> Option<(String, Vec<CodeEngineSessionCommandRecord>)> {
    messages.iter().rev().find_map(|message| {
        let info = message.get("info")?;
        let role = normalize_non_empty_string(info.get("role").and_then(Value::as_str))
            .unwrap_or_else(|| "assistant".to_owned());
        if role == "user" {
            return None;
        }
        let parts = message
            .get("parts")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();
        let commands = extract_opencode_message_commands(&parts);
        let content = extract_opencode_message_content(&parts, commands.as_slice());
        if content.trim().is_empty() {
            return None;
        }
        Some((content, commands))
    })
}

fn build_opencode_message_record(
    coding_session_id: &str,
    message: &Value,
) -> Option<CodeEngineSessionMessageRecord> {
    let info = message.get("info")?;
    let raw_message_id = normalize_value_string(info.get("id"))?;
    let role = normalize_non_empty_string(info.get("role").and_then(Value::as_str))
        .unwrap_or_else(|| "assistant".to_owned());
    let parts = message
        .get("parts")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let commands = extract_opencode_message_commands(&parts);
    let content = extract_opencode_message_content(&parts, commands.as_slice());
    let metadata = build_opencode_message_metadata(info);

    Some(CodeEngineSessionMessageRecord {
        id: format!("{coding_session_id}:native-message:{raw_message_id}"),
        turn_id: Some(raw_message_id),
        role: if role == "user" {
            role
        } else {
            "assistant".to_owned()
        },
        content,
        commands: if commands.is_empty() {
            None
        } else {
            Some(commands)
        },
        tool_calls: None,
        tool_call_id: None,
        file_changes: None,
        task_progress: None,
        metadata,
        created_at: timestamp_from_value_millis(
            info.get("time").and_then(|time| time.get("created")),
        )
        .unwrap_or_else(|| timestamp_from_millis(0)),
    })
}

fn extract_opencode_message_content(
    parts: &[Value],
    commands: &[CodeEngineSessionCommandRecord],
) -> String {
    let mut text_fragments = Vec::new();
    let mut reasoning_fragments = Vec::new();
    let mut fallback_fragments = Vec::new();

    for part in parts {
        match part.get("type").and_then(Value::as_str) {
            Some("text") => {
                if let Some(text) = normalize_value_string(part.get("text")) {
                    text_fragments.push(text);
                }
            }
            Some("reasoning") => {
                if let Some(text) = normalize_value_string(part.get("text")) {
                    reasoning_fragments.push(text);
                }
            }
            Some("file") => {
                if let Some(path) = normalize_value_string(part.get("filename"))
                    .or_else(|| normalize_value_string(part.get("url")))
                {
                    fallback_fragments.push(format!("Referenced file: {path}"));
                }
            }
            Some("step-start") => fallback_fragments.push("Step started.".to_owned()),
            Some("step-finish") => fallback_fragments.push(
                normalize_value_string(part.get("reason"))
                    .map(|reason| format!("Step finished: {reason}"))
                    .unwrap_or_else(|| "Step finished.".to_owned()),
            ),
            Some("patch") => fallback_fragments.push("Patch artifact updated.".to_owned()),
            _ => {}
        }
    }

    if !text_fragments.is_empty() {
        return text_fragments.join("\n");
    }
    if !reasoning_fragments.is_empty() {
        return reasoning_fragments.join("\n");
    }
    if !fallback_fragments.is_empty() {
        return fallback_fragments.join("\n");
    }
    if !commands.is_empty() {
        return commands
            .iter()
            .map(|command| format!("Tool {}: {}", command.status, command.command))
            .collect::<Vec<_>>()
            .join("\n");
    }

    "OpenCode message had no text payload.".to_owned()
}

fn extract_opencode_message_commands(parts: &[Value]) -> Vec<CodeEngineSessionCommandRecord> {
    parts
        .iter()
        .filter_map(|part| {
            if part.get("type").and_then(Value::as_str) != Some("tool") {
                return None;
            }
            let tool_name =
                normalize_value_string(part.get("tool")).unwrap_or_else(|| "tool".to_owned());
            let state = part.get("state");
            let state_status = normalize_value_string(state.and_then(|value| value.get("status")))
                .unwrap_or_else(|| "completed".to_owned());
            let command_arguments = build_opencode_tool_command_arguments(state);
            let kind = map_codeengine_tool_kind(tool_name.as_str());
            let canonical_tool_name = canonicalize_codeengine_tool_name(tool_name.as_str());
            let runtime_status =
                map_codeengine_tool_runtime_status(kind, Some(state_status.as_str()), None)
                    .to_owned();
            let command_status =
                map_codeengine_tool_command_status(Some(state_status.as_str()), None);
            let command = resolve_codeengine_command_text(
                canonical_tool_name.as_str(),
                command_arguments.as_ref(),
                None,
            );
            let interaction_state = resolve_codeengine_command_interaction_state(
                kind,
                command_status.as_str(),
                Some(runtime_status.as_str()),
                false,
                false,
            );
            Some(CodeEngineSessionCommandRecord {
                command,
                status: command_status.clone(),
                output: normalize_value_string(state.and_then(|value| value.get("output")))
                    .or_else(|| normalize_value_string(state.and_then(|value| value.get("error")))),
                kind: Some(kind.to_owned()),
                tool_name: Some(canonical_tool_name),
                tool_call_id: normalize_value_string(part.get("callID"))
                    .or_else(|| normalize_value_string(part.get("id"))),
                runtime_status: Some(runtime_status),
                requires_approval: Some(interaction_state.requires_approval),
                requires_reply: Some(interaction_state.requires_reply),
            })
        })
        .collect()
}

fn build_opencode_message_metadata(info: &Value) -> Option<BTreeMap<String, String>> {
    let mut metadata = BTreeMap::new();
    if let Some(model_id) = normalize_value_string(info.get("modelID")) {
        metadata.insert("modelId".to_owned(), model_id);
    }
    if let Some(provider_id) = normalize_value_string(info.get("providerID")) {
        metadata.insert("providerId".to_owned(), provider_id);
    }
    if let Some(agent) = normalize_value_string(info.get("agent")) {
        metadata.insert("agent".to_owned(), agent);
    }
    if metadata.is_empty() {
        None
    } else {
        Some(metadata)
    }
}

fn normalize_non_empty_string(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_owned())
    }
}

fn normalize_value_string(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(value)) => normalize_non_empty_string(Some(value.as_str())),
        Some(Value::Number(value)) => Some(value.to_string()),
        Some(Value::Bool(value)) => Some(value.to_string()),
        _ => None,
    }
}

fn normalize_path_string(value: Option<&Value>) -> Option<String> {
    let value = normalize_value_string(value)?;
    Some(value.replace('\\', "/"))
}

fn truncate_title(value: &str) -> String {
    const TITLE_LIMIT: usize = 120;
    let collapsed = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.chars().count() <= TITLE_LIMIT {
        return collapsed;
    }

    let mut truncated = collapsed
        .chars()
        .take(TITLE_LIMIT.saturating_sub(3))
        .collect::<String>();
    truncated = truncated.trim_end().to_owned();
    format!("{truncated}...")
}

fn derive_working_directory_title_from_path(value: Option<&str>) -> Option<String> {
    let normalized_path = normalize_non_empty_string(value)?;
    let trimmed = normalized_path.trim_end_matches('/').trim();
    if trimmed.is_empty() {
        return None;
    }

    trimmed
        .rsplit(['/', '\\'])
        .find(|segment| !segment.trim().is_empty())
        .map(|segment| truncate_title(segment.trim()))
}

fn shorten_native_session_id(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return "session".to_owned();
    }

    trimmed.chars().take(8).collect()
}

fn timestamp_from_value_millis(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::Number(number)) => number
            .as_i64()
            .or_else(|| number.as_u64().map(|value| value as i64))
            .map(timestamp_from_millis),
        _ => None,
    }
}

fn parse_timestamp_millis(value: &str) -> Option<i64> {
    let timestamp = value.trim();
    if timestamp.is_empty() {
        return None;
    }

    let parsed =
        time::OffsetDateTime::parse(timestamp, &time::format_description::well_known::Rfc3339)
            .ok()?;
    Some((parsed.unix_timestamp_nanos() / 1_000_000) as i64)
}

fn timestamp_from_millis(value: i64) -> String {
    let seconds = value.div_euclid(1_000);
    let milliseconds = value.rem_euclid(1_000) as u16;
    let datetime = time::OffsetDateTime::from_unix_timestamp(seconds)
        .unwrap_or(time::OffsetDateTime::UNIX_EPOCH)
        .replace_millisecond(milliseconds)
        .unwrap_or(time::OffsetDateTime::UNIX_EPOCH);
    datetime
        .format(&time::format_description::well_known::Rfc3339)
        .unwrap_or_else(|_| "1970-01-01T00:00:00Z".to_owned())
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use serde_json::json;

    use crate::map_codeengine_tool_command_status;

    use super::{
        build_opencode_session_summary_record, extract_opencode_message_commands,
        extract_opencode_session_model_id,
    };

    #[test]
    fn extract_opencode_session_model_id_prefers_provider_scoped_model_id() {
        let messages = vec![json!({
            "info": {
                "providerID": "openai",
                "modelID": "gpt-5.4"
            }
        })];

        assert_eq!(
            extract_opencode_session_model_id(&messages).as_deref(),
            Some("openai/gpt-5.4")
        );
    }

    #[test]
    fn build_opencode_session_summary_record_keeps_model_id_for_session_headers() {
        let session = json!({
            "id": "session-1",
            "title": "BirdCoder OpenCode Session",
            "directory": "D:/workspace/project",
            "time": {
                "created": 1_710_000_000_000_i64,
                "updated": 1_710_000_001_000_i64
            }
        });

        let summary = build_opencode_session_summary_record(
            &session,
            &Default::default(),
            Some("openai/gpt-5.4".to_owned()),
        )
        .expect("build summary");

        assert_eq!(summary.model_id, "openai/gpt-5.4");
    }

    #[test]
    fn build_opencode_session_summary_record_maps_busy_status_to_streaming_runtime() {
        let session = json!({
            "id": "session-1",
            "title": "BirdCoder OpenCode Session",
            "directory": "D:/workspace/project",
            "time": {
                "created": 1_710_000_000_000_i64,
                "updated": 1_710_000_001_000_i64
            }
        });
        let mut status_map = BTreeMap::new();
        status_map.insert("session-1".to_owned(), "busy".to_owned());

        let summary = build_opencode_session_summary_record(
            &session,
            &status_map,
            Some("openai/gpt-5.4".to_owned()),
        )
        .expect("build summary");

        assert_eq!(summary.status, "active");
        assert_eq!(summary.runtime_status.as_deref(), Some("streaming"));
    }

    #[test]
    fn build_opencode_session_summary_record_rejects_missing_model_id() {
        let session = json!({
            "id": "session-1",
            "title": "BirdCoder OpenCode Session",
            "directory": "D:/workspace/project",
            "time": {
                "created": 1_710_000_000_000_i64,
                "updated": 1_710_000_001_000_i64
            }
        });

        let summary = build_opencode_session_summary_record(&session, &Default::default(), None);

        assert!(summary.is_none());
    }

    #[test]
    fn shared_tool_status_normalizes_to_birdcoder_command_statuses() {
        assert_eq!(
            map_codeengine_tool_command_status(Some("completed"), None),
            "success"
        );
        assert_eq!(
            map_codeengine_tool_command_status(Some("error"), None),
            "error"
        );
        assert_eq!(
            map_codeengine_tool_command_status(Some("running"), None),
            "running"
        );
        assert_eq!(
            map_codeengine_tool_command_status(Some("pending"), None),
            "running"
        );
        assert_eq!(
            map_codeengine_tool_command_status(Some("queued"), None),
            "running"
        );
    }

    #[test]
    fn opencode_message_commands_include_state_input_path_when_title_is_missing() {
        let commands = extract_opencode_message_commands(&[json!({
            "type": "tool",
            "tool": "write_file",
            "state": {
                "status": "completed",
                "input": {
                    "path": "src/App.tsx"
                }
            }
        })]);

        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].command, "src/App.tsx");
        assert_eq!(commands[0].status, "success");

        let file_path_alias_commands = extract_opencode_message_commands(&[json!({
            "type": "tool",
            "tool": "write_file",
            "state": {
                "status": "completed",
                "input": {
                    "file_path": "src/Alias.ts"
                }
            }
        })]);

        assert_eq!(file_path_alias_commands.len(), 1);
        assert_eq!(file_path_alias_commands[0].command, "src/Alias.ts");
    }

    #[test]
    fn opencode_command_alias_parts_project_to_run_command() {
        let commands = extract_opencode_message_commands(&[json!({
            "id": "part-command-alias-1",
            "type": "tool",
            "tool": "bash",
            "callID": "tool-command-alias-1",
            "state": {
                "status": "running",
                "input": {
                    "command": "pnpm lint"
                }
            }
        })]);

        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].command, "pnpm lint");
        assert_eq!(commands[0].status, "running");
        assert_eq!(commands[0].kind.as_deref(), Some("command"));
        assert_eq!(commands[0].tool_name.as_deref(), Some("run_command"));
        assert_eq!(
            commands[0].tool_call_id.as_deref(),
            Some("tool-command-alias-1")
        );
    }

    #[test]
    fn opencode_message_commands_parse_string_state_input_arguments() {
        let commands = extract_opencode_message_commands(&[json!({
            "id": "part-string-input-1",
            "type": "tool",
            "tool": "bash",
            "callID": "tool-string-input-1",
            "state": {
                "status": "running",
                "input": "{\"command\":\"pnpm lint\",\"requestId\":101777208078558036}"
            }
        })]);

        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].command, "pnpm lint");
        assert_eq!(commands[0].tool_name.as_deref(), Some("run_command"));
        assert_eq!(
            commands[0].tool_call_id.as_deref(),
            Some("tool-string-input-1")
        );
    }

    #[test]
    fn opencode_question_tool_parts_project_to_user_question_commands() {
        let commands = extract_opencode_message_commands(&[json!({
            "id": "part-question-1",
            "type": "tool",
            "tool": "question",
            "callID": "tool-question-1",
            "state": {
                "status": "pending",
                "input": {
                    "questions": [
                        {
                            "question": "Which tests should I run?",
                            "options": [
                                {
                                    "label": "Unit",
                                    "description": "Run unit tests only"
                                }
                            ]
                        }
                    ]
                }
            }
        })]);

        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].command, "Which tests should I run?");
        assert_eq!(commands[0].status, "running");
        assert_eq!(commands[0].kind.as_deref(), Some("user_question"));
        assert_eq!(commands[0].tool_name.as_deref(), Some("user_question"));
        assert_eq!(commands[0].tool_call_id.as_deref(), Some("tool-question-1"));
        assert_eq!(commands[0].runtime_status.as_deref(), Some("awaiting_user"));
        assert_eq!(commands[0].requires_reply, Some(true));
        assert_eq!(commands[0].requires_approval, Some(false));
    }

    #[test]
    fn opencode_question_alias_parts_project_to_user_question_commands() {
        let commands = extract_opencode_message_commands(&[json!({
            "id": "part-question-alias-1",
            "type": "tool",
            "tool": "ask-user",
            "callID": "tool-question-alias-1",
            "state": {
                "status": "pending",
                "input": {
                    "prompt": "Pick a migration strategy"
                }
            }
        })]);

        assert_eq!(commands.len(), 1);
        assert_eq!(commands[0].command, "Pick a migration strategy");
        assert_eq!(commands[0].status, "running");
        assert_eq!(commands[0].kind.as_deref(), Some("user_question"));
        assert_eq!(commands[0].tool_name.as_deref(), Some("user_question"));
        assert_eq!(commands[0].runtime_status.as_deref(), Some("awaiting_user"));
        assert_eq!(commands[0].requires_reply, Some(true));
    }

    #[test]
    fn opencode_approval_alias_parts_settle_permission_request_commands() {
        let approved_commands = extract_opencode_message_commands(&[json!({
            "id": "part-approval-approved-1",
            "type": "tool",
            "tool": "approval_request",
            "callID": "tool-approval-approved-1",
            "state": {
                "status": "approved",
                "title": "Edit src/App.tsx"
            }
        })]);

        assert_eq!(approved_commands.len(), 1);
        assert_eq!(approved_commands[0].status, "success");
        assert_eq!(approved_commands[0].kind.as_deref(), Some("approval"));
        assert_eq!(
            approved_commands[0].tool_name.as_deref(),
            Some("permission_request")
        );
        assert_eq!(
            approved_commands[0].runtime_status.as_deref(),
            Some("awaiting_tool")
        );
        assert_eq!(approved_commands[0].requires_approval, Some(false));

        let rejected_commands = extract_opencode_message_commands(&[json!({
            "id": "part-approval-rejected-1",
            "type": "tool",
            "tool": "permission request",
            "callID": "tool-approval-rejected-1",
            "state": {
                "status": "rejected",
                "title": "Run deployment"
            }
        })]);

        assert_eq!(rejected_commands.len(), 1);
        assert_eq!(rejected_commands[0].status, "error");
        assert_eq!(rejected_commands[0].kind.as_deref(), Some("approval"));
        assert_eq!(
            rejected_commands[0].tool_name.as_deref(),
            Some("permission_request")
        );
        assert_eq!(
            rejected_commands[0].runtime_status.as_deref(),
            Some("failed")
        );
        assert_eq!(rejected_commands[0].requires_approval, Some(false));
    }
}
