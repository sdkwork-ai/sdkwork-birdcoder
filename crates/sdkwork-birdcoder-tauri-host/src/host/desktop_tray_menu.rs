use std::collections::HashMap;
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, Runtime, Wry};

use super::desktop_lifecycle::{DesktopLifecycleState, MAIN_WINDOW_LABEL, TEST_MAIN_WINDOW_LABEL};

const TRAY_ICON_ID: &str = "birdcoder-main";
const TRAY_MENU_OPEN_ID: &str = "birdcoder-open";
const TRAY_MENU_QUIT_ID: &str = "birdcoder-quit";
const DESKTOP_TRAY_ACTION_EVENT: &str = "birdcoder-tray-action";
const MAX_RUNNING_SESSIONS: usize = 3;
const MAX_PINNED_SESSIONS: usize = 5;
const MAX_RECENT_SESSIONS: usize = 3;
const MAX_MORE_SESSIONS: usize = 50;
const MAX_SESSION_TITLE_CHARACTERS: usize = 15;
const MAX_PROJECT_NAME_CHARACTERS: usize = 22;
const MAX_MENU_LABEL_CHARACTERS: usize = 48;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopTraySessionMenuEntry {
    pub project_id: String,
    pub project_name: String,
    pub session_id: String,
    pub title: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopTraySessionMenuLabels {
    pub exit: String,
    pub more: String,
    pub new_chat: String,
    pub open_application: String,
    pub pinned: String,
    pub recent: String,
    pub running: String,
    pub untitled_session: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopTraySessionMenuSnapshot {
    pub labels: DesktopTraySessionMenuLabels,
    pub more: Vec<DesktopTraySessionMenuEntry>,
    pub new_chat_enabled: bool,
    pub pinned: Vec<DesktopTraySessionMenuEntry>,
    pub recent: Vec<DesktopTraySessionMenuEntry>,
    pub running: Vec<DesktopTraySessionMenuEntry>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "type")]
enum DesktopTrayAction {
    #[serde(rename = "newChat")]
    NewChat,
    #[serde(rename = "openSession")]
    OpenSession {
        #[serde(rename = "projectId")]
        project_id: String,
        #[serde(rename = "sessionId")]
        session_id: String,
    },
}

#[derive(Debug, Default)]
struct DesktopTrayMenuState {
    actions: HashMap<String, DesktopTrayAction>,
    revision: u64,
}

impl DesktopTrayMenuState {
    fn next_revision(&mut self) -> u64 {
        self.revision = self.revision.wrapping_add(1).max(1);
        self.revision
    }
}

#[derive(Debug, Default)]
struct DesktopTrayState {
    menu: Mutex<DesktopTrayMenuState>,
}

impl DesktopTrayState {
    fn next_menu_revision(&self) -> Result<u64, String> {
        let mut menu = self
            .menu
            .lock()
            .map_err(|_| "BirdCoder tray menu state is unavailable".to_string())?;
        Ok(menu.next_revision())
    }

    fn replace_actions(&self, actions: HashMap<String, DesktopTrayAction>) -> Result<(), String> {
        let mut menu = self
            .menu
            .lock()
            .map_err(|_| "BirdCoder tray menu state is unavailable".to_string())?;
        menu.actions = actions;
        Ok(())
    }

    fn resolve_action(&self, menu_item_id: &str) -> Result<Option<DesktopTrayAction>, String> {
        let menu = self
            .menu
            .lock()
            .map_err(|_| "BirdCoder tray menu state is unavailable".to_string())?;
        Ok(menu.actions.get(menu_item_id).cloned())
    }
}

fn show_main_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let Some(window) = app
        .get_webview_window(MAIN_WINDOW_LABEL)
        .or_else(|| app.get_webview_window(TEST_MAIN_WINDOW_LABEL))
    else {
        return Ok(());
    };
    window.unminimize()?;
    window.show()?;
    window.set_focus()?;
    Ok(())
}

