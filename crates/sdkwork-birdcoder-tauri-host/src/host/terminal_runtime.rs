use crate::commands::session_commands::{
    DesktopAttachmentDescriptorSnapshot, DesktopLocalProcessSessionCreateRequest,
    DesktopLocalProcessSessionCreateSnapshot, DesktopLocalShellExecRequest,
    DesktopLocalShellExecSnapshot, DesktopLocalShellSessionCreateRequest,
    DesktopLocalShellSessionCreateSnapshot, DesktopLocalShellSessionInputBytesRequest,
    DesktopLocalShellSessionInputRequest, DesktopLocalShellSessionInputSnapshot,
    DesktopLocalShellSessionResizeRequest, DesktopLocalShellSessionResizeSnapshot,
    DesktopLocalShellSessionTerminateSnapshot, DesktopReplayEntrySnapshot,
    DesktopSessionAttachRequest, DesktopSessionAttachmentAcknowledgeRequest,
    DesktopSessionAttachmentSnapshot, DesktopSessionDescriptorSnapshot,
    DesktopSessionDetachRequest, DesktopSessionIndexSnapshot, DesktopSessionReplaySnapshot,
    DesktopTerminalSessionInventorySnapshot,
};
use sdkwork_terminal_control_plane::{
    create_desktop_session_runtime, DESKTOP_SESSION_RUNTIME_DB_FILE_NAME,
};
use sdkwork_terminal_protocol::LOCAL_RUNTIME_NAMESPACE;
use sdkwork_terminal_pty_runtime::{
    create_session_event_channel, execute_local_shell_command, LocalShellExecutionRequest,
    LocalShellSessionCreateRequest, LocalShellSessionEvent, LocalShellSessionRuntime,
    PtyProcessLaunchCommand, PtyProcessSessionCreateRequest,
};
use sdkwork_terminal_replay_store::{ReplayEntry, ReplayEventKind};
use sdkwork_terminal_session_runtime::{
    AttachmentRecord, SessionCreateRequest, SessionRecord, SessionRuntime, SessionState,
};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

const DEFAULT_REPLAY_LIMIT: usize = 32;
const MAX_REPLAY_LIMIT: usize = 512;
const MAX_SESSION_INDEX_ITEMS: usize = 500;
const MAX_TERMINAL_INVENTORY_ITEMS: usize = 200;
const MAX_SESSION_INPUT_BYTES: usize = 1024 * 1024;
const MAX_COMMAND_TEXT_BYTES: usize = 64 * 1024;
const MAX_COMMAND_ARGUMENTS: usize = 128;
const MAX_COMMAND_ARGUMENT_BYTES: usize = 32 * 1024;
const MAX_METADATA_BYTES: usize = 1024;
const MAX_WORKING_DIRECTORY_BYTES: usize = 32 * 1024;
const MAX_PTY_DIMENSION: u16 = 1000;
const MAX_REPLAY_PAYLOAD_BYTES: usize = 1024 * 1024;
const MAX_EXEC_OUTPUT_BYTES: usize = 2 * 1024 * 1024;
const MAX_SHUTDOWN_DRAIN_EVENTS: usize = 1_024;
const TERMINAL_EVENT_THREAD_POLL_INTERVAL: Duration = Duration::from_millis(250);
const TRUNCATION_SUFFIX: &str = "\n[BirdCoder terminal output truncated]";

pub struct DesktopTerminalRuntimeState {
    session_runtime: Arc<Mutex<SessionRuntime>>,
    local_shell_runtime: LocalShellSessionRuntime,
    local_shell_event_sender: mpsc::SyncSender<LocalShellSessionEvent>,
    shutdown_requested: Arc<AtomicBool>,
    event_thread: Option<thread::JoinHandle<()>>,
}

impl DesktopTerminalRuntimeState {
    pub fn new(app_handle: tauri::AppHandle) -> Result<Self, String> {
        let database_path = resolve_session_runtime_db_path(&app_handle)?;
        let runtime = create_desktop_session_runtime(Some(&database_path))?;
        Self::build(Some(app_handle), runtime)
    }

