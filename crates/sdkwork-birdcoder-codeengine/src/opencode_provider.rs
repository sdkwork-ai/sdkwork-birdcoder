use std::collections::BTreeMap;

use serde_json::Value;

use crate::opencode::build_opencode_tool_command_arguments;

use crate::{
    build_native_session_id, canonicalize_codeengine_tool_name,
    extract_native_lookup_id_for_engine, get_opencode_session, get_opencode_session_messages,
    is_opencode_transport_available, known_standard_provider_registration,
    list_opencode_session_status_map, list_opencode_sessions,
    map_codeengine_session_runtime_status, map_codeengine_session_status_from_runtime,
    map_codeengine_tool_command_status, map_codeengine_tool_kind,
    map_codeengine_tool_runtime_status, resolve_codeengine_command_interaction_state,
    resolve_codeengine_command_text, sanitize_codeengine_git_repository_url,
    sanitize_codeengine_session_metadata, session_id_targets_engine,
    CodeEngineSessionCommandRecord, CodeEngineSessionDetailRecord, CodeEngineSessionMessageRecord,
    CodeEngineSessionNativeAttributesRecord, CodeEngineSessionSummaryRecord,
    NativeSessionProviderPlugin, NativeSessionProviderRegistration,
};

pub struct OpencodeCodeEngineProvider;
const OPENCODE_ENGINE_ID: &str = "opencode";

impl NativeSessionProviderPlugin for OpencodeCodeEngineProvider {
    fn registration(&self) -> &'static NativeSessionProviderRegistration {
        known_standard_provider_registration(OPENCODE_ENGINE_ID)
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
}

fn build_opencode_session_summary_record(
    session: &Value,
    session_status_map: &BTreeMap<String, String>,
    model_id: Option<String>,
) -> Option<CodeEngineSessionSummaryRecord> {
    let raw_session_id = normalize_value_string(session.get("id"))?;
    let created_at =
        timestamp_from_value_millis(session.get("time").and_then(|time| time.get("created")))
            .unwrap_or_else(|| timestamp_from_millis(0));
    let updated_at =
        timestamp_from_value_millis(session.get("time").and_then(|time| time.get("updated")))
            .unwrap_or_else(|| created_at.clone());
    let native_cwd = normalize_path_string(session.get("directory"));
    let native_title =
        normalize_value_string(session.get("title")).map(|title| truncate_title(title.as_str()));
    let title = native_title
        .clone()
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
    let model = session.get("model");
    let git = session.get("git").or_else(|| session.get("gitInfo"));
    let native_attributes = CodeEngineSessionNativeAttributesRecord {
        session_tree_id: Some(raw_session_id.clone()),
        parent_session_id: normalize_value_string(
            session
                .get("parentID")
                .or_else(|| session.get("parentId"))
                .or_else(|| session.get("parent_id")),
        ),
        title: native_title,
        preview: normalize_value_string(session.get("summary")),
        source: normalize_value_string(session.get("source")),
        provider_version: normalize_value_string(session.get("version")),
        model_provider: normalize_value_string(
            model
                .and_then(|value| value.get("providerID"))
                .or_else(|| model.and_then(|value| value.get("providerId")))
                .or_else(|| session.get("providerID"))
                .or_else(|| session.get("providerId")),
        ),
        project_id: normalize_value_string(
            session
                .get("projectID")
                .or_else(|| session.get("projectId"))
                .or_else(|| session.get("project_id")),
        ),
        cwd: native_cwd.clone(),
        git_branch: normalize_value_string(git.and_then(|value| value.get("branch"))),
        git_commit: normalize_value_string(git.and_then(|value| {
            value
                .get("commit")
                .or_else(|| value.get("commitHash"))
                .or_else(|| value.get("sha"))
        })),
        git_repository_url: sanitize_codeengine_git_repository_url(normalize_value_string(
            git.and_then(|value| {
                value
                    .get("repositoryUrl")
                    .or_else(|| value.get("remoteUrl"))
            }),
        )),
        metadata: sanitize_codeengine_session_metadata(session),
        ..Default::default()
    };
    Some(CodeEngineSessionSummaryRecord {
        created_at: created_at.clone(),
        id: build_native_session_id(OPENCODE_ENGINE_ID, raw_session_id.as_str()),
        title,
        status: map_codeengine_session_status_from_runtime(runtime_status).to_owned(),
        runtime_status: Some(runtime_status.to_owned()),
        host_mode: "server".to_owned(),
        engine_id: OPENCODE_ENGINE_ID.to_owned(),
        model_id: model_id
            .or_else(|| load_opencode_session_model_id(session))
            .unwrap_or_else(|| "opencode".to_owned()),
        updated_at: updated_at.clone(),
        last_turn_at: Some(updated_at.clone()),
        kind: "coding".to_owned(),
        native_cwd,
        sort_timestamp: parse_timestamp_millis(&updated_at).unwrap_or_default(),
        transcript_updated_at: Some(updated_at),
        workspace_id: None,
        project_id: None,
        native_attributes,
    })
}

