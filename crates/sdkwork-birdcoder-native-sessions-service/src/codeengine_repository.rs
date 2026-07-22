use sdkwork_birdcoder_codeengine::{
    get_codeengine_native_session_detail, list_codeengine_native_session_summaries,
    sanitize_codeengine_git_repository_url, sanitize_codeengine_session_metadata,
    CodeEngineSessionDetailRecord, CodeEngineSessionNativeAttributesRecord,
    CodeEngineSessionSummaryRecord,
};

use crate::service::native_session_service::{
    NativeSessionAttributesPayload, NativeSessionCommandPayload, NativeSessionDetailPayload,
    NativeSessionLookup, NativeSessionMessagePayload, NativeSessionQuery,
    NativeSessionReasoningPayload, NativeSessionRepository, NativeSessionSummaryPayload,
};

/// Code-engine backed adapter for the internal native-session service.
///
/// Project authorization is intentionally outside this adapter. Callers must
/// supply the exact canonical root resolved by `ProjectService`; provider
/// metadata is then filtered against that root before it can be materialized.
#[derive(Clone, Default)]
pub struct CodeEngineNativeSessionRepository;

impl NativeSessionRepository for CodeEngineNativeSessionRepository {
    fn discover_sessions(
        &self,
        query: &NativeSessionQuery,
    ) -> Result<Vec<NativeSessionSummaryPayload>, String> {
        let engine_id = non_blank(query.engine_id.as_deref());
        list_codeengine_native_session_summaries(engine_id).map(|records| {
            records
                .into_iter()
                .filter(|record| matches_native_session_query(record, query))
                .map(|record| {
                    map_native_session_summary(
                        record,
                        query.workspace_id.as_deref(),
                        query.project_id.as_deref(),
                    )
                })
                .collect()
        })
    }

    fn get_session(
        &self,
        lookup: &NativeSessionLookup,
    ) -> Result<Option<NativeSessionDetailPayload>, String> {
        let Some(detail) = get_codeengine_native_session_detail(
            lookup.session_id.as_str(),
            non_blank(lookup.engine_id.as_deref()),
        )?
        else {
            return Ok(None);
        };
        if !matches_native_session_lookup(&detail.summary, lookup) {
            return Ok(None);
        }
        Ok(Some(map_native_session_detail(
            detail,
            lookup.workspace_id.as_deref(),
            lookup.project_id.as_deref(),
        )))
    }
}

fn non_blank(value: Option<&str>) -> Option<&str> {
    value.map(str::trim).filter(|value| !value.is_empty())
}

pub fn native_session_query_is_scoped(query: &NativeSessionQuery) -> bool {
    non_blank(query.workspace_id.as_deref()).is_some()
        && non_blank(query.project_id.as_deref()).is_some()
        && non_blank(query.runtime_location_id.as_deref()).is_some()
        && non_blank(query.project_root.as_deref()).is_some()
}

pub fn native_session_lookup_is_scoped(lookup: &NativeSessionLookup) -> bool {
    non_blank(lookup.workspace_id.as_deref()).is_some()
        && non_blank(lookup.project_id.as_deref()).is_some()
        && non_blank(lookup.runtime_location_id.as_deref()).is_some()
        && non_blank(lookup.project_root.as_deref()).is_some()
}

fn matches_native_session_scope(
    record: &CodeEngineSessionSummaryRecord,
    workspace_id: Option<&str>,
    project_id: Option<&str>,
    project_root: Option<&str>,
) -> bool {
    if non_blank(workspace_id).is_none() || non_blank(project_id).is_none() {
        return false;
    }
    // Provider-reported project identifiers can be stale after an import.
    // They are metadata, never authority; the authorized root is authoritative.
    native_session_cwd_is_within_project(record.native_cwd.as_deref(), project_root)
}

