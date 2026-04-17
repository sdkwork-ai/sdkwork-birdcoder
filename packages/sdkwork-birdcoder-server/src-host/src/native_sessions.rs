use std::{
    collections::BTreeMap,
    fs::{self, File},
    io::{BufRead, BufReader, Write},
    path::{Path as FsPath, PathBuf},
    process::{Child, Command, Stdio},
    sync::{Mutex, OnceLock},
    thread,
};

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use super::ProjectPayload;

const CLAUDE_CODE_NATIVE_SESSION_ID_PREFIX: &str = "claude-code-native:";
const CODEX_NATIVE_SESSION_ID_PREFIX: &str = "codex-native:";
const CODEX_SESSIONS_DIRECTORY_NAME: &str = "sessions";
const CODEX_SESSION_INDEX_FILE_NAME: &str = "session_index.jsonl";
const GEMINI_NATIVE_SESSION_ID_PREFIX: &str = "gemini-native:";
const OPENCODE_NATIVE_SESSION_ID_PREFIX: &str = "opencode-native:";
const OPENCODE_SERVER_ATTACH_URL_ENV: &str = "OPENCODE_SERVER_URL";

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
    pub(crate) workspace_id: Option<String>,
    pub(crate) project_id: Option<String>,
    pub(crate) engine_id: Option<String>,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionTurnConfig {
    pub(crate) approval_policy: Option<String>,
    pub(crate) ephemeral: bool,
    pub(crate) full_auto: bool,
    pub(crate) sandbox_mode: Option<String>,
    pub(crate) skip_git_repo_check: bool,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionTurnRequest {
    pub(crate) engine_id: String,
    pub(crate) model_id: Option<String>,
    pub(crate) native_session_id: Option<String>,
    pub(crate) request_kind: String,
    pub(crate) input_summary: String,
    pub(crate) working_directory: Option<PathBuf>,
    pub(crate) config: NativeSessionTurnConfig,
}

#[derive(Clone, Default)]
pub(crate) struct NativeSessionTurnResult {
    pub(crate) assistant_content: String,
    pub(crate) native_session_id: Option<String>,
}

#[derive(Clone, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeSessionCommandPayload {
    pub(crate) command: String,
    pub(crate) status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) output: Option<String>,
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) model_id: Option<String>,
    pub(crate) updated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) last_turn_at: Option<String>,
    pub(crate) kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) native_cwd: Option<String>,
    pub(crate) sort_timestamp: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) transcript_updated_at: Option<String>,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativeSessionDetailPayload {
    pub(crate) summary: NativeSessionSummaryPayload,
    pub(crate) messages: Vec<NativeSessionMessagePayload>,
}

#[derive(Clone, Default)]
struct SessionIndexEntry {
    thread_name: Option<String>,
    updated_at: Option<String>,
}

#[derive(Clone)]
struct SessionLineContext {
    created_at: Option<String>,
    has_error: bool,
    has_task_complete: bool,
    has_task_started: bool,
    has_turn_aborted: bool,
    latest_timestamp: Option<String>,
    latest_transcript_timestamp: Option<String>,
    latest_user_timestamp: Option<String>,
    model_id: Option<String>,
    native_cwd: Option<String>,
    native_session_id: Option<String>,
    title: Option<String>,
    transcript_entries: Vec<TranscriptEntry>,
}

impl Default for SessionLineContext {
    fn default() -> Self {
        Self {
            created_at: None,
            has_error: false,
            has_task_complete: false,
            has_task_started: false,
            has_turn_aborted: false,
            latest_timestamp: None,
            latest_transcript_timestamp: None,
            latest_user_timestamp: None,
            model_id: None,
            native_cwd: None,
            native_session_id: None,
            title: None,
            transcript_entries: Vec::new(),
        }
    }
}

#[derive(Clone)]
struct TranscriptEntry {
    created_at: String,
    role: String,
    content: String,
    turn_id: Option<String>,
    commands: Option<Vec<NativeSessionCommandPayload>>,
}

#[derive(Clone, Debug)]
pub(crate) struct NativeSessionProviderRuntimeSupport {
    pub(crate) list_supported: bool,
    pub(crate) read_supported: bool,
    pub(crate) execute_supported: bool,
}

impl NativeSessionProviderRuntimeSupport {
    pub(crate) fn is_available(&self) -> bool {
        self.list_supported || self.read_supported || self.execute_supported
    }
}

trait NativeSessionProviderPlugin: Send + Sync {
    fn runtime_support(&self) -> NativeSessionProviderRuntimeSupport;

    fn list_sessions(
        &self,
        projects: &[ProjectPayload],
        query: &NativeSessionQuery,
    ) -> Result<Vec<NativeSessionSummaryPayload>, String>;

    fn get_session(
        &self,
        projects: &[ProjectPayload],
        lookup: &NativeSessionLookup,
    ) -> Result<Option<NativeSessionDetailPayload>, String>;

    fn execute_turn(
        &self,
        request: &NativeSessionTurnRequest,
    ) -> Result<NativeSessionTurnResult, String>;
}

struct NativeSessionProviderRegistry {
    providers: BTreeMap<&'static str, Box<dyn NativeSessionProviderPlugin>>,
}

impl NativeSessionProviderRegistry {
    fn new() -> Self {
        let mut providers: BTreeMap<&'static str, Box<dyn NativeSessionProviderPlugin>> =
            BTreeMap::new();
        providers.insert("codex", Box::new(CodexNativeSessionProvider));
        providers.insert(
            "claude-code",
            Box::new(UnsupportedNativeSessionProvider::new(
                "claude-code",
                "Claude Code",
                &["sdk-stream", "remote-control-http"],
            )),
        );
        providers.insert(
            "gemini",
            Box::new(UnsupportedNativeSessionProvider::new(
                "gemini",
                "Gemini",
                &["sdk-stream", "openapi-http"],
            )),
        );
        providers.insert(
            "opencode",
            Box::new(OpencodeNativeSessionProvider),
        );

        Self { providers }
    }

    fn resolve_provider(
        &self,
        engine_id: Option<&str>,
    ) -> Result<Vec<&dyn NativeSessionProviderPlugin>, String> {
        if let Some(engine_id) = normalize_non_empty_string(engine_id) {
            let provider = self.providers.get(engine_id.as_str()).ok_or_else(|| {
                format!(
                    "Native session provider for engine \"{engine_id}\" is not implemented yet. TODO: add an engine plugin under native_sessions.rs."
                )
            })?;
            return Ok(vec![provider.as_ref()]);
        }

        Ok(self.providers.values().map(|provider| provider.as_ref()).collect())
    }
    fn find_runtime_support(
        &self,
        engine_id: &str,
    ) -> Option<NativeSessionProviderRuntimeSupport> {
        self.providers
            .get(engine_id)
            .map(|provider| provider.runtime_support())
    }
}

struct UnsupportedNativeSessionProvider {
    display_name: &'static str,
    engine_id: &'static str,
    transport_kinds: &'static [&'static str],
}

impl UnsupportedNativeSessionProvider {
    const fn new(
        engine_id: &'static str,
        display_name: &'static str,
        transport_kinds: &'static [&'static str],
    ) -> Self {
        Self {
            display_name,
            engine_id,
            transport_kinds,
        }
    }

    fn create_not_implemented_error(&self) -> String {
        let transport_summary = self.transport_kinds.join(", ");
        format!(
            "Native session provider for engine \"{}\" ({}) is registered but not implemented in the Rust server yet. TODO: add a dedicated provider plugin under native_sessions.rs for transport(s): {}.",
            self.engine_id, self.display_name, transport_summary
        )
    }
}

impl NativeSessionProviderPlugin for UnsupportedNativeSessionProvider {
    fn runtime_support(&self) -> NativeSessionProviderRuntimeSupport {
        NativeSessionProviderRuntimeSupport {
            list_supported: false,
            read_supported: false,
            execute_supported: false,
        }
    }

