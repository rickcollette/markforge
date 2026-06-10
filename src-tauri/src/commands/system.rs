use crate::models::errors::AppError;

#[tauri::command]
pub async fn toggle_devtools(window: tauri::WebviewWindow) -> Result<(), AppError> {
    #[cfg(debug_assertions)]
    {
        if window.is_devtools_open() {
            window.close_devtools();
        } else {
            window.open_devtools();
        }
    }
    #[cfg(not(debug_assertions))]
    {
        let _ = window;
    }
    Ok(())
}

#[tauri::command]
pub fn app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Returns (and clears) files passed on the command line, e.g. when the app
/// is launched through a file association. Paths are already allowed in the
/// path guard.
#[tauri::command]
pub fn take_startup_files(state: tauri::State<'_, crate::StartupFiles>) -> Vec<String> {
    std::mem::take(&mut *state.0.lock().unwrap())
}
