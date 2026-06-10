use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::models::errors::AppError;

/// Tracks filesystem locations the user has explicitly granted access to
/// (via open/save dialogs or by opening a workspace folder). Every custom
/// Tauri command that touches the filesystem must pass through `ensure`.
#[derive(Default)]
pub struct PathGuard {
    allowed: Mutex<HashSet<PathBuf>>,
}

impl PathGuard {
    /// Grant access to a file or directory (and its children, for dirs).
    pub fn allow(&self, path: &str) -> Result<PathBuf, AppError> {
        let normalized = normalize(path)?;
        self.allowed.lock().unwrap().insert(normalized.clone());
        Ok(normalized)
    }

    /// Validate that `path` is inside an allowed scope. Returns the
    /// normalized absolute path on success.
    pub fn ensure(&self, path: &str) -> Result<PathBuf, AppError> {
        let normalized = normalize(path)?;
        let allowed = self.allowed.lock().unwrap();
        let permitted = allowed
            .iter()
            .any(|root| normalized == *root || normalized.starts_with(root));
        if permitted {
            Ok(normalized)
        } else {
            Err(AppError::PermissionDenied(format!(
                "Path is outside of allowed scopes: {}",
                normalized.display()
            )))
        }
    }
}

/// Normalize a path without requiring it to exist: canonicalize the deepest
/// existing ancestor, then re-append the remaining components. Rejects
/// relative paths and `..` traversal in the non-existing tail.
fn normalize(path: &str) -> Result<PathBuf, AppError> {
    let p = Path::new(path);
    if !p.is_absolute() {
        return Err(AppError::InvalidPath(format!(
            "Path must be absolute: {path}"
        )));
    }

    if let Ok(canonical) = p.canonicalize() {
        return Ok(strip_verbatim(canonical));
    }

    // The path does not exist (yet). Canonicalize the parent chain.
    let mut existing = p.to_path_buf();
    let mut tail: Vec<std::ffi::OsString> = Vec::new();
    loop {
        match existing.parent() {
            Some(parent) => {
                if let Some(name) = existing.file_name() {
                    let name = name.to_os_string();
                    if name == ".." || name == "." {
                        return Err(AppError::InvalidPath(format!(
                            "Path traversal is not allowed: {path}"
                        )));
                    }
                    tail.push(name);
                }
                existing = parent.to_path_buf();
                if existing.exists() {
                    break;
                }
            }
            None => return Err(AppError::InvalidPath(format!("Invalid path: {path}"))),
        }
    }

    let mut canonical = existing
        .canonicalize()
        .map_err(|e| AppError::InvalidPath(format!("{path}: {e}")))?;
    for component in tail.iter().rev() {
        canonical.push(component);
    }
    Ok(strip_verbatim(canonical))
}

/// On Windows, `canonicalize` returns `\\?\C:\...` verbatim paths; strip the
/// prefix so comparisons and display stay consistent.
fn strip_verbatim(path: PathBuf) -> PathBuf {
    let s = path.to_string_lossy();
    if let Some(stripped) = s.strip_prefix(r"\\?\") {
        PathBuf::from(stripped)
    } else {
        path
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("markforge-test-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn allows_paths_inside_scope() {
        let guard = PathGuard::default();
        let dir = temp_dir();
        guard.allow(dir.to_str().unwrap()).unwrap();
        let child = dir.join("notes.md");
        assert!(guard.ensure(child.to_str().unwrap()).is_ok());
    }

    #[test]
    fn rejects_paths_outside_scope() {
        let guard = PathGuard::default();
        let dir = temp_dir();
        let other = temp_dir();
        guard.allow(dir.to_str().unwrap()).unwrap();
        let outside = other.join("secret.md");
        assert!(guard.ensure(outside.to_str().unwrap()).is_err());
    }

    #[test]
    fn rejects_relative_paths() {
        let guard = PathGuard::default();
        assert!(guard.ensure("relative/path.md").is_err());
    }

    #[test]
    fn rejects_traversal_in_nonexistent_tail() {
        let guard = PathGuard::default();
        let dir = temp_dir();
        guard.allow(dir.to_str().unwrap()).unwrap();
        let sneaky = dir.join("missing").join("..").join("..").join("x.md");
        let result = guard.ensure(sneaky.to_str().unwrap());
        // Either rejected as traversal or resolved outside the scope.
        assert!(result.is_err());
    }

    #[test]
    fn nonexistent_file_in_scope_is_allowed() {
        let guard = PathGuard::default();
        let dir = temp_dir();
        guard.allow(dir.to_str().unwrap()).unwrap();
        let newfile = dir.join("sub").join("new.md");
        assert!(guard.ensure(newfile.to_str().unwrap()).is_ok());
    }
}