fn should_show_window_for_tray_event(event: &TrayIconEvent) -> bool {
    matches!(
        event,
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } | TrayIconEvent::DoubleClick {
            button: MouseButton::Left,
            ..
        }
    )
}

fn normalize_menu_text(value: &str, max_characters: usize, fallback: &str) -> String {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let source = if normalized.is_empty() {
        fallback.trim()
    } else {
        normalized.as_str()
    };
    let characters = source.chars().collect::<Vec<_>>();
    if characters.len() <= max_characters {
        return source.to_string();
    }

    let prefix_length = max_characters.saturating_sub(3);
    format!(
        "{}...",
        characters[..prefix_length].iter().collect::<String>()
    )
}

fn escape_menu_mnemonics(value: &str) -> String {
    value.replace('&', "&&")
}

fn normalize_session_entries(
    entries: Vec<DesktopTraySessionMenuEntry>,
    limit: usize,
    untitled_session: &str,
) -> Vec<DesktopTraySessionMenuEntry> {
    entries
        .into_iter()
        .filter_map(|entry| {
            let project_id = entry.project_id.trim().to_string();
            let session_id = entry.session_id.trim().to_string();
            if project_id.is_empty() || session_id.is_empty() {
                return None;
            }

            Some(DesktopTraySessionMenuEntry {
                project_id,
                project_name: normalize_menu_text(
                    &entry.project_name,
                    MAX_PROJECT_NAME_CHARACTERS,
                    "BirdCoder",
                ),
                session_id,
                title: normalize_menu_text(
                    &entry.title,
                    MAX_SESSION_TITLE_CHARACTERS,
                    untitled_session,
                ),
            })
        })
        .take(limit)
        .collect()
}

fn session_menu_item_text(entry: &DesktopTraySessionMenuEntry) -> String {
    let title = escape_menu_mnemonics(&entry.title);
    let project_name = escape_menu_mnemonics(&entry.project_name);

    #[cfg(target_os = "windows")]
    {
        format!("{title}\t{project_name}")
    }

    #[cfg(not(target_os = "windows"))]
    {
        format!("{title}  \u{00b7}  {project_name}")
    }
}

fn append_separator(menu: &Menu<Wry>, app: &AppHandle) -> Result<(), String> {
    let separator = PredefinedMenuItem::separator(app)
        .map_err(|error| format!("failed to create BirdCoder tray separator: {error}"))?;
    menu.append(&separator)
        .map_err(|error| format!("failed to append BirdCoder tray separator: {error}"))
}

fn create_session_menu_item(
    app: &AppHandle,
    entry: &DesktopTraySessionMenuEntry,
    revision: u64,
    action_index: &mut usize,
    actions: &mut HashMap<String, DesktopTrayAction>,
) -> Result<MenuItem<Wry>, String> {
    let menu_item_id = format!("birdcoder-session-{revision}-{action_index}");
    *action_index += 1;
    let menu_item = MenuItem::with_id(
        app,
        &menu_item_id,
        session_menu_item_text(entry),
        true,
        None::<&str>,
    )
    .map_err(|error| format!("failed to create BirdCoder tray session item: {error}"))?;
    actions.insert(
        menu_item_id,
        DesktopTrayAction::OpenSession {
            project_id: entry.project_id.clone(),
            session_id: entry.session_id.clone(),
        },
    );
    Ok(menu_item)
}

fn append_session_section(
    menu: &Menu<Wry>,
    app: &AppHandle,
    section_id: &str,
    section_label: &str,
    entries: &[DesktopTraySessionMenuEntry],
    revision: u64,
    action_index: &mut usize,
    actions: &mut HashMap<String, DesktopTrayAction>,
) -> Result<(), String> {
    let heading = MenuItem::with_id(
        app,
        format!("birdcoder-heading-{revision}-{section_id}"),
        escape_menu_mnemonics(section_label),
        false,
        None::<&str>,
    )
    .map_err(|error| format!("failed to create BirdCoder tray section heading: {error}"))?;
    menu.append(&heading)
        .map_err(|error| format!("failed to append BirdCoder tray section heading: {error}"))?;

    for entry in entries {
        let item = create_session_menu_item(app, entry, revision, action_index, actions)?;
        menu.append(&item)
            .map_err(|error| format!("failed to append BirdCoder tray session item: {error}"))?;
    }
    Ok(())
}

