use crate::models::errors::AppError;
use crate::models::settings::AppSettings;
use crate::services::settings_service;

#[tauri::command]
pub async fn load_settings() -> Result<AppSettings, AppError> {
    settings_service::load_settings()
}

#[tauri::command]
pub async fn save_settings(settings: AppSettings) -> Result<(), AppError> {
    settings_service::save_settings(&settings)
}

/// Load an arbitrary JSON blob from the app data dir (session, recents...).
#[tauri::command]
pub async fn load_app_data(name: String) -> Result<Option<serde_json::Value>, AppError> {
    settings_service::load_json_blob(&name)
}

#[tauri::command]
pub async fn save_app_data(name: String, value: serde_json::Value) -> Result<(), AppError> {
    settings_service::save_json_blob(&name, &value)
}