    fn build(
        app_handle: Option<tauri::AppHandle>,
        session_runtime: SessionRuntime,
    ) -> Result<Self, String> {
        let session_runtime = Arc::new(Mutex::new(session_runtime));
        let local_shell_runtime = if cfg!(windows) {
            LocalShellSessionRuntime::with_synthetic_probe_responses()
        } else {
            LocalShellSessionRuntime::default()
        };
        let (local_shell_event_sender, local_shell_event_receiver) = create_session_event_channel();
        let shutdown_requested = Arc::new(AtomicBool::new(false));
        let session_runtime_for_events = Arc::clone(&session_runtime);
        let shutdown_requested_for_events = Arc::clone(&shutdown_requested);

        let event_thread = thread::Builder::new()
            .name("birdcoder-terminal-events".to_string())
            .spawn(move || {
                run_terminal_event_loop(
                    app_handle,
                    session_runtime_for_events,
                    local_shell_event_receiver,
                    shutdown_requested_for_events,
                );
            })
            .map_err(|error| format!("failed to start BirdCoder terminal event loop: {error}"))?;

        Ok(Self {
            session_runtime,
            local_shell_runtime,
            local_shell_event_sender,
            shutdown_requested,
            event_thread: Some(event_thread),
        })
    }

    pub fn session_index(&self) -> Result<DesktopSessionIndexSnapshot, String> {
        let runtime = self.lock_runtime()?;
        let mut sessions = runtime.list_sessions();
        if sessions.len() > MAX_SESSION_INDEX_ITEMS {
            sessions = sessions.split_off(sessions.len() - MAX_SESSION_INDEX_ITEMS);
        }
        let included_session_ids = sessions
            .iter()
            .map(|session| session.session_id.clone())
            .collect::<HashSet<_>>();

        Ok(DesktopSessionIndexSnapshot {
            sessions: sessions
                .into_iter()
                .map(map_session_descriptor_snapshot)
                .collect(),
            attachments: runtime
                .list_attachments()
                .into_iter()
                .filter(|attachment| included_session_ids.contains(&attachment.session_id))
                .map(map_attachment_descriptor_snapshot)
                .collect(),
        })
    }

    pub fn session_replay_slice(
        &self,
        session_id: &str,
        from_cursor: Option<String>,
        limit: Option<usize>,
    ) -> Result<DesktopSessionReplaySnapshot, String> {
        validate_required_text("session id", session_id, MAX_METADATA_BYTES)?;
        let runtime = self.lock_runtime()?;
        let replay = runtime
            .replay(
                session_id,
                from_cursor.as_deref(),
                normalize_replay_limit(limit),
            )
            .map_err(|error| error.to_string())?;

        Ok(DesktopSessionReplaySnapshot {
            session_id: replay.session_id,
            from_cursor: replay.from_cursor,
            next_cursor: replay.next_cursor,
            has_more: replay.has_more,
            entries: replay
                .entries
                .into_iter()
                .map(map_replay_entry_snapshot)
                .collect(),
        })
    }

    pub fn attach_session(
        &self,
        request: DesktopSessionAttachRequest,
    ) -> Result<DesktopSessionAttachmentSnapshot, String> {
        validate_required_text("session id", &request.session_id, MAX_METADATA_BYTES)?;
        let mut runtime = self.lock_runtime()?;
        let attachment = runtime
            .attach(&request.session_id)
            .map_err(|error| error.to_string())?;
        let session = runtime
            .list_sessions()
            .into_iter()
            .find(|session| session.session_id == request.session_id)
            .ok_or_else(|| "terminal session is unavailable".to_string())?;

        Ok(DesktopSessionAttachmentSnapshot {
            session: map_session_descriptor_snapshot(session),
            attachment: map_attachment_descriptor_snapshot(attachment),
        })
    }

    pub fn detach_session_attachment(
        &self,
        request: DesktopSessionDetachRequest,
    ) -> Result<DesktopSessionDescriptorSnapshot, String> {
        validate_required_text("attachment id", &request.attachment_id, MAX_METADATA_BYTES)?;
        let session = self
            .lock_runtime()?
            .detach(&request.attachment_id)
            .map_err(|error| error.to_string())?;

        Ok(map_session_descriptor_snapshot(session))
    }

    pub fn reattach_session(
        &self,
        request: DesktopSessionAttachRequest,
    ) -> Result<DesktopSessionAttachmentSnapshot, String> {
        validate_required_text("session id", &request.session_id, MAX_METADATA_BYTES)?;
        let result = self
            .lock_runtime()?
            .reattach(&request.session_id)
            .map_err(|error| error.to_string())?;

        Ok(DesktopSessionAttachmentSnapshot {
            session: map_session_descriptor_snapshot(result.session),
            attachment: map_attachment_descriptor_snapshot(result.attachment),
        })
    }