fn load_opencode_session_model_id(session: &Value) -> Option<String> {
    let model = session.get("model");
    let model_id = normalize_value_string(model)
        .or_else(|| normalize_value_string(model.and_then(|value| value.get("id"))))
        .or_else(|| normalize_value_string(model.and_then(|value| value.get("modelID"))))
        .or_else(|| normalize_value_string(model.and_then(|value| value.get("model_id"))))
        .or_else(|| normalize_value_string(session.get("modelID")))
        .or_else(|| normalize_value_string(session.get("model_id")))?;
    let provider_id = normalize_value_string(model.and_then(|value| value.get("providerID")))
        .or_else(|| normalize_value_string(model.and_then(|value| value.get("provider_id"))))
        .or_else(|| normalize_value_string(session.get("providerID")))
        .or_else(|| normalize_value_string(session.get("provider_id")));

    combine_opencode_provider_model_id(provider_id.as_deref(), model_id.as_str())
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
    combine_opencode_provider_model_id(
        normalize_value_string(info.get("providerID")).as_deref(),
        model_id.as_str(),
    )
}

fn combine_opencode_provider_model_id(provider_id: Option<&str>, model_id: &str) -> Option<String> {
    let model_id = normalize_non_empty_string(Some(model_id))?;
    match provider_id.and_then(|value| normalize_non_empty_string(Some(value))) {
        Some(provider_id) if !model_id.contains('/') => Some(format!("{provider_id}/{model_id}")),
        _ => Some(model_id),
    }
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
    let tool_calls = extract_opencode_message_tool_calls(&parts);
    let file_changes = extract_opencode_message_file_changes(info, &parts);
    let task_progress = extract_opencode_message_task_progress(&parts);
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
        tool_calls: if tool_calls.is_empty() {
            None
        } else {
            Some(tool_calls)
        },
        tool_call_id: None,
        file_changes: if file_changes.is_empty() {
            None
        } else {
            Some(file_changes)
        },
        task_progress,
        metadata,
        created_at: timestamp_from_value_millis(
            info.get("time").and_then(|time| time.get("created")),
        )
        .unwrap_or_else(|| timestamp_from_millis(0)),
    })
}

fn extract_opencode_message_tool_calls(parts: &[Value]) -> Vec<Value> {
    parts
        .iter()
        .filter(|part| {
            matches!(
                part.get("type").and_then(Value::as_str),
                Some("tool" | "subtask")
            )
        })
        .cloned()
        .collect()
}

