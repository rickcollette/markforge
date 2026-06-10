use tauri::State;

use crate::models::errors::AppError;
use crate::models::workspace::SearchResult;
use crate::security::path_guard::PathGuard;
use crate::services::search_service;

#[tauri::command]
pub async fn search_workspace(
    guard: State<'_, PathGuard>,
    workspace_path: String,
    query: String,
    file_glob: Option<String>,
) -> Result<Vec<SearchResult>, AppError> {
    let root = guard.ensure(&workspace_path)?;
    tokio::task::spawn_blocking(move || {
        search_service::search_workspace(&root, &query, file_glob.as_deref())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}
