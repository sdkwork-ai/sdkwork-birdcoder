use sdkwork_birdcoder_tauri_host as host;
use tauri::Manager;

#[tauri::command]
fn host_mode() -> &'static str {
    host::host_mode()
}

#[tauri::command]
async fn desktop_runtime_config(
    app: tauri::AppHandle,
) -> Result<host::DesktopRuntimeConfig, String> {
    host::desktop_runtime_config(app).await
}

#[tauri::command]
async fn local_store_get(
    app: tauri::AppHandle,
    scope: String,
    key: String,
) -> Result<Option<String>, String> {
    host::local_store_get(app, scope, key).await
}

#[tauri::command]
async fn local_store_set(
    app: tauri::AppHandle,
    scope: String,
    key: String,
    value: String,
) -> Result<(), String> {
    host::local_store_set(app, scope, key, value).await
}

#[tauri::command]
async fn local_store_delete(
    app: tauri::AppHandle,
    scope: String,
    key: String,
) -> Result<(), String> {
    host::local_store_delete(app, scope, key).await
}

#[tauri::command]
async fn local_store_list(
    app: tauri::AppHandle,
    scope: String,
) -> Result<Vec<host::LocalStoreEntry>, String> {
    host::local_store_list(app, scope).await
}

#[tauri::command]
async fn local_sql_execute_plan(
    app: tauri::AppHandle,
    plan: host::LocalSqlPlan,
) -> Result<host::LocalSqlExecutionResult, String> {
    host::local_sql_execute_plan(app, plan).await
}

#[tauri::command]
async fn fs_snapshot_folder(
    root_path: String,
    max_nodes: Option<usize>,
) -> Result<host::FileSystemSnapshotResponse, String> {
    host::fs_snapshot_folder(root_path, max_nodes).await
}

#[tauri::command]
async fn fs_list_directory(
    root_path: String,
    relative_path: Option<String>,
) -> Result<host::FileSystemDirectoryListingResponse, String> {
    host::fs_list_directory(root_path, relative_path).await
}

#[tauri::command]
async fn fs_read_file(
    root_path: String,
    relative_path: String,
    max_bytes: Option<usize>,
) -> Result<String, String> {
    host::fs_read_file(root_path, relative_path, max_bytes).await
}

#[tauri::command]
async fn fs_get_file_revision(root_path: String, relative_path: String) -> Result<String, String> {
    host::fs_get_file_revision(root_path, relative_path).await
}