    fn list_sessions(
        &self,
        _projects: &[ProjectPayload],
        _query: &NativeSessionQuery,
    ) -> Result<Vec<NativeSessionSummaryPayload>, String> {
        Ok(Vec::new())
    }

    fn get_session(
        &self,
        _projects: &[ProjectPayload],
        _lookup: &NativeSessionLookup,
    ) -> Result<Option<NativeSessionDetailPayload>, String> {
        Ok(None)
    }

    fn execute_turn(
        &self,
        _request: &NativeSessionTurnRequest,
    ) -> Result<NativeSessionTurnResult, String> {
        Err(self.create_not_implemented_error())
    }
}

static NATIVE_SESSION_PROVIDER_REGISTRY: OnceLock<NativeSessionProviderRegistry> = OnceLock::new();

fn native_session_provider_registry() -> &'static NativeSessionProviderRegistry {
    NATIVE_SESSION_PROVIDER_REGISTRY.get_or_init(NativeSessionProviderRegistry::new)
}

pub(crate) fn find_native_session_provider_runtime_support(
    engine_id: &str,
) -> Option<NativeSessionProviderRuntimeSupport> {
    let normalized_engine_id = engine_id.trim().to_ascii_lowercase();
    native_session_provider_registry().find_runtime_support(normalized_engine_id.as_str())
}

pub(crate) fn is_authority_backed_native_session_id(session_id: &str) -> bool {
    resolve_native_session_engine_id(session_id).is_some()
}

pub(crate) fn resolve_native_session_engine_id(session_id: &str) -> Option<String> {
    let normalized = session_id.trim();
    if normalized.is_empty() {
        return None;
    }

    native_session_prefix_mappings()
        .iter()
        .find_map(|(engine_id, prefix)| normalized.strip_prefix(prefix).map(|_| (*engine_id).to_owned()))
}

pub(crate) fn list_native_sessions(
    projects: &[ProjectPayload],
    query: &NativeSessionQuery,
) -> Result<Vec<NativeSessionSummaryPayload>, String> {
    let providers = native_session_provider_registry().resolve_provider(query.engine_id.as_deref())?;
    let mut sessions = Vec::new();

    for provider in providers {
        sessions.extend(provider.list_sessions(projects, query)?);
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
    let providers =
        native_session_provider_registry().resolve_provider(lookup.engine_id.as_deref())?;

    for provider in providers {
        if let Some(detail) = provider.get_session(projects, lookup)? {
            return Ok(Some(detail));
        }
    }

    Ok(None)
}

pub(crate) fn execute_native_session_turn(
    request: &NativeSessionTurnRequest,
) -> Result<NativeSessionTurnResult, String> {
    let providers =
        native_session_provider_registry().resolve_provider(Some(request.engine_id.as_str()))?;
    let provider = providers
        .into_iter()
        .next()
        .ok_or_else(|| "Native session provider registry did not resolve an engine provider.".to_owned())?;
    provider.execute_turn(request)
}

fn native_session_prefix_mappings() -> [(&'static str, &'static str); 4] {
    [
        ("claude-code", CLAUDE_CODE_NATIVE_SESSION_ID_PREFIX),
        ("codex", CODEX_NATIVE_SESSION_ID_PREFIX),
        ("gemini", GEMINI_NATIVE_SESSION_ID_PREFIX),
        ("opencode", OPENCODE_NATIVE_SESSION_ID_PREFIX),
    ]
}

fn native_session_prefix_for_engine(engine_id: &str) -> Option<&'static str> {
    let normalized_engine_id = engine_id.trim().to_ascii_lowercase();
    native_session_prefix_mappings()
        .into_iter()
        .find(|(candidate_engine_id, _)| *candidate_engine_id == normalized_engine_id)
        .map(|(_, prefix)| prefix)
}

fn session_id_targets_engine(session_id: &str, engine_id: &str) -> bool {
    resolve_native_session_engine_id(session_id)
        .map(|resolved_engine_id| resolved_engine_id == engine_id.trim().to_ascii_lowercase())
        .unwrap_or(true)
}

fn build_native_session_id(engine_id: &str, native_session_id: &str) -> String {
    let prefix = native_session_prefix_for_engine(engine_id).unwrap_or_default();
    format!("{prefix}{}", native_session_id.trim())
}

fn extract_native_lookup_id_for_engine(session_id: &str, engine_id: &str) -> Result<String, String> {
    let normalized = session_id.trim();
    if normalized.is_empty() {
        return Err("Native session id is required.".to_owned());
    }

    let Some(prefix) = native_session_prefix_for_engine(engine_id) else {
        return Ok(normalized.to_owned());
    };

    if let Some(resolved_engine_id) = resolve_native_session_engine_id(normalized) {
        if resolved_engine_id != engine_id.trim().to_ascii_lowercase() {
            return Err(format!(
                "Native session id \"{normalized}\" belongs to engine \"{resolved_engine_id}\", not \"{engine_id}\"."
            ));
        }
    }

    Ok(normalized.strip_prefix(prefix).unwrap_or(normalized).trim().to_owned())
}

struct CodexNativeSessionProvider;

impl NativeSessionProviderPlugin for CodexNativeSessionProvider {
    fn runtime_support(&self) -> NativeSessionProviderRuntimeSupport {
        NativeSessionProviderRuntimeSupport {
            list_supported: true,
            read_supported: true,
            execute_supported: true,
        }
    }

    fn list_sessions(
        &self,
        projects: &[ProjectPayload],
        query: &NativeSessionQuery,
    ) -> Result<Vec<NativeSessionSummaryPayload>, String> {
        let session_index = read_codex_session_index()?;
        let mut summaries = Vec::new();

        for file_path in list_codex_session_files()? {
            if let Some(mut summary) = parse_codex_session_summary(&file_path, &session_index)? {
                let native_cwd = summary.native_cwd.clone();
                attach_project_scope(&mut summary, &native_cwd, &file_path, projects);
                if matches_native_session_filters(projects, &summary, query) {
                    summaries.push(summary);
                }
            }
        }

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
        projects: &[ProjectPayload],
        lookup: &NativeSessionLookup,
    ) -> Result<Option<NativeSessionDetailPayload>, String> {
        if !session_id_targets_engine(&lookup.session_id, "codex") {
            return Ok(None);
        }

        let session_index = read_codex_session_index()?;
        let lookup_id = extract_native_lookup_id_for_engine(&lookup.session_id, "codex")?;

        for file_path in list_codex_session_files()? {
            let Some(mut detail) =
                parse_codex_session_detail(&file_path, &session_index)?
            else {
                continue;
            };
            let native_cwd = detail.summary.native_cwd.clone();
            attach_project_scope(&mut detail.summary, &native_cwd, &file_path, projects);

            let detail_lookup_id = extract_native_lookup_id_for_engine(&detail.summary.id, "codex")?;
            if detail_lookup_id != lookup_id {
                continue;
            }

            if !matches_native_session_filters(
                projects,
                &detail.summary,
                &NativeSessionQuery {
                    workspace_id: lookup.workspace_id.clone(),
                    project_id: lookup.project_id.clone(),
                    engine_id: lookup.engine_id.clone(),
                    limit: None,
                },
            ) {
                return Ok(None);
            }

            return Ok(Some(detail));
        }

        Ok(None)
    }

    fn execute_turn(
        &self,
        request: &NativeSessionTurnRequest,
    ) -> Result<NativeSessionTurnResult, String> {
        execute_codex_cli_turn(request)
    }
}

struct OpencodeNativeSessionProvider;

impl NativeSessionProviderPlugin for OpencodeNativeSessionProvider {
    fn runtime_support(&self) -> NativeSessionProviderRuntimeSupport {
        let is_available = is_opencode_transport_available();
        NativeSessionProviderRuntimeSupport {
            list_supported: is_available,
            read_supported: is_available,
            execute_supported: is_available,
        }
    }

