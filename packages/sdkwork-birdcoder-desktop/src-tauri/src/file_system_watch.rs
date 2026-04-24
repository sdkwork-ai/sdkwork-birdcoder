use notify::{recommended_watcher, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicU64, Ordering},
        Mutex,
    },
};
use tauri::{AppHandle, Emitter, State};

const FILE_SYSTEM_WATCH_EVENT_NAME: &str = "birdcoder:file-system-watch";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileSystemWatchRegistration {
    pub watch_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct FileSystemWatchEventPayload {
    watch_id: String,
    kind: String,
    paths: Vec<String>,
}

struct ActiveFileSystemWatch {
    _watcher: RecommendedWatcher,
}

#[derive(Default)]
pub struct FileSystemWatchState {
    next_watch_id: AtomicU64,
    watchers: Mutex<HashMap<String, ActiveFileSystemWatch>>,
}

impl FileSystemWatchState {
    pub fn new() -> Self {
        Self::default()
    }
}

fn normalize_watch_event_kind(kind: &EventKind) -> &'static str {
    match kind {
        EventKind::Create(_) => "create",
        EventKind::Remove(_) => "remove",
        EventKind::Modify(notify::event::ModifyKind::Name(_)) => "rename",
        EventKind::Modify(_) => "modify",
        _ => "other",
    }
}

fn build_virtual_path_for_absolute_path(
    root_directory: &Path,
    root_virtual_path: &str,
    absolute_path: &Path,
) -> Option<String> {
    let relative_path = absolute_path.strip_prefix(root_directory).ok()?;
    if relative_path.as_os_str().is_empty() {
        return Some(root_virtual_path.to_string());
    }

    Some(super::build_virtual_path_from_relative(
        root_virtual_path,
        relative_path,
    ))
}

fn build_watch_event_payload(
    watch_id: &str,
    root_directory: &Path,
    root_virtual_path: &str,
    event: &Event,
) -> Option<FileSystemWatchEventPayload> {
    let mut paths = Vec::new();
    let mut seen_paths = HashSet::new();

    for path in &event.paths {
        let Some(virtual_path) =
            build_virtual_path_for_absolute_path(root_directory, root_virtual_path, path)
        else {
            continue;
        };

        if seen_paths.insert(virtual_path.clone()) {
            paths.push(virtual_path);
        }
    }

    if paths.is_empty() {
        return None;
    }

    Some(FileSystemWatchEventPayload {
        watch_id: watch_id.to_string(),
        kind: normalize_watch_event_kind(&event.kind).to_string(),
        paths,
    })
}

#[tauri::command]
pub fn fs_watch_start(
    app: AppHandle,
    state: State<'_, FileSystemWatchState>,
    root_path: String,
) -> Result<FileSystemWatchRegistration, String> {
    let root_directory = super::resolve_root_directory_path(&root_path)?;
    let root_virtual_path = format!("/{}", super::resolve_root_directory_name(&root_directory));
    let watch_id = format!(
        "fs-watch-{}",
        state.next_watch_id.fetch_add(1, Ordering::Relaxed) + 1
    );

    let app_handle = app.clone();
    let watch_id_for_events = watch_id.clone();
    let root_directory_for_events: PathBuf = root_directory.clone();
    let root_virtual_path_for_events = root_virtual_path.clone();
    let mut watcher = recommended_watcher(move |event_result| match event_result {
        Ok(event) => {
            let Some(payload) = build_watch_event_payload(
                &watch_id_for_events,
                &root_directory_for_events,
                &root_virtual_path_for_events,
                &event,
            ) else {
                return;
            };

            let _ = app_handle.emit(FILE_SYSTEM_WATCH_EVENT_NAME, payload);
        }
        Err(error) => {
            eprintln!(
                "failed to receive mounted file-system watch event for '{}': {error}",
                root_directory_for_events.display()
            );
        }
    })
    .map_err(|error| {
        format!(
            "failed to initialize mounted file-system watcher for '{}': {error}",
            root_directory.display()
        )
    })?;
    watcher
        .watch(&root_directory, RecursiveMode::Recursive)
        .map_err(|error| {
            format!(
                "failed to watch mounted root directory '{}': {error}",
                root_directory.display()
            )
        })?;

    state
        .watchers
        .lock()
        .map_err(|_| "file-system watch state mutex poisoned".to_string())?
        .insert(
            watch_id.clone(),
            ActiveFileSystemWatch { _watcher: watcher },
        );

    Ok(FileSystemWatchRegistration { watch_id })
}

#[tauri::command]
pub fn fs_watch_stop(
    state: State<'_, FileSystemWatchState>,
    watch_id: String,
) -> Result<(), String> {
    let normalized_watch_id = watch_id.trim();
    if normalized_watch_id.is_empty() {
        return Err("file-system watch id must not be empty".to_string());
    }

    state
        .watchers
        .lock()
        .map_err(|_| "file-system watch state mutex poisoned".to_string())?
        .remove(normalized_watch_id);

    Ok(())
}

