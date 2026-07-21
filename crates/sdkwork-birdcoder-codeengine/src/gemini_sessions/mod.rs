mod project;
mod record;

use std::{
    collections::BTreeMap,
    env, fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};

use crate::{CodeEngineSessionDetailRecord, CodeEngineSessionSummaryRecord};

use self::{
    project::{load_gemini_project_registry, resolve_gemini_project_root},
    record::{
        build_gemini_session_detail, build_gemini_session_summary, read_gemini_conversation_record,
    },
};

pub const GEMINI_CLI_HOME_ENV: &str = "GEMINI_CLI_HOME";
pub const GEMINI_HOME_ENV: &str = "GEMINI_HOME";

#[derive(Clone, Debug)]
struct GeminiSessionFile {
    path: PathBuf,
    native_cwd: Option<String>,
    gemini_root: PathBuf,
    project_directory: PathBuf,
}

pub fn list_gemini_session_summaries() -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
    list_gemini_session_summaries_from_roots(gemini_home_directories().as_slice())
}

pub fn get_gemini_session_detail(
    raw_session_id: &str,
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    get_gemini_session_detail_from_roots(raw_session_id, gemini_home_directories().as_slice())
}

fn list_gemini_session_summaries_from_roots(
    roots: &[PathBuf],
) -> Result<Vec<CodeEngineSessionSummaryRecord>, String> {
    let mut summaries_by_id = BTreeMap::<String, CodeEngineSessionSummaryRecord>::new();

    for session_file in list_gemini_session_files(roots)? {
        let conversation = match read_gemini_conversation_record(session_file.path.as_path()) {
            Ok(conversation) => conversation,
            Err(error) => {
                tracing::debug!(
                    path = %session_file.path.display(),
                    error = %error,
                    "ignoring unreadable Gemini CLI session history file"
                );
                continue;
            }
        };
        let native_cwd = resolve_session_native_cwd(&session_file, &conversation);
        let Some(summary) = build_gemini_session_summary(&conversation, native_cwd.as_deref())
        else {
            continue;
        };

        match summaries_by_id.get(summary.id.as_str()) {
            Some(existing) if !gemini_summary_is_newer(&summary, existing) => {}
            _ => {
                summaries_by_id.insert(summary.id.clone(), summary);
            }
        }
    }

    let mut summaries = summaries_by_id.into_values().collect::<Vec<_>>();
    sort_gemini_session_summaries(&mut summaries);
    Ok(summaries)
}

fn get_gemini_session_detail_from_roots(
    raw_session_id: &str,
    roots: &[PathBuf],
) -> Result<Option<CodeEngineSessionDetailRecord>, String> {
    let raw_session_id = raw_session_id.trim();
    if raw_session_id.is_empty() {
        return Err("Gemini CLI session id is required.".to_owned());
    }

    let mut selected: Option<CodeEngineSessionDetailRecord> = None;
    for session_file in list_gemini_session_files(roots)? {
        let conversation = match read_gemini_conversation_record(session_file.path.as_path()) {
            Ok(conversation) => conversation,
            Err(_) => continue,
        };
        if conversation.session_id() != raw_session_id {
            continue;
        }

        let native_cwd = resolve_session_native_cwd(&session_file, &conversation);
        let Some(summary) = build_gemini_session_summary(&conversation, native_cwd.as_deref())
        else {
            continue;
        };
        let should_replace = selected
            .as_ref()
            .map(|detail| gemini_summary_is_newer(&summary, &detail.summary))
            .unwrap_or(true);
        if should_replace {
            selected = Some(build_gemini_session_detail(conversation, summary));
        }
    }

    Ok(selected)
}