    fn list_sessions(
        &self,
        projects: &[ProjectPayload],
        query: &NativeSessionQuery,
    ) -> Result<Vec<NativeSessionSummaryPayload>, String> {
        if !is_opencode_transport_available() {
            return Ok(Vec::new());
        }

        let sessions = opencode_list_sessions()?;
        let session_status_map = opencode_list_session_status_map().unwrap_or_default();
        let mut summaries = Vec::new();

        for session in sessions {
            let Some(mut summary) = build_opencode_session_summary(&session, &session_status_map, None)
            else {
                continue;
            };
            let native_cwd = summary.native_cwd.clone();
            attach_project_scope(&mut summary, &native_cwd, FsPath::new(""), projects);
            if matches_native_session_filters(projects, &summary, query) {
                summaries.push(summary);
            }
        }

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
        projects: &[ProjectPayload],
        lookup: &NativeSessionLookup,
    ) -> Result<Option<NativeSessionDetailPayload>, String> {
        if !is_opencode_transport_available() || !session_id_targets_engine(&lookup.session_id, "opencode") {
            return Ok(None);
        }

        let lookup_id = extract_native_lookup_id_for_engine(&lookup.session_id, "opencode")?;
        let Some(session) = opencode_get_session(lookup_id.as_str())? else {
            return Ok(None);
        };
        let session_status_map = opencode_list_session_status_map().unwrap_or_default();
        let messages = opencode_get_session_messages(lookup_id.as_str())?;
        let model_id = extract_opencode_session_model_id(&messages);
        let Some(mut summary) =
            build_opencode_session_summary(&session, &session_status_map, model_id)
        else {
            return Ok(None);
        };
        let native_cwd = summary.native_cwd.clone();
        attach_project_scope(&mut summary, &native_cwd, FsPath::new(""), projects);

        if !matches_native_session_filters(
            projects,
            &summary,
            &NativeSessionQuery {
                workspace_id: lookup.workspace_id.clone(),
                project_id: lookup.project_id.clone(),
                engine_id: lookup.engine_id.clone(),
                limit: None,
            },
        ) {
            return Ok(None);
        }

        Ok(Some(NativeSessionDetailPayload {
            messages: build_opencode_message_payloads(summary.id.as_str(), &messages),
            summary,
        }))
    }

    fn execute_turn(
        &self,
        request: &NativeSessionTurnRequest,
    ) -> Result<NativeSessionTurnResult, String> {
        execute_opencode_turn(request)
    }
}

struct OpencodeServerHandle {
    base_url: String,
    child: Option<Child>,
}

impl OpencodeServerHandle {
    fn is_alive(&mut self) -> bool {
        match self.child.as_mut() {
            Some(child) => matches!(child.try_wait(), Ok(None)),
            None => true,
        }
    }
}

static OPENCODE_SERVER_HANDLE: OnceLock<Mutex<Option<OpencodeServerHandle>>> = OnceLock::new();
static OPENCODE_TRANSPORT_AVAILABLE: OnceLock<bool> = OnceLock::new();

fn opencode_server_handle() -> &'static Mutex<Option<OpencodeServerHandle>> {
    OPENCODE_SERVER_HANDLE.get_or_init(|| Mutex::new(None))
}

fn is_opencode_transport_available() -> bool {
    *OPENCODE_TRANSPORT_AVAILABLE.get_or_init(|| {
        std::env::var(OPENCODE_SERVER_ATTACH_URL_ENV)
            .ok()
            .and_then(|value| normalize_non_empty_string(Some(value.as_str())))
            .is_some()
            || probe_command_available(create_opencode_cli_command(), &["--version"])
    })
}

fn ensure_opencode_server_base_url() -> Result<String, String> {
    let mut handle_guard = opencode_server_handle()
        .lock()
        .map_err(|_| "OpenCode server handle mutex is poisoned.".to_owned())?;

    if let Some(existing) = handle_guard.as_mut() {
        if existing.is_alive() {
            return Ok(existing.base_url.clone());
        }
        *handle_guard = None;
    }

    let new_handle = start_opencode_server()?;
    let base_url = new_handle.base_url.clone();
    *handle_guard = Some(new_handle);
    Ok(base_url)
}

fn start_opencode_server() -> Result<OpencodeServerHandle, String> {
    if let Some(base_url) = std::env::var(OPENCODE_SERVER_ATTACH_URL_ENV)
        .ok()
        .and_then(|value| normalize_non_empty_string(Some(value.as_str())))
    {
        return Ok(OpencodeServerHandle {
            base_url,
            child: None,
        });
    }

    let mut command = create_opencode_cli_command();
    command
        .arg("serve")
        .arg("--hostname=127.0.0.1")
        .arg("--port=0")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit());

    let mut child = command
        .spawn()
        .map_err(|error| format!("spawn opencode server failed: {error}"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "OpenCode server stdout pipe was not available.".to_owned())?;
    let (sender, receiver) = std::sync::mpsc::channel::<String>();
    thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines().map_while(Result::ok) {
            if sender.send(line).is_err() {
                break;
            }
        }
    });

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(8);
    let mut startup_output = Vec::new();

    loop {
        if let Ok(Some(status)) = child.try_wait() {
            return Err(if startup_output.is_empty() {
                format!("OpenCode server exited before startup completed with status {status}.")
            } else {
                format!(
                    "OpenCode server exited before startup completed with status {status}. Startup output: {}",
                    startup_output.join(" | ")
                )
            });
        }

        let now = std::time::Instant::now();
        if now >= deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err(if startup_output.is_empty() {
                "Timed out waiting for OpenCode server startup.".to_owned()
            } else {
                format!(
                    "Timed out waiting for OpenCode server startup. Startup output: {}",
                    startup_output.join(" | ")
                )
            });
        }

        let wait_for = deadline
            .saturating_duration_since(now)
            .min(std::time::Duration::from_millis(100));

        match receiver.recv_timeout(wait_for) {
            Ok(line) => {
                if !line.trim().is_empty() {
                    startup_output.push(line.clone());
                }
                if let Some(base_url) = parse_opencode_listen_url(&line) {
                    return Ok(OpencodeServerHandle {
                        base_url,
                        child: Some(child),
                    });
                }
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => continue,
        }
    }
}

fn parse_opencode_listen_url(line: &str) -> Option<String> {
    normalize_non_empty_string(
        line.trim()
            .strip_prefix("opencode server listening on ")
            .map(str::trim),
    )
}

fn opencode_list_sessions() -> Result<Vec<Value>, String> {
    let response = opencode_request_json("GET", "/session", &[], None, false)?
        .unwrap_or(Value::Array(Vec::new()));
    match response {
        Value::Array(sessions) => Ok(sessions),
        _ => Err("OpenCode session list response was not an array.".to_owned()),
    }
}

fn opencode_list_session_status_map() -> Result<BTreeMap<String, String>, String> {
    let response = opencode_request_json("GET", "/session/status", &[], None, false)?
        .unwrap_or(Value::Object(serde_json::Map::new()));
    let Value::Object(entries) = response else {
        return Err("OpenCode session status response was not an object.".to_owned());
    };

    Ok(entries
        .into_iter()
        .filter_map(|(session_id, status)| {
            normalize_value_string(status.get("type")).map(|status_type| (session_id, status_type))
        })
        .collect())
}

fn opencode_get_session(session_id: &str) -> Result<Option<Value>, String> {
    let path = format!("/session/{session_id}");
    opencode_request_json("GET", path.as_str(), &[], None, true)
}

