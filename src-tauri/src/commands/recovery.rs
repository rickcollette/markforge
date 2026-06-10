use crate::models::errors::AppError;
use crate::models::files::RecoverySnapshot;
use crate::services::recovery_service;

#[tauri::command]
pub async fn save_recovery_snapshot(
    document_id: String,
    content: String,
    path: Option<String>,
    title: Option<String>,
) -> Result<RecoverySnapshot, AppError> {
    tokio::task::spawn_blocking(move || {
        recovery_service::save_snapshot(&document_id, &content, path.as_deref(), title.as_deref())
    })
    .await
    .map_err(|e| AppError::Unknown(e.to_string()))?
}

#[tauri::command]
pub async fn list_recovery_snapshots() -> Result<Vec<RecoverySnapshot>, AppError> {
    recovery_service::list_snapshots()
}

#[tauri::command]
pub async fn restore_recovery_snapshot(snapshot_id: String) -> Result<String, AppError> {
    recovery_service::restore_snapshot(&snapshot_id)
}

#[tauri::command]
pub async fn delete_recovery_snapshot(snapshot_id: String) -> Result<(), AppError> {
    recovery_service::delete_snapshot(&snapshot_id)
}