fn list_gemini_session_files(roots: &[PathBuf]) -> Result<Vec<GeminiSessionFile>, String> {
    let mut files_by_path = BTreeMap::<String, GeminiSessionFile>::new();
    let mut readable_roots = 0usize;
    let mut root_errors = Vec::new();
    for root in roots {
        let registry = load_gemini_project_registry(root.as_path());
        let temp_directory = root.join("tmp");
        let project_entries = match fs::read_dir(&temp_directory) {
            Ok(entries) => entries,
            Err(error) if error.kind() == ErrorKind::NotFound => continue,
            Err(error) => {
                root_errors.push(format!("{}: {error}", temp_directory.display()));
                continue;
            }
        };
        readable_roots += 1;

        for project_entry in project_entries {
            let project_entry = match project_entry {
                Ok(entry) => entry,
                Err(error) => {
                    tracing::debug!(
                        root = %temp_directory.display(),
                        error = %error,
                        "ignoring unreadable Gemini CLI project history entry"
                    );
                    continue;
                }
            };
            if !project_entry
                .file_type()
                .map(|file_type| file_type.is_dir())
                .unwrap_or(false)
            {
                continue;
            }

            let project_directory = project_entry.path();
            let project_identifier = project_entry.file_name().to_string_lossy().into_owned();
            let chats_directory = project_directory.join("chats");
            let chat_entries = match fs::read_dir(&chats_directory) {
                Ok(entries) => entries,
                Err(error) if error.kind() == ErrorKind::NotFound => continue,
                Err(error) => {
                    tracing::debug!(
                        path = %chats_directory.display(),
                        error = %error,
                        "ignoring unreadable Gemini CLI chats directory"
                    );
                    continue;
                }
            };
            let native_cwd = resolve_gemini_project_root(
                root.as_path(),
                project_directory.as_path(),
                project_identifier.as_str(),
                &registry,
            );

            for chat_entry in chat_entries {
                let chat_entry = match chat_entry {
                    Ok(entry) => entry,
                    Err(_) => continue,
                };
                let path = chat_entry.path();
                if !is_gemini_session_file(path.as_path()) {
                    continue;
                }

                let path_key = normalize_path_key(path.as_path());
                files_by_path.insert(
                    path_key,
                    GeminiSessionFile {
                        path,
                        native_cwd: native_cwd.clone(),
                        gemini_root: root.clone(),
                        project_directory: project_directory.clone(),
                    },
                );
            }
        }
    }

    if readable_roots == 0 && !root_errors.is_empty() {
        return Err(format!(
            "read every configured Gemini CLI project history directory failed: {}",
            root_errors.join("; ")
        ));
    }

    Ok(files_by_path.into_values().collect())
}

fn resolve_session_native_cwd(
    session_file: &GeminiSessionFile,
    conversation: &record::GeminiConversationRecord,
) -> Option<String> {
    session_file.native_cwd.clone().or_else(|| {
        let project_hash = conversation.project_hash();
        if project_hash.is_empty() {
            return None;
        }
        let registry = load_gemini_project_registry(session_file.gemini_root.as_path());
        resolve_gemini_project_root(
            session_file.gemini_root.as_path(),
            session_file.project_directory.as_path(),
            project_hash,
            &registry,
        )
    })
}

fn gemini_home_directories() -> Vec<PathBuf> {
    let configured = [GEMINI_CLI_HOME_ENV, GEMINI_HOME_ENV]
        .into_iter()
        .filter_map(env::var_os)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .collect::<Vec<_>>();

    let candidates = if configured.is_empty() {
        default_user_home_directory()
            .map(|home| vec![home.join(".gemini")])
            .unwrap_or_default()
    } else {
        configured
            .into_iter()
            .flat_map(gemini_root_candidates_for_configured_home)
            .collect()
    };

    let mut roots_by_key = BTreeMap::<String, PathBuf>::new();
    for root in candidates {
        roots_by_key
            .entry(normalize_path_key(root.as_path()))
            .or_insert(root);
    }
    roots_by_key.into_values().collect()
}

fn gemini_root_candidates_for_configured_home(configured: PathBuf) -> Vec<PathBuf> {
    let looks_like_gemini_root = configured
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(".gemini"))
        || configured.join("tmp").exists()
        || configured.join("projects.json").exists();

    if looks_like_gemini_root {
        vec![configured.clone(), configured.join(".gemini")]
    } else {
        vec![configured.join(".gemini"), configured]
    }
}

fn default_user_home_directory() -> Option<PathBuf> {
    env::var_os("HOME")
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .or_else(|| {
            env::var_os("USERPROFILE")
                .filter(|value| !value.is_empty())
                .map(PathBuf::from)
        })
}

fn is_gemini_session_file(path: &Path) -> bool {
    path.is_file()
        && path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|value| {
                value.starts_with("session-")
                    && (value.ends_with(".json") || value.ends_with(".jsonl"))
            })
}

fn normalize_path_key(path: &Path) -> String {
    let normalized = path.to_string_lossy().replace('\\', "/");
    if cfg!(windows) {
        normalized.to_ascii_lowercase()
    } else {
        normalized
    }
}

fn gemini_summary_is_newer(
    candidate: &CodeEngineSessionSummaryRecord,
    existing: &CodeEngineSessionSummaryRecord,
) -> bool {
    candidate.sort_timestamp > existing.sort_timestamp
        || (candidate.sort_timestamp == existing.sort_timestamp
            && candidate.updated_at > existing.updated_at)
}

fn sort_gemini_session_summaries(summaries: &mut [CodeEngineSessionSummaryRecord]) {
    summaries.sort_by(|left, right| {
        right
            .sort_timestamp
            .cmp(&left.sort_timestamp)
            .then_with(|| left.id.cmp(&right.id))
    });
}

#[cfg(test)]
mod tests;