fn extract_opencode_message_file_changes(info: &Value, parts: &[Value]) -> Vec<Value> {
    let mut file_changes_by_path = BTreeMap::<String, Value>::new();

    for part in parts {
        match part.get("type").and_then(Value::as_str) {
            Some("patch") => {
                for path in part
                    .get("files")
                    .and_then(Value::as_array)
                    .into_iter()
                    .flatten()
                    .filter_map(|value| normalize_path_string(Some(value)))
                {
                    file_changes_by_path.entry(path.clone()).or_insert_with(|| {
                        build_opencode_file_change(path.as_str(), None, None, None)
                    });
                }
            }
            Some("tool") => {
                let tool_name = normalize_value_string(part.get("tool"))
                    .unwrap_or_else(|| "tool".to_owned());
                if map_codeengine_tool_kind(tool_name.as_str()) != "file_change" {
                    continue;
                }
                let state = part.get("state");
                let input = state.and_then(|value| value.get("input"));
                let path = ["path", "filePath", "file_path", "filename"]
                    .into_iter()
                    .find_map(|field| normalize_path_string(input.and_then(|value| value.get(field))));
                let Some(path) = path else {
                    continue;
                };
                let metadata = state.and_then(|value| value.get("metadata"));
                let diff = ["diff", "patch", "unifiedDiff", "unified_diff"]
                    .into_iter()
                    .find_map(|field| {
                        normalize_value_string(metadata.and_then(|value| value.get(field)))
                            .or_else(|| {
                                normalize_value_string(state.and_then(|value| value.get(field)))
                            })
                    });
                file_changes_by_path.insert(
                    path.clone(),
                    build_opencode_file_change(path.as_str(), diff.as_deref(), None, None),
                );
            }
            _ => {}
        }
    }

    for diff in info
        .get("summary")
        .and_then(|value| value.get("diffs"))
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
    {
        let path = ["path", "file", "filename"]
            .into_iter()
            .find_map(|field| normalize_path_string(diff.get(field)));
        let Some(path) = path else {
            continue;
        };
        let unified_diff = ["diff", "patch", "unifiedDiff", "unified_diff"]
            .into_iter()
            .find_map(|field| normalize_value_string(diff.get(field)));
        file_changes_by_path.insert(
            path.clone(),
            build_opencode_file_change(
                path.as_str(),
                unified_diff.as_deref(),
                read_opencode_non_negative_integer(diff.get("additions")),
                read_opencode_non_negative_integer(diff.get("deletions")),
            ),
        );
    }

    file_changes_by_path.into_values().collect()
}

fn build_opencode_file_change(
    path: &str,
    diff: Option<&str>,
    additions: Option<u64>,
    deletions: Option<u64>,
) -> Value {
    let (derived_additions, derived_deletions) = diff
        .map(count_opencode_unified_diff_lines)
        .unwrap_or_default();
    let mut file_change = serde_json::Map::new();
    file_change.insert(
        "path".to_owned(),
        Value::String(path.replace('\\', "/")),
    );
    file_change.insert(
        "additions".to_owned(),
        Value::from(additions.unwrap_or(derived_additions)),
    );
    file_change.insert(
        "deletions".to_owned(),
        Value::from(deletions.unwrap_or(derived_deletions)),
    );
    if let Some(diff) = diff {
        file_change.insert("diff".to_owned(), Value::String(diff.to_owned()));
    }
    Value::Object(file_change)
}

fn count_opencode_unified_diff_lines(diff: &str) -> (u64, u64) {
    let mut additions = 0_u64;
    let mut deletions = 0_u64;
    for line in diff.replace("\r\n", "\n").replace('\r', "\n").lines() {
        if line.starts_with("+++") || line.starts_with("---") {
            continue;
        }
        if line.starts_with('+') {
            additions += 1;
        } else if line.starts_with('-') {
            deletions += 1;
        }
    }
    (additions, deletions)
}

fn read_opencode_non_negative_integer(value: Option<&Value>) -> Option<u64> {
    match value {
        Some(Value::Number(value)) => value
            .as_u64()
            .or_else(|| value.as_i64().map(|value| value.max(0) as u64)),
        Some(Value::String(value)) => value.trim().parse::<u64>().ok(),
        _ => None,
    }
}

