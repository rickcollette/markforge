use std::path::PathBuf;

use crate::models::errors::AppError;
use crate::models::settings::AppSettings;

pub fn config_dir() -> Result<PathBuf, AppError> {
    let dir = dirs::config_dir()
        .ok_or_else(|| AppError::Unknown("Could not resolve config directory".into()))?
        .join("MarkForge");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn data_dir() -> Result<PathBuf, AppError> {
    let dir = dirs::data_dir()
        .ok_or_else(|| AppError::Unknown("Could not resolve data directory".into()))?
        .join("MarkForge");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn settings_path() -> Result<PathBuf, AppError> {
    Ok(config_dir()?.join("settings.json"))
}

pub fn load_settings() -> Result<AppSettings, AppError> {
    let path = settings_path()?;
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let text = std::fs::read_to_string(&path)?;
    // Tolerate a corrupt settings file: fall back to defaults rather than
    // refusing to start.
    Ok(serde_json::from_str(&text).unwrap_or_default())
}

pub fn save_settings(settings: &AppSettings) -> Result<(), AppError> {
    let path = settings_path()?;
    let text = serde_json::to_string_pretty(settings)?;
    std::fs::write(path, text)?;
    Ok(())
}

/// Generic JSON blob persistence in the app data dir (session state,
/// recent files, export history, user snippets...).
pub fn load_json_blob(name: &str) -> Result<Option<serde_json::Value>, AppError> {
    validate_blob_name(name)?;
    let path = data_dir()?.join(format!("{name}.json"));
    if !path.exists() {
        return Ok(None);
    }
    let text = std::fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&text).ok())
}

pub fn save_json_blob(name: &str, value: &serde_json::Value) -> Result<(), AppError> {
    validate_blob_name(name)?;
    let path = data_dir()?.join(format!("{name}.json"));
    std::fs::write(path, serde_json::to_string_pretty(value)?)?;
    Ok(())
}

fn validate_blob_name(name: &str) -> Result<(), AppError> {
    if name.is_empty()
        || !name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::InvalidPath(format!("Invalid blob name: {name}")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_settings_roundtrip() {
        let settings = AppSettings::default();
        let json = serde_json::to_string(&settings).unwrap();
        let parsed: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.editor.font_size, 14);
        assert_eq!(parsed.editor.auto_save_delay_ms, 750);
        assert!(parsed.preview.sanitize_html);
        assert_eq!(parsed.mermaid.security_level, "strict");
    }

    #[test]
    fn partial_settings_fill_defaults() {
        let parsed: AppSettings =
            serde_json::from_str(r#"{"editor": {"fontSize": 18}}"#).unwrap();
        assert_eq!(parsed.editor.font_size, 18);
        assert_eq!(parsed.editor.tab_size, 2);
    }

    #[test]
    fn blob_name_validation() {
        assert!(validate_blob_name("session").is_ok());
        assert!(validate_blob_name("../evil").is_err());
        assert!(validate_blob_name("").is_err());
    }
}
