use serde::Deserialize;

#[derive(Debug, Clone, Default, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DesktopWorkingDirectoryPickerRequest {
    pub default_path: Option<String>,
    pub title: Option<String>,
}

#[tauri::command]
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

        Ok(dialog
            .pick_folder()
            .map(|path| path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|error| format!("failed to join working directory picker task: {error}"))?
}