fn normalize_native_session_path(value: Option<&str>) -> Option<String> {
    let value = non_blank(value)?;
    let normalized = std::fs::canonicalize(std::path::Path::new(value))
        .ok()
        .map(|canonical| canonical.to_string_lossy().into_owned())
        .unwrap_or_else(|| value.to_owned());
    let normalized = normalize_native_session_path_lexically(normalized.as_str());
    if normalized.is_empty() {
        None
    } else if cfg!(windows) || normalized.as_bytes().get(1) == Some(&b':') {
        Some(normalized.to_ascii_lowercase())
    } else {
        Some(normalized)
    }
}

fn normalize_native_session_path_lexically(value: &str) -> String {
    let value = value.replace('\\', "/");
    let value = if let Some(unc_path) = value.strip_prefix("//?/UNC/") {
        format!("//{unc_path}")
    } else if let Some(drive_path) = value.strip_prefix("//?/") {
        drive_path.to_owned()
    } else {
        value
    };
    let (prefix, remainder, absolute) = if value.starts_with("//") {
        ("//", value.trim_start_matches('/'), true)
    } else if value.starts_with('/') {
        ("/", value.trim_start_matches('/'), true)
    } else if value.as_bytes().get(1) == Some(&b':') {
        let prefix = &value[..2];
        let remainder = value[2..].trim_start_matches('/');
        (prefix, remainder, value.as_bytes().get(2) == Some(&b'/'))
    } else {
        ("", value.as_str(), false)
    };

    let protected_components = usize::from(prefix == "//") * 2;
    let mut components: Vec<&str> = Vec::new();
    for component in remainder.split('/') {
        match component {
            "" | "." => {}
            ".." => {
                if components.len() > protected_components
                    && components.last().is_some_and(|last| *last != "..")
                {
                    components.pop();
                } else if !absolute {
                    components.push(component);
                }
            }
            component => components.push(component),
        }
    }

    let joined = components.join("/");
    match (prefix, absolute, joined.is_empty()) {
        ("/", _, true) => "/".to_owned(),
        ("/", _, false) => format!("/{joined}"),
        ("//", _, true) => "//".to_owned(),
        ("//", _, false) => format!("//{joined}"),
        (drive, true, true) if drive.len() == 2 => format!("{drive}/"),
        (drive, true, false) if drive.len() == 2 => format!("{drive}/{joined}"),
        ("", _, _) => joined,
        (prefix, _, true) => prefix.to_owned(),
        (prefix, _, false) => format!("{prefix}{joined}"),
    }
}

fn native_session_cwd_is_within_project(
    native_cwd: Option<&str>,
    project_root: Option<&str>,
) -> bool {
    let Some(native_cwd) = normalize_native_session_path(native_cwd) else {
        return false;
    };
    let Some(project_root) = normalize_native_session_path(project_root) else {
        return false;
    };
    native_cwd == project_root
        || native_cwd
            .strip_prefix(project_root.as_str())
            .is_some_and(|suffix| suffix.starts_with('/'))
}

fn matches_native_session_query(
    record: &CodeEngineSessionSummaryRecord,
    query: &NativeSessionQuery,
) -> bool {
    native_session_query_is_scoped(query)
        && non_blank(query.engine_id.as_deref())
            .is_none_or(|engine_id| record.engine_id == engine_id)
        && matches_native_session_scope(
            record,
            query.workspace_id.as_deref(),
            query.project_id.as_deref(),
            query.project_root.as_deref(),
        )
}

fn matches_native_session_lookup(
    record: &CodeEngineSessionSummaryRecord,
    lookup: &NativeSessionLookup,
) -> bool {
    native_session_lookup_is_scoped(lookup)
        && non_blank(lookup.engine_id.as_deref())
            .is_none_or(|engine_id| record.engine_id == engine_id)
        && matches_native_session_scope(
            record,
            lookup.workspace_id.as_deref(),
            lookup.project_id.as_deref(),
            lookup.project_root.as_deref(),
        )
}

