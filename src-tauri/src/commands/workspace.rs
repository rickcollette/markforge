use tauri::State;

use crate::models::errors::AppError;
use crate::models::workspace::{GitStatus, WorkspaceSettings, WorkspaceTree};
use crate::security::path_guard::PathGuard;
use crate::services::workspace_service::{self, WorkspaceWatcher};

/// Open a workspace folder: registers it as an allowed scope and returns
/// the scanned tree.
#[tauri::command]
pub async fn open_workspace(
    guard: State<'_, PathGuard>,
    path: String,
) -> Result<WorkspaceTree, AppError> {
    let root = guard.allow(&path)?;
    tokio::task::spawn_blocking(move || workspace_service::read_workspace(&root))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[tauri::command]
pub async fn read_workspace(
    guard: State<'_, PathGuard>,
    path: String,
) -> Result<WorkspaceTree, AppError> {
    let root = guard.ensure(&path)?;
    tokio::task::spawn_blocking(move || workspace_service::read_workspace(&root))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[tauri::command]
pub async fn watch_workspace(
    app: tauri::AppHandle,
    guard: State<'_, PathGuard>,
    watcher: State<'_, WorkspaceWatcher>,
    path: String,
) -> Result<(), AppError> {
    let root = guard.ensure(&path)?;
    watcher.watch(app, root)
}

#[tauri::command]
pub async fn unwatch_workspace(watcher: State<'_, WorkspaceWatcher>) -> Result<(), AppError> {
    watcher.unwatch();
    Ok(())
}

#[tauri::command]
pub async fn load_workspace_settings(
    guard: State<'_, PathGuard>,
    path: String,
) -> Result<WorkspaceSettings, AppError> {
    let root = guard.ensure(&path)?;
    workspace_service::load_workspace_settings(&root)
}

#[tauri::command]
pub async fn save_workspace_settings(
    guard: State<'_, PathGuard>,
    path: String,
    settings: WorkspaceSettings,
) -> Result<(), AppError> {
    let root = guard.ensure(&path)?;
    workspace_service::save_workspace_settings(&root, &settings)
}

#[tauri::command]
pub async fn git_status(guard: State<'_, PathGuard>, path: String) -> Result<GitStatus, AppError> {
    let root = guard.ensure(&path)?;
    tokio::task::spawn_blocking(move || Ok(workspace_service::git_status(&root)))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}
