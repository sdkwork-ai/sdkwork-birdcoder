use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use serde_json::json;

use super::{get_gemini_session_detail_from_roots, list_gemini_session_summaries_from_roots};
use crate::gemini_sessions::project::legacy_project_hash;

const MAIN_SESSION_FIXTURE: &str = include_str!("../../tests/fixtures/gemini/session-main.json");

#[test]
fn gemini_history_fixture_builds_project_scoped_summary_and_detail() {
    let fixture = GeminiHistoryTestFixture::new("slug-summary-detail");
    let project_directory = fixture.root.join("tmp").join("sdkwork-birdcoder");
    write_project_marker(
        project_directory.as_path(),
        r"E:\sdkwork-space\sdkwork-birdcoder",
    );
    write_session_fixture(project_directory.as_path(), MAIN_SESSION_FIXTURE);

    let summaries = list_gemini_session_summaries_from_roots(std::slice::from_ref(&fixture.root))
        .expect("list Gemini fixture summaries");
    assert_eq!(summaries.len(), 1);
    let summary = &summaries[0];
    assert_eq!(summary.id, "gemini-session-main");
    assert_eq!(summary.engine_id, "gemini");
    assert_eq!(summary.model_id, "gemini-2.5-pro");
    assert_eq!(summary.title, "Align Gemini native session inventory");
    assert_eq!(
        summary.native_cwd.as_deref(),
        Some("E:/sdkwork-space/sdkwork-birdcoder")
    );
    assert_eq!(summary.updated_at, "2026-07-15T08:05:00.000Z");

    let detail = get_gemini_session_detail_from_roots(
        "gemini-session-main",
        std::slice::from_ref(&fixture.root),
    )
    .expect("get Gemini fixture detail")
    .expect("Gemini fixture detail exists");
    assert_eq!(detail.messages.len(), 2);
    assert_eq!(detail.messages[0].role, "user");
    assert_eq!(
        detail.messages[0].content,
        "Load every Gemini CLI session for this project."
    );
    assert_eq!(detail.messages[1].role, "assistant");
    let command = detail.messages[1]
        .commands
        .as_ref()
        .and_then(|commands| commands.first())
        .expect("Gemini tool command");
    assert_eq!(
        command.command,
        "cargo test -p sdkwork-birdcoder-codeengine"
    );
    assert_eq!(command.status, "success");
    assert_eq!(command.output.as_deref(), Some("test result: ok"));
}

#[test]
fn gemini_history_resolves_legacy_hash_directory_from_projects_registry() {
    let fixture = GeminiHistoryTestFixture::new("legacy-hash");
    let project_root = r"E:\legacy\GeminiProject";
    let legacy_hash = legacy_project_hash(project_root);
    let project_directory = fixture.root.join("tmp").join(legacy_hash);
    write_session_fixture(project_directory.as_path(), MAIN_SESSION_FIXTURE);
    fs::write(
        fixture.root.join("projects.json"),
        serde_json::to_vec_pretty(&json!({
            "projects": {
                project_root: "gemini-project"
            }
        }))
        .expect("serialize Gemini projects registry"),
    )
    .expect("write Gemini projects registry");

    let summaries = list_gemini_session_summaries_from_roots(std::slice::from_ref(&fixture.root))
        .expect("list legacy Gemini fixture summaries");
    assert_eq!(summaries.len(), 1);
    assert_eq!(
        summaries[0].native_cwd.as_deref(),
        Some("E:/legacy/GeminiProject")
    );
}

#[test]
fn gemini_history_skips_subagents_and_system_only_conversations() {
    let fixture = GeminiHistoryTestFixture::new("skip-non-main");
    let project_directory = fixture.root.join("tmp").join("project");
    write_project_marker(project_directory.as_path(), "E:/project");
    write_session_fixture(project_directory.as_path(), MAIN_SESSION_FIXTURE);
    write_named_session(
        project_directory.as_path(),
        "session-subagent.json",
        &MAIN_SESSION_FIXTURE.replace(
            "\"messages\": [",
            "\"kind\": \"subagent\",\n  \"messages\": [",
        ),
    );
    write_named_session(
        project_directory.as_path(),
        "session-system-only.json",
        &serde_json::to_string_pretty(&json!({
            "sessionId": "system-only",
            "projectHash": "project",
            "startTime": "2026-07-15T09:00:00.000Z",
            "lastUpdated": "2026-07-15T09:01:00.000Z",
            "messages": [{
                "id": "info-1",
                "timestamp": "2026-07-15T09:01:00.000Z",
                "type": "info",
                "content": "Update available."
            }]
        }))
        .expect("serialize system-only Gemini session"),
    );

    let summaries = list_gemini_session_summaries_from_roots(std::slice::from_ref(&fixture.root))
        .expect("list filtered Gemini fixture summaries");
    assert_eq!(summaries.len(), 1);
    assert_eq!(summaries[0].id, "gemini-session-main");
}

#[test]
fn gemini_history_keeps_newest_duplicate_raw_session_id() {
    let fixture = GeminiHistoryTestFixture::new("duplicate-id");
    let older_directory = fixture.root.join("tmp").join("older");
    let newer_directory = fixture.root.join("tmp").join("newer");
    write_project_marker(older_directory.as_path(), "E:/older");
    write_project_marker(newer_directory.as_path(), "E:/newer");
    write_session_fixture(older_directory.as_path(), MAIN_SESSION_FIXTURE);
    write_session_fixture(
        newer_directory.as_path(),
        &MAIN_SESSION_FIXTURE
            .replace("2026-07-15T08:05:00.000Z", "2026-07-15T10:05:00.000Z")
            .replace(
                "Align Gemini native session inventory",
                "Newest duplicate Gemini session",
            ),
    );

    let summaries = list_gemini_session_summaries_from_roots(std::slice::from_ref(&fixture.root))
        .expect("list duplicate Gemini fixture summaries");
    assert_eq!(summaries.len(), 1);
    assert_eq!(summaries[0].title, "Newest duplicate Gemini session");
    assert_eq!(summaries[0].native_cwd.as_deref(), Some("E:/newer"));
}

struct GeminiHistoryTestFixture {
    root: PathBuf,
}

impl GeminiHistoryTestFixture {
    fn new(label: &str) -> Self {
        static NEXT_FIXTURE_ID: AtomicU64 = AtomicU64::new(1);
        let unique = NEXT_FIXTURE_ID.fetch_add(1, Ordering::Relaxed);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "birdcoder-gemini-history-{label}-{}-{timestamp}-{unique}",
            std::process::id()
        ));
        fs::create_dir_all(&root).expect("create Gemini history fixture root");
        Self { root }
    }
}

impl Drop for GeminiHistoryTestFixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn write_project_marker(project_directory: &Path, project_root: &str) {
    fs::create_dir_all(project_directory).expect("create Gemini project fixture directory");
    fs::write(project_directory.join(".project_root"), project_root)
        .expect("write Gemini project root marker");
}

fn write_session_fixture(project_directory: &Path, contents: &str) {
    write_named_session(
        project_directory,
        "session-2026-07-15T08-00-gemini-s.json",
        contents,
    );
}

fn write_named_session(project_directory: &Path, file_name: &str, contents: &str) {
    let chats_directory = project_directory.join("chats");
    fs::create_dir_all(&chats_directory).expect("create Gemini chats fixture directory");
    fs::write(chats_directory.join(file_name), contents).expect("write Gemini session fixture");
}