    pub fn terminal_session_inventory(
        &self,
    ) -> Result<Vec<DesktopTerminalSessionInventorySnapshot>, String> {
        let mut sessions = self.lock_runtime()?.list_sessions();
        sessions.sort_by(|left, right| {
            right
                .last_active_at
                .cmp(&left.last_active_at)
                .then_with(|| right.session_id.cmp(&left.session_id))
        });
        sessions.truncate(MAX_TERMINAL_INVENTORY_ITEMS);

        Ok(sessions
            .into_iter()
            .map(map_terminal_session_inventory_snapshot)
            .collect())
    }

    pub fn create_local_shell_session(
        &self,
        request: DesktopLocalShellSessionCreateRequest,
    ) -> Result<DesktopLocalShellSessionCreateSnapshot, String> {
        let DesktopLocalShellSessionCreateRequest {
            profile,
            working_directory,
            cols,
            rows,
            title,
            profile_id,
            workspace_id,
            project_id,
        } = request;
        validate_required_text("terminal profile", &profile, MAX_METADATA_BYTES)?;
        validate_optional_text(
            "working directory",
            working_directory.as_deref(),
            MAX_WORKING_DIRECTORY_BYTES,
        )?;
        validate_session_metadata(
            title.as_deref(),
            profile_id.as_deref(),
            workspace_id.as_deref(),
            project_id.as_deref(),
        )?;
        let occurred_at = current_occurred_at();
        let resolved_profile_tag = normalize_optional_metadata(profile_id.as_deref())
            .unwrap_or_else(|| profile.trim().to_lowercase());
        let resolved_workspace_id = normalize_optional_metadata(workspace_id.as_deref())
            .unwrap_or_else(|| "workspace-local".to_string());
        let mut tags = vec![format!("profile:{resolved_profile_tag}")];
        push_optional_tag(&mut tags, "project", project_id.as_deref());
        push_optional_tag(&mut tags, "title", title.as_deref());
        push_optional_tag(&mut tags, "cwd", working_directory.as_deref());
        let (cols, rows) = normalize_pty_dimensions(cols, rows)?;
        let (session, attachment) =
            self.create_runtime_session(resolved_workspace_id, "local-shell".to_string(), tags)?;

        let bootstrap = match self.local_shell_runtime.create_session(
            LocalShellSessionCreateRequest {
                session_id: session.session_id.clone(),
                profile,
                working_directory,
                cols,
                rows,
            },
            self.local_shell_event_sender.clone(),
        ) {
            Ok(value) => value,
            Err(error) => {
                self.record_session_start_failure(
                    &session.session_id,
                    &error.to_string(),
                    &occurred_at,
                )?;
                return Err(error.to_string());
            }
        };

        Ok(DesktopLocalShellSessionCreateSnapshot {
            session_id: session.session_id,
            workspace_id: session.workspace_id,
            target: session.target,
            state: session_state_label(&session.state).to_string(),
            created_at: session.created_at,
            last_active_at: session.last_active_at,
            mode_tags: session.mode_tags,
            tags: session.tags,
            attachment_id: attachment.attachment_id,
            cursor: attachment.cursor,
            last_ack_sequence: attachment.last_ack_sequence,
            writable: attachment.writable,
            profile: bootstrap.profile,
            working_directory: bootstrap.working_directory,
            invoked_program: bootstrap.invoked_program,
        })
    }