fn opencode_get_session_messages(session_id: &str) -> Result<Vec<Value>, String> {
    let path = format!("/session/{session_id}/message");
    let response = opencode_request_json("GET", path.as_str(), &[], None, false)?
        .unwrap_or(Value::Array(Vec::new()));
    match response {
        Value::Array(messages) => Ok(messages),
        _ => Err(format!(
            "OpenCode session messages response for {session_id} was not an array."
        )),
    }
}

fn opencode_create_session(directory: &FsPath, title: Option<&str>) -> Result<Value, String> {
    let mut request_body = serde_json::Map::new();
    if let Some(title) = title.and_then(|value| normalize_non_empty_string(Some(value))) {
        request_body.insert("title".to_owned(), Value::String(title));
    }

    let query = vec![("directory", directory.display().to_string())];
    opencode_request_json(
        "POST",
        "/session",
        &query,
        Some(Value::Object(request_body)),
        false,
    )?
    .ok_or_else(|| "OpenCode create session returned an empty response.".to_owned())
}

fn execute_opencode_turn(request: &NativeSessionTurnRequest) -> Result<NativeSessionTurnResult, String> {
    if !is_opencode_transport_available() {
        return Err(
            "OpenCode native transport is unavailable. Install `opencode` or set `OPENCODE_SERVER_URL` to an existing OpenCode server.".to_owned(),
        );
    }

    let raw_session_id = if let Some(native_session_id) = request.native_session_id.as_deref() {
        extract_native_lookup_id_for_engine(native_session_id, "opencode")?
    } else {
        let working_directory = request
            .working_directory
            .as_deref()
            .filter(|directory| directory.exists())
            .ok_or_else(|| {
                "OpenCode native session requires an existing project directory for session creation."
                    .to_owned()
            })?;
        let create_title = truncate_title(&request.input_summary);
        let created_session = opencode_create_session(working_directory, Some(create_title.as_str()))?;
        normalize_value_string(created_session.get("id"))
            .ok_or_else(|| "OpenCode create session response did not include an id.".to_owned())?
    };

    let mut request_body = serde_json::Map::new();
    request_body.insert(
        "agent".to_owned(),
        Value::String("build".to_owned()),
    );
    request_body.insert(
        "parts".to_owned(),
        Value::Array(vec![serde_json::json!({
            "type": "text",
            "text": build_native_turn_prompt(&request.request_kind, &request.input_summary),
        })]),
    );
    if let Some(model) = build_opencode_model_payload(request.model_id.as_deref()) {
        request_body.insert("model".to_owned(), model);
    }

    let prompt_path = format!("/session/{raw_session_id}/message");
    let prompt_response = opencode_request_json(
        "POST",
        prompt_path.as_str(),
        &[],
        Some(Value::Object(request_body)),
        false,
    )?
    .ok_or_else(|| "OpenCode prompt response was empty.".to_owned())?;
    let assistant_content = extract_opencode_prompt_content(&prompt_response).ok_or_else(|| {
        "OpenCode prompt response did not include an assistant message payload.".to_owned()
    })?;
    let resolved_session_id = normalize_value_string(
        prompt_response
            .get("info")
            .and_then(|info| info.get("sessionID")),
    )
    .unwrap_or(raw_session_id);

    Ok(NativeSessionTurnResult {
        assistant_content,
        native_session_id: Some(build_native_session_id("opencode", &resolved_session_id)),
    })
}

fn build_opencode_model_payload(model_id: Option<&str>) -> Option<Value> {
    let normalized_model_id = normalize_non_empty_string(model_id)?;
    if normalized_model_id.eq_ignore_ascii_case("opencode") {
        return None;
    }
    let (provider_id, model_id) = normalized_model_id.split_once('/')?;
    Some(serde_json::json!({
        "providerID": provider_id,
        "modelID": model_id,
    }))
}

fn build_opencode_session_summary(
    session: &Value,
    session_status_map: &BTreeMap<String, String>,
    model_id: Option<String>,
) -> Option<NativeSessionSummaryPayload> {
    let raw_session_id = normalize_value_string(session.get("id"))?;
    let created_at = timestamp_from_value_millis(session.get("time").and_then(|time| time.get("created")))
        .unwrap_or_else(|| timestamp_from_millis(0));
    let updated_at = timestamp_from_value_millis(session.get("time").and_then(|time| time.get("updated")))
        .unwrap_or_else(|| created_at.clone());
    let native_cwd = normalize_path_string(session.get("directory"));
    Some(NativeSessionSummaryPayload {
        created_at: created_at.clone(),
        id: build_native_session_id("opencode", raw_session_id.as_str()),
        workspace_id: String::new(),
        project_id: String::new(),
        title: normalize_value_string(session.get("title"))
            .unwrap_or_else(|| "OpenCode Session".to_owned()),
        status: map_opencode_session_status(session_status_map.get(&raw_session_id)),
        host_mode: "server".to_owned(),
        engine_id: "opencode".to_owned(),
        model_id,
        updated_at: updated_at.clone(),
        last_turn_at: Some(updated_at.clone()),
        kind: "coding".to_owned(),
        native_cwd,
        sort_timestamp: parse_timestamp_millis(&updated_at).unwrap_or_default(),
        transcript_updated_at: Some(updated_at),
    })
}

