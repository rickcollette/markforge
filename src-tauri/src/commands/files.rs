use tauri::State;

use crate::models::errors::AppError;
use crate::models::files::{FileEntry, TextFileResponse};
use crate::security::path_guard::PathGuard;
use crate::services::file_service;

/// Register a user-selected file or folder (returned from a native dialog)
/// as an allowed filesystem scope. Returns the normalized absolute path.
#[tauri::command]
pub fn allow_path(guard: State<'_, PathGuard>, path: String) -> Result<String, AppError> {
    let normalized = guard.allow(&path)?;
    Ok(normalized.to_string_lossy().into_owned())
}

#[tauri::command]
pub async fn read_text_file(
    guard: State<'_, PathGuard>,
    path: String,
) -> Result<TextFileResponse, AppError> {
    let path = guard.ensure(&path)?;
    tokio::task::spawn_blocking(move || file_service::read_text_file(&path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[tauri::command]
pub async fn write_text_file(
    guard: State<'_, PathGuard>,
    path: String,
    content: String,
) -> Result<(), AppError> {
    let path = guard.ensure(&path)?;
    tokio::task::spawn_blocking(move || file_service::write_text_file(&path, &content))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[tauri::command]
pub async fn create_file(
    guard: State<'_, PathGuard>,
    path: String,
    content: Option<String>,
) -> Result<(), AppError> {
    let path = guard.ensure(&path)?;
    file_service::create_file(&path, content.as_deref())
}

#[tauri::command]
pub async fn create_directory(guard: State<'_, PathGuard>, path: String) -> Result<(), AppError> {
    let path = guard.ensure(&path)?;
    file_service::create_directory(&path)
}

#[tauri::command]
pub async fn delete_file(guard: State<'_, PathGuard>, path: String) -> Result<(), AppError> {
    let path = guard.ensure(&path)?;
    file_service::delete_path(&path)
}

#[tauri::command]
pub async fn rename_file(
    guard: State<'_, PathGuard>,
    old_path: String,
    new_path: String,
) -> Result<(), AppError> {
    let old_path = guard.ensure(&old_path)?;
    let new_path = guard.ensure(&new_path)?;
    file_service::rename_path(&old_path, &new_path)
}

#[tauri::command]
pub async fn duplicate_file(guard: State<'_, PathGuard>, path: String) -> Result<String, AppError> {
    let path = guard.ensure(&path)?;
    file_service::duplicate_file(&path)
}

#[tauri::command]
pub async fn copy_file_into(
    guard: State<'_, PathGuard>,
    source: String,
    dest_dir: String,
) -> Result<String, AppError> {
    let source = guard.ensure(&source)?;
    let dest_dir = guard.ensure(&dest_dir)?;
    file_service::copy_file_into(&source, &dest_dir)
}

#[tauri::command]
pub async fn list_directory(
    guard: State<'_, PathGuard>,
    path: String,
) -> Result<Vec<FileEntry>, AppError> {
    let path = guard.ensure(&path)?;
    file_service::list_directory(&path)
}

#[tauri::command]
pub async fn file_exists(guard: State<'_, PathGuard>, path: String) -> Result<bool, AppError> {
    match guard.ensure(&path) {
        Ok(p) => Ok(p.exists()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub async fn write_binary_file(
    guard: State<'_, PathGuard>,
    path: String,
    bytes_base64: String,
) -> Result<(), AppError> {
    let path = guard.ensure(&path)?;
    let bytes = crate::services::export_service::decode_b64(&bytes_base64)?;
    tokio::task::spawn_blocking(move || file_service::write_binary_file(&path, &bytes))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[tauri::command]
pub async fn read_binary_file(
    guard: State<'_, PathGuard>,
    path: String,
) -> Result<String, AppError> {
    use base64::Engine;
    let path = guard.ensure(&path)?;
    let bytes = tokio::task::spawn_blocking(move || std::fs::read(&path))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
        .map_err(AppError::from)?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}