    pub fn create_local_process_session(
        &self,
        request: DesktopLocalProcessSessionCreateRequest,
    ) -> Result<DesktopLocalProcessSessionCreateSnapshot, String> {
        let DesktopLocalProcessSessionCreateRequest {
            command,
            working_directory,
            cols,
            rows,
            title,
            profile_id,
            workspace_id,
            project_id,
        } = request;
        validate_process_command(&command)?;
        validate_optional_text(
            "working directory",
            working_directory.as_deref(),
            MAX_WORKING_DIRECTORY_BYTES,
        )?;
        validate_session_metadata(
            title.as_deref(),
            profile_id.as_deref(),
            workspace_id.as_deref(),
            project_id.as_deref(),
        )?;
        let program = command
            .first()
            .map(String::as_str)
            .expect("validated process command must include a program");
        let occurred_at = current_occurred_at();
        let program_target = derive_local_process_target(program);
        let target = normalize_optional_metadata(profile_id.as_deref())
            .unwrap_or_else(|| program_target.clone());
        let resolved_workspace_id = normalize_optional_metadata(workspace_id.as_deref())
            .unwrap_or_else(|| "workspace-local".to_string());
        let mut tags = vec![
            "launcher:local-process".to_string(),
            format!("program:{program_target}"),
        ];
        push_optional_tag(&mut tags, "profile", profile_id.as_deref());
        push_optional_tag(&mut tags, "project", project_id.as_deref());
        push_optional_tag(&mut tags, "title", title.as_deref());
        push_optional_tag(&mut tags, "cwd", working_directory.as_deref());
        let (cols, rows) = normalize_pty_dimensions(cols, rows)?;
        let (session, attachment) =
            self.create_runtime_session(resolved_workspace_id, target, tags)?;

        let bootstrap = match self.local_shell_runtime.create_process_session(
            PtyProcessSessionCreateRequest {
                session_id: session.session_id.clone(),
                command: PtyProcessLaunchCommand {
                    program: program.to_string(),
                    args: command.into_iter().skip(1).collect(),
                },
                working_directory,
                cols,
                rows,
            },
            self.local_shell_event_sender.clone(),
        ) {
            Ok(value) => value,
            Err(error) => {
                self.record_session_start_failure(
                    &session.session_id,
                    &error.to_string(),
                    &occurred_at,
                )?;
                return Err(error.to_string());
            }
        };

        Ok(DesktopLocalProcessSessionCreateSnapshot {
            session_id: session.session_id,
            workspace_id: session.workspace_id,
            target: session.target,
            state: session_state_label(&session.state).to_string(),
            created_at: session.created_at,
            last_active_at: session.last_active_at,
            mode_tags: session.mode_tags,
            tags: session.tags,
            attachment_id: attachment.attachment_id,
            cursor: attachment.cursor,
            last_ack_sequence: attachment.last_ack_sequence,
            writable: attachment.writable,
            working_directory: bootstrap.working_directory,
            invoked_program: bootstrap.invoked_program,
            invoked_args: bootstrap.invoked_args,
        })
    }

    pub fn write_local_shell_input(
        &self,
        request: DesktopLocalShellSessionInputRequest,
    ) -> Result<DesktopLocalShellSessionInputSnapshot, String> {
        validate_required_text("session id", &request.session_id, MAX_METADATA_BYTES)?;
        validate_session_input(request.input.as_bytes())?;
        let accepted_bytes = self
            .local_shell_runtime
            .write_input(&request.session_id, &request.input)
            .map_err(|error| error.to_string())?;

        Ok(DesktopLocalShellSessionInputSnapshot {
            session_id: request.session_id,
            accepted_bytes,
        })
    }

    pub fn write_local_shell_input_bytes(
        &self,
        request: DesktopLocalShellSessionInputBytesRequest,
    ) -> Result<DesktopLocalShellSessionInputSnapshot, String> {
        validate_required_text("session id", &request.session_id, MAX_METADATA_BYTES)?;
        validate_session_input(&request.input_bytes)?;
        let accepted_bytes = self
            .local_shell_runtime
            .write_input_bytes(&request.session_id, &request.input_bytes)
            .map_err(|error| error.to_string())?;

        Ok(DesktopLocalShellSessionInputSnapshot {
            session_id: request.session_id,
            accepted_bytes,
        })
    }

    pub fn acknowledge_session_attachment(
        &self,
        request: DesktopSessionAttachmentAcknowledgeRequest,
    ) -> Result<DesktopAttachmentDescriptorSnapshot, String> {
        validate_required_text("attachment id", &request.attachment_id, MAX_METADATA_BYTES)?;
        let attachment = self
            .lock_runtime()?
            .acknowledge(&request.attachment_id, request.sequence)
            .map_err(|error| error.to_string())?;

        Ok(map_attachment_descriptor_snapshot(attachment))
    }

    pub fn resize_local_shell_session(
        &self,
        request: DesktopLocalShellSessionResizeRequest,
    ) -> Result<DesktopLocalShellSessionResizeSnapshot, String> {
        validate_required_text("session id", &request.session_id, MAX_METADATA_BYTES)?;
        let (cols, rows) = normalize_pty_dimensions(Some(request.cols), Some(request.rows))?;
        self.local_shell_runtime
            .resize_session(&request.session_id, cols, rows)
            .map_err(|error| error.to_string())?;

        Ok(DesktopLocalShellSessionResizeSnapshot {
            session_id: request.session_id,
            cols,
            rows,
        })
    }

