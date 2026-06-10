use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;

use ignore::WalkBuilder;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::Emitter;

use crate::models::errors::AppError;
use crate::models::files::FileEntry;
use crate::models::workspace::{GitFileStatus, GitStatus, WorkspaceSettings, WorkspaceTree};
use crate::services::file_service;

const MAX_ENTRIES: usize = 50_000;

pub fn workspace_settings_path(root: &Path) -> PathBuf {
    root.join(".markforge").join("workspace.json")
}

pub fn load_workspace_settings(root: &Path) -> Result<WorkspaceSettings, AppError> {
    let path = workspace_settings_path(root);
    if !path.exists() {
        let mut defaults = WorkspaceSettings::default();
        defaults.name = root
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "Workspace".into());
        return Ok(defaults);
    }
    let text = std::fs::read_to_string(&path)?;
    Ok(serde_json::from_str(&text).unwrap_or_default())
}

pub fn save_workspace_settings(root: &Path, settings: &WorkspaceSettings) -> Result<(), AppError> {
    let path = workspace_settings_path(root);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(settings)?)?;
    Ok(())
}

/// Scan a workspace folder, honoring .gitignore plus the workspace exclude
/// list. Returns a flat list of entries; the frontend builds the tree.
pub fn read_workspace(root: &Path) -> Result<WorkspaceTree, AppError> {
    if !root.is_dir() {
        return Err(AppError::InvalidPath(format!(
            "Not a directory: {}",
            root.display()
        )));
    }
    let settings = load_workspace_settings(root)?;
    let excludes: Vec<String> = settings.exclude;

    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(true)
        .follow_links(false)
        .filter_entry(move |entry| {
            let name = entry.file_name().to_string_lossy();
            if name == ".git" || name == ".markforge" {
                return false;
            }
            !excludes.iter().any(|ex| name == ex.as_str())
        })
        .build();

    let mut entries: Vec<FileEntry> = Vec::new();
    for result in walker {
        let entry = match result {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if path == root {
            continue;
        }
        if let Ok(fe) = file_service::file_entry(path) {
            entries.push(fe);
        }
        if entries.len() >= MAX_ENTRIES {
            break;
        }
    }
    Ok(WorkspaceTree {
        root: root.to_string_lossy().into_owned(),
        entries,
    })
}

// ---------------------------------------------------------------------------
// File watcher
// ---------------------------------------------------------------------------

#[derive(Default)]
pub struct WorkspaceWatcher {
    inner: Mutex<Option<RecommendedWatcher>>,
}

impl WorkspaceWatcher {
    pub fn watch(&self, app: tauri::AppHandle, root: PathBuf) -> Result<(), AppError> {
        let mut guard = self.inner.lock().unwrap();
        // Drop any previous watcher first.
        *guard = None;

        let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            if let Ok(event) = res {
                use notify::EventKind;
                let relevant = matches!(
                    event.kind,
                    EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
                );
                if relevant {
                    let paths: Vec<String> = event
                        .paths
                        .iter()
                        .map(|p| p.to_string_lossy().into_owned())
                        .collect();
                    let _ = app.emit("workspace://changed", paths);
                }
            }
        })
        .map_err(|e| AppError::Io(e.to_string()))?;

        watcher
            .watch(&root, RecursiveMode::Recursive)
            .map_err(|e| AppError::Io(e.to_string()))?;
        *guard = Some(watcher);
        Ok(())
    }

    pub fn unwatch(&self) {
        *self.inner.lock().unwrap() = None;
    }
}

// ---------------------------------------------------------------------------
// Read-only Git awareness
// ---------------------------------------------------------------------------

fn run_git(root: &Path, args: &[&str]) -> Option<String> {
    let mut cmd = Command::new("git");
    cmd.current_dir(root).args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let output = cmd.output().ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).into_owned())
}

pub fn git_status(root: &Path) -> GitStatus {
    if !root.join(".git").exists() {
        return GitStatus {
            is_repo: false,
            branch: None,
            files: Vec::new(),
        };
    }
    let branch = run_git(root, &["rev-parse", "--abbrev-ref", "HEAD"])
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    let files = run_git(root, &["status", "--porcelain"])
        .map(|out| {
            out.lines()
                .filter_map(|line| {
                    if line.len() < 4 {
                        return None;
                    }
                    let code = line[..2].trim();
                    let rel = line[3..].trim().trim_matches('"');
                    let status = match code {
                        "??" => "new",
                        "A" | "AM" => "added",
                        "D" | "AD" => "deleted",
                        _ => "modified",
                    };
                    Some(GitFileStatus {
                        path: root.join(rel).to_string_lossy().into_owned(),
                        status: status.into(),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    GitStatus {
        is_repo: true,
        branch,
        files,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!("markforge-ws-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn scan_respects_exclude_list() {
        let dir = temp_dir();
        std::fs::create_dir_all(dir.join("node_modules")).unwrap();
        std::fs::write(dir.join("node_modules").join("x.md"), "x").unwrap();
        std::fs::write(dir.join("readme.md"), "# hi").unwrap();
        let tree = read_workspace(&dir).unwrap();
        assert!(tree.entries.iter().any(|e| e.name == "readme.md"));
        assert!(!tree.entries.iter().any(|e| e.name == "x.md"));
    }

    #[test]
    fn workspace_settings_roundtrip() {
        let dir = temp_dir();
        let mut settings = WorkspaceSettings::default();
        settings.name = "Test".into();
        save_workspace_settings(&dir, &settings).unwrap();
        let loaded = load_workspace_settings(&dir).unwrap();
        assert_eq!(loaded.name, "Test");
    }

    #[test]
    fn non_repo_git_status() {
        let dir = temp_dir();
        let status = git_status(&dir);
        assert!(!status.is_repo);
        assert!(status.branch.is_none());
    }
}