fn map_native_session_summary(
    record: CodeEngineSessionSummaryRecord,
    workspace_id: Option<&str>,
    project_id: Option<&str>,
) -> NativeSessionSummaryPayload {
    let native_session_id = sdkwork_birdcoder_codeengine::extract_native_lookup_id_for_engine(
        record.id.as_str(),
        record.engine_id.as_str(),
    )
    .ok();
    NativeSessionSummaryPayload {
        id: record.id,
        workspace_id: workspace_id
            .map(str::to_owned)
            .or(record.workspace_id)
            .unwrap_or_default(),
        project_id: project_id
            .map(str::to_owned)
            .or(record.project_id)
            .unwrap_or_default(),
        title: record.title,
        status: record.status,
        host_mode: record.host_mode,
        engine_id: record.engine_id,
        model_id: record.model_id,
        native_session_id,
        created_at: record.created_at,
        updated_at: record.updated_at,
        last_turn_at: record.last_turn_at,
        transcript_updated_at: record.transcript_updated_at,
        sort_timestamp: record.sort_timestamp,
        kind: record.kind,
        native_attributes: map_native_session_attributes(record.native_attributes),
    }
}

fn map_native_session_attributes(
    record: CodeEngineSessionNativeAttributesRecord,
) -> NativeSessionAttributesPayload {
    let metadata = sanitize_codeengine_session_metadata(&serde_json::Value::Object(
        record.metadata.into_iter().collect(),
    ));
    NativeSessionAttributesPayload {
        schema_version: record.schema_version,
        session_tree_id: record.session_tree_id,
        parent_session_id: record.parent_session_id,
        forked_from_session_id: record.forked_from_session_id,
        title: record.title,
        preview: record.preview,
        source: record.source,
        provider_version: record.provider_version,
        model_provider: record.model_provider,
        project_id: record.project_id,
        cwd: record.cwd,
        git_branch: record.git_branch,
        git_commit: record.git_commit,
        git_repository_url: sanitize_codeengine_git_repository_url(record.git_repository_url),
        agent_name: record.agent_name,
        agent_role: record.agent_role,
        is_ephemeral: record.is_ephemeral,
        is_sidechain: record.is_sidechain,
        metadata,
    }
}