    pub fn terminate_local_shell_session(
        &self,
        session_id: &str,
    ) -> Result<DesktopLocalShellSessionTerminateSnapshot, String> {
        validate_required_text("session id", session_id, MAX_METADATA_BYTES)?;
        self.local_shell_runtime
            .terminate_session(session_id)
            .map_err(|error| error.to_string())?;
        let session = self
            .lock_runtime()?
            .mark_stopping(session_id, &current_occurred_at())
            .map_err(|error| error.to_string())?;

        Ok(DesktopLocalShellSessionTerminateSnapshot {
            session_id: session.session_id,
            state: session_state_label(&session.state).to_string(),
        })
    }

    fn create_runtime_session(
        &self,
        workspace_id: String,
        target: String,
        tags: Vec<String>,
    ) -> Result<(SessionRecord, AttachmentRecord), String> {
        let mut runtime = self.lock_runtime()?;
        let session = runtime.create_session(SessionCreateRequest {
            workspace_id,
            target,
            mode_tags: vec!["cli-native".to_string()],
            tags,
            launch_intent: None,
        });
        let attachment = runtime
            .attach(&session.session_id)
            .map_err(|error| error.to_string())?;
        Ok((session, attachment))
    }

    fn record_session_start_failure(
        &self,
        session_id: &str,
        message: &str,
        occurred_at: &str,
    ) -> Result<(), String> {
        let mut runtime = self.lock_runtime()?;
        let message = truncate_utf8(message.to_string(), MAX_REPLAY_PAYLOAD_BYTES);
        let _ = runtime.record_replay_event(
            session_id,
            ReplayEventKind::Warning,
            &message,
            occurred_at,
        );
        runtime
            .fail(session_id, occurred_at)
            .map(|_| ())
            .map_err(|error| error.to_string())
    }

    fn lock_runtime(&self) -> Result<std::sync::MutexGuard<'_, SessionRuntime>, String> {
        self.session_runtime
            .lock()
            .map_err(|_| "terminal session runtime is unavailable".to_string())
    }
}