fn build_desktop_tray_menu(
    app: &AppHandle,
    snapshot: DesktopTraySessionMenuSnapshot,
    revision: u64,
) -> Result<(Menu<Wry>, HashMap<String, DesktopTrayAction>), String> {
    let untitled_session = normalize_menu_text(
        &snapshot.labels.untitled_session,
        MAX_MENU_LABEL_CHARACTERS,
        "Untitled session",
    );
    let running =
        normalize_session_entries(snapshot.running, MAX_RUNNING_SESSIONS, &untitled_session);
    let pinned = normalize_session_entries(snapshot.pinned, MAX_PINNED_SESSIONS, &untitled_session);
    let recent = normalize_session_entries(snapshot.recent, MAX_RECENT_SESSIONS, &untitled_session);
    let more = normalize_session_entries(snapshot.more, MAX_MORE_SESSIONS, &untitled_session);
    let menu =
        Menu::new(app).map_err(|error| format!("failed to create BirdCoder tray menu: {error}"))?;
    let mut actions = HashMap::new();
    let mut action_index = 0;
    let mut has_session_section = false;

    if !running.is_empty() {
        append_session_section(
            &menu,
            app,
            "running",
            &normalize_menu_text(
                &snapshot.labels.running,
                MAX_MENU_LABEL_CHARACTERS,
                "Running",
            ),
            &running,
            revision,
            &mut action_index,
            &mut actions,
        )?;
        has_session_section = true;
    }

    if !pinned.is_empty() {
        if has_session_section {
            append_separator(&menu, app)?;
        }
        append_session_section(
            &menu,
            app,
            "pinned",
            &normalize_menu_text(&snapshot.labels.pinned, MAX_MENU_LABEL_CHARACTERS, "Pinned"),
            &pinned,
            revision,
            &mut action_index,
            &mut actions,
        )?;
        has_session_section = true;
    }

    if !recent.is_empty() {
        if has_session_section {
            append_separator(&menu, app)?;
        }
        append_session_section(
            &menu,
            app,
            "recent",
            &normalize_menu_text(&snapshot.labels.recent, MAX_MENU_LABEL_CHARACTERS, "Recent"),
            &recent,
            revision,
            &mut action_index,
            &mut actions,
        )?;
        has_session_section = true;
    }

    if !more.is_empty() {
        let more_submenu = Submenu::new(
            app,
            escape_menu_mnemonics(&normalize_menu_text(
                &snapshot.labels.more,
                MAX_MENU_LABEL_CHARACTERS,
                "More",
            )),
            true,
        )
        .map_err(|error| format!("failed to create BirdCoder tray More submenu: {error}"))?;
        for entry in &more {
            let item =
                create_session_menu_item(app, entry, revision, &mut action_index, &mut actions)?;
            more_submenu.append(&item).map_err(|error| {
                format!("failed to append BirdCoder tray More session item: {error}")
            })?;
        }
        menu.append(&more_submenu)
            .map_err(|error| format!("failed to append BirdCoder tray More submenu: {error}"))?;
        has_session_section = true;
    }

    if !has_session_section {
        let open_item = MenuItem::with_id(
            app,
            TRAY_MENU_OPEN_ID,
            escape_menu_mnemonics(&normalize_menu_text(
                &snapshot.labels.open_application,
                MAX_MENU_LABEL_CHARACTERS,
                "Open BirdCoder",
            )),
            true,
            None::<&str>,
        )
        .map_err(|error| format!("failed to create BirdCoder tray open item: {error}"))?;
        menu.append(&open_item)
            .map_err(|error| format!("failed to append BirdCoder tray open item: {error}"))?;
    }

    append_separator(&menu, app)?;
    let new_chat_id = format!("birdcoder-new-chat-{revision}");
    let new_chat_item = MenuItem::with_id(
        app,
        &new_chat_id,
        escape_menu_mnemonics(&normalize_menu_text(
            &snapshot.labels.new_chat,
            MAX_MENU_LABEL_CHARACTERS,
            "New Chat",
        )),
        snapshot.new_chat_enabled,
        None::<&str>,
    )
    .map_err(|error| format!("failed to create BirdCoder tray new chat item: {error}"))?;
    menu.append(&new_chat_item)
        .map_err(|error| format!("failed to append BirdCoder tray new chat item: {error}"))?;
    if snapshot.new_chat_enabled {
        actions.insert(new_chat_id, DesktopTrayAction::NewChat);
    }

    append_separator(&menu, app)?;
    let quit_item = MenuItem::with_id(
        app,
        TRAY_MENU_QUIT_ID,
        escape_menu_mnemonics(&normalize_menu_text(
            &snapshot.labels.exit,
            MAX_MENU_LABEL_CHARACTERS,
            "Exit",
        )),
        true,
        None::<&str>,
    )
    .map_err(|error| format!("failed to create BirdCoder tray exit item: {error}"))?;
    menu.append(&quit_item)
        .map_err(|error| format!("failed to append BirdCoder tray exit item: {error}"))?;

    Ok((menu, actions))
}