fn map_opencode_session_status(status: Option<&String>) -> String {
    match status.map(|value| value.as_str()) {
        Some("busy") => "active".to_owned(),
        Some("retry") => "paused".to_owned(),
        _ => "completed".to_owned(),
    }
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

fn build_opencode_message_payloads(
    coding_session_id: &str,
    messages: &[Value],
) -> Vec<NativeSessionMessagePayload> {
    messages
        .iter()
        .filter_map(|message| build_opencode_message_payload(coding_session_id, message))
        .collect()
}

fn build_opencode_message_payload(
    coding_session_id: &str,
    message: &Value,
) -> Option<NativeSessionMessagePayload> {
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

    Some(NativeSessionMessagePayload {
        id: format!("{coding_session_id}:native-message:{raw_message_id}"),
        coding_session_id: coding_session_id.to_owned(),
        turn_id: Some(raw_message_id),
        role: if role == "user" { role } else { "assistant".to_owned() },
        content,
        commands: if commands.is_empty() { None } else { Some(commands) },
        metadata,
        created_at: timestamp_from_value_millis(info.get("time").and_then(|time| time.get("created")))
            .unwrap_or_else(|| timestamp_from_millis(0)),
    })
}

fn extract_opencode_message_content(
    parts: &[Value],
    commands: &[NativeSessionCommandPayload],
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

fn extract_opencode_message_commands(parts: &[Value]) -> Vec<NativeSessionCommandPayload> {
    parts
        .iter()
        .filter_map(|part| {
            if part.get("type").and_then(Value::as_str) != Some("tool") {
                return None;
            }
            let tool_name = normalize_value_string(part.get("tool"))
                .unwrap_or_else(|| "tool".to_owned());
            let state = part.get("state");
            let state_status = normalize_value_string(state.and_then(|value| value.get("status")))
                .unwrap_or_else(|| "completed".to_owned());
            let title = normalize_value_string(state.and_then(|value| value.get("title")));
            let command = title
                .map(|title| format!("{tool_name}: {title}"))
                .unwrap_or(tool_name);
            Some(NativeSessionCommandPayload {
                command,
                status: map_opencode_tool_status(state_status.as_str()),
                output: normalize_value_string(state.and_then(|value| value.get("output")))
                    .or_else(|| normalize_value_string(state.and_then(|value| value.get("error")))),
            })
        })
        .collect()
}

fn map_opencode_tool_status(status: &str) -> String {
    match status {
        "completed" => "success".to_owned(),
        "error" => "error".to_owned(),
        "running" => "running".to_owned(),
        "pending" => "pending".to_owned(),
        _ => status.to_owned(),
    }
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

fn extract_opencode_prompt_content(prompt_response: &Value) -> Option<String> {
    let parts = prompt_response.get("parts")?.as_array()?.clone();
    let commands = extract_opencode_message_commands(&parts);
    Some(extract_opencode_message_content(&parts, commands.as_slice()))
}

fn opencode_request_json(
    method: &str,
    path: &str,
    query: &[(&str, String)],
    body: Option<Value>,
    allow_not_found: bool,
) -> Result<Option<Value>, String> {
    let base_url = ensure_opencode_server_base_url()?;
    let url = format!("{}{}", base_url.trim_end_matches('/'), path);
    let agent = ureq::agent();
    let request = match method {
        "GET" => agent.get(url.as_str()),
        "POST" => agent.post(url.as_str()),
        _ => {
            return Err(format!(
                "Unsupported OpenCode HTTP method \"{method}\" for {path}."
            ))
        }
    };
    let request = query
        .iter()
        .fold(request, |request, (key, value)| request.query(key, value.as_str()))
        .set("Accept", "application/json");
    let request = if let Some(authorization) = build_opencode_authorization_header() {
        request.set("Authorization", authorization.as_str())
    } else {
        request
    };

    let response = match body {
        Some(body) => {
            let serialized_body = body.to_string();
            request
                .set("Content-Type", "application/json")
                .send_string(serialized_body.as_str())
        }
        None => request.call(),
    };

    match response {
        Ok(response) => {
            let body = response
                .into_string()
                .map_err(|error| format!("read OpenCode response body for {path} failed: {error}"))?;
            if body.trim().is_empty() {
                Ok(Some(Value::Null))
            } else {
                serde_json::from_str::<Value>(&body)
                    .map(Some)
                    .map_err(|error| format!("parse OpenCode response body for {path} failed: {error}"))
            }
        }
        Err(ureq::Error::Status(404, response)) if allow_not_found => {
            let _ = response.into_string();
            Ok(None)
        }
        Err(ureq::Error::Status(status, response)) => {
            let body = response.into_string().unwrap_or_default();
            Err(format!(
                "OpenCode request {method} {path} failed with status {status}: {}",
                format_opencode_http_error(&body)
            ))
        }
        Err(ureq::Error::Transport(error)) => Err(format!(
            "OpenCode request {method} {path} failed: {error}"
        )),
    }
}

fn build_opencode_authorization_header() -> Option<String> {
    let password = std::env::var("OPENCODE_SERVER_PASSWORD")
        .ok()
        .and_then(|value| normalize_non_empty_string(Some(value.as_str())))?;
    let username = std::env::var("OPENCODE_SERVER_USERNAME")
        .ok()
        .and_then(|value| normalize_non_empty_string(Some(value.as_str())))
        .unwrap_or_else(|| "opencode".to_owned());
    Some(format!(
        "Basic {}",
        BASE64_STANDARD.encode(format!("{username}:{password}"))
    ))
}

fn format_opencode_http_error(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return "OpenCode server request failed.".to_owned();
    }

    if let Ok(parsed) = serde_json::from_str::<Value>(trimmed) {
        return parsed
            .get("data")
            .and_then(|data| normalize_value_string(data.get("message")))
            .or_else(|| normalize_value_string(parsed.get("error")))
            .or_else(|| normalize_value_string(parsed.get("message")))
            .unwrap_or_else(|| trimmed.to_owned());
    }

    trimmed.to_owned()
}

fn timestamp_from_value_millis(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::Number(number)) => {
            number
                .as_i64()
                .or_else(|| number.as_u64().map(|value| value as i64))
                .map(timestamp_from_millis)
        }
        _ => None,
    }
}

fn resolve_codex_home_directory() -> Option<PathBuf> {
    if let Some(explicit) = std::env::var_os("CODEX_HOME").map(PathBuf::from) {
        return Some(explicit);
    }

    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)?;
    Some(home.join(".codex"))
}

fn read_codex_session_index() -> Result<BTreeMap<String, SessionIndexEntry>, String> {
    let mut entries = BTreeMap::new();
    let Some(codex_home) = resolve_codex_home_directory() else {
        return Ok(entries);
    };

    let session_index_path = codex_home.join(CODEX_SESSION_INDEX_FILE_NAME);
    if !session_index_path.exists() {
        return Ok(entries);
    }

    let file = File::open(&session_index_path).map_err(|error| {
        format!(
            "open Codex session index {} failed: {error}",
            session_index_path.display()
        )
    })?;
    let reader = BufReader::new(file);

    for line in reader.lines() {
        let line = line.map_err(|error| {
            format!(
                "read Codex session index {} failed: {error}",
                session_index_path.display()
            )
        })?;
        if line.trim().is_empty() {
            continue;
        }

        let parsed = serde_json::from_str::<Value>(&line).map_err(|error| {
            format!(
                "parse Codex session index {} failed: {error}",
                session_index_path.display()
            )
        })?;
        let Some(id) = normalize_value_string(parsed.get("id")) else {
            continue;
        };
        entries.insert(
            id,
            SessionIndexEntry {
                thread_name: normalize_value_string(parsed.get("thread_name")),
                updated_at: normalize_timestamp(parsed.get("updated_at")),
            },
        );
    }

    Ok(entries)
}

fn list_codex_session_files() -> Result<Vec<PathBuf>, String> {
    let Some(codex_home) = resolve_codex_home_directory() else {
        return Ok(Vec::new());
    };
    let sessions_directory = codex_home.join(CODEX_SESSIONS_DIRECTORY_NAME);
    if !sessions_directory.exists() {
        return Ok(Vec::new());
    }

    let mut file_paths = Vec::new();
    collect_jsonl_files(&sessions_directory, &mut file_paths)?;
    Ok(file_paths)
}

fn collect_jsonl_files(directory: &FsPath, file_paths: &mut Vec<PathBuf>) -> Result<(), String> {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) => {
            return Err(format!(
                "read Codex session directory {} failed: {error}",
                directory.display()
            ))
        }
    };

    for entry in entries {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let path = entry.path();
        if path.is_dir() {
            collect_jsonl_files(&path, file_paths)?;
            continue;
        }
        if path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("jsonl"))
        {
            file_paths.push(path);
        }
    }

    Ok(())
}

fn parse_codex_session_summary(
    file_path: &FsPath,
    session_index: &BTreeMap<String, SessionIndexEntry>,
) -> Result<Option<NativeSessionSummaryPayload>, String> {
    Ok(parse_codex_session(file_path, session_index, false)?.map(|detail| detail.summary))
}

fn parse_codex_session_detail(
    file_path: &FsPath,
    session_index: &BTreeMap<String, SessionIndexEntry>,
) -> Result<Option<NativeSessionDetailPayload>, String> {
    parse_codex_session(file_path, session_index, true)
}

fn parse_codex_session(
    file_path: &FsPath,
    session_index: &BTreeMap<String, SessionIndexEntry>,
    include_messages: bool,
) -> Result<Option<NativeSessionDetailPayload>, String> {
    let file = match File::open(file_path) {
        Ok(file) => file,
        Err(_) => return Ok(None),
    };
    let reader = BufReader::new(file);
    let mut context = SessionLineContext::default();

    for line in reader.lines() {
        let line = match line {
            Ok(line) => line,
            Err(_) => continue,
        };
        if line.trim().is_empty() {
            continue;
        }
        let envelope = match serde_json::from_str::<Value>(&line) {
            Ok(envelope) => envelope,
            Err(_) => continue,
        };
        apply_codex_session_line(&mut context, &envelope, include_messages);
    }

    let summary = build_codex_summary(file_path, session_index, &context)?;
    let messages = if include_messages {
        dedupe_transcript_entries(&context.transcript_entries)
            .into_iter()
            .enumerate()
            .map(|(index, entry)| NativeSessionMessagePayload {
                id: format!("{}:native-message:{}", summary.id, index + 1),
                coding_session_id: summary.id.clone(),
                turn_id: entry.turn_id,
                role: entry.role,
                content: entry.content,
                commands: entry.commands,
                metadata: None,
                created_at: entry.created_at,
            })
            .collect()
    } else {
        Vec::new()
    };

    Ok(Some(NativeSessionDetailPayload { summary, messages }))
}