impl Drop for DesktopTerminalRuntimeState {
    fn drop(&mut self) {
        let active_session_ids = self
            .session_runtime
            .lock()
            .map(|runtime| {
                runtime
                    .list_sessions()
                    .into_iter()
                    .filter(|session| {
                        !matches!(session.state, SessionState::Exited | SessionState::Failed)
                    })
                    .map(|session| session.session_id)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        for session_id in active_session_ids {
            let _ = self.local_shell_runtime.terminate_session(&session_id);
        }
        self.shutdown_requested.store(true, Ordering::Release);
        if let Some(event_thread) = self.event_thread.take() {
            let _ = event_thread.join();
        }
    }
}

pub fn execute_local_shell_command_snapshot(
    request: DesktopLocalShellExecRequest,
) -> Result<DesktopLocalShellExecSnapshot, String> {
    validate_required_text(
        "terminal command",
        &request.command_text,
        MAX_COMMAND_TEXT_BYTES,
    )?;
    validate_required_text("terminal profile", &request.profile, MAX_METADATA_BYTES)?;
    validate_optional_text(
        "working directory",
        request.working_directory.as_deref(),
        MAX_WORKING_DIRECTORY_BYTES,
    )?;
    let result = execute_local_shell_command(LocalShellExecutionRequest {
        profile: request.profile,
        command: request.command_text,
        working_directory: request.working_directory,
    })
    .map_err(|error| error.to_string())?;

    Ok(DesktopLocalShellExecSnapshot {
        profile: result.profile,
        command_text: result.command,
        working_directory: result.working_directory,
        invoked_program: result.invoked_program,
        exit_code: result.exit_code,
        stdout: truncate_utf8(result.stdout, MAX_EXEC_OUTPUT_BYTES),
        stderr: truncate_utf8(result.stderr, MAX_EXEC_OUTPUT_BYTES),
    })
}

fn run_terminal_event_loop(
    app_handle: Option<tauri::AppHandle>,
    session_runtime: Arc<Mutex<SessionRuntime>>,
    event_receiver: mpsc::Receiver<LocalShellSessionEvent>,
    shutdown_requested: Arc<AtomicBool>,
) {
    let mut shutdown_drain_events = 0_usize;
    loop {
        let event = if shutdown_requested.load(Ordering::Acquire) {
            if shutdown_drain_events >= MAX_SHUTDOWN_DRAIN_EVENTS {
                break;
            }
            match event_receiver.try_recv() {
                Ok(event) => {
                    shutdown_drain_events += 1;
                    event
                }
                Err(mpsc::TryRecvError::Empty | mpsc::TryRecvError::Disconnected) => break,
            }
        } else {
            match event_receiver.recv_timeout(TERMINAL_EVENT_THREAD_POLL_INTERVAL) {
                Ok(event) => event,
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        };
        let occurred_at = current_occurred_at();
        let Ok(mut runtime) = session_runtime.lock() else {
            continue;
        };
        let runtime_event = match event {
            LocalShellSessionEvent::Output {
                session_id,
                payload,
            } => {
                let payload = truncate_utf8(payload, MAX_REPLAY_PAYLOAD_BYTES);
                runtime
                    .record_output(&session_id, &payload, &occurred_at)
                    .ok()
                    .map(|entry| {
                        (
                            build_local_shell_runtime_event_name("session.output"),
                            build_local_shell_stream_event_snapshot(entry),
                        )
                    })
            }
            LocalShellSessionEvent::Warning {
                session_id,
                message,
            } => {
                let message = truncate_utf8(message, MAX_REPLAY_PAYLOAD_BYTES);
                runtime
                    .record_replay_event(
                        &session_id,
                        ReplayEventKind::Warning,
                        &message,
                        &occurred_at,
                    )
                    .ok()
                    .map(|entry| {
                        (
                            build_local_shell_runtime_event_name("session.warning"),
                            build_local_shell_stream_event_snapshot(entry),
                        )
                    })
            }
            LocalShellSessionEvent::Exit {
                session_id,
                exit_code,
            } => {
                let payload = serde_json::json!({ "exitCode": exit_code }).to_string();
                let runtime_event = runtime
                    .record_replay_event(&session_id, ReplayEventKind::Exit, &payload, &occurred_at)
                    .ok()
                    .map(|entry| {
                        (
                            build_local_shell_runtime_event_name("session.exit"),
                            build_local_shell_stream_event_snapshot(entry),
                        )
                    });
                let _ = runtime.terminate(&session_id, exit_code);
                runtime_event
            }
        };
        drop(runtime);

        if let (Some(app_handle), Some((event_name, payload))) =
            (app_handle.as_ref(), runtime_event)
        {
            let _ = app_handle.emit(&event_name, payload);
        }
    }
}

fn resolve_session_runtime_db_path(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    app_handle
        .path()
        .app_local_data_dir()
        .map(|directory| directory.join(DESKTOP_SESSION_RUNTIME_DB_FILE_NAME))
        .map_err(|error| format!("failed to resolve terminal runtime data directory: {error}"))
}

fn map_session_descriptor_snapshot(session: SessionRecord) -> DesktopSessionDescriptorSnapshot {
    DesktopSessionDescriptorSnapshot {
        session_id: session.session_id,
        workspace_id: session.workspace_id,
        target: session.target,
        state: session_state_label(&session.state).to_string(),
        created_at: session.created_at,
        last_active_at: session.last_active_at,
        mode_tags: session.mode_tags,
        tags: session.tags,
    }
}

fn map_attachment_descriptor_snapshot(
    attachment: AttachmentRecord,
) -> DesktopAttachmentDescriptorSnapshot {
    DesktopAttachmentDescriptorSnapshot {
        attachment_id: attachment.attachment_id,
        session_id: attachment.session_id,
        cursor: attachment.cursor,
        last_ack_sequence: attachment.last_ack_sequence,
        writable: attachment.writable,
    }
}

fn map_replay_entry_snapshot(entry: ReplayEntry) -> DesktopReplayEntrySnapshot {
    DesktopReplayEntrySnapshot {
        sequence: entry.sequence,
        kind: entry.kind.as_str().to_string(),
        payload: entry.payload,
        occurred_at: entry.occurred_at,
    }
}

fn map_terminal_session_inventory_snapshot(
    session: SessionRecord,
) -> DesktopTerminalSessionInventorySnapshot {
    let profile_id =
        session_tag_value(&session.tags, "profile").unwrap_or_else(|| session.target.clone());
    let title = session_tag_value(&session.tags, "title")
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| profile_id.clone());

    DesktopTerminalSessionInventorySnapshot {
        session_id: session.session_id,
        title,
        profile_id,
        cwd: session_tag_value(&session.tags, "cwd").unwrap_or_default(),
        updated_at: session.last_active_at,
        workspace_id: session.workspace_id,
        project_id: session_tag_value(&session.tags, "project").unwrap_or_default(),
        status: inventory_status_label(&session.state).to_string(),
        last_exit_code: session.exit_code,
    }
}

fn build_local_shell_stream_event_snapshot(
    entry: ReplayEntry,
) -> DesktopLocalShellStreamEventSnapshot {
    DesktopLocalShellStreamEventSnapshot {
        session_id: entry.session_id.clone(),
        next_cursor: entry.sequence.to_string(),
        entry: map_replay_entry_snapshot(entry),
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct DesktopLocalShellStreamEventSnapshot {
    session_id: String,
    next_cursor: String,
    entry: DesktopReplayEntrySnapshot,
}

fn build_local_shell_runtime_event_name(event_type: &str) -> String {
    format!(
        "{}:{}",
        LOCAL_RUNTIME_NAMESPACE.replace('.', ":"),
        event_type.replace('.', ":")
    )
}

fn session_state_label(state: &SessionState) -> &'static str {
    match state {
        SessionState::Creating => "Creating",
        SessionState::Starting => "Starting",
        SessionState::Running => "Running",
        SessionState::Detached => "Detached",
        SessionState::Reattaching => "Reattaching",
        SessionState::Replaying => "Replaying",
        SessionState::Stopping => "Stopping",
        SessionState::Exited => "Exited",
        SessionState::Failed => "Failed",
    }
}

fn inventory_status_label(state: &SessionState) -> &'static str {
    match state {
        SessionState::Exited => "closed",
        SessionState::Failed => "error",
        SessionState::Creating
        | SessionState::Starting
        | SessionState::Running
        | SessionState::Detached
        | SessionState::Reattaching
        | SessionState::Replaying
        | SessionState::Stopping => "running",
    }
}

fn current_occurred_at() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("epoch-ms:{millis}")
}

fn normalize_replay_limit(limit: Option<usize>) -> usize {
    limit
        .unwrap_or(DEFAULT_REPLAY_LIMIT)
        .clamp(1, MAX_REPLAY_LIMIT)
}

fn normalize_pty_dimensions(cols: Option<u16>, rows: Option<u16>) -> Result<(u16, u16), String> {
    let cols = cols.unwrap_or(120);
    let rows = rows.unwrap_or(32);
    if cols == 0 || rows == 0 || cols > MAX_PTY_DIMENSION || rows > MAX_PTY_DIMENSION {
        return Err(format!(
            "terminal dimensions must be between 1 and {MAX_PTY_DIMENSION}"
        ));
    }
    Ok((cols, rows))
}

fn validate_process_command(command: &[String]) -> Result<(), String> {
    if command.is_empty() {
        return Err("local process command must include a program".to_string());
    }
    if command.len() > MAX_COMMAND_ARGUMENTS {
        return Err(format!(
            "local process command exceeds the {MAX_COMMAND_ARGUMENTS}-argument limit"
        ));
    }
    for (index, argument) in command.iter().enumerate() {
        if index == 0 && argument.trim().is_empty() {
            return Err("local process command must include a program".to_string());
        }
        if argument.len() > MAX_COMMAND_ARGUMENT_BYTES {
            return Err(format!(
                "local process command argument {index} exceeds the {MAX_COMMAND_ARGUMENT_BYTES}-byte limit"
            ));
        }
        if argument.contains('\0') {
            return Err(format!(
                "local process command argument {index} contains an invalid null byte"
            ));
        }
    }
    Ok(())
}

fn validate_session_input(input: &[u8]) -> Result<(), String> {
    if input.len() > MAX_SESSION_INPUT_BYTES {
        return Err(format!(
            "terminal input exceeds the {MAX_SESSION_INPUT_BYTES}-byte limit"
        ));
    }
    Ok(())
}

fn validate_session_metadata(
    title: Option<&str>,
    profile_id: Option<&str>,
    workspace_id: Option<&str>,
    project_id: Option<&str>,
) -> Result<(), String> {
    validate_optional_text("terminal title", title, MAX_METADATA_BYTES)?;
    validate_optional_text("terminal profile id", profile_id, MAX_METADATA_BYTES)?;
    validate_optional_text("terminal workspace id", workspace_id, MAX_METADATA_BYTES)?;
    validate_optional_text("terminal project id", project_id, MAX_METADATA_BYTES)
}

fn validate_required_text(label: &str, value: &str, max_bytes: usize) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{label} cannot be empty"));
    }
    validate_optional_text(label, Some(value), max_bytes)
}

