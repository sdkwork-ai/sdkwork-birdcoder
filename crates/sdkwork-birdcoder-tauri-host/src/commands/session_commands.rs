use serde::{Deserialize, Serialize};

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