fn apply_codex_session_line(
    context: &mut SessionLineContext,
    envelope: &Value,
    include_messages: bool,
) {
    let envelope_type = normalize_value_string(envelope.get("type"));
    let timestamp = normalize_timestamp(envelope.get("timestamp"))
        .unwrap_or_else(|| "1970-01-01T00:00:00.000Z".to_owned());
    context.latest_timestamp = resolve_more_recent_timestamp(context.latest_timestamp.take(), Some(timestamp.clone()));

    match envelope_type.as_deref() {
        Some("session_meta") => {
            let payload = envelope.get("payload");
            context.native_session_id = normalize_value_string(payload.and_then(|payload| payload.get("id")))
                .or_else(|| context.native_session_id.clone());
            context.created_at = normalize_timestamp(payload.and_then(|payload| payload.get("timestamp")))
                .or_else(|| context.created_at.clone());
            context.native_cwd = normalize_path_string(payload.and_then(|payload| payload.get("cwd")))
                .or_else(|| context.native_cwd.clone());
            context.model_id = normalize_value_string(payload.and_then(|payload| payload.get("model")))
                .or_else(|| normalize_value_string(payload.and_then(|payload| payload.get("model_name"))))
                .or_else(|| normalize_value_string(payload.and_then(|payload| payload.get("model_provider"))))
                .or_else(|| context.model_id.clone());
        }
        Some("response_item") => {
            let payload = envelope.get("payload");
            let payload_type =
                normalize_value_string(payload.and_then(|payload| payload.get("type")));
            match payload_type.as_deref() {
                Some("message") => {
                    let role = normalize_value_string(payload.and_then(|payload| payload.get("role")));
                    let content = extract_message_text(payload.and_then(|payload| payload.get("content")));
                    if let (Some(role), Some(content)) = (role, content) {
                        if include_messages {
                            push_transcript_entry(
                                context,
                                TranscriptEntry {
                                    created_at: timestamp.clone(),
                                    role: if role == "user" || role == "assistant" {
                                        role.clone()
                                    } else {
                                        "assistant".to_owned()
                                    },
                                    content: content.clone(),
                                    turn_id: normalize_value_string(
                                        payload.and_then(|payload| payload.get("turnId")),
                                    )
                                    .or_else(|| {
                                        normalize_value_string(
                                            payload.and_then(|payload| payload.get("turn_id")),
                                        )
                                    }),
                                    commands: None,
                                },
                            );
                        }
                        if role == "user" {
                            if context.title.is_none() {
                                context.title = Some(truncate_title(&content));
                            }
                            context.latest_user_timestamp = Some(timestamp.clone());
                        }
                    }
                }
                Some("reasoning") => {
                    if !include_messages {
                        return;
                    }
                    if let Some(content) = extract_reasoning_text(payload) {
                        push_transcript_entry(
                            context,
                            TranscriptEntry {
                                created_at: timestamp,
                                role: "planner".to_owned(),
                                content,
                                turn_id: None,
                                commands: None,
                            },
                        );
                    }
                }
                _ => {}
            }
        }
        Some("event_msg") => {
            let payload = envelope.get("payload");
            let event_type = normalize_value_string(payload.and_then(|payload| payload.get("type")));
            match event_type.as_deref() {
                Some("task_started") => context.has_task_started = true,
                Some("task_complete") => context.has_task_complete = true,
                Some("turn_aborted") => context.has_turn_aborted = true,
                Some("error") => context.has_error = true,
                Some("user_message") => {
                    if !include_messages {
                        return;
                    }
                    if let Some(content) = extract_message_text(payload.and_then(|payload| payload.get("message")))
                        .or_else(|| extract_message_text(payload.and_then(|payload| payload.get("content"))))
                        .or_else(|| normalize_value_string(payload.and_then(|payload| payload.get("text"))))
                    {
                        push_transcript_entry(
                            context,
                            TranscriptEntry {
                                created_at: timestamp.clone(),
                                role: "user".to_owned(),
                                content: content.clone(),
                                turn_id: normalize_value_string(payload.and_then(|payload| payload.get("turnId")))
                                    .or_else(|| {
                                        normalize_value_string(
                                            payload.and_then(|payload| payload.get("turn_id")),
                                        )
                                    }),
                                commands: None,
                            },
                        );
                        if context.title.is_none() {
                            context.title = Some(truncate_title(&content));
                        }
                        context.latest_user_timestamp = Some(timestamp);
                    }
                }
                Some("agent_reasoning") => {
                    if !include_messages {
                        return;
                    }
                    if let Some(content) =
                        normalize_value_string(payload.and_then(|payload| payload.get("text")))
                    {
                        push_transcript_entry(
                            context,
                            TranscriptEntry {
                                created_at: timestamp,
                                role: "planner".to_owned(),
                                content,
                                turn_id: None,
                                commands: None,
                            },
                        );
                    }
                }
                Some("entered_review_mode") => {
                    if !include_messages {
                        return;
                    }
                    push_transcript_entry(
                        context,
                        TranscriptEntry {
                            created_at: timestamp,
                            role: "reviewer".to_owned(),
                            content: normalize_value_string(
                                payload.and_then(|payload| payload.get("user_facing_hint")),
                            )
                            .or_else(|| {
                                normalize_value_string(
                                    payload.and_then(|payload| payload.get("userFacingHint")),
                                )
                            })
                            .unwrap_or_else(|| "Review requested.".to_owned()),
                            turn_id: normalize_value_string(payload.and_then(|payload| payload.get("turnId")))
                                .or_else(|| {
                                    normalize_value_string(
                                        payload.and_then(|payload| payload.get("turn_id")),
                                    )
                                }),
                            commands: None,
                        },
                    );
                }
                Some("exited_review_mode") => {
                    if !include_messages {
                        return;
                    }
                    let content = payload
                        .and_then(|payload| payload.get("review_output"))
                        .and_then(|value| {
                            normalize_value_string(value.get("overall_explanation"))
                                .or_else(|| normalize_value_string(value.get("overallExplanation")))
                        })
                        .or_else(|| {
                            payload.and_then(|payload| payload.get("reviewOutput")).and_then(
                                |value| {
                                    normalize_value_string(value.get("overall_explanation"))
                                        .or_else(|| {
                                            normalize_value_string(
                                                value.get("overallExplanation"),
                                            )
                                        })
                                },
                            )
                        })
                        .unwrap_or_else(|| "Review completed.".to_owned());
                    push_transcript_entry(
                        context,
                        TranscriptEntry {
                            created_at: timestamp,
                            role: "reviewer".to_owned(),
                            content,
                            turn_id: normalize_value_string(payload.and_then(|payload| payload.get("turnId")))
                                .or_else(|| {
                                    normalize_value_string(
                                        payload.and_then(|payload| payload.get("turn_id")),
                                    )
                                }),
                            commands: None,
                        },
                    );
                }
                Some("exec_command_begin") | Some("exec_command_end") => {
                    if !include_messages {
                        return;
                    }
                    if let Some(command) = normalize_command_text(
                        payload.and_then(|payload| payload.get("command")),
                    )
                    .or_else(|| normalize_command_text(payload.and_then(|payload| payload.get("argv"))))
                    {
                        let is_success = payload
                            .and_then(|payload| payload.get("exit_code"))
                            .and_then(Value::as_i64)
                            .unwrap_or(0)
                            == 0;
                        let output = normalize_value_string(
                            payload.and_then(|payload| payload.get("stdout")),
                        )
                        .or_else(|| normalize_value_string(payload.and_then(|payload| payload.get("stderr"))));
                        if event_type.as_deref() == Some("exec_command_end") && !is_success {
                            context.has_error = true;
                        }
                        push_transcript_entry(
                            context,
                            TranscriptEntry {
                                created_at: timestamp,
                                role: "tool".to_owned(),
                                content: format!(
                                    "{}: {}",
                                    if event_type.as_deref() == Some("exec_command_begin") {
                                        "Command running"
                                    } else if is_success {
                                        "Command completed"
                                    } else {
                                        "Command failed"
                                    },
                                    command
                                ),
                                turn_id: normalize_value_string(payload.and_then(|payload| payload.get("turnId")))
                                    .or_else(|| {
                                        normalize_value_string(
                                            payload.and_then(|payload| payload.get("turn_id")),
                                        )
                                    }),
                                commands: Some(vec![NativeSessionCommandPayload {
                                    command,
                                    status: if event_type.as_deref() == Some("exec_command_begin") {
                                        "running".to_owned()
                                    } else if is_success {
                                        "success".to_owned()
                                    } else {
                                        "error".to_owned()
                                    },
                                    output,
                                }]),
                            },
                        );
                    }
                }
                _ => {}
            }
        }
        _ => {}
    }
}

