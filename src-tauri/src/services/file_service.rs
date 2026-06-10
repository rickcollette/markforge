use std::path::Path;

use chrono::{DateTime, Utc};

use crate::models::errors::AppError;
use crate::models::files::{FileEntry, TextFileResponse};

pub fn detect_line_ending(content: &str) -> &'static str {
    if content.contains("\r\n") {
        "crlf"
    } else {
        "lf"
    }
}

pub fn modified_at_iso(path: &Path) -> Option<String> {
    let meta = std::fs::metadata(path).ok()?;
    let modified = meta.modified().ok()?;
    let dt: DateTime<Utc> = modified.into();
    Some(dt.to_rfc3339())
}

pub fn read_text_file(path: &Path) -> Result<TextFileResponse, AppError> {
    let bytes = std::fs::read(path)?;
    // Strip a UTF-8 BOM if present; treat everything as UTF-8 (lossy for
    // odd encodings so the user can still open the file).
    let bytes = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
        bytes[3..].to_vec()
    } else {
        bytes
    };
    let content = String::from_utf8_lossy(&bytes).into_owned();
    Ok(TextFileResponse {
        path: path.to_string_lossy().into_owned(),
        line_ending: detect_line_ending(&content).into(),
        encoding: "utf-8".into(),
        modified_at: modified_at_iso(path),
        content,
    })
}

pub fn write_text_file(path: &Path, content: &str) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, content.as_bytes())?;
    Ok(())
}

pub fn create_file(path: &Path, content: Option<&str>) -> Result<(), AppError> {
    if path.exists() {
        return Err(AppError::Io(format!(
            "File already exists: {}",
            path.display()
        )));
    }
    write_text_file(path, content.unwrap_or(""))
}

pub fn create_directory(path: &Path) -> Result<(), AppError> {
    std::fs::create_dir_all(path)?;
    Ok(())
}

pub fn delete_path(path: &Path) -> Result<(), AppError> {
    if !path.exists() {
        return Err(AppError::FileNotFound(path.display().to_string()));
    }
    if path.is_dir() {
        std::fs::remove_dir_all(path)?;
    } else {
        std::fs::remove_file(path)?;
    }
    Ok(())
}

pub fn rename_path(old_path: &Path, new_path: &Path) -> Result<(), AppError> {
    if !old_path.exists() {
        return Err(AppError::FileNotFound(old_path.display().to_string()));
    }
    if new_path.exists() {
        return Err(AppError::Io(format!(
            "Target already exists: {}",
            new_path.display()
        )));
    }
    if let Some(parent) = new_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::rename(old_path, new_path)?;
    Ok(())
}

pub fn duplicate_file(path: &Path) -> Result<String, AppError> {
    if !path.is_file() {
        return Err(AppError::FileNotFound(path.display().to_string()));
    }
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "copy".into());
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    for i in 1..1000 {
        let candidate = if i == 1 {
            parent.join(format!("{stem} copy{ext}"))
        } else {
            parent.join(format!("{stem} copy {i}{ext}"))
        };
        if !candidate.exists() {
            std::fs::copy(path, &candidate)?;
            return Ok(candidate.to_string_lossy().into_owned());
        }
    }
    Err(AppError::Io("Could not find a free duplicate name".into()))
}

pub fn copy_file_into(source: &Path, dest_dir: &Path) -> Result<String, AppError> {
    if !source.is_file() {
        return Err(AppError::FileNotFound(source.display().to_string()));
    }
    std::fs::create_dir_all(dest_dir)?;
    let name = source
        .file_name()
        .ok_or_else(|| AppError::InvalidPath(source.display().to_string()))?;
    let mut target = dest_dir.join(name);
    let stem = target
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let ext = target
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let mut i = 1;
    while target.exists() {
        target = dest_dir.join(format!("{stem}-{i}{ext}"));
        i += 1;
    }
    std::fs::copy(source, &target)?;
    Ok(target.to_string_lossy().into_owned())
}

pub fn write_binary_file(path: &Path, bytes: &[u8]) -> Result<(), AppError> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, bytes)?;
    Ok(())
}

pub fn file_entry(path: &Path) -> Result<FileEntry, AppError> {
    let meta = std::fs::metadata(path)?;
    Ok(FileEntry {
        name: path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_default(),
        path: path.to_string_lossy().into_owned(),
        is_dir: meta.is_dir(),
        extension: path
            .extension()
            .map(|e| e.to_string_lossy().into_owned().to_lowercase()),
        size: if meta.is_file() { Some(meta.len()) } else { None },
        modified_at: modified_at_iso(path),
    })
}

pub fn list_directory(path: &Path) -> Result<Vec<FileEntry>, AppError> {
    if !path.is_dir() {
        return Err(AppError::InvalidPath(format!(
            "Not a directory: {}",
            path.display()
        )));
    }
    let mut entries: Vec<FileEntry> = Vec::new();
    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        if let Ok(fe) = file_entry(&entry.path()) {
            entries.push(fe);
        }
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("markforge-fs-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn roundtrip_read_write() {
        let dir = temp_dir();
        let file = dir.join("a.md");
        write_text_file(&file, "# Hello\r\nWorld").unwrap();
        let resp = read_text_file(&file).unwrap();
        assert_eq!(resp.content, "# Hello\r\nWorld");
        assert_eq!(resp.line_ending, "crlf");
        assert_eq!(resp.encoding, "utf-8");
    }

    #[test]
    fn detects_lf() {
        assert_eq!(detect_line_ending("a\nb"), "lf");
        assert_eq!(detect_line_ending("a\r\nb"), "crlf");
    }

    #[test]
    fn create_fails_if_exists() {
        let dir = temp_dir();
        let file = dir.join("a.md");
        create_file(&file, Some("x")).unwrap();
        assert!(create_file(&file, None).is_err());
    }

    #[test]
    fn rename_and_delete() {
        let dir = temp_dir();
        let a = dir.join("a.md");
        let b = dir.join("b.md");
        create_file(&a, Some("x")).unwrap();
        rename_path(&a, &b).unwrap();
        assert!(!a.exists());
        assert!(b.exists());
        delete_path(&b).unwrap();
        assert!(!b.exists());
    }

    #[test]
    fn duplicate_creates_copy() {
        let dir = temp_dir();
        let a = dir.join("a.md");
        create_file(&a, Some("x")).unwrap();
        let copy = duplicate_file(&a).unwrap();
        assert!(PathBuf::from(copy).exists());
    }

    #[test]
    fn list_directory_sorts_dirs_first() {
        let dir = temp_dir();
        create_file(&dir.join("z.md"), Some("")).unwrap();
        create_directory(&dir.join("a-folder")).unwrap();
        let entries = list_directory(&dir).unwrap();
        assert!(entries[0].is_dir);
    }

    #[test]
    fn strips_utf8_bom() {
        let dir = temp_dir();
        let file = dir.join("bom.md");
        std::fs::write(&file, [0xEF, 0xBB, 0xBF, b'h', b'i']).unwrap();
        let resp = read_text_file(&file).unwrap();
        assert_eq!(resp.content, "hi");
    }
}
