use serde::{Deserialize, Serialize};

use super::files::FileEntry;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceTree {
    pub root: String,
    pub entries: Vec<FileEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub path: String,
    pub line: usize,
    pub column: usize,
    pub preview: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WorkspaceSettings {
    pub name: String,
    pub default_export_format: String,
    pub preview_theme: String,
    pub mermaid_theme: String,
    pub assets_folder: String,
    pub exclude: Vec<String>,
}

impl Default for WorkspaceSettings {
    fn default() -> Self {
        Self {
            name: String::new(),
            default_export_format: "pdf".into(),
            preview_theme: "system".into(),
            mermaid_theme: "default".into(),
            assets_folder: "assets".into(),
            exclude: vec!["node_modules".into(), ".git".into(), "dist".into()],
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub is_repo: bool,
    pub branch: Option<String>,
    pub files: Vec<GitFileStatus>,
}