pub fn desktop_tray_update_menu(
    app: AppHandle,
    snapshot: DesktopTraySessionMenuSnapshot,
) -> Result<(), String> {
    let tray_state = app.state::<DesktopTrayState>();
    let revision = tray_state.next_menu_revision()?;
    let (menu, actions) = build_desktop_tray_menu(&app, snapshot, revision)?;
    let tray = app
        .tray_by_id(TRAY_ICON_ID)
        .ok_or_else(|| "BirdCoder system tray is unavailable".to_string())?;
    tray.set_menu(Some(menu))
        .map_err(|error| format!("failed to update BirdCoder tray menu: {error}"))?;
    tray_state.replace_actions(actions)
}

pub(crate) fn setup_desktop_tray(app: &AppHandle) -> Result<(), String> {
    app.manage(DesktopTrayState::default());

    let open_item = MenuItem::with_id(app, TRAY_MENU_OPEN_ID, "Open BirdCoder", true, None::<&str>)
        .map_err(|error| format!("failed to create BirdCoder tray open item: {error}"))?;
    let quit_item = MenuItem::with_id(app, TRAY_MENU_QUIT_ID, "Quit BirdCoder", true, None::<&str>)
        .map_err(|error| format!("failed to create BirdCoder tray quit item: {error}"))?;
    let separator = PredefinedMenuItem::separator(app)
        .map_err(|error| format!("failed to create BirdCoder tray separator: {error}"))?;
    let menu = Menu::with_items(app, &[&open_item, &separator, &quit_item])
        .map_err(|error| format!("failed to create BirdCoder tray menu: {error}"))?;
    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| "BirdCoder bundle icon is unavailable for the system tray".to_string())?;

    TrayIconBuilder::with_id(TRAY_ICON_ID)
        .icon(icon)
        .tooltip("SDKWork BirdCoder")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            let menu_item_id = event.id().as_ref();
            match menu_item_id {
                TRAY_MENU_OPEN_ID => {
                    if let Err(error) = show_main_window(app) {
                        eprintln!("failed to show BirdCoder main window: {error}");
                    }
                }
                TRAY_MENU_QUIT_ID => {
                    app.state::<DesktopLifecycleState>().request_explicit_exit();
                    app.exit(0);
                }
                _ => match app.state::<DesktopTrayState>().resolve_action(menu_item_id) {
                    Ok(Some(action)) => {
                        if let Err(error) = show_main_window(app) {
                            eprintln!("failed to show BirdCoder main window: {error}");
                            return;
                        }
                        if let Err(error) = app.emit(DESKTOP_TRAY_ACTION_EVENT, action) {
                            eprintln!("failed to dispatch BirdCoder tray action: {error}");
                        }
                    }
                    Ok(None) => {}
                    Err(error) => eprintln!("failed to resolve BirdCoder tray action: {error}"),
                },
            }
        })
        .on_tray_icon_event(|tray, event| {
            if should_show_window_for_tray_event(&event) {
                if let Err(error) = show_main_window(tray.app_handle()) {
                    eprintln!("failed to show BirdCoder main window from tray: {error}");
                }
            }
        })
        .build(app)
        .map_err(|error| format!("failed to create BirdCoder system tray: {error}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        normalize_menu_text, normalize_session_entries, DesktopTrayAction,
        DesktopTraySessionMenuEntry, MAX_PROJECT_NAME_CHARACTERS, MAX_SESSION_TITLE_CHARACTERS,
    };
    use serde_json::json;

    #[test]
    fn tray_menu_text_is_single_line_and_bounded() {
        assert_eq!(
            normalize_menu_text("  One\n  two  ", 20, "Fallback"),
            "One two"
        );
        assert_eq!(normalize_menu_text("", 20, "Fallback"), "Fallback");
        assert_eq!(normalize_menu_text("123456789", 8, "Fallback"), "12345...");
    }

    #[test]
    fn tray_session_entries_require_scoped_identity_and_respect_limits() {
        let entries = vec![
            DesktopTraySessionMenuEntry {
                project_id: "".to_string(),
                project_name: "Ignored".to_string(),
                session_id: "invalid".to_string(),
                title: "Invalid".to_string(),
            },
            DesktopTraySessionMenuEntry {
                project_id: " project.one ".to_string(),
                project_name: " Project One ".to_string(),
                session_id: " session.one ".to_string(),
                title: "".to_string(),
            },
            DesktopTraySessionMenuEntry {
                project_id: "project.two".to_string(),
                project_name: "Project Two".to_string(),
                session_id: "session.two".to_string(),
                title: "Second".to_string(),
            },
        ];

        let normalized = normalize_session_entries(entries, 1, "Untitled session");

        assert_eq!(normalized.len(), 1);
        assert_eq!(normalized[0].project_id, "project.one");
        assert_eq!(normalized[0].session_id, "session.one");
        assert_eq!(normalized[0].project_name, "Project One");
        assert_eq!(normalized[0].title, "Untitled session");
    }

    #[test]
    fn tray_session_columns_are_bounded_to_the_compact_menu_width() {
        let normalized = normalize_session_entries(
            vec![DesktopTraySessionMenuEntry {
                project_id: "project.one".to_string(),
                project_name: "p".repeat(80),
                session_id: "session.one".to_string(),
                title: "t".repeat(120),
            }],
            1,
            "Untitled session",
        );

        assert_eq!(
            normalized[0].title.chars().count(),
            MAX_SESSION_TITLE_CHARACTERS
        );
        assert_eq!(
            normalized[0].project_name.chars().count(),
            MAX_PROJECT_NAME_CHARACTERS
        );
        assert!(normalized[0].title.ends_with("..."));
        assert!(normalized[0].project_name.ends_with("..."));
    }

    #[test]
    fn tray_actions_serialize_as_the_renderer_contract() {
        assert_eq!(
            serde_json::to_value(DesktopTrayAction::NewChat).unwrap(),
            json!({ "type": "newChat" })
        );
        assert_eq!(
            serde_json::to_value(DesktopTrayAction::OpenSession {
                project_id: "project.one".to_string(),
                session_id: "session.one".to_string(),
            })
            .unwrap(),
            json!({
                "projectId": "project.one",
                "sessionId": "session.one",
                "type": "openSession",
            })
        );
    }
}
