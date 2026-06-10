use tauri::State;

use crate::models::errors::AppError;
use crate::models::export::{DocxExportOptions, ExportResult, HtmlExportOptions};
use crate::security::path_guard::PathGuard;
use crate::services::{export_service, file_service};

#[tauri::command]
pub async fn export_markdown_to_html(
    markdown: String,
    rendered_html: Option<String>,
    options: HtmlExportOptions,
) -> Result<ExportResult, AppError> {
    tokio::task::spawn_blocking(move || {
        export_service::export_html(&markdown, rendered_html.as_deref(), &options)
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[tauri::command]
pub async fn export_markdown_to_docx(
    markdown: String,
    options: DocxExportOptions,
) -> Result<ExportResult, AppError> {
    tokio::task::spawn_blocking(move || export_service::export_docx(&markdown, &options))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}

/// Persist exported bytes to a user-chosen destination path.
#[tauri::command]
pub async fn save_exported_file(
    guard: State<'_, PathGuard>,
    path: String,
    bytes_base64: String,
) -> Result<(), AppError> {
    let path = guard.ensure(&path)?;
    let bytes = export_service::decode_b64(&bytes_base64)?;
    tokio::task::spawn_blocking(move || file_service::write_binary_file(&path, &bytes))
        .await
        .map_err(|e| AppError::Unknown(e.to_string()))?
}