fn validate_optional_text(
    label: &str,
    value: Option<&str>,
    max_bytes: usize,
) -> Result<(), String> {
    let Some(value) = value else {
        return Ok(());
    };
    if value.len() > max_bytes {
        return Err(format!("{label} exceeds the {max_bytes}-byte limit"));
    }
    if value.contains('\0') {
        return Err(format!("{label} contains an invalid null byte"));
    }
    Ok(())
}

fn normalize_optional_metadata(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
}

fn push_optional_tag(tags: &mut Vec<String>, name: &str, value: Option<&str>) {
    if let Some(value) = normalize_optional_metadata(value) {
        tags.push(format!("{name}:{value}"));
    }
}

fn session_tag_value(tags: &[String], name: &str) -> Option<String> {
    let prefix = format!("{name}:");
    tags.iter()
        .find_map(|tag| tag.strip_prefix(&prefix).map(str::to_string))
}

fn derive_local_process_target(program: &str) -> String {
    let trimmed = program.trim();
    let path = Path::new(trimmed);
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(trimmed);
    if path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|extension| extension.eq_ignore_ascii_case("exe"))
    {
        return path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or(file_name)
            .to_string();
    }

    file_name.to_string()
}

fn truncate_utf8(mut value: String, max_bytes: usize) -> String {
    if value.len() <= max_bytes {
        return value;
    }
    let suffix_bytes = TRUNCATION_SUFFIX.len().min(max_bytes);
    let mut end = max_bytes.saturating_sub(suffix_bytes);
    while end > 0 && !value.is_char_boundary(end) {
        end -= 1;
    }
    value.truncate(end);
    value.push_str(&TRUNCATION_SUFFIX[..suffix_bytes]);
    value
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn replay_limit_is_bounded() {
        assert_eq!(normalize_replay_limit(None), DEFAULT_REPLAY_LIMIT);
        assert_eq!(normalize_replay_limit(Some(0)), 1);
        assert_eq!(normalize_replay_limit(Some(usize::MAX)), MAX_REPLAY_LIMIT);
    }

    #[test]
    fn runtime_event_name_matches_terminal_infrastructure_namespace() {
        assert_eq!(
            build_local_shell_runtime_event_name("session.output"),
            "sdkwork-terminal:runtime:v1:session:output"
        );
    }

    #[test]
    fn terminal_inventory_preserves_birdcoder_metadata_tags() {
        let snapshot = map_terminal_session_inventory_snapshot(SessionRecord {
            session_id: "session-0001".to_string(),
            workspace_id: "workspace-1".to_string(),
            target: "powershell".to_string(),
            state: SessionState::Exited,
            created_at: "epoch-ms:1".to_string(),
            last_active_at: "epoch-ms:2".to_string(),
            mode_tags: vec!["cli-native".to_string()],
            tags: vec![
                "profile:codex".to_string(),
                "project:project-1".to_string(),
                "title:Codex".to_string(),
                "cwd:C:\\workspace".to_string(),
            ],
            launch_intent: None,
            last_ack_sequence: 2,
            exit_code: Some(0),
        });

        assert_eq!(snapshot.profile_id, "codex");
        assert_eq!(snapshot.project_id, "project-1");
        assert_eq!(snapshot.title, "Codex");
        assert_eq!(snapshot.cwd, "C:\\workspace");
        assert_eq!(snapshot.status, "closed");
        assert_eq!(snapshot.last_exit_code, Some(0));
    }

    #[test]
    fn output_truncation_preserves_utf8_boundaries() {
        let truncated = truncate_utf8("terminal-终端-output".repeat(16), 64);
        assert!(truncated.is_char_boundary(truncated.len()));
        assert!(truncated.len() <= 64);
        assert!(truncated.ends_with(TRUNCATION_SUFFIX));
    }

    #[test]
    fn oversized_terminal_input_is_rejected() {
        let oversized = vec![0_u8; MAX_SESSION_INPUT_BYTES + 1];
        assert!(validate_session_input(&oversized).is_err());
    }

    #[test]
    fn invalid_pty_dimensions_do_not_persist_a_session() {
        let state = DesktopTerminalRuntimeState::build(None, SessionRuntime::new())
            .expect("terminal runtime fixture should initialize");
        let error = state
            .create_local_shell_session(DesktopLocalShellSessionCreateRequest {
                profile: "powershell".to_string(),
                working_directory: None,
                cols: Some(0),
                rows: Some(32),
                title: None,
                profile_id: None,
                workspace_id: None,
                project_id: None,
            })
            .expect_err("invalid PTY dimensions must fail");

        assert!(error.contains("terminal dimensions"));
        assert!(state
            .session_index()
            .expect("session inventory should remain readable")
            .sessions
            .is_empty());
    }
}
