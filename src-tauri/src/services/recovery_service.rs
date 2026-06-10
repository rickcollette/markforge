use std::path::PathBuf;

use chrono::Utc;
use serde::{Deserialize, Serialize};

use crate::models::errors::AppError;
use crate::models::files::RecoverySnapshot;
use crate::services::settings_service;

#[derive(Debug, Serialize, Deserialize)]
struct SnapshotFile {
    id: String,
    document_id: String,
    path: Option<String>,
    title: Option<String>,
    created_at: String,
    content: String,
}

fn recovery_dir() -> Result<PathBuf, AppError> {
    let dir = settings_service::data_dir()?.join("recovery");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Save (or replace) the recovery snapshot for a document. One snapshot per
/// document id: newer content overwrites older.
pub fn save_snapshot(
    document_id: &str,
    content: &str,
    path: Option<&str>,
    title: Option<&str>,
) -> Result<RecoverySnapshot, AppError> {
    let dir = recovery_dir()?;
    let snapshot = SnapshotFile {
        id: document_id.to_string(),
        document_id: document_id.to_string(),
        path: path.map(str::to_string),
        title: title.map(str::to_string),
        created_at: Utc::now().to_rfc3339(),
        content: content.to_string(),
    };
    let file = dir.join(format!("{}.json", sanitize_id(document_id)?));
    std::fs::write(&file, serde_json::to_string(&snapshot)?)?;
    Ok(RecoverySnapshot {
        id: snapshot.id,
        document_id: snapshot.document_id,
        path: snapshot.path,
        title: snapshot.title,
        created_at: snapshot.created_at,
        size: content.len() as u64,
    })
}

pub fn list_snapshots() -> Result<Vec<RecoverySnapshot>, AppError> {
    let dir = recovery_dir()?;
    let mut snapshots = Vec::new();
    for entry in std::fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.extension().map(|e| e == "json").unwrap_or(false) {
            if let Ok(text) = std::fs::read_to_string(&path) {
                if let Ok(file) = serde_json::from_str::<SnapshotFile>(&text) {
                    snapshots.push(RecoverySnapshot {
                        size: file.content.len() as u64,
                        id: file.id,
                        document_id: file.document_id,
                        path: file.path,
                        title: file.title,
                        created_at: file.created_at,
                    });
                }
            }
        }
    }
    snapshots.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(snapshots)
}

pub fn restore_snapshot(snapshot_id: &str) -> Result<String, AppError> {
    let file = recovery_dir()?.join(format!("{}.json", sanitize_id(snapshot_id)?));
    if !file.exists() {
        return Err(AppError::FileNotFound(format!(
            "Recovery snapshot not found: {snapshot_id}"
        )));
    }
    let text = std::fs::read_to_string(&file)?;
    let snapshot: SnapshotFile = serde_json::from_str(&text)?;
    Ok(snapshot.content)
}

pub fn delete_snapshot(snapshot_id: &str) -> Result<(), AppError> {
    let file = recovery_dir()?.join(format!("{}.json", sanitize_id(snapshot_id)?));
    if file.exists() {
        std::fs::remove_file(file)?;
    }
    Ok(())
}

fn sanitize_id(id: &str) -> Result<&str, AppError> {
    if id.is_empty()
        || !id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::InvalidPath(format!("Invalid snapshot id: {id}")));
    }
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshot_roundtrip() {
        let id = format!("test-{}", uuid::Uuid::new_v4());
        save_snapshot(&id, "draft content", None, Some("Untitled")).unwrap();
        let listed = list_snapshots().unwrap();
        assert!(listed.iter().any(|s| s.id == id));
        let restored = restore_snapshot(&id).unwrap();
        assert_eq!(restored, "draft content");
        delete_snapshot(&id).unwrap();
        assert!(restore_snapshot(&id).is_err());
    }

    #[test]
    fn rejects_bad_ids() {
        assert!(save_snapshot("../evil", "x", None, None).is_err());
        assert!(restore_snapshot("a/b").is_err());
    }
}