fn build_codex_summary(
    file_path: &FsPath,
    session_index: &BTreeMap<String, SessionIndexEntry>,
    context: &SessionLineContext,
) -> Result<NativeSessionSummaryPayload, String> {
    let file_metadata = fs::metadata(file_path).map_err(|error| {
        format!(
            "read Codex session metadata {} failed: {error}",
            file_path.display()
        )
    })?;
    let file_modified_at = file_metadata
        .modified()
        .ok()
        .and_then(|timestamp| timestamp.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or_default();
    let file_modified_iso = timestamp_from_millis(file_modified_at);
    let raw_session_id = context
        .native_session_id
        .clone()
        .or_else(|| extract_session_id_from_file_path(file_path))
        .ok_or_else(|| {
            format!(
                "resolve native Codex session id from {} failed.",
                file_path.display()
            )
        })?;
    let summary_id = build_native_session_id("codex", raw_session_id.as_str());
    let index_entry = session_index.get(&raw_session_id).cloned().unwrap_or_default();
    let created_at = context
        .created_at
        .clone()
        .or_else(|| context.latest_timestamp.clone())
        .unwrap_or_else(|| file_modified_iso.clone());
    let updated_at = resolve_more_recent_timestamp(
        context.latest_timestamp.clone(),
        index_entry.updated_at.clone(),
    )
    .unwrap_or_else(|| file_modified_iso.clone());
    let last_turn_at = context
        .latest_user_timestamp
        .clone()
        .or_else(|| context.latest_timestamp.clone())
        .or_else(|| Some(updated_at.clone()));
    let title = index_entry
        .thread_name
        .or_else(|| context.title.clone())
        .unwrap_or_else(|| "Codex Session".to_owned());
    let status = if context.has_task_complete {
        "completed"
    } else if context.has_turn_aborted || context.has_error {
        "paused"
    } else if context.has_task_started {
        "active"
    } else {
        "completed"
    };
    let transcript_updated_at = context.latest_transcript_timestamp.clone();
    let mut summary = NativeSessionSummaryPayload {
        created_at,
        id: summary_id,
        workspace_id: String::new(),
        project_id: String::new(),
        title,
        status: status.to_owned(),
        host_mode: "desktop".to_owned(),
        engine_id: "codex".to_owned(),
        model_id: context
            .model_id
            .clone()
            .or_else(|| Some("codex".to_owned())),
        updated_at: updated_at.clone(),
        last_turn_at,
        kind: "coding".to_owned(),
        native_cwd: context.native_cwd.clone(),
        sort_timestamp: parse_timestamp_millis(&updated_at).unwrap_or(file_modified_at),
        transcript_updated_at,
    };
    attach_project_scope(&mut summary, &context.native_cwd, file_path, &[]);
    Ok(summary)
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
    let normalized_cwd = super::normalize_project_root_path_for_identity(native_cwd);
    projects
        .iter()
        .filter_map(|project| {
            let root_path = project.root_path.as_deref()?;
            let normalized_root = super::normalize_project_root_path_for_identity(root_path);
            if normalized_root.is_empty() {
                return None;
            }
            let is_match = normalized_cwd == normalized_root
                || normalized_cwd
                    .strip_prefix(normalized_root.as_str())
                    .is_some_and(|suffix| suffix.starts_with('/'));
            if !is_match {
                return None;
            }
            Some((normalized_root.len(), project))
        })
        .max_by(|left, right| left.0.cmp(&right.0))
        .map(|(_, project)| project)
}

fn dedupe_transcript_entries(entries: &[TranscriptEntry]) -> Vec<TranscriptEntry> {
    let mut deduped = Vec::new();
    for entry in entries {
        let Some(previous) = deduped.last() else {
            deduped.push(entry.clone());
            continue;
        };
        let is_duplicate = previous.role == entry.role
            && previous.content == entry.content
            && previous.turn_id == entry.turn_id
            && previous.commands == entry.commands
            && previous.created_at == entry.created_at;
        if !is_duplicate {
            deduped.push(entry.clone());
        }
    }
    deduped
}

fn push_transcript_entry(context: &mut SessionLineContext, entry: TranscriptEntry) {
    context.latest_transcript_timestamp = resolve_more_recent_timestamp(
        context.latest_transcript_timestamp.take(),
        Some(entry.created_at.clone()),
    );
    context.transcript_entries.push(entry);
}

fn extract_session_id_from_file_path(file_path: &FsPath) -> Option<String> {
    let stem = file_path.file_stem()?.to_str()?;
    let candidate = stem.rsplit('-').next()?;
    if candidate.trim().is_empty() {
        return None;
    }
    Some(candidate.trim().to_owned())
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

fn normalize_value_string(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(value)) => normalize_non_empty_string(Some(value.as_str())),
        Some(Value::Number(value)) => Some(value.to_string()),
        Some(Value::Bool(value)) => Some(value.to_string()),
        _ => None,
    }
}

fn normalize_timestamp(value: Option<&Value>) -> Option<String> {
    let value = normalize_value_string(value)?;
    parse_timestamp_millis(&value)?;
    Some(value)
}

fn normalize_path_string(value: Option<&Value>) -> Option<String> {
    let value = normalize_value_string(value)?;
    Some(value.replace('\\', "/"))
}

fn normalize_command_text(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(value)) => normalize_non_empty_string(Some(value.as_str())),
        Some(Value::Array(values)) => {
            let parts = values
                .iter()
                .filter_map(|value| normalize_value_string(Some(value)))
                .collect::<Vec<_>>();
            if parts.is_empty() {
                None
            } else {
                Some(parts.join(" "))
            }
        }
        _ => None,
    }
}

fn extract_reasoning_text(payload: Option<&Value>) -> Option<String> {
    let payload = payload?;
    if let Some(summary_items) = payload.get("summary").and_then(Value::as_array) {
        let parts = summary_items
            .iter()
            .filter_map(|item| normalize_value_string(item.get("text")))
            .collect::<Vec<_>>();
        if !parts.is_empty() {
            return Some(parts.join("\n"));
        }
    }

    extract_message_text(payload.get("content"))
        .or_else(|| normalize_value_string(payload.get("text")))
}

fn extract_message_text(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(value)) => normalize_non_empty_string(Some(value.as_str())),
        Some(Value::Array(values)) => {
            let parts = values
                .iter()
                .filter_map(|item| extract_message_text(Some(item)))
                .collect::<Vec<_>>();
            if parts.is_empty() {
                None
            } else {
                Some(parts.join("\n"))
            }
        }
        Some(Value::Object(object)) => {
            let type_name = object
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_ascii_lowercase();
            if matches!(
                type_name.as_str(),
                "input_text" | "output_text" | "text" | "summary_text"
            ) {
                return normalize_value_string(object.get("text"));
            }
            normalize_value_string(object.get("text"))
                .or_else(|| extract_message_text(object.get("content")))
                .or_else(|| extract_message_text(object.get("message")))
        }
        _ => None,
    }
}