#[tauri::command]
async fn fs_get_file_revisions(
    root_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<host::FileSystemFileRevisionProbeResponse>, String> {
    host::fs_get_file_revisions(root_path, relative_paths).await
}

#[tauri::command]
async fn fs_get_directory_revisions(
    root_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<host::FileSystemFileRevisionProbeResponse>, String> {
    host::fs_get_directory_revisions(root_path, relative_paths).await
}

#[tauri::command]
fn fs_watch_start(
    app: tauri::AppHandle,
    state: tauri::State<'_, host::FileSystemWatchState>,
    root_path: String,
) -> Result<host::FileSystemWatchRegistration, String> {
    host::fs_watch_start(app, state, root_path)
}

#[tauri::command]
fn fs_watch_stop(
    state: tauri::State<'_, host::FileSystemWatchState>,
    watch_id: String,
) -> Result<(), String> {
    host::fs_watch_stop(state, watch_id)
}

#[tauri::command]
async fn fs_write_file(
    root_path: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    host::fs_write_file(root_path, relative_path, content).await
}

#[tauri::command]
async fn fs_create_file(root_path: String, relative_path: String) -> Result<(), String> {
    host::fs_create_file(root_path, relative_path).await
}

#[tauri::command]
async fn fs_create_directory(root_path: String, relative_path: String) -> Result<(), String> {
    host::fs_create_directory(root_path, relative_path).await
}

#[tauri::command]
async fn fs_delete_entry(
    root_path: String,
    relative_path: String,
    recursive: bool,
) -> Result<(), String> {
    host::fs_delete_entry(root_path, relative_path, recursive).await
}

#[tauri::command]
async fn fs_rename_entry(
    root_path: String,
    old_relative_path: String,
    new_relative_path: String,
) -> Result<(), String> {
    host::fs_rename_entry(root_path, old_relative_path, new_relative_path).await
}

#[tauri::command]
async fn user_home_config_read(relative_path: String) -> Result<Option<String>, String> {
    host::user_home_config_read(relative_path).await
}

#[tauri::command]
async fn user_home_config_write(relative_path: String, content: String) -> Result<(), String> {
    host::user_home_config_write(relative_path, content).await
}

#[tauri::command]
async fn terminal_cli_profile_detect(
    request: host::TerminalCliProfileDetectRequest,
) -> Result<host::TerminalCliProfileAvailability, String> {
    host::terminal_cli_profile_detect(request).await
}

#[tauri::command]
async fn desktop_pick_working_directory(
    window: tauri::Window,
    request: host::DesktopWorkingDirectoryPickerRequest,
) -> Result<Option<String>, String> {
    host::desktop_pick_working_directory(window, request).await
}

#[tauri::command]
async fn desktop_reveal_in_file_manager(path: String) -> Result<(), String> {
    host::desktop_reveal_in_file_manager(path).await
}

#[tauri::command]
fn desktop_window_controls_bridge_capabilities() -> host::NativeWindowControlsBridgeCapabilities {
    host::desktop_window_controls_bridge_capabilities()
}

#[tauri::command]
fn desktop_configure_window_controls_bridge(
    window: tauri::WebviewWindow,
    config: host::NativeWindowControlsBridgeConfig,
) -> Result<(), String> {
    host::desktop_configure_window_controls_bridge(window, config)
}

#[tauri::command]
fn desktop_perform_window_control_action(
    window: tauri::WebviewWindow,
    action: host::NativeWindowControlAction,
) -> Result<(), String> {
    host::desktop_perform_window_control_action(window, action)
}

#[tauri::command]
fn desktop_session_index(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
) -> Result<host::DesktopSessionIndexSnapshot, String> {
    host::desktop_session_index(state)
}

#[tauri::command]
fn desktop_session_replay_slice(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
    session_id: String,
    from_cursor: Option<String>,
    limit: Option<usize>,
) -> Result<host::DesktopSessionReplaySnapshot, String> {
    host::desktop_session_replay_slice(state, session_id, from_cursor, limit)
}

#[tauri::command]
fn desktop_session_attach(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
    request: host::DesktopSessionAttachRequest,
) -> Result<host::DesktopSessionAttachmentSnapshot, String> {
    host::desktop_session_attach(state, request)
}

#[tauri::command]
fn desktop_session_detach(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
    request: host::DesktopSessionDetachRequest,
) -> Result<host::DesktopSessionDescriptorSnapshot, String> {
    host::desktop_session_detach(state, request)
}

#[tauri::command]
fn desktop_session_reattach(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
    request: host::DesktopSessionAttachRequest,
) -> Result<host::DesktopSessionAttachmentSnapshot, String> {
    host::desktop_session_reattach(state, request)
}

#[tauri::command]
fn desktop_terminal_session_inventory_list(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
) -> Result<Vec<host::DesktopTerminalSessionInventorySnapshot>, String> {
    host::desktop_terminal_session_inventory_list(state)
}

#[tauri::command]
async fn desktop_local_shell_exec(
    request: host::DesktopLocalShellExecRequest,
) -> Result<host::DesktopLocalShellExecSnapshot, String> {
    tauri::async_runtime::spawn_blocking(move || host::desktop_local_shell_exec(request))
        .await
        .map_err(|error| format!("desktop local shell worker failed: {error}"))?
}

#[tauri::command]
fn desktop_local_shell_session_create(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
    request: host::DesktopLocalShellSessionCreateRequest,
) -> Result<host::DesktopLocalShellSessionCreateSnapshot, String> {
    host::desktop_local_shell_session_create(state, request)
}

#[tauri::command]
fn desktop_local_process_session_create(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
    request: host::DesktopLocalProcessSessionCreateRequest,
) -> Result<host::DesktopLocalProcessSessionCreateSnapshot, String> {
    host::desktop_local_process_session_create(state, request)
}

#[tauri::command]
fn desktop_session_input(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
    request: host::DesktopLocalShellSessionInputRequest,
) -> Result<host::DesktopLocalShellSessionInputSnapshot, String> {
    host::desktop_session_input(state, request)
}

#[tauri::command]
fn desktop_session_input_bytes(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
    request: host::DesktopLocalShellSessionInputBytesRequest,
) -> Result<host::DesktopLocalShellSessionInputSnapshot, String> {
    host::desktop_session_input_bytes(state, request)
}

#[tauri::command]
fn desktop_session_attachment_acknowledge(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
    request: host::DesktopSessionAttachmentAcknowledgeRequest,
) -> Result<host::DesktopAttachmentDescriptorSnapshot, String> {
    host::desktop_session_attachment_acknowledge(state, request)
}

#[tauri::command]
fn desktop_session_resize(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
    request: host::DesktopLocalShellSessionResizeRequest,
) -> Result<host::DesktopLocalShellSessionResizeSnapshot, String> {
    host::desktop_session_resize(state, request)
}

#[tauri::command]
fn desktop_session_terminate(
    state: tauri::State<'_, host::DesktopTerminalRuntimeState>,
    session_id: String,
) -> Result<host::DesktopLocalShellSessionTerminateSnapshot, String> {
    host::desktop_session_terminate(state, session_id)
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(host::FileSystemWatchState::new());
            host::setup_tauri_host(app.handle())?;
            host::spawn_embedded_coding_server_startup(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            host_mode,
            desktop_runtime_config,
            local_store_get,
            local_store_set,
            local_store_delete,
            local_store_list,
            local_sql_execute_plan,
            fs_snapshot_folder,
            fs_list_directory,
            fs_read_file,
            fs_get_file_revision,
            fs_get_file_revisions,
            fs_get_directory_revisions,
            fs_watch_start,
            fs_watch_stop,
            fs_write_file,
            fs_create_file,
            fs_create_directory,
            fs_delete_entry,
            fs_rename_entry,
            user_home_config_read,
            user_home_config_write,
            terminal_cli_profile_detect,
            desktop_pick_working_directory,
            desktop_reveal_in_file_manager,
            desktop_window_controls_bridge_capabilities,
            desktop_configure_window_controls_bridge,
            desktop_perform_window_control_action,
            desktop_session_index,
            desktop_session_replay_slice,
            desktop_session_attach,
            desktop_session_detach,
            desktop_session_reattach,
            desktop_terminal_session_inventory_list,
            desktop_local_shell_exec,
            desktop_local_shell_session_create,
            desktop_local_process_session_create,
            desktop_session_input,
            desktop_session_input_bytes,
            desktop_session_attachment_acknowledge,
            desktop_session_resize,
            desktop_session_terminate,
        ])
        .build(tauri::generate_context!())
        .expect("failed to build SDKWork BirdCoder desktop")
        .run(|_app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                host::request_embedded_api_shutdown();
            }
        });
}