fn map_native_session_detail(
    record: CodeEngineSessionDetailRecord,
    workspace_id: Option<&str>,
    project_id: Option<&str>,
) -> NativeSessionDetailPayload {
    let summary = map_native_session_summary(record.summary, workspace_id, project_id);
    let coding_session_id = summary.id.clone();
    NativeSessionDetailPayload {
        summary,
        messages: record
            .messages
            .into_iter()
            .map(|message| NativeSessionMessagePayload {
                id: message.id,
                coding_session_id: coding_session_id.clone(),
                turn_id: message.turn_id,
                role: message.role,
                content: message.content,
                commands: message.commands.map(|commands| {
                    commands
                        .into_iter()
                        .map(|command| NativeSessionCommandPayload {
                            command: command.command,
                            status: command.status,
                            output: command.output,
                            kind: command.kind,
                            tool_name: command.tool_name,
                            tool_call_id: command.tool_call_id,
                            runtime_status: command.runtime_status,
                            requires_approval: command.requires_approval,
                            requires_reply: command.requires_reply,
                        })
                        .collect()
                }),
                tool_calls: message.tool_calls,
                tool_call_id: message.tool_call_id,
                file_changes: message.file_changes,
                reasoning: message.reasoning.map(|items| {
                    items
                        .into_iter()
                        .map(|item| NativeSessionReasoningPayload {
                            id: item.id,
                            summary: item.summary,
                            title: item.title,
                            created_at: item.created_at,
                            started_at: item.started_at,
                            completed_at: item.completed_at,
                            duration_ms: item.duration_ms,
                        })
                        .collect()
                }),
                resources: message.resources.and_then(|resources| {
                    let resources = resources
                        .into_iter()
                        .filter_map(|resource| serde_json::to_value(resource).ok())
                        .collect::<Vec<_>>();
                    (!resources.is_empty()).then_some(resources)
                }),
                task_progress: message.task_progress,
                metadata: message.metadata,
                created_at: message.created_at,
            })
            .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        map_native_session_summary, matches_native_session_scope,
        normalize_native_session_path_lexically,
    };
    use sdkwork_birdcoder_codeengine::{
        build_native_session_id, CodeEngineSessionNativeAttributesRecord,
        CodeEngineSessionSummaryRecord,
    };

    fn native_summary(engine_id: &str, native_cwd: Option<&str>) -> CodeEngineSessionSummaryRecord {
        CodeEngineSessionSummaryRecord {
            created_at: "2026-07-15T00:00:00Z".to_owned(),
            id: build_native_session_id(engine_id, "session-1"),
            title: "Session".to_owned(),
            status: "active".to_owned(),
            runtime_status: Some("completed".to_owned()),
            host_mode: "desktop".to_owned(),
            engine_id: engine_id.to_owned(),
            model_id: "model-1".to_owned(),
            updated_at: "2026-07-15T00:01:00Z".to_owned(),
            last_turn_at: Some("2026-07-15T00:01:00Z".to_owned()),
            kind: "coding".to_owned(),
            native_cwd: native_cwd.map(str::to_owned),
            sort_timestamp: 1_752_537_660_123,
            transcript_updated_at: Some("2026-07-15T00:01:00Z".to_owned()),
            workspace_id: None,
            project_id: None,
            native_attributes: CodeEngineSessionNativeAttributesRecord {
                model_provider: Some("openai".to_owned()),
                title: Some("Native provider title".to_owned()),
                ..Default::default()
            },
        }
    }

    #[test]
    fn all_registered_provider_sessions_use_the_authorized_project_root() {
        for engine_id in ["codex", "opencode", "claude-code", "gemini"] {
            let exact = native_summary(engine_id, Some("C:\\workspace\\project"));
            let descendant = native_summary(engine_id, Some("C:/workspace/project/packages/app"));
            let sibling = native_summary(engine_id, Some("C:/workspace/project-other"));
            assert!(matches_native_session_scope(
                &exact,
                Some("workspace-1"),
                Some("project-1"),
                Some("C:/workspace/project"),
            ));
            assert!(matches_native_session_scope(
                &descendant,
                Some("workspace-1"),
                Some("project-1"),
                Some("C:/workspace/project"),
            ));
            assert!(!matches_native_session_scope(
                &sibling,
                Some("workspace-1"),
                Some("project-1"),
                Some("C:/workspace/project"),
            ));
        }
    }

    #[test]
    fn native_scope_normalizes_extended_windows_paths_and_dot_segments() {
        assert_eq!(
            normalize_native_session_path_lexically("//?/C:/workspace/project/../project/app"),
            "C:/workspace/project/app"
        );
        assert_eq!(
            normalize_native_session_path_lexically("//?/UNC/server/share/project/app"),
            "//server/share/project/app"
        );
        let escaped = native_summary(
            "codex",
            Some("C:/workspace/project/packages/../../project-other"),
        );
        assert!(!matches_native_session_scope(
            &escaped,
            Some("workspace-1"),
            Some("project-1"),
            Some("C:/workspace/project"),
        ));
    }

    #[test]
    fn mapped_summary_uses_effective_scope_raw_identity_and_safe_metadata() {
        let mut record = native_summary("codex", Some("C:/workspace/project"));
        record.workspace_id = Some("workspace-old".to_owned());
        record.project_id = Some("project-old".to_owned());
        record.native_attributes.metadata = std::collections::BTreeMap::from([
            ("cwd".to_owned(), serde_json::json!("C:/private/project")),
            ("safe".to_owned(), serde_json::json!(true)),
        ]);
        record.native_attributes.git_repository_url =
            Some("https://token:secret@example.com/owner/repository.git".to_owned());

        let payload =
            map_native_session_summary(record, Some("workspace-current"), Some("project-current"));
        let json = serde_json::to_value(&payload).expect("serialize summary");
        assert_eq!(payload.workspace_id, "workspace-current");
        assert_eq!(payload.project_id, "project-current");
        assert_eq!(payload.native_session_id.as_deref(), Some("session-1"));
        assert!(json["nativeAttributes"]["metadata"].get("cwd").is_none());
        assert_eq!(json["nativeAttributes"]["metadata"]["safe"], true);
        assert!(json["nativeAttributes"].get("gitRepositoryUrl").is_none());
    }
}