fn truncate_title(value: &str) -> String {
    const TITLE_LIMIT: usize = 96;
    let collapsed = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.chars().count() <= TITLE_LIMIT {
        return collapsed;
    }

    collapsed.chars().take(TITLE_LIMIT).collect()
}

fn parse_timestamp_millis(value: &str) -> Option<i64> {
    let timestamp = value.trim();
    if timestamp.is_empty() {
        return None;
    }

    let parsed = chrono_like_to_millis(timestamp)?;
    Some(parsed)
}

fn chrono_like_to_millis(timestamp: &str) -> Option<i64> {
    let normalized = timestamp.trim();
    let parsed = time::OffsetDateTime::parse(
        normalized,
        &time::format_description::well_known::Rfc3339,
    )
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

fn resolve_more_recent_timestamp(left: Option<String>, right: Option<String>) -> Option<String> {
    match (left, right) {
        (Some(left), Some(right)) => {
            let left_millis = parse_timestamp_millis(&left).unwrap_or_default();
            let right_millis = parse_timestamp_millis(&right).unwrap_or_default();
            if left_millis >= right_millis {
                Some(left)
            } else {
                Some(right)
            }
        }
        (Some(left), None) => Some(left),
        (None, Some(right)) => Some(right),
        (None, None) => None,
    }
}

fn build_native_turn_prompt(request_kind: &str, input_summary: &str) -> String {
    if request_kind == "chat" {
        input_summary.to_owned()
    } else {
        format!("Request kind: {request_kind}\n\n{input_summary}")
    }
}

fn probe_command_available(mut command: Command, args: &[&str]) -> bool {
    command.args(args).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
    command.status().map(|status| status.success()).unwrap_or(false)
}

fn create_opencode_cli_command() -> Command {
    if cfg!(windows) {
        let mut command = Command::new("cmd");
        command.arg("/C").arg("opencode.cmd");
        command
    } else {
        Command::new("opencode")
    }
}

fn create_codex_cli_command() -> Command {
    if cfg!(windows) {
        let mut command = Command::new("cmd");
        command.arg("/C").arg("codex.cmd");
        command
    } else {
        Command::new("codex")
    }
}

fn execute_codex_cli_turn(request: &NativeSessionTurnRequest) -> Result<NativeSessionTurnResult, String> {
    let mut command = create_codex_cli_command();
    command.stdout(Stdio::piped()).stderr(Stdio::piped()).stdin(Stdio::piped());

    let native_session_id = request.native_session_id.as_deref().map(|session_id| {
        extract_native_lookup_id_for_engine(session_id, "codex")
            .unwrap_or_else(|_| session_id.to_owned())
    });

    if native_session_id.is_some() {
        command.arg("exec").arg("resume");
    } else {
        command.arg("exec");
    }

    command.arg("--json");
    if request.config.full_auto {
        command.arg("--full-auto");
    }
    if request.config.skip_git_repo_check {
        command.arg("--skip-git-repo-check");
    }
    if request.config.ephemeral {
        command.arg("--ephemeral");
    }
    if let Some(model_id) = normalize_non_empty_string(request.model_id.as_deref()) {
        command.arg("--model").arg(model_id);
    }
    if native_session_id.is_none() {
        if let Some(directory) = request
            .working_directory
            .as_deref()
            .filter(|directory| directory.exists())
        {
            command.arg("--cd").arg(directory);
            command.current_dir(directory);
        }
    } else if let Some(directory) = request
        .working_directory
        .as_deref()
        .filter(|directory| directory.exists())
    {
        command.current_dir(directory);
    }

    if let Some(native_session_id) = native_session_id.as_deref() {
        command.arg(native_session_id);
    }
    command.arg("-");

    let mut child = command
        .spawn()
        .map_err(|error| format!("spawn codex cli failed: {error}"))?;

    let prompt = build_native_turn_prompt(&request.request_kind, &request.input_summary);
    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(prompt.as_bytes())
            .map_err(|error| format!("write codex cli prompt failed: {error}"))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| format!("wait for codex cli failed: {error}"))?;
    let stdout = String::from_utf8(output.stdout)
        .map_err(|error| format!("decode codex cli stdout failed: {error}"))?;
    let stderr = String::from_utf8(output.stderr)
        .map_err(|error| format!("decode codex cli stderr failed: {error}"))?;

    let mut assistant_content: Option<String> = None;
    let mut resolved_native_session_id = request.native_session_id.clone();
    let mut turn_error: Option<String> = None;

    for line in stdout.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let parsed = serde_json::from_str::<Value>(line)
            .map_err(|error| format!("parse codex cli jsonl event failed: {error}; line: {line}"))?;

        if let Some(thread_id) = normalize_value_string(parsed.get("thread_id"))
            .or_else(|| normalize_value_string(parsed.get("threadId")))
        {
            resolved_native_session_id =
                Some(build_native_session_id("codex", thread_id.as_str()));
        }

        match parsed.get("type").and_then(Value::as_str) {
            Some("item.updated") | Some("item.completed") => {
                let item = parsed.get("item");
                if item
                    .and_then(|item| item.get("type"))
                    .and_then(Value::as_str)
                    == Some("agent_message")
                {
                    if let Some(text) = item
                        .and_then(|item| item.get("text"))
                        .and_then(Value::as_str)
                    {
                        assistant_content = Some(text.to_owned());
                    }
                }
            }
            Some("turn.failed") => {
                turn_error = parsed
                    .get("error")
                    .and_then(|error| error.get("message"))
                    .and_then(Value::as_str)
                    .map(str::to_owned)
                    .or(turn_error);
            }
            Some("error") => {
                turn_error = parsed
                    .get("message")
                    .and_then(Value::as_str)
                    .map(str::to_owned)
                    .or(turn_error);
            }
            _ => {}
        }
    }

    if let Some(turn_error) = turn_error {
        return Err(format_codex_cli_error(&turn_error));
    }

    if !output.status.success() {
        let detail = stderr.trim();
        return Err(if detail.is_empty() {
            format!("codex cli exited with status {}", output.status)
        } else {
            format!(
                "codex cli exited with status {}: {}",
                output.status,
                format_codex_cli_error(detail)
            )
        });
    }

    let assistant_content = assistant_content
        .ok_or_else(|| "Codex CLI did not return an assistant response.".to_owned())?;

    if request.config.sandbox_mode.is_some() || request.config.approval_policy.is_some() {
        // TODO: codex exec resume currently does not expose the full interactive sandbox/approval
        // switch set on every invocation; standard engine config abstractions are in place here so
        // future providers or newer Codex CLI versions can wire them without touching callers.
    }

    Ok(NativeSessionTurnResult {
        assistant_content,
        native_session_id: resolved_native_session_id,
    })
}

fn format_codex_cli_error(message: &str) -> String {
    let trimmed = message.trim();
    if is_codex_cli_authentication_error(trimmed) {
        "Codex CLI authentication is not configured. BirdCoder reuses your existing Codex auth from `CODEX_HOME` or `~/.codex`; if none is configured, set `OPENAI_API_KEY` or run `codex login --with-api-key`.".to_owned()
    } else if trimmed.is_empty() {
        "Codex CLI turn failed.".to_owned()
    } else {
        trimmed.to_owned()
    }
}

fn is_codex_cli_authentication_error(message: &str) -> bool {
    let normalized = message.trim().to_ascii_lowercase();
    normalized.contains("401 unauthorized")
        || normalized.contains("missing bearer or basic authentication")
        || normalized.contains("login")
        || normalized.contains("api key")
        || normalized.contains("authentication")
}
