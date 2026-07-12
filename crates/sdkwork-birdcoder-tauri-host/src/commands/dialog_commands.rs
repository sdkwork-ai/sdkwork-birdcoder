use serde::Deserialize;
use std::path::Path;
use std::process::Command;

use super::filesystem_commands::{register_allowed_fs_root, resolve_allowed_existing_path};

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopWorkingDirectoryPickerRequest {
    pub default_path: Option<String>,
    pub title: Option<String>,
}

#[tauri::command]
#[cfg(not(test))]
pub async fn desktop_pick_working_directory(
    window: tauri::Window,
    request: DesktopWorkingDirectoryPickerRequest,
) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = rfd::FileDialog::new().set_parent(&window);
        if let Some(default_path) = request
            .default_path
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            dialog = dialog.set_directory(default_path);
        }
        if let Some(title) = request
            .title
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        {
            dialog = dialog.set_title(title);
        }

        let Some(path) = dialog.pick_folder() else {
            return Ok(None);
        };
        register_allowed_fs_root(path.clone())
            .map_err(|_| "selected directory could not be authorized".to_string())?;
        Ok(Some(path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|error| format!("failed to join working directory picker task: {error}"))?
}

#[tauri::command]
#[cfg(test)]
pub async fn desktop_pick_working_directory(
    _window: tauri::Window,
    _request: DesktopWorkingDirectoryPickerRequest,
) -> Result<Option<String>, String> {
    Err("native directory picker is unavailable in unit tests".to_string())
}

fn reveal_in_file_manager(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let status = if path.is_dir() {
        Command::new("explorer.exe").arg(path).status()
    } else {
        Command::new("explorer.exe")
            .arg("/select,")
            .arg(path)
            .status()
    };

    #[cfg(target_os = "macos")]
    let status = if path.is_dir() {
        Command::new("open").arg(path).status()
    } else {
        Command::new("open").arg("-R").arg(path).status()
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let status = Command::new("xdg-open")
        .arg(if path.is_dir() {
            path
        } else {
            path.parent()
                .ok_or_else(|| "file manager target has no parent directory".to_string())?
        })
        .status();

    let status = status.map_err(|_| "failed to start the system file manager".to_string())?;
    if !status.success() {
        return Err("system file manager rejected the reveal request".to_string());
    }
    Ok(())
}

#[tauri::command]
pub async fn desktop_reveal_in_file_manager(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let resolved_path = resolve_allowed_existing_path(&path)?;
        reveal_in_file_manager(&resolved_path)
    })
    .await
    .map_err(|error| format!("failed to join file manager reveal task: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reveal_target_must_be_inside_an_authorized_root() {
        let nonce = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("test clock must be after Unix epoch")
            .as_nanos();
        let fixture_root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-reveal-root-{}-{nonce}",
            std::process::id()
        ));
        let unauthorized_root = std::env::temp_dir().join(format!(
            "sdkwork-birdcoder-reveal-unauthorized-{}-{nonce}",
            std::process::id()
        ));
        std::fs::create_dir_all(&fixture_root).expect("authorized fixture root");
        std::fs::create_dir_all(&unauthorized_root).expect("unauthorized fixture root");
        let fixture_file = fixture_root.join("main.rs");
        std::fs::write(&fixture_file, "fn main() {}\n").expect("authorized fixture file");

        register_allowed_fs_root(fixture_root.clone()).expect("register authorized fixture root");
        assert_eq!(
            resolve_allowed_existing_path(&fixture_file.to_string_lossy())
                .expect("authorized descendant must resolve"),
            fixture_file.canonicalize().expect("canonical fixture file")
        );
        assert!(
            resolve_allowed_existing_path(&unauthorized_root.to_string_lossy()).is_err(),
            "unregistered paths must not be revealed"
        );

        let _ = std::fs::remove_dir_all(fixture_root);
        let _ = std::fs::remove_dir_all(unauthorized_root);
    }
}
