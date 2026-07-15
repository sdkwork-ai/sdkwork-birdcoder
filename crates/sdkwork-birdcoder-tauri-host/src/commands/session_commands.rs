use std::collections::BTreeMap;
use std::path::{Component, Path, PathBuf};

use sdkwork_birdcoder_codeengine::{
    extract_native_lookup_id_for_engine, get_codeengine_native_session_detail,
    list_codeengine_native_session_summaries, CodeEngineSessionDetailRecord,
    CodeEngineSessionMessageRecord, CodeEngineSessionSummaryRecord,
};
use serde::{Deserialize, Serialize};

const DEFAULT_NATIVE_SESSION_PAGE_SIZE: usize = 20;
const MAX_NATIVE_SESSION_PAGE_SIZE: usize = 200;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionDescriptorSnapshot {
    pub session_id: String,
    pub workspace_id: String,
    pub target: String,
    pub state: String,
    pub created_at: String,
    pub last_active_at: String,
    pub mode_tags: Vec<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAttachmentDescriptorSnapshot {
    pub attachment_id: String,
    pub session_id: String,
    pub cursor: String,
    pub last_ack_sequence: u64,
    pub writable: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionIndexSnapshot {
    pub sessions: Vec<DesktopSessionDescriptorSnapshot>,
    pub attachments: Vec<DesktopAttachmentDescriptorSnapshot>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopReplayEntrySnapshot {
    pub sequence: u64,
    pub kind: String,
    pub payload: String,
    pub occurred_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionReplaySnapshot {
    pub session_id: String,
    pub from_cursor: Option<String>,
    pub next_cursor: String,
    pub has_more: bool,
    pub entries: Vec<DesktopReplayEntrySnapshot>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionAttachRequest {
    pub session_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionDetachRequest {
    pub attachment_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionAttachmentSnapshot {
    pub session: DesktopSessionDescriptorSnapshot,
    pub attachment: DesktopAttachmentDescriptorSnapshot,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellExecRequest {
    pub profile: String,
    pub command_text: String,
    pub working_directory: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellExecSnapshot {
    pub profile: String,
    pub command_text: String,
    pub working_directory: String,
    pub invoked_program: String,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionCreateRequest {
    pub profile: String,
    pub working_directory: Option<String>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
    pub title: Option<String>,
    pub profile_id: Option<String>,
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionCreateSnapshot {
    pub session_id: String,
    pub workspace_id: String,
    pub target: String,
    pub state: String,
    pub created_at: String,
    pub last_active_at: String,
    pub mode_tags: Vec<String>,
    pub tags: Vec<String>,
    pub attachment_id: String,
    pub cursor: String,
    pub last_ack_sequence: u64,
    pub writable: bool,
    pub profile: String,
    pub working_directory: String,
    pub invoked_program: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalProcessSessionCreateRequest {
    pub command: Vec<String>,
    pub working_directory: Option<String>,
    pub cols: Option<u16>,
    pub rows: Option<u16>,
    pub title: Option<String>,
    pub profile_id: Option<String>,
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalProcessSessionCreateSnapshot {
    pub session_id: String,
    pub workspace_id: String,
    pub target: String,
    pub state: String,
    pub created_at: String,
    pub last_active_at: String,
    pub mode_tags: Vec<String>,
    pub tags: Vec<String>,
    pub attachment_id: String,
    pub cursor: String,
    pub last_ack_sequence: u64,
    pub writable: bool,
    pub working_directory: String,
    pub invoked_program: String,
    pub invoked_args: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionInputRequest {
    pub session_id: String,
    pub input: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionInputBytesRequest {
    pub session_id: String,
    pub input_bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionInputSnapshot {
    pub session_id: String,
    pub accepted_bytes: usize,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionAttachmentAcknowledgeRequest {
    pub attachment_id: String,
    pub sequence: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionResizeRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionResizeSnapshot {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionTerminateSnapshot {
    pub session_id: String,
    pub state: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopTerminalSessionInventorySnapshot {
    pub session_id: String,
    pub title: String,
    pub profile_id: String,
    pub cwd: String,
    pub updated_at: String,
    pub workspace_id: String,
    pub project_id: String,
    pub status: String,
    pub last_exit_code: Option<i32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNativeSessionListRequest {
    pub workspace_id: String,
    pub project_id: String,
    pub project_root: String,
    pub engine_id: Option<String>,
    pub page: Option<usize>,
    pub page_size: Option<usize>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNativeSessionGetRequest {
    pub session_id: String,
    pub workspace_id: String,
    pub project_id: String,
    pub project_root: String,
    pub engine_id: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNativeSessionSummarySnapshot {
    pub id: String,
    pub workspace_id: String,
    pub project_id: String,
    pub title: String,
    pub status: String,
    pub runtime_status: Option<String>,
    pub host_mode: String,
    pub engine_id: String,
    pub model_id: String,
    pub native_session_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub last_turn_at: Option<String>,
    pub transcript_updated_at: Option<String>,
    pub sort_timestamp: String,
    pub kind: String,
    pub native_cwd: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNativeSessionMessageSnapshot {
    pub id: String,
    pub coding_session_id: String,
    pub turn_id: Option<String>,
    pub role: String,
    pub content: String,
    pub commands: Option<Vec<sdkwork_birdcoder_codeengine::CodeEngineSessionCommandRecord>>,
    #[serde(rename = "tool_calls", skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<serde_json::Value>>,
    #[serde(rename = "tool_call_id", skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    pub file_changes: Option<Vec<serde_json::Value>>,
    pub task_progress: Option<serde_json::Value>,
    pub metadata: Option<BTreeMap<String, String>>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNativeSessionDetailSnapshot {
    pub summary: DesktopNativeSessionSummarySnapshot,
    pub messages: Vec<DesktopNativeSessionMessageSnapshot>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNativeSessionPageInfoSnapshot {
    pub has_more: bool,
    pub mode: &'static str,
    pub page: usize,
    pub page_size: usize,
    pub total_items: String,
    pub total_pages: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopNativeSessionPageSnapshot {
    pub items: Vec<DesktopNativeSessionSummarySnapshot>,
    pub page_info: DesktopNativeSessionPageInfoSnapshot,
}

fn normalize_native_session_path_lexically(value: &str) -> Option<String> {
    let replaced = value.trim().replace('\\', "/");
    if replaced.is_empty() {
        return None;
    }
    let normalized = if let Some(unc_path) = replaced.strip_prefix("//?/UNC/") {
        format!("//{unc_path}")
    } else if let Some(drive_path) = replaced.strip_prefix("//?/") {
        drive_path.to_owned()
    } else {
        replaced
    };
    let path = Path::new(&normalized);
    let mut components = Vec::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                components.pop();
            }
            Component::Normal(value) => components.push(value.to_string_lossy().into_owned()),
            Component::Prefix(value) => {
                components.push(value.as_os_str().to_string_lossy().into_owned())
            }
            Component::RootDir => {}
        }
    }
    let prefix = if normalized.starts_with("//") {
        "//"
    } else if normalized.starts_with('/') {
        "/"
    } else {
        ""
    };
    let joined = components.join("/");
    let value = format!("{prefix}{joined}").trim_end_matches('/').to_owned();
    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

fn normalize_native_session_path(path: &Path) -> Option<String> {
    let resolved = path
        .canonicalize()
        .unwrap_or_else(|_| PathBuf::from(path))
        .to_string_lossy()
        .into_owned();
    normalize_native_session_path_lexically(&resolved).map(|value| {
        if cfg!(windows) || value.as_bytes().get(1) == Some(&b':') {
            value.to_ascii_lowercase()
        } else {
            value
        }
    })
}

fn native_session_belongs_to_project(
    summary: &CodeEngineSessionSummaryRecord,
    project_root: &Path,
) -> bool {
    let Some(native_cwd) = summary.native_cwd.as_deref() else {
        return false;
    };
    let Some(normalized_root) = normalize_native_session_path(project_root) else {
        return false;
    };
    let Some(normalized_cwd) = normalize_native_session_path(Path::new(native_cwd)) else {
        return false;
    };
    normalized_cwd == normalized_root
        || normalized_cwd
            .strip_prefix(normalized_root.as_str())
            .is_some_and(|suffix| suffix.starts_with('/'))
}

fn map_native_session_summary(
    summary: CodeEngineSessionSummaryRecord,
    workspace_id: &str,
    project_id: &str,
) -> DesktopNativeSessionSummarySnapshot {
    let native_session_id =
        extract_native_lookup_id_for_engine(&summary.id, &summary.engine_id).ok();
    DesktopNativeSessionSummarySnapshot {
        id: summary.id,
        workspace_id: workspace_id.to_owned(),
        project_id: project_id.to_owned(),
        title: summary.title,
        status: summary.status,
        runtime_status: summary.runtime_status,
        host_mode: summary.host_mode,
        engine_id: summary.engine_id,
        model_id: summary.model_id,
        native_session_id,
        created_at: summary.created_at,
        updated_at: summary.updated_at,
        last_turn_at: summary.last_turn_at,
        transcript_updated_at: summary.transcript_updated_at,
        sort_timestamp: summary.sort_timestamp.to_string(),
        kind: summary.kind,
        native_cwd: summary.native_cwd,
    }
}

fn map_native_session_message(
    message: CodeEngineSessionMessageRecord,
    coding_session_id: &str,
) -> DesktopNativeSessionMessageSnapshot {
    DesktopNativeSessionMessageSnapshot {
        id: message.id,
        coding_session_id: coding_session_id.to_owned(),
        turn_id: message.turn_id,
        role: message.role,
        content: message.content,
        commands: message.commands,
        tool_calls: message.tool_calls,
        tool_call_id: message.tool_call_id,
        file_changes: message.file_changes,
        task_progress: message.task_progress,
        metadata: message.metadata,
        created_at: message.created_at,
    }
}

fn map_native_session_detail(
    detail: CodeEngineSessionDetailRecord,
    workspace_id: &str,
    project_id: &str,
) -> DesktopNativeSessionDetailSnapshot {
    let summary = map_native_session_summary(detail.summary, workspace_id, project_id);
    let coding_session_id = summary.id.clone();
    DesktopNativeSessionDetailSnapshot {
        summary,
        messages: detail
            .messages
            .into_iter()
            .map(|message| map_native_session_message(message, &coding_session_id))
            .collect(),
    }
}

fn require_native_session_scope(value: &str, field: &str) -> Result<String, String> {
    let normalized = value.trim();
    if normalized.is_empty() {
        Err(format!("{field} is required."))
    } else {
        Ok(normalized.to_owned())
    }
}

#[tauri::command]
pub fn desktop_native_session_list(
    request: DesktopNativeSessionListRequest,
) -> Result<DesktopNativeSessionPageSnapshot, String> {
    let workspace_id = require_native_session_scope(&request.workspace_id, "workspaceId")?;
    let project_id = require_native_session_scope(&request.project_id, "projectId")?;
    let project_root =
        crate::commands::filesystem_commands::resolve_root_directory_path(&request.project_root)?;
    let page = request.page.unwrap_or(1).max(1);
    let page_size = request
        .page_size
        .unwrap_or(DEFAULT_NATIVE_SESSION_PAGE_SIZE)
        .clamp(1, MAX_NATIVE_SESSION_PAGE_SIZE);
    let offset = page.saturating_sub(1).saturating_mul(page_size);
    let engine_id = request
        .engine_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let matching_sessions = list_codeengine_native_session_summaries(engine_id)?
        .into_iter()
        .filter(|summary| native_session_belongs_to_project(summary, &project_root))
        .collect::<Vec<_>>();
    let total = matching_sessions.len();
    let items = matching_sessions
        .into_iter()
        .skip(offset)
        .take(page_size)
        .map(|summary| map_native_session_summary(summary, &workspace_id, &project_id))
        .collect();
    let total_pages = total.div_ceil(page_size);
    Ok(DesktopNativeSessionPageSnapshot {
        items,
        page_info: DesktopNativeSessionPageInfoSnapshot {
            has_more: page < total_pages,
            mode: "offset",
            page,
            page_size,
            total_items: total.to_string(),
            total_pages,
        },
    })
}

#[tauri::command]
pub fn desktop_native_session_get(
    request: DesktopNativeSessionGetRequest,
) -> Result<DesktopNativeSessionDetailSnapshot, String> {
    let session_id = require_native_session_scope(&request.session_id, "sessionId")?;
    let workspace_id = require_native_session_scope(&request.workspace_id, "workspaceId")?;
    let project_id = require_native_session_scope(&request.project_id, "projectId")?;
    let project_root =
        crate::commands::filesystem_commands::resolve_root_directory_path(&request.project_root)?;
    let engine_id = request
        .engine_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let detail = get_codeengine_native_session_detail(&session_id, engine_id)?
        .filter(|detail| native_session_belongs_to_project(&detail.summary, &project_root))
        .ok_or_else(|| "Native session was not found in the mounted project.".to_owned())?;
    Ok(map_native_session_detail(
        detail,
        &workspace_id,
        &project_id,
    ))
}

#[tauri::command]
pub fn desktop_session_index(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
) -> Result<DesktopSessionIndexSnapshot, String> {
    state.session_index()
}

#[tauri::command]
pub fn desktop_session_replay_slice(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
    session_id: String,
    from_cursor: Option<String>,
    limit: Option<usize>,
) -> Result<DesktopSessionReplaySnapshot, String> {
    state.session_replay_slice(&session_id, from_cursor, limit)
}

#[tauri::command]
pub fn desktop_session_attach(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
    request: DesktopSessionAttachRequest,
) -> Result<DesktopSessionAttachmentSnapshot, String> {
    state.attach_session(request)
}

#[tauri::command]
pub fn desktop_session_detach(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
    request: DesktopSessionDetachRequest,
) -> Result<DesktopSessionDescriptorSnapshot, String> {
    state.detach_session_attachment(request)
}

#[tauri::command]
pub fn desktop_session_reattach(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
    request: DesktopSessionAttachRequest,
) -> Result<DesktopSessionAttachmentSnapshot, String> {
    state.reattach_session(request)
}

#[tauri::command]
pub fn desktop_terminal_session_inventory_list(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
) -> Result<Vec<DesktopTerminalSessionInventorySnapshot>, String> {
    state.terminal_session_inventory()
}

#[tauri::command]
pub fn desktop_local_shell_exec(
    request: DesktopLocalShellExecRequest,
) -> Result<DesktopLocalShellExecSnapshot, String> {
    crate::host::terminal_runtime::execute_local_shell_command_snapshot(request)
}

#[tauri::command]
pub fn desktop_local_shell_session_create(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
    request: DesktopLocalShellSessionCreateRequest,
) -> Result<DesktopLocalShellSessionCreateSnapshot, String> {
    state.create_local_shell_session(request)
}

#[tauri::command]
pub fn desktop_local_process_session_create(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
    request: DesktopLocalProcessSessionCreateRequest,
) -> Result<DesktopLocalProcessSessionCreateSnapshot, String> {
    state.create_local_process_session(request)
}

#[tauri::command]
pub fn desktop_session_input(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
    request: DesktopLocalShellSessionInputRequest,
) -> Result<DesktopLocalShellSessionInputSnapshot, String> {
    state.write_local_shell_input(request)
}

#[tauri::command]
pub fn desktop_session_input_bytes(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
    request: DesktopLocalShellSessionInputBytesRequest,
) -> Result<DesktopLocalShellSessionInputSnapshot, String> {
    state.write_local_shell_input_bytes(request)
}

#[tauri::command]
pub fn desktop_session_attachment_acknowledge(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
    request: DesktopSessionAttachmentAcknowledgeRequest,
) -> Result<DesktopAttachmentDescriptorSnapshot, String> {
    state.acknowledge_session_attachment(request)
}

#[tauri::command]
pub fn desktop_session_resize(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
    request: DesktopLocalShellSessionResizeRequest,
) -> Result<DesktopLocalShellSessionResizeSnapshot, String> {
    state.resize_local_shell_session(request)
}

#[tauri::command]
pub fn desktop_session_terminate(
    state: tauri::State<'_, crate::host::DesktopTerminalRuntimeState>,
    session_id: String,
) -> Result<DesktopLocalShellSessionTerminateSnapshot, String> {
    state.terminate_local_shell_session(&session_id)
}

#[cfg(test)]
mod tests {
    use super::{
        map_native_session_summary, native_session_belongs_to_project,
        DesktopNativeSessionSummarySnapshot,
    };
    use sdkwork_birdcoder_codeengine::CodeEngineSessionSummaryRecord;
    use std::path::Path;

    fn summary(native_cwd: Option<&str>) -> CodeEngineSessionSummaryRecord {
        CodeEngineSessionSummaryRecord {
            created_at: "2026-07-15T00:00:00.000Z".to_owned(),
            id: "codex-native:thread-1".to_owned(),
            title: "Codex thread".to_owned(),
            status: "active".to_owned(),
            runtime_status: Some("ready".to_owned()),
            host_mode: "desktop".to_owned(),
            engine_id: "codex".to_owned(),
            model_id: "gpt-5".to_owned(),
            updated_at: "2026-07-15T00:01:00.000Z".to_owned(),
            last_turn_at: Some("2026-07-15T00:01:00.000Z".to_owned()),
            kind: "coding".to_owned(),
            native_cwd: native_cwd.map(str::to_owned),
            sort_timestamp: 1_752_537_660_123,
            transcript_updated_at: Some("2026-07-15T00:01:00.000Z".to_owned()),
            workspace_id: None,
            project_id: None,
        }
    }

    #[test]
    fn native_session_scope_accepts_project_and_descendant_directories_only() {
        let project_root = Path::new("C:/workspace/project");
        assert!(native_session_belongs_to_project(
            &summary(Some("C:/workspace/project")),
            project_root,
        ));
        assert!(native_session_belongs_to_project(
            &summary(Some("C:/workspace/project/packages/app")),
            project_root,
        ));
        assert!(!native_session_belongs_to_project(
            &summary(Some("C:/workspace/project-other")),
            project_root,
        ));
        assert!(!native_session_belongs_to_project(
            &summary(None),
            project_root,
        ));
    }

    #[test]
    fn native_session_summary_preserves_thread_identity_and_lossless_timestamp() {
        let mapped: DesktopNativeSessionSummarySnapshot = map_native_session_summary(
            summary(Some("C:/workspace/project")),
            "workspace-1",
            "project-1",
        );
        assert_eq!(mapped.id, "codex-native:thread-1");
        assert_eq!(mapped.native_session_id.as_deref(), Some("thread-1"));
        assert_eq!(mapped.workspace_id, "workspace-1");
        assert_eq!(mapped.project_id, "project-1");
        assert_eq!(mapped.sort_timestamp, "1752537660123");
    }
}
