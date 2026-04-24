use sdkwork_terminal_control_plane::{
    create_desktop_session_runtime, DESKTOP_SESSION_RUNTIME_DB_FILE_NAME,
};
use sdkwork_terminal_protocol::LOCAL_RUNTIME_NAMESPACE;
use sdkwork_terminal_pty_runtime::{
    execute_local_shell_command, LocalShellExecutionRequest, LocalShellSessionCreateRequest,
    LocalShellSessionEvent, LocalShellSessionRuntime, PtyProcessLaunchCommand,
    PtyProcessSessionCreateRequest,
};
use sdkwork_terminal_replay_store::{ReplayEntry, ReplayEventKind};
use sdkwork_terminal_session_runtime::{
    AttachmentRecord, SessionCreateRequest, SessionRecord, SessionRuntime, SessionState,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::{SystemTime, UNIX_EPOCH},
};
use tauri::{Emitter, Manager};

const BIRDCODER_TERMINAL_SESSION_METADATA_KIND: &str = "birdcoder-terminal-session-metadata";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopAttachmentDescriptorSnapshot {
    pub attachment_id: String,
    pub session_id: String,
    pub cursor: String,
    pub last_ack_sequence: u64,
    pub writable: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionIndexSnapshot {
    pub sessions: Vec<DesktopSessionDescriptorSnapshot>,
    pub attachments: Vec<DesktopAttachmentDescriptorSnapshot>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopReplayEntrySnapshot {
    pub sequence: u64,
    pub kind: String,
    pub payload: String,
    pub occurred_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionReplaySnapshot {
    pub session_id: String,
    pub from_cursor: Option<String>,
    pub next_cursor: String,
    pub has_more: bool,
    pub entries: Vec<DesktopReplayEntrySnapshot>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellStreamEventSnapshot {
    pub session_id: String,
    pub next_cursor: String,
    pub entry: DesktopReplayEntrySnapshot,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionAttachRequest {
    pub session_id: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionDetachRequest {
    pub attachment_id: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionAttachmentSnapshot {
    pub session: DesktopSessionDescriptorSnapshot,
    pub attachment: DesktopAttachmentDescriptorSnapshot,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellExecRequest {
    pub profile: String,
    pub command_text: String,
    pub working_directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionInputRequest {
    pub session_id: String,
    pub input: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionInputBytesRequest {
    pub session_id: String,
    pub input_bytes: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionInputSnapshot {
    pub session_id: String,
    pub accepted_bytes: usize,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopSessionAttachmentAcknowledgeRequest {
    pub attachment_id: String,
    pub sequence: u64,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionResizeRequest {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionResizeSnapshot {
    pub session_id: String,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopLocalShellSessionTerminateSnapshot {
    pub session_id: String,
    pub state: String,
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopWorkingDirectoryPickerRequest {
    pub default_path: Option<String>,
    pub title: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
struct DesktopTerminalSessionMetadataPayload {
    pub kind: String,
    pub title: String,
    pub profile_id: String,
    pub cwd: String,
    pub workspace_id: String,
    pub project_id: String,
    pub invoked_program: String,
    pub invoked_args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
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

pub struct DesktopRuntimeState {
    session_runtime: Arc<Mutex<SessionRuntime>>,
    local_shell_runtime: LocalShellSessionRuntime,
    local_shell_event_sender: mpsc::Sender<LocalShellSessionEvent>,
}

impl Drop for DesktopRuntimeState {
    fn drop(&mut self) {
        let _ = self
            .local_shell_event_sender
            .send(LocalShellSessionEvent::Exit {
                session_id: "__shutdown__".to_string(),
                exit_code: None,
            });
        if let Ok(runtime) = self.session_runtime.lock() {
            for session in runtime.list_sessions() {
                if !matches!(session.state, SessionState::Exited | SessionState::Failed) {
                    let _ = self
                        .local_shell_runtime
                        .terminate_session(&session.session_id);
                }
            }
        }
    }
}

impl DesktopRuntimeState {
    pub fn new(app_handle: Option<tauri::AppHandle>) -> Self {
        Self::try_new(app_handle.clone()).unwrap_or_else(|error| {
            eprintln!(
                "sdkwork-birdcoder: failed to initialize sqlite-backed sdkwork-terminal runtime, falling back to in-memory runtime: {error}"
            );
            Self::build(app_handle, SessionRuntime::new())
        })
    }

    fn try_new(app_handle: Option<tauri::AppHandle>) -> Result<Self, String> {
        let runtime = create_desktop_session_runtime(
            resolve_session_runtime_db_path(app_handle.as_ref())?.as_deref(),
        )?;
        Ok(Self::build(app_handle, runtime))
    }

    fn build(app_handle: Option<tauri::AppHandle>, session_runtime: SessionRuntime) -> Self {
        let session_runtime = Arc::new(Mutex::new(session_runtime));
        let local_shell_runtime = if cfg!(windows) {
            LocalShellSessionRuntime::with_synthetic_probe_responses()
        } else {
            LocalShellSessionRuntime::default()
        };
        let (local_shell_event_sender, local_shell_event_receiver) = mpsc::channel();
        let session_runtime_for_events = Arc::clone(&session_runtime);
        let app_handle_for_events = app_handle.clone();

        thread::spawn(move || {
            while let Ok(event) = local_shell_event_receiver.recv() {
                let occurred_at = current_occurred_at();
                let Ok(mut runtime) = session_runtime_for_events.lock() else {
                    continue;
                };

                let runtime_event = match event {
                    LocalShellSessionEvent::Output {
                        session_id,
                        payload,
                    } => runtime
                        .record_output(&session_id, &payload, &occurred_at)
                        .ok()
                        .map(|entry| {
                            (
                                build_local_shell_runtime_event_name("session.output"),
                                build_local_shell_stream_event_snapshot(entry),
                            )
                        }),
                    LocalShellSessionEvent::Warning {
                        session_id,
                        message,
                    } => runtime
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
                        }),
                    LocalShellSessionEvent::Exit {
                        session_id,
                        exit_code,
                    } => {
                        let runtime_event = build_exit_payload(exit_code)
                            .ok()
                            .and_then(|payload| {
                                runtime
                                    .record_replay_event(
                                        &session_id,
                                        ReplayEventKind::Exit,
                                        &payload,
                                        &occurred_at,
                                    )
                                    .ok()
                            })
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
                    (app_handle_for_events.as_ref(), runtime_event)
                {
                    let _ = app_handle.emit(&event_name, payload);
                }
            }
        });

        Self {
            session_runtime,
            local_shell_runtime,
            local_shell_event_sender,
        }
    }

    fn session_index(&self) -> Result<DesktopSessionIndexSnapshot, String> {
        let runtime = self
            .session_runtime
            .lock()
            .map_err(|_| "session runtime mutex poisoned".to_string())?;

        Ok(DesktopSessionIndexSnapshot {
            sessions: runtime
                .list_sessions()
                .into_iter()
                .map(map_session_descriptor_snapshot)
                .collect(),
            attachments: runtime
                .list_attachments()
                .into_iter()
                .map(map_attachment_descriptor_snapshot)
                .collect(),
        })
    }

    fn session_replay_slice(
        &self,
        session_id: &str,
        from_cursor: Option<String>,
        limit: usize,
    ) -> Result<DesktopSessionReplaySnapshot, String> {
        let runtime = self
            .session_runtime
            .lock()
            .map_err(|_| "session runtime mutex poisoned".to_string())?;
        let replay = runtime
            .replay(session_id, from_cursor.as_deref(), limit)
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

    fn attach_session(
        &self,
        request: DesktopSessionAttachRequest,
    ) -> Result<DesktopSessionAttachmentSnapshot, String> {
        let (session, attachment) = {
            let mut runtime = self
                .session_runtime
                .lock()
                .map_err(|_| "session runtime mutex poisoned".to_string())?;
            let attachment = runtime
                .attach(&request.session_id)
                .map_err(|error| error.to_string())?;
            let session = runtime
                .list_sessions()
                .into_iter()
                .find(|session| session.session_id == request.session_id)
                .ok_or_else(|| format!("session not found: {}", request.session_id))?;
            (session, attachment)
        };

        Ok(DesktopSessionAttachmentSnapshot {
            session: map_session_descriptor_snapshot(session),
            attachment: map_attachment_descriptor_snapshot(attachment),
        })
    }

    fn detach_session_attachment(
        &self,
        request: DesktopSessionDetachRequest,
    ) -> Result<DesktopSessionDescriptorSnapshot, String> {
        let session = self
            .session_runtime
            .lock()
            .map_err(|_| "session runtime mutex poisoned".to_string())?
            .detach(&request.attachment_id)
            .map_err(|error| error.to_string())?;

        Ok(map_session_descriptor_snapshot(session))
    }

    fn reattach_session(
        &self,
        request: DesktopSessionAttachRequest,
    ) -> Result<DesktopSessionAttachmentSnapshot, String> {
        let result = self
            .session_runtime
            .lock()
            .map_err(|_| "session runtime mutex poisoned".to_string())?
            .reattach(&request.session_id)
            .map_err(|error| error.to_string())?;

        Ok(DesktopSessionAttachmentSnapshot {
            session: map_session_descriptor_snapshot(result.session),
            attachment: map_attachment_descriptor_snapshot(result.attachment),
        })
    }

    fn list_terminal_session_inventory(
        &self,
    ) -> Result<Vec<DesktopTerminalSessionInventorySnapshot>, String> {
        let runtime = self
            .session_runtime
            .lock()
            .map_err(|_| "session runtime mutex poisoned".to_string())?;
        let attached_session_ids = runtime
            .list_attachments()
            .into_iter()
            .map(|attachment| attachment.session_id)
            .collect::<HashSet<_>>();
        let mut records = runtime
            .list_sessions()
            .into_iter()
            .map(|session| {
                let replay = runtime
                    .replay(&session.session_id, None, 32)
                    .map_err(|error| error.to_string())?;
                let metadata =
                    resolve_terminal_session_metadata(&session, replay.entries.as_slice());

                Ok(DesktopTerminalSessionInventorySnapshot {
                    session_id: session.session_id.clone(),
                    title: metadata.title,
                    profile_id: metadata.profile_id,
                    cwd: metadata.cwd,
                    updated_at: session.last_active_at.clone(),
                    workspace_id: metadata.workspace_id,
                    project_id: metadata.project_id,
                    status: terminal_inventory_status_label(
                        &session,
                        attached_session_ids.contains(&session.session_id),
                    )
                    .to_string(),
                    last_exit_code: session.exit_code,
                })
            })
            .collect::<Result<Vec<_>, String>>()?;

        records.sort_by(|left, right| {
            right
                .updated_at
                .cmp(&left.updated_at)
                .then_with(|| left.session_id.cmp(&right.session_id))
        });

        Ok(records)
    }

    fn create_local_shell_session(
        &self,
        request: DesktopLocalShellSessionCreateRequest,
    ) -> Result<DesktopLocalShellSessionCreateSnapshot, String> {
        let occurred_at = current_occurred_at();
        let profile = normalize_metadata_value(Some(request.profile.clone()), "shell");
        let title = normalize_metadata_value(request.title.clone(), &profile);
        let workspace_id =
            normalize_metadata_value(request.workspace_id.clone(), "workspace-local");
        let project_id = normalize_metadata_value(request.project_id.clone(), "");
        let requested_cwd = normalize_optional_metadata_value(request.working_directory.clone());
        let mode_tags = vec!["cli-native".to_string(), "surface:birdcoder".to_string()];
        let mut tags = vec![
            "surface:birdcoder-terminal".to_string(),
            format!("profile:{profile}"),
            format!("title:{title}"),
        ];
        if let Some(cwd) = requested_cwd.as_deref() {
            tags.push(format!("cwd:{cwd}"));
        }
        if !project_id.is_empty() {
            tags.push(format!("project:{project_id}"));
        }
        let (session, attachment) = {
            let mut runtime = self
                .session_runtime
                .lock()
                .map_err(|_| "session runtime mutex poisoned".to_string())?;
            let session = runtime.create_session(SessionCreateRequest {
                workspace_id: workspace_id.clone(),
                target: title.clone(),
                mode_tags: mode_tags.clone(),
                tags: tags.clone(),
                launch_intent: None,
            });
            let attachment = runtime
                .attach(&session.session_id)
                .map_err(|error| error.to_string())?;
            (session, attachment)
        };

        let bootstrap = match self.local_shell_runtime.create_session(
            LocalShellSessionCreateRequest {
                session_id: session.session_id.clone(),
                profile: request.profile,
                working_directory: request.working_directory,
                cols: request.cols.unwrap_or(120),
                rows: request.rows.unwrap_or(32),
            },
            self.local_shell_event_sender.clone(),
        ) {
            Ok(value) => value,
            Err(error) => {
                let mut runtime = self
                    .session_runtime
                    .lock()
                    .map_err(|_| "session runtime mutex poisoned".to_string())?;
                let _ = runtime.record_replay_event(
                    &session.session_id,
                    ReplayEventKind::Warning,
                    &error.to_string(),
                    &occurred_at,
                );
                let _ = runtime.fail(&session.session_id, &occurred_at);
                return Err(error.to_string());
            }
        };

        self.record_terminal_session_metadata(
            &session.session_id,
            DesktopTerminalSessionMetadataPayload {
                kind: BIRDCODER_TERMINAL_SESSION_METADATA_KIND.to_string(),
                title: title.clone(),
                profile_id: normalize_metadata_value(request.profile_id, &profile),
                cwd: bootstrap.working_directory.clone(),
                workspace_id: workspace_id.clone(),
                project_id: project_id.clone(),
                invoked_program: bootstrap.invoked_program.clone(),
                invoked_args: Vec::new(),
            },
            &occurred_at,
        )?;

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

    fn create_local_process_session(
        &self,
        request: DesktopLocalProcessSessionCreateRequest,
    ) -> Result<DesktopLocalProcessSessionCreateSnapshot, String> {
        let program = request
            .command
            .first()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
            .ok_or_else(|| "local process command must include a program".to_string())?;
        let occurred_at = current_occurred_at();
        let target = derive_local_process_target(program);
        let title = normalize_metadata_value(request.title.clone(), &target);
        let profile_id = normalize_metadata_value(request.profile_id.clone(), &target);
        let workspace_id =
            normalize_metadata_value(request.workspace_id.clone(), "workspace-local");
        let project_id = normalize_metadata_value(request.project_id.clone(), "");
        let requested_cwd = normalize_optional_metadata_value(request.working_directory.clone());
        let mode_tags = vec!["cli-native".to_string(), "surface:birdcoder".to_string()];
        let mut tags = vec![
            "surface:birdcoder-terminal".to_string(),
            "launcher:local-process".to_string(),
            format!("program:{target}"),
            format!("profile:{profile_id}"),
            format!("title:{title}"),
        ];
        if let Some(cwd) = requested_cwd.as_deref() {
            tags.push(format!("cwd:{cwd}"));
        }
        if !project_id.is_empty() {
            tags.push(format!("project:{project_id}"));
        }
        let (session, attachment) = {
            let mut runtime = self
                .session_runtime
                .lock()
                .map_err(|_| "session runtime mutex poisoned".to_string())?;
            let session = runtime.create_session(SessionCreateRequest {
                workspace_id: workspace_id.clone(),
                target: title.clone(),
                mode_tags: mode_tags.clone(),
                tags: tags.clone(),
                launch_intent: None,
            });
            let attachment = runtime
                .attach(&session.session_id)
                .map_err(|error| error.to_string())?;
            (session, attachment)
        };

        let bootstrap = match self.local_shell_runtime.create_process_session(
            PtyProcessSessionCreateRequest {
                session_id: session.session_id.clone(),
                command: PtyProcessLaunchCommand {
                    program: program.to_string(),
                    args: request.command.into_iter().skip(1).collect(),
                },
                working_directory: request.working_directory,
                cols: request.cols.unwrap_or(120),
                rows: request.rows.unwrap_or(32),
            },
            self.local_shell_event_sender.clone(),
        ) {
            Ok(value) => value,
            Err(error) => {
                let mut runtime = self
                    .session_runtime
                    .lock()
                    .map_err(|_| "session runtime mutex poisoned".to_string())?;
                let _ = runtime.record_replay_event(
                    &session.session_id,
                    ReplayEventKind::Warning,
                    &error.to_string(),
                    &occurred_at,
                );
                let _ = runtime.fail(&session.session_id, &occurred_at);
                return Err(error.to_string());
            }
        };

        self.record_terminal_session_metadata(
            &session.session_id,
            DesktopTerminalSessionMetadataPayload {
                kind: BIRDCODER_TERMINAL_SESSION_METADATA_KIND.to_string(),
                title: title.clone(),
                profile_id: profile_id.clone(),
                cwd: bootstrap.working_directory.clone(),
                workspace_id: workspace_id.clone(),
                project_id: project_id.clone(),
                invoked_program: bootstrap.invoked_program.clone(),
                invoked_args: bootstrap.invoked_args.clone(),
            },
            &occurred_at,
        )?;

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

    fn write_local_shell_input(
        &self,
        request: DesktopLocalShellSessionInputRequest,
    ) -> Result<DesktopLocalShellSessionInputSnapshot, String> {
        let accepted_bytes = self
            .local_shell_runtime
            .write_input(&request.session_id, &request.input)
            .map_err(|error| error.to_string())?;

        Ok(DesktopLocalShellSessionInputSnapshot {
            session_id: request.session_id,
            accepted_bytes,
        })
    }

    fn write_local_shell_input_bytes(
        &self,
        request: DesktopLocalShellSessionInputBytesRequest,
    ) -> Result<DesktopLocalShellSessionInputSnapshot, String> {
        let accepted_bytes = self
            .local_shell_runtime
            .write_input_bytes(&request.session_id, &request.input_bytes)
            .map_err(|error| error.to_string())?;

        Ok(DesktopLocalShellSessionInputSnapshot {
            session_id: request.session_id,
            accepted_bytes,
        })
    }

    fn acknowledge_session_attachment(
        &self,
        request: DesktopSessionAttachmentAcknowledgeRequest,
    ) -> Result<DesktopAttachmentDescriptorSnapshot, String> {
        let attachment = self
            .session_runtime
            .lock()
            .map_err(|_| "session runtime mutex poisoned".to_string())?
            .acknowledge(&request.attachment_id, request.sequence)
            .map_err(|error| error.to_string())?;

        Ok(map_attachment_descriptor_snapshot(attachment))
    }

    fn resize_local_shell_session(
        &self,
        request: DesktopLocalShellSessionResizeRequest,
    ) -> Result<DesktopLocalShellSessionResizeSnapshot, String> {
        self.local_shell_runtime
            .resize_session(&request.session_id, request.cols, request.rows)
            .map_err(|error| error.to_string())?;

        Ok(DesktopLocalShellSessionResizeSnapshot {
            session_id: request.session_id,
            cols: request.cols,
            rows: request.rows,
        })
    }

    fn terminate_local_shell_session(
        &self,
        session_id: &str,
    ) -> Result<DesktopLocalShellSessionTerminateSnapshot, String> {
        self.local_shell_runtime
            .terminate_session(session_id)
            .map_err(|error| error.to_string())?;

        let session = self
            .session_runtime
            .lock()
            .map_err(|_| "session runtime mutex poisoned".to_string())?
            .mark_stopping(session_id, &current_occurred_at())
            .map_err(|error| error.to_string())?;

        Ok(DesktopLocalShellSessionTerminateSnapshot {
            session_id: session.session_id,
            state: session_state_label(&session.state).to_string(),
        })
    }

    fn record_terminal_session_metadata(
        &self,
        session_id: &str,
        metadata: DesktopTerminalSessionMetadataPayload,
        occurred_at: &str,
    ) -> Result<(), String> {
        let payload = serde_json::to_string(&metadata).map_err(|error| error.to_string())?;

        self.session_runtime
            .lock()
            .map_err(|_| "session runtime mutex poisoned".to_string())?
            .record_replay_event(session_id, ReplayEventKind::State, &payload, occurred_at)
            .map_err(|error| error.to_string())?;

        Ok(())
    }
}

fn resolve_session_runtime_db_path(
    app_handle: Option<&tauri::AppHandle>,
) -> Result<Option<PathBuf>, String> {
    let Some(app_handle) = app_handle else {
        return Ok(None);
    };

    let app_local_data_dir = app_handle
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("failed to resolve desktop app local data dir: {error}"))?;

    Ok(Some(
        app_local_data_dir.join(DESKTOP_SESSION_RUNTIME_DB_FILE_NAME),
    ))
}

fn derive_local_process_target(program: &str) -> String {
    let trimmed = program.trim();
    if trimmed.is_empty() {
        return "local-process".to_string();
    }

    let path = Path::new(trimmed);
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(trimmed);

    file_name
        .strip_suffix(".exe")
        .or_else(|| file_name.strip_suffix(".EXE"))
        .unwrap_or(file_name)
        .to_string()
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

fn normalize_optional_metadata_value(value: Option<String>) -> Option<String> {
    value
        .map(|entry| entry.trim().to_string())
        .filter(|entry| !entry.is_empty())
}

fn normalize_metadata_value(value: Option<String>, fallback: &str) -> String {
    normalize_optional_metadata_value(value).unwrap_or_else(|| fallback.trim().to_string())
}

fn read_session_tag_value(tags: &[String], key: &str) -> Option<String> {
    let prefix = format!("{key}:");

    tags.iter().find_map(|tag| {
        tag.strip_prefix(&prefix)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned)
    })
}

fn fallback_terminal_session_metadata(
    session: &SessionRecord,
) -> DesktopTerminalSessionMetadataPayload {
    let title = read_session_tag_value(&session.tags, "title")
        .or_else(|| {
            read_session_tag_value(&session.tags, "profile")
                .map(|profile| get_fallback_terminal_session_title(&profile))
        })
        .unwrap_or_else(|| session.target.clone());
    let profile_id = read_session_tag_value(&session.tags, "profile").unwrap_or_else(|| {
        if session.target.trim().is_empty() {
            "shell".to_string()
        } else {
            session.target.trim().to_lowercase()
        }
    });

    DesktopTerminalSessionMetadataPayload {
        kind: BIRDCODER_TERMINAL_SESSION_METADATA_KIND.to_string(),
        title,
        profile_id,
        cwd: read_session_tag_value(&session.tags, "cwd").unwrap_or_default(),
        workspace_id: session.workspace_id.clone(),
        project_id: read_session_tag_value(&session.tags, "project").unwrap_or_default(),
        invoked_program: read_session_tag_value(&session.tags, "program").unwrap_or_default(),
        invoked_args: Vec::new(),
    }
}

fn get_fallback_terminal_session_title(profile_id: &str) -> String {
    match profile_id.trim().to_lowercase().as_str() {
        "powershell" => "PowerShell".to_string(),
        "claude-code" => "Claude Code".to_string(),
        "gemini" | "gemini-cli" => "Gemini CLI".to_string(),
        "opencode" | "opencode-cli" => "OpenCode".to_string(),
        "codex" => "Codex".to_string(),
        value if !value.is_empty() => value.to_string(),
        _ => "Terminal".to_string(),
    }
}

fn resolve_terminal_session_metadata(
    session: &SessionRecord,
    replay_entries: &[ReplayEntry],
) -> DesktopTerminalSessionMetadataPayload {
    for entry in replay_entries.iter().rev() {
        if !matches!(entry.kind, ReplayEventKind::State) {
            continue;
        }

        let Ok(payload) =
            serde_json::from_str::<DesktopTerminalSessionMetadataPayload>(&entry.payload)
        else {
            continue;
        };

        if payload.kind == BIRDCODER_TERMINAL_SESSION_METADATA_KIND {
            return payload;
        }
    }

    fallback_terminal_session_metadata(session)
}

fn terminal_inventory_status_label(
    session: &SessionRecord,
    has_active_attachment: bool,
) -> &'static str {
    match session.state {
        SessionState::Failed => "error",
        SessionState::Exited => {
            if session.exit_code.unwrap_or(0) == 0 {
                "closed"
            } else {
                "error"
            }
        }
        SessionState::Detached => "running",
        SessionState::Stopping => "running",
        SessionState::Creating
        | SessionState::Starting
        | SessionState::Running
        | SessionState::Reattaching
        | SessionState::Replaying => {
            if has_active_attachment {
                "running"
            } else {
                "running"
            }
        }
    }
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

fn current_occurred_at() -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();

    format!("epoch-ms:{millis}")
}

fn run_local_shell_exec(
    request: DesktopLocalShellExecRequest,
) -> Result<DesktopLocalShellExecSnapshot, String> {
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
        stdout: result.stdout,
        stderr: result.stderr,
    })
}

fn build_exit_payload(exit_code: Option<i32>) -> Result<String, serde_json::Error> {
    serde_json::to_string(&serde_json::json!({
        "exitCode": exit_code,
    }))
}

fn build_local_shell_runtime_event_name(event_type: &str) -> String {
    format!(
        "{}:{}",
        LOCAL_RUNTIME_NAMESPACE.replace('.', ":"),
        event_type.replace('.', ":")
    )
}

fn map_replay_entry_snapshot(entry: ReplayEntry) -> DesktopReplayEntrySnapshot {
    DesktopReplayEntrySnapshot {
        sequence: entry.sequence,
        kind: entry.kind.as_str().to_string(),
        payload: entry.payload,
        occurred_at: entry.occurred_at,
    }
}

fn build_local_shell_stream_event_snapshot(
    entry: ReplayEntry,
) -> DesktopLocalShellStreamEventSnapshot {
    let next_cursor = entry.sequence.to_string();
    let session_id = entry.session_id.clone();

    DesktopLocalShellStreamEventSnapshot {
        session_id,
        next_cursor,
        entry: map_replay_entry_snapshot(entry),
    }
}

fn resolve_working_directory_picker_starting_directory(value: Option<&str>) -> Option<PathBuf> {
    let candidate = value
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(PathBuf::from)?;

    if candidate.is_dir() {
        return Some(candidate);
    }

    candidate
        .parent()
        .filter(|parent| parent.is_dir())
        .map(Path::to_path_buf)
}

fn normalize_user_facing_path(path: &Path) -> String {
    #[cfg(windows)]
    {
        let display_path = path.to_string_lossy();

        if let Some(stripped) = display_path.strip_prefix(r"\\?\UNC\") {
            return format!(r"\\{stripped}");
        }

        if let Some(stripped) = display_path
            .strip_prefix(r"\\?\")
            .or_else(|| display_path.strip_prefix(r"\\.\"))
        {
            return stripped.to_string();
        }
    }

    path.to_string_lossy().into_owned()
}

pub mod commands {
    use super::{
        normalize_user_facing_path, resolve_working_directory_picker_starting_directory,
        run_local_shell_exec, DesktopAttachmentDescriptorSnapshot,
        DesktopLocalProcessSessionCreateRequest, DesktopLocalProcessSessionCreateSnapshot,
        DesktopLocalShellExecRequest, DesktopLocalShellExecSnapshot,
        DesktopLocalShellSessionCreateRequest, DesktopLocalShellSessionCreateSnapshot,
        DesktopLocalShellSessionInputBytesRequest, DesktopLocalShellSessionInputRequest,
        DesktopLocalShellSessionInputSnapshot, DesktopLocalShellSessionResizeRequest,
        DesktopLocalShellSessionResizeSnapshot, DesktopLocalShellSessionTerminateSnapshot,
        DesktopRuntimeState, DesktopSessionAttachRequest,
        DesktopSessionAttachmentAcknowledgeRequest, DesktopSessionAttachmentSnapshot,
        DesktopSessionDescriptorSnapshot, DesktopSessionDetachRequest, DesktopSessionIndexSnapshot,
        DesktopSessionReplaySnapshot, DesktopTerminalSessionInventorySnapshot,
        DesktopWorkingDirectoryPickerRequest,
    };
    use std::sync::mpsc;
    use std::time::Duration;
    use tauri_plugin_dialog::DialogExt;

    #[tauri::command]
    pub fn desktop_session_index(
        state: tauri::State<'_, DesktopRuntimeState>,
    ) -> Result<DesktopSessionIndexSnapshot, String> {
        state.session_index()
    }

    #[tauri::command]
    pub fn desktop_session_replay_slice(
        state: tauri::State<'_, DesktopRuntimeState>,
        session_id: String,
        from_cursor: Option<String>,
        limit: Option<usize>,
    ) -> Result<DesktopSessionReplaySnapshot, String> {
        state.session_replay_slice(&session_id, from_cursor, limit.unwrap_or(64))
    }

    #[tauri::command]
    pub fn desktop_session_attach(
        state: tauri::State<'_, DesktopRuntimeState>,
        request: DesktopSessionAttachRequest,
    ) -> Result<DesktopSessionAttachmentSnapshot, String> {
        state.attach_session(request)
    }

    #[tauri::command]
    pub fn desktop_session_detach(
        state: tauri::State<'_, DesktopRuntimeState>,
        request: DesktopSessionDetachRequest,
    ) -> Result<DesktopSessionDescriptorSnapshot, String> {
        state.detach_session_attachment(request)
    }

    #[tauri::command]
    pub fn desktop_session_reattach(
        state: tauri::State<'_, DesktopRuntimeState>,
        request: DesktopSessionAttachRequest,
    ) -> Result<DesktopSessionAttachmentSnapshot, String> {
        state.reattach_session(request)
    }

    #[tauri::command]
    pub fn desktop_terminal_session_inventory_list(
        state: tauri::State<'_, DesktopRuntimeState>,
    ) -> Result<Vec<DesktopTerminalSessionInventorySnapshot>, String> {
        state.list_terminal_session_inventory()
    }

    #[tauri::command]
    pub fn desktop_local_shell_exec(
        request: DesktopLocalShellExecRequest,
    ) -> Result<DesktopLocalShellExecSnapshot, String> {
        run_local_shell_exec(request)
    }

    #[tauri::command]
    pub fn desktop_local_shell_session_create(
        state: tauri::State<'_, DesktopRuntimeState>,
        request: DesktopLocalShellSessionCreateRequest,
    ) -> Result<DesktopLocalShellSessionCreateSnapshot, String> {
        state.create_local_shell_session(request)
    }

    #[tauri::command]
    pub fn desktop_local_process_session_create(
        state: tauri::State<'_, DesktopRuntimeState>,
        request: DesktopLocalProcessSessionCreateRequest,
    ) -> Result<DesktopLocalProcessSessionCreateSnapshot, String> {
        state.create_local_process_session(request)
    }

    #[tauri::command]
    pub fn desktop_session_input(
        state: tauri::State<'_, DesktopRuntimeState>,
        request: DesktopLocalShellSessionInputRequest,
    ) -> Result<DesktopLocalShellSessionInputSnapshot, String> {
        state.write_local_shell_input(request)
    }

    #[tauri::command]
    pub fn desktop_session_input_bytes(
        state: tauri::State<'_, DesktopRuntimeState>,
        request: DesktopLocalShellSessionInputBytesRequest,
    ) -> Result<DesktopLocalShellSessionInputSnapshot, String> {
        state.write_local_shell_input_bytes(request)
    }

    #[tauri::command]
    pub fn desktop_session_attachment_acknowledge(
        state: tauri::State<'_, DesktopRuntimeState>,
        request: DesktopSessionAttachmentAcknowledgeRequest,
    ) -> Result<DesktopAttachmentDescriptorSnapshot, String> {
        state.acknowledge_session_attachment(request)
    }

    #[tauri::command]
    pub fn desktop_session_resize(
        state: tauri::State<'_, DesktopRuntimeState>,
        request: DesktopLocalShellSessionResizeRequest,
    ) -> Result<DesktopLocalShellSessionResizeSnapshot, String> {
        state.resize_local_shell_session(request)
    }

    #[tauri::command]
    pub fn desktop_session_terminate(
        state: tauri::State<'_, DesktopRuntimeState>,
        session_id: String,
    ) -> Result<DesktopLocalShellSessionTerminateSnapshot, String> {
        state.terminate_local_shell_session(&session_id)
    }

    #[tauri::command]
    pub async fn desktop_pick_working_directory(
        window: tauri::Window,
        request: DesktopWorkingDirectoryPickerRequest,
    ) -> Result<Option<String>, String> {
        let (sender, receiver) = mpsc::sync_channel(1);
        let mut dialog = window.dialog().file().set_parent(&window);

        if let Some(title) = request
            .title
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            dialog = dialog.set_title(title);
        }

        if let Some(starting_directory) =
            resolve_working_directory_picker_starting_directory(request.default_path.as_deref())
        {
            dialog = dialog.set_directory(starting_directory);
        }

        dialog.pick_folder(move |folder_path| {
            let response = folder_path
                .map(|value| {
                    value
                        .simplified()
                        .into_path()
                        .map(|path| normalize_user_facing_path(&path))
                        .map_err(|error| error.to_string())
                })
                .transpose();
            let _ = sender.send(response);
        });

        tauri::async_runtime::spawn_blocking(move || -> Result<Option<String>, String> {
            receiver
                .recv_timeout(Duration::from_secs(300))
                .map_err(|error| match error {
                    mpsc::RecvTimeoutError::Timeout => {
                        "working directory picker timed out waiting for a response".to_string()
                    }
                    mpsc::RecvTimeoutError::Disconnected => {
                        "working directory picker did not return a response".to_string()
                    }
                })?
        })
        .await
        .map_err(|error| error.to_string())?
    }
}