fn extract_opencode_message_task_progress(parts: &[Value]) -> Option<Value> {
    parts.iter().rev().find_map(|part| {
        if part.get("type").and_then(Value::as_str) != Some("tool") {
            return None;
        }
        let tool_name = normalize_value_string(part.get("tool"))?;
        if map_codeengine_tool_kind(tool_name.as_str()) != "task" {
            return None;
        }
        let input = part.get("state")?.get("input")?;
        let items = input
            .get("todos")
            .or_else(|| input.get("items"))
            .or_else(|| input.get("tasks"))?
            .as_array()?;
        let completed = items
            .iter()
            .filter(|item| {
                item.get("completed").and_then(Value::as_bool) == Some(true)
                    || matches!(
                        normalize_value_string(item.get("status")).as_deref(),
                        Some("completed" | "done" | "success")
                    )
            })
            .count();
        Some(serde_json::json!({
            "total": items.len(),
            "completed": completed,
        }))
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
                output: extract_opencode_tool_state_output(state),
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

fn extract_opencode_tool_state_output(state: Option<&Value>) -> Option<String> {
    let state = state?;
    let metadata = state.get("metadata");
    let interrupted_output = if metadata
        .and_then(|value| value.get("interrupted"))
        .and_then(Value::as_bool)
        == Some(true)
    {
        normalize_value_string(metadata.and_then(|value| value.get("output")))
    } else {
        None
    };

    interrupted_output
        .or_else(|| normalize_value_string(state.get("output")))
        .or_else(|| normalize_value_string(state.get("error")))
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
        build_opencode_message_record, build_opencode_session_summary_record,
        extract_opencode_message_commands, extract_opencode_session_model_id,
        load_opencode_session_model_id,
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
            "parentID": "parent-session",
            "projectID": "provider-project",
            "version": "1.17.4",
            "futureField": { "nested": true },
            "model": {
                "id": "gpt-5.4",
                "providerID": "openai",
                "variant": "high"
            },
            "time": {
                "created": 1_710_000_000_000_i64,
                "updated": 1_710_000_001_000_i64
            }
        });

        let summary = build_opencode_session_summary_record(&session, &Default::default(), None)
            .expect("build summary");

        assert_eq!(summary.model_id, "openai/gpt-5.4");
        assert_eq!(summary.title, "BirdCoder OpenCode Session");
        assert_eq!(
            summary.native_attributes.parent_session_id.as_deref(),
            Some("parent-session")
        );
        assert_eq!(
            summary.native_attributes.project_id.as_deref(),
            Some("provider-project")
        );
        assert_eq!(
            summary.native_attributes.provider_version.as_deref(),
            Some("1.17.4")
        );
        assert_eq!(
            summary.native_attributes.model_provider.as_deref(),
            Some("openai")
        );
        assert_eq!(
            summary.native_attributes.metadata["futureField"]["nested"],
            true
        );
    }

    #[test]
    fn build_opencode_session_summary_record_normalizes_native_title() {
        let session = json!({
            "id": "session-native-title",
            "title": "  Native    OpenCode   session  ",
            "directory": "D:/workspace/project",
            "time": {
                "created": 1_710_000_000_000_i64,
                "updated": 1_710_000_001_000_i64
            }
        });

        let summary = build_opencode_session_summary_record(&session, &Default::default(), None)
            .expect("build OpenCode summary with native title");

        assert_eq!(summary.title, "Native OpenCode session");
    }

    #[test]
    fn load_opencode_session_model_id_supports_legacy_and_provider_scoped_fields() {
        assert_eq!(
            load_opencode_session_model_id(&json!({
                "providerID": "anthropic",
                "modelID": "claude-sonnet-4-5"
            }))
            .as_deref(),
            Some("anthropic/claude-sonnet-4-5")
        );
        assert_eq!(
            load_opencode_session_model_id(&json!({
                "model": {
                    "id": "openai/gpt-5.4",
                    "providerID": "openai"
                }
            }))
            .as_deref(),
            Some("openai/gpt-5.4")
        );
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
    fn build_opencode_session_summary_record_keeps_session_without_model_metadata() {
        let session = json!({
            "id": "session-1",
            "title": "BirdCoder OpenCode Session",
            "directory": "D:/workspace/project",
            "time": {
                "created": 1_710_000_000_000_i64,
                "updated": 1_710_000_001_000_i64
            }
        });

        let summary = build_opencode_session_summary_record(&session, &Default::default(), None)
            .expect("build summary without model metadata");

        assert_eq!(summary.id, "session-1");
        assert_eq!(summary.model_id, "opencode");
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

    #[test]
    fn opencode_history_preserves_interrupted_output_attachments_and_file_changes() {
        let message = json!({
            "info": {
                "id": "message-history-1",
                "role": "assistant",
                "time": { "created": 1_710_000_000_000_i64 },
                "summary": {
                    "diffs": [
                        {
                            "path": "src/App.tsx",
                            "additions": 3,
                            "deletions": 1,
                            "diff": "--- a/src/App.tsx\n+++ b/src/App.tsx\n-old\n+new\n+line\n+tail"
                        }
                    ]
                }
            },
            "parts": [
                {
                    "id": "part-interrupted",
                    "type": "tool",
                    "callID": "call-interrupted",
                    "tool": "bash",
                    "state": {
                        "status": "error",
                        "input": { "command": "pnpm test" },
                        "error": "Tool execution aborted",
                        "metadata": {
                            "interrupted": true,
                            "output": "partial test output"
                        },
                        "time": { "start": 1000, "end": 1250 }
                    }
                },
                {
                    "id": "part-write",
                    "type": "tool",
                    "callID": "call-write",
                    "tool": "write_file",
                    "state": {
                        "status": "completed",
                        "input": { "path": "src/App.tsx" },
                        "output": "updated",
                        "title": "Write src/App.tsx",
                        "metadata": {},
                        "time": { "start": 1300, "end": 1500 },
                        "attachments": [
                            {
                                "type": "file",
                                "mime": "image/png",
                                "filename": "preview.png",
                                "url": "data:image/png;base64,aGVsbG8="
                            }
                        ]
                    }
                },
                {
                    "id": "part-patch",
                    "type": "patch",
                    "hash": "patch-1",
                    "files": ["src/App.tsx", "src/new.ts"]
                },
                {
                    "id": "part-todo",
                    "type": "tool",
                    "callID": "call-todo",
                    "tool": "todowrite",
                    "state": {
                        "status": "completed",
                        "input": {
                            "todos": [
                                { "content": "Inspect", "status": "completed" },
                                { "content": "Verify", "status": "pending" }
                            ]
                        },
                        "output": "updated",
                        "title": "Update todos",
                        "metadata": {},
                        "time": { "start": 1600, "end": 1700 }
                    }
                }
            ]
        });

        let record = build_opencode_message_record("opencode:session-history", &message)
            .expect("build OpenCode history message");

        let tool_calls = record.tool_calls.expect("preserve native tool calls");
        assert_eq!(tool_calls.len(), 3);
        assert_eq!(
            tool_calls[0]["state"]["metadata"]["output"],
            "partial test output"
        );
        assert_eq!(
            tool_calls[1]["state"]["attachments"][0]["filename"],
            "preview.png"
        );
        let commands = record.commands.expect("project OpenCode commands");
        assert_eq!(commands[0].output.as_deref(), Some("partial test output"));
        let file_changes = record.file_changes.expect("project file changes");
        assert_eq!(file_changes.len(), 2);
        assert_eq!(file_changes[0]["path"], "src/App.tsx");
        assert_eq!(file_changes[0]["additions"], 3);
        assert_eq!(file_changes[0]["deletions"], 1);
        assert_eq!(file_changes[1]["path"], "src/new.ts");
        assert_eq!(record.task_progress, Some(json!({ "total": 2, "completed": 1 })));
    }
}
